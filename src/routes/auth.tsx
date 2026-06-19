import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const FLOATING_ITEMS = [
  { emoji: "🍕", size: "text-5xl", x: "8%",   y: "8%",  dur: "6s",  delay: "0s"    },
  { emoji: "🍔", size: "text-4xl", x: "78%",  y: "6%",  dur: "7s",  delay: "1s"    },
  { emoji: "🍟", size: "text-3xl", x: "55%",  y: "16%", dur: "9s",  delay: "1.5s"  },
  { emoji: "🥤", size: "text-4xl", x: "72%",  y: "65%", dur: "6.5s",delay: "2s"    },
  { emoji: "🍜", size: "text-3xl", x: "85%",  y: "38%", dur: "8.5s",delay: "2.5s"  },
  { emoji: "🍣", size: "text-3xl", x: "65%",  y: "82%", dur: "8s",  delay: "0.5s"  },
  { emoji: "🍰", size: "text-3xl", x: "78%",  y: "50%", dur: "7s",  delay: "1.2s"  },
  { emoji: "🌮", size: "text-4xl", x: "5%",   y: "88%", dur: "7.5s",delay: "0.8s"  },
  { emoji: "🧃", size: "text-2xl", x: "50%",  y: "88%", dur: "6s",  delay: "3s"    },
  { emoji: "🥗", size: "text-2xl", x: "88%",  y: "88%", dur: "9s",  delay: "0.3s"  },
];

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — SOS Sistemas" }] }),
  component: AuthPage,
});

// ── Validações ──────────────────────────────────────────────────────────────

function validarNome(v: string) {
  if (!v.trim()) return "Nome é obrigatório.";
  if (v.trim().length < 2) return "Nome deve ter ao menos 2 caracteres.";
  if (v.trim().length > 100) return "Nome muito longo (máx. 100 caracteres).";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/.test(v.trim())) return "Nome deve conter apenas letras.";
  return "";
}

function validarEmail(v: string) {
  if (!v.trim()) return "E-mail é obrigatório.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return "E-mail inválido.";
  return "";
}

function validarSenha(v: string, modo: "login" | "cadastro") {
  if (!v) return "Senha é obrigatória.";
  if (modo === "cadastro") {
    if (v.length < 8) return "Senha deve ter ao menos 8 caracteres.";
    if (!/[A-Z]/.test(v)) return "Inclua ao menos uma letra maiúscula.";
    if (!/[0-9]/.test(v)) return "Inclua ao menos um número.";
  }
  return "";
}

// ── Componente de campo com erro inline ─────────────────────────────────────

