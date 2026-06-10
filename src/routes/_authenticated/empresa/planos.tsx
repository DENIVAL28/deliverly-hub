import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { CheckCircle2, Zap, Crown, Sparkles, ExternalLink } from "lucide-react";

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
      "Cardápio online",
      "Pedidos via WhatsApp",
      "PDV (caixa)",
      "QR Code de mesa",
    ],
    bloqueados: ["Entregadores", "Avaliações", "Relatórios"],
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
      "Cardápio online",
      "Pedidos via WhatsApp",
      "PDV (caixa)",
      "QR Code de mesa",
      "Até 10 entregadores",
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
      "Cardápio online",
      "Pedidos via WhatsApp",
      "PDV (caixa)",
      "QR Code de mesa",
      "Entregadores ilimitados",
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
  const { plano: planoAtual, empresaId } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

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

        {/* Banner plano atual */}
        {planoAtual && (
          <div className="mb-8 p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center gap-3">
            <CheckCircle2 className="size-5 text-green-500 shrink-0" />
            <p className="text-sm text-zinc-700">
              Seu plano atual é o <strong className="capitalize">{planoAtual}</strong>.
              {" "}Ao assinar novamente, os 30 dias são somados ao vencimento atual.
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
      </div>
    </div>
  );
}
