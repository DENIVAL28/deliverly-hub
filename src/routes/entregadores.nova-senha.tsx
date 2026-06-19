import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entregadores/nova-senha")({
  ssr: false,
  component: NovaSenhaEntregador,
});

function NovaSenhaEntregador() {
  const navigate = useNavigate();
  const [pronta, setPronta]       = useState(false);
  const [senha, setSenha]         = useState("");
  const [confirma, setConfirma]   = useState("");
  const [mostrar, setMostrar]     = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    // Detecta evento de recuperação de senha (link do e-mail clicado)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPronta(true);
    });
    // Também cobre o caso em que a sessão já foi restaurada antes do mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronta(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
    if (senha !== confirma) { toast.error("As senhas não coincidem."); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      toast.error("Erro ao salvar a senha. Tente solicitar um novo link.");
      return;
    }
    await supabase.auth.signOut({ scope: "others" });
    setConcluido(true);
    setTimeout(() => navigate({ to: "/entregadores/login", replace: true }), 3000);
  }

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition";

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 mb-1">
            <Bike className="size-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            {concluido ? "Senha alterada!" : "Nova senha"}
          </h1>
          <p className="text-sm text-zinc-400">
            {concluido
              ? "Redirecionando para o login…"
              : pronta
                ? "Escolha sua nova senha de acesso."
                : "Verificando link de recuperação…"}
          </p>
        </div>

        {concluido ? (
          <div className="flex justify-center">
            <CheckCircle2 className="size-16 text-green-400" />
          </div>
        ) : !pronta ? (
          <div className="flex justify-center">
            <div className="size-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Nova senha</label>
              <div className="relative">
                <input
                  type={mostrar ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className={`${inputCls} pr-11`}
                />
                <button type="button" onClick={() => setMostrar(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Confirmar senha</label>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="Repita a senha"
                required
                className={`${inputCls} ${confirma && confirma !== senha ? "ring-2 ring-red-500" : ""}`}
              />
              {confirma && confirma !== senha && (
                <p className="text-xs text-red-400">As senhas não coincidem.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={salvando || (!!confirma && confirma !== senha)}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all text-sm"
            >
              {salvando ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link to="/entregadores/login" className="text-xs text-zinc-600 hover:text-zinc-400">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
