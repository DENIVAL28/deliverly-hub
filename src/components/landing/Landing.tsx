import { Link } from "@tanstack/react-router";
import {
  ArrowRight, Store, Check, MessageCircle, Smartphone, Zap, BarChart3,
  Menu, X, ChevronDown, Mail, ClipboardList, Utensils, Bike,
  Shield, Star, TrendingUp, Package, ChevronRight, MapPin,
} from "lucide-react";
import { useState, useEffect } from "react";

const WHATSAPP = "5566981289787";
const WA_LINK = `https://wa.me/${WHATSAPP}`;

const segments = [
  { img: "/segments/pizza.png",        emoji: "🍕", label: "Pizzas" },
  { img: "/segments/burger.png",       emoji: "🍔", label: "Hambúrgueres" },
  { img: "/segments/marmita.png",      emoji: "🍱", label: "Marmitas" },
  { img: "/segments/acai.png",         emoji: "🍇", label: "Açaí" },
  { img: "/segments/conveniencia.png", emoji: "🛒", label: "Conveniências" },
  { img: "/segments/padaria.png",      emoji: "🥐", label: "Padarias" },
  { img: "/segments/restaurante.png",  emoji: "🍝", label: "Restaurantes" },
  { img: "/segments/espetinho.png",    emoji: "🍢", label: "Espetinhos" },
  { img: "/segments/cafe.png",         emoji: "☕", label: "Cafeterias" },
];

const features = [
  { icon: Smartphone,    title: "Cardápio Digital sem App",        body: "Seu cliente acessa pelo celular, sem baixar nada. Cardápio rápido com fotos, categorias e checkout em segundos.", badge: "Mais acessado" },
  { icon: ClipboardList, title: "Caixa PDV para Vendas no Balcão", body: "Venda no balcão com o mesmo sistema. Selecione produtos, aplique desconto, calcule troco e registre — tudo em um clique.", badge: "Exclusivo" },
  { icon: Zap,           title: "Pedidos em Tempo Real com Som",   body: "Chegou pedido? O sistema toca um alerta sonoro e exibe na tela. Avance o status com um clique e notifique o cliente pelo WhatsApp.", badge: null },
  { icon: MessageCircle, title: "Checkout Direto no WhatsApp",     body: "O pedido chega formatado e pronto para a cozinha. Menos erros, mais agilidade — sem digitar nada manualmente.", badge: null },
  { icon: Bike,          title: "Gestão de Entregadores",          body: "Cadastre entregadores e atribua pedidos na hora. Controle quem está em rota sem precisar de planilha ou grupo de zap.", badge: null },
  { icon: BarChart3,     title: "Relatórios e Cupons de Desconto", body: "Veja faturamento, ticket médio e produtos mais vendidos. Crie cupons de desconto para fidelizar e atrair clientes novos.", badge: null },
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
  { q: "Meu cliente precisa baixar algum app?",        a: "Não. O cardápio é acessado direto pelo celular, no navegador, sem precisar instalar nada. Funciona em qualquer smartphone com internet." },
  { q: "O que é o Caixa PDV e para que serve?",       a: "É um sistema de caixa para vendas presenciais no balcão. Você seleciona os produtos, aplica desconto, escolhe a forma de pagamento e registra a venda — tudo dentro do mesmo painel, sem precisar de outro sistema." },
  { q: "Como funciona o recebimento dos pagamentos?",  a: "Os clientes podem pagar na entrega (dinheiro, cartão ou PIX). Se escolherem PIX, o sistema gera o QR code automaticamente na hora do pedido. Não cobramos comissão sobre nenhuma venda." },
  { q: "Como cadastro meu cardápio?",                  a: "Diretamente pelo painel, em poucos cliques. Você adiciona nome, foto, preço e categoria de cada produto. Se precisar de ajuda para montar, nossa equipe te orienta sem custo adicional." },
  { q: "O que acontece depois dos 7 dias grátis?",     a: "Você escolhe o plano e continua. Se não quiser continuar, só não assina — sem cobrança automática e sem surpresa." },
  { q: "Posso cancelar a qualquer momento?",           a: "Sim, sem multa e sem contrato. Ao cancelar, seu acesso continua até o fim do período já pago. Depois disso, a loja é desativada — e você pode reativar quando quiser." },
];

