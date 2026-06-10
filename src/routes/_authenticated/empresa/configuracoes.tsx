import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Store, ExternalLink, CheckCircle2, Palette, QrCode, Bot, FlaskConical, XCircle } from "lucide-react";
import { mascaraCNPJ, cnpjStatus, copiarTexto } from "@/lib/validacoes";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const logoRef   = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved,   setSaved]   = useState(false);

  const { data: empresa } = useQuery({
    queryKey: ["empresa-config", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("empresas").select("*").eq("id", empresaId!).single()).data,
  });

  // inputs de texto precisam ser controlados para não perder valor ao recarregar
  const DIAS_LISTA = [
    { key: "seg", label: "Seg" }, { key: "ter", label: "Ter" },
    { key: "qua", label: "Qua" }, { key: "qui", label: "Qui" },
    { key: "sex", label: "Sex" }, { key: "sab", label: "Sáb" },
    { key: "dom", label: "Dom" },
  ];

  const [nome,       setNome]       = useState("");
  const [whatsapp,   setWhatsapp]   = useState("");
  const [taxa,       setTaxa]       = useState("");
  const [tempo,      setTempo]      = useState("");
  const [minimo,     setMinimo]     = useState("");
  const [abertura,   setAbertura]   = useState("18:00");
  const [fechamento, setFechamento] = useState("23:00");
  const [dias,       setDias]       = useState<string[]>(["seg","ter","qua","qui","sex","sab","dom"]);
  const [cor,        setCor]        = useState("#F97316");
  const [chavePix,       setChavePix]       = useState("");
  const [tipoChavePix,   setTipoChavePix]   = useState("aleatoria");
  const [nomeRecebedor,  setNomeRecebedor]  = useState("");
  const [cidadeRecebedor, setCidadeRecebedor] = useState("");
  const [zapiInstance,   setZapiInstance]   = useState("");
  const [zapiToken,      setZapiToken]      = useState("");
  const [zapiClientToken, setZapiClientToken] = useState("");
  const [cnpj,           setCnpj]           = useState("");
  const [segmento,       setSegmento]       = useState("");
  const [zapiTestando,   setZapiTestando]   = useState(false);

  const [synced, setSynced] = useState(false);
  if (empresa && !synced) {
    const emp = empresa as any;
    setNome(empresa.nome_fantasia ?? "");
    setWhatsapp(empresa.whatsapp ?? "");
    setTaxa(String(empresa.taxa_entrega ?? 0));
    setTempo(emp.tempo_entrega ?? "30-45 min");
    setMinimo(String(emp.pedido_minimo ?? 0));
    setAbertura(emp.horario_abertura ?? "18:00");
    setFechamento(emp.horario_fechamento ?? "23:00");
    setDias((emp.dias_semana ?? "seg,ter,qua,qui,sex,sab,dom").split(",").map((d: string) => d.trim()));
    setCor(empresa.cor_primaria ?? "#F97316");
    setChavePix(emp.chave_pix ?? "");
    setTipoChavePix(emp.tipo_chave_pix ?? "aleatoria");
    setNomeRecebedor(emp.nome_recebedor ?? "");
    setCidadeRecebedor(emp.cidade_recebedor ?? "");
    setZapiInstance(emp.zapi_instance ?? "");
    setZapiToken(emp.zapi_token ?? "");
    setZapiClientToken(emp.zapi_client_token ?? "");
    setCnpj(emp.cnpj ?? "");
    setSegmento(emp.segmento ?? "");
    setSynced(true);
  }

  function toggleDia(key: string) {
    setDias((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  }

  async function uploadImagem(file: File, path: string): Promise<string | null> {
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens (JPG, PNG, WebP)."); return null; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5 MB."); return null; }
    const { error } = await supabase.storage
      .from("empresas")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro no upload da imagem.");
      return null;
    }
    const { data } = supabase.storage.from("empresas").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaId) return;
    if (!nome.trim()) { toast.error("Nome do estabelecimento é obrigatório"); return; }
    if (cnpjStatus(cnpj) === "invalido")   { toast.error("CNPJ inválido — verifique os números."); return; }
    if (cnpjStatus(cnpj) === "incompleto") { toast.error("CNPJ incompleto — preencha os 14 dígitos ou deixe em branco."); return; }
    setSaving(true);

    const updates: any = {
      nome_fantasia: nome.trim(),
      whatsapp: whatsapp.replace(/\D/g, ""),
      taxa_entrega: Number(taxa) || 0,
      tempo_entrega: tempo.trim() || "30-45 min",
      pedido_minimo: Number(minimo) || 0,
      horario_abertura: abertura,
      horario_fechamento: fechamento,
      dias_semana: dias.join(","),
      cor_primaria: cor,
      chave_pix: chavePix.trim() || null,
      tipo_chave_pix: tipoChavePix,
      nome_recebedor: nomeRecebedor.trim() || null,
      cidade_recebedor: cidadeRecebedor.trim() || null,
      zapi_instance: zapiInstance.trim() || null,
      zapi_token: zapiToken.trim() || null,
      zapi_client_token: zapiClientToken.trim() || null,
      cnpj: cnpj.replace(/\D/g, "").length === 14 ? cnpj.trim() : (cnpj.trim() || null),
      segmento: segmento || null,
    };

    const logoFile   = logoRef.current?.files?.[0];
    const bannerFile = bannerRef.current?.files?.[0];

    if (logoFile) {
      const ext = logoFile.name.split(".").pop() ?? "jpg";
      const url = await uploadImagem(logoFile, `${empresaId}/logo.${ext}`);
      if (url) {
        updates.logo_url = url;
      } else {
        setSaving(false);
        return; // aborta se upload falhou
      }
    }

    if (bannerFile) {
      const ext = bannerFile.name.split(".").pop() ?? "jpg";
      const url = await uploadImagem(bannerFile, `${empresaId}/banner.${ext}`);
      if (url) {
        updates.banner_url = url;
      } else {
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from("empresas")
      .update(updates)
      .eq("id", empresaId);

    if (error) {
      console.error("Update error:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
      setSaving(false);
      return;
    }

    toast.success("Configurações salvas com sucesso!");
    setLogoPreview(null);
    setBannerPreview(null);
    if (logoRef.current)   logoRef.current.value   = "";
    if (bannerRef.current) bannerRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["empresa-config", empresaId] });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  if (!empresa) return <div className="p-8 text-sm text-zinc-500">Carregando configurações…</div>;

  const logoSrc   = logoPreview   ?? empresa.logo_url   ?? null;
  const bannerSrc = bannerPreview ?? empresa.banner_url ?? null;

  return (
    <>
      <PageHeader title="Configurações" subtitle="Personalize seu cardápio digital" />

      <div className="max-w-2xl">
        <form onSubmit={salvar} className="space-y-8">

          {/* Identidade visual */}
          <section className="bg-background rounded-2xl ring-1 ring-black/5 p-6 space-y-5">
            <h2 className="font-semibold text-ink">Identidade visual</h2>

            <div className="grid sm:grid-cols-2 gap-5">
              {/* Logo */}
              <div className="space-y-2">
                <Label>Logo do estabelecimento</Label>
                <div
                  className={`border-2 border-dashed rounded-2xl h-36 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden relative bg-zinc-50 ${
                    logoPreview ? "border-brand" : "border-zinc-200 hover:border-brand/50"
                  }`}
                  onClick={() => logoRef.current?.click()}
                >
                  {logoSrc ? (
                    <>
                      <img src={logoSrc} alt="logo" className="w-full h-full object-contain p-2" />
                      {logoPreview && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Novo
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <Store className="size-8" />
                      <span className="text-xs">Clique para adicionar logo</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 size-7 rounded-full bg-brand text-white flex items-center justify-center shadow">
                    <ImagePlus className="size-3.5" />
                  </div>
                </div>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setLogoPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <p className="text-xs text-zinc-400">Recomendado: 400×400px, PNG</p>
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <Label>Banner (capa do cardápio)</Label>
                <div
                  className={`border-2 border-dashed rounded-2xl h-36 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden relative bg-zinc-50 ${
                    bannerPreview ? "border-brand" : "border-zinc-200 hover:border-brand/50"
                  }`}
                  onClick={() => bannerRef.current?.click()}
                >
                  {bannerSrc ? (
                    <>
                      <img src={bannerSrc} alt="banner" className="w-full h-full object-cover" />
                      {bannerPreview && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Novo
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <ImagePlus className="size-8" />
                      <span className="text-xs">Clique para adicionar banner</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 size-7 rounded-full bg-brand text-white flex items-center justify-center shadow">
                    <ImagePlus className="size-3.5" />
                  </div>
                </div>
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setBannerPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <p className="text-xs text-zinc-400">Recomendado: 1200×300px, formato horizontal</p>
              </div>
            </div>

            {/* Cor da marca */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Palette className="size-4 text-zinc-400" /> Cor principal da marca</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-12 h-10 rounded-xl border border-zinc-200 cursor-pointer p-0.5 bg-white"
                />
                <span className="font-mono text-sm text-zinc-600 bg-zinc-100 px-3 py-2 rounded-xl">{cor}</span>
                <span className="text-xs text-zinc-400">Aparece no botão "Adicionar ao carrinho" e destaques do cardápio</span>
              </div>
              <div className="flex gap-2 mt-1">
                {["#F97316","#EF4444","#8B5CF6","#3B82F6","#10B981","#F59E0B","#EC4899"].map((c) => (
                  <button key={c} type="button" onClick={() => setCor(c)}
                    className={`size-6 rounded-full border-2 transition-all ${cor === c ? "border-zinc-900 scale-110" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </section>

          {/* Informações gerais */}
          <section className="bg-background rounded-2xl ring-1 ring-black/5 p-6 space-y-4">
            <h2 className="font-semibold text-ink">Informações gerais</h2>

            <div className="space-y-1.5">
              <Label htmlFor="nome_fantasia">Nome do estabelecimento</Label>
              <Input id="nome_fantasia" value={nome} onChange={(e) => setNome(e.target.value)}
                required className="h-10 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="segmento">Segmento</Label>
              <select
                id="segmento"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Selecione o segmento</option>
                <option value="pizzaria">🍕 Pizzaria</option>
                <option value="hamburgueria">🍔 Hamburgueria</option>
                <option value="sushi">🍣 Sushi</option>
                <option value="acai">🍧 Açaí</option>
                <option value="marmita">🍱 Marmitaria</option>
                <option value="lanchonete">🥪 Lanchonete</option>
                <option value="confeitaria">🍰 Confeitaria</option>
                <option value="restaurante">🍽️ Restaurante</option>
                <option value="outro">🍴 Outro</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp (com DDD, sem espaços)</Label>
              <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: 66981289787" className="h-10 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ <span className="text-zinc-400 font-normal">(opcional)</span></Label>
              <div className="relative">
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(mascaraCNPJ(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  className={`h-10 rounded-xl font-mono pr-10 ${
                    cnpjStatus(cnpj) === "invalido"   ? "border-red-300" :
                    cnpjStatus(cnpj) === "valido"     ? "border-green-400" : ""
                  }`}
                  maxLength={18}
                />
                {cnpjStatus(cnpj) === "valido" && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500 pointer-events-none" />
                )}
                {cnpjStatus(cnpj) === "invalido" && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-red-400 pointer-events-none" />
                )}
              </div>
              {cnpjStatus(cnpj) === "invalido" && (
                <p className="text-xs text-red-500">CNPJ inválido — verifique os números.</p>
              )}
              {cnpjStatus(cnpj) === "valido" && (
                <p className="text-xs text-green-600">✓ CNPJ válido</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="taxa">Taxa de entrega (R$)</Label>
                <Input id="taxa" type="number" step="0.01" value={taxa}
                  onChange={(e) => setTaxa(e.target.value)} className="h-10 rounded-xl"
                  placeholder="0 = grátis" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minimo">Pedido mínimo (R$)</Label>
                <Input id="minimo" type="number" step="0.01" value={minimo}
                  onChange={(e) => setMinimo(e.target.value)} className="h-10 rounded-xl"
                  placeholder="0 = sem mínimo" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tempo">Tempo de entrega estimado</Label>
              <Input id="tempo" value={tempo} onChange={(e) => setTempo(e.target.value)}
                placeholder="Ex: 30-45 min" className="h-10 rounded-xl" />
              <p className="text-xs text-zinc-400">Mostrado no cardápio público (ex: "30-45 min")</p>
            </div>
          </section>

          {/* Horário de funcionamento */}
          <section className="bg-background rounded-2xl ring-1 ring-black/5 p-6 space-y-4">
            <h2 className="font-semibold text-ink">Horário de funcionamento</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="abertura">Abre às</Label>
                <Input id="abertura" type="time" value={abertura}
                  onChange={(e) => setAbertura(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechamento">Fecha às</Label>
                <Input id="fechamento" type="time" value={fechamento}
                  onChange={(e) => setFechamento(e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias de funcionamento</Label>
              <div className="flex gap-2 flex-wrap">
                {DIAS_LISTA.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDia(key)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      dias.includes(key)
                        ? "bg-brand border-brand text-white"
                        : "bg-white border-zinc-200 text-zinc-500 hover:border-brand/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400">
                Aparece no cardápio como <strong>"Aberto · Fecha às {fechamento}"</strong> ou <strong>"Fechado · Abre às {abertura}"</strong>
              </p>
            </div>
          </section>

          {/* PIX */}
          <section className="bg-background rounded-2xl ring-1 ring-black/5 p-6 space-y-4">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <QrCode className="size-4 text-zinc-400" /> Recebimento via PIX
            </h2>
            <p className="text-xs text-zinc-500 -mt-1">Configure sua chave PIX para que o sistema gere um QR code de pagamento no momento do pedido.</p>

            <div className="space-y-1.5">
              <Label htmlFor="tipo_pix">Tipo da chave</Label>
              <select
                id="tipo_pix"
                value={tipoChavePix}
                onChange={(e) => setTipoChavePix(e.target.value)}
                className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="aleatoria">Chave aleatória</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="telefone">Telefone (+55...)</option>
                <option value="email">E-mail</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chave_pix">Chave PIX</Label>
              <Input
                id="chave_pix"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder={tipoChavePix === "aleatoria" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : tipoChavePix === "telefone" ? "+5511999999999" : tipoChavePix === "email" ? "email@exemplo.com" : "Somente números"}
                className="h-10 rounded-xl font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome_recebedor">Nome do recebedor</Label>
                <Input id="nome_recebedor" value={nomeRecebedor} onChange={(e) => setNomeRecebedor(e.target.value)}
                  placeholder="Aparece no QR code" className="h-10 rounded-xl" maxLength={25} />
                <p className="text-[11px] text-zinc-400">Máx 25 caracteres</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade_recebedor">Cidade</Label>
                <Input id="cidade_recebedor" value={cidadeRecebedor} onChange={(e) => setCidadeRecebedor(e.target.value)}
                  placeholder="Ex: Cuiabá" className="h-10 rounded-xl" maxLength={15} />
                <p className="text-[11px] text-zinc-400">Máx 15 caracteres</p>
              </div>
            </div>

            {chavePix && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <span className="size-2 rounded-full bg-green-500" />
                <span className="text-sm text-green-700 font-medium">PIX configurado — clientes verão o QR code ao pagar</span>
              </div>
            )}
          </section>

          {/* Z-API — Notificações automáticas WhatsApp */}
          <section className="bg-background rounded-2xl ring-1 ring-black/5 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink flex items-center gap-2">
                  <Bot className="size-4 text-green-600" /> Notificações automáticas WhatsApp
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Conecte via <strong>Z-API</strong> para enviar mensagens automáticas ao cliente quando o status do pedido mudar.
                </p>
              </div>
              <a href="https://z-api.io" target="_blank" rel="noreferrer"
                className="shrink-0 text-xs font-semibold text-green-600 hover:underline border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg">
                Criar conta Z-API →
              </a>
            </div>

            <div className="bg-zinc-50 rounded-xl p-4 text-xs text-zinc-500 space-y-1 border border-zinc-100">
              <p className="font-semibold text-zinc-700">Como configurar:</p>
              <p>1. Crie uma conta em <strong>z-api.io</strong> (tem plano grátis para teste)</p>
              <p>2. Crie uma instância e conecte seu WhatsApp pelo QR code</p>
              <p>3. Copie o <strong>Instance ID</strong>, <strong>Token</strong> e <strong>Client-Token</strong> abaixo</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zapi_instance">Instance ID</Label>
              <Input id="zapi_instance" value={zapiInstance} onChange={(e) => setZapiInstance(e.target.value)}
                placeholder="Ex: 3D881C1D..." className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zapi_token">Token</Label>
              <Input id="zapi_token" value={zapiToken} onChange={(e) => setZapiToken(e.target.value)}
                placeholder="Token da instância" className="h-10 rounded-xl font-mono" type="password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zapi_client_token">Client-Token <span className="text-zinc-400 font-normal">(segurança — aba Security da Z-API)</span></Label>
              <Input id="zapi_client_token" value={zapiClientToken} onChange={(e) => setZapiClientToken(e.target.value)}
                placeholder="F2C7..." className="h-10 rounded-xl font-mono" type="password" />
            </div>

            {zapiInstance && zapiToken && (
              <button
                type="button"
                disabled={zapiTestando}
                onClick={async () => {
                  setZapiTestando(true);
                  try {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (zapiClientToken) headers["Client-Token"] = zapiClientToken;
                    const res = await fetch(
                      `https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/status`,
                      { method: "GET", headers }
                    );
                    const data = await res.json();
                    if (data?.connected || data?.status === "CONNECTED") {
                      toast.success("✅ Z-API conectada e funcionando!");
                    } else {
                      toast.error(`Instância não conectada. Status: ${data?.status ?? "desconhecido"}. Verifique o QR code na Z-API.`);
                    }
                  } catch {
                    toast.error("Erro ao conectar com Z-API. Verifique as credenciais.");
                  }
                  setZapiTestando(false);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-zinc-700 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <FlaskConical className="size-4" />
                {zapiTestando ? "Testando…" : "Testar conexão"}
              </button>
            )}

            {zapiInstance && zapiToken && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <Bot className="size-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">Robô ativo — clientes serão notificados automaticamente</span>
              </div>
            )}
          </section>

          {/* Link do cardápio */}
          <section className="bg-brand/5 border border-brand/20 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Seu cardápio digital</div>
              <div className="text-xs text-zinc-500 mt-0.5 font-mono">{window.location.origin}/loja/{empresa.slug}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => { await copiarTexto(`${window.location.origin}/loja/${empresa.slug}`) ? toast.success("Link copiado!") : toast.error("Não foi possível copiar."); }}
                className="text-xs font-semibold bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand/90 transition-colors"
              >
                Copiar link
              </button>
              <a href={`/loja/${empresa.slug}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-brand text-sm font-medium hover:underline">
                Abrir <ExternalLink className="size-3.5" />
              </a>
            </div>
          </section>

          <Button type="submit" disabled={saving} className="bg-brand hover:bg-brand/90 px-8 gap-2">
            {saving ? "Salvando…" : saved ? <><CheckCircle2 className="size-4" /> Salvo!</> : "Salvar configurações"}
          </Button>
        </form>
      </div>
    </>
  );
}
