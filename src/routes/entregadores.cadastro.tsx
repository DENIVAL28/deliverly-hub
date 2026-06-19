import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Car, ChevronLeft, ChevronRight, Upload, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/entregadores/cadastro")({
  component: EntregadoresCadastro,
});

// ── Validações ────────────────────────────────────────────────
function validarCPF(cpf: string): boolean {
  const s = cpf.replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  const calc = (len: number) =>
    s.split("").slice(0, len).reduce((acc, d, i) => acc + +d * (len + 1 - i), 0);
  const r1 = calc(9) % 11;
  const r2 = calc(10) % 11;
  return +s[9] === (r1 < 2 ? 0 : 11 - r1) && +s[10] === (r2 < 2 ? 0 : 11 - r2);
}

function validarPlaca(placa: string): boolean {
  const s = placa.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(s);
}

function validarCNH(cnh: string): boolean {
  const s = cnh.replace(/\D/g, "");
  return s.length === 11;
}

// ── Tipos ─────────────────────────────────────────────────────
type Modalidade = "moto" | "carro" | "bicicleta";

interface FormData {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  confirmaSenha: string;
  whatsapp: string;
  cidade: string;
  modalidade: Modalidade | "";
  cnh: string;
  placa: string;
  modeloVeiculo: string;
  corVeiculo: string;
  fotoRostoFile: File | null;
  fotoRostoUrl: string;
  termosAceitos: boolean;
}

const ETAPAS = [
  "Dados Pessoais",
  "Modalidade",
  "Validação",
  "Foto do Rosto",
  "Termos",
];

const TERMOS_TEXTO = `O entregador declara atuar de forma autônoma, sendo responsável por seus dados, documentos, veículo, conduta profissional e cumprimento das leis de trânsito.

O Delivery Hub atua apenas como plataforma tecnológica para facilitar a comunicação entre estabelecimentos, clientes e entregadores. Não existe vínculo empregatício entre o Delivery Hub e o entregador.

O entregador é responsável pelas entregas que aceitar realizar. O valor da entrega será definido pelo estabelecimento, cabendo ao entregador aceitar ou recusar a corrida.

O entregador deve tratar clientes e estabelecimentos com respeito, responsabilidade e boa comunicação.

O Delivery Hub poderá bloquear ou remover entregadores em caso de uso indevido, informações falsas ou má conduta.`;

