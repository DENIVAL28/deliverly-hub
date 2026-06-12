import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/master/mensalidades")({
  component: MensalidadesPage,
});

function MensalidadesPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["mensalidades"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("id,nome_fantasia,vencimento,status,cancelado,planos(nome,valor)")
        .order("vencimento", { ascending: true });
      return data ?? [];
    },
  });

  async function renovar(id: string, vencimentoAtual: string | null) {
    const base = vencimentoAtual && vencimentoAtual >= new Date().toISOString().slice(0, 10)
      ? new Date(vencimentoAtual)
      : new Date();
    base.setDate(base.getDate() + 30);
    const novoVencimento = base.toISOString().slice(0, 10);
    const { error } = await supabase.from("empresas").update({ vencimento: novoVencimento, status: "ativa" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Renovado até ${novoVencimento}`);
    qc.invalidateQueries({ queryKey: ["mensalidades"] });
    qc.invalidateQueries({ queryKey: ["empresas"] });
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const today = new Date().toISOString().slice(0, 10);

  const totalMrr = (data ?? []).reduce((acc: number, e: any) =>
    acc + (e.status === "ativa" ? Number(e.planos?.valor ?? 0) : 0), 0);

  return (
    <>
      <PageHeader title="Mensalidades" subtitle="Acompanhe vencimentos e cobranças" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatMini label="Total empresas" value={(data ?? []).length} />
        <StatMini label="Ativas"   value={(data ?? []).filter((e: any) => e.status === "ativa").length} />
        <StatMini label="Vencidas" value={(data ?? []).filter((e: any) => e.vencimento && e.vencimento < today && e.status !== "ativa").length} />
        <StatMini label="MRR" value={fmt(totalMrr)} />
      </div>

      <div className="bg-background rounded-xl ring-1 ring-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="text-left px-4 py-3">Empresa</th>
              <th className="text-left px-4 py-3">Plano</th>
              <th className="text-left px-4 py-3">Valor</th>
              <th className="text-left px-4 py-3">Vencimento</th>
              <th className="text-left px-4 py-3">Situação</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((e: any) => {
              const vencido = e.vencimento && e.vencimento < today;
              return (
                <tr key={e.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium text-ink">{e.nome_fantasia}</td>
                  <td className="px-4 py-3 text-zinc-600">{e.planos?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{e.planos?.valor ? fmt(Number(e.planos.valor)) : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${vencido ? "text-red-600" : "text-zinc-600"}`}>{e.vencimento ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                        e.status === "ativa" ? "bg-green-100 text-green-700" :
                        e.status === "vencida" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{e.status}</span>
                      {e.cancelado && (
                        <span className="px-2 py-1 text-[10px] font-bold rounded uppercase bg-zinc-100 text-zinc-500">
                          cancelado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {e.cancelado && (
                        <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={async () => {
                            await supabase.from("empresas").update({ cancelado: false, cancelado_em: null } as any).eq("id", e.id);
                            qc.invalidateQueries({ queryKey: ["mensalidades"] });
                            toast.success("Assinatura reativada");
                          }}>
                          <RotateCcw className="size-3" /> Reativar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => renovar(e.id, e.vencimento)} className="gap-1">
                        <RefreshCw className="size-3" /> Renovar +30d
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">Sem empresas cadastradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-background rounded-xl ring-1 ring-black/5 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="text-xl font-semibold text-ink mt-1">{value}</div>
    </div>
  );
}
