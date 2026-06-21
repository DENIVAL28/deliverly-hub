import { Link } from "@tanstack/react-router";
import {
  ArrowRight, Store, Check, MessageCircle, Smartphone, Zap, BarChart3,
  Menu, X, ChevronDown, Mail, ClipboardList, Utensils, Bike,
  Trophy, Shield, Sparkles, Star, TrendingUp, Package, Users,
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,_rgba(249,115,22,0.30),_transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_90%,_rgba(249,115,22,0.10),_transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(9,9,11,0.96),_rgba(9,9,11,0.70)_48%,_rgba(249,115,22,0.08))]" />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-300 mb-8 shadow-[0_0_20px_rgba(249,115,22,0.12)]">
            <Sparkles className="size-3 text-orange-400" />
            Delivery direto, sem app e sem cadastro
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>

          <h1 className="text-4xl font-black leading-[1.04] text-white md:text-6xl tracking-tight">
            Peça comida direto dos restaurantes da sua cidade
          </h1>

          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-300 md:text-lg">
            Escolha a loja, monte seu pedido e envie direto para o estabelecimento. Mais rápido para você, melhor para o restaurante, sem intermediários.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/lojas"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-base font-black text-white shadow-2xl shadow-orange-500/30 transition-all duration-300 hover:scale-[1.03] hover:bg-orange-400 hover:shadow-orange-500/40">
              <Bike className="size-5" /> Ver restaurantes disponíveis <ArrowRight className="size-5" />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-sm text-zinc-400">
            {["Sem cadastro", "Sem aplicativo", "Pedido direto com a loja"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 backdrop-blur-sm text-xs font-medium">
                <Check className="size-3 text-orange-400" /> {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-10 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-orange-500/15 bg-zinc-950">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover block" style={{ maxHeight: 480 }}>
              <source src="/segments/Create_a_high_end_animated_vec.mp4" type="video/mp4" />
              <source src="/segments/Create_a_modern_D_vector_anim.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(to bottom, rgba(9,9,11,0.20) 0%, transparent 20%, transparent 80%, rgba(9,9,11,0.60) 100%)",
            }} />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
            {categorias.map((c) => (
              <span key={c} className="rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 hover:border-orange-500/30 transition-all cursor-default">
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
    <nav className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ${
      scrolled || open
        ? "bg-white/95 backdrop-blur-xl saturate-150 border-b border-zinc-100/80 shadow-[0_1px_0_rgba(0,0,0,0.06)]"
        : "bg-transparent border-b border-transparent"
    }`}>
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center shrink-0">
            <img
              src="/segments/logo1.png"
              alt="SOS Sistemas"
              className={`h-12 w-auto max-w-[160px] object-contain transition-all duration-500 ${dark ? "brightness-0 invert" : ""}`}
            />
          </Link>
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            {[["#como-funciona","Como funciona"],["#recursos","Recursos"],["#planos","Planos"]].map(([href,label]) => (
              <a key={href} href={href}
                className={`px-3 py-2 rounded-lg transition-all duration-200 ${dark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}>
                {label}
              </a>
            ))}
            <Link to="/entregadores"
              className={`px-3 py-2 rounded-lg transition-all duration-200 ${dark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}>
              🛵 Entregadores
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/lojas"
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all duration-200 whitespace-nowrap">
            🛵 Pedir delivery
          </Link>
          <Link to="/auth"
            className={`hidden sm:block text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 ${
              dark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            }`}>
            Entrar
          </Link>
          <Link to="/auth"
            className="hidden sm:flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02]">
            Testar grátis <ArrowRight className="size-4" />
          </Link>
          <button onClick={() => setOpen((v) => !v)}
            className={`md:hidden p-2 rounded-lg transition-colors ${dark ? "text-white hover:bg-white/10" : "text-zinc-500 hover:bg-zinc-100"}`}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white/98 backdrop-blur-xl border-t border-zinc-100 px-6 py-4 space-y-2 shadow-xl">
          {[["#como-funciona","Como funciona"],["#recursos","Recursos"],["#planos","Planos"]].map(([href,label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block text-sm font-medium text-zinc-600 hover:text-orange-500 py-2 px-3 rounded-xl hover:bg-orange-50 transition-colors">{label}</a>
          ))}
          <Link to="/entregadores" onClick={() => setOpen(false)}
            className="block text-sm font-medium text-zinc-600 hover:text-orange-500 py-2 px-3 rounded-xl hover:bg-orange-50 transition-colors">
            🛵 Entregadores
          </Link>
          <div className="pt-2 border-t border-zinc-100">
            <Link to="/lojas" onClick={() => setOpen(false)}
              className="block text-center bg-orange-500 text-white text-sm font-bold px-4 py-3 rounded-2xl mb-2 shadow-lg shadow-orange-500/20">
              🛵 Pedir delivery
            </Link>
            <div className="flex gap-2">
              <Link to="/auth" className="flex-1 text-center text-sm font-medium px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-600 hover:border-zinc-300 transition-colors">Entrar</Link>
              <Link to="/auth" onClick={() => setOpen(false)}
                className="flex-1 text-center bg-orange-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/20">Testar grátis</Link>
            </div>
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
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none"
        src="/segments/Ultra_realistic_cinematic_food.mp4"
      />
      <div className="absolute inset-0 bg-zinc-950/55" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,_rgba(249,115,22,0.28),_transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_80%,_rgba(249,115,22,0.14),_transparent)]" />
      {/* Grid pattern sutil */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }} />

      <div className="relative mx-auto max-w-7xl px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          <div>
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.10)]">
              <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" />
              Cardápio + PDV + Entregadores — tudo por R$99/mês
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.06] text-white mb-6 tracking-tight">
              Pare de perder<br />
              margem com <span className="relative inline-block">
                <span className="relative z-10 text-orange-400">marketplace.</span>
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-500 to-orange-400/0 rounded-full" />
              </span><br />
              Venda pelo seu canal.
            </h1>

            <p className="text-zinc-300 text-lg leading-relaxed mb-8 max-w-[46ch]">
              Cardápio digital + caixa PDV + gestão de entregadores em um sistema só —{" "}
              <strong className="text-white">sem comissão por pedido, sem contrato.</strong>
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
              <Link to="/auth"
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-7 py-4 rounded-2xl text-base transition-all duration-300 hover:scale-[1.03] shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 w-full sm:w-auto">
                Testar grátis por 7 dias <ArrowRight className="size-5" />
              </Link>
              <a href={WA_LINK} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors group">
                <MessageCircle className="size-3.5 group-hover:text-green-400 transition-colors" /> Dúvidas? Fala no WhatsApp
              </a>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-zinc-300">
              {["7 dias grátis", "Sem taxas por pedido", "Caixa PDV incluso", "Cancele quando quiser"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                  <Check className="size-3 text-orange-400 shrink-0" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative">
              <div className="absolute -inset-10 bg-orange-500/15 blur-3xl rounded-full" />
              <div className="absolute -inset-4 bg-orange-500/8 blur-xl rounded-[3rem]" />

              {/* Frame */}
              <div className="relative w-72 bg-zinc-900 rounded-[2.75rem] ring-2 ring-white/15 shadow-[0_40px_80px_rgba(0,0,0,0.6)] overflow-hidden" style={{ height: 580 }}>
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-950 rounded-b-2xl z-10 flex items-center justify-center gap-1">
                  <div className="size-1.5 rounded-full bg-zinc-700" />
                  <div className="w-8 h-1.5 rounded-full bg-zinc-700" />
                </div>

                <div className="absolute inset-0 bg-zinc-100 overflow-hidden">
                  <div className="bg-gradient-to-b from-zinc-700 to-zinc-800 h-24 relative">
                    <div className="absolute inset-0 opacity-60" style={{
                      backgroundImage: "url('/segments/banner_placeholder.jpg')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }} />
                  </div>
                  <div className="bg-white px-4 pb-3 shadow-sm">
                    <div className="flex items-end gap-3 -mt-8 mb-3">
                      <div className="size-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 ring-4 ring-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                        <Store className="size-7 text-white" />
                      </div>
                      <div className="pb-1">
                        <div className="h-3 bg-zinc-800 rounded-full w-28 mb-1.5" />
                        <div className="flex gap-1.5 items-center">
                          <div className="h-2 bg-green-400 rounded-full w-12" />
                          <div className="h-2 bg-zinc-200 rounded-full w-16" />
                        </div>
                      </div>
                    </div>
                    <div className="h-8 bg-zinc-100 rounded-xl flex items-center px-3 gap-2">
                      <div className="size-3 rounded-full bg-zinc-300" />
                      <div className="h-1.5 bg-zinc-200 rounded-full w-20" />
                    </div>
                  </div>

                  <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 mt-1">
                    {["Pizzas","Bebidas","Bordas"].map((c, i) => (
                      <div key={c} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${i === 0 ? "bg-orange-500 text-white shadow-md shadow-orange-500/30" : "bg-zinc-100 text-zinc-400"}`}>{c}</div>
                    ))}
                  </div>

                  <div className="px-3 pt-3 space-y-2">
                    {[
                      { name: "Mussarela", price: "R$ 45,90", w: "w-20", emoji: "🍕" },
                      { name: "Calabresa",  price: "R$ 47,90", w: "w-24", emoji: "🍕" },
                      { name: "Frango",     price: "R$ 49,90", w: "w-16", emoji: "🍗" },
                    ].map((p) => (
                      <div key={p.name} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm ring-1 ring-zinc-100">
                        <div className="flex-1">
                          <div className={`h-2.5 bg-zinc-800 rounded-full ${p.w} mb-1.5`} />
                          <div className="h-2 bg-zinc-200 rounded-full w-28 mb-2" />
                          <div className="h-3 bg-orange-500 rounded-full w-16" />
                        </div>
                        <div className="size-14 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 ml-3 flex items-center justify-center text-2xl shrink-0">
                          {p.emoji}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-6 left-3 right-3">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl h-12 flex items-center justify-between px-4 shadow-xl shadow-orange-500/40">
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-lg">2×</span>
                    <span className="text-white text-xs font-bold">Ver carrinho</span>
                    <span className="text-white text-xs font-bold">R$ 93,80</span>
                  </div>
                </div>
              </div>

              {/* Floating card — novo pedido */}
              <div className="absolute -left-16 top-16 bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 ring-1 ring-zinc-100"
                style={{ animation: "float 3s ease-in-out infinite" }}>
                <div className="size-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-lg">🛒</div>
                <div>
                  <div className="text-xs font-bold text-zinc-900">Novo pedido!</div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                    Agora mesmo
                  </div>
                </div>
              </div>

              {/* Floating card — faturamento */}
              <div className="absolute -right-14 bottom-24 bg-white rounded-2xl shadow-2xl px-4 py-3 ring-1 ring-zinc-100 border-l-2 border-orange-500">
                <div className="text-[10px] text-zinc-400 mb-0.5 font-medium">Faturamento hoje</div>
                <div className="text-sm font-black text-zinc-900">R$ 1.247
                  <span className="text-green-500 text-xs font-bold ml-1.5 bg-green-50 px-1.5 py-0.5 rounded-full">▲ 18%</span>
                </div>
              </div>

              {/* Floating card — top */}
              <div className="absolute -right-10 top-10 bg-zinc-900 rounded-xl shadow-xl px-3 py-2 ring-1 ring-white/10">
                <div className="text-[10px] text-zinc-400 mb-1">Pedidos hoje</div>
                <div className="flex items-center gap-1">
                  {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                    <div key={i} className="w-1.5 bg-orange-500 rounded-full opacity-80" style={{ height: `${h * 0.28}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-marquee { animation: marquee 24s linear infinite; }
      `}</style>
    </section>
  );
}

/* ─── Social Proof ─── */
function SocialProof() {
  const items = [
    "✅ Cardápio digital incluso",
    "✅ Caixa PDV incluso",
    "✅ Gestão de entregadores inclusa",
    "✅ 0% de comissão por pedido",
    "✅ PIX QR Code automático",
    "✅ Suporte incluso",
    "✅ 7 dias grátis",
  ];
  return (
    <section className="bg-gradient-to-r from-orange-500 via-orange-500 to-orange-600 py-3.5 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-white text-sm font-semibold mx-8 shrink-0">
            {item}
            <span className="text-orange-300/60 mx-2">·</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── Stats ─── */
function Stats() {
  const items = [
    { icon: TrendingUp, value: "R$ 99",  label: "por mês, tudo incluso",        color: "text-orange-400" },
    { icon: Star,       value: "0%",     label: "de comissão por pedido",        color: "text-green-400" },
    { icon: Zap,        value: "< 24h",  label: "para o cardápio no ar",         color: "text-blue-400" },
    { icon: Package,    value: "3 em 1", label: "Cardápio + PDV + Entregadores", color: "text-purple-400" },
  ];
  return (
    <section className="py-14 bg-zinc-950 border-b border-white/5">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-white/8">
          {items.map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="flex flex-col items-center text-center px-6 py-4 group">
              <div className={`size-10 rounded-2xl bg-white/5 flex items-center justify-center mb-3 group-hover:bg-white/10 transition-colors`}>
                <Icon className={`size-5 ${color}`} />
              </div>
              <div className={`text-3xl md:text-4xl font-black mb-1.5 ${color}`}>{value}</div>
              <div className="text-xs text-zinc-500 leading-relaxed max-w-[16ch] mx-auto">{label}</div>
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
    <section id="como-funciona" className="py-28 bg-white border-y border-zinc-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Como funciona</span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3 tracking-tight">
            Do zero ao primeiro pedido em menos de 24h
          </h2>
          <p className="text-zinc-500 max-w-[48ch] mx-auto text-sm leading-relaxed">
            Sem técnico, sem contrato, sem complicação. Você configura tudo sozinho ou com nossa ajuda gratuita.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Linha conectora */}
          <div className="hidden md:block absolute top-[2.75rem] left-[calc(16.67%+3rem)] right-[calc(16.67%+3rem)] h-px bg-gradient-to-r from-orange-200 via-orange-300 to-orange-200 z-0" />

          {steps.map(({ num, icon: Icon, title, desc }) => (
            <div key={num} className="relative z-10 group">
              <div className="bg-white rounded-3xl p-8 ring-1 ring-zinc-200 hover:ring-orange-300 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-center">
                <div className="relative inline-flex mb-6">
                  <div className="size-20 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30 group-hover:shadow-orange-500/50 group-hover:scale-[1.05] transition-all duration-300">
                    <Icon className="size-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 size-6 rounded-full bg-white border-2 border-orange-500 flex items-center justify-center text-[10px] font-black text-orange-500 shadow-md">
                    {num}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-xs text-zinc-400 inline-flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-full">
            <Shield className="size-3.5 text-orange-400" />
            Sem técnico, sem contrato — você configura tudo ou pedimos ajuda gratuita.
          </p>
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
    <div className="bg-white rounded-3xl ring-1 ring-zinc-200 hover:ring-orange-300 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group cursor-default overflow-hidden">
      <div className={`relative w-full bg-gradient-to-br ${bg} flex items-center justify-center overflow-hidden`} style={{ height: "160px" }}>
        {imgOk ? (
          <img src={img} alt={label} onError={() => setImgOk(false)}
            className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-110 drop-shadow-lg" />
        ) : (
          <span className="transition-transform duration-500 group-hover:scale-110 select-none"
            style={{ fontSize: "72px", lineHeight: 1, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.10))" }}
            role="img" aria-label={label}>{emoji}</span>
        )}
        <span className={`absolute top-3 right-3 size-2 rounded-full ${dot} opacity-70 shadow-sm`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="p-5">
        <h3 className="font-bold text-zinc-900 mb-1.5 group-hover:text-orange-500 transition-colors duration-200">{label}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Segments ─── */
function Segments() {
  return (
    <section id="segmentos" className="py-28 bg-zinc-50 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Segmentos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3 tracking-tight">Para cada cozinha, o cardápio certo.</h2>
          <p className="text-zinc-500 max-w-[52ch] mx-auto text-sm leading-relaxed">Do espetinho ao restaurante — o sistema se adapta ao ritmo da sua operação.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-5">
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
    <section id="recursos" className="py-28 bg-white border-y border-zinc-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Recursos</span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 text-balance leading-tight tracking-tight">
              Cada recurso pensado para o dia a dia do seu delivery
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed mt-4 max-w-[44ch]">
              Um sistema completo que começa com o cardápio e vai até o entregador — tudo em um lugar só.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-zinc-200 shadow-2xl bg-zinc-950 aspect-video">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-90">
              <source src="/segments/Create_a_modern_D_vector_anim.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, body, badge }) => (
            <div key={title} className="bg-white hover:bg-gradient-to-br hover:from-orange-50 hover:to-white rounded-3xl p-7 ring-1 ring-zinc-200 hover:ring-orange-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-5">
                <div className="size-12 rounded-2xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center text-orange-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-[1.08]">
                  <Icon className="size-5" />
                </div>
                {badge && (
                  <span className="text-[10px] font-bold bg-orange-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md shadow-orange-500/20">
                    {badge}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2 group-hover:text-orange-600 transition-colors duration-200">{title}</h3>
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
    { num: "1", emoji: "📲", title: "Receba o link de convite", desc: "O restaurante parceiro envia um link exclusivo para você. Abra no celular — sem precisar baixar nenhum aplicativo." },
    { num: "2", emoji: "📝", title: "Faça o cadastro em 1 minuto", desc: "Preencha nome, WhatsApp e tipo de veículo. O estabelecimento analisa e aprova seu cadastro rapidamente." },
    { num: "3", emoji: "🛵", title: "Escolha as entregas que quiser", desc: "Após aprovado, você recebe um link pessoal. Abra quando quiser, veja os pedidos disponíveis e aceite os que preferir." },
    { num: "4", emoji: "💰", title: "Receba sua taxa por corrida", desc: "Cada entrega aceita tem a taxa exibida antes de você confirmar. O repasse é combinado diretamente com o estabelecimento." },
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
    <section id="seja-entregador" className="relative py-28 bg-zinc-950 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_50%,_rgba(249,115,22,0.08),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_80%,_rgba(249,115,22,0.05),_transparent)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <Bike className="size-3.5" /> Para entregadores
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight tracking-tight">
            Faça entregas no<br />
            <span className="text-orange-400">seu próprio ritmo</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-[52ch] mx-auto leading-relaxed">
            Restaurantes que usam o Delivery Hub podem convidar motoboys freelancers para entregar seus pedidos — sem vínculo fixo, sem horário obrigatório.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Timeline */}
          <div>
            <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-orange-400 inline-block animate-pulse" />
              Como funciona
            </h3>
            <div className="relative space-y-0">
              {steps.map((s, i) => (
                <div key={s.num} className="flex items-start gap-5 relative">
                  {/* Timeline line */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-6 top-14 bottom-0 w-px bg-gradient-to-b from-orange-500/40 to-transparent" style={{ height: "calc(100% - 3rem)" }} />
                  )}
                  <div className="relative shrink-0">
                    <div className="size-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl z-10 relative shadow-lg group-hover:bg-orange-500/20 transition-colors">
                      {s.emoji}
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center shadow-md shadow-orange-500/30 z-20">
                      {s.num}
                    </span>
                  </div>
                  <div className="pb-8">
                    <p className="text-sm font-bold text-white mb-1">{s.title}</p>
                    <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/7 transition-colors">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-green-400 inline-block" />
                Vantagens para o entregador
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {beneficios.map((b) => (
                  <div key={b.texto} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-xl shrink-0 w-8 text-center">{b.icon}</span>
                    <span className="text-sm text-zinc-300">{b.texto}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/12 to-orange-600/6 border border-orange-500/20 rounded-3xl p-8">
              <p className="text-sm font-bold text-orange-300 mb-2">Como começar?</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">
                Crie seu cadastro diretamente na plataforma em menos de 5 minutos. Após aprovação, você começa a receber pedidos dos restaurantes parceiros.
              </p>
              <Link to="/entregadores/cadastro"
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-4 rounded-2xl text-sm transition-all duration-300 hover:scale-[1.02] shadow-2xl shadow-orange-500/30 w-full">
                Quero ser entregador — Criar cadastro
              </Link>
              <p className="text-xs text-zinc-600 text-center mt-3">Gratuito · Sem contrato · Trabalhe quando quiser</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-0">
              {[
                { p: "Preciso ter CNH?", r: "Depende do veículo — para moto e carro sim. Para bicicleta e a pé, não." },
                { p: "Preciso pagar para se cadastrar?", r: "Não. O cadastro é 100% gratuito." },
                { p: "Posso trabalhar para vários restaurantes?", r: "Sim! Cada restaurante tem seu próprio link — você pode se cadastrar em quantos quiser." },
              ].map((f, i) => (
                <div key={i} className={`py-4 ${i > 0 ? "border-t border-white/6" : ""}`}>
                  <p className="text-xs font-bold text-zinc-300 mb-1">❓ {f.p}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.r}</p>
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
    <section id="planos" className="py-28 bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3 block">Planos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">Planos simples, sem letra miúda.</h2>
          <p className="text-zinc-400 text-sm max-w-[56ch] mx-auto leading-relaxed">
            Outros sistemas cobram separado por cada módulo. Aqui,{" "}
            <strong className="text-orange-400">tudo já está incluso no mesmo plano</strong> — sem surpresas na fatura.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-3xl p-8 flex flex-col relative transition-all duration-300 ${
              p.highlight
                ? "bg-gradient-to-b from-orange-500 to-orange-600 ring-2 ring-orange-400 scale-[1.03] shadow-[0_0_80px_rgba(249,115,22,0.30)] hover:shadow-[0_0_100px_rgba(249,115,22,0.40)]"
                : "bg-zinc-900/70 ring-1 ring-white/10 hover:ring-white/20 hover:bg-zinc-900 hover:shadow-xl hover:shadow-black/30"
            }`}>
              {p.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-orange-500 text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                  ⭐ Mais popular
                </div>
              )}
              <div className={`text-xs font-bold uppercase tracking-widest mb-4 ${p.highlight ? "text-white/80" : "text-zinc-400"}`}>{p.name}</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-sm font-medium ${p.highlight ? "text-white/70" : "text-zinc-500"}`}>R$</span>
                <span className="text-5xl font-black text-white tracking-tight">{p.price}</span>
                <span className={`text-sm font-medium ${p.highlight ? "text-white/70" : "text-zinc-500"}`}>/mês</span>
              </div>
              <p className={`text-sm font-semibold mb-2 ${p.highlight ? "text-white" : "text-orange-400"}`}>{p.tagline}</p>
              <p className={`text-sm mb-6 leading-relaxed ${p.highlight ? "text-white/90" : "text-zinc-400"}`}>{p.description}</p>
              <ul className="space-y-2.5 mb-8 flex-grow">
                {p.features.map((f) => (
                  <li key={f} className={`text-sm flex items-start gap-2.5 ${p.highlight ? "text-white" : "text-zinc-300"}`}>
                    <span className={`size-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${p.highlight ? "bg-white/25" : "bg-green-500/15"}`}>
                      <Check className={`size-2.5 ${p.highlight ? "text-white" : "text-green-400"}`} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              {p.name === "Premium" ? (
                <a href={WA_LINK} target="_blank" rel="noreferrer"
                  className={`w-full text-center font-bold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] ${
                    p.highlight ? "bg-white text-orange-500 hover:bg-orange-50 shadow-lg" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                  }`}>
                  <MessageCircle className="size-4" /> {p.cta}
                </a>
              ) : (
                <Link to="/auth"
                  className={`w-full text-center font-bold py-4 rounded-2xl transition-all duration-300 block hover:scale-[1.02] ${
                    p.highlight ? "bg-white text-orange-500 hover:bg-orange-50 shadow-lg" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                  }`}>
                  {p.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <p className="text-zinc-600 text-xs inline-flex items-center gap-2">
            <Shield className="size-3.5 text-zinc-500" />
            Todos os planos incluem 7 dias grátis. Sem cartão de crédito.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-28 bg-white border-t border-zinc-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-16 items-start">

          <div className="lg:sticky lg:top-28">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4 block">Dúvidas</span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4 leading-tight tracking-tight">
              Perguntas<br />frequentes
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed mb-8">
              Não encontrou o que procurava? Fale com a gente diretamente.
            </p>
            <a href={WA_LINK} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3.5 rounded-2xl text-sm transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-orange-500/25">
              <MessageCircle className="size-4" /> Falar no WhatsApp
            </a>
          </div>

          <div className="space-y-2.5">
            {faqs.map((f, i) => (
              <div key={i} className={`rounded-2xl ring-1 overflow-hidden transition-all duration-200 ${
                open === i ? "ring-orange-200 shadow-md shadow-orange-500/5" : "ring-zinc-200 hover:ring-zinc-300"
              }`}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className={`w-full flex items-center justify-between px-6 py-5 text-left transition-colors ${
                    open === i ? "bg-orange-50/50" : "hover:bg-zinc-50"
                  }`}>
                  <span className="font-semibold text-zinc-900 text-sm pr-4">{f.q}</span>
                  <span className={`size-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    open === i ? "bg-orange-500 rotate-180" : "bg-zinc-100"
                  }`}>
                    <ChevronDown className={`size-4 transition-colors ${open === i ? "text-white" : "text-zinc-400"}`} />
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-48" : "max-h-0"}`}>
                  <div className="px-6 pb-6 text-sm text-zinc-500 leading-relaxed border-t border-zinc-100/80 pt-4">
                    {f.a}
                  </div>
                </div>
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
    <section className="py-28 bg-zinc-950 overflow-hidden">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3 block">Por que sair do marketplace</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
            O marketplace cobra por cada pedido.<br />
            <span className="text-orange-400">Você não precisa aceitar isso.</span>
          </h2>
          <p className="text-zinc-400 max-w-[52ch] mx-auto text-sm leading-relaxed">
            Em 300 pedidos de R$60, o marketplace retém até{" "}
            <strong className="text-red-400">R$5.400 em comissões</strong>. Com o Delivery Hub, você paga{" "}
            <strong className="text-green-400">R$99 fixos</strong>.
          </p>
        </div>

        <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-[0_0_60px_rgba(249,115,22,0.07)]">
          {/* Header */}
          <div className="grid grid-cols-3 bg-zinc-900 border-b border-white/10">
            <div className="p-5 text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center">Recurso</div>
            <div className="p-5 flex flex-col items-center justify-center gap-1 border-l border-white/5">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">iFood / Rappi</span>
              <span className="text-lg">😬</span>
            </div>
            <div className="p-5 flex flex-col items-center justify-center gap-1 bg-orange-500/10 border-l border-orange-500/25">
              <Trophy className="size-4 text-orange-400 mb-0.5" />
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Delivery Hub</span>
            </div>
          </div>

          {comparisonRows.map((row, i) => (
            <div key={row.label} className={`grid grid-cols-3 border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}`}>
              <div className="p-4 text-sm text-zinc-300 font-medium flex items-center">{row.label}</div>
              <div className="p-4 flex items-center justify-center border-l border-white/5">
                <span className="inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-full px-2.5 py-1 text-center leading-relaxed font-medium">
                  <X className="size-3 shrink-0" /> {row.them}
                </span>
              </div>
              <div className="p-4 flex items-center justify-center bg-orange-500/5 border-l border-orange-500/15">
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/15 rounded-full px-2.5 py-1 text-center leading-relaxed font-semibold">
                  <Check className="size-3 shrink-0" /> {row.us}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Callout savings */}
        <div className="mt-6 bg-gradient-to-r from-green-500/10 to-green-600/5 border border-green-500/20 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-green-500/15 flex items-center justify-center">
              <TrendingUp className="size-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Economia real por mês</p>
              <p className="text-xs text-zinc-400">Comparado com 30% de comissão em 300 pedidos de R$60</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-green-400">R$5.301</p>
            <p className="text-xs text-zinc-500">economizados por mês</p>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link to="/auth"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-300 hover:scale-[1.02] shadow-2xl shadow-orange-500/30">
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
      className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-bold px-4 py-3.5 rounded-2xl shadow-2xl shadow-green-500/30 transition-all duration-300 hover:scale-[1.05] hover:shadow-green-500/50 ${
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
    <footer className="py-14 bg-zinc-950 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
          <div className="max-w-[22rem]">
            <img src="/segments/logo1.png" alt="SOS Sistemas" className="h-12 w-auto object-contain brightness-0 invert mb-3" />
            <p className="text-xs text-zinc-500 leading-relaxed">Plataforma de delivery próprio para restaurantes que não aceitam pagar comissão.</p>
            <div className="flex items-center gap-2 mt-5">
              <a href={WA_LINK} target="_blank" rel="noreferrer"
                className="size-9 rounded-xl bg-white/5 hover:bg-green-500/20 border border-white/8 hover:border-green-500/30 flex items-center justify-center text-zinc-400 hover:text-green-400 transition-all duration-200 hover:scale-110">
                <MessageCircle className="size-4" />
              </a>
              <a href="mailto:contato@sossistemas.com.br"
                className="size-9 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/8 hover:border-blue-500/30 flex items-center justify-center text-zinc-400 hover:text-blue-400 transition-all duration-200 hover:scale-110">
                <Mail className="size-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-12">
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Produto</div>
              <div className="space-y-2.5 text-xs text-zinc-500">
                {[["#como-funciona","Como funciona"],["#recursos","Recursos"],["#planos","Planos e preços"],["#segmentos","Segmentos"]].map(([href, label]) => (
                  <a key={href} href={href} className="block hover:text-white transition-colors duration-150 hover:translate-x-0.5 transform">{label}</a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Contato</div>
              <div className="space-y-2.5 text-xs text-zinc-500">
                <a href={WA_LINK} target="_blank" rel="noreferrer" className="block hover:text-white transition-colors duration-150">WhatsApp</a>
                <a href="mailto:contato@sossistemas.com.br" className="block hover:text-white transition-colors duration-150">contato@sossistemas.com.br</a>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Legal</div>
              <div className="space-y-2.5 text-xs text-zinc-500">
                <Link to="/privacidade" className="block hover:text-white transition-colors duration-150">Privacidade</Link>
                <Link to="/termos" className="block hover:text-white transition-colors duration-150">Termos de uso</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-zinc-700">© 2026 Delivery Hub — SOS Sistemas. Todos os direitos reservados.</p>
          <p className="text-xs text-zinc-700">Feito com dedicação no Mato Grosso 🇧🇷</p>
        </div>
      </div>
    </footer>
  );
}
