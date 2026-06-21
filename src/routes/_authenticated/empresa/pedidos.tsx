import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Printer, Bike, MessageCircle, ChevronLeft, ChevronRight, Download, Pencil, X, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { gerarCSV, baixarCSV, COLUNAS_PEDIDOS } from "@/lib/exportar";
import { toast } from "sonner";
import { LimiteBanner } from "@/components/UpgradeGuard";
import { traduzirErro } from "@/lib/erros";
import { PLANO_LIMITS } from "@/lib/plano";
import { normalizeWA } from "@/lib/validacoes";

const STATUS: { value: string; label: string; tone: string }[] = [
  { value: "aguardando_confirmacao", label: "Aguard. confirmação", tone: "bg-zinc-100 text-zinc-600" },
  { value: "aguardando_pagamento",   label: "Aguard. pagamento",   tone: "bg-amber-100 text-amber-700" },
  { value: "novo",       label: "Novo",            tone: "bg-blue-100 text-blue-700" },
  { value: "aceito",     label: "Aceito",           tone: "bg-amber-100 text-amber-700" },
  { value: "preparo",    label: "Em preparo",       tone: "bg-orange-100 text-brand" },
  { value: "entrega",    label: "Saiu p/ entrega",  tone: "bg-purple-100 text-purple-700" },
  { value: "finalizado", label: "Finalizado",       tone: "bg-green-100 text-green-700" },
  { value: "cancelado",  label: "Cancelado",        tone: "bg-red-100 text-red-700" },
];

// Com preparo
const NEXT: Record<string, string> = { novo: "aceito", aceito: "preparo", preparo: "entrega", entrega: "finalizado" };
const NEXT_MESA: Record<string, string> = { novo: "aceito", aceito: "preparo", preparo: "finalizado" };
const NEXT_RETIRADA = NEXT_MESA;
// Sem preparo (todos itens da categoria "sem preparo")
const NEXT_SEM_PREPARO: Record<string, string> = { novo: "aceito", aceito: "entrega", entrega: "finalizado" };
const NEXT_MESA_SEM_PREPARO: Record<string, string> = { novo: "aceito", aceito: "finalizado" };
const NEXT_RETIRADA_SEM_PREPARO = NEXT_MESA_SEM_PREPARO;
// PDV: sempre sem preparo (atendente está ali)
const NEXT_PDV: Record<string, string> = { novo: "aceito", aceito: "finalizado" };

function precisaPreparo(pedido: any): boolean {
  const itens: any[] = pedido.pedido_itens ?? [];
  if (itens.length === 0) return true;
  return itens.some((i) => i.requer_preparo !== false);
}

const ATIVOS = ["aguardando_confirmacao", "aguardando_pagamento", "novo", "aceito", "preparo", "entrega"];
const PAGE_SIZE = 20;

const VEICULO_LABEL: Record<string, string> = {
  moto: "🏍️ Moto", carro: "🚗 Carro", bicicleta: "🚲 Bicicleta",
};

const TABS = [
  { id: "ativos",      label: "Ativos" },
  { id: "todos",       label: "Todos" },
  { id: "finalizados", label: "Finalizados" },
  { id: "cancelados",  label: "Cancelados" },
] as const;

type Tab = typeof TABS[number]["id"];

export const Route = createFileRoute("/_authenticated/empresa/pedidos")({
  component: PedidosPage,
});

/* ─── Mensagens WhatsApp por status ─── */
const MSGS: Record<string, (p: any, nomeEmpresa: string) => string> = {
  aguardando_pagamento: (p, e) => {
    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const desc = Number(p.desconto ?? 0);
    const total = Number(p.total) - desc;
    return `💳 *Pedido #${p.numero} confirmado — realize o pagamento!*\n\nOlá, *${p.cliente_nome}*!${desc > 0 ? `\n\n🎁 Desconto aplicado: *${fmt(desc)}*` : ""}\n*Total a pagar: ${fmt(total)}*\n\nAcesse seu pedido para pagar via PIX:\n${window.location.origin}/loja/${e}\n\n_${e}_`;
  },
  aceito: (p, e) =>
    `✅ *Pedido #${p.numero} confirmado!*\n\nOlá, *${p.cliente_nome}*! Recebemos seu pedido e já estamos preparando tudo. 👨‍🍳\n\n_${e}_`,
  preparo: (p, e) =>
    `🍳 *Pedido #${p.numero} em preparo!*\n\nOlá, *${p.cliente_nome}*! Seu pedido está sendo feito agora. Logo ficará prontinho! ⏱\n\n_${e}_`,
  entrega: (p, e) =>
    `🛵 *Pedido #${p.numero} saiu para entrega!*\n\nOlá, *${p.cliente_nome}*! Seu pedido está a caminho.${p.entregador_nome ? `\nEntregador: *${p.entregador_nome}*` : ""}\n\nFique de olho, chega em breve! 📍\n\n_${e}_`,
  finalizado: (p, e) =>
    `🎉 *Pedido #${p.numero} entregue!*\n\nOlá, *${p.cliente_nome}*! Esperamos que tenha curtido. 😊\n\nAvalie sua experiência:\n${window.location.origin}/pedido/${p.id}\n\n_${e}_`,
  cancelado: (p, e) =>
    `❌ *Pedido #${p.numero} cancelado*\n\nOlá, *${p.cliente_nome}*. Infelizmente não foi possível processar seu pedido.\n\nEntre em contato para mais informações.\n\n_${e}_`,
};

