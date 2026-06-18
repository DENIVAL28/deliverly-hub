import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { CheckCircle2, Zap, Crown, Sparkles, ExternalLink, AlertTriangle, XCircle, CalendarDays, BanIcon, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/planos")({
  ssr: false,
  component: PlanosPage,
});

const PLANOS = [
  {
    id: "basico",
    nome: "Básico",
    preco: 99,
    icon: Zap,
    cor: "blue",
    descricao: "Ideal para começar",
    recursos: [
      "Até 50 produtos",
      "Até 3 cupons",
      "Até 3 entregadores",
      "Até 400 pedidos/mês",
      "Cardápio online",
      "Pedidos via WhatsApp",
      "PDV (caixa)",
      "QR Code de mesa",
    ],
    bloqueados: ["Avaliações", "Relatórios"],
  },
  {
    id: "profissional",
    nome: "Profissional",
    preco: 199,
    icon: Crown,
    cor: "orange",
    destaque: true,
    descricao: "O mais escolhido",
    recursos: [
      "Até 150 produtos",
      "Cupons ilimitados",
      "Até 20 entregadores",
      "Até 600 pedidos/mês",
      "Cardápio online",
      "Pedidos via WhatsApp",
      "PDV (caixa)",
      "QR Code de mesa",
      "Avaliações de clientes",
      "Relatórios",
    ],
    bloqueados: [],
  },
  {
    id: "premium",
    nome: "Premium",
    preco: 345,
    icon: Sparkles,
    cor: "violet",
    descricao: "Sem nenhum limite",
    recursos: [
      "Produtos ilimitados",
      "Cupons ilimitados",
      "Entregadores ilimitados",
      "Pedidos ilimitados",
      "Cardápio online",
      "Pedidos via WhatsApp",
      "PDV (caixa)",
      "QR Code de mesa",
      "Avaliações de clientes",
      "Relatórios",
      "Suporte prioritário",
    ],
    bloqueados: [],
  },
];

const CORES: Record<string, { badge: string; btn: string; ring: string; icon: string }> = {
  blue:   { badge: "bg-blue-100 text-blue-700",   btn: "bg-blue-600 hover:bg-blue-500",     ring: "ring-blue-500",   icon: "text-blue-500" },
  orange: { badge: "bg-orange-100 text-orange-700", btn: "bg-orange-500 hover:bg-orange-400", ring: "ring-orange-500", icon: "text-orange-500" },
  violet: { badge: "bg-violet-100 text-violet-700", btn: "bg-violet-600 hover:bg-violet-500", ring: "ring-violet-500", icon: "text-violet-500" },
};

