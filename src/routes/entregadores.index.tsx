import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, LogIn, UserPlus, ArrowRight, ChevronLeft, CheckCircle, Clock, Smartphone, MapPin, DollarSign, Shield } from "lucide-react";

export const Route = createFileRoute("/entregadores/")({
  component: EntregadoresLanding,
});

const steps = [
  {
    num: "01",
    title: "Restaurante te convida",
    desc: "Um restaurante que usa o Delivery Hub te manda um link de convite pelo WhatsApp. Clique nele — não precisa baixar nenhum app.",
  },
  {
    num: "02",
    title: "Cadastro em 1 minuto",
    desc: "Preencha seu nome, WhatsApp e tipo de veículo. O restaurante revisa e aprova seu cadastro.",
  },
  {
    num: "03",
    title: "Aceite as corridas que quiser",
    desc: "Quando um pedido sai para entrega, você recebe um aviso. Aceite ou ignore — sem obrigação, sem escala fixa.",
  },
];

const beneficios = [
  { icon: Clock,       texto: "Trabalhe no seu horário",       sub: "Sem escala fixa, sem mínimo de corridas" },
  { icon: Smartphone,  texto: "Tudo pelo celular",             sub: "Sem instalar nada — funciona pelo navegador" },
  { icon: MapPin,      texto: "Google Maps integrado",         sub: "Navegação com um toque direto para o cliente" },
  { icon: DollarSign,  texto: "Taxa exibida antes de aceitar", sub: "Você vê o valor da corrida antes de confirmar" },
  { icon: Shield,      texto: "Vínculo direto com o restaurante", sub: "Sem intermediário entre você e o estabelecimento" },
  { icon: Bike,        texto: "Qualquer veículo",              sub: "Moto, bicicleta, carro ou a pé" },
];

function EntregadoresLanding() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
          <ChevronLeft className="size-4" /> Início
        </Link>
        <Link to="/entregadores/login"
          className="flex items-center gap-1.5 text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors">
          <LogIn className="size-4" /> Entrar como entregador
        </Link>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,_rgba(249,115,22,0.15),_transparent)]" />
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest">
            <Bike className="size-3.5" /> Para entregadores
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
            Entregue quando<br />
            <span className="text-orange-400">quiser, quanto quiser.</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-[42ch] mx-auto">
            Restaurantes que usam o Delivery Hub convidam motoboys e entregadores freelancers. Você escolhe as corridas — sem vínculo, sem horário obrigatório.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/entregadores/cadastro"
              className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-200 hover:scale-[1.02] shadow-2xl shadow-orange-500/25">
              <UserPlus className="size-5" /> Tenho um link de convite
            </Link>
            <Link to="/entregadores/login"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-200">
              <LogIn className="size-5" /> Já sou cadastrado
            </Link>
          </div>
          <p className="text-xs text-zinc-600 mt-5">Gratuito · Sem contrato · Sem app para instalar</p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-widest text-center mb-3">Como funciona</p>
          <h2 className="text-3xl font-black text-white text-center mb-16">3 passos para começar</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(100%-1rem)] w-8 border-t border-dashed border-orange-500/30 z-10" />
                )}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 h-full hover:border-orange-500/30 transition-colors">
                  <div className="text-4xl font-black text-orange-500/30 mb-4 font-mono">{s.num}</div>
                  <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-widest text-center mb-3">Vantagens</p>
          <h2 className="text-3xl font-black text-white text-center mb-16">Por que usar o Delivery Hub?</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {beneficios.map((b) => (
              <div key={b.texto} className="flex items-start gap-4 bg-white/5 border border-white/8 rounded-2xl p-5">
                <div className="size-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <b.icon className="size-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{b.texto}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="mx-auto max-w-xl">
          <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 rounded-3xl p-10 text-center">
            <div className="size-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
              <Bike className="size-7 text-orange-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Pronto para começar?</h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              Se um restaurante parceiro já te enviou um link de convite, clique abaixo e faça seu cadastro em menos de 2 minutos.
            </p>
            <Link to="/entregadores/cadastro"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-200 hover:scale-[1.02] shadow-2xl shadow-orange-500/25">
              <UserPlus className="size-5" /> Fazer meu cadastro <ArrowRight className="size-5" />
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8">
              {["100% gratuito", "Sem contrato", "Cancele quando quiser"].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <CheckCircle className="size-3 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
