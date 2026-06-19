import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireEntregador, type EntregadorData } from "@/lib/entregador-auth";
import { Building2, CheckCircle2, Clock, XCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/entregadores/parceiros")({
  ssr: false,
  beforeLoad: () => requireEntregador(),
  component: ParceirosPage,
});

const STATUS_PARCERIA: Record<string, { label: string; cor: string; icon: React.ReactNode }> = {
  pendente:  { label: "Aguardando",  cor: "text-yellow-400 bg-yellow-950 border-yellow-800",  icon: <Clock className="size-3" /> },
  aceita:    { label: "Aceita ✓",   cor: "text-green-400 bg-green-950 border-green-800",    icon: <CheckCircle2 className="size-3" /> },
  recusada:  { label: "Recusada",   cor: "text-red-400 bg-red-950 border-red-800",           icon: <XCircle className="size-3" /> },
  cancelada: { label: "Cancelada",  cor: "text-zinc-400 bg-zinc-800 border-zinc-700",        icon: <XCircle className="size-3" /> },
};

function ParceirosPage() {
  const { entregador } = Route.useRouteContext() as { entregador: EntregadorData };
  const aprovado = entregador.status_cadastro === "aprovado";
  const [solicitando, setSolicitando] = useState<string | null>(null);

  // Parcerias do entregador
  const { data: parcerias = [], refetch: refetchParcerias } = useQuery({
    queryKey: ["parcerias-entregador", entregador.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("entregador_parcerias")
        .select("id, status, empresa_id, empresas(nome_fantasia, logo_url, cidade, segmento)")
        .eq("entregador_id", entregador.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Empresas ativas na plataforma (para solicitar parceria)
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-plataforma"],
    enabled: aprovado,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("empresas")
        .select("id, nome_fantasia, logo_url, cidade, segmento")
        .eq("status", "ativa")
        .order("nome_fantasia");
      return (data ?? []) as any[];
    },
  });

  const empresasComParceria = new Set(parcerias.map((p: any) => p.empresa_id));
  const empresasSemParceria = empresas.filter((e: any) => !empresasComParceria.has(e.id));

  async function solicitar(empresaId: string) {
    setSolicitando(empresaId);
    try {
      const { data } = await supabase.rpc("entregador_solicitar_parceria", { p_empresa_id: empresaId });
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      toast.success("Solicitação enviada!");
      refetchParcerias();
    } finally {
      setSolicitando(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="bg-orange-500 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/entregadores/painel" className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold text-orange-100 uppercase">Parcerias</p>
            <h1 className="text-lg font-extrabold">Restaurantes parceiros</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {!aprovado && (
          <div className="p-4 bg-yellow-950 border border-yellow-800 rounded-2xl text-xs text-yellow-300">
            ⚠️ Seu cadastro precisa ser aprovado pela plataforma antes de solicitar parcerias.
          </div>
        )}

        {/* Minhas parcerias */}
        {parcerias.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Minhas parcerias</h2>
            <div className="space-y-2">
              {parcerias.map((p: any) => {
                const meta = STATUS_PARCERIA[p.status] ?? STATUS_PARCERIA.pendente;
                const emp = p.empresas;
                return (
                  <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
                    {emp?.logo_url ? (
                      <img src={emp.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                        <Building2 className="size-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{emp?.nome_fantasia}</p>
                      <p className="text-xs text-zinc-500">{emp?.cidade} · {emp?.segmento}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold shrink-0 ${meta.cor}`}>
                      {meta.icon}
                      <span>{meta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empresas disponíveis */}
        {aprovado && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
              Estabelecimentos disponíveis {empresasSemParceria.length > 0 && `(${empresasSemParceria.length})`}
            </h2>
            {empresasSemParceria.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">
                {empresas.length === 0
                  ? "Nenhum estabelecimento disponível no momento."
                  : "Você já solicitou parceria com todos os estabelecimentos disponíveis."}
              </p>
            ) : (
              <div className="space-y-2">
                {empresasSemParceria.map((emp: any) => (
                  <div key={emp.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
                    {emp.logo_url ? (
                      <img src={emp.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                        <Building2 className="size-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{emp.nome_fantasia}</p>
                      <p className="text-xs text-zinc-500">{emp.cidade} · {emp.segmento}</p>
                    </div>
                    <button
                      disabled={solicitando === emp.id}
                      onClick={() => solicitar(emp.id)}
                      className="shrink-0 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white text-xs font-bold transition"
                    >
                      {solicitando === emp.id ? "…" : "Solicitar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
