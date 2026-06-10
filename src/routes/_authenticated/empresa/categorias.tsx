import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa/categorias")({
  component: CategoriasPage,
});

function CategoriasPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["categorias-page", empresaId],
    enabled: !!empresaId,
    queryFn: async () => (await supabase.from("categorias").select("*").eq("empresa_id", empresaId!).order("ordem")).data ?? [],
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("categorias").insert({
      empresa_id: empresaId!,
      nome: String(fd.get("nome")),
      ordem: Number(fd.get("ordem") || 0),
    });
    if (error) { toast.error(error.message); return; }
    (e.currentTarget as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["categorias-page", empresaId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["categorias-page", empresaId] });
  }

  return (
    <>
      <PageHeader title="Categorias" subtitle="Organize os itens do cardápio" />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="bg-background rounded-xl ring-1 ring-black/5 divide-y divide-black/5">
          {(data ?? []).map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-ink">{c.nome}</div>
                <div className="text-xs text-zinc-500">Ordem: {c.ordem}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)} className="text-zinc-400 hover:text-red-600"><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="p-12 text-center text-sm text-zinc-500">Nenhuma categoria.</div>}
        </div>

        <form onSubmit={add} className="bg-background rounded-xl ring-1 ring-black/5 p-5 space-y-4 h-fit">
          <h3 className="text-sm font-semibold text-ink">Nova categoria</h3>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required placeholder="Ex.: Pizzas, Bebidas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ordem">Ordem</Label>
            <Input id="ordem" name="ordem" type="number" defaultValue={0} />
          </div>
          <Button type="submit" className="w-full bg-brand hover:bg-brand/90">Adicionar</Button>
        </form>
      </div>
    </>
  );
}