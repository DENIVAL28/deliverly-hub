import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireEntregador, type EntregadorData } from "@/lib/entregador-auth";
import { Building2, ChevronLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/entregadores/parceiros")({
  ssr: false,
  beforeLoad: () => requireEntregador(),
  component: RestaurantesPage,
});

function RestaurantesPage() {
  const { entregador } = Route.useRouteContext() as { entregador: EntregadorData };
  const aprovado = entregador.status_cadastro === "aprovado";

  // Restaurantes que aceitam entregadores da plataforma
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-plataforma-disponiveis"],
    enabled: aprovado,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("empresas")
        .select("id, nome_fantasia, logo_url, cidade, segmento")
        .eq("status", "ativa")
        .eq("tipo_operacao_entrega", "plataforma")
        .order("nome_fantasia");
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="bg-orange-500 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/entregadores/painel" className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold text-orange-100 uppercase">Plataforma</p>
            <h1 className="text-lg font-extrabold">Onde posso trabalhar</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {!aprovado ? (
          <div className="p-4 bg-yellow-950 border border-yellow-800 rounded-2xl text-xs text-yellow-300">
            ⚠️ Seu cadastro precisa ser aprovado pela plataforma para receber entregas.
          </div>
        ) : (
          <>
            <div className="p-4 bg-green-950 border border-green-800 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="size-4 text-green-400 mt-0.5 shrink-0" />
              <p className="text-xs text-green-300">
                Você aparece automaticamente para todos os restaurantes abaixo. Quando um pedido de delivery for confirmado, ele aparecerá no seu painel para aceitar.
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                Restaurantes disponíveis{empresas.length > 0 && ` (${empresas.length})`}
              </h2>

              {isLoading ? (
                <p className="text-xs text-zinc-600 text-center py-4">Carregando...</p>
              ) : empresas.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">
                  Nenhum restaurante usando entregadores da plataforma no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {empresas.map((emp: any) => (
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
                      <span className="shrink-0 text-xs font-semibold text-green-400 bg-green-950 border border-green-800 px-2 py-1 rounded-lg">
                        Ativo
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
