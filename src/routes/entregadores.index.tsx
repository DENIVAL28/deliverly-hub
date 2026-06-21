import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, LogIn, UserPlus, ChevronLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/entregadores/")({
  component: EntregadoresLanding,
});

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

const faqs = [
  { p: "Preciso ter CNH?", r: "Depende do veículo — para moto e carro sim. Para bicicleta e a pé, não." },
  { p: "Preciso pagar para se cadastrar?", r: "Não. O cadastro é 100% gratuito." },
  { p: "Posso trabalhar para vários restaurantes?", r: "Sim! Cada restaurante tem seu próprio link — você pode se cadastrar em quantos quiser." },
];

function EntregadoresLanding() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      {/* Nav simples */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-16 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5">
        <Link to="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
          <ChevronLeft className="size-4" /> Início
        </Link>
        <Link to="/entregadores/login"
          className="flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors">
          <LogIn className="size-4" /> Já tenho cadastro
        </Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_20%,_rgba(249,115,22,0.12),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_80%,_rgba(249,115,22,0.07),_transparent)]" />
        <div className="relative mx-auto max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Texto */}
          <div>
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
              <Bike className="size-3.5" /> Para entregadores
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight mb-5">
              Faça entregas no<br />
              <span className="text-orange-400">seu próprio ritmo</span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-[46ch]">
              Restaurantes que usam o Delivery Hub podem convidar motoboys freelancers para entregar seus pedidos — sem vínculo fixo, sem horário obrigatório.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/entregadores/cadastro"
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-300 hover:scale-[1.02] shadow-2xl shadow-orange-500/30">
                <UserPlus className="size-5" /> Criar meu cadastro grátis <ArrowRight className="size-5" />
              </Link>
              <Link to="/entregadores/login"
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-300">
                <LogIn className="size-5" /> Já tenho cadastro
              </Link>
            </div>
            <p className="text-xs text-zinc-600 mt-4">Gratuito · Sem contrato · Trabalhe quando quiser</p>
          </div>

          {/* Vídeo */}
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-2xl shadow-black/40 bg-zinc-900 aspect-video">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover">
              <source src="/segments/Create_a_modern_D_vector_anim.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Como funciona + benefícios */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl grid lg:grid-cols-2 gap-16 items-start">

          {/* Timeline */}
          <div>
            <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-orange-400 inline-block animate-pulse" />
              Como funciona
            </h2>
            <div className="relative">
              {steps.map((s, i) => (
                <div key={s.num} className="flex items-start gap-5 relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-6 top-14 w-px bg-gradient-to-b from-orange-500/40 to-transparent" style={{ height: "calc(100% - 3rem)" }} />
                  )}
                  <div className="relative shrink-0">
                    <div className="size-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl z-10 relative shadow-lg">
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

          {/* Benefícios + FAQ */}
          <div className="space-y-5">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-green-400 inline-block" />
                Vantagens para o entregador
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {beneficios.map((b) => (
                  <div key={b.texto} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-xl shrink-0 w-8 text-center">{b.icon}</span>
                    <span className="text-sm text-zinc-300">{b.texto}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Dúvidas frequentes</h2>
              {faqs.map((f, i) => (
                <div key={i} className={`py-4 ${i > 0 ? "border-t border-white/6" : ""}`}>
                  <p className="text-xs font-bold text-zinc-300 mb-1">❓ {f.p}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-black text-white mb-3">Pronto para começar?</h2>
          <p className="text-zinc-400 text-sm mb-8">Crie seu cadastro em menos de 5 minutos. Após aprovação, você já começa a receber pedidos.</p>
          <Link to="/entregadores/cadastro"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-300 hover:scale-[1.02] shadow-2xl shadow-orange-500/30">
            <UserPlus className="size-5" /> Criar meu cadastro grátis <ArrowRight className="size-5" />
          </Link>
          <p className="text-xs text-zinc-600 mt-4">
            Precisa de ajuda?{" "}
            <a href="https://wa.me/5566981289787" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
              Fale conosco no WhatsApp
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
