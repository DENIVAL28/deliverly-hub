import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Clock, ShoppingBag, Search, ChevronRight, ChevronDown, X } from "lucide-react";

export const Route = createFileRoute("/lojas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pedir Delivery — SOS Sistemas" },
      { name: "description", content: "Peça delivery dos melhores restaurantes da sua cidade." },
    ],
  }),
  component: LojasPage,
});

const SEGMENTOS = [
  { id: "",             label: "Todos",       emoji: "🍽️" },
  { id: "pizzaria",     label: "Pizza",       emoji: "🍕" },
  { id: "hamburgueria", label: "Burger",      emoji: "🍔" },
  { id: "sushi",        label: "Sushi",       emoji: "🍣" },
  { id: "acai",         label: "Açaí",        emoji: "🍧" },
  { id: "marmita",      label: "Marmita",     emoji: "🍱" },
  { id: "lanchonete",   label: "Lanche",      emoji: "🥪" },
  { id: "confeitaria",  label: "Confeitaria", emoji: "🍰" },
  { id: "restaurante",  label: "Restaurante", emoji: "🍽️" },
  { id: "outro",        label: "Outros",      emoji: "🏪" },
];

const EMOJI_SEGMENTO: Record<string, string> = {
  pizzaria: "🍕", hamburgueria: "🍔", sushi: "🍣",
  acai: "🍧", marmita: "🍱", lanchonete: "🥪", outro: "🏪",
  confeitaria: "🍰", restaurante: "🍽️",
};

const CIDADE_KEY = "sos_cidade_selecionada";

