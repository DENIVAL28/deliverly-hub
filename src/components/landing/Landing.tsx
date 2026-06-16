import { Link } from "@tanstack/react-router";
import {
  ArrowRight, Store, Check, MessageCircle, Smartphone, Zap, BarChart3,
  Menu, X, ChevronDown, Mail, ClipboardList, Utensils, Bike,
} from "lucide-react";
import { useState, useEffect } from "react";

const WHATSAPP = "5566981289787";
const WA_LINK = `https://wa.me/${WHATSAPP}`;

const segments = [
  { img: "/segments/pizza.png",       emoji: "🍕", label: "Pizzarias",     desc: "Monte sabores, tamanhos e bordas com facilidade.",        bg: "from-red-50 to-orange-50",    dot: "bg-red-400" },
  { img: "/segments/burger.png",      emoji: "🍔", label: "Hamburguerias", desc: "Adicionais, pontos de carne e combos personalizados.",    bg: "from-yellow-50 to-amber-50",  dot: "bg-yellow-500" },
  { img: "/segments/marmita.png",     emoji: "🍱", label: "Marmitarias",   desc: "Cardápio semanal e gestão de pedidos recorrentes.",       bg: "from-green-50 to-emerald-50", dot: "bg-green-500" },
  { img: "/segments/acai.png",        emoji: "🍇", label: "Açaíterias",    desc: "Montagem personalizada direto no cardápio digital.",      bg: "from-purple-50 to-violet-50", dot: "bg-purple-500" },
  { img: "/segments/conveniencia.png",emoji: "🛒", label: "Conveniências", desc: "Catálogo amplo com categorias e busca rápida.",           bg: "from-blue-50 to-sky-50",      dot: "bg-blue-500" },
  { img: "/segments/padaria.png",     emoji: "🥐", label: "Padarias",      desc: "Agendamento de pedidos e horários flexíveis.",            bg: "from-amber-50 to-yellow-50",  dot: "bg-amber-500" },
  { img: "/segments/restaurante.png", emoji: "🍝", label: "Restaurantes",  desc: "Gestão completa do pedido até a entrega.",                bg: "from-orange-50 to-red-50",    dot: "bg-orange-500" },
  { img: "/segments/espetinho.png",   emoji: "🍢", label: "Espetinhos",    desc: "Cardápio simples e checkout ágil pelo WhatsApp.",         bg: "from-rose-50 to-pink-50",     dot: "bg-rose-500" },
  { img: "/segments/cafe.png",        emoji: "☕", label: "Cafeterias",    desc: "Personalização de bebidas e fidelização de clientes.",    bg: "from-stone-50 to-zinc-50",    dot: "bg-stone-500" },
];

const features = [
  { icon: Smartphone,    title: "Cardápio Digital sem App",           body: "Seu cliente acessa pelo celular, sem baixar nada. Cardápio rápido com fotos, categorias e checkout em segundos.", badge: "Mais acessado" },
  { icon: ClipboardList, title: "Caixa PDV para Vendas no Balcão",    body: "Venda no balcão com o mesmo sistema. Selecione produtos, aplique desconto, calcule troco e registre — tudo em um clique.", badge: "Exclusivo" },
  { icon: Zap,           title: "Pedidos em Tempo Real com Som",      body: "Chegou pedido? O sistema toca um alerta sonoro e exibe na tela. Avance o status com um clique e notifique o cliente pelo WhatsApp.", badge: null },
  { icon: MessageCircle, title: "Checkout Direto no WhatsApp",        body: "O pedido chega formatado e pronto para a cozinha. Menos erros, mais agilidade — sem digitar nada manualmente.", badge: null },
  { icon: Bike,          title: "Gestão de Entregadores",             body: "Cadastre entregadores e atribua pedidos na hora. Controle quem está em rota sem precisar de planilha ou grupo de zap.", badge: null },
  { icon: BarChart3,     title: "Relatórios e Cupons de Desconto",    body: "Veja faturamento, ticket médio e produtos mais vendidos. Crie cupons de desconto para fidelizar e atrair clientes novos.", badge: null },
];

