import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa/categorias")({
  component: CategoriasPage,
});

function CategoriasPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [editId, setEditId]       = useState<string | null>(null);
  const [editNome, setEditNome]   = useState("");
  const [editOrdem, setEditOrdem] = useState(0);
  const [editPreparo, setEditPreparo] = useState(true);

  const { data } = useQuery({
    queryKey: ["categorias-page", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("categorias").select("*").eq("empresa_id", empresaId!).order("ordem")).data ?? [],
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ordem = Number(fd.get("ordem") || 0);
    if (ordem < 0) { toast.error("A ordem deve ser 0 ou maior."); return; }
    const { data: nova, error } = await supabase
      .from("categorias")
      .insert({
        empresa_id:    empresaId!,
        nome:          String(fd.get("nome")),
        ordem,
        requer_preparo: fd.get("requer_preparo") === "on",
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    (e.currentTarget as HTMLFormElement).reset();
    if (nova) {
      qc.setQueryData(["categorias-page", empresaId], (old: any[]) =>
        [...(old ?? []), nova].sort((a: any, b: any) => a.ordem - b.ordem)
      );
    } else {
      qc.invalidateQueries({ queryKey: ["categorias-page", empresaId] });
    }
    toast.success("Categoria cadastrada com sucesso.");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.setQueryData(["categorias-page", empresaId], (old: any[]) =>
      (old ?? []).filter((c: any) => c.id !== id)
    );
  }

  async function togglePreparo(id: string, atual: boolean) {
    await supabase.from("categorias").update({ requer_preparo: !atual } as any).eq("id", id);
    qc.setQueryData(["categorias-page", empresaId], (old: any[]) =>
      (old ?? []).map((c: any) => c.id === id ? { ...c, requer_preparo: !atual } : c)
    );
  }

  function startEdit(c: any) {
    setEditId(c.id);
    setEditNome(c.nome);
    setEditOrdem(c.ordem);
    setEditPreparo(c.requer_preparo !== false);
  }

  async function saveEdit(id: string) {
    if (editOrdem < 0) { toast.error("A ordem deve ser 0 ou maior."); return; }
    const { error } = await supabase
      .from("categorias")
      .update({ nome: editNome, ordem: editOrdem, requer_preparo: editPreparo } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.setQueryData(["categorias-page", empresaId], (old: any[]) =>
      (old ?? [])
        .map((c: any) => c.id === id ? { ...c, nome: editNome, ordem: editOrdem, requer_preparo: editPreparo } : c)
        .sort((a: any, b: any) => a.ordem - b.ordem)
    );
    setEditId(null);
    toast.success("Categoria atualizada.");
  }

  return (
    <>
      <PageHeader title="Categorias" subtitle="Organize os itens do cardápio" />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="bg-background rounded-xl ring-1 ring-black/5 divide-y divide-black/5">
          {(data ?? []).map((c: any) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
              {editId === c.id ? (
                <>
                  <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)}
                      className="h-8 text-sm flex-1 min-w-[120px]" placeholder="Nome" />
                    <Input type="number" min={0} value={editOrdem}
                      onChange={e => setEditOrdem(Number(e.target.value))}
                      className="h-8 text-sm w-20" placeholder="Ordem" />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 whitespace-nowrap cursor-pointer select-none">
                      <input type="checkbox" checked={editPreparo} onChange={e => setEditPreparo(e.target.checked)} />
                      Preparo
                    </label>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => saveEdit(c.id)}
                      className="text-green-600 hover:text-green-700 size-8">
                      <Check className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditId(null)}
                      className="text-zinc-400 hover:text-zinc-600 size-8">
                      <X className="size-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink">{c.nome}</div>
                    <div className="text-xs text-zinc-500">Ordem: {c.ordem}</div>
                  </div>
                  <button
                    onClick={() => togglePreparo(c.id, c.requer_preparo ?? true)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      c.requer_preparo !== false
                        ? "bg-orange-100 text-orange-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {c.requer_preparo !== false ? "Requer preparo" : "Sem preparo"}
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}
                    className="text-zinc-400 hover:text-brand">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}
                    className="text-zinc-400 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Nenhuma categoria.</div>
          )}
        </div>

        <form onSubmit={add} className="bg-background rounded-xl ring-1 ring-black/5 p-5 space-y-4 h-fit">
          <h3 className="text-sm font-semibold text-ink">Nova categoria</h3>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required placeholder="Ex.: Pizzas, Bebidas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ordem">Ordem</Label>
            <Input id="ordem" name="ordem" type="number" min={0} defaultValue={0} />
          </div>
          <div className="flex items-center justify-between border border-zinc-100 rounded-xl p-3 bg-zinc-50/60">
            <div>
              <p className="text-sm font-medium text-zinc-700">Requer preparo</p>
              <p className="text-xs text-zinc-400">Desative para bebidas e itens prontos</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" name="requer_preparo" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-zinc-300 peer-focus:ring-2 peer-focus:ring-brand/30 rounded-full peer peer-checked:bg-brand transition-colors" />
              <div className="absolute left-0.5 top-0.5 bg-white size-4 rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>
          <Button type="submit" className="w-full bg-brand hover:bg-brand/90">Adicionar</Button>
        </form>
      </div>
    </>
  );
}