async function notificarWhatsApp(p: any, empresa: any) {
  const nomeEmpresa = empresa?.nome_fantasia ?? "Estabelecimento";
  const msg = MSGS[p.status]?.(p, nomeEmpresa);
  if (!msg || !p.cliente_telefone) return;
  const waNum = normalizeWA(p.cliente_telefone);

  // Tenta Z-API se configurado
  const { zapi_instance, zapi_token, zapi_client_token } = empresa ?? {};
  if (zapi_instance && zapi_token) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (zapi_client_token) headers["Client-Token"] = zapi_client_token;
      const res = await fetch(
        `https://api.z-api.io/instances/${zapi_instance}/token/${zapi_token}/send-text`,
        { method: "POST", headers, body: JSON.stringify({ phone: waNum, message: msg }) }
      );
      if (res.ok) { toast.success("Mensagem enviada via WhatsApp!"); return; }
    } catch (_) {}
    toast.error("Falha ao enviar via Z-API — abrindo WhatsApp Web como alternativa.");
  }

  // Fallback: abre WhatsApp Web
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ─── Escape HTML para evitar XSS no print ─── */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Impressão do pedido ─── */
function imprimirPedido(p: any, nomeEmpresa: string) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const data = new Date(p.created_at).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const descPrint = Number(p.desconto ?? 0);
  const totalLiquido = Math.max(0, Number(p.subtotal) + Number(p.taxa_entrega) - descPrint);

  const itens = (p.pedido_itens ?? [])
    .map((i: any) => `
      <tr>
        <td style="padding:3px 0">${esc(i.quantidade)}x ${esc(i.nome)}${i.observacao ? `<br><small style="color:#666">${esc(i.observacao)}</small>` : ""}</td>
        <td style="text-align:right;padding:3px 0;white-space:nowrap">${fmt(Number(i.subtotal))}</td>
      </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Pedido #${esc(p.numero)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #000; width: 80mm; padding: 8px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    .total { font-size: 15px; font-weight: bold; }
    small { font-size: 11px; }
    @media print { body { width: 80mm; } }
  </style>
  </head><body>
  <div class="center bold" style="font-size:15px">${esc(nomeEmpresa)}</div>
  <div class="center" style="margin-top:2px;font-size:11px">${esc(data)}</div>
  <div class="line"></div>
  <div class="center bold" style="font-size:18px">PEDIDO #${esc(p.numero)}</div>
  <div class="line"></div>
  <div><b>Cliente:</b> ${esc(p.cliente_nome)}</div>
  ${p.cliente_telefone ? `<div><b>Telefone:</b> ${esc(p.cliente_telefone)}</div>` : ""}
  ${p.cliente_endereco ? `<div><b>Endereço:</b> ${esc(p.cliente_endereco)}</div>` : ""}
  <div class="line"></div>
  <table>${itens}</table>
  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(p.subtotal))}</td></tr>
    ${Number(p.taxa_entrega) > 0 ? `<tr><td>Taxa de entrega</td><td style="text-align:right">${fmt(Number(p.taxa_entrega))}</td></tr>` : ""}
    ${descPrint > 0 ? `<tr><td>Desconto</td><td style="text-align:right">-${fmt(descPrint)}</td></tr>` : ""}
    <tr><td class="total">TOTAL</td><td class="total" style="text-align:right">${fmt(totalLiquido)}</td></tr>
  </table>
  <div class="line"></div>
  <div><b>Pagamento:</b> ${esc(p.forma_pagamento ?? "—")}</div>
  ${p.observacao ? `<div><b>Obs:</b> ${esc(p.observacao)}</div>` : ""}
  <div class="line"></div>
  <div class="center" style="font-size:11px">Obrigado pela preferência!</div>
  <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
  </body></html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (win) { win.document.write(html); win.document.close(); }
}

/* ─── Som de notificação via Web Audio API (sem arquivo externo) ─── */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const play = (freq: number, start: number, duration: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    play(880, 0,    0.15); // lá
    play(1108, 0.18, 0.15); // dó#
    play(1320, 0.36, 0.3);  // mi
  } catch (_) {}
}

/* ─── Modal: editar itens do pedido ─── */
function EditarItensModal({ pedido, onClose, onSave }: {
  pedido: any;
  onClose: () => void;
  onSave: () => void;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const itens: any[] = pedido.pedido_itens ?? [];
  const [removidos, setRemovidosSet] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const itensRestantes = itens.filter((i) => !removidos.has(i.id));
  const novoSubtotal   = itensRestantes.reduce((s, i) => s + Number(i.subtotal), 0);
  const taxa           = Number(pedido.taxa_entrega ?? 0);
  const desconto       = Math.min(Number(pedido.desconto ?? 0), novoSubtotal);
  const novoTotal      = Math.max(0, novoSubtotal + taxa - desconto);
  const reembolso      = Math.max(0, Number(pedido.total) - novoTotal);

  function toggle(id: string) {
    setRemovidosSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmar() {
    if (removidos.size === 0) { onClose(); return; }
    if (itensRestantes.length === 0) { toast.error("O pedido deve ter ao menos 1 item."); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("empresa_editar_itens_pedido", {
      p_pedido_id:   pedido.id,
      p_remover_ids: [...removidos],
    });
    setSaving(false);
    if (error || data?.error) { toast.error(error?.message ?? data?.error); return; }
    toast.success(reembolso > 0
      ? `Itens removidos. Reembolsar ${fmt(reembolso)} ao cliente.`
      : "Itens removidos com sucesso.");
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900">Editar pedido #{pedido.numero}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Desmarque os itens que o cliente não quer mais</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl bg-zinc-100 flex items-center justify-center">
            <X className="size-4 text-zinc-500" />
          </button>
        </div>

        {/* Itens */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {itens.map((item) => {
            const ativo = !removidos.has(item.id);
            return (
              <button key={item.id} onClick={() => toggle(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  ativo ? "border-zinc-200 bg-white" : "border-red-200 bg-red-50 opacity-60"
                }`}>
                <span className={`size-5 rounded flex items-center justify-center shrink-0 border ${
                  ativo ? "bg-brand border-brand" : "bg-white border-red-300"
                }`}>
                  {ativo
                    ? <span className="text-white text-[10px] font-black">✓</span>
                    : <X className="size-3 text-red-400" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 leading-snug">
                    {item.quantidade}x {item.nome}
                  </p>
                  {item.observacao && <p className="text-xs text-zinc-400 truncate">{item.observacao}</p>}
                </div>
                <span className={`text-sm font-bold shrink-0 ${ativo ? "text-brand" : "text-red-400 line-through"}`}>
                  {fmt(Number(item.subtotal))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Resumo */}
        <div className="px-5 py-4 border-t border-zinc-100 space-y-2">
          <div className="flex justify-between text-sm text-zinc-500">
            <span>Total original</span><span>{fmt(Number(pedido.total))}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-zinc-900">
            <span>Novo total</span><span className="text-brand">{fmt(novoTotal)}</span>
          </div>
          {reembolso > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-1">
              <AlertTriangleIcon className="size-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-semibold">
                Reembolsar <strong>{fmt(reembolso)}</strong> ao cliente
              </p>
            </div>
          )}
          <button
            onClick={confirmar}
            disabled={saving || removidos.size === 0}
            className="w-full bg-brand hover:bg-brand/90 text-white font-bold py-3 rounded-2xl text-sm mt-1 transition-all disabled:opacity-40">
            {saving ? "Salvando…" : removidos.size === 0 ? "Nenhum item selecionado" : `Confirmar remoção (${removidos.size} item${removidos.size > 1 ? "s" : ""})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function PedidosPage() {
  const { empresaId, plano } = useAuth();
  const qc = useQueryClient();

  const { data: empresa } = useQuery({
    queryKey: ["empresa-info", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("empresas").select("nome_fantasia,zapi_instance,zapi_token,zapi_client_token").eq("id", empresaId!).single()).data,
  });
  const [tab, setTab] = useState<Tab>("ativos");
  const [somAtivo, setSomAtivo] = useState(true);
  const [editarPedido, setEditarPedido] = useState<any | null>(null);
  const [entregadorSel, setEntregadorSel] = useState<Record<string, string>>({});
  const [descontoInput, setDescontoInput] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [dataSel, setDataSel] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [notifPermissao, setNotifPermissao] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== "undefined" && (window.navigator as any).standalone === true;
  const somAtivoRef = useRef(true);
  somAtivoRef.current = somAtivo;

  const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC as string ?? "BDQJCfKKcQaq_jK6dVZ0-BLig3JxFkOB_bG7q0WWYF6tzS49PsePMgfZskeqiELxGrlM1EB4740-Q3u9hl-r7Ro";

  async function registrarPushSubscription(swReg: ServiceWorkerRegistration) {
    if (!empresaId) return;
    try {
      const raw = VAPID_PUBLIC.replace(/-/g, "+").replace(/_/g, "/");
      const pad = raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), "=");
      const bin = atob(pad);
      const key = Uint8Array.from(bin, (c) => c.charCodeAt(0));

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      const json = sub.toJSON();
      await supabase.from("push_subscriptions" as any).upsert({
        empresa_id: empresaId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }, { onConflict: "endpoint" });
    } catch (err) {
      console.warn("Falha ao registrar push subscription:", err);
    }
  }

  async function pedirPermissaoNotificacao() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermissao(result);
    if (result === "granted") {
      toast.success("Notificações ativadas!");
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await registrarPushSubscription(reg);
      }
    } else {
      toast.error("Permissão negada. Ative nas configurações do navegador.");
    }
  }

  // Registra o Service Worker e a subscription quando já tem permissão
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      if (Notification.permission === "granted" && empresaId) {
        await registrarPushSubscription(reg);
      }
    });
  }, [empresaId]);

  const diaInicio = new Date(dataSel); diaInicio.setHours(0,0,0,0);
  const diaFim    = new Date(dataSel); diaFim.setHours(23,59,59,999);
  const hoje      = new Date(); hoje.setHours(0,0,0,0);
  const isHoje    = dataSel.getTime() === hoje.getTime();

  function diaLabel(d: Date) {
    if (d.getTime() === hoje.getTime()) return "Hoje";
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    if (d.getTime() === ontem.getTime()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  // Reset página ao trocar tab ou data
  useEffect(() => { setPage(0); }, [tab, dataSel]);

  // Supabase Realtime — novos pedidos + atualizações
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`pedidos-realtime-${empresaId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
          qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
          playBeep();
          toast(`🛒 Novo pedido #${payload.new.numero} chegou!`, {
            description: `Cliente: ${payload.new.cliente_nome}`,
            duration: 10000,
            action: { label: "Ver", onClick: () => {} },
          });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("🛒 Novo pedido chegou!", {
              body: `Pedido #${payload.new.numero} — ${payload.new.cliente_nome}`,
              icon: "/favicon.ico",
              tag: `pedido-${payload.new.id}`,
            });
          }
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
          qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId, qc]);

  // Query 1 — Ativos (tempo real, sem limite)
  // Usa RPC SECURITY DEFINER para contornar qualquer complexidade de RLS
  const { data: pedidosAtivos = [] } = useQuery({
    queryKey: ["pedidos-ativos", empresaId],
    enabled: !!empresaId,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("empresa_pedidos_ativos");
      if (error) {
        toast.error(`Erro ao buscar pedidos: ${error.message}`);
        return [];
      }
      return data ?? [];
    },
  });

  // Título da aba muda com pedidos ativos
  useEffect(() => {
    const count = (pedidosAtivos as any[]).length;
    document.title = count > 0 ? `(${count}) Novo pedido! — Pedidos` : "Pedidos";
    return () => { document.title = "Pedidos"; };
  }, [(pedidosAtivos as any[]).length]);

  // Query resumo do dia — finalizados
  const { data: resumoDia } = useQuery({
    queryKey: ["pedidos-resumo", empresaId, diaInicio.toISOString()],
    enabled: !!empresaId && tab === "finalizados",
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("total,forma_pagamento")
        .eq("empresa_id", empresaId!)
        .eq("status", "finalizado")
        .gte("created_at", diaInicio.toISOString())
        .lte("created_at", diaFim.toISOString());
      if (!data?.length) return null;
      const totalDia   = data.reduce((s, p) => s + Number(p.total), 0);
      const qtd        = data.length;
      const ticket     = totalDia / qtd;
      const porForma: Record<string, number> = {};
      data.forEach((p) => {
        const f = p.forma_pagamento ?? "—";
        porForma[f] = (porForma[f] ?? 0) + Number(p.total);
      });
      return { totalDia, qtd, ticket, porForma };
    },
  });

  // Query 2 — Paginados (todos/finalizados/cancelados) — filtrado por dia
  const { data: pedidosPag } = useQuery({
    queryKey: ["pedidos-pag", empresaId, tab, page, diaInicio.toISOString()],
    enabled: !!empresaId && tab !== "ativos",
    queryFn: async () => {
      let q = supabase.from("pedidos")
        .select("*, pedido_itens(*)", { count: "exact" })
        .eq("empresa_id", empresaId!)
        .gte("created_at", diaInicio.toISOString())
        .lte("created_at", diaFim.toISOString())
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (tab === "finalizados") q = q.eq("status", "finalizado");
      if (tab === "cancelados")  q = q.eq("status", "cancelado");
      const { data: rows, count } = await q;
      return { items: rows ?? [], total: count ?? 0 };
    },
  });

  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("entregadores").select("id,nome").eq("empresa_id", empresaId!).eq("ativo", true).eq("tipo", "fixo").order("nome")).data ?? [],
  });

  // IDs únicos de entregadores referenciados nos pedidos paginados
  const entregadorIdsPag = useMemo(() => {
    const ids = new Set<string>();
    (pedidosPag?.items ?? []).forEach((p: any) => { if (p.entregador_id) ids.add(p.entregador_id); });
    return [...ids];
  }, [pedidosPag?.items]);

  // Fetch secundário: detalhes dos entregadores para abas históricas
  const { data: entregadoresPag = [] } = useQuery({
    queryKey: ["entregadores-pag", entregadorIdsPag],
    enabled: entregadorIdsPag.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("entregadores")
        .select("id,nome,telefone,veiculo,placa")
        .in("id", entregadorIdsPag);
      return data ?? [];
    },
  });

  const entregadoresMap = useMemo(() => {
    const m: Record<string, any> = {};
    entregadoresPag.forEach((e: any) => { m[e.id] = e; });
    return m;
  }, [entregadoresPag]);

  const filtered    = tab === "ativos" ? pedidosAtivos : (pedidosPag?.items ?? []);
  const totalAtivos = pedidosAtivos.length;
  const totalPages  = tab !== "ativos" ? Math.ceil((pedidosPag?.total ?? 0) / PAGE_SIZE) : 1;
  const totalItems  = pedidosPag?.total ?? 0;

  async function rpcPedido(pedidoId: string, params: {
    status?: string;
    entregador_id?: string | null;
    entregador_nome?: string | null;
    desconto?: number;
  }): Promise<string | null> {
    const { data, error } = await (supabase as any).rpc("empresa_atualizar_pedido", {
      p_pedido_id:       pedidoId,
      p_status:          params.status          ?? null,
      p_entregador_id:   params.entregador_id   ?? null,
      p_entregador_nome: params.entregador_nome ?? null,
      p_desconto:        params.desconto        ?? null,
    });
    if (error) return error.message;
    if (data?.error) return data.error;
    return null;
  }

  async function advance(p: any, entregadorId?: string) {
    const comPreparo = precisaPreparo(p);
    const nextMap = p.tipo === "pdv"
      ? NEXT_PDV
      : p.tipo === "retirada"
        ? (comPreparo ? NEXT_RETIRADA : NEXT_RETIRADA_SEM_PREPARO)
        : p.mesa
          ? (comPreparo ? NEXT_MESA : NEXT_MESA_SEM_PREPARO)
          : (comPreparo ? NEXT : NEXT_SEM_PREPARO);
    const next = nextMap[p.status];
    if (!next) return;
    const params: Parameters<typeof rpcPedido>[1] = { status: next };
    if (next === "entrega") {
      // Auto-atribui se só 1 entregador fixo; caso contrário usa seleção manual
      const assignId = entregadorId || (entregadores.length === 1 ? entregadores[0].id : null);
      if (assignId) {
        const ent = entregadores.find((e: any) => e.id === assignId);
        params.entregador_id   = assignId;
        params.entregador_nome = ent?.nome ?? null;
      }
    }
    const err = await rpcPedido(p.id, params);
    if (err) { toast.error(traduzirErro(err)); return; }
    qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
  }

  async function confirmarPedido(p: any) {
    const err = await rpcPedido(p.id, { status: "aguardando_pagamento" });
    if (err) { toast.error(traduzirErro(err)); return; }
    qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
    toast.success(`Pedido #${p.numero} confirmado!`);
  }

  async function confirmarPagamento(p: any) {
    const err = await rpcPedido(p.id, { status: "aceito" });
    if (err) { toast.error(traduzirErro(err)); return; }
    qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
    toast.success(`Pagamento do pedido #${p.numero} confirmado!`);
  }

  async function cancel(id: string) {
    const err = await rpcPedido(id, { status: "cancelado" });
    if (err) { toast.error(traduzirErro(err)); return; }
    toast.success("Pedido cancelado");
    qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
  }

  async function aplicarDesconto(pedido: any) {
    const raw = (descontoInput[pedido.id] ?? "").replace(",", ".");
    const valor = parseFloat(raw);
    const totalBruto = Number(pedido.subtotal) + Number(pedido.taxa_entrega);
    if (isNaN(valor) || valor < 0) { toast.error("Valor de desconto inválido"); return; }
    if (valor >= totalBruto) { toast.error("Desconto não pode ser maior que o total"); return; }
    const err = await rpcPedido(pedido.id, { desconto: valor });
    if (err) { toast.error(traduzirErro(err)); return; }
    setDescontoInput((s) => ({ ...s, [pedido.id]: "" }));
    qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
    toast.success(`Desconto de ${fmt(valor)} aplicado!`);
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    toast.success("Pedido excluído");
    qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
  }

  async function exportarCSV() {
    if (!empresaId) return;
    setExportando(true);
    try {
      let q = supabase.from("pedidos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      if (tab !== "ativos") {
        q = (q as any).gte("created_at", diaInicio.toISOString()).lte("created_at", diaFim.toISOString());
      }
      if (tab === "finalizados") q = q.eq("status", "finalizado");
      if (tab === "cancelados")  q = q.eq("status", "cancelado");
      if (tab === "ativos")      q = (q as any).in("status", ATIVOS);
      const { data: rows } = await q;
      const csv = gerarCSV((rows ?? []) as any[], COLUNAS_PEDIDOS);
      const sufixo = tab === "todos" ? "todos" : tab;
      const dataStr = dataSel.toLocaleDateString("pt-BR").replace(/\//g, "-");
      baixarCSV(csv, `pedidos_${sufixo}_${dataStr}.csv`);
    } finally {
      setExportando(false);
    }
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const limites = PLANO_LIMITS[plano];
  const pedidosMes = useMemo(() => {
    if (!limites.pedidos) return 0;
    const inicio = new Date();
    inicio.setDate(1); inicio.setHours(0, 0, 0, 0);
    return (pedidosAtivos as any[]).filter((p) => new Date(p.created_at) >= inicio).length;
  }, [pedidosAtivos, limites.pedidos]);

  return (
    <>
      {editarPedido && (
        <EditarItensModal
          pedido={editarPedido}
          onClose={() => setEditarPedido(null)}
          onSave={() => {
            setEditarPedido(null);
            qc.invalidateQueries({ queryKey: ["pedidos-ativos", empresaId] });
            qc.invalidateQueries({ queryKey: ["pedidos-pag", empresaId] });
          }}
        />
      )}
      <PageHeader
        title="Pedidos"
        subtitle="Acompanhe e atualize os pedidos em tempo real"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportarCSV} disabled={exportando} className="gap-1.5 text-zinc-600">
              <Download className="size-3.5" />
              {exportando ? "Exportando…" : "CSV"}
            </Button>
            <button
              onClick={() => {
                setSomAtivo((v) => {
                  toast(v ? "Som desativado" : "Som ativado");
                  return !v;
                });
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                somAtivo
                  ? "border-brand/30 bg-brand/5 text-brand hover:bg-brand/10"
                  : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
              }`}
            >
              {somAtivo ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              {somAtivo ? "Som ligado" : "Som mudo"}
            </button>
          </div>
        }
      />
      {limites.pedidos !== null && (
        <LimiteBanner atual={pedidosMes} limite={limites.pedidos} tipo="pedidos este mês" minPlano="profissional" />
      )}

      {/* Banner para ativar notificações do navegador */}
      {notifPermissao === "default" && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              Ative as notificações para ser avisado ao receber pedidos, mesmo com a aba minimizada.
            </p>
          </div>
          <Button size="sm" onClick={pedirPermissaoNotificacao}
            className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0">
            Ativar agora
          </Button>
        </div>
      )}
      {notifPermissao === "denied" && !isIos && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <BellOff className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            Notificações bloqueadas no navegador. Para ativar: clique no cadeado na barra de endereço → Notificações → Permitir.
          </p>
        </div>
      )}
      {isIos && !isStandalone && (
        <div className="mb-4 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-xl shrink-0">📲</span>
          <div>
            <p className="text-sm font-semibold text-blue-800">Instale o app para receber notificações no iPhone/iPad</p>
            <p className="text-xs text-blue-700 mt-0.5">
              No Safari: toque em <strong>Compartilhar</strong> (ícone de caixinha com seta) → <strong>Adicionar à Tela de Início</strong> → Abrir pelo ícone criado.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit ring-1 ring-black/5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t.id ? "bg-background text-ink shadow-sm" : "text-zinc-500 hover:text-ink"
              }`}
            >
              {t.label}
              {t.id === "ativos" && totalAtivos > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand text-white">{totalAtivos}</span>
              )}
            </button>
          ))}
        </div>

        {/* Navegação por dia — só nas tabs não-ativas */}
        {tab !== "ativos" && (
          <div className="flex items-center gap-1 bg-surface rounded-lg p-1 ring-1 ring-black/5">
            <button
              onClick={() => { const d = new Date(dataSel); d.setDate(d.getDate() - 1); setDataSel(d); }}
              className="p-1.5 rounded-md text-zinc-500 hover:bg-background hover:text-ink transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-ink min-w-[80px] text-center">
              {diaLabel(dataSel)}
            </span>
            <button
              onClick={() => { const d = new Date(dataSel); d.setDate(d.getDate() + 1); setDataSel(d); }}
              disabled={isHoje}
              className="p-1.5 rounded-md text-zinc-500 hover:bg-background hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Resumo do dia — só na aba Finalizados */}
      {tab === "finalizados" && resumoDia && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-xs text-green-600 font-medium">Pedidos finalizados</p>
            <p className="text-2xl font-black text-green-700 mt-0.5">{resumoDia.qtd}</p>
          </div>
          <div className="bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
            <p className="text-xs text-brand font-medium">Faturamento</p>
            <p className="text-2xl font-black text-brand mt-0.5">{fmt(resumoDia.totalDia)}</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-500 font-medium">Ticket médio</p>
            <p className="text-2xl font-black text-zinc-700 mt-0.5">{fmt(resumoDia.ticket)}</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-500 font-medium mb-1">Por forma</p>
            {Object.entries(resumoDia.porForma).map(([forma, val]) => (
              <div key={forma} className="flex justify-between text-xs text-zinc-600">
                <span>{forma}</span>
                <span className="font-semibold">{fmt(val as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p: any) => {
          const tone = STATUS.find((s) => s.value === p.status);
          const isAtivo = ATIVOS.includes(p.status);
          return (
            <div key={p.id} className="bg-background rounded-xl ring-1 ring-black/5 p-3 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-ink">#{p.numero}</span>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${tone?.tone}`}>{tone?.label}</span>
                    {p.mesa && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 uppercase tracking-wide">🪑 {p.mesa}</span>
                    )}
                    {p.tipo === "pdv" && !p.mesa && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-violet-100 text-violet-600 uppercase tracking-wide">PDV</span>
                    )}
                    {p.tipo === "retirada" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-teal-100 text-teal-700 uppercase tracking-wide">🏪 Retirada</span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-600 mt-1">{p.cliente_nome} • {p.cliente_telefone || "—"}</div>
                  {p.entregador_id && (() => {
                    const ent = tab === "ativos"
                      ? { nome: p.entregador_nome, telefone: p.entregador_telefone, veiculo: p.entregador_veiculo, placa: p.entregador_placa }
                      : { nome: entregadoresMap[p.entregador_id]?.nome ?? p.entregador_nome, telefone: entregadoresMap[p.entregador_id]?.telefone, veiculo: entregadoresMap[p.entregador_id]?.veiculo, placa: entregadoresMap[p.entregador_id]?.placa };
                    if (!ent.nome) return null;
                    return (
                      <div className="flex items-start gap-1.5 mt-1 text-xs text-purple-700 bg-purple-50 rounded-lg px-2 py-1.5">
                        <Bike className="size-3 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{ent.nome}</span>
                          {ent.veiculo && <span className="text-purple-500"> · {VEICULO_LABEL[ent.veiculo] ?? ent.veiculo}</span>}
                          {ent.placa && <span className="text-purple-500"> · {ent.placa.toUpperCase()}</span>}
                          {ent.telefone && <span className="text-purple-500"> · {ent.telefone}</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {p.cliente_endereco && <div className="text-xs text-zinc-500">{p.cliente_endereco}</div>}
                  {(p.cliente_cep || p.cliente_cidade) && (
                    <div className="text-xs text-zinc-400">{[p.cliente_cep, p.cliente_cidade].filter(Boolean).join(" — ")}</div>
                  )}
                  {p.cliente_cpf && <div className="text-xs text-zinc-400">CPF: {p.cliente_cpf}</div>}
                  {p.observacao && <div className="text-xs text-zinc-500 italic mt-1">"{p.observacao}"</div>}
                </div>
                <div className="text-right">
                  {Number(p.desconto) > 0 ? (
                    <div>
                      <div className="text-xs line-through text-zinc-400">{fmt(Number(p.total))}</div>
                      <div className="text-lg font-semibold text-green-600">{fmt(Number(p.total) - Number(p.desconto))}</div>
                      <div className="text-xs text-green-600 font-medium">-{fmt(Number(p.desconto))} desconto</div>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-ink">{fmt(Number(p.total))}</div>
                  )}
                  <div className="text-xs text-zinc-500">{p.forma_pagamento ?? "—"}</div>
                  {(p as any).pagamento_online_status === "aprovado" && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-700 uppercase tracking-wide">✓ Pago online</span>
                  )}
                  {(p as any).pagamento_online_status === "pendente" && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 uppercase tracking-wide">⏳ Aguard. pagto</span>
                  )}
                  {(p as any).pagamento_online_status === "recusado" && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 uppercase tracking-wide">✗ Pagto recusado</span>
                  )}
                  {Number(p.taxa_entrega) > 0 && (
                    <div className="text-xs text-zinc-400">+ {fmt(Number(p.taxa_entrega))} entrega</div>
                  )}
                </div>
              </div>

              {p.pedido_itens?.length > 0 && (
                <ul className="mt-3 pt-3 border-t border-black/5 text-sm text-zinc-600 space-y-1">
                  {p.pedido_itens.map((i: any) => (
                    <li key={i.id} className="flex justify-between">
                      <span>{i.quantidade}× {i.nome}{i.observacao ? ` (${i.observacao})` : ""}</span>
                      <span className="font-medium">{fmt(Number(i.subtotal))}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {/* Imprimir — sempre visível */}
                <Button size="sm" variant="outline"
                  onClick={() => imprimirPedido(p, empresa?.nome_fantasia ?? "Estabelecimento")}
                  className="gap-1.5 text-zinc-600 hover:text-zinc-900">
                  <Printer className="size-3.5" /> Imprimir
                </Button>

                {isAtivo && (p.pedido_itens?.length ?? 0) > 1 && (
                  <Button size="sm" variant="outline"
                    onClick={() => setEditarPedido(p)}
                    className="gap-1.5 text-amber-600 hover:text-amber-700 border-amber-200 hover:bg-amber-50">
                    <Pencil className="size-3.5" /> Editar itens
                  </Button>
                )}

                {/* Notificar cliente via WhatsApp */}
                {p.cliente_telefone && MSGS[p.status] && (
                  <Button size="sm" variant="outline"
                    onClick={() => notificarWhatsApp(p, empresa)}
                    className="gap-1.5 text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50">
                    <MessageCircle className="size-3.5" /> Notificar
                  </Button>
                )}

                {isAtivo && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Desconto R$"
                        value={descontoInput[p.id] ?? ""}
                        onChange={(e) => setDescontoInput((s) => ({ ...s, [p.id]: e.target.value }))}
                        className="h-9 w-28 rounded-xl border border-zinc-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-zinc-400"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!descontoInput[p.id]}
                        onClick={() => aplicarDesconto(p)}
                        className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 disabled:opacity-40"
                      >
                        Aplicar
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => cancel(p.id)} className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50">
                      Cancelar
                    </Button>
                    {p.status === "aguardando_confirmacao" && (
                      <Button onClick={() => confirmarPedido(p)} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
                        ✓ Confirmar Pedido
                      </Button>
                    )}
                    {p.status === "aguardando_pagamento" && (
                      <Button onClick={() => confirmarPagamento(p)} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                        💰 Confirmar Pagamento
                      </Button>
                    )}
                    {(() => {
                      const comPreparo = precisaPreparo(p);
                      const nextMap = p.tipo === "pdv"
                        ? NEXT_PDV
                        : p.tipo === "retirada"
                          ? (comPreparo ? NEXT_RETIRADA : NEXT_RETIRADA_SEM_PREPARO)
                          : p.mesa
                            ? (comPreparo ? NEXT_MESA : NEXT_MESA_SEM_PREPARO)
                            : (comPreparo ? NEXT : NEXT_SEM_PREPARO);
                      const nextStatus = nextMap[p.status];
                      if (!nextStatus) return null;

                      // Lojista não pode finalizar pedido que está em rota com entregador ativo
                      if (nextStatus === "finalizado" && p.status === "entrega" && p.entregador_id) {
                        return (
                          <span className="text-xs text-zinc-500 flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
                            🛵 Aguardando entregador finalizar
                          </span>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2">
                          {/* Seletor de entregador — só para delivery com múltiplos fixos */}
                          {!p.mesa && p.tipo !== "pdv" && p.tipo !== "retirada" && NEXT[p.status] === "entrega" && entregadores.length > 1 && (
                            <select
                              value={entregadorSel[p.id] ?? ""}
                              onChange={(e) => setEntregadorSel((s) => ({ ...s, [p.id]: e.target.value }))}
                              className="h-11 sm:h-9 rounded-xl border border-zinc-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                            >
                              <option value="">Selecionar entregador</option>
                              {entregadores.map((e: any) => (
                                <option key={e.id} value={e.id}>{e.nome}</option>
                              ))}
                            </select>
                          )}
                          {!p.mesa && p.tipo !== "pdv" && p.tipo !== "retirada" && NEXT[p.status] === "entrega" && entregadores.length === 1 && (
                            <span className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
                              🛵 {entregadores[0].nome} (auto)
                            </span>
                          )}
                          <Button onClick={() => advance(p, entregadorSel[p.id])} className="bg-brand hover:bg-brand/90">
                            Avançar → {STATUS.find((s) => s.value === nextStatus)?.label}
                          </Button>
                        </div>
                      );
                    })()}
                  </>
                )}

                {(p.status === "cancelado" || p.status === "finalizado") && (
                  <Button size="sm" variant="outline" onClick={() => excluir(p.id)} className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50 gap-1.5">
                    🗑 Excluir
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-sm text-zinc-500 py-16 rounded-xl ring-1 ring-black/5 bg-background">
            {tab === "ativos" ? "Nenhum pedido em aberto no momento." : "Nenhum pedido encontrado."}
          </div>
        )}
      </div>

      {/* Paginação */}
      {tab !== "ativos" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-zinc-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalItems)} de {totalItems} pedidos
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0}
              onClick={() => setPage((p) => p - 1)} className="gap-1">
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <span className="text-sm text-zinc-500 px-1">{page + 1}/{totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)} className="gap-1">
              Próxima <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
