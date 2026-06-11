import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/master/planos")({
  component: PlanosPage,
});

function PlanosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [newRecurso, setNewRecurso] = useState("");

  const { data } = useQuery({
    queryKey: ["planos-master"],
    queryFn: async () => (await supabase.from("planos").select("*").order("valor")).data ?? [],
  });

  function openEdit(p: any) {
    setEditing({ ...p, recursos: [...(p.recursos as string[] ?? [])] });
  }

  function addRecurso() {
    if (!newRecurso.trim()) return;
    setEditing((e: any) => ({ ...e, recursos: [...e.recursos, newRecurso.trim()] }));
    setNewRecurso("");
  }

  function removeRecurso(idx: number) {
    setEditing((e: any) => ({ ...e, recursos: e.recursos.filter((_: any, i: number) => i !== idx) }));
  }

  async function save(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const { error } = await supabase.from("planos").update({
      nome: String(fd.get("nome")),
      valor: Number(fd.get("valor")),
      limite_produtos: fd.get("limite_produtos") ? Number(fd.get("limite_produtos")) : null,
      limite_usuarios: fd.get("limite_usuarios") ? Number(fd.get("limite_usuarios")) : null,
      limite_pedidos: fd.get("limite_pedidos") ? Number(fd.get("limite_pedidos")) : null,
      recursos: editing.recursos,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["planos-master"] });
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader title="Planos" subtitle="Planos comercializados pelo Deliverly Hub" />

      <div className="grid md:grid-cols-3 gap-6">
        {(data ?? []).map((p: any) => (
          <div key={p.id} className="bg-background rounded-xl ring-1 ring-black/5 p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-brand font-semibold">{p.slug}</div>
              <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="text-zinc-400 hover:text-ink -mt-1 -mr-1">
                <Pencil className="size-3.5" />
              </Button>
            </div>
            <h3 className="text-lg font-semibold text-ink">{p.nome}</h3>
            <div className="mt-3 mb-5">
              <span className="text-3xl font-semibold text-ink">{fmt(Number(p.valor))}</span>
              <span className="text-sm text-zinc-500">/mês</span>
            </div>
            <ul className="space-y-2 text-sm text-zinc-600">
              {(p.recursos as string[] ?? []).map((r) => (
                <li key={r} className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> {r}</li>
              ))}
            </ul>
            <div className="mt-5 pt-5 border-t border-black/5 grid grid-cols-3 gap-3 text-center">
              <Limit label="Produtos"  value={p.limite_produtos ?? "∞"} />
              <Limit label="Usuários"  value={p.limite_usuarios ?? "∞"} />
              <Limit label="Pedidos"   value={p.limite_pedidos  ?? "∞"} />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar plano — {editing?.nome}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-4">
              <Field name="nome" label="Nome" defaultValue={editing.nome} required />
              <div className="grid grid-cols-2 gap-3">
                <Field name="valor" label="Valor mensal (R$)" type="number" step="0.01" defaultValue={editing.valor} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field name="limite_produtos" label="Limite produtos" type="number" defaultValue={editing.limite_produtos ?? ""} />
                <Field name="limite_usuarios" label="Limite usuários" type="number" defaultValue={editing.limite_usuarios ?? ""} />
                <Field name="limite_pedidos"  label="Limite pedidos"  type="number" defaultValue={editing.limite_pedidos  ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Recursos inclusos</Label>
                <div className="space-y-1">
                  {editing.recursos.map((r: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 px-3 py-1.5 rounded-md bg-surface text-zinc-700">{r}</span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeRecurso(i)} className="text-zinc-400 hover:text-red-500 shrink-0">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input value={newRecurso} onChange={(e) => setNewRecurso(e.target.value)} placeholder="Novo recurso..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecurso(); }}} />
                  <Button type="button" variant="outline" onClick={addRecurso} className="gap-1 shrink-0"><Plus className="size-3.5" /></Button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-brand hover:bg-brand/90">Salvar alterações</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Limit({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-400">{label}</div>
    </div>
  );
}

function Field(props: { name: string; label: string; type?: string; step?: string; defaultValue?: any; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input id={props.name} name={props.name} type={props.type ?? "text"} step={props.step} defaultValue={props.defaultValue} required={props.required} placeholder="∞ (ilimitado)" />
    </div>
  );
}
