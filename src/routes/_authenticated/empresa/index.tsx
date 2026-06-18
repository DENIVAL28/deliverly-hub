import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { ShoppingBag, TrendingUp, Clock, CheckCircle2, ChefHat, Bike, ArrowRight, Store, Copy, ExternalLink, UtensilsCrossed, Share2, Power, MessageCircle, Wallet, MapPin, RotateCcw, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { copiarTexto } from "@/lib/validacoes";

export const Route = createFileRoute("/_authenticated/empresa/")({
  component: EmpresaDashboard,
});

const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: any; urgente?: boolean }> = {
  aguardando_confirmacao: { label: "Confirmar",        cor: "bg-amber-100 text-amber-700 border-amber-200",   icon: Hourglass, urgente: true },
  aguardando_pagamento:   { label: "Aguard. PIX",      cor: "bg-blue-100 text-blue-700 border-blue-200",      icon: Wallet,    urgente: true },
  novo:       { label: "Novo",            cor: "bg-blue-100 text-blue-700 border-blue-200",   icon: ShoppingBag },
  aceito:     { label: "Aceito",          cor: "bg-amber-100 text-amber-700 border-amber-200", icon: CheckCircle2 },
  preparo:    { label: "Em preparo",      cor: "bg-orange-100 text-orange-700 border-orange-200", icon: ChefHat },
  entrega:    { label: "Saiu p/ entrega", cor: "bg-purple-100 text-purple-700 border-purple-200", icon: Bike },
  finalizado: { label: "Finalizado",      cor: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
};

const NEXT: Record<string, string> = {
  aguardando_confirmacao: "aceito",
  aguardando_pagamento:   "aceito",
  novo: "aceito", aceito: "preparo", preparo: "entrega", entrega: "finalizado",
};

const WA_NOTIF: Record<string, (p: any, origin: string) => string> = {
  aceito: (p, o) =>
    `✅ *Pedido #${p.numero} confirmado!*\n\nOlá ${p.cliente_nome}! Seu pedido foi aceito e logo entrará em preparo.\n\n🔗 Acompanhe ao vivo: ${o}/pedido/${p.id}`,
  preparo: (p, o) =>
    `👨‍🍳 *Pedido #${p.numero} em preparo!*\n\nOlá ${p.cliente_nome}! Sua encomenda está sendo preparada agora.\n\n🔗 Acompanhe: ${o}/pedido/${p.id}`,
  entrega: (p, o) =>
    `🛵 *Pedido #${p.numero} saiu para entrega!*\n\nOlá ${p.cliente_nome}! Seu pedido está a caminho e chegará em breve.\n\n🔗 Acompanhe: ${o}/pedido/${p.id}`,
  finalizado: (p, o) =>
    `🎉 *Pedido #${p.numero} entregue!*\n\nObrigado pela preferência, ${p.cliente_nome}! Esperamos que tenha gostado 😊\n\n🔗 Avaliar atendimento: ${o}/pedido/${p.id}`,
};

function PrimeiroPasso({
  numero, feito, titulo, desc, href, onClick, label, icon: Icon,
}: {
  numero: number; feito: boolean; titulo: string; desc: string;
  href?: string; onClick?: () => void; label: string; icon: any;
}) {
  const cls = "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline";
  return (
    <div className={`bg-white rounded-xl p-4 ring-1 ${feito ? "ring-green-200" : "ring-black/5"}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${feito ? "bg-green-500 text-white" : "bg-brand/10 text-brand"}`}>
          {feito ? "✓" : numero}
        </div>
        <Icon className={`size-4 ${feito ? "text-green-500" : "text-brand"}`} />
        <span className="font-semibold text-zinc-900 text-sm">{titulo}</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
      {!feito && (
        href
          ? <Link to={href as any} className={cls}>{label} <ArrowRight className="size-3" /></Link>
          : <button onClick={onClick} className={cls}>{label} <ArrowRight className="size-3" /></button>
      )}
    </div>
  );
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur);
    };
    play(880, 0, 0.15); play(1108, 0.18, 0.15); play(1320, 0.36, 0.3);
  } catch (_) {}
}