const plans = [
  {
    name: "Básico", price: "99",
    tagline: "Menos que R$4 por dia para ter delivery próprio.",
    description: "Cardápio digital, caixa PDV e entregadores — tudo incluso.",
    features: ["Até 50 produtos", "Caixa PDV para vendas no balcão", "Até 3 entregadores", "PIX QR code automático", "Até 400 pedidos/mês", "Suporte por chat"],
    cta: "Começar grátis por 7 dias", highlight: false,
  },
  {
    name: "Profissional", price: "199",
    tagline: "Cada pedido, 100% do lucro no seu bolso.",
    description: "Para quem já tem volume e precisa de mais capacidade.",
    features: ["Até 150 produtos", "Caixa PDV para vendas no balcão", "Até 20 entregadores", "PIX QR code automático", "Até 600 pedidos/mês", "Suporte prioritário"],
    cta: "Quero crescer agora", highlight: true,
  },
  {
    name: "Premium", price: "345",
    tagline: "Sem limite. Para quem opera em alto volume.",
    description: "Recursos ilimitados e atendimento próximo.",
    features: ["Produtos ilimitados", "Entregadores ilimitados", "Pedidos ilimitados", "Cupons ilimitados", "Relatórios avançados", "Suporte prioritário — Seg a Sex"],
    cta: "Falar com consultor", highlight: false,
  },
];


const faqs = [
  { q: "Meu cliente precisa baixar algum app?",           a: "Não. O cardápio é acessado direto pelo celular, no navegador, sem precisar instalar nada. Funciona em qualquer smartphone com internet." },
  { q: "O que é o Caixa PDV e para que serve?",          a: "É um sistema de caixa para vendas presenciais no balcão. Você seleciona os produtos, aplica desconto, escolhe a forma de pagamento e registra a venda — tudo dentro do mesmo painel, sem precisar de outro sistema." },
  { q: "Como funciona o recebimento dos pagamentos?",     a: "Os clientes podem pagar na entrega (dinheiro, cartão ou PIX). Se escolherem PIX, o sistema gera o QR code automaticamente na hora do pedido. Não cobramos comissão sobre nenhuma venda." },
  { q: "Como cadastro meu cardápio?",                     a: "Diretamente pelo painel, em poucos cliques. Você adiciona nome, foto, preço e categoria de cada produto. Se precisar de ajuda para montar, nossa equipe te orienta sem custo adicional." },
  { q: "O que acontece depois dos 7 dias grátis?",        a: "Você escolhe o plano e continua. Se não quiser continuar, só não assina — sem cobrança automática e sem surpresa." },
  { q: "Posso cancelar a qualquer momento?",              a: "Sim, sem multa e sem contrato. Ao cancelar, seu acesso continua até o fim do período já pago. Depois disso, a loja é desativada — e você pode reativar quando quiser." },
];

const comparisonRows = [
  { label: "Comissão por pedido",   them: "Até 30% por venda",          us: "0% — sem comissão" },
  { label: "App obrigatório",       them: "Cliente precisa baixar",      us: "Funciona no navegador" },
  { label: "Visibilidade da loja",  them: "Concorre com centenas",       us: "Canal exclusivo da sua marca" },
  { label: "Dados dos clientes",    them: "Ficam com o marketplace",     us: "100% seus, para fidelizar" },
  { label: "Caixa PDV",             them: "Não incluso",                 us: "Incluso no mesmo plano" },
  { label: "Custo mensal",          them: "R$0 + comissão variável",     us: "A partir de R$99 fixos" },
];


export function Landing() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <Nav />
      <ConsumerHeroV2 />
      <div id="para-restaurantes" />
      <Hero />
      <SocialProof />
      <Stats />
      <Comparison />
      <ComoFunciona />
      <Segments />
      <Features />
      <SejaEntregador />
      <Pricing />
      <CTA />
      <FAQ />
      <Footer />
      <WhatsAppFlutuante />
    </div>
  );
}

