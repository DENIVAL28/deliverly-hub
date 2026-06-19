import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, LogIn, UserPlus, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/entregadores/")({
  component: EntregadoresLanding,
});

function EntregadoresLanding() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 left-4">
        <Link to="/" className="flex items-center gap-1 p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-white text-sm font-medium">
          <ChevronLeft className="size-4" /> Início
        </Link>
      </div>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 mb-2">
            <Bike className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Área do Entregador</h1>
          <p className="text-sm text-zinc-400">Plataforma de entregas Delivery Hub</p>
        </div>

        <div className="space-y-3">
          <Link
            to="/entregadores/login"
            className="flex items-center gap-4 w-full bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.01] shadow-lg shadow-orange-500/25"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <LogIn className="size-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Já tenho cadastro</p>
              <p className="text-xs font-normal text-orange-100">Entrar com e-mail e senha</p>
            </div>
          </Link>

          <Link
            to="/entregadores/cadastro"
            className="flex items-center gap-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-6 py-4 rounded-2xl border border-zinc-700 transition-all duration-200 hover:scale-[1.01]"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <UserPlus className="size-5 text-orange-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Criar cadastro</p>
              <p className="text-xs font-normal text-zinc-400">Gratuito · Sem contrato</p>
            </div>
          </Link>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Por que se cadastrar?</p>
          {[
            { icon: "🕐", text: "Trabalhe no seu horário, sem escala fixa" },
            { icon: "💳", text: "Receba diretamente no seu PIX" },
            { icon: "📦", text: "Escolha quais entregas aceitar" },
            { icon: "📍", text: "GPS compartilhado com o cliente" },
            { icon: "🏪", text: "Parceria com restaurantes da região" },
          ].map((b) => (
            <div key={b.text} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">{b.icon}</span>
              <span className="text-xs text-zinc-300">{b.text}</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-zinc-600">
            Precisa de ajuda?{" "}
            <a href="https://wa.me/5566981289787" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
              Fale conosco no WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
