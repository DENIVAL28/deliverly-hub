import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, CheckCircle2, Smartphone } from "lucide-react";
import { traduzirErro } from "@/lib/erros";

export const Route = createFileRoute("/nova-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redefinir senha — SOS Sistemas" }] }),
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const [pronta, setPronta]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [senha, setSenha]         = useState("");
  const [confirma, setConfirma]   = useState("");

  // MFA / AAL2
  const [precisaMfa, setPrecisaMfa]   = useState(false);
  const [mfaCode, setMfaCode]         = useState("");
  const [mfaLoading, setMfaLoading]   = useState(false);
  const [factorId, setFactorId]       = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPronta(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronta(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (senha.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
    if (!/[A-Z]/.test(senha)) { toast.error("Inclua ao menos uma letra maiúscula."); return; }
    if (!/[0-9]/.test(senha)) { toast.error("Inclua ao menos um número."); return; }
    if (senha !== confirma) { toast.error("As senhas não coincidem."); return; }
    await salvarSenha();
  }

  async function salvarSenha() {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (error) {
      // 2FA ativo — precisa verificar o código antes de trocar a senha
      if (error.message.includes("AAL2") || error.message.includes("MFA")) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totp = factorsData?.totp?.find((f) => f.status === "verified");
        if (totp) {
          setFactorId(totp.id);
          setPrecisaMfa(true);
          return;
        }
      }
      toast.error(traduzirErro(error.message));
      return;
    }

    // Encerra todas as outras sessões após troca de senha
    await supabase.auth.signOut({ scope: "others" });
    setConcluido(true);
    setTimeout(() => navigate({ to: "/app" }), 3000);
  }

  async function verificarMfa(e: React.FormEvent) {
    e.preventDefault();
    if (mfaCode.replace(/\s/g, "").length < 6) return;
    setMfaLoading(true);

    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      toast.error("Erro ao iniciar verificação 2FA.");
      setMfaLoading(false);
      return;
    }

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: mfaCode.replace(/\s/g, ""),
    });

    if (verErr) {
      toast.error("Código inválido. Tente novamente.");
      setMfaCode("");
      setMfaLoading(false);
      return;
    }

    // AAL2 estabelecida — tenta salvar a senha novamente
    setMfaLoading(false);
    setPrecisaMfa(false);
    await salvarSenha();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-8">

        <div className="flex justify-center mb-6">
          <div className={`size-14 rounded-2xl flex items-center justify-center ${precisaMfa ? "bg-purple-50" : "bg-orange-50"}`}>
            {precisaMfa
              ? <Smartphone className="size-7 text-purple-500" />
              : <Lock className="size-7 text-orange-500" />
            }
          </div>
        </div>

        {concluido ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="size-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-zinc-900">Senha alterada!</h1>
            <p className="text-sm text-zinc-500">Redirecionando para o painel…</p>
          </div>

        ) : precisaMfa ? (
          <>
            <h1 className="text-xl font-bold text-zinc-900 mb-1 text-center">Verificação 2FA</h1>
            <p className="text-sm text-zinc-500 text-center mb-6">
              Sua conta tem autenticação em dois fatores. Digite o código do app autenticador para continuar.
            </p>
            <form onSubmit={verificarMfa} className="space-y-4">
              <div className="space-y-2">
                <Label>Código do autenticador</Label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  autoFocus
                  placeholder="000 000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full h-14 rounded-xl border border-zinc-200 text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                />
              </div>
              <Button
                type="submit"
                disabled={mfaLoading || mfaCode.replace(/\s/g, "").length < 6}
                className="w-full bg-purple-600 hover:bg-purple-500 h-11 font-bold rounded-xl"
              >
                {mfaLoading ? "Verificando…" : "Confirmar e salvar senha"}
              </Button>
              <button
                type="button"
                onClick={() => { setPrecisaMfa(false); setMfaCode(""); }}
                className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Voltar
              </button>
            </form>
          </>

        ) : !pronta ? (
          <div className="text-center space-y-3">
            <h1 className="text-xl font-bold text-zinc-900">Verificando link…</h1>
            <p className="text-sm text-zinc-500">Aguarde um instante.</p>
            <div className="animate-spin size-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
          </div>

        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-900 mb-1 text-center">Nova senha</h1>
            <p className="text-sm text-zinc-500 text-center mb-6">Escolha uma senha forte para sua conta.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha">Nova senha</Label>
                <Input id="senha" type="password" required minLength={8}
                  value={senha} onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mín. 8 chars, 1 maiúscula, 1 número" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirma">Confirmar senha</Label>
                <Input id="confirma" type="password" required
                  value={confirma} onChange={(e) => setConfirma(e.target.value)}
                  placeholder="Repita a senha"
                  className={confirma && confirma !== senha ? "border-red-300" : confirma && confirma === senha ? "border-green-400" : ""}
                />
                {confirma && confirma !== senha && (
                  <p className="text-xs text-red-500">As senhas não coincidem.</p>
                )}
              </div>
              <Button type="submit" disabled={loading || (!!confirma && confirma !== senha)}
                className="w-full bg-orange-500 hover:bg-orange-400 h-11 font-bold rounded-xl">
                {loading ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