function EmpresaDashboard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isoToday = today.toISOString();

  const [lojaAberta, setLojaAberta] = useState<boolean | null | "auto">("auto");
  const [toggling, setToggling] = useState(false);

  // Dados da empresa (slug + nome + aberto + Z-API + horário)
  const { data: empresa } = useQuery({
    queryKey: ["empresa-info-dash", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("empresas").select("nome_fantasia,slug,aberto,zapi_instance,zapi_token,zapi_client_token,horario_abertura,horario_fechamento").eq("id", empresaId!).single()).data,
  });

  useEffect(() => {
    if (empresa) {
      const v = (empresa as any).aberto;
      setLojaAberta(v === null || v === undefined ? "auto" : v);
    }
  }, [empresa]);

  async function setStatusLoja(novoStatus: boolean | null) {
    if (!empresaId || toggling) return;
    setToggling(true);
    const { error } = await supabase.from("empresas").update({ aberto: novoStatus } as any).eq("id", empresaId);
    setToggling(false);
    if (error) { toast.error("Erro ao atualizar status da loja."); return; }
    setLojaAberta(novoStatus === null ? "auto" : novoStatus);
    qc.invalidateQueries({ queryKey: ["empresa-info-dash", empresaId] });
    const msgs = { true: "✅ Loja forçada aberta!", false: "🔴 Loja fechada manualmente.", null: "🔄 Loja em modo automático (segue horário)." };
    toast(msgs[String(novoStatus) as "true"|"false"|"null"], { duration: 4000 });
  }

  // Contagem total de pedidos (para detectar usuário novo)
  const { data: totalPedidos } = useQuery({
    queryKey: ["dashboard-total-pedidos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count } = await supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!);
      return count ?? 0;
    },
  });

  // Contagem de produtos
  const { data: totalProdutos } = useQuery({
    queryKey: ["dashboard-total-produtos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count } = await supabase.from("produtos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!);
      return count ?? 0;
    },
  });

  const lojaUrl = empresa?.slug ? `${window.location.origin}/loja/${empresa.slug}` : null;
  const isNovo = totalPedidos === 0;

  // Stats do dia
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", empresaId],
    enabled: !!empresaId,
    refetchInterval: 30000,
    queryFn: async () => {
      const [{ data: pedidosHoje }, { data: ontem }] = await Promise.all([
        supabase.from("pedidos").select("total,status").eq("empresa_id", empresaId!).gte("created_at", isoToday),
        supabase.from("pedidos").select("total").eq("empresa_id", empresaId!)
          .gte("created_at", new Date(today.getTime() - 86400000).toISOString())
          .lt("created_at", isoToday),
      ]);
      const todos = pedidosHoje ?? [];
      const faturamento = todos.filter(p => p.status !== "cancelado").reduce((s, p) => s + Number(p.total ?? 0), 0);
      const qtd = todos.filter(p => p.status !== "cancelado").length;
      const abertos = todos.filter(p => ["aguardando_confirmacao","aguardando_pagamento","novo","aceito","preparo","entrega"].includes(p.status)).length;
      const fatOntem = (ontem ?? []).filter(p => (p as any).status !== "cancelado").reduce((s, p) => s + Number(p.total ?? 0), 0);
      return { faturamento, qtd, abertos, ticket: qtd ? faturamento / qtd : 0, fatOntem };
    },
  });

  // Pedidos ativos (ao vivo) — inclui aguardando_confirmacao e aguardando_pagamento
  const { data: ativos = [] } = useQuery({
    queryKey: ["dashboard-ativos", empresaId],
    enabled: !!empresaId,
    refetchInterval: 10000,
    queryFn: async () =>
      (await supabase.from("pedidos").select("*, pedido_itens(*)")
        .eq("empresa_id", empresaId!)
        .in("status", ["aguardando_confirmacao","aguardando_pagamento","novo","aceito","preparo","entrega"] as any[])
        .order("created_at", { ascending: true })
      ).data ?? [],
  });

  // Últimos pedidos finalizados
  const { data: recentes = [] } = useQuery({
    queryKey: ["dashboard-recentes", empresaId],
    enabled: !!empresaId,
    refetchInterval: 30000,
    queryFn: async () =>
      (await supabase.from("pedidos").select("id,numero,cliente_nome,total,status,created_at")
        .eq("empresa_id", empresaId!)
        .in("status", ["finalizado","cancelado"])
        .gte("created_at", isoToday)
        .order("created_at", { ascending: false })
        .limit(5)
      ).data ?? [],
  });

  // Realtime — novos pedidos
  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase.channel(`dashboard-rt-${empresaId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["dashboard-stats", empresaId] });
          qc.invalidateQueries({ queryKey: ["dashboard-ativos", empresaId] });
          playBeep();
          toast(`🛒 Novo pedido #${payload.new.numero}!`, {
            description: `Cliente: ${payload.new.cliente_nome}`,
            duration: 10000,
          });
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard-ativos", empresaId] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats", empresaId] });
          qc.invalidateQueries({ queryKey: ["dashboard-recentes", empresaId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, qc]);

  async function enviarZAPI(telefone: string, mensagem: string): Promise<boolean> {
    const emp = empresa as any;
    if (!emp?.zapi_instance || !emp?.zapi_token) return false;
    const numero = telefone.replace(/\D/g, "");
    const phone = numero.startsWith("55") ? numero : `55${numero}`;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (emp.zapi_client_token) headers["Client-Token"] = emp.zapi_client_token;
      const res = await fetch(
        `https://api.z-api.io/instances/${emp.zapi_instance}/token/${emp.zapi_token}/send-text`,
        { method: "POST", headers, body: JSON.stringify({ phone, message: mensagem }) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async function notificarCliente(pedido: any, status: string) {
    const telefone = (pedido.cliente_telefone ?? "").replace(/\D/g, "");
    if (!telefone) { toast.error("Pedido sem telefone do cliente."); return; }
    const msgFn = WA_NOTIF[status];
    if (!msgFn) return;
    const mensagem = msgFn(pedido, window.location.origin);
    const enviado = await enviarZAPI(telefone, mensagem);
    if (enviado) {
      toast.success(`✅ Cliente notificado no WhatsApp!`);
    } else {
      const numero = telefone.startsWith("55") ? telefone : `55${telefone}`;
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
      toast(`📱 WhatsApp aberto`, { description: "Z-API não configurada — clique em Enviar no WhatsApp." });
    }
  }

  async function advance(pedido: any) {
    // PIX manual: confirmar → aguardando_pagamento (não pular para aceito)
    const next = pedido.status === "aguardando_confirmacao" && pedido.forma_pagamento === "PIX"
      ? "aguardando_pagamento"
      : NEXT[pedido.status];
    if (!next) return;
    await supabase.from("pedidos").update({ status: next as any }).eq("id", pedido.id);
    qc.invalidateQueries({ queryKey: ["dashboard-ativos", empresaId] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats", empresaId] });

    const label = STATUS_CONFIG[next]?.label ?? next;
    const telefone = (pedido.cliente_telefone ?? "").replace(/\D/g, "");
    if (telefone && WA_NOTIF[next]) {
      toast.loading(`Notificando ${pedido.cliente_nome}…`, { id: `notif-${pedido.id}` });
      await notificarCliente(pedido, next);
      toast.dismiss(`notif-${pedido.id}`);
    } else {
      toast.success(`#${pedido.numero} → ${label}`);
    }
  }

  const variacaoFat = stats?.fatOntem
    ? ((stats.faturamento - stats.fatOntem) / stats.fatOntem) * 100
    : null;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Sua operação em tempo real" />

      {/* Cards de stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Faturamento hoje */}
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Faturamento hoje</span>
            <div className="size-8 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp className="size-4 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900">{fmt(stats?.faturamento ?? 0)}</div>
          {variacaoFat !== null && (
            <div className={`text-xs mt-1 font-medium ${variacaoFat >= 0 ? "text-green-600" : "text-red-500"}`}>
              {variacaoFat >= 0 ? "▲" : "▼"} {Math.abs(variacaoFat).toFixed(0)}% vs ontem
            </div>
          )}
        </div>

        {/* Pedidos hoje */}
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pedidos hoje</span>
            <div className="size-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShoppingBag className="size-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900">{stats?.qtd ?? 0}</div>
          <div className="text-xs mt-1 text-zinc-400">Ticket médio {fmt(stats?.ticket ?? 0)}</div>
        </div>

        {/* Em aberto */}
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Em aberto agora</span>
            <div className={`size-8 rounded-xl flex items-center justify-center ${(stats?.abertos ?? 0) > 0 ? "bg-orange-50" : "bg-zinc-50"}`}>
              <Clock className={`size-4 ${(stats?.abertos ?? 0) > 0 ? "text-orange-500" : "text-zinc-400"}`} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-zinc-900">{stats?.abertos ?? 0}</div>
            {(stats?.abertos ?? 0) > 0 && (
              <span className="size-2 rounded-full bg-orange-500 animate-pulse" />
            )}
          </div>
          <div className="text-xs mt-1 text-zinc-400">pedidos aguardando ação</div>
        </div>

        {/* Toggle abrir/fechar loja */}
        <div className={`rounded-2xl ring-1 p-5 flex flex-col justify-between gap-3 transition-colors ${
          lojaAberta === true ? "bg-green-50 ring-green-200" : lojaAberta === false ? "bg-red-50 ring-red-200" : "bg-zinc-50 ring-zinc-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status da loja</span>
            <Power className={`size-4 ${lojaAberta === true ? "text-green-600" : lojaAberta === false ? "text-red-500" : "text-zinc-400"}`} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => setStatusLoja(null)} disabled={toggling}
              className={`py-2 rounded-xl text-xs font-bold transition-colors ${lojaAberta === "auto" ? "bg-zinc-700 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"} disabled:opacity-60`}>
              🔄 Auto
            </button>
            <button onClick={() => setStatusLoja(true)} disabled={toggling}
              className={`py-2 rounded-xl text-xs font-bold transition-colors ${lojaAberta === true ? "bg-green-500 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"} disabled:opacity-60`}>
              🟢 Abrir
            </button>
            <button onClick={() => setStatusLoja(false)} disabled={toggling}
              className={`py-2 rounded-xl text-xs font-bold transition-colors ${lojaAberta === false ? "bg-red-500 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"} disabled:opacity-60`}>
              🔴 Fechar
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 text-center -mt-1">
            {lojaAberta === "auto"
              ? (empresa as any)?.horario_abertura && (empresa as any)?.horario_fechamento
                ? `Automático · ${(empresa as any).horario_abertura}h – ${(empresa as any).horario_fechamento}h`
                : "Automático · configure o horário"
              : lojaAberta === true ? "Aberta manualmente" : "Fechada manualmente"}
          </p>
          {lojaUrl && (
            <div className="flex gap-2">
              <button
                onClick={async () => { await copiarTexto(lojaUrl) ? toast.success("Link copiado!") : toast.error("Falha ao copiar"); }}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold bg-white border border-zinc-200 text-zinc-600 rounded-lg py-1 hover:bg-zinc-50 transition-colors"
              >
                <Copy className="size-3" /> Copiar link
              </button>
              <a href={lojaUrl} target="_blank" rel="noreferrer"
                className="size-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Banner de boas-vindas para usuário novo */}
      {isNovo && (
        <div className="mb-8 bg-gradient-to-r from-brand/5 to-orange-50 border border-brand/20 rounded-2xl p-6">
          <h2 className="font-bold text-zinc-900 mb-1">Bem-vindo! Sua loja está no ar 🎉</h2>
          <p className="text-sm text-zinc-500 mb-5">Siga os passos abaixo para começar a receber pedidos:</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <PrimeiroPasso
              numero={1}
              feito={!!empresa?.nome_fantasia}
              titulo="Loja criada"
              desc="Seu estabelecimento já está cadastrado na plataforma."
              href="/empresa/configuracoes"
              label="Ver configurações"
              icon={Store}
            />
            <PrimeiroPasso
              numero={2}
              feito={(totalProdutos ?? 0) > 0}
              titulo="Cadastre produtos"
              desc="Adicione seus itens, fotos e preços no cardápio."
              href="/empresa/produtos"
              label="Adicionar produtos"
              icon={UtensilsCrossed}
            />
            <PrimeiroPasso
              numero={3}
              feito={(totalPedidos ?? 0) > 0}
              titulo="Compartilhe o link"
              desc="Envie o link da sua loja para os seus clientes e comece a receber pedidos."
              onClick={lojaUrl ? async () => { await copiarTexto(lojaUrl) ? toast.success("Link copiado! Agora é só enviar.") : toast.error("Falha ao copiar"); } : undefined}
              label="Copiar link da loja"
              icon={Share2}
            />
          </div>
        </div>
      )}

      {/* Pedidos ativos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-zinc-900 flex items-center gap-2">
            Pedidos em aberto
            {ativos.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-brand text-white rounded-full">{ativos.length}</span>
            )}
          </h2>
          <Link to="/empresa/pedidos" className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="size-3" />
          </Link>
        </div>

        {ativos.length === 0 ? (
          <div className="bg-background rounded-2xl ring-1 ring-black/5 p-10 text-center">
            <CheckCircle2 className="size-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-medium">Tudo em dia — nenhum pedido em aberto.</p>
            {lojaUrl && (
              <button
                onClick={async () => { await copiarTexto(lojaUrl!) ? toast.success("Link copiado! Envie para seus clientes.") : toast.error("Falha ao copiar"); }}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
              >
                <Copy className="size-3" /> Copiar link da loja para divulgar
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ativos.map((p: any) => {
              const cfg = STATUS_CONFIG[p.status];
              const Icon = cfg?.icon ?? ShoppingBag;
              const tempoMin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
              const tipoIcon = p.tipo === "retirada" ? "🏪" : p.tipo === "mesa" ? "🪑" : "🛵";
              const tipoLabel = p.tipo === "retirada" ? "Retirada" : p.tipo === "mesa" ? `Mesa` : "Delivery";
              const pgIcon = p.forma_pagamento === "PIX" ? "💳 PIX" : p.forma_pagamento === "Dinheiro" ? "💵 Dinheiro" : "💳 Cartão";
              const isUrgente = cfg?.urgente;
              return (
                <div key={p.id} className={`bg-background rounded-2xl p-4 flex flex-col gap-3 transition-all ${
                  isUrgente ? "ring-2 ring-amber-400 shadow-amber-100 shadow-md" : "ring-1 ring-black/5"
                }`}>
                  {/* Badge urgente */}
                  {isUrgente && (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 -mb-1">
                      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-amber-700">
                        {p.status === "aguardando_confirmacao" ? "⚡ Cliente aguardando sua confirmação" : "⚡ Cliente aguardando pagamento PIX"}
                      </span>
                    </div>
                  )}

                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900">#{p.numero}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg?.cor}`}>
                          <Icon className="size-2.5" />
                          {cfg?.label}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-700 font-medium mt-0.5">{p.cliente_nome}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-zinc-500">{tipoIcon} {tipoLabel}</span>
                        <span className="text-zinc-300">·</span>
                        <span className="text-[11px] text-zinc-500">{pgIcon}</span>
                        {p.tipo === "delivery" && p.cliente_endereco && (
                          <>
                            <span className="text-zinc-300">·</span>
                            <span className="text-[11px] text-zinc-400 flex items-center gap-0.5 max-w-[120px] truncate">
                              <MapPin className="size-2.5 shrink-0" />{p.cliente_endereco}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-bold text-zinc-900">{fmt(Number(p.total))}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {tempoMin < 60 ? `${tempoMin} min atrás` : `${Math.floor(tempoMin/60)}h atrás`}
                      </div>
                    </div>
                  </div>

                  {/* Itens resumidos */}
                  {p.pedido_itens?.length > 0 && (
                    <div className="text-xs text-zinc-500 leading-relaxed">
                      {p.pedido_itens.slice(0, 3).map((i: any) => `${i.quantidade}× ${i.nome}`).join(" · ")}
                      {p.pedido_itens.length > 3 && ` +${p.pedido_itens.length - 3} mais`}
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2">
                    {NEXT[p.status] && (
                      <button onClick={() => advance(p)}
                        className={`flex-1 text-white rounded-xl h-9 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                          isUrgente ? "bg-amber-500 hover:bg-amber-400" : "bg-brand hover:bg-brand/90"
                        }`}>
                        {p.status === "aguardando_confirmacao"
                          ? <><RotateCcw className="size-3.5" /> Confirmar pedido</>
                          : p.status === "aguardando_pagamento"
                          ? <><CheckCircle2 className="size-3.5" /> PIX recebido</>
                          : <>Avançar → {STATUS_CONFIG[NEXT[p.status]]?.label}</>
                        }
                      </button>
                    )}
                    {p.cliente_telefone && WA_NOTIF[p.status] && (
                      <button
                        onClick={() => notificarCliente(p, p.status)}
                        title="Notificar cliente no WhatsApp"
                        className="size-9 shrink-0 rounded-xl bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors"
                      >
                        <MessageCircle className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Últimos finalizados hoje */}
      {recentes.length > 0 && (
        <div>
          <h2 className="font-bold text-zinc-900 mb-4">Concluídos hoje</h2>
          <div className="bg-background rounded-2xl ring-1 ring-black/5 divide-y divide-zinc-50">
            {recentes.map((p: any) => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-700">#{p.numero}</span>
                    <span className="text-sm text-zinc-500">{p.cliente_nome}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg?.cor}`}>
                      {cfg?.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-zinc-900">{fmt(Number(p.total))}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
