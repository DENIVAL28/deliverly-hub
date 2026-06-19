import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entregadores/login")({
  component: EntregadoresLogin,
});

function EntregadoresLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando]     = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (error) {
        toast.error("E-mail ou senha incorretos.");
        return;
      }
      // Verificar se é entregador de plataforma
      const { data: entRegisrado, error: rpcError } = await supabase.rpc("entregador_me" as any);
      if (rpcError || !entRegisrado) {
        await supabase.auth.signOut();
        toast.error(
          rpcError
            ? "Erro ao verificar cadastro. Tente novamente em instantes."
            : "Conta não encontrada como entregador. Use o login do painel da loja se for dono/atendente."
        );
        return;
      }
      navigate({ to: "/entregadores/painel", replace: true });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 mb-1">
            <Bike className="size-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Entrar como Entregador</h1>
          <p className="text-sm text-zinc-400">Use o e-mail cadastrado na plataforma</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all duration-200 text-sm"
          >
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        {/* Links */}
        <div className="text-center space-y-2">
          <p className="text-xs text-zinc-500">
            Ainda não tem cadastro?{" "}
            <Link to="/entregadores/cadastro" className="text-orange-400 hover:underline font-semibold">
              Criar conta grátis
            </Link>
          </p>
          <Link to="/entregadores" className="text-xs text-zinc-600 hover:text-zinc-400 block">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
