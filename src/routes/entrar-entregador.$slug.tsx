import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, CheckCircle2, Store } from "lucide-react";

export const Route = createFileRoute("/entrar-entregador/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome_fantasia, logo_url, cor_primaria, slug")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!data) throw notFound();
    return data;
  },
  component: CadastroEntregadorPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
      Estabelecimento não encontrado.
    </div>
  ),
});

const VEICULOS = [
  { value: "moto",       label: "🏍️  Moto" },
  { value: "bicicleta",  label: "🚲  Bicicleta" },
  { value: "carro",      label: "🚗  Carro" },
  { value: "a_pe",       label: "🚶  A pé" },
];

function CadastroEntregadorPage() {
  const empresa = Route.useLoaderData();
  const brand   = (empresa as any).cor_primaria || "#F97316";

  const [nome,      setNome]      = useState("");
  const [telefone,  setTelefone]  = useState("");
  const [veiculo,   setVeiculo]   = useState("");
  const [chavePix,  setChavePix]  = useState("");
  const [tipoPix,   setTipoPix]   = useState("aleatoria");
  const [salvando,  setSalvando]  = useState(false);
  const [erro,      setErro]      = useState("");
  const [enviado,   setEnviado]   = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) { setErro("Digite seu nome."); return; }
    if (!telefone.replace(/\D/g, "") || telefone.replace(/\D/g, "").length < 8) {
      setErro("Digite um telefone válido."); return;
    }
    if (!veiculo) { setErro("Selecione o tipo de veículo."); return; }

    setSalvando(true);
    const { error } = await (supabase as any).from("entregadores").insert({
      empresa_id:     (empresa as any).id,
      nome:           nome.trim(),
      telefone:       telefone.trim(),
      veiculo,
      tipo:           "freelancer",
      aprovado:       false,
      chave_pix:      chavePix.trim() || null,
      tipo_chave_pix: chavePix.trim() ? tipoPix : null,
    });
    setSalvando(false);

    if (error) {
      setErro("Erro ao enviar cadastro. Tente novamente.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="size-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="size-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 mb-2">Cadastro enviado!</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Seu cadastro foi recebido por <strong>{(empresa as any).nome_fantasia}</strong>.
            Aguarde a aprovação — você receberá o link de acesso em breve.
          </p>
          <div className="mt-6 p-4 bg-zinc-50 rounded-2xl text-xs text-zinc-400">
            💡 Salve este site nos favoritos para acessar rapidamente depois.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-5 flex items-center gap-4">
          {(empresa as any).logo_url ? (
            <img src={(empresa as any).logo_url} alt={(empresa as any).nome_fantasia}
              className="size-12 rounded-xl object-cover" />
          ) : (
            <div className="size-12 rounded-xl bg-zinc-100 flex items-center justify-center">
              <Store className="size-6 text-zinc-400" />
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-400">Cadastro de entregador</p>
            <p className="font-bold text-zinc-900">{(empresa as any).nome_fantasia}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        {/* Como funciona */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-4">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-5">Como funciona</h2>
          <div className="space-y-5">

            <div className="flex items-start gap-4">
              <div className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ backgroundColor: brand }}>1</div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Faça seu cadastro</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Preencha o formulário abaixo com seu nome, WhatsApp e tipo de veículo. O cadastro é gratuito e leva menos de 1 minuto.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ backgroundColor: brand }}>2</div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Aguarde a aprovação</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  O <strong>{(empresa as any).nome_fantasia}</strong> vai analisar seu cadastro. Quando aprovado, você receberá um link pessoal pelo WhatsApp — salve-o no celular, pois é o seu acesso.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ backgroundColor: brand }}>3</div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Veja os pedidos disponíveis</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Abra seu link pessoal a qualquer hora. Os pedidos prontos para entrega aparecem em tempo real com o nome e endereço do cliente. Você escolhe qual quer pegar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ backgroundColor: brand }}>4</div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Aceite e saia para entregar</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Clique em <strong>"Aceitar entrega"</strong> para pegar o pedido — ele sai da lista para os outros entregadores. Seu link pessoal abre o Google Maps direto para o endereço do cliente.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ backgroundColor: brand }}>5</div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Receba sua taxa de entrega</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  A taxa de entrega cobrada do cliente é o seu ganho por corrida. O combinado de repasse é feito diretamente com o <strong>{(empresa as any).nome_fantasia}</strong>.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Dúvidas frequentes */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-4">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Dúvidas frequentes</h2>
          <div className="space-y-4">
            {[
              { p: "Preciso pagar algo?", r: "Não. O cadastro é 100% gratuito." },
              { p: "Posso trabalhar no meu horário?", r: "Sim. Você escolhe quando quer estar disponível — não há horário fixo nem obrigação de aceitar pedidos." },
              { p: "Como sei que um pedido apareceu?", r: "Deixe seu link pessoal aberto no celular. Os pedidos aparecem automaticamente em tempo real, sem precisar atualizar a página." },
              { p: "O que acontece se eu não pegar o pedido?", r: "Nada. O pedido fica disponível para outros entregadores. Você só aceita o que quiser." },
              { p: "Como recebo o pagamento?", r: "Você combina diretamente com o estabelecimento. Geralmente o repasse é feito ao final do dia ou semana." },
            ].map((faq, i) => (
              <div key={i} className="border-b border-zinc-50 last:border-0 pb-4 last:pb-0">
                <p className="text-sm font-bold text-zinc-800">❓ {faq.p}</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{faq.r}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${brand}20` }}>
              <Bike className="size-6" style={{ color: brand }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900">Seja um entregador</h1>
              <p className="text-sm text-zinc-400">Preencha seus dados para se cadastrar</p>
            </div>
          </div>

          <form onSubmit={cadastrar} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-1.5 block">
                Nome completo *
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full h-12 rounded-2xl border border-zinc-200 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brand } as any}
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-1.5 block">
                WhatsApp / Telefone *
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full h-12 rounded-2xl border border-zinc-200 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brand } as any}
              />
            </div>

            {/* Veículo */}
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-1.5 block">
                Tipo de veículo *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VEICULOS.map(v => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setVeiculo(v.value)}
                    className={`h-12 rounded-2xl border-2 text-sm font-semibold transition-all ${
                      veiculo === v.value
                        ? "border-current text-white"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                    style={veiculo === v.value ? { backgroundColor: brand, borderColor: brand } : {}}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PIX */}
            <div className="border-t border-zinc-100 pt-4">
              <label className="text-sm font-semibold text-zinc-700 mb-1.5 block">
                Chave PIX <span className="text-zinc-400 font-normal">(opcional)</span>
              </label>
              <p className="text-xs text-zinc-400 mb-3">
                Para receber sua taxa de entrega diretamente no seu banco, sem complicação.
              </p>
              <div className="space-y-2">
                <select
                  value={tipoPix}
                  onChange={e => setTipoPix(e.target.value)}
                  className="w-full h-12 rounded-2xl border border-zinc-200 px-4 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brand } as any}
                >
                  <option value="aleatoria">Chave aleatória</option>
                  <option value="cpf">CPF</option>
                  <option value="telefone">Telefone</option>
                  <option value="email">E-mail</option>
                </select>
                <input
                  type="text"
                  value={chavePix}
                  onChange={e => setChavePix(e.target.value)}
                  placeholder={
                    tipoPix === "aleatoria" ? "Cole sua chave aleatória"
                    : tipoPix === "cpf" ? "000.000.000-00"
                    : tipoPix === "telefone" ? "(66) 99999-9999"
                    : "seu@email.com"
                  }
                  className="w-full h-12 rounded-2xl border border-zinc-200 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brand } as any}
                />
              </div>
            </div>

            {erro && (
              <p className="text-sm text-red-500 font-medium">{erro}</p>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="w-full h-14 rounded-2xl text-white font-black text-base disabled:opacity-60 transition-opacity mt-2"
              style={{ backgroundColor: brand }}
            >
              {salvando ? "Enviando…" : "Enviar cadastro"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          Após o envio, o responsável pelo estabelecimento irá analisar seu cadastro.
        </p>
      </div>
    </div>
  );
}
