import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { mascaraCNPJ, cnpjStatus, validarWhatsApp } from "@/lib/validacoes";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const SEGMENTOS = [
  { id: "pizzaria",     label: "Pizzaria",     emoji: "🍕" },
  { id: "hamburgueria", label: "Hamburgueria",  emoji: "🍔" },
  { id: "sushi",        label: "Sushi",         emoji: "🍣" },
  { id: "acai",         label: "Açaí",          emoji: "🍧" },
  { id: "marmita",      label: "Marmitaria",    emoji: "🍱" },
  { id: "lanchonete",   label: "Lanchonete",    emoji: "🥪" },
  { id: "confeitaria",  label: "Confeitaria",   emoji: "🍰" },
  { id: "outro",        label: "Outro",         emoji: "🍽️" },
];

const CORES = [
  "#F97316", "#EF4444", "#8B5CF6",
  "#3B82F6", "#10B981", "#F59E0B",
  "#EC4899", "#1F2937",
];

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function OnboardingPage() {
  const { user, empresaId, loading } = useAuth();
  const navigate = useNavigate();

  // Redireciona se já tem empresa
  useEffect(() => {
    if (!loading && empresaId) navigate({ to: "/empresa", replace: true });
  }, [loading, empresaId, navigate]);

  const [step, setStep]           = useState(1);
  const [salvando, setSalvando]   = useState(false);

  // Passo 1
  const [nome, setNome]           = useState("");
  const [segmento, setSegmento]   = useState("");

  // Passo 2
  const [slug, setSlug]                     = useState("");
  const [cidade, setCidade]                 = useState("");
  const [whatsapp, setWhatsapp]             = useState("");
  const [cnpj, setCnpj]                     = useState("");
  const [slugStatus, setSlugStatus]         = useState<"idle" | "checking" | "ok" | "taken">("idle");

  // Passo 3
  const [corPrimaria, setCorPrimaria] = useState("#F97316");

  function handleNomeChange(v: string) {
    setNome(v);
    setSlug(slugify(v));
    setSlugStatus("idle");
  }

  function handleSlugChange(v: string) {
    setSlug(slugify(v));
    setSlugStatus("idle");
  }

  async function verificarSlug() {
    if (slug.length < 3) return;
    setSlugStatus("checking");
    const { data } = await supabase.from("empresas").select("id").eq("slug", slug).maybeSingle();
    setSlugStatus(data ? "taken" : "ok");
  }

  async function finalizar() {
    if (!user) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("criar_empresa_onboarding", {
        p_nome_fantasia: nome.trim(),
        p_slug:          slug.trim(),
        p_cor_primaria:  corPrimaria,
        p_cidade:        cidade.trim() || undefined,
        p_whatsapp:      whatsapp.trim() || undefined,
        p_cnpj:          cnpj.replace(/\D/g, "").length === 14 ? cnpj.trim() : undefined,
        p_segmento:      segmento || undefined,
      });

      if (error) {
        const msg = error.message.includes("SLUG_OCUPADO")
          ? "Este endereço já está em uso. Volte e tente outro."
          : error.message.includes("CNPJ_INVALIDO")
          ? "O CNPJ informado não é válido. Verifique os números."
          : error.message.includes("CNPJ_OCUPADO")
          ? "Este CNPJ já possui uma conta cadastrada. Entre em contato com o suporte."
          : error.message.includes("RATE_LIMIT")
          ? "Muitos cadastros foram feitos agora. Aguarde alguns minutos e tente novamente."
          : error.message;
        toast.error(msg);
        return;
      }

      toast.success("🚀 Sua loja foi criada com sucesso!");
      // Recarrega para atualizar useAuth com o novo empresaId
      window.location.href = "/empresa";
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado.");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/segments/logo1.png" alt="Deliverly Hub" className="h-10 w-auto mx-auto object-contain mb-4" />
          <p className="text-sm text-zinc-500">Vamos configurar sua loja em 3 passos rápidos!</p>
        </div>

        {/* Progress */}
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                s < step  ? "bg-green-500 text-white"
                : s === step ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
                : "bg-zinc-200 text-zinc-400"
              }`}>
                {s < step ? <CheckCircle2 className="size-5" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 mx-2 transition-colors ${s < step ? "bg-green-400" : "bg-zinc-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">

          {/* ── Passo 1 ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Como se chama seu restaurante?</h2>
                <p className="text-sm text-zinc-500 mt-1">Esse nome será exibido para seus clientes.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Nome do restaurante *</Label>
                <Input
                  autoFocus
                  placeholder="Ex: Pizzaria do João"
                  value={nome}
                  onChange={(e) => handleNomeChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Segmento <span className="text-zinc-400 font-normal">(opcional)</span></Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SEGMENTOS.map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => setSegmento(segmento === s.id ? "" : s.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                        segmento === s.id
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}>
                      <span className="text-xl">{s.emoji}</span>
                      <span className="leading-tight text-center">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={nome.trim().length < 3}
                className="w-full bg-orange-500 hover:bg-orange-400 h-11 text-base font-bold rounded-xl">
                Próximo →
              </Button>
            </div>
          )}

          {/* ── Passo 2 ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Endereço da sua loja online</h2>
                <p className="text-sm text-zinc-500 mt-1">Esse link você compartilha com seus clientes para pedirem.</p>
              </div>

              <div className="space-y-1.5">
                <Label>URL da loja *</Label>
                <div className="flex">
                  <span className="flex items-center px-3 bg-zinc-100 border border-r-0 border-zinc-200 rounded-l-lg text-sm text-zinc-500 whitespace-nowrap">
                    /loja/
                  </span>
                  <Input
                    className="rounded-l-none"
                    placeholder="pizzaria-do-joao"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    onBlur={verificarSlug}
                  />
                </div>
                <div className="text-xs h-4">
                  {slugStatus === "checking" && <span className="text-zinc-400">Verificando…</span>}
                  {slugStatus === "ok"       && <span className="text-green-600">✓ Endereço disponível!</span>}
                  {slugStatus === "taken"    && <span className="text-red-500">✗ Já está em uso. Tente outro.</span>}
                  {slugStatus === "idle" && slug.length >= 3 && (
                    <button type="button" onClick={verificarSlug} className="text-orange-500 hover:underline">
                      Verificar disponibilidade
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cidade <span className="text-zinc-400 font-normal">(opcional)</span></Label>
                  <Input placeholder="Ex: São Paulo" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp <span className="text-zinc-400 font-normal">(opcional)</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="(11) 99999-9999"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className={whatsapp && !validarWhatsApp(whatsapp) ? "border-red-300 pr-9" : ""}
                    />
                    {whatsapp && !validarWhatsApp(whatsapp) && (
                      <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-red-400 pointer-events-none" />
                    )}
                    {whatsapp && validarWhatsApp(whatsapp) && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-green-500 pointer-events-none" />
                    )}
                  </div>
                  {whatsapp && !validarWhatsApp(whatsapp) && (
                    <p className="text-xs text-red-500">DDD + número (10 ou 11 dígitos)</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>CNPJ <span className="text-zinc-400 font-normal">(opcional)</span></Label>
                <div className="relative">
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(mascaraCNPJ(e.target.value))}
                    className={`font-mono ${cnpjStatus(cnpj) === "invalido" ? "border-red-300 pr-9" : cnpjStatus(cnpj) === "valido" ? "border-green-400 pr-9" : ""}`}
                  />
                  {cnpjStatus(cnpj) === "valido" && (
                    <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-green-500 pointer-events-none" />
                  )}
                  {cnpjStatus(cnpj) === "invalido" && (
                    <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-red-400 pointer-events-none" />
                  )}
                  {cnpjStatus(cnpj) === "incompleto" && (
                    <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-amber-400 pointer-events-none" />
                  )}
                </div>
                {cnpjStatus(cnpj) === "invalido"   && <p className="text-xs text-red-500">CNPJ inválido — verifique os números.</p>}
                {cnpjStatus(cnpj) === "incompleto" && <p className="text-xs text-amber-500">CNPJ incompleto.</p>}
                {cnpjStatus(cnpj) === "valido"     && <p className="text-xs text-green-600">✓ CNPJ válido</p>}
                {cnpjStatus(cnpj) === "vazio"      && <p className="text-xs text-zinc-400">Se ainda não tiver CNPJ, pode preencher depois em Configurações.</p>}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11 rounded-xl">
                  ← Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={
                    slug.length < 3 ||
                    slugStatus === "taken" ||
                    slugStatus === "checking" ||
                    cnpjStatus(cnpj) === "invalido" ||
                    cnpjStatus(cnpj) === "incompleto"
                  }
                  className="flex-1 bg-orange-500 hover:bg-orange-400 h-11 font-bold rounded-xl">
                  Próximo →
                </Button>
              </div>
            </div>
          )}

          {/* ── Passo 3 ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Cor da sua marca</h2>
                <p className="text-sm text-zinc-500 mt-1">Aparece nos botões e destaques da loja. Você pode mudar depois.</p>
              </div>

              <div className="space-y-3">
                <Label>Escolha uma cor</Label>
                <div className="flex gap-3 flex-wrap">
                  {CORES.map((cor) => (
                    <button key={cor} type="button" onClick={() => setCorPrimaria(cor)}
                      className={`size-10 rounded-xl transition-all ${
                        corPrimaria === cor ? "ring-2 ring-offset-2 ring-zinc-500 scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                <p className="text-xs text-zinc-400 mb-3 font-medium uppercase tracking-wider">Prévia da loja</p>
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl flex items-center justify-center text-white text-xl font-black shrink-0"
                    style={{ backgroundColor: corPrimaria }}>
                    {nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-900 truncate">{nome}</div>
                    <div className="text-xs text-zinc-400 truncate">{typeof window !== "undefined" ? window.location.hostname : ""}/loja/{slug}</div>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                      style={{ backgroundColor: corPrimaria }}>
                      Ver cardápio
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11 rounded-xl">
                  ← Voltar
                </Button>
                <Button
                  onClick={finalizar}
                  disabled={salvando}
                  className="flex-1 h-11 text-base font-bold rounded-xl text-white"
                  style={{ backgroundColor: corPrimaria }}>
                  {salvando ? "Criando sua loja…" : "🚀 Criar minha loja!"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 mt-5">
          Você poderá ajustar tudo isso depois em <strong>Configurações</strong>.
        </p>
      </div>
    </div>
  );
}
