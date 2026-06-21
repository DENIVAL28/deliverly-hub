import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { MapPin, Phone, Copy, Navigation, X, ChefHat, CheckCircle2, Bike, Clock, ShoppingBag, AlertCircle, UserCheck } from "lucide-react";
import { normalizeWA } from "@/lib/validacoes";

export const Route = createFileRoute("/_authenticated/empresa/pedidos-simples")({
  component: PedidosSimplesPage,
});

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MOTIVOS_RECUSA = [
  "Produto indisponível",
  "Fora da área de entrega",
  "Loja não consegue atender agora",
  "Outro motivo",
];

// ── Helpers de fluxo ─────────────────────────────────────────────────────────

function precisaPreparo(pedido: any): boolean {
  const itens: any[] = pedido.pedido_itens ?? [];
  if (itens.length === 0) return true;
  return itens.some((i) => i.requer_preparo !== false);
}

/** Retirada / mesa / PDV vão direto para finalizado; delivery vai para entrega */
function getStatusAposPreparado(p: any): "entrega" | "finalizado" {
  if (p.tipo === "pdv" || p.tipo === "retirada" || p.mesa) return "finalizado";
  return "entrega";
}

function getLabelPronto(p: any): string {
  if (p.tipo === "retirada") return "Pronto para retirada";
  if (p.tipo === "pdv" || p.mesa) return "Finalizar pedido";
  return "Pedido pronto";
}

/** Minutos que o pedido está na etapa atual */
function minutosNaEtapa(p: any): number {
  const ref = p.updated_at ?? p.created_at;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 60000);
}

/** Entrega em modo plataforma, sem entregador atribuído há >= 10 min */
function isEntregaAtrasada(p: any, tipoOp: string): boolean {
  return p.status === "entrega" && !p.entregador_id && tipoOp === "plataforma" && minutosNaEtapa(p) >= 10;
}

// ── WhatsApp helpers ─────────────────────────────────────────────────────────

async function enviarWhatsApp(pedido: any, msg: string, empresa: any) {
  if (!pedido.cliente_telefone) return;
  const waNum = normalizeWA(pedido.cliente_telefone);
  const { zapi_instance, zapi_token, zapi_client_token } = empresa ?? {};
  if (zapi_instance && zapi_token) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (zapi_client_token) headers["Client-Token"] = zapi_client_token;
      const res = await fetch(
        `https://api.z-api.io/instances/${zapi_instance}/token/${zapi_token}/send-text`,
        { method: "POST", headers, body: JSON.stringify({ phone: waNum, message: msg }) }
      );
      if (res.ok) return;
    } catch (_) {}
  }
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ── Modal de recusa ───────────────────────────────────────────────────────────

function RecusarModal({ pedido, onConfirm, onClose }: {
  pedido: any;
  onConfirm: (motivo: string) => void;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="font-black text-zinc-900 text-lg mb-1">Recusar pedido #{pedido.numero}</h3>
        <p className="text-sm text-zinc-500 mb-5">Selecione o motivo — será informado ao cliente via WhatsApp:</p>
        <div className="space-y-2 mb-6">
          {MOTIVOS_RECUSA.map((m) => (
            <button key={m} onClick={() => setMotivo(m)}
              className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                motivo === m ? "border-red-400 bg-red-50 text-red-700" : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
              }`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-bold text-zinc-600">
            Voltar
          </button>
          <button disabled={!motivo} onClick={() => onConfirm(motivo)}
            className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-black transition-colors disabled:opacity-40">
            Confirmar recusa
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de seleção de entregador (modo fixos) ───────────────────────────────

function SelEntregadorModal({ pedido, entregadores, onConfirm, onClose }: {
  pedido: any;
  entregadores: any[];
  onConfirm: (entregadorId: string | null, nome: string | null) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState("");
  const [nomeManual, setNomeManual] = useState("");
  const podeConfirmar = !!sel || !!nomeManual.trim();

  function confirmar() {
    if (sel) {
      const e = entregadores.find((x) => x.id === sel);
      onConfirm(sel, e?.nome ?? null);
    } else {
      onConfirm(null, nomeManual.trim() || null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="font-black text-zinc-900 text-lg mb-1">Designar entregador</h3>
        <p className="text-sm text-zinc-500 mb-5">Pedido #{pedido.numero} — quem vai entregar?</p>

        {entregadores.length > 0 ? (
          <div className="space-y-2 mb-5">
            {entregadores.map((e) => (
              <button key={e.id} onClick={() => { setSel(e.id); setNomeManual(""); }}
                className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all flex items-center gap-2 ${
                  sel === e.id ? "border-brand bg-brand/5 text-brand" : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                }`}>
                <UserCheck className="size-4 opacity-60 shrink-0" /> {e.nome}
              </button>
            ))}
            <div className="pt-2 border-t border-zinc-100">
              <p className="text-xs text-zinc-400 mb-1.5">Ou digite um nome externo:</p>
              <input type="text" value={nomeManual}
                onChange={(e) => { setNomeManual(e.target.value); setSel(""); }}
                placeholder="Nome do entregador"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <p className="text-xs text-zinc-500 mb-2">Nenhum entregador fixo cadastrado. Digite o nome:</p>
            <input type="text" value={nomeManual} onChange={(e) => setNomeManual(e.target.value)}
              placeholder="Nome do entregador"
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-bold text-zinc-600">
            Voltar
          </button>
          <button disabled={!podeConfirmar} onClick={confirmar}
            className="flex-[2] py-3 rounded-2xl bg-brand hover:bg-brand/90 text-white text-sm font-black transition-colors disabled:opacity-40">
            Confirmar envio
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de pedido ─────────────────────────────────────────────────────────────

