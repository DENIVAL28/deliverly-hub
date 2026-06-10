import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { nome: String(fd.get("nome")) },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Lado esquerdo — animação ── */}
      <div className="hidden lg:flex flex-col justify-between relative bg-zinc-950 overflow-hidden p-12">

        {/* Keyframes injetados */}
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

        {/* Gradiente de fundo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_30%_40%,_rgba(249,115,22,0.18),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,_rgba(249,115,22,0.08),_transparent)]" />

        {/* Círculos pulsantes de fundo */}
        {[160, 260, 360].map((s, i) => (
          <div key={s} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500"
            style={{ width: s, height: s, animation: `pulseRing ${3 + i}s ease-in-out infinite`, animationDelay: `${i * 0.8}s` }} />
        ))}

        {/* Emojis flutuantes */}
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

        {/* Conteúdo */}
        <Link to="/" className="relative z-10">
          <img src="/segments/logo.png" alt="SOS Sistemas" className="h-12 w-auto object-contain brightness-0 invert" />
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

        <p className="relative z-10 text-xs text-zinc-600">© 2026 SOS Sistemas</p>
      </div>

      {/* ── Lado direito — formulário ── */}
      <div className="flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden block mb-8">
            <img src="/segments/logo.png" alt="SOS Sistemas" className="h-10 w-auto object-contain" />
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

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <Field name="email" label="E-mail" type="email" />
                <Field name="password" label="Senha" type="password" />
                <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-400 h-11 text-base font-bold rounded-xl">
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <Field name="nome" label="Seu nome" type="text" />
                <Field name="email" label="E-mail" type="email" />
                <Field name="password" label="Senha" type="password" />
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

function Field({ name, label, type }: { name: string; label: string; type: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required />
    </div>
  );
}