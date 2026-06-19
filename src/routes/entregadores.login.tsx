import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entregadores/login")({
  component: EntregadoresLogin,
});

type Modo = "login" | "esqueci" | "link-enviado";

function EntregadoresLogin() {
  const navigate = useNavigate();
  const [modo, setModo]                 = useState<Modo>("login");
  const [email, setEmail]               = useState("");
  const [senha, setSenha]               = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando]     = useState(false);

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (error) {
        toast.error("E-mail ou senha incorretos.");
        return;
      }
      const { data: entRegistrado, error: rpcError } = await supabase.rpc("entregador_me" as any);
      if (rpcError || !entRegistrado) {
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

  async function handleEsqueci(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/entregadores/nova-senha` }
    );
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      return;
    }
    setModo("link-enviado");
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 mb-1">
            {modo === "esqueci" || modo === "link-enviado"
              ? <Mail className="size-7 text-white" />
              : <Bike className="size-7 text-white" />}
          </div>
          <h1 className="text-xl font-extrabold text-white">
            {modo === "login" && "Entrar como Entregador"}
            {modo === "esqueci" && "Recuperar senha"}
            {modo === "link-enviado" && "E-mail enviado!"}
          </h1>
          <p className="text-sm text-zinc-400">
            {modo === "login" && "Use o e-mail cadastrado na plataforma"}
            {modo === "esqueci" && "Informe seu e-mail para receber o link de recuperação"}
            {modo === "link-enviado" && `Verifique sua caixa de entrada em ${email}`}
          </p>
        </div>

        {/* Login */}
        {modo === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" required className={inputCls} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Senha</label>
                <button type="button" onClick={() => setModo("esqueci")}
                  className="text-xs text-orange-400 hover:underline">
                  Esqueci a senha
                </button>
              </div>
              <div className="relative">
                <input type={mostrarSenha ? "text" : "password"} value={senha}
                  onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required
                  className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={carregando}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all text-sm">
              {carregando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}

        {/* Esqueci a senha */}
        {modo === "esqueci" && (
          <form onSubmit={handleEsqueci} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" required autoFocus className={inputCls} />
            </div>
            <button type="submit" disabled={carregando}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all text-sm">
              {carregando ? "Enviando…" : "Enviar link de recuperação"}
            </button>
            <button type="button" onClick={() => setModo("login")}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1">
              ← Voltar ao login
            </button>
          </form>
        )}

        {/* Link enviado */}
        {modo === "link-enviado" && (
          <div className="space-y-4">
            <div className="p-4 bg-green-950 border border-green-800 rounded-2xl text-xs text-green-300 text-center leading-relaxed">
              Enviamos um link de recuperação para seu e-mail. Clique no link e você poderá criar uma nova senha.
              <br /><br />
              <span className="text-green-500">Verifique também a pasta de spam.</span>
            </div>
            <button onClick={() => setModo("login")}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1">
              ← Voltar ao login
            </button>
          </div>
        )}

        {/* Links rodapé */}
        {modo === "login" && (
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
        )}
      </div>
    </div>
  );
}