/* ─── Consumer Hero ─── */
function ConsumerHeroV2() {
  const categorias = ["Pizzas", "Hambúrgueres", "Marmitas", "Açaí", "Padarias", "Restaurantes"];
  return (
    <section className="relative overflow-hidden bg-zinc-950 pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,_rgba(249,115,22,0.28),_transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(9,9,11,0.94),_rgba(9,9,11,0.74)_48%,_rgba(249,115,22,0.10))]" />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-300">
            <span className="size-1.5 rounded-full bg-green-400" />
            Delivery direto, sem app e sem cadastro
          </div>

          <h1 className="mt-7 text-4xl font-black leading-[1.04] text-white md:text-6xl">
            Peça comida direto dos restaurantes da sua cidade
          </h1>

          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-300 md:text-lg">
            Escolha a loja, monte seu pedido e envie direto para o estabelecimento. Mais rápido para você, melhor para o restaurante, sem intermediários no caminho.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/lojas"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-base font-black text-white shadow-2xl shadow-orange-500/25 transition-all hover:scale-[1.02] hover:bg-orange-400">
              <Bike className="size-5" /> Ver restaurantes disponíveis <ArrowRight className="size-5" />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-400">
            {["Sem cadastro", "Sem aplicativo", "Pedido direto com a loja"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <Check className="size-4 text-orange-400" /> {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* Glow atrás do vídeo */}
          <div className="absolute -inset-8 rounded-full bg-orange-500/20 blur-3xl" />

          {/* Container do vídeo */}
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/40 ring-1 ring-orange-500/10 bg-zinc-950">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover block"
              style={{ maxHeight: 480 }}
            >
              <source src="/segments/Create_a_high_end_animated_vec.mp4" type="video/mp4" />
              <source src="/segments/Create_a_modern_D_vector_anim.mp4" type="video/mp4" />
            </video>
            {/* Overlay sutil com gradiente nas bordas */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(to bottom, rgba(9,9,11,0.25) 0%, transparent 20%, transparent 80%, rgba(9,9,11,0.55) 100%)",
            }} />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
            {categorias.map((c) => (
              <span key={c} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


/* ─── Nav ─── */
function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dark = !scrolled && !open;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
      scrolled || open
        ? "bg-white/95 backdrop-blur-md border-b border-zinc-100 shadow-sm"
        : "bg-transparent border-b border-transparent"
    }`}>
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center">
            <img
              src="/segments/logo1.png"
              alt="SOS Sistemas"
              className={`h-14 w-auto max-w-[180px] object-contain transition-all duration-300 ${dark ? "brightness-0 invert" : ""}`}
            />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            {[["#como-funciona","Como funciona"],["#recursos","Recursos"],["#planos","Planos"],["#seja-entregador","🛵 Entregadores"]].map(([href,label]) => (
              <a key={href} href={href}
                className={`transition-colors ${dark ? "text-white/70 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pedir delivery — sempre visível */}
          <Link to="/lojas"
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all whitespace-nowrap">
            🛵 Pedir delivery
          </Link>
          <Link to="/auth"
            className={`hidden sm:block text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
              dark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-zinc-500 hover:text-zinc-900"
            }`}>
            Entrar
          </Link>
          <Link to="/auth"
            className="hidden sm:flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
            Testar grátis <ArrowRight className="size-4" />
          </Link>
          <button onClick={() => setOpen((v) => !v)}
            className={`md:hidden p-2 rounded-lg transition-colors ${dark ? "text-white hover:bg-white/10" : "text-zinc-500 hover:bg-zinc-100"}`}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-zinc-100 px-6 py-4 space-y-3">
          {[["#como-funciona","Como funciona"],["#recursos","Recursos"],["#planos","Planos"],["#seja-entregador","🛵 Entregadores"]].map(([href,label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block text-sm font-medium text-zinc-600 hover:text-orange-500 py-1.5">{label}</a>
          ))}
          <Link to="/lojas" onClick={() => setOpen(false)}
            className="block text-center bg-orange-500 text-white text-sm font-bold px-4 py-3 rounded-xl">
            🛵 Pedir delivery
          </Link>
          <div className="flex gap-3">
            <Link to="/auth" className="flex-1 text-center text-sm font-medium px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-600">Entrar</Link>
            <Link to="/auth" onClick={() => setOpen(false)}
              className="flex-1 text-center bg-orange-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">Testar grátis</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section className="relative bg-zinc-950 overflow-hidden min-h-screen flex items-center pt-20">
      {/* Vídeo de fundo */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
        src="/segments/Ultra_realistic_cinematic_food.mp4"
      />
      {/* Overlay escuro para legibilidade */}
      <div className="absolute inset-0 bg-zinc-950/45" />
      {/* Gradients laranja */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,_rgba(249,115,22,0.25),_transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_80%,_rgba(249,115,22,0.12),_transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Lado esquerdo — copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest">
              <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" />
              Cardápio + PDV + Entregadores — tudo por R$99/mês
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.08] text-white mb-6">
              Pare de perder<br />
              margem com <span className="relative inline-block">
                <span className="relative z-10 text-orange-400">marketplace.</span>
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-orange-500/50 rounded-full" />
              </span><br />
              Venda pelo seu canal.
            </h1>

            <p className="text-zinc-300 text-lg leading-relaxed mb-8 max-w-[46ch]">
              Cardápio digital + caixa PDV + gestão de entregadores em um sistema só —{" "}
              <strong className="text-white">sem comissão por pedido, sem contrato.</strong>
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
              <Link to="/auth"
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-7 py-4 rounded-2xl text-base transition-all hover:scale-[1.02] shadow-xl shadow-orange-500/25 w-full sm:w-auto">
                Testar grátis por 7 dias <ArrowRight className="size-5" />
              </Link>
              <a href={WA_LINK} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
                <MessageCircle className="size-3.5" /> Dúvidas? Fala no WhatsApp
              </a>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
              {["7 dias grátis", "Sem taxas por pedido", "Caixa PDV incluso", "Cancele quando quiser"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-orange-400 shrink-0" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Lado direito — mockup do cardápio */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative">
              {/* Glow atrás do phone */}
              <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full scale-75" />

              {/* Frame do celular */}
              <div className="relative w-72 bg-zinc-900 rounded-[2.5rem] ring-1 ring-white/10 shadow-2xl overflow-hidden" style={{ height: 580 }}>
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-950 rounded-b-2xl z-10" />

                {/* Tela do cardápio */}
                <div className="absolute inset-0 bg-zinc-100 overflow-hidden">
                  {/* Header da loja */}
                  <div className="bg-zinc-800 h-24 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-800" />
                  </div>
                  <div className="bg-white px-4 pb-3 shadow-sm">
                    <div className="flex items-end gap-3 -mt-8 mb-3">
                      <div className="size-16 rounded-2xl bg-orange-500 ring-4 ring-white flex items-center justify-center shrink-0 shadow-lg">
                        <Store className="size-7 text-white" />
                      </div>
                      <div className="pb-1">
                        <div className="h-3 bg-zinc-800 rounded-full w-28 mb-1.5" />
                        <div className="flex gap-1.5">
                          <div className="h-2 bg-green-400 rounded-full w-12" />
                          <div className="h-2 bg-zinc-200 rounded-full w-16" />
                        </div>
                      </div>
                    </div>
                    {/* Barra de busca */}
                    <div className="h-8 bg-zinc-100 rounded-xl" />
                  </div>

                  {/* Nav categorias */}
                  <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 mt-1">
                    {["Pizzas","Bebidas","Bordas"].map((c, i) => (
                      <div key={c} className={`px-3 py-1 rounded-full text-[10px] font-bold ${i === 0 ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-400"}`}>{c}</div>
                    ))}
                  </div>

                  {/* Produtos */}
                  <div className="px-3 pt-3 space-y-2">
                    {[
                      { name: "Mussarela", price: "R$ 45,90", w: "w-20" },
                      { name: "Calabresa",  price: "R$ 47,90", w: "w-24" },
                      { name: "Frango",     price: "R$ 49,90", w: "w-16" },
                    ].map((p) => (
                      <div key={p.name} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
                        <div className="flex-1">
                          <div className={`h-2.5 bg-zinc-800 rounded-full ${p.w} mb-1.5`} />
                          <div className="h-2 bg-zinc-200 rounded-full w-28 mb-2" />
                          <div className="h-3 bg-orange-500 rounded-full w-16" />
                        </div>
                        <div className="size-14 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 ml-3 flex items-center justify-center text-2xl shrink-0">
                          🍕
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Barra do carrinho flutuante */}
                <div className="absolute bottom-6 left-3 right-3">
                  <div className="bg-orange-500 rounded-2xl h-12 flex items-center justify-between px-4 shadow-xl">
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-lg">2×</span>
                    <span className="text-white text-xs font-bold">Ver carrinho</span>
                    <span className="text-white text-xs font-bold">R$ 93,80</span>
                  </div>
                </div>
              </div>

              {/* Cards flutuantes */}
              <div className="absolute -left-14 top-16 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-bounce" style={{ animationDuration: "3s" }}>
                <div className="size-9 rounded-xl bg-green-100 flex items-center justify-center text-lg">🛒</div>
                <div>
                  <div className="text-xs font-bold text-zinc-900">Novo pedido!</div>
                  <div className="text-[10px] text-zinc-400">Agora mesmo</div>
                </div>
              </div>

              <div className="absolute -right-12 bottom-24 bg-white rounded-2xl shadow-xl px-4 py-3">
                <div className="text-[10px] text-zinc-400 mb-0.5">Faturamento hoje</div>
                <div className="text-sm font-black text-zinc-900">R$ 1.247<span className="text-green-500 text-xs font-bold ml-1">▲ 18%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Social Proof ─── */
function SocialProof() {
  return (
    <section className="bg-orange-500 py-4">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-center justify-center gap-8 text-white text-sm font-semibold">
          <span className="flex items-center gap-2"><Check className="size-4" /> Cardápio digital incluso</span>
          <span className="hidden sm:block text-white/30">|</span>
          <span className="flex items-center gap-2"><Check className="size-4" /> Caixa PDV incluso</span>
          <span className="hidden sm:block text-white/30">|</span>
          <span className="flex items-center gap-2"><Check className="size-4" /> Gestão de entregadores inclusa</span>
          <span className="hidden sm:block text-white/30">|</span>
          <span className="flex items-center gap-2"><Check className="size-4" /> 0% de comissão por pedido</span>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ─── */
function Stats() {
  const items = [
    { value: "R$ 99",  label: "por mês, tudo incluso" },
    { value: "0%",     label: "de comissão por pedido" },
    { value: "< 24h",  label: "para o cardápio no ar" },
    { value: "3 em 1", label: "Cardápio + PDV + Entregadores" },
  ];
  return (
    <section className="py-12 bg-white border-b border-zinc-100">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {items.map((s) => (
            <div key={s.label}>
              <div className="text-3xl md:text-4xl font-black text-orange-500 mb-1">{s.value}</div>
              <div className="text-sm text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Como Funciona ─── */
function ComoFunciona() {
  const steps = [
    { num: "1", icon: ClipboardList, title: "Crie sua conta", desc: "Em menos de 5 minutos, sua loja já está no ar. Sem cartão de crédito, sem complicação." },
    { num: "2", icon: Utensils,      title: "Monte seu cardápio", desc: "Adicione produtos, fotos e preços com facilidade. Personalize cores, logo e identidade visual." },
    { num: "3", icon: Bike,          title: "Comece a receber pedidos", desc: "Compartilhe o link com seus clientes. Pedidos chegam direto no WhatsApp e no seu painel." },
  ];
  return (
    <section id="como-funciona" className="py-24 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Como funciona</span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3">
            Do zero ao primeiro pedido em menos de 24h
          </h2>
          <p className="text-zinc-500 max-w-[48ch] mx-auto">
            Sem técnico, sem contrato, sem complicação. Você configura tudo sozinho ou com nossa ajuda gratuita.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Linha conectora desktop */}
          <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-px bg-orange-200 z-0" style={{ left: "calc(16.67% + 2.5rem)", right: "calc(16.67% + 2.5rem)" }} />

          {steps.map(({ num, icon: Icon, title, desc }) => (
            <div key={num} className="relative z-10 flex flex-col items-center text-center">
              <div className="size-20 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 mb-5">
                <Icon className="size-8 text-white" />
              </div>
              <div className="absolute -top-3 -right-2 md:right-auto md:-top-3 md:left-[calc(50%+1.5rem)] size-6 rounded-full bg-white border-2 border-orange-500 flex items-center justify-center text-[10px] font-black text-orange-500">
                {num}
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-[28ch] mx-auto">{desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-xs text-zinc-400">Sem técnico, sem contrato — você configura tudo ou pedimos ajuda gratuita.</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Segment Card ─── */
function SegmentCard({ img, emoji, label, desc, bg, dot }: {
  img: string; emoji: string; label: string; desc: string; bg: string; dot: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="bg-white rounded-2xl ring-1 ring-zinc-200 hover:ring-orange-300 hover:shadow-lg transition-all group cursor-default overflow-hidden">
      <div className={`relative w-full bg-gradient-to-br ${bg} flex items-center justify-center overflow-hidden`} style={{ height: "160px" }}>
        {imgOk ? (
          <img src={img} alt={label} onError={() => setImgOk(false)}
            className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-lg" />
        ) : (
          <span className="transition-transform duration-300 group-hover:scale-110 select-none"
            style={{ fontSize: "72px", lineHeight: 1, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.10))" }}
            role="img" aria-label={label}>{emoji}</span>
        )}
        <span className={`absolute top-3 right-3 size-2 rounded-full ${dot} opacity-60`} />
      </div>
      <div className="p-4">
        <h3 className="font-bold text-zinc-900 mb-1">{label}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Segments ─── */
function Segments() {
  return (
    <section id="segmentos" className="py-24 bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Segmentos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3">Para cada cozinha, o cardápio certo.</h2>
          <p className="text-zinc-500 max-w-[52ch] mx-auto">Do espetinho ao restaurante — o sistema se adapta ao ritmo da sua operação.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {segments.map(({ img, emoji, label, desc, bg, dot }) => (
            <SegmentCard key={label} img={img} emoji={emoji} label={label} desc={desc} bg={bg} dot={dot} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */
function Features() {
  return (
    <section id="recursos" className="py-24 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-10 items-center mb-14">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Recursos</span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 text-balance">Cada recurso pensado para o dia a dia do seu delivery</h2>
          </div>
          <div className="aspect-video overflow-hidden rounded-2xl ring-1 ring-zinc-200 shadow-lg bg-zinc-950">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover">
              <source src="/segments/Create_a_modern_D_vector_anim.mp4" type="video/mp4" />
            </video>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, body, badge }) => (
            <div key={title} className="bg-white hover:bg-orange-50 rounded-2xl p-6 ring-1 ring-zinc-200 hover:ring-orange-200 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="size-11 rounded-xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center text-orange-500 transition-colors">
                  <Icon className="size-5" />
                </div>
                {badge && <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">{badge}</span>}
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Seja um Entregador ─── */
function SejaEntregador() {
  const steps = [
    {
      num: "1",
      emoji: "📲",
      title: "Receba o link de convite",
      desc: "O restaurante parceiro envia um link exclusivo para você. Abra no celular — sem precisar baixar nenhum aplicativo.",
    },
    {
      num: "2",
      emoji: "📝",
      title: "Faça o cadastro em 1 minuto",
      desc: "Preencha nome, WhatsApp e tipo de veículo. O estabelecimento analisa e aprova seu cadastro rapidamente.",
    },
    {
      num: "3",
      emoji: "🛵",
      title: "Escolha as entregas que quiser",
      desc: "Após aprovado, você recebe um link pessoal. Abra quando quiser, veja os pedidos disponíveis em tempo real e aceite os que preferir.",
    },
    {
      num: "4",
      emoji: "💰",
      title: "Receba sua taxa por corrida",
      desc: "Cada entrega aceita tem a taxa exibida antes de você confirmar. O repasse é combinado diretamente com o estabelecimento.",
    },
  ];

  const beneficios = [
    { icon: "🕐", texto: "Trabalhe no seu horário — sem escala fixa" },
    { icon: "📍", texto: "Sem mínimo de entregas por dia" },
    { icon: "📱", texto: "Tudo pelo celular, sem instalar nada" },
    { icon: "🗺️", texto: "Navegação integrada ao Google Maps" },
    { icon: "⚡", texto: "Pedidos em tempo real, aceite com um clique" },
    { icon: "🤝", texto: "Vínculo direto com o estabelecimento" },
  ];

  return (
    <section id="seja-entregador" className="relative py-24 bg-zinc-950 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_50%,_rgba(249,115,22,0.08),_transparent)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">

        {/* Cabeçalho */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <Bike className="size-3.5" /> Para entregadores
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
            Faça entregas no<br />
            <span className="text-orange-400">seu próprio ritmo</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-[52ch] mx-auto leading-relaxed">
            Restaurantes que usam o Delivery Hub podem convidar motoboys freelancers para entregar seus pedidos — sem vínculo fixo, sem horário obrigatório.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Esquerda — Como funciona */}
          <div>
            <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-orange-400 inline-block" />
              Como funciona
            </h3>
            <div className="space-y-8">
              {steps.map((s) => (
                <div key={s.num} className="flex items-start gap-5">
                  <div className="size-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-2xl">
                    {s.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">Passo {s.num}</span>
                    </div>
                    <p className="text-sm font-bold text-white">{s.title}</p>
                    <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direita — Benefícios + CTA */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-green-400 inline-block" />
                Vantagens para o entregador
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {beneficios.map((b) => (
                  <div key={b.texto} className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{b.icon}</span>
                    <span className="text-sm text-zinc-300">{b.texto}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-3xl p-8">
              <p className="text-sm font-bold text-orange-300 mb-2">Como começar?</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">
                Procure um restaurante da sua cidade que use o Delivery Hub e peça o link de cadastro. Ou fale com nossa equipe — indicamos parceiros próximos a você.
              </p>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3.5 rounded-2xl text-sm transition-all hover:scale-[1.02] shadow-xl shadow-orange-500/25 w-full"
              >
                <MessageCircle className="size-4" /> Quero ser entregador — falar no WhatsApp
              </a>
              <p className="text-xs text-zinc-600 text-center mt-3">Gratuito · Sem contrato · Trabalhe quando quiser</p>
            </div>

            {/* FAQ rápido */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
              {[
                { p: "Preciso ter CNH?", r: "Depende do veículo — para moto e carro sim. Para bicicleta e a pé, não." },
                { p: "Preciso pagar para se cadastrar?", r: "Não. O cadastro é 100% gratuito." },
                { p: "Posso trabalhar para vários restaurantes?", r: "Sim! Cada restaurante tem seu próprio link de cadastro — você pode se cadastrar em quantos quiser." },
              ].map((f, i) => (
                <div key={i} className={i > 0 ? "border-t border-white/5 pt-4" : ""}>
                  <p className="text-xs font-bold text-zinc-300">❓ {f.p}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{f.r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─── */
function Pricing() {
  return (
    <section id="planos" className="py-24 bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3 block">Planos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Planos simples, sem letra miúda.</h2>
          <p className="text-zinc-400 text-sm max-w-[56ch] mx-auto">
            Outros sistemas cobram separado por cada módulo. Aqui,{" "}
            <strong className="text-orange-400">tudo já está incluso no mesmo plano</strong> — sem surpresas na fatura.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-center">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-2xl p-8 flex flex-col relative ${
              p.highlight ? "bg-orange-500 ring-2 ring-orange-400 scale-105 shadow-2xl shadow-orange-500/30" : "bg-zinc-900 ring-1 ring-white/10"
            }`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-orange-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow">
                  Mais popular
                </div>
              )}
              <div className={`text-xs font-bold uppercase tracking-widest mb-4 ${p.highlight ? "text-white/80" : "text-zinc-400"}`}>{p.name}</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-sm ${p.highlight ? "text-white/70" : "text-zinc-500"}`}>R$</span>
                <span className="text-5xl font-black text-white">{p.price}</span>
                <span className={`text-sm ${p.highlight ? "text-white/70" : "text-zinc-500"}`}>/mês</span>
              </div>
              <p className={`text-sm font-semibold mb-2 ${p.highlight ? "text-white" : "text-orange-400"}`}>{p.tagline}</p>
              <p className={`text-sm mb-6 ${p.highlight ? "text-white/90" : "text-zinc-300"}`}>{p.description}</p>
              <ul className="space-y-3 mb-8 flex-grow">
                {p.features.map((f) => (
                  <li key={f} className={`text-sm flex items-start gap-2 ${p.highlight ? "text-white" : "text-zinc-300"}`}>
                    <Check className={`size-4 shrink-0 mt-0.5 ${p.highlight ? "text-white" : "text-orange-500"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              {p.name === "Premium" ? (
                <a href={WA_LINK} target="_blank" rel="noreferrer"
                  className={`w-full text-center font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                    p.highlight ? "bg-white text-orange-500 hover:bg-orange-50" : "bg-white/10 text-white hover:bg-white/20"
                  }`}>
                  <MessageCircle className="size-4" /> {p.cta}
                </a>
              ) : (
                <Link to="/auth"
                  className={`w-full text-center font-bold py-3 rounded-xl transition-all block ${
                    p.highlight ? "bg-white text-orange-500 hover:bg-orange-50" : "bg-white/10 text-white hover:bg-white/20"
                  }`}>
                  {p.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-zinc-600 text-xs mt-8">Todos os planos incluem 7 dias grátis. Sem cartão de crédito.</p>
      </div>
    </section>
  );
}

/* ─── CTA Final ─── */
function CTA() {
  return (
    <section id="cta" className="relative bg-zinc-950 overflow-hidden py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,_rgba(249,115,22,0.15),_transparent)]" />
      <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[radial-gradient(ellipse_80%_80%_at_100%_50%,_rgba(249,115,22,0.07),_transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Esquerda — copy */}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4 block">Comece hoje</span>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">
              Seu delivery próprio no ar em menos de 24 horas.
            </h2>
            <p className="text-zinc-300 text-lg leading-relaxed">
              Monte seu cardápio, gerencie pedidos e entregadores em um único painel — sem comissão e sem contrato. Cancele quando quiser.
            </p>
          </div>

          {/* Direita — ação única */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm flex flex-col gap-5">
            <Link to="/auth"
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-[1.01] shadow-xl shadow-orange-500/25">
              Criar minha conta grátis <ArrowRight className="size-5" />
            </Link>

            <div className="space-y-2.5">
              {["7 dias grátis, sem cartão de crédito", "Sem comissão por pedido, sem contrato", "Suporte na configuração sem custo"].map((t) => (
                <div key={t} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Check className="size-4 text-green-400 shrink-0" /> {t}
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 flex items-center justify-between text-sm">
              <Link to="/auth" className="text-zinc-400 hover:text-orange-400 transition-colors">
                Já tem conta? Entrar →
              </Link>
              <a href={WA_LINK} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-zinc-400 hover:text-green-400 transition-colors">
                <MessageCircle className="size-3.5" /> Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-24 bg-white border-t border-zinc-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-16 items-start">

          {/* Esquerda — título fixo */}
          <div className="lg:sticky lg:top-28">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4 block">Dúvidas</span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4 leading-tight">
              Perguntas<br />frequentes
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed mb-8">
              Não encontrou o que procurava? Fale com a gente diretamente.
            </p>
            <a href={WA_LINK} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-3 rounded-xl text-sm transition-all hover:scale-[1.02]">
              <MessageCircle className="size-4" /> Falar no WhatsApp
            </a>
          </div>

          {/* Direita — accordion */}
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-2xl ring-1 ring-zinc-200 overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-zinc-50 transition-colors">
                  <span className="font-semibold text-zinc-900 text-sm pr-4">{f.q}</span>
                  <ChevronDown className={`size-5 text-zinc-400 shrink-0 transition-transform duration-200 ${open === i ? "rotate-180 text-orange-500" : ""}`} />
                </button>
                {open === i && (
                  <div className="px-6 pb-6 text-sm text-zinc-500 leading-relaxed border-t border-zinc-100 pt-4">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Comparison ─── */
function Comparison() {
  return (
    <section className="py-24 bg-zinc-950 overflow-hidden">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3 block">Por que sair do marketplace</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            O marketplace cobra por cada pedido.<br />
            <span className="text-orange-400">Você não precisa aceitar isso.</span>
          </h2>
          <p className="text-zinc-400 max-w-[52ch] mx-auto text-sm leading-relaxed">
            Em 300 pedidos de R$60, o marketplace retém até{" "}
            <strong className="text-red-400">R$5.400 em comissões</strong>. Com o Delivery Hub, você paga{" "}
            <strong className="text-green-400">R$99 fixos</strong>.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
          <div className="grid grid-cols-3 bg-zinc-900 border-b border-white/10">
            <div className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Recurso</div>
            <div className="p-4 text-center">
              <span className="text-xs font-bold text-red-400 uppercase tracking-widest">iFood / Rappi</span>
            </div>
            <div className="p-4 text-center bg-orange-500/10 border-l border-orange-500/20">
              <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Delivery Hub</span>
            </div>
          </div>

          {comparisonRows.map((row, i) => (
            <div key={row.label} className={`grid grid-cols-3 border-b border-white/5 last:border-0 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}`}>
              <div className="p-4 text-sm text-zinc-300 font-medium flex items-center">{row.label}</div>
              <div className="p-4 flex items-center justify-center">
                <span className="text-xs text-red-400 text-center leading-relaxed">{row.them}</span>
              </div>
              <div className="p-4 flex items-center justify-center bg-orange-500/5 border-l border-orange-500/10">
                <span className="text-xs text-green-400 font-semibold text-center leading-relaxed">{row.us}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/auth"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-[1.02] shadow-xl shadow-orange-500/25">
            Criar minha loja sem comissão <ArrowRight className="size-5" />
          </Link>
          <p className="text-zinc-600 text-xs mt-3">7 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </div>
    </section>
  );
}


/* ─── WhatsApp Flutuante ─── */
function WhatsAppFlutuante() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-bold px-4 py-3.5 rounded-2xl shadow-2xl shadow-green-500/30 transition-all duration-300 hover:scale-[1.04] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <MessageCircle className="size-5 shrink-0" />
      <span className="text-sm hidden sm:block">Falar no WhatsApp</span>
    </a>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="py-12 bg-zinc-950 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <img src="/segments/logo1.png" alt="SOS Sistemas" className="h-14 w-auto object-contain brightness-0 invert" />
            <p className="text-xs text-zinc-400 mt-2 max-w-[30ch]">Plataforma de delivery próprio para restaurantes que não aceitam pagar comissão.</p>
            <div className="flex items-center gap-3 mt-4">
              <a href={WA_LINK} target="_blank" rel="noreferrer"
                className="size-8 rounded-lg bg-white/5 hover:bg-green-500/20 flex items-center justify-center text-zinc-400 hover:text-green-400 transition-colors">
                <MessageCircle className="size-4" />
              </a>
              <a href="mailto:contato@sossistemas.com.br"
                className="size-8 rounded-lg bg-white/5 hover:bg-blue-500/20 flex items-center justify-center text-zinc-400 hover:text-blue-400 transition-colors">
                <Mail className="size-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-12">
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">Produto</div>
              <div className="space-y-2 text-xs text-zinc-400">
                <a href="#como-funciona" className="block hover:text-white transition-colors">Como funciona</a>
                <a href="#recursos"      className="block hover:text-white transition-colors">Recursos</a>
                <a href="#planos"        className="block hover:text-white transition-colors">Planos e preços</a>
                <a href="#segmentos"     className="block hover:text-white transition-colors">Segmentos</a>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">Contato</div>
              <div className="space-y-2 text-xs text-zinc-400">
                <a href={WA_LINK} target="_blank" rel="noreferrer" className="block hover:text-white transition-colors">WhatsApp</a>
                <a href="mailto:contato@sossistemas.com.br" className="block hover:text-white transition-colors">contato@sossistemas.com.br</a>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">Legal</div>
              <div className="space-y-2 text-xs text-zinc-400">
                <Link to="/privacidade" className="block hover:text-white transition-colors">Privacidade</Link>
                <Link to="/termos" className="block hover:text-white transition-colors">Termos de uso</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-zinc-600">© 2026 Delivery Hub — SOS Sistemas. Todos os direitos reservados.</p>
          <p className="text-xs text-zinc-700">Feito com dedicação no Mato Grosso 🇧🇷</p>
        </div>
      </div>
    </footer>
  );
}
