import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireEntregador, type EntregadorData } from "@/lib/entregador-auth";
import { ChevronLeft, Upload, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entregadores/perfil")({
  ssr: false,
  beforeLoad: () => requireEntregador(),
  component: PerfilPage,
});

const TIPO_PIX = [
  { value: "aleatoria", label: "Chave aleatória" },
  { value: "cpf",       label: "CPF" },
  { value: "telefone",  label: "Telefone" },
  { value: "email",     label: "E-mail" },
];

const inputCls = "w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition";

function PerfilPage() {
  const { entregador } = Route.useRouteContext() as { entregador: EntregadorData };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome]           = useState(entregador.nome ?? "");
  const [telefone, setTelefone]   = useState(entregador.telefone ?? "");
  const [chavePix, setChavePix]   = useState(entregador.chave_pix ?? "");
  const [tipoPix, setTipoPix]     = useState(entregador.tipo_chave_pix ?? "aleatoria");
  const [fotoUrl, setFotoUrl]     = useState(entregador.foto_rosto_url ?? "");
  const [fotoFile, setFotoFile]   = useState<File | null>(null);
  const [salvando, setSalvando]   = useState(false);

  const [novaSenha, setNovaSenha]           = useState("");
  const [confirmaSenha, setConfirmaSenha]   = useState("");
  const [mostrarSenha, setMostrarSenha]     = useState(false);
  const [trocandoSenha, setTrocandoSenha]   = useState(false);

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Apenas imagens"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máx 5 MB"); return; }
    setFotoFile(file);
    setFotoUrl(URL.createObjectURL(file));
  }

  async function salvar() {
    setSalvando(true);
    try {
      let novaFotoUrl = fotoUrl;

      if (fotoFile) {
        const { data: { user } } = await supabase.auth.getUser();
        const ext = fotoFile.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/rosto_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("entregadores").upload(path, fotoFile, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from("entregadores").getPublicUrl(path);
          novaFotoUrl = data.publicUrl;
        }
      }

      const { error } = await (supabase as any)
        .from("entregadores")
        .update({
          nome:           nome.trim(),
          telefone:       telefone.trim(),
          chave_pix:      chavePix.trim() || null,
          tipo_chave_pix: chavePix.trim() ? tipoPix : null,
          foto_rosto_url: novaFotoUrl || null,
        })
        .eq("id", entregador.id);

      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Perfil atualizado!");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha() {
    if (novaSenha.length < 8) { toast.error("Senha mínima de 8 caracteres"); return; }
    if (novaSenha !== confirmaSenha) { toast.error("Senhas não coincidem"); return; }
    setTrocandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) { toast.error(error.message); return; }
      toast.success("Senha alterada com sucesso!");
      setNovaSenha("");
      setConfirmaSenha("");
    } finally {
      setTrocandoSenha(false);
    }
  }

  const veiculoLabel: Record<string, string> = { moto: "🏍️ Moto", carro: "🚗 Carro", bicicleta: "🚲 Bicicleta" };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="bg-orange-500 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/entregadores/painel" className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold text-orange-100 uppercase">Perfil</p>
            <h1 className="text-lg font-extrabold">{entregador.nome}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Foto */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Foto do rosto</h2>
          <div className="flex items-center gap-4">
            {fotoUrl ? (
              <img src={fotoUrl} alt="Foto" className="w-20 h-20 rounded-2xl object-cover border-2 border-orange-500 shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center shrink-0 text-2xl">
                🧑
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-semibold text-zinc-300 transition"
            >
              <Upload className="size-4" /> Trocar foto
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFoto} />
          </div>
        </section>

        {/* Dados pessoais */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Dados pessoais</h2>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Nome</label>
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase">WhatsApp</label>
            <input className={inputCls} type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          {/* Campos somente leitura */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Modalidade</label>
              <p className="text-sm text-zinc-300 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
                {veiculoLabel[entregador.veiculo ?? ""] ?? entregador.veiculo ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">CPF</label>
              <p className="text-sm text-zinc-500 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
                {entregador.cpf ? `***.***.${entregador.cpf.slice(-5)}` : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* PIX */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Chave PIX</h2>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Tipo</label>
            <select className={inputCls} value={tipoPix} onChange={(e) => setTipoPix(e.target.value)}>
              {TIPO_PIX.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Chave</label>
            <input
              className={inputCls}
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder={tipoPix === "aleatoria" ? "xxxxxxxx-xxxx-..." : tipoPix === "cpf" ? "000.000.000-00" : tipoPix === "telefone" ? "(66) 99999-9999" : "email@email.com"}
            />
          </div>
        </section>

        {/* Botão salvar */}
        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white text-sm font-bold transition"
        >
          <Save className="size-4" />
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>

        {/* Trocar senha */}
        <section className="space-y-3 pt-2 border-t border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Alterar senha</h2>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Nova senha</label>
            <div className="relative">
              <input
                className={`${inputCls} pr-11`}
                type={mostrarSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Confirmar nova senha</label>
            <input className={inputCls} type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} placeholder="Repita a senha" />
          </div>
          <button
            onClick={trocarSenha}
            disabled={trocandoSenha || !novaSenha}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm font-bold transition"
          >
            {trocandoSenha ? "Alterando…" : "Alterar senha"}
          </button>
        </section>
      </div>
    </div>
  );
}