/* ─── Logo ─── */
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo-delivery-hub.png" alt="Delivery Hub" className="h-12 w-auto object-contain shrink-0" />
      <span className="text-xl font-black tracking-tight leading-none text-zinc-900">
        Delivery<span className="text-orange-500">Hub</span>
      </span>
    </div>
  );
}

/* ─── Nav ─── */
function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-zinc-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center shrink-0">
            <Logo />
          </Link>
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link to="/lojas"
              className="px-3 py-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200">
              Ver restaurantes
            </Link>
            <a href="#lojistas"
              className="px-3 py-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200">
              Para lojistas
            </a>
            <Link to="/entregadores"
              className="px-3 py-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200">
              Entregadores
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/auth"
            className="hidden md:inline-flex items-center text-sm font-semibold text-zinc-700 hover:text-zinc-900 px-4 py-2 rounded-xl hover:bg-zinc-50 transition-all duration-200">
            Área do lojista
          </Link>
          <Link to="/auth"
            className="hidden md:inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-orange-500/25">
            Testar grátis <ArrowRight className="size-4" />
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-xl hover:bg-zinc-100 transition-colors"
            aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-zinc-100 px-6 py-4 space-y-1">
          <Link to="/lojas" onClick={() => setOpen(false)}
            className="block px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-50 font-medium text-sm">
            Ver restaurantes
          </Link>
          <a href="#lojistas" onClick={() => setOpen(false)}
            className="block px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-50 font-medium text-sm">
            Para lojistas
          </a>
          <Link to="/entregadores" onClick={() => setOpen(false)}
            className="block px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-50 font-medium text-sm">
            Entregadores
          </Link>
          <div className="pt-3 border-t border-zinc-100 space-y-2">
            <Link to="/auth" onClick={() => setOpen(false)}
              className="block px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-50 font-medium text-sm">
              Área do lojista
            </Link>
            <Link to="/auth" onClick={() => setOpen(false)}
              className="block w-full text-center bg-orange-500 text-white font-bold px-4 py-3 rounded-xl text-sm">
              Testar grátis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero cliente final ─── */
