import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { MapPin, Phone, Copy, Navigation, X, ChefHat, CheckCircle2, Bike, Clock, ShoppingBag } from "lucide-react";

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

// ── Modal de recusa ────────────────────────────────────────────────────────────
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
        <p className="text-sm text-zinc-500 mb-5">Selecione o motivo para informar ao cliente:</p>
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

// ── Card de pedido ─────────────────────────────────────────────────────────────
function PedidoCard({ p, onAction }: { p: any; onAction: (action: string, pedido: any) => void }) {
  const itens: any[] = p.pedido_itens ?? [];
  const isDelivery = p.tipo === "delivery" || (!p.mesa && p.tipo !== "retirada" && p.tipo !== "pdv");
  const temEndereco = !!p.cliente_endereco;

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

  // Cor e label da etapa
  const etapaConfig: Record<string, { cor: string; label: string; icon: any }> = {
    aguardando_confirmacao: { cor: "bg-zinc-100 text-zinc-600",    label: "Aguardando",  icon: Clock },
    aguardando_pagamento:   { cor: "bg-amber-100 text-amber-700",  label: "Aguard. PIX", icon: Clock },
    novo:                   { cor: "bg-blue-100 text-blue-700",    label: "Novo",        icon: ShoppingBag },
    aceito:                 { cor: "bg-orange-100 text-orange-700",label: "Em preparo",  icon: ChefHat },
    preparo:                { cor: "bg-orange-100 text-orange-700",label: "Em preparo",  icon: ChefHat },
    entrega:                { cor: "bg-purple-100 text-purple-700",label: "Em entrega",  icon: Bike },
  };
  const etapa = etapaConfig[p.status] ?? { cor: "bg-zinc-100 text-zinc-600", label: p.status, icon: Clock };
  const EtapaIcon = etapa.icon;

  const isNovo    = ["novo", "aguardando_confirmacao", "aguardando_pagamento"].includes(p.status);
  const isPreparo = ["aceito", "preparo"].includes(p.status);
  const isEntrega = p.status === "entrega";

  return (
    <div className={`bg-white rounded-3xl ring-1 shadow-sm flex flex-col gap-0 overflow-hidden ${
      isNovo ? "ring-blue-200 shadow-blue-100" : isPreparo ? "ring-orange-200 shadow-orange-50" : "ring-purple-200 shadow-purple-50"
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isNovo ? "bg-blue-50" : isPreparo ? "bg-orange-50" : "bg-purple-50"
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-black text-zinc-900 text-lg">#{p.numero}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${etapa.cor}`}>
            <EtapaIcon className="size-3" /> {etapa.label}
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

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
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            isDelivery ? "bg-orange-100 text-orange-600" : p.tipo === "retirada" ? "bg-blue-100 text-blue-600" : "bg-zinc-100 text-zinc-600"
          }`}>
            {isDelivery ? "🛵 Entrega" : p.tipo === "retirada" ? "🏃 Retirada" : p.tipo === "pdv" ? "🏪 Balcão" : `Mesa ${p.mesa}`}
          </span>
        </div>

        {/* Endereço */}
        {isDelivery && temEndereco && (
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
              <span className="text-zinc-700">{item.quantidade}x {item.nome}{item.observacao ? <span className="text-zinc-400"> ({item.observacao})</span> : null}</span>
              <span className="font-semibold text-zinc-800 shrink-0 ml-2">{fmt(Number(item.subtotal))}</span>
            </div>
          ))}
        </div>

        {/* Total + pagamento */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
          <span className="text-sm text-zinc-500">{p.forma_pagamento ?? "—"}</span>
          <span className="font-black text-brand text-lg">{fmt(Number(p.total))}</span>
        </div>

        {p.observacao && (
          <p className="text-xs text-zinc-500 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
            📝 {p.observacao}
          </p>
        )}

        {/* Botão copiar pedido completo */}
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
            <CheckCircle2 className="size-5" /> Pedido pronto
          </button>
        )}

        {isEntrega && (
          <div className="space-y-2">
            {p.entregador_nome && (
              <p className="text-xs text-center text-purple-600 font-semibold">
                🛵 Entregador: {p.entregador_nome}
              </p>
            )}
            <button onClick={() => onAction("finalizar", p)}
              className="w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-base transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 className="size-5" /> Finalizar — entregue
            </button>
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
  const [recusandoPedido, setRecusandoPedido] = useState<any | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

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

  async function rpc(pedidoId: string, status: string, extra?: Record<string, any>) {
    const { data, error } = await (supabase as any).rpc("empresa_atualizar_pedido", {
      p_pedido_id: pedidoId,
      p_status: status,
      p_entregador_id: null,
      p_entregador_nome: null,
      p_desconto: null,
      ...extra,
    });
    if (error || data?.error) throw new Error(error?.message ?? data?.error);
  }

  async function handleAction(action: string, pedido: any) {
    if (loading[pedido.id]) return;
    setLoading((s) => ({ ...s, [pedido.id]: true }));

    try {
      if (action === "aceitar") {
        await rpc(pedido.id, "aceito");
        await rpc(pedido.id, "preparo");
        toast.success(`Pedido #${pedido.numero} aceito — em preparo!`);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      }

      if (action === "pronto") {
        await rpc(pedido.id, "entrega");
        toast.success(`Pedido #${pedido.numero} pronto — saiu para entrega!`);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      }

      if (action === "finalizar") {
        await rpc(pedido.id, "finalizado");
        toast.success(`Pedido #${pedido.numero} finalizado!`);
        qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
      }

      if (action === "recusar") {
        setRecusandoPedido(pedido);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao atualizar pedido");
    } finally {
      setLoading((s) => ({ ...s, [pedido.id]: false }));
    }
  }

  async function confirmarRecusa(motivo: string) {
    if (!recusandoPedido) return;
    setLoading((s) => ({ ...s, [recusandoPedido.id]: true }));
    try {
      await rpc(recusandoPedido.id, "cancelado");
      toast.success(`Pedido #${recusandoPedido.numero} recusado — motivo: ${motivo}`);
      qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao recusar pedido");
    } finally {
      setLoading((s) => ({ ...s, [recusandoPedido.id]: false }));
      setRecusandoPedido(null);
    }
  }

  const novos    = (pedidos as any[]).filter((p) => ["novo", "aguardando_confirmacao", "aguardando_pagamento"].includes(p.status));
  const preparo  = (pedidos as any[]).filter((p) => ["aceito", "preparo"].includes(p.status));
  const entrega  = (pedidos as any[]).filter((p) => p.status === "entrega");

  function ColHeader({ label, count, color }: { label: string; count: number; color: string }) {
    return (
      <div className={`flex items-center gap-2 mb-4 px-1`}>
        <h2 className="font-black text-zinc-800 text-base">{label}</h2>
        {count > 0 && (
          <span className={`size-6 rounded-full text-[11px] font-black flex items-center justify-center text-white ${color}`}>
            {count}
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
              {novos.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8 bg-zinc-50 rounded-2xl">Nenhum pedido novo</p>
              ) : novos.map((p: any) => (
                <PedidoCard key={p.id} p={p} onAction={handleAction} />
              ))}
            </div>
          </div>

          {/* Em preparo */}
          <div>
            <ColHeader label="Em preparo" count={preparo.length} color="bg-orange-500" />
            <div className="space-y-4">
              {preparo.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8 bg-zinc-50 rounded-2xl">Nenhum pedido em preparo</p>
              ) : preparo.map((p: any) => (
                <PedidoCard key={p.id} p={p} onAction={handleAction} />
              ))}
            </div>
          </div>

          {/* Em entrega */}
          <div>
            <ColHeader label="Em entrega" count={entrega.length} color="bg-purple-500" />
            <div className="space-y-4">
              {entrega.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8 bg-zinc-50 rounded-2xl">Nenhum pedido em entrega</p>
              ) : entrega.map((p: any) => (
                <PedidoCard key={p.id} p={p} onAction={handleAction} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
