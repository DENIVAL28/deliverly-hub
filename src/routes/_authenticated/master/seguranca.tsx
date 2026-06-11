import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/master/seguranca")({
  component: SegurancaPage,
});

function SegurancaPage() {
  const [factors, setFactors]       = useState<any[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);

  // Enrollment
  const [enrolling, setEnrolling]   = useState(false);
  const [qrCode, setQrCode]         = useState("");
  const [secret, setSecret]         = useState("");
  const [factorId, setFactorId]     = useState("");
  const [verCode, setVerCode]       = useState("");
  const [verifying, setVerifying]   = useState(false);

  async function loadFactors() {
    setLoadingPage(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
    setLoadingPage(false);
  }

  useEffect(() => { loadFactors(); }, []);

  async function startEnroll() {
    setLoadingPage(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Deliverly Hub Master",
    });
    setLoadingPage(false);
    if (error || !data) { toast.error(error?.message ?? "Erro ao iniciar cadastro."); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setEnrolling(true);
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) { toast.error(chErr?.message ?? "Erro"); setVerifying(false); return; }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: verCode.replace(/\s/g, ""),
    });
    setVerifying(false);
    if (error) { toast.error("Código inválido. Tente novamente."); setVerCode(""); return; }
    toast.success("2FA ativado com sucesso! Sua conta agora exige o código no login.");
    setEnrolling(false);
    setVerCode("");
    loadFactors();
  }

  async function unenroll(id: string) {
    if (!window.confirm("Desativar o 2FA? Sua conta ficará protegida apenas por senha.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error(error.message); return; }
    toast.success("2FA desativado.");
    loadFactors();
  }

  const isActive = factors.some((f) => f.status === "verified");

  if (loadingPage) return <div className="p-10 text-sm text-zinc-400 text-center">Carregando…</div>;

  return (
    <>
      <PageHeader title="Segurança" subtitle="Autenticação em dois fatores (2FA)" />

      {!enrolling ? (
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 max-w-lg">
          {/* Status */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`size-14 rounded-2xl flex items-center justify-center ${isActive ? "bg-green-100" : "bg-zinc-100"}`}>
              {isActive
                ? <ShieldCheck className="size-7 text-green-600" />
                : <ShieldOff className="size-7 text-zinc-400" />
              }
            </div>
            <div>
              <div className="font-bold text-zinc-900">{isActive ? "2FA Ativo" : "2FA Inativo"}</div>
              <div className="text-sm text-zinc-500">
                {isActive
                  ? "Login requer email + senha + código do app."
                  : "Apenas senha protege sua conta agora."}
              </div>
            </div>
          </div>

          {isActive ? (
            <div className="space-y-3">
              {factors.filter((f) => f.status === "verified").map((f) => (
                <div key={f.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">{f.friendly_name ?? "Autenticador"}</span>
                  </div>
                  <button onClick={() => unenroll(f.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                    Remover
                  </button>
                </div>
              ))}
              <p className="text-xs text-zinc-400 pt-2">
                Se perder o acesso ao app autenticador, remova o 2FA aqui antes de trocar de celular.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                ⚠️ Recomendado para o super admin. Instale o <strong>Google Authenticator</strong> ou <strong>Authy</strong> antes de continuar.
              </div>
              <Button onClick={startEnroll} className="w-full bg-brand hover:bg-brand/90 gap-2">
                <Smartphone className="size-4" /> Ativar autenticador
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Enrollment — QR code step */
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 max-w-lg space-y-5">
          <div>
            <h2 className="font-bold text-zinc-900 mb-1">Escaneie o QR code</h2>
            <p className="text-sm text-zinc-500">
              Abra o <strong>Google Authenticator</strong> ou <strong>Authy</strong> → "+" → "Escanear QR code".
            </p>
          </div>

          <div className="flex justify-center">
            <div
              className="p-4 bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm"
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-400 hover:text-zinc-600 font-medium">
              Não consegue escanear? Inserir código manualmente
            </summary>
            <code className="block mt-2 font-mono bg-zinc-100 rounded-xl px-4 py-3 text-zinc-700 break-all select-all text-sm">
              {secret}
            </code>
          </details>

          <form onSubmit={verifyEnroll} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700">
                Confirme digitando o código gerado pelo app
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                autoFocus
                placeholder="000 000"
                value={verCode}
                onChange={(e) => setVerCode(e.target.value)}
                className="w-full h-14 rounded-xl border border-zinc-200 text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              />
            </div>
            <Button
              type="submit"
              disabled={verifying || verCode.replace(/\s/g, "").length < 6}
              className="w-full bg-brand hover:bg-brand/90"
            >
              {verifying ? "Verificando…" : "Confirmar e ativar 2FA"}
            </Button>
            <button
              type="button"
              onClick={() => { setEnrolling(false); setVerCode(""); }}
              className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
