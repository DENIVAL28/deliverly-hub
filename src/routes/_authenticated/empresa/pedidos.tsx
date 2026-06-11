import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Printer, Bike, MessageCircle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { gerarCSV, baixarCSV, COLUNAS_PEDIDOS } from "@/lib/exportar";
import { toast } from "sonner";
import { LimiteBanner } from "@/components/UpgradeGuard";
import { traduzirErro } from "@/lib/erros";
import { PLANO_LIMITS } from "@/lib/plano";

const STATUS: { value: string; label: string; tone: string }[] = [
  { value: "novo",       label: "Novo",            tone: "bg-blue-100 text-blue-700" },
  { value: "aceito",     label: "Aceito",           tone: "bg-amber-100 text-amber-700" },
  { value: "preparo",    label: "Em preparo",       tone: "bg-orange-100 text-brand" },
  { value: "entrega",    label: "Saiu p/ entrega",  tone: "bg-purple-100 text-purple-700" },
  { value: "finalizado", label: "Finalizado",       tone: "bg-green-100 text-green-700" },
  { value: "cancelado",  label: "Cancelado",        tone: "bg-red-100 text-red-700" },
];

const NEXT: Record<string, string> = {
  novo: "aceito", aceito: "preparo", preparo: "entrega", entrega: "finalizado",
};

// Mesa e PDV: pulam a etapa de entrega
const NEXT_MESA: Record<string, string> = {
  novo: "aceito", aceito: "preparo", preparo: "finalizado", entrega: "finalizado",
};
const NEXT_PDV = NEXT_MESA;

const ATIVOS = ["novo", "aceito", "preparo", "entrega"];
const PAGE_SIZE = 20;

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
  aceito:     (p, e) => `Olá ${p.cliente_nome}! 👋\n\nSeu pedido *#${p.numero}* foi *confirmado* pelo ${e}! 🎉\n\nEstamos preparando tudo com carinho para você.`,
  preparo:    (p, e) => `Olá ${p.cliente_nome}! 👨‍🍳\n\nSeu pedido *#${p.numero}* está *em preparo* agora!\n\nEm breve estará prontinho.`,
  entrega:    (p, e) => `Olá ${p.cliente_nome}! 🛵\n\nSeu pedido *#${p.numero}* *saiu para entrega*!${p.entregador_nome ? `\n\nEntregador: *${p.entregador_nome}*` : ""}\n\nFique de olho, já já chega! 😄`,
  finalizado: (p, e) => `Olá ${p.cliente_nome}! ✅\n\nSeu pedido *#${p.numero}* foi *entregue*!\n\nEsperamos que tenha gostado. Avalie seu pedido:\n${window.location.origin}/pedido/${p.id}`,
  cancelado:  (p, e) => `Olá ${p.cliente_nome}.\n\nInfelizmente seu pedido *#${p.numero}* foi *cancelado*.\n\nEntre em contato conosco para mais informações.`,
};