function PlanosPage() {
  const { plano: planoAtual, empresaId, vencimento, diasRestantes, cancelado } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const navigate = useNavigate();

  const vencido   = diasRestantes !== null && diasRestantes <= 0;
  const urgente   = diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 3;
  const dataFmt   = vencimento
    ? new Date(vencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  // Detecta retorno do Mercado Pago
  const search = typeof window !== "undefined"
    ? Object.fromEntries(new URLSearchParams(window.location.search))
    : {};

  useEffect(() => {
    if (search.pagamento === "sucesso") {
      toast.success("Pagamento confirmado! Seu plano será ativado em instantes.");
      navigate({ to: "/empresa/planos", replace: true });
    } else if (search.pagamento === "pendente") {
      toast.info("Pagamento em análise. Você receberá uma notificação quando aprovado.");
      navigate({ to: "/empresa/planos", replace: true });
    } else if (search.pagamento === "erro") {
      toast.error("Pagamento não concluído. Tente novamente.");
      navigate({ to: "/empresa/planos", replace: true });
    }
  }, []);

  async function cancelarAssinatura() {
    if (!empresaId) return;
    setCancelando(true);
    const { error } = await supabase
      .from("empresas")
      .update({ cancelado: true, cancelado_em: new Date().toISOString() } as any)
      .eq("id", empresaId);
    setCancelando(false);
    setConfirmCancelar(false);
    if (error) { toast.error("Erro ao cancelar. Tente novamente."); return; }
    toast.success("Assinatura cancelada. Seu acesso continua até o fim do período.");
    window.location.reload();
  }

  async function reativarAssinatura() {
    if (!empresaId) return;
    setCancelando(true);
    const { error } = await supabase
      .from("empresas")
      .update({ cancelado: false, cancelado_em: null } as any)
      .eq("id", empresaId);
    setCancelando(false);
    if (error) { toast.error("Erro ao reativar. Tente novamente."); return; }
    toast.success("Assinatura reativada!");
    window.location.reload();
  }

  async function assinar(planoId: string) {
    setLoading(planoId);
    try {
      const { data, error } = await supabase.functions.invoke("criar-checkout", {
        body: { plano: planoId },
      });

      if (error || !data?.checkout_url) {
        toast.error(data?.error ?? "Não foi possível iniciar o pagamento. Tente novamente.");
        return;
      }

      window.location.href = data.checkout_url;
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHeader title="Planos" subtitle="Escolha o plano ideal para o seu negócio" />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Modal confirmação cancelamento */}
        {confirmCancelar && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <BanIcon className="size-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">Cancelar assinatura?</h3>
                  <p className="text-xs text-zinc-500">Esta ação pode ser desfeita a qualquer momento.</p>
                </div>
              </div>
              <p className="text-sm text-zinc-700 mb-2">
                Seu acesso continuará normalmente até <strong>{dataFmt ?? "o fim do período"}</strong>.
              </p>
              <p className="text-sm text-zinc-500 mb-6">
                Após essa data, sua loja será desativada. Você pode reativar sua assinatura antes disso sem perder nada.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmCancelar(false)}>
                  Voltar
                </Button>
                <Button
                  disabled={cancelando}
                  onClick={cancelarAssinatura}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                >
                  {cancelando ? "Cancelando…" : "Confirmar cancelamento"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Banner cancelado */}
        {cancelado && !vencido && (
          <div className="mb-6 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-start gap-3">
            <BanIcon className="size-5 text-zinc-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-zinc-700">Assinatura cancelada.</p>
              <p className="text-sm text-zinc-500 mt-0.5">
                Seu acesso continua até <strong>{dataFmt}</strong>. Após essa data sua loja será desativada.
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={cancelando} onClick={reativarAssinatura} className="shrink-0 gap-1.5">
              <RotateCcw className="size-3" /> Reativar
            </Button>
          </div>
        )}

        {/* Banner vencido */}
        {vencido && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
            <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Seu plano venceu em {dataFmt}.</p>
              <p className="text-sm text-red-600 mt-0.5">Sua loja pode ser bloqueada a qualquer momento. Renove agora para garantir o acesso dos seus clientes.</p>
            </div>
          </div>
        )}

        {/* Banner urgente (≤ 3 dias) */}
        {urgente && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Seu plano vence em {diasRestantes} dia{diasRestantes === 1 ? "" : "s"} ({dataFmt}).</p>
              <p className="text-sm text-amber-700 mt-0.5">Renove agora para não interromper o acesso da sua loja.</p>
            </div>
          </div>
        )}

        {/* Banner plano atual (normal) */}
        {planoAtual && !vencido && !urgente && (
          <div className="mb-8 p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center gap-3">
            <CalendarDays className="size-5 text-green-500 shrink-0" />
            <p className="text-sm text-zinc-700">
              Plano <strong className="capitalize">{planoAtual}</strong> ativo
              {dataFmt && <> — vence em <strong>{dataFmt}</strong></>}.
              {" "}Ao renovar, os 30 dias são somados ao vencimento atual.
            </p>
          </div>
        )}

        {/* Cards de plano */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANOS.map((p) => {
            const c = CORES[p.cor];
            const Icon = p.icon;
            const ativo = planoAtual === p.id;

            return (
              <div
                key={p.id}
                className={`relative bg-white rounded-2xl border shadow-sm flex flex-col transition-all
                  ${p.destaque ? `ring-2 ${c.ring} border-transparent shadow-lg` : "border-zinc-100 hover:border-zinc-200 hover:shadow-md"}`}
              >
                {p.destaque && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white ${c.btn}`}>
                    Mais popular
                  </div>
                )}

                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`size-9 rounded-xl flex items-center justify-center bg-zinc-50`}>
                      <Icon className={`size-5 ${c.icon}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900">{p.nome}</h3>
                      <p className="text-xs text-zinc-400">{p.descricao}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="text-3xl font-black text-zinc-900">
                      R$ {p.preco.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-sm text-zinc-400">/mês</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {p.recursos.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-sm text-zinc-700">
                        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                        {r}
                      </li>
                    ))}
                    {p.bloqueados.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-sm text-zinc-400 line-through">
                        <CheckCircle2 className="size-4 text-zinc-300 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-6 pb-6">
                  {ativo ? (
                    <Button
                      onClick={() => assinar(p.id)}
                      disabled={!!loading}
                      variant="outline"
                      className="w-full border-zinc-200 text-zinc-700 h-11"
                    >
                      {loading === p.id ? "Aguarde…" : "Renovar plano"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => assinar(p.id)}
                      disabled={!!loading}
                      className={`w-full h-11 font-bold text-white ${c.btn}`}
                    >
                      {loading === p.id ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Aguarde…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Assinar agora <ExternalLink className="size-4" />
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé informativo */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-sm text-zinc-500">
            Pagamentos processados com segurança pelo <strong>Mercado Pago</strong>.
          </p>
          <p className="text-xs text-zinc-400">
            PIX, cartão de crédito e boleto. Sem assinatura automática — você renova quando quiser.
          </p>
        </div>

        {/* Cancelar assinatura */}
        {planoAtual && !vencido && !cancelado && (
          <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-400 mb-2">
              Quer parar? Sem fidelidade e sem multa.
            </p>
            <button
              onClick={() => setConfirmCancelar(true)}
              className="text-xs text-zinc-400 hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              Cancelar assinatura
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