function PedidoCard({ p, tipoOp, onAction }: {
  p: any;
  tipoOp: string;
  onAction: (action: string, pedido: any) => void;
}) {
  const itens: any[] = p.pedido_itens ?? [];
  const isDelivery = p.tipo === "delivery" || (!p.mesa && p.tipo !== "retirada" && p.tipo !== "pdv");
  const atrasada = isEntregaAtrasada(p, tipoOp);
  const minutos  = minutosNaEtapa(p);

  function copiar(texto: string, label: string) {
    navigator.clipboard.writeText(texto).then(() => toast.success(`${label} copiado!`));
  }

  function copiarPedidoCompleto() {
    const linhas = [
      `📦 Pedido #${p.numero}`,
      `👤 ${p.cliente_nome}`,
      p.cliente_telefone ? `📱 ${p.cliente_telefone}` : "",
      p.cliente_endereco ? `📍 ${p.cliente_endereco}` : "",
      "",
      ...itens.map((i) => `• ${i.quantidade}x ${i.nome}${i.observacao ? ` (${i.observacao})` : ""} — ${fmt(Number(i.subtotal))}`),
      "",
      `💰 Total: ${fmt(Number(p.total))}`,
      `💳 Pagamento: ${p.forma_pagamento ?? "—"}`,
      p.observacao ? `📝 Obs: ${p.observacao}` : "",
    ].filter(Boolean).join("\n");
    copiar(linhas, "Pedido completo");
  }

  const isNovo    = ["novo", "aguardando_confirmacao", "aguardando_pagamento"].includes(p.status);
  const isPreparo = ["aceito", "preparo"].includes(p.status);
  const isEntrega = p.status === "entrega";

  const colBg  = isNovo ? "bg-blue-50"    : isPreparo ? "bg-orange-50"    : "bg-purple-50";
  const ring   = isNovo ? "ring-blue-200" : isPreparo ? "ring-orange-200" : "ring-purple-200";

  const etapaLabel: Record<string, string> = {
    aguardando_confirmacao: "Aguardando",
    aguardando_pagamento:   "Aguard. PIX",
    novo:    "Novo",
    aceito:  "Em preparo",
    preparo: "Em preparo",
    entrega: "Em entrega",
  };
  const EtapaIcon = isNovo ? ShoppingBag : isPreparo ? ChefHat : Bike;

  return (
    <div className={`bg-white rounded-3xl ring-1 shadow-sm flex flex-col overflow-hidden ${ring}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${colBg}`}>
        <div className="flex items-center gap-2">
          <span className="font-black text-zinc-900 text-lg">#{p.numero}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/70 text-zinc-600">
            <EtapaIcon className="size-3" /> {etapaLabel[p.status] ?? p.status}
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Aviso entrega atrasada sem entregador */}
      {atrasada && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
          <AlertCircle className="size-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-700">Aguardando entregador há {minutos} min</p>
            <p className="text-[11px] text-amber-600">Nenhum entregador da plataforma aceitou ainda</p>
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        {/* Cliente */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-zinc-900">{p.cliente_nome}</p>
            {p.cliente_telefone && (
              <a href={`https://wa.me/55${p.cliente_telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium mt-0.5">
                <Phone className="size-3" /> {p.cliente_telefone}
              </a>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
            isDelivery ? "bg-orange-100 text-orange-600"
            : p.tipo === "retirada" ? "bg-blue-100 text-blue-600"
            : "bg-zinc-100 text-zinc-600"
          }`}>
            {isDelivery ? "🛵 Entrega" : p.tipo === "retirada" ? "🏃 Retirada" : p.tipo === "pdv" ? "🏪 Balcão" : `Mesa ${p.mesa}`}
          </span>
        </div>

        {/* Entregador atribuído */}
        {p.entregador_nome && (
          <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-xl">
            <Bike className="size-3.5 shrink-0" />
            <span className="font-semibold">{p.entregador_nome}</span>
          </div>
        )}

        {/* Endereço (só delivery) */}
        {isDelivery && p.cliente_endereco && (
          <div className="bg-zinc-50 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-start gap-2">
              <MapPin className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
              <p className="text-sm text-zinc-700 leading-snug">{p.cliente_endereco}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => copiar(p.cliente_endereco, "Endereço")}
                className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 bg-white border border-zinc-200 px-2.5 py-1 rounded-full">
                <Copy className="size-3" /> Copiar
              </button>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(p.cliente_endereco)}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-600 bg-white border border-blue-200 px-2.5 py-1 rounded-full">
                <Navigation className="size-3" /> Abrir no mapa
              </a>
            </div>
          </div>
        )}

        {/* Itens */}
        <div className="space-y-1">
          {itens.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-zinc-700">
                {item.quantidade}x {item.nome}
                {item.observacao ? <span className="text-zinc-400"> ({item.observacao})</span> : null}
              </span>
              <span className="font-semibold text-zinc-800 shrink-0 ml-2">{fmt(Number(item.subtotal))}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
          <span className="text-sm text-zinc-500">{p.forma_pagamento ?? "—"}</span>
          <span className="font-black text-brand text-lg">{fmt(Number(p.total))}</span>
        </div>

        {p.observacao && (
          <p className="text-xs text-zinc-500 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
            📝 {p.observacao}
          </p>
        )}

        <button onClick={copiarPedidoCompleto}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-600 py-1.5 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-colors">
          <Copy className="size-3" /> Copiar pedido completo
        </button>
      </div>

      {/* Ações */}
      <div className="px-4 pb-4 pt-1 space-y-2">
        {isNovo && (
          <div className="flex gap-2">
            <button onClick={() => onAction("recusar", p)}
              className="flex-1 py-3 rounded-2xl border border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
              <X className="size-4" /> Recusar
            </button>
            <button onClick={() => onAction("aceitar", p)}
              className="flex-[2] py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-sm transition-colors flex items-center justify-center gap-1.5">
              <ChefHat className="size-4" /> Aceitar e preparar
            </button>
          </div>
        )}

        {isPreparo && (
          <button onClick={() => onAction("pronto", p)}
            className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-base transition-colors flex items-center justify-center gap-2">
            <CheckCircle2 className="size-5" /> {getLabelPronto(p)}
          </button>
        )}

        {isEntrega && (
          <div className="space-y-2">
            <button onClick={() => onAction("finalizar", p)}
              className="w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-base transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 className="size-5" /> Finalizar — entregue
            </button>
            {atrasada && (
              <button onClick={() => onAction("atribuir", p)}
                className="w-full py-2.5 rounded-2xl border border-purple-200 text-purple-600 font-bold text-sm hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5">
                <UserCheck className="size-4" /> Atribuir entregador manualmente
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

function PedidosSimplesPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [recusandoPedido,    setRecusandoPedido]    = useState<any | null>(null);
  const [prontoParaEntrega,  setProntoParaEntrega]  = useState<any | null>(null);
  const [loading,            setLoading]            = useState<Record<string, boolean>>({});

  // Configuração da empresa (tipo de entrega, zapi, nome)
  const { data: empresa } = useQuery({
    queryKey: ["empresa-info", empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async () =>
      (await supabase.from("empresas")
        .select("nome_fantasia,tipo_operacao_entrega,zapi_instance,zapi_token,zapi_client_token")
        .eq("id", empresaId!)
        .single()).data,
  });

  const tipoOp: string = (empresa as any)?.tipo_operacao_entrega ?? "plataforma";

  // Entregadores fixos — só carrega quando modo fixos
  const { data: entregadoresFixos = [] } = useQuery({
    queryKey: ["entregadores-fixos", empresaId],
    enabled: !!empresaId && tipoOp === "fixos",
    queryFn: async () =>
      (await supabase.from("entregadores")
        .select("id,nome")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .eq("tipo", "fixo")
        .order("nome")).data ?? [],
  });

  // Pedidos ativos (RPC SECURITY DEFINER — só retorna dados desta empresa)
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-ativos", empresaId],
    enabled: !!empresaId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("empresa_pedidos_ativos");
      return data ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase.channel(`pedidos-simples-${empresaId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        () => qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] })
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, qc]);

  async function rpc(pedidoId: string, status: string, extra?: { p_entregador_id?: string | null; p_entregador_nome?: string | null }) {
    const { data, error } = await (supabase as any).rpc("empresa_atualizar_pedido", {
      p_pedido_id:       pedidoId,
      p_status:          status,
      p_entregador_id:   extra?.p_entregador_id   ?? null,
      p_entregador_nome: extra?.p_entregador_nome ?? null,
      p_desconto:        null,
    });
    if (error || data?.error) throw new Error(error?.message ?? data?.error);
  }

  async function handleAction(action: string, pedido: any, extra?: { entregadorId?: string | null; nome?: string | null }) {
    if (loading[pedido.id]) return;

    // ── ACEITAR ───────────────────────────────────────────────────────────────
    if (action === "aceitar") {
      setLoading((s) => ({ ...s, [pedido.id]: true }));
      try {
        await rpc(pedido.id, "aceito");
        if (precisaPreparo(pedido)) await rpc(pedido.id, "preparo");
        toast.success(`Pedido #${pedido.numero} aceito — em preparo!`);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      } catch (err: any) {
        toast.error(err.message ?? "Erro ao aceitar pedido");
      } finally {
        setLoading((s) => ({ ...s, [pedido.id]: false }));
      }
      return;
    }

    // ── PRONTO ────────────────────────────────────────────────────────────────
    if (action === "pronto") {
      const proximoStatus = getStatusAposPreparado(pedido);

      // Delivery + modo fixos → auto-atribui se só 1 entregador, senão abre modal
      if (proximoStatus === "entrega" && tipoOp === "fixos" && !extra) {
        if ((entregadoresFixos as any[]).length === 1) {
          const ent = (entregadoresFixos as any[])[0];
          await handleAction("pronto", pedido, { entregadorId: ent.id, nome: ent.nome });
        } else {
          setProntoParaEntrega(pedido);
        }
        return;
      }

      setLoading((s) => ({ ...s, [pedido.id]: true }));
      try {
        await rpc(pedido.id, proximoStatus, {
          p_entregador_id:   extra?.entregadorId ?? null,
          p_entregador_nome: extra?.nome        ?? null,
        });
        const msg = proximoStatus === "finalizado"
          ? `Pedido #${pedido.numero} finalizado!`
          : tipoOp === "plataforma"
            ? `Pedido #${pedido.numero} pronto — notificando entregadores da plataforma…`
            : `Pedido #${pedido.numero} — saiu para entrega!`;
        toast.success(msg);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      } catch (err: any) {
        toast.error(err.message ?? "Erro ao atualizar pedido");
      } finally {
        setLoading((s) => ({ ...s, [pedido.id]: false }));
      }
      return;
    }

    // ── ATRIBUIR (entregador para pedido já em entrega) ───────────────────────
    if (action === "atribuir") {
      setProntoParaEntrega({ ...pedido, _soAtribuir: true });
      return;
    }

    // ── FINALIZAR ─────────────────────────────────────────────────────────────
    if (action === "finalizar") {
      setLoading((s) => ({ ...s, [pedido.id]: true }));
      try {
        await rpc(pedido.id, "finalizado");
        toast.success(`Pedido #${pedido.numero} finalizado!`);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      } catch (err: any) {
        toast.error(err.message ?? "Erro ao finalizar pedido");
      } finally {
        setLoading((s) => ({ ...s, [pedido.id]: false }));
      }
      return;
    }

    // ── RECUSAR ───────────────────────────────────────────────────────────────
    if (action === "recusar") {
      setRecusandoPedido(pedido);
    }
  }

  async function confirmarRecusa(motivo: string) {
    if (!recusandoPedido) return;
    setLoading((s) => ({ ...s, [recusandoPedido.id]: true }));
    try {
      await rpc(recusandoPedido.id, "cancelado");

      // Notifica cliente via WhatsApp com o motivo da recusa
      const nomeEmpresa = (empresa as any)?.nome_fantasia ?? "Estabelecimento";
      const msg = `❌ *Pedido #${recusandoPedido.numero} não pode ser processado*\n\nOlá, *${recusandoPedido.cliente_nome}*! Infelizmente não conseguimos aceitar seu pedido.\n\n📋 Motivo: ${motivo}\n\nEntre em contato conosco para mais informações.\n\n_${nomeEmpresa}_`;
      await enviarWhatsApp(recusandoPedido, msg, empresa);

      toast.success(`Pedido #${recusandoPedido.numero} recusado.`);
      qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao recusar pedido");
    } finally {
      setLoading((s) => ({ ...s, [recusandoPedido.id]: false }));
      setRecusandoPedido(null);
    }
  }

  async function confirmarEntregador(entregadorId: string | null, nome: string | null) {
    if (!prontoParaEntrega) return;
    const p = prontoParaEntrega;
    setProntoParaEntrega(null);

    if (p._soAtribuir) {
      // Pedido já em "entrega" — só atualiza entregador (reenvia mesmo status)
      setLoading((s) => ({ ...s, [p.id]: true }));
      try {
        await rpc(p.id, "entrega", { p_entregador_id: entregadorId, p_entregador_nome: nome });
        toast.success(`Entregador ${nome ?? "atribuído"}!`);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      } catch (err: any) {
        toast.error(err.message ?? "Erro ao atribuir entregador");
      } finally {
        setLoading((s) => ({ ...s, [p.id]: false }));
      }
      return;
    }

    // Fluxo normal: preparo → entrega com entregador selecionado
    await handleAction("pronto", p, { entregadorId, nome });
  }

  // Colunas
  const novos   = (pedidos as any[]).filter((p) => ["novo", "aguardando_confirmacao", "aguardando_pagamento"].includes(p.status));
  const preparo = (pedidos as any[]).filter((p) => ["aceito", "preparo"].includes(p.status));
  const entrega = (pedidos as any[]).filter((p) => p.status === "entrega");

  function ColHeader({ label, sub, count, color }: { label: string; sub?: string; count: number; color: string }) {
    return (
      <div className="flex items-center gap-2 mb-4 px-1">
        <div>
          <h2 className="font-black text-zinc-800 text-base leading-none">{label}</h2>
          {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
        </div>
        {count > 0 && (
          <span className={`min-w-[24px] h-6 rounded-full text-[11px] font-black flex items-center justify-center text-white px-1.5 ${color}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      {recusandoPedido && (
        <RecusarModal
          pedido={recusandoPedido}
          onClose={() => setRecusandoPedido(null)}
          onConfirm={confirmarRecusa}
        />
      )}

      {prontoParaEntrega && (
        <SelEntregadorModal
          pedido={prontoParaEntrega}
          entregadores={entregadoresFixos as any[]}
          onClose={() => setProntoParaEntrega(null)}
          onConfirm={confirmarEntregador}
        />
      )}

      <PageHeader
        title="Painel simplificado"
        subtitle="Gerencie seus pedidos com poucos toques"
      />

      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
          <ShoppingBag className="size-12 text-zinc-300" />
          <p className="font-semibold">Nenhum pedido no momento</p>
          <p className="text-sm">Novos pedidos aparecem aqui automaticamente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Novos */}
          <div>
            <ColHeader label="Novos" count={novos.length} color="bg-blue-500" />
            <div className="space-y-4">
              {novos.length === 0
                ? <p className="text-sm text-zinc-400 text-center py-10 bg-zinc-50 rounded-2xl border border-zinc-100">Nenhum pedido novo</p>
                : novos.map((p: any) => <PedidoCard key={p.id} p={p} tipoOp={tipoOp} onAction={handleAction} />)
              }
            </div>
          </div>

          {/* Em preparo */}
          <div>
            <ColHeader label="Em preparo" count={preparo.length} color="bg-orange-500" />
            <div className="space-y-4">
              {preparo.length === 0
                ? <p className="text-sm text-zinc-400 text-center py-10 bg-zinc-50 rounded-2xl border border-zinc-100">Nenhum pedido em preparo</p>
                : preparo.map((p: any) => <PedidoCard key={p.id} p={p} tipoOp={tipoOp} onAction={handleAction} />)
              }
            </div>
          </div>

          {/* Em entrega (retirada/mesa/pdv não aparecem aqui) */}
          <div>
            <ColHeader
              label="Em entrega"
              sub={tipoOp === "plataforma" ? "Aguardando entregador da plataforma" : "Entrega própria"}
              count={entrega.length}
              color="bg-purple-500"
            />
            <div className="space-y-4">
              {entrega.length === 0
                ? <p className="text-sm text-zinc-400 text-center py-10 bg-zinc-50 rounded-2xl border border-zinc-100">Nenhum pedido em entrega</p>
                : entrega.map((p: any) => <PedidoCard key={p.id} p={p} tipoOp={tipoOp} onAction={handleAction} />)
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