function notificarWhatsApp(p: any, nomeEmpresa: string) {
  const msg = MSGS[p.status]?.(p, nomeEmpresa);
  if (!msg || !p.cliente_telefone) return;
  const tel = p.cliente_telefone.replace(/\D/g, "");
  window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ─── Impressão do pedido ─── */
function imprimirPedido(p: any, nomeEmpresa: string) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const data = new Date(p.created_at).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const itens = (p.pedido_itens ?? [])
    .map((i: any) => `
      <tr>
        <td style="padding:3px 0">${i.quantidade}x ${i.nome}${i.observacao ? `<br><small style="color:#666">${i.observacao}</small>` : ""}</td>
        <td style="text-align:right;padding:3px 0;white-space:nowrap">${fmt(Number(i.subtotal))}</td>
      </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Pedido #${p.numero}</title>
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
  <div class="center bold" style="font-size:15px">${nomeEmpresa}</div>
  <div class="center" style="margin-top:2px;font-size:11px">${data}</div>
  <div class="line"></div>
  <div class="center bold" style="font-size:18px">PEDIDO #${p.numero}</div>
  <div class="line"></div>
  <div><b>Cliente:</b> ${p.cliente_nome}</div>
  ${p.cliente_telefone ? `<div><b>Telefone:</b> ${p.cliente_telefone}</div>` : ""}
  ${p.cliente_endereco ? `<div><b>Endereço:</b> ${p.cliente_endereco}</div>` : ""}
  <div class="line"></div>
  <table>${itens}</table>
  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(p.subtotal))}</td></tr>
    ${Number(p.taxa_entrega) > 0 ? `<tr><td>Taxa de entrega</td><td style="text-align:right">${fmt(Number(p.taxa_entrega))}</td></tr>` : ""}
    <tr><td class="total">TOTAL</td><td class="total" style="text-align:right">${fmt(Number(p.total))}</td></tr>
  </table>
  <div class="line"></div>
  <div><b>Pagamento:</b> ${p.forma_pagamento ?? "—"}</div>
  ${p.observacao ? `<div><b>Obs:</b> ${p.observacao}</div>` : ""}
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

function PedidosPage() {
  const { empresaId, plano } = useAuth();
  const qc = useQueryClient();

  const { data: empresa } = useQuery({
    queryKey: ["empresa-info", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("empresas").select("nome_fantasia").eq("id", empresaId!).single()).data,
  });
  const [tab, setTab] = useState<Tab>("ativos");
  const [somAtivo, setSomAtivo] = useState(true);
  const [entregadorSel, setEntregadorSel] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [dataSel, setDataSel] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const somAtivoRef = useRef(true);
  somAtivoRef.current = somAtivo;

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
          if (somAtivoRef.current) {
            playBeep();
            toast(`🛒 Novo pedido #${payload.new.numero} chegou!`, {
              description: `Cliente: ${payload.new.cliente_nome}`,
              duration: 10000,
              action: { label: "Ver", onClick: () => {} },
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
  const { data: pedidosAtivos = [] } = useQuery({
    queryKey: ["pedidos-ativos", empresaId],
    enabled: !!empresaId,
    refetchInterval: 8000,
    queryFn: async () =>
      (await supabase.from("pedidos").select("*, pedido_itens(*)")
        .eq("empresa_id", empresaId!)
        .in("status", ATIVOS as any)
        .order("created_at", { ascending: false })).data ?? [],
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
      (await supabase.from("entregadores").select("id,nome").eq("empresa_id", empresaId!).eq("ativo", true).order("nome")).data ?? [],
  });

  const filtered    = tab === "ativos" ? pedidosAtivos : (pedidosPag?.items ?? []);
  const totalAtivos = pedidosAtivos.length;
  const totalPages  = tab !== "ativos" ? Math.ceil((pedidosPag?.total ?? 0) / PAGE_SIZE) : 1;
  const totalItems  = pedidosPag?.total ?? 0;

  async function advance(p: any, entregadorId?: string) {
    const nextMap = p.mesa ? NEXT_MESA : NEXT;
    const next = nextMap[p.status];
    if (!next) return;
    const update: any = { status: next };
    if (next === "entrega" && entregadorId) {
      const ent = entregadores.find((e: any) => e.id === entregadorId);
      update.entregador_id = entregadorId;
      update.entregador_nome = ent?.nome ?? null;
    }
    const { error } = await supabase.from("pedidos").update(update).eq("id", p.id);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    qc.invalidateQueries({ queryKey: ["pedidos", empresaId] });
  }

  async function cancel(id: string) {
    const { error } = await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", id);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    toast.success("Pedido cancelado");
    qc.invalidateQueries({ queryKey: ["pedidos", empresaId] });
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    toast.success("Pedido excluído");
    qc.invalidateQueries({ queryKey: ["pedidos", empresaId] });
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

      <div className="space-y-3">
        {filtered.map((p: any) => {
          const tone = STATUS.find((s) => s.value === p.status);
          const isAtivo = ATIVOS.includes(p.status);
          return (
            <div key={p.id} className="bg-background rounded-xl ring-1 ring-black/5 p-5">
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
                  {p.entregador_nome && (
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-medium mt-0.5">
                      <Bike className="size-3" /> {p.entregador_nome}
                    </div>
                  )}
                  {p.cliente_endereco && <div className="text-xs text-zinc-500">{p.cliente_endereco}</div>}
                  {p.observacao && <div className="text-xs text-zinc-500 italic mt-1">"{p.observacao}"</div>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-ink">{fmt(Number(p.total))}</div>
                  <div className="text-xs text-zinc-500">{p.forma_pagamento ?? "—"}</div>
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

                {/* Notificar cliente via WhatsApp */}
                {p.cliente_telefone && MSGS[p.status] && (
                  <Button size="sm" variant="outline"
                    onClick={() => notificarWhatsApp(p, empresa?.nome_fantasia ?? "Estabelecimento")}
                    className="gap-1.5 text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50">
                    <MessageCircle className="size-3.5" /> Notificar
                  </Button>
                )}

                {isAtivo && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => cancel(p.id)} className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50">
                      Cancelar
                    </Button>
                    {(p.tipo === "pdv" ? NEXT_PDV : p.mesa ? NEXT_MESA : NEXT)[p.status] && (
                      <div className="flex items-center gap-2">
                        {/* Seletor de entregador — apenas para delivery (não PDV, não mesa) */}
                        {!p.mesa && p.tipo !== "pdv" && NEXT[p.status] === "entrega" && entregadores.length > 0 && (
                          <select
                            value={entregadorSel[p.id] ?? ""}
                            onChange={(e) => setEntregadorSel((s) => ({ ...s, [p.id]: e.target.value }))}
                            className="h-9 rounded-xl border border-zinc-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                          >
                            <option value="">Entregador (opcional)</option>
                            {entregadores.map((e: any) => (
                              <option key={e.id} value={e.id}>{e.nome}</option>
                            ))}
                          </select>
                        )}
                        <Button onClick={() => advance(p, entregadorSel[p.id])} className="bg-brand hover:bg-brand/90">
                          Avançar → {STATUS.find((s) => s.value === (p.tipo === "pdv" ? NEXT_PDV : p.mesa ? NEXT_MESA : NEXT)[p.status])?.label}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {p.status === "cancelado" && (
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