function EntregadoresCadastro() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    nome: "", cpf: "", email: "", senha: "", confirmaSenha: "",
    whatsapp: "", cidade: "", modalidade: "",
    cnh: "", placa: "", modeloVeiculo: "", corVeiculo: "",
    fotoRostoFile: null, fotoRostoUrl: "", termosAceitos: false,
  });

  const set = (key: keyof FormData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Validação por etapa ────────────────────────────────────
  function validarEtapaAtual(): string | null {
    switch (etapa) {
      case 0:
        if (!form.nome.trim()) return "Nome obrigatório";
        if (!validarCPF(form.cpf)) return "CPF inválido";
        if (!form.email.includes("@")) return "E-mail inválido";
        if (form.senha.length < 8) return "Senha mínima de 8 caracteres";
        if (form.senha !== form.confirmaSenha) return "Senhas não coincidem";
        if (!form.whatsapp.replace(/\D/g, "").match(/^\d{10,11}$/)) return "WhatsApp inválido";
        if (!form.cidade.trim()) return "Cidade obrigatória";
        return null;
      case 1:
        if (!form.modalidade) return "Escolha uma modalidade";
        return null;
      case 2:
        if (form.modalidade !== "bicicleta") {
          if (!validarCNH(form.cnh)) return "CNH deve ter 11 dígitos numéricos";
          if (!validarPlaca(form.placa)) return "Placa inválida (ex: ABC1234 ou ABC1D23)";
        }
        return null;
      case 3:
        if (!form.fotoRostoUrl) return "Foto do rosto obrigatória";
        return null;
      case 4:
        if (!form.termosAceitos) return "Aceite os termos para continuar";
        return null;
    }
    return null;
  }

  function avancar() {
    const erro = validarEtapaAtual();
    if (erro) { toast.error(erro); return; }
    if (etapa < ETAPAS.length - 1) setEtapa((e) => e + 1);
  }

  // ── Upload de foto ─────────────────────────────────────────
  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5 MB"); return; }
    const preview = URL.createObjectURL(file);
    set("fotoRostoFile", file);
    set("fotoRostoUrl", preview);
  }

  // ── Submit final ───────────────────────────────────────────
  async function handleSubmit() {
    const erro = validarEtapaAtual();
    if (erro) { toast.error(erro); return; }
    setSalvando(true);

    try {
      // 1. Criar conta Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.senha,
        options: { data: { nome: form.nome.trim() } },
      });
      if (authError) {
        toast.error(authError.message === "User already registered"
          ? "E-mail já cadastrado. Faça login."
          : authError.message);
        return;
      }
      const userId = authData.user?.id;
      if (!userId) { toast.error("Erro ao criar conta. Tente novamente."); return; }

      // 2. Upload foto de rosto
      let fotoUrl: string | null = null;
      if (form.fotoRostoFile) {
        const ext = form.fotoRostoFile.name.split(".").pop() ?? "jpg";
        const path = `${userId}/rosto_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("entregadores")
          .upload(path, form.fotoRostoFile, { upsert: true });
        if (uploadErr) {
          toast.error("Falha ao enviar a foto. Verifique sua conexão e tente novamente.");
          return;
        }
        const { data: pub } = supabase.storage.from("entregadores").getPublicUrl(path);
        fotoUrl = pub.publicUrl;
      }

      // 3. Inserir registro na tabela entregadores
      const cpfLimpo = form.cpf.replace(/\D/g, "");
      const { error: insertError } = await (supabase as any).from("entregadores").insert({
        auth_user_id:    userId,
        empresa_id:      null,
        nome:            form.nome.trim(),
        email:           form.email.trim().toLowerCase(),
        telefone:        form.whatsapp.trim(),
        cidade:          form.cidade.trim(),
        cpf:             cpfLimpo,
        cnh:             form.modalidade !== "bicicleta" ? form.cnh.replace(/\D/g, "") : null,
        placa:           form.modalidade !== "bicicleta" ? form.placa.toUpperCase().replace(/\s/g, "") : null,
        modelo_veiculo:  form.modeloVeiculo.trim() || null,
        cor_veiculo:     form.corVeiculo.trim() || null,
        foto_rosto_url:  fotoUrl,
        veiculo:         form.modalidade,
        tipo:            "freelancer",
        aprovado:        false,
        status_cadastro: "aguardando_analise",
        verificado:      false,
      });

      if (insertError) {
        if (insertError.message?.includes("cpf")) {
          toast.error("CPF já cadastrado na plataforma.");
        } else {
          toast.error("Erro ao salvar cadastro: " + insertError.message);
        }
        await supabase.auth.signOut();
        return;
      }

      // 4. Registrar aceite de termos
      const { data: entRow } = await (supabase as any)
        .from("entregadores")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (entRow?.id) {
        await (supabase as any).from("entregador_termos_aceite").insert({
          entregador_id: entRow.id,
          versao_termo:  "1.0",
        });
      }

      toast.success("Cadastro realizado! Aguarde a análise da plataforma.");
      navigate({ to: "/entregadores/painel", replace: true });
    } finally {
      setSalvando(false);
    }
  }

  // ── Renderização ──────────────────────────────────────────
  const progresso = ((etapa + 1) / ETAPAS.length) * 100;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-extrabold text-white">Criar Cadastro</h1>
          <p className="text-xs text-zinc-500">
            Etapa {etapa + 1} de {ETAPAS.length} — {ETAPAS[etapa]}
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* Conteúdo da etapa */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          {etapa === 0 && <EtapaDadosPessoais form={form} set={set} mostrarSenha={mostrarSenha} setMostrarSenha={setMostrarSenha} />}
          {etapa === 1 && <EtapaModalidade form={form} set={set} />}
          {etapa === 2 && <EtapaValidacao form={form} set={set} />}
          {etapa === 3 && <EtapaFoto form={form} fileInputRef={fileInputRef} handleFoto={handleFoto} />}
          {etapa === 4 && <EtapaTermos form={form} set={set} />}
        </div>

        {/* Botões de navegação */}
        <div className="flex gap-3">
          <button
            onClick={() => etapa === 0 ? navigate({ to: "/entregadores" }) : setEtapa((e) => e - 1)}
            className="flex items-center gap-1 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition"
          >
            <ChevronLeft className="size-4" /> Voltar
          </button>
          {etapa < ETAPAS.length - 1 ? (
            <button
              onClick={avancar}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold transition"
            >
              Próximo <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={salvando || !form.termosAceitos}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-bold transition"
            >
              {salvando ? "Enviando…" : <><CheckCircle2 className="size-4" /> Finalizar Cadastro</>}
            </button>
          )}
        </div>

        {etapa === 0 && (
          <p className="text-center text-xs text-zinc-600">
            Já tem cadastro?{" "}
            <Link to="/entregadores/login" className="text-orange-400 hover:underline">
              Fazer login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes por etapa ─────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition";

function EtapaDadosPessoais({ form, set, mostrarSenha, setMostrarSenha }: any) {
  return (
    <>
      <Campo label="Nome completo">
        <input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome completo" />
      </Campo>
      <Campo label="CPF">
        <input className={inputCls} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" maxLength={14} />
      </Campo>
      <Campo label="E-mail">
        <input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="seu@email.com" />
      </Campo>
      <Campo label="WhatsApp">
        <input className={inputCls} type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(66) 99999-9999" />
      </Campo>
      <Campo label="Cidade">
        <input className={inputCls} value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Sua cidade" />
      </Campo>
      <Campo label="Senha (mín. 8 caracteres)">
        <div className="relative">
          <input
            className={`${inputCls} pr-11`}
            type={mostrarSenha ? "text" : "password"}
            value={form.senha}
            onChange={(e) => set("senha", e.target.value)}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setMostrarSenha((v: boolean) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
            {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Campo>
      <Campo label="Confirmar Senha">
        <input className={inputCls} type="password" value={form.confirmaSenha} onChange={(e) => set("confirmaSenha", e.target.value)} placeholder="••••••••" />
      </Campo>
    </>
  );
}

function EtapaModalidade({ form, set }: any) {
  const opcoes: { value: Modalidade; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: "moto",      label: "Moto",      icon: "🏍️", desc: "CNH + placa obrigatórios" },
    { value: "carro",     label: "Carro",     icon: "🚗", desc: "CNH + placa obrigatórios" },
    { value: "bicicleta", label: "Bicicleta", icon: "🚲", desc: "Apenas CPF e foto" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">Escolha seu principal meio de transporte:</p>
      {opcoes.map((op) => (
        <button
          key={op.value}
          type="button"
          onClick={() => set("modalidade", op.value)}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
            form.modalidade === op.value
              ? "border-orange-500 bg-orange-500/10"
              : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
          }`}
        >
          <span className="text-3xl">{op.icon}</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{op.label}</p>
            <p className="text-xs text-zinc-400">{op.desc}</p>
          </div>
          {form.modalidade === op.value && (
            <CheckCircle2 className="size-5 text-orange-500 ml-auto shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

function EtapaValidacao({ form, set }: any) {
  if (form.modalidade === "bicicleta") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">Para bicicleta, os dados do veículo são opcionais.</p>
        <Campo label="Modelo da bicicleta (opcional)">
          <input className={inputCls} value={form.modeloVeiculo} onChange={(e) => set("modeloVeiculo", e.target.value)} placeholder="Ex: Caloi, Schwinn" />
        </Campo>
        <Campo label="Cor (opcional)">
          <input className={inputCls} value={form.corVeiculo} onChange={(e) => set("corVeiculo", e.target.value)} placeholder="Ex: Azul" />
        </Campo>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        {form.modalidade === "moto" ? "🏍️ Moto" : "🚗 Carro"} — preencha os dados do veículo:
      </p>
      <Campo label="Número da CNH (11 dígitos)">
        <input
          className={inputCls}
          value={form.cnh}
          onChange={(e) => set("cnh", e.target.value.replace(/\D/g, ""))}
          placeholder="00000000000"
          maxLength={11}
        />
      </Campo>
      <Campo label="Placa do veículo">
        <input
          className={inputCls}
          value={form.placa}
          onChange={(e) => set("placa", e.target.value.toUpperCase())}
          placeholder="ABC1234 ou ABC1D23"
          maxLength={7}
        />
      </Campo>
      <Campo label="Modelo">
        <input className={inputCls} value={form.modeloVeiculo} onChange={(e) => set("modeloVeiculo", e.target.value)} placeholder={`Ex: Honda CG 160`} />
      </Campo>
      <Campo label="Cor">
        <input className={inputCls} value={form.corVeiculo} onChange={(e) => set("corVeiculo", e.target.value)} placeholder="Ex: Preto" />
      </Campo>
    </div>
  );
}

function EtapaFoto({ form, fileInputRef, handleFoto }: any) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-white mb-1">Foto do seu rosto</p>
        <p className="text-xs text-zinc-400">Usada para verificação da sua identidade pela plataforma. Máx. 5 MB.</p>
      </div>

      {form.fotoRostoUrl ? (
        <div className="space-y-3">
          <img
            src={form.fotoRostoUrl}
            alt="Preview"
            className="w-36 h-36 object-cover rounded-2xl border-2 border-orange-500 mx-auto block"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
          >
            Trocar foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-orange-500 hover:bg-orange-500/5 transition-all"
        >
          <Upload className="size-8 text-zinc-500" />
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-300">Toque para enviar foto</p>
            <p className="text-xs text-zinc-600">JPG, PNG ou WebP</p>
          </div>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFoto}
      />
    </div>
  );
}

function EtapaTermos({ form, set }: any) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-white">Termo de Responsabilidade</p>
      <div className="bg-zinc-800 rounded-xl p-4 max-h-52 overflow-y-auto">
        <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{TERMOS_TEXTO}</p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
            form.termosAceitos ? "bg-orange-500 border-orange-500" : "border-zinc-600 group-hover:border-orange-500"
          }`}
          onClick={() => set("termosAceitos", !form.termosAceitos)}
        >
          {form.termosAceitos && <CheckCircle2 className="size-3 text-white" />}
        </div>
        <span className="text-xs text-zinc-300 leading-relaxed" onClick={() => set("termosAceitos", !form.termosAceitos)}>
          Li e aceito os Termos de Responsabilidade do Entregador Delivery Hub.
        </span>
      </label>
    </div>
  );
}
