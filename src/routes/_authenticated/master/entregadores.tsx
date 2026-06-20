import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/master/entregadores")({
  component: MasterEntregadoresPage,
});

type Filtro = "aguardando_analise" | "em_analise" | "aprovado" | "recusado" | "bloqueado" | "todos";

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  cadastro_incompleto: { label: "Incompleto",  bg: "bg-zinc-100",   text: "text-zinc-600"  },
  aguardando_analise:  { label: "Aguardando",  bg: "bg-blue-100",   text: "text-blue-700"  },
  em_analise:          { label: "Em análise",  bg: "bg-yellow-100", text: "text-yellow-700"},
  aprovado:            { label: "Aprovado",    bg: "bg-green-100",  text: "text-green-700" },
  recusado:            { label: "Recusado",    bg: "bg-red-100",    text: "text-red-700"   },
  bloqueado:           { label: "Bloqueado",   bg: "bg-red-100",    text: "text-red-700"   },
};

const VEICULO_LABEL: Record<string, string> = {
  moto: "🏍️ Moto", carro: "🚗 Carro", bicicleta: "🚲 Bicicleta",
};

const MOTIVOS_COMUNS = [
  "CPF inválido",
  "CNH inválida",
  "Placa inválida",
  "Dados incompletos",
  "Foto do rosto não enviada",
  "Informações inconsistentes",
  "Outro motivo",
];

function MasterEntregadoresPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("aguardando_analise");
  const [modalRecusa, setModalRecusa] = useState<{ id: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<any | null>(null);

  const { data: entregadores = [], isLoading, error: queryError } = useQuery({
    queryKey: ["master-entregadores", filtro],
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregadores")
        .select("id, nome, email, cpf, cnh, placa, veiculo, modelo_veiculo, cor_veiculo, cidade, telefone, foto_rosto_url, status_cadastro, verificado, motivo_recusa, created_at, empresa_id")
        .order("created_at", { ascending: false });

      if (filtro !== "todos") {
        q = q.eq("status_cadastro", filtro);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function validar(id: string, status: string, motivoTexto?: string) {
    setProcessando(id);
    try {
      const { data } = await supabase.rpc("master_validar_entregador", {
        p_id:     id,
        p_status: status,
        p_motivo: motivoTexto ?? null,
      });
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      toast.success(status === "aprovado" ? "Entregador aprovado!" : status === "em_analise" ? "Marcado como em análise" : "Cadastro recusado");
      setModalRecusa(null);
      setMotivo("");
      setMotivoCustom("");
      qc.invalidateQueries({ queryKey: ["master-entregadores"] });
    } finally {
      setProcessando(null);
    }
  }

  function abrirRecusa(e: any) {
    setModalRecusa({ id: e.id, nome: e.nome });
    setMotivo("");
    setMotivoCustom("");
  }

  function confirmarRecusa() {
    if (!modalRecusa) return;
    const textoFinal = motivo === "Outro motivo" ? motivoCustom.trim() : motivo;
    if (!textoFinal) { toast.error("Informe o motivo"); return; }
    validar(modalRecusa.id, "recusado", textoFinal);
  }

  const FILTROS: { value: Filtro; label: string; count?: number }[] = [
    { value: "aguardando_analise", label: "Aguardando" },
    { value: "em_analise",         label: "Em análise" },
    { value: "aprovado",           label: "Aprovados" },
    { value: "recusado",           label: "Recusados" },
    { value: "bloqueado",          label: "Bloqueados" },
    { value: "todos",              label: "Todos" },
  ];

  return (
    <>
      <PageHeader title="Entregadores da Plataforma" />

      <div className="p-6 space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition ${
                filtro === f.value
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-sm text-zinc-500 py-8 text-center">Carregando…</div>
        )}

        {queryError && (
          <div className="text-sm text-red-600 py-8 text-center bg-red-50 rounded-xl px-4">
            Erro ao carregar: {String((queryError as any)?.message ?? queryError)}
          </div>
        )}

        {!isLoading && !queryError && entregadores.length === 0 && (
          <div className="text-sm text-zinc-400 py-12 text-center">
            Nenhum entregador {filtro !== "todos" ? "com esse status" : "cadastrado"}.
          </div>
        )}

        <div className="grid gap-4">
          {entregadores.map((e: any) => {
            const meta = STATUS_META[e.status_cadastro] ?? STATUS_META.aguardando_analise;
            return (
              <div key={e.id} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start gap-4">
                  {e.foto_rosto_url ? (
                    <img
                      src={e.foto_rosto_url}
                      alt={e.nome}
                      className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center shrink-0">
                      <User className="size-6 text-zinc-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-zinc-900">{e.nome}</p>
                      {e.verificado && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Verificado</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                    </div>
                    {e.email && <p className="text-xs text-zinc-500 mt-0.5">{e.email}</p>}
                    {e.empresa_id && (
                      <p className="text-xs font-semibold text-orange-500 mt-0.5">🏪 Via link de empresa</p>
                    )}
                    <p className="text-xs text-zinc-400">{VEICULO_LABEL[e.veiculo] ?? e.veiculo}{e.cidade ? ` · ${e.cidade}` : ""}</p>
                  </div>
                  <button
                    onClick={() => setDetalhe(detalhe?.id === e.id ? null : e)}
                    className="text-xs text-orange-500 hover:underline shrink-0"
                  >
                    {detalhe?.id === e.id ? "Fechar" : "Ver dados"}
                  </button>
                </div>

                {/* Dados expandidos */}
                {detalhe?.id === e.id && (
                  <div className="bg-zinc-50 rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div><span className="font-semibold text-zinc-500">CPF:</span> <span className="text-zinc-700">{e.cpf ?? "—"}</span></div>
                    <div><span className="font-semibold text-zinc-500">CNH:</span> <span className="text-zinc-700">{e.cnh ?? "—"}</span></div>
                    <div><span className="font-semibold text-zinc-500">Placa:</span> <span className="text-zinc-700">{e.placa ?? "—"}</span></div>
                    <div><span className="font-semibold text-zinc-500">Modelo:</span> <span className="text-zinc-700">{e.modelo_veiculo ?? "—"}</span></div>
                    <div><span className="font-semibold text-zinc-500">Cor:</span> <span className="text-zinc-700">{e.cor_veiculo ?? "—"}</span></div>
                    <div><span className="font-semibold text-zinc-500">WhatsApp:</span> <span className="text-zinc-700">{e.telefone ?? "—"}</span></div>
                    {e.motivo_recusa && (
                      <div className="col-span-2">
                        <span className="font-semibold text-red-500">Motivo recusa:</span>{" "}
                        <span className="text-red-600">{e.motivo_recusa}</span>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="font-semibold text-zinc-500">Cadastrado em:</span>{" "}
                      <span className="text-zinc-700">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                )}

                {/* Ações */}
                {e.status_cadastro !== "aprovado" && e.status_cadastro !== "bloqueado" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      disabled={processando === e.id}
                      onClick={() => validar(e.id, "aprovado")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-xs font-bold transition"
                    >
                      <CheckCircle2 className="size-3.5" /> Aprovar
                    </button>
                    {e.status_cadastro !== "em_analise" && (
                      <button
                        disabled={processando === e.id}
                        onClick={() => validar(e.id, "em_analise")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-white text-xs font-bold transition"
                      >
                        <RefreshCw className="size-3.5" /> Marcar em análise
                      </button>
                    )}
                    <button
                      disabled={processando === e.id}
                      onClick={() => abrirRecusa(e)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold transition"
                    >
                      <XCircle className="size-3.5" /> Recusar
                    </button>
                  </div>
                )}

                {e.status_cadastro === "aprovado" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={processando === e.id}
                      onClick={() => validar(e.id, "bloqueado", "Bloqueado pelo administrador")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 disabled:opacity-60 text-red-700 text-xs font-bold transition"
                    >
                      <AlertTriangle className="size-3.5" /> Bloquear
                    </button>
                  </div>
                )}

                {e.status_cadastro === "bloqueado" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={processando === e.id}
                      onClick={() => validar(e.id, "aprovado")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-100 hover:bg-green-200 disabled:opacity-60 text-green-700 text-xs font-bold transition"
                    >
                      <CheckCircle2 className="size-3.5" /> Desbloquear
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de recusa */}
      {modalRecusa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-zinc-900">Recusar cadastro de {modalRecusa.nome}</h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Motivo</label>
              <div className="space-y-1.5">
                {MOTIVOS_COMUNS.map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="motivo"
                      value={m}
                      checked={motivo === m}
                      onChange={() => setMotivo(m)}
                      className="accent-orange-500"
                    />
                    <span className="text-sm text-zinc-700">{m}</span>
                  </label>
                ))}
              </div>
              {motivo === "Outro motivo" && (
                <textarea
                  value={motivoCustom}
                  onChange={(e) => setMotivoCustom(e.target.value)}
                  placeholder="Descreva o motivo…"
                  rows={3}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setModalRecusa(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRecusa}
                disabled={!!processando}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold transition"
              >
                {processando ? "…" : "Recusar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
