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
      empresa_id: (empresa as any).id,
      nome:       nome.trim(),
      telefone:   telefone.trim(),
      veiculo,
      tipo:       "freelancer",
      aprovado:   false,
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