function Field({
  name, label, type, value, onChange, erro, placeholder,
}: {
  name: string; label: string; type: string;
  value: string; onChange: (v: string) => void;
  erro?: string; placeholder?: string;
}) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const inputType = type === "password" ? (mostrarSenha ? "text" : "password") : type;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${type === "password" ? "pr-10" : ""} ${erro ? "border-red-400 focus-visible:ring-red-400" : ""}`}
        />
        {type === "password" && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {erro && <p className="text-xs text-red-500">{erro}</p>}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [esqueceu, setEsqueceu] = useState(false);
  const [esqueceuOque, setEsqueceuOque] = useState<"escolha" | "senha" | "email">("escolha");
  const [emailReset, setEmailReset] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [buscaWhats, setBuscaWhats] = useState("");
  const [emailEncontrado, setEmailEncontrado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  // MFA
  const [mfaStep, setMfaStep]           = useState(false);
  const [mfaCode, setMfaCode]           = useState("");
  const [mfaFactorId, setMfaFactorId]   = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");

  // Campos — login
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginSenha, setLoginSenha]       = useState("");
  const [errosLogin, setErrosLogin]       = useState<Record<string, string>>({});

  // Campos — cadastro
  const [cadNome, setCadNome]             = useState("");
  const [cadEmail, setCadEmail]           = useState("");
  const [cadSenha, setCadSenha]           = useState("");
  const [errosCad, setErrosCad]           = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app", replace: true });
    });
    // Captura SIGNED_IN disparado após confirmação de e-mail (PKCE callback)
    // e após signUp sem confirmação obrigatória
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) navigate({ to: "/app", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // ── Google OAuth ─────────────────────────────────────────────────────────

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const erros = {
      email: validarEmail(loginEmail),
      senha: validarSenha(loginSenha, "login"),
    };
    setErrosLogin(erros);
    if (Object.values(erros).some(Boolean)) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginSenha,
    });
    if (error) { setLoading(false); toast.error(traduzirErro(error.message)); return; }

    // Verifica se precisa de 2FA
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        setMfaFactorId(totp.id);
        setMfaChallengeId(ch?.id ?? "");
        setMfaStep(true);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: mfaChallengeId,
      code: mfaCode.replace(/\s/g, ""),
    });
    setLoading(false);
    if (error) { toast.error("Código inválido ou expirado."); setMfaCode(""); return; }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  // ── Busca e-mail por WhatsApp ────────────────────────────────────────────

  async function handleBuscarEmail(e: React.FormEvent) {
    e.preventDefault();
    const numero = buscaWhats.replace(/\D/g, "");
    if (numero.length < 10) { toast.error("Digite o WhatsApp com DDD (ex: 66981289787)"); return; }
    setBuscando(true);
    const { data, error } = await supabase.rpc("buscar_email_por_whatsapp", { p_whatsapp: numero });
    setBuscando(false);
    if (error || !data) {
      toast.error("Nenhuma conta encontrada com esse WhatsApp.");
      setEmailEncontrado(null);
    } else {
      setEmailEncontrado(data as string);
    }
  }

  // ── Esqueceu senha ───────────────────────────────────────────────────────

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const erroEmail = validarEmail(emailReset);
    if (erroEmail) { toast.error(erroEmail); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailReset.trim(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setLoading(false);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    setEnviado(true);
  }

  // ── Cadastro ─────────────────────────────────────────────────────────────

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const erros = {
      nome:  validarNome(cadNome),
      email: validarEmail(cadEmail),
      senha: validarSenha(cadSenha, "cadastro"),
    };
    setErrosCad(erros);
    if (Object.values(erros).some(Boolean)) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: cadEmail.trim(),
      password: cadSenha,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { nome: cadNome.trim() },
      },
    });
    setLoading(false);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    // Se confirmação de e-mail estiver desabilitada, usuário já tem sessão — redirecionar
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      navigate({ to: "/app", replace: true });
      return;
    }
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* Lado esquerdo — animação */}
      <div className="hidden lg:flex flex-col justify-between relative bg-zinc-950 overflow-hidden p-12">
        <style>{`
          @keyframes floatFood {
            0%   { transform: translateY(0px) rotate(0deg);   opacity: .75; }
            50%  { transform: translateY(-22px) rotate(8deg); opacity: 1;   }
            100% { transform: translateY(0px) rotate(0deg);   opacity: .75; }
          }
          @keyframes pulseRing {
            0%, 100% { transform: scale(1);   opacity: .15; }
            50%       { transform: scale(1.18); opacity: .30; }
          }
        `}</style>

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_30%_40%,_rgba(249,115,22,0.18),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,_rgba(249,115,22,0.08),_transparent)]" />

        {[160, 260, 360].map((s, i) => (
          <div key={s} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500"
            style={{ width: s, height: s, animation: `pulseRing ${3 + i}s ease-in-out infinite`, animationDelay: `${i * 0.8}s` }} />
        ))}

        {FLOATING_ITEMS.map((item, i) => (
          <div key={i} className={`absolute select-none ${item.size}`}
            style={{
              left: item.x, top: item.y,
              animation: `floatFood ${item.dur} ease-in-out infinite`,
              animationDelay: item.delay,
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
            }}>
            {item.emoji}
          </div>
        ))}

        <Link to="/" className="relative z-10">
          <img src="/segments/logo1.png" alt="Delivery Hub" className="h-12 w-auto object-contain brightness-0 invert" />
        </Link>

        <div className="relative z-10">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-white/5 inline-block">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full mb-5 uppercase tracking-widest">
              <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" /> Delivery próprio
            </div>
            <h2 className="text-3xl font-black text-white mb-3 leading-tight">
              Sua plataforma<br />de delivery,<br />
              <span className="text-orange-400">sem comissões.</span>
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed max-w-xs">
              Gerencie cardápio, pedidos e clientes em um único lugar — e fique com 100% do lucro.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs text-zinc-600">© 2026 Delivery Hub</p>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden block mb-8">
            <img src="/segments/logo1.png" alt="Delivery Hub" className="h-10 w-auto object-contain" />
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 mb-1">Acesse sua conta</h1>
            <p className="text-sm text-zinc-600">Painel master ou painel da sua empresa.</p>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>


            {/* ── Login ── */}
            <TabsContent value="login">
              {mfaStep ? (
                <form onSubmit={handleMfaVerify} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="text-4xl">🔐</div>
                    <p className="font-semibold text-zinc-900">Verificação em dois fatores</p>
                    <p className="text-sm text-zinc-500">Abra o Google Authenticator ou Authy e digite o código de 6 dígitos.</p>
                  </div>
                  <div className="space-y-1.5">
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
                      className="w-full h-14 rounded-xl border border-zinc-200 text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                    />
                  </div>
                  <Button type="submit"
                    disabled={loading || mfaCode.replace(/\s/g, "").length < 6}
                    className="w-full bg-orange-500 hover:bg-orange-400 h-11 font-bold rounded-xl">
                    {loading ? "Verificando…" : "Confirmar"}
                  </Button>
                  <button type="button"
                    onClick={() => { setMfaStep(false); setMfaCode(""); }}
                    className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                    ← Voltar ao login
                  </button>
                </form>
              ) : esqueceu ? (
                enviado ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="text-4xl">📧</div>
                    <p className="font-semibold text-zinc-900">E-mail enviado!</p>
                    <p className="text-sm text-zinc-500">Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
                    <button onClick={() => { setEsqueceu(false); setEnviado(false); setEmailReset(""); setEsqueceuOque("escolha"); }}
                      className="text-sm text-orange-500 hover:underline">
                      Voltar ao login
                    </button>
                  </div>
                ) : esqueceuOque === "escolha" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-500 text-center">O que você esqueceu?</p>
                    <button type="button" onClick={() => setEsqueceuOque("senha")}
                      className="w-full text-left rounded-xl border-2 border-zinc-200 hover:border-orange-400 p-4 transition-colors group">
                      <div className="font-semibold text-sm text-zinc-900 group-hover:text-orange-500">🔑 Esqueci a senha</div>
                      <p className="text-xs text-zinc-400 mt-0.5">Vou te enviar um link por e-mail para criar uma nova senha.</p>
                    </button>
                    <button type="button" onClick={() => setEsqueceuOque("email")}
                      className="w-full text-left rounded-xl border-2 border-zinc-200 hover:border-orange-400 p-4 transition-colors group">
                      <div className="font-semibold text-sm text-zinc-900 group-hover:text-orange-500">📧 Esqueci o e-mail</div>
                      <p className="text-xs text-zinc-400 mt-0.5">Vou buscar seu e-mail pelo número de WhatsApp cadastrado.</p>
                    </button>
                    <button type="button" onClick={() => { setEsqueceu(false); setEsqueceuOque("escolha"); }}
                      className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors pt-1">
                      ← Voltar ao login
                    </button>
                  </div>
                ) : esqueceuOque === "senha" ? (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-sm text-zinc-500">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="email-reset">E-mail</Label>
                      <Input id="email-reset" type="email" required value={emailReset}
                        onChange={(e) => setEmailReset(e.target.value)} placeholder="seu@email.com" />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-400 h-11 font-bold rounded-xl">
                      {loading ? "Enviando…" : "Enviar link de redefinição"}
                    </Button>
                    <button type="button" onClick={() => setEsqueceuOque("escolha")}
                      className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                      ← Voltar
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleBuscarEmail} className="space-y-4">
                    <p className="text-sm text-zinc-500">Digite o WhatsApp cadastrado na sua loja e vamos encontrar o e-mail associado.</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="whats-busca">WhatsApp (com DDD)</Label>
                      <Input id="whats-busca" type="tel" value={buscaWhats}
                        onChange={(e) => setBuscaWhats(e.target.value)}
                        placeholder="Ex: 66981289787" className="h-10 rounded-xl" />
                    </div>
                    {emailEncontrado && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
                        <p className="text-xs text-green-700 font-semibold">E-mail encontrado:</p>
                        <p className="font-mono text-sm text-green-900">{emailEncontrado}</p>
                        <button type="button"
                          onClick={() => { setEsqueceuOque("senha"); setEmailEncontrado(null); }}
                          className="text-xs text-orange-500 hover:underline font-semibold pt-1 block">
                          Já lembrei — redefinir senha →
                        </button>
                      </div>
                    )}
                    <Button type="submit" disabled={buscando} className="w-full bg-orange-500 hover:bg-orange-400 h-11 font-bold rounded-xl">
                      {buscando ? "Buscando…" : "Buscar e-mail"}
                    </Button>
                    <button type="button" onClick={() => { setEsqueceuOque("escolha"); setEmailEncontrado(null); setBuscaWhats(""); }}
                      className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                      ← Voltar
                    </button>
                  </form>
                )
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field name="email" label="E-mail" type="email" placeholder="seu@email.com"
                    value={loginEmail} onChange={setLoginEmail} erro={errosLogin.email} />
                  <Field name="password" label="Senha" type="password" placeholder="••••••••"
                    value={loginSenha} onChange={setLoginSenha} erro={errosLogin.senha} />
                  <div className="text-right -mt-1">
                    <button type="button" onClick={() => { setEsqueceu(true); setEsqueceuOque("escolha"); }}
                      className="text-xs text-zinc-400 hover:text-orange-500 transition-colors">
                      Esqueceu a senha ou e-mail?
                    </button>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-400 h-11 text-base font-bold rounded-xl">
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              )}
            </TabsContent>

            {/* ── Cadastro ── */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <Field name="nome" label="Seu nome" type="text" placeholder="João Silva"
                  value={cadNome} onChange={setCadNome} erro={errosCad.nome} />
                <Field name="email" label="E-mail" type="email" placeholder="seu@email.com"
                  value={cadEmail} onChange={setCadEmail} erro={errosCad.email} />
                <div className="space-y-1.5">
                  <Field name="password" label="Senha" type="password" placeholder="Mín. 8 chars, 1 maiúscula, 1 número"
                    value={cadSenha} onChange={setCadSenha} erro={errosCad.senha} />
                  <ul className="text-[11px] text-zinc-400 space-y-0.5 pl-1">
                    <li className={cadSenha.length >= 8 ? "text-green-500" : ""}>• Mínimo 8 caracteres</li>
                    <li className={/[A-Z]/.test(cadSenha) ? "text-green-500" : ""}>• Ao menos 1 letra maiúscula</li>
                    <li className={/[0-9]/.test(cadSenha) ? "text-green-500" : ""}>• Ao menos 1 número</li>
                  </ul>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-400 h-11 text-base font-bold rounded-xl">
                  {loading ? "Criando conta…" : "Criar conta grátis"}
                </Button>
                <p className="text-xs text-zinc-500 text-center">Ao criar a conta você será guiado para configurar sua loja.</p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
            <Link to="/" className="text-sm font-medium text-zinc-600 hover:text-orange-500 transition-colors">
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