function LojasPage() {
  const [lojas, setLojas]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [segmento, setSegmento]   = useState("");
  const [busca, setBusca]         = useState("");
  const [cidade, setCidade]       = useState<string | null>(null); // null = não escolheu ainda
  const [buscaCidade, setBuscaCidade] = useState("");

  useEffect(() => {
    const salva = localStorage.getItem(CIDADE_KEY);

    async function carregar() {
      // Filtra vencidas direto na query (evita transferir dados desnecessários)
      const agora = new Date().toISOString();
      const { data } = await (supabase as any)
        .from("empresas")
        .select("id,nome_fantasia,slug,logo_url,banner_url,cor_primaria,aberto,taxa_entrega,tempo_entrega,cidade,segmento")
        .eq("status", "ativa")
        .or(`vencimento.is.null,vencimento.gt.${agora}`)
        .order("nome_fantasia");
      const lista = data ?? [];
      setLojas(lista);
      setLoading(false);

      // Valida cidade salva: se não existe mais nenhum estabelecimento, limpa e mostra seleção
      if (salva) {
        const existe = lista.some((l: any) => (l.cidade ?? "").toLowerCase() === salva.toLowerCase());
        if (existe) setCidade(salva);
        else localStorage.removeItem(CIDADE_KEY);
      }
    }
    carregar();
  }, []);

  function escolherCidade(c: string) {
    setCidade(c);
    localStorage.setItem(CIDADE_KEY, c);
    setBuscaCidade("");
  }

  function trocarCidade() {
    setCidade(null);
    localStorage.removeItem(CIDADE_KEY);
    setSegmento("");
    setBusca("");
  }

  const cidades = Array.from(
    new Set(lojas.map((l) => l.cidade).filter(Boolean))
  ).sort() as string[];

  const cidadesFiltradas = cidades.filter((c) =>
    c.toLowerCase().includes(buscaCidade.toLowerCase())
  );

  const lojasDaCidade = cidade
    ? lojas.filter((l) => (l.cidade ?? "").toLowerCase() === cidade.toLowerCase())
    : [];

  const filtradas = lojasDaCidade.filter((l) => {
    const matchSeg   = !segmento || l.segmento === segmento;
    const matchBusca = !busca
      || l.nome_fantasia.toLowerCase().includes(busca.toLowerCase());
    return matchSeg && matchBusca;
  });

  const abertas  = filtradas.filter((l) => l.aberto);
  const fechadas = filtradas.filter((l) => !l.aberto);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Tela de escolha de cidade ──
  if (cidade === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        {/* Gradientes de fundo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,_rgba(249,115,22,0.18),_transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_90%,_rgba(249,115,22,0.08),_transparent)] pointer-events-none" />

        {/* Header */}
        <header className="relative px-6 py-5 flex items-center justify-between">
          <Link to="/">
            <img src="/segments/logo1.png" alt="SOS Sistemas" className="h-9 w-auto object-contain brightness-0 invert" />
          </Link>
          <Link to="/auth" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Área do lojista →
          </Link>
        </header>

        <div className="relative flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="w-full max-w-lg">

            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-orange-500 shadow-2xl shadow-orange-500/30 mb-6">
                <MapPin className="size-8 text-white" />
              </div>
              <h1 className="text-4xl font-black text-white mb-3 leading-tight">
                Peça delivery<br />
                <span className="text-orange-400">na sua cidade</span>
              </h1>
              <p className="text-zinc-400 text-base max-w-[38ch] mx-auto">
                Escolha sua cidade e veja os restaurantes disponíveis agora.
              </p>
            </div>

            {/* Busca */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar sua cidade..."
                value={buscaCidade}
                onChange={(e) => setBuscaCidade(e.target.value)}
                autoFocus
                className="w-full py-4 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Lista de cidades / estados */}
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map((n) => (
                  <div key={n} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : cidadesFiltradas.length > 0 ? (
              <div className="space-y-2">
                {cidadesFiltradas.map((c) => {
                  const qtd = lojas.filter((l) => (l.cidade ?? "").toLowerCase() === c.toLowerCase()).length;
                  return (
                    <button
                      key={c}
                      onClick={() => escolherCidade(c)}
                      className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                          <MapPin className="size-4 text-orange-400" />
                        </div>
                        <div>
                          <span className="text-white font-semibold block">{c}</span>
                          <span className="text-xs text-zinc-500">{qtd} estabelecimento{qtd !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-zinc-600 group-hover:text-orange-400 transition-colors" />
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Estado vazio — nenhuma loja cadastrada ainda */
              <div className="mt-2 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="text-4xl mb-4">🍽️</div>
                <p className="text-white font-bold text-lg mb-1">
                  {buscaCidade ? "Cidade não encontrada" : "Ainda sem estabelecimentos"}
                </p>
                <p className="text-zinc-400 text-sm mb-6 max-w-[34ch] mx-auto">
                  {buscaCidade
                    ? "Tente outro nome ou verifique a grafia."
                    : "Seu restaurante pode ser o primeiro da sua cidade aqui."}
                </p>
                {!buscaCidade && (
                  <Link to="/auth"
                    className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">
                    Cadastrar meu restaurante <ChevronRight className="size-4" />
                  </Link>
                )}
              </div>
            )}

            {/* Segmentos como pills decorativos */}
            {!loading && cidadesFiltradas.length === 0 && !buscaCidade && (
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {["🍕 Pizzas","🍔 Burgers","🍱 Marmitas","🍇 Açaí","☕ Cafés","🥐 Padarias"].map((s) => (
                  <span key={s} className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-zinc-400">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Tela de estabelecimentos da cidade ──
  return (
    <div className="min-h-screen bg-[#f7f7f8]">

      {/* Navbar */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/" className="shrink-0">
            <img src="/segments/logo1.png" alt="Deliverly Hub" className="h-9 w-auto object-contain" />
          </Link>

          <div className="relative flex-1 max-w-lg mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="text"
              placeholder={`Buscar em ${cidade}...`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-zinc-100 border border-transparent text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
            />
          </div>

          {/* Cidade selecionada */}
          <button
            onClick={trocarCidade}
            className="shrink-0 hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 text-sm font-semibold hover:bg-orange-100 transition-colors"
          >
            <MapPin className="size-3.5" />
            {cidade}
            <X className="size-3.5 text-orange-400" />
          </button>
        </div>
      </header>

      {/* Filtros por segmento */}
      <div className="bg-white border-b border-zinc-100 sticky top-16 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1.5 overflow-x-auto py-3 scrollbar-hide">
            {SEGMENTOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSegmento(s.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  segmento === s.id
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <span className="text-base leading-none">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Cabeçalho da cidade */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <MapPin className="size-5 text-orange-500" /> {cidade}
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">{lojasDaCidade.length} estabelecimento{lojasDaCidade.length !== 1 ? "s" : ""} disponíve{lojasDaCidade.length !== 1 ? "is" : "l"}</p>
          </div>
          <button onClick={trocarCidade} className="text-sm text-zinc-400 hover:text-orange-500 transition-colors flex items-center gap-1">
            <MapPin className="size-3.5" /> Trocar cidade
          </button>
        </div>

        {filtradas.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">😕</div>
            <p className="text-zinc-700 font-semibold text-lg">Nenhum estabelecimento encontrado</p>
            <p className="text-sm text-zinc-400 mt-1">Tente outro filtro</p>
          </div>
        ) : (
          <>
            {abertas.length > 0 && (
              <section className="mb-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-green-500 inline-block" />
                  Abertos agora · {abertas.length}
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {abertas.map((loja) => <LojaCard key={loja.id} loja={loja} fmt={fmt} />)}
                </div>
              </section>
            )}
            {fechadas.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-zinc-400 inline-block" />
                  Fechados · {fechadas.length}
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-70">
                  {fechadas.map((loja) => <LojaCard key={loja.id} loja={loja} fmt={fmt} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* CTA lojista */}
        <div className="mt-16 rounded-2xl overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-800 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Para estabelecimentos</p>
            <h3 className="text-white font-bold text-xl">Seu restaurante não está aqui?</h3>
            <p className="text-zinc-400 text-sm mt-1">Cadastre-se e comece a receber pedidos. 7 dias grátis.</p>
          </div>
          <Link to="/auth"
            className="shrink-0 flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
            Cadastrar estabelecimento <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function LojaCard({ loja, fmt }: { loja: any; fmt: (v: number) => string }) {
  const cor = loja.cor_primaria ?? "#F97316";
  return (
    <Link
      to="/loja/$slug"
      params={{ slug: loja.slug }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 group border border-zinc-100"
    >
      <div className="relative h-40 overflow-hidden" style={{ backgroundColor: cor + "18" }}>
        {loja.banner_url ? (
          <img src={loja.banner_url} alt={loja.nome_fantasia}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl opacity-20">{EMOJI_SEGMENTO[loja.segmento] ?? "🍽️"}</span>
          </div>
        )}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${
          loja.aberto ? "bg-green-500 text-white" : "bg-black/60 text-zinc-300"
        }`}>
          {loja.aberto ? "● Aberto" : "○ Fechado"}
        </div>
        {loja.logo_url && (
          <div className="absolute bottom-0 right-3 translate-y-1/2 size-12 rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
            <img src={loja.logo_url} alt={loja.nome_fantasia} className="w-full h-full object-contain p-0.5" />
          </div>
        )}
      </div>
      <div className={`p-4 ${loja.logo_url ? "pr-16" : ""}`}>
        <h3 className="font-bold text-zinc-900 truncate group-hover:text-orange-500 transition-colors text-base">
          {loja.nome_fantasia}
        </h3>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-50 text-xs text-zinc-500">
          {loja.tempo_entrega && (
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-zinc-400" /> {loja.tempo_entrega}
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto font-medium">
            <ShoppingBag className="size-3 text-zinc-400" />
            {Number(loja.taxa_entrega) === 0
              ? <span className="text-green-600 font-semibold">Grátis</span>
              : fmt(Number(loja.taxa_entrega))
            }
          </span>
        </div>
      </div>
    </Link>
  );
}