function ClienteHero() {
  return (
    <section className="relative bg-zinc-950 overflow-hidden min-h-screen flex items-end pb-0 pt-20">
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-45 pointer-events-none"
        src="/segments/Ultra_realistic_cinematic_food.mp4"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/50 to-zinc-950/95" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,_rgba(249,115,22,0.15),_transparent)]" />

      <div className="relative w-full">
        {/* Main content */}
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm uppercase tracking-widest">
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
            Sem baixar aplicativo · Sem cadastro obrigatório
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-[1.05] text-white mb-6 tracking-tight">
            Peça comida direto dos<br />
            <span className="text-orange-400">restaurantes da sua cidade</span>
          </h1>

          <p className="text-zinc-300 text-lg md:text-xl leading-relaxed mb-10 max-w-[50ch] mx-auto">
            Escolha a loja, monte seu pedido e envie direto para o estabelecimento.{" "}
            <span className="text-white font-medium">Sem app, sem cadastro.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/lojas"
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-300 hover:scale-[1.03] shadow-2xl shadow-orange-500/35 w-full sm:w-auto">
              <MapPin className="size-5" /> Ver restaurantes disponíveis
            </Link>
            <a href="#lojistas"
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
              Sou lojista <ChevronRight className="size-4" />
            </a>
          </div>
        </div>

        {/* Category bar — pinned at bottom of hero */}
        <div className="bg-zinc-950/80 backdrop-blur-md border-t border-white/8">
          <div className="mx-auto max-w-5xl px-6 py-5">
            <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide justify-center flex-wrap md:flex-nowrap">
              {segments.map(({ img, emoji, label }) => (
                <Link key={label} to="/lojas"
                  className="flex flex-col items-center gap-1.5 group shrink-0">
                  <div className="size-14 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center overflow-hidden group-hover:bg-white/18 group-hover:border-orange-500/50 group-hover:scale-110 transition-all duration-200 p-2">
                    <img src={img} alt={label} className="w-full h-full object-contain drop-shadow"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const span = document.createElement("span");
                        span.style.fontSize = "1.5rem";
                        span.textContent = emoji;
                        e.currentTarget.parentElement?.appendChild(span);
                      }} />
                  </div>
                  <span className="text-[10px] text-zinc-400 group-hover:text-white transition-colors font-medium whitespace-nowrap">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Como pedir (cliente final) ─── */
function ComoPedir() {
  const steps = [
    { n: "1", emoji: "🏪", title: "Escolha uma loja", desc: "Veja os restaurantes e comércios disponíveis e abra o cardápio." },
    { n: "2", emoji: "🛒", title: "Monte seu pedido", desc: "Escolha os produtos, personalize e adicione ao carrinho." },
    { n: "3", emoji: "📲", title: "Envie pelo WhatsApp", desc: "Seu pedido vai direto para o estabelecimento, formatado e pronto." },
    { n: "4", emoji: "🤝", title: "Combine o pagamento", desc: "Acerte com a loja a forma de pagamento e se haverá entrega." },
  ];
  return (
    <section className="py-20 bg-white border-b border-zinc-100">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-zinc-900 mb-3">Como fazer seu pedido</h2>
          <p className="text-zinc-500 text-sm">Simples, rápido e sem precisar criar conta.</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 relative">
          <div className="hidden md:block absolute top-9 left-[13%] right-[13%] h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />
          {steps.map((s) => (
            <div key={s.n} className="relative text-center z-10">
              <div className="relative inline-flex mb-4">
                <div className="size-[72px] rounded-3xl bg-orange-50 border-2 border-orange-100 flex items-center justify-center text-3xl">
                  {s.emoji}
                </div>
                <span className="absolute -top-2 -right-2 size-6 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center shadow-md shadow-orange-500/30">
                  {s.n}
                </span>
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1.5">{s.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-[20ch] mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/lojas"
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-8 py-4 rounded-2xl text-sm transition-all duration-200 hover:scale-[1.02] shadow-lg">
            <MapPin className="size-4" /> Ver restaurantes disponíveis <ArrowRight className="size-4" />
          </Link>
          <p className="text-xs text-zinc-400 mt-3">Sem cadastro obrigatório para fazer seu pedido</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Bloco transição → lojistas ─── */
function LojistasSection() {
  return (
    <section id="lojistas" className="py-24 bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Texto */}
          <div>
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
              <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" />
              Para lojistas
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-5">
              Tem um restaurante ou comércio?<br />
              <span className="text-orange-400">Venda pelo seu próprio delivery.</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-3">
              Com o Delivery Hub, você cria seu cardápio digital, recebe pedidos pelo WhatsApp, usa caixa PDV e gerencia entregadores em um único painel.
            </p>
            <p className="text-zinc-500 text-sm mb-8 border-l-2 border-white/10 pl-4">
              Enquanto marketplaces cobram comissão por pedido, o Delivery Hub permite que você venda pelo seu próprio canal com mensalidade fixa.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <a href="#planos"
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3.5 rounded-2xl text-sm transition-all duration-200 hover:scale-[1.02] shadow-xl shadow-orange-500/30">
                Ver planos <ArrowRight className="size-4" />
              </a>
              <a href={WA_LINK} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-6 py-3.5 rounded-2xl text-sm transition-all duration-200">
                <MessageCircle className="size-4" /> Falar no WhatsApp
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {["0% de comissão", "Cardápio digital", "Caixa PDV incluso", "Gestão de entregadores", "7 dias grátis"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-3 py-1 text-xs text-zinc-400">
                  <Check className="size-3 text-orange-400 shrink-0" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Painel visual */}
          <div className="relative">
            <div className="absolute -inset-8 bg-orange-500/8 blur-3xl rounded-full" />
            <div className="relative bg-zinc-900 rounded-3xl ring-1 ring-white/10 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Store className="size-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Painel do lojista</div>
                    <div className="text-xs text-orange-100">delivery próprio</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/80 bg-white/15 px-2.5 py-1 rounded-full">
                  <span className="size-1.5 rounded-full bg-green-300 animate-pulse" /> Online
                </div>
              </div>
              <div className="p-6 space-y-1">
                {[
                  { icon: Smartphone,    label: "Cardápio digital",     detail: "Link exclusivo da loja",   color: "text-blue-400" },
                  { icon: ClipboardList, label: "Caixa PDV",            detail: "Vendas no balcão",         color: "text-green-400" },
                  { icon: MessageCircle, label: "Pedidos no WhatsApp",  detail: "Tempo real com alerta",    color: "text-orange-400" },
                  { icon: Bike,          label: "Entregadores",         detail: "Gestão de rotas",          color: "text-purple-400" },
                  { icon: BarChart3,     label: "Relatórios",           detail: "Faturamento e produtos",   color: "text-cyan-400" },
                ].map(({ icon: Icon, label, detail, color }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <Icon className={`size-4 shrink-0 ${color}`} />
                      <span className="text-sm text-white font-medium">{label}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{detail}</span>
                  </div>
                ))}
                <div className="pt-4 mt-2 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-0.5">Mensalidade fixa a partir de</div>
                    <div className="text-3xl font-black text-white">R$99<span className="text-base font-normal text-zinc-400">/mês</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-orange-400">0%</div>
                    <div className="text-xs text-zinc-500">de comissão</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Como funciona (lojistas) ─── */
function ComoFunciona() {
  const steps = [
    { num: "1", icon: ClipboardList, title: "Crie sua conta",          desc: "Em menos de 5 minutos, sua loja já está no ar. Sem cartão de crédito, sem complicação." },
    { num: "2", icon: Utensils,      title: "Monte seu cardápio",       desc: "Adicione produtos, fotos e preços com facilidade. Personalize cores, logo e identidade visual." },
    { num: "3", icon: Bike,          title: "Comece a receber pedidos", desc: "Compartilhe o link com seus clientes. Pedidos chegam direto no WhatsApp e no seu painel." },
  ];
  return (
    <section id="como-funciona" className="py-24 bg-white border-y border-zinc-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Como funciona</span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3 tracking-tight">
            Do zero ao primeiro pedido em menos de 24h
          </h2>
          <p className="text-zinc-500 max-w-[48ch] mx-auto text-sm leading-relaxed">
            Você configura tudo sozinho ou com nossa ajuda gratuita. Sem técnico, sem contrato.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-[2.75rem] left-[calc(16.67%+3rem)] right-[calc(16.67%+3rem)] h-px bg-gradient-to-r from-orange-200 via-orange-300 to-orange-200 z-0" />
          {steps.map(({ num, icon: Icon, title, desc }) => (
            <div key={num} className="relative z-10 group">
              <div className="bg-white rounded-3xl p-8 ring-1 ring-zinc-200 hover:ring-orange-300 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-center">
                <div className="relative inline-flex mb-6">
                  <div className="size-20 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30 group-hover:scale-[1.05] transition-all duration-300">
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

/* ─── Features ─── */
function Features() {
  return (
    <section id="recursos" className="py-24 bg-zinc-50 border-b border-zinc-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-3 block">Recursos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3 tracking-tight">
            Cada recurso pensado para o dia a dia do seu delivery
          </h2>
          <p className="text-zinc-500 max-w-[52ch] mx-auto text-sm leading-relaxed">
            Um sistema completo que começa com o cardápio e vai até o entregador — tudo em um lugar só.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, body, badge }) => (
            <div key={title} className="bg-white hover:bg-gradient-to-br hover:from-orange-50 hover:to-white rounded-3xl p-7 ring-1 ring-zinc-200 hover:ring-orange-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-5">
                <div className="size-12 rounded-2xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center text-orange-500 transition-all duration-300 group-hover:scale-[1.08]">
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

/* ─── Pricing ─── */
function Pricing() {
  return (
    <section id="planos" className="py-24 bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3 block">Planos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">Planos simples, sem letra miúda.</h2>
          <p className="text-zinc-400 text-sm max-w-[56ch] mx-auto leading-relaxed">
            Todos os módulos já estão inclusos no mesmo plano —{" "}
            <strong className="text-orange-400">sem cobrar separado por cardápio, PDV ou entregadores.</strong>
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-3xl p-8 flex flex-col relative transition-all duration-300 ${
              p.highlight
                ? "bg-gradient-to-b from-orange-500 to-orange-600 ring-2 ring-orange-400 scale-[1.03] shadow-[0_0_80px_rgba(249,115,22,0.30)]"
                : "bg-zinc-900/70 ring-1 ring-white/10 hover:ring-white/20 hover:bg-zinc-900 hover:shadow-xl"
            }`}>
              {p.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-orange-500 text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                  ⭐ Recomendado
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

/* ─── CTA final ─── */
function CTAFinal() {
  return (
    <section className="py-20 bg-orange-500">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
          Pronto para vender pelo seu próprio delivery?
        </h2>
        <p className="text-orange-100 mb-8 leading-relaxed text-lg">
          Crie sua loja, monte seu cardápio e comece a receber pedidos pelo seu link.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth"
            className="flex items-center gap-2 bg-white hover:bg-orange-50 text-orange-500 font-bold px-8 py-4 rounded-2xl text-base transition-all duration-200 hover:scale-[1.02] shadow-xl w-full sm:w-auto justify-center">
            Testar grátis por 7 dias <ArrowRight className="size-5" />
          </Link>
          <a href={WA_LINK} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 border border-orange-400/30 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-200 w-full sm:w-auto justify-center">
            <MessageCircle className="size-5" /> Falar no WhatsApp
          </a>
        </div>
        <p className="text-orange-200 text-xs mt-5">7 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
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
      className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-bold px-4 py-3.5 rounded-2xl shadow-2xl shadow-green-500/30 transition-all duration-300 hover:scale-[1.05] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}>
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
            <div className="mb-3">
              <img src="/segments/logo1.png" alt="SOS Sistemas" className="h-11 w-auto object-contain brightness-0 invert" />
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Plataforma de delivery próprio para restaurantes e comércios locais. Sem comissão por pedido.
            </p>
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
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Para clientes</div>
              <div className="space-y-2.5 text-xs text-zinc-500">
                <Link to="/lojas" className="block hover:text-white transition-colors duration-150">Ver restaurantes</Link>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Para lojistas</div>
              <div className="space-y-2.5 text-xs text-zinc-500">
                {[["#lojistas","Conheça a solução"],["#como-funciona","Como funciona"],["#recursos","Recursos"],["#planos","Planos e preços"]].map(([href, label]) => (
                  <a key={href} href={href} className="block hover:text-white transition-colors duration-150 hover:translate-x-0.5 transform">{label}</a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Acesso</div>
              <div className="space-y-2.5 text-xs text-zinc-500">
                <Link to="/auth" className="block hover:text-white transition-colors duration-150">Área do lojista</Link>
                <Link to="/entregadores" className="block hover:text-white transition-colors duration-150">Entregadores</Link>
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
          <p className="text-xs text-zinc-700">© 2026 Delivery Hub. Todos os direitos reservados.</p>
          <p className="text-xs text-zinc-700">Uma solução da SOS Sistemas.</p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Landing ─── */
export function Landing() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <Nav />
      <ClienteHero />
      <ComoPedir />
      <LojistasSection />
      <ComoFunciona />
      <Features />
      <Pricing />
      <CTAFinal />
      <FAQ />
      <Footer />
      <WhatsAppFlutuante />
    </div>
  );
}
