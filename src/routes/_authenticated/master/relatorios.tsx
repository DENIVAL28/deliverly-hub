import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  TrendingUp, ShoppingBag, Building2, DollarSign,
  Percent, UserPlus, Monitor, Smartphone, Download,
} from "lucide-react";
import { gerarCSV, baixarCSV, COLUNAS_PEDIDOS, COLUNAS_EMPRESAS_RELATORIO, fmtDataCurta } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/master/relatorios")({
  component: RelatoriosPage,
});

const PERIODOS = [
  { label: "7 dias",  days: 7  },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;

const STATUS_META: Record<string, { label: string; cor: string }> = {
  pendente:   { label: "Pendente",   cor: "#f59e0b" },
  confirmado: { label: "Confirmado", cor: "#3b82f6" },
  preparando: { label: "Preparando", cor: "#8b5cf6" },
  entrega:    { label: "Em entrega", cor: "#f97316" },
  finalizado: { label: "Finalizado", cor: "#22c55e" },
  cancelado:  { label: "Cancelado",  cor: "#ef4444" },
};

const CORES_PLANO: Record<string, string> = {
  basico:        "#94a3b8",
  profissional:  "#3b82f6",
  premium:       "#f59e0b",
};

const CORES_BAR = ["#F97316","#fb923c","#fdba74","#fed7aa","#ffedd5"];

function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodo);
    return d.toISOString();
  }, [periodo]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["relatorio-pedidos", periodo],
    queryFn: async () =>
      (await supabase
        .from("pedidos")
        .select("id,total,status,created_at,empresa_id,tipo,empresas(nome_fantasia)" as any)
        .gte("created_at", desde)
        .order("created_at")).data ?? [],
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["relatorio-empresas"],
    queryFn: async () =>
      (await supabase
        .from("empresas")
        .select("id,status,created_at,planos(nome,valor)")).data ?? [],
  });

  const { data: itensMaisVendidos = [] } = useQuery({
    queryKey: ["relatorio-itens", periodo],
    queryFn: async () =>
      (await supabase
        .from("pedido_itens")
        .select("nome,quantidade,pedidos!inner(created_at,status)")
        .gte("pedidos.created_at", desde)
        .neq("pedidos.status", "cancelado")).data ?? [],
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Métricas de pedidos ──
  const naoCanc        = (pedidos as any[]).filter((p) => p.status !== "cancelado");
  const totalFaturamento = naoCanc.reduce((s, p) => s + Number(p.total), 0);
  const totalPedidos     = naoCanc.length;
  const ticketMedio      = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
  const taxaConclusao    = pedidos.length > 0
    ? Math.round(((pedidos as any[]).filter((p) => p.status === "finalizado").length / pedidos.length) * 100)
    : 0;

  // ── Canal de pedidos: PDV vs Online ──
  const pdvCount    = naoCanc.filter((p) => p.tipo === "pdv").length;
  const onlineCount = naoCanc.filter((p) => p.tipo !== "pdv").length;

  // ── Métricas SaaS ──
  const mrr                  = (empresas as any[]).reduce((acc, e) => acc + (e.status === "ativa" ? Number(e.planos?.valor ?? 0) : 0), 0);
  const novasEmpresasPeriodo = (empresas as any[]).filter((e) => e.created_at >= desde).length;
  const totalEmpresasAtivas  = (empresas as any[]).filter((e) => e.status === "ativa").length;
  const empresasComPedidos   = new Set(naoCanc.map((p) => p.empresa_id)).size;

  // ── Distribuição por plano ──
  const porPlano = useMemo(() => {
    const map: Record<string, number> = {};
    (empresas as any[]).forEach((e) => {
      const nome = (e.planos as any)?.nome ?? "sem plano";
      map[nome] = (map[nome] ?? 0) + 1;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([nome, qtd]) => ({ nome, qtd, pct: total > 0 ? Math.round((qtd / total) * 100) : 0 }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [empresas]);

  // ── Status dos pedidos ──
  const porStatus = useMemo(() => {
    const map: Record<string, number> = {};
    (pedidos as any[]).forEach((p) => { map[p.status] = (map[p.status] ?? 0) + 1; });
    return Object.entries(map)
      .map(([s, qtd]) => ({ status: s, label: STATUS_META[s]?.label ?? s, qtd, cor: STATUS_META[s]?.cor ?? "#94a3b8" }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [pedidos]);

  // ── Faturamento por dia ──
  const porDia = useMemo(() => {
    const map: Record<string, number> = {};
    naoCanc.forEach((p) => {
      const dia = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      map[dia] = (map[dia] ?? 0) + Number(p.total);
    });
    return Object.entries(map).map(([dia, total]) => ({ dia, total })).slice(-periodo);
  }, [naoCanc, periodo]);

  // ── Faturamento por empresa ──
  const porEmpresa = useMemo(() => {
    const map: Record<string, { nome: string; total: number; pedidos: number }> = {};
    naoCanc.forEach((p) => {
      const nome = (p.empresas as any)?.nome_fantasia ?? "Desconhecida";
      if (!map[p.empresa_id]) map[p.empresa_id] = { nome, total: 0, pedidos: 0 };
      map[p.empresa_id].total   += Number(p.total);
      map[p.empresa_id].pedidos += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [naoCanc]);

  // ── Produtos mais vendidos ──
  const topProdutos = useMemo(() => {
    const map: Record<string, number> = {};
    (itensMaisVendidos as any[]).forEach((i) => { map[i.nome] = (map[i.nome] ?? 0) + Number(i.quantidade); });
    return Object.entries(map).map(([nome, qty]) => ({ nome, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [itensMaisVendidos]);

  function exportarPedidosCSV() {
    const csv = gerarCSV(pedidos as any[], COLUNAS_PEDIDOS);
    baixarCSV(csv, `pedidos_plataforma_${periodo}d_${fmtDataCurta(new Date()).replace(/\//g, "-")}.csv`);
  }

  function exportarEmpresasCSV() {
    const csv = gerarCSV(porEmpresa, COLUNAS_EMPRESAS_RELATORIO);
    baixarCSV(csv, `faturamento_empresas_${periodo}d_${fmtDataCurta(new Date()).replace(/\//g, "-")}.csv`);
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Visão geral da plataforma"
        action={
          <div className="flex items-center gap-2">
            <button onClick={exportarPedidosCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
              <Download className="size-3.5" /> Pedidos CSV
            </button>
            <div className="flex gap-1 bg-surface rounded-lg p-1 ring-1 ring-black/5">
              {PERIODOS.map(({ label, days }) => (
                <button key={days} onClick={() => setPeriodo(days as any)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    periodo === days ? "bg-background text-ink shadow-sm" : "text-zinc-500 hover:text-ink"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Linha 1 — Pedidos */}
      <div className="mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Pedidos — últimos {periodo} dias</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign}  label="GMV"             value={fmt(totalFaturamento)} color="text-green-600"  bg="bg-green-50"  />
          <StatCard icon={ShoppingBag} label="Pedidos"          value={totalPedidos}           color="text-blue-600"  bg="bg-blue-50"   />
          <StatCard icon={TrendingUp}  label="Ticket médio"     value={fmt(ticketMedio)}        color="text-brand"     bg="bg-orange-50" />
          <StatCard icon={Percent}     label="Taxa conclusão"   value={`${taxaConclusao}%`}     color="text-purple-600" bg="bg-purple-50"/>
        </div>
      </div>

      {/* Linha 2 — SaaS */}
      <div className="mb-8 mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Plataforma</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="MRR"               value={fmt(mrr)}               color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard icon={Building2}  label="Empresas ativas"   value={totalEmpresasAtivas}    color="text-sky-600"    bg="bg-sky-50"    />
          <StatCard icon={UserPlus}   label={`Novas (${periodo}d)`} value={novasEmpresasPeriodo} color="text-violet-600" bg="bg-violet-50"/>
          <StatCard icon={Building2}  label="Com pedidos"       value={empresasComPedidos}      color="text-zinc-600"   bg="bg-zinc-100"  />
        </div>
      </div>

      {/* Faturamento diário */}
      <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Faturamento diário (GMV)</h2>
        {porDia.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-zinc-400">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={porDia} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip formatter={(v: any) => [fmt(v), "Faturamento"]} labelStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="total" stroke="#F97316" strokeWidth={2} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Linha de 3 cards */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* Empresas por plano */}
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Empresas por plano</h2>
          {porPlano.length === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">Sem dados</div>
          ) : (
            <div className="space-y-3">
              {porPlano.map((p) => (
                <div key={p.nome}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-zinc-700 capitalize">{p.nome}</span>
                    <span className="font-semibold text-ink">
                      {p.qtd}{" "}
                      <span className="text-zinc-400 font-normal text-xs">({p.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${p.pct}%`, backgroundColor: CORES_PLANO[p.nome] ?? "#94a3b8" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status dos pedidos */}
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Status dos pedidos</h2>
          {porStatus.length === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">Sem dados no período</div>
          ) : (
            <div className="space-y-2.5">
              {porStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                    <span className="text-zinc-700">{s.label}</span>
                  </div>
                  <span className="font-semibold text-ink">{s.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canal de pedidos */}
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Canal de pedidos</h2>
          {totalPedidos === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">Sem pedidos no período</div>
          ) : (
            <div className="space-y-4">
              <CanalBar icon={Monitor}    label="PDV / Balcão" qtd={pdvCount}    total={totalPedidos} cor="#8b5cf6" />
              <CanalBar icon={Smartphone} label="Online"       qtd={onlineCount} total={totalPedidos} cor="#F97316" />
            </div>
          )}
        </div>
      </div>

      {/* Ranking empresas + produtos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">Faturamento por empresa</h2>
            {porEmpresa.length > 0 && (
              <button onClick={exportarEmpresasCSV}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                <Download className="size-3" /> CSV
              </button>
            )}
          </div>
          {porEmpresa.length === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">Sem dados no período</div>
          ) : (
            <div className="space-y-3">
              {porEmpresa.map((e, i) => (
                <div key={e.nome}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-zinc-700 truncate max-w-[60%]">{e.nome}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-zinc-400">{e.pedidos} pedidos</span>
                      <span className="font-semibold text-ink">{fmt(e.total)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(e.total / porEmpresa[0].total) * 100}%`, backgroundColor: CORES_BAR[i % CORES_BAR.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Produtos mais vendidos</h2>
          {topProdutos.length === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">Sem dados no período</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProdutos} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip formatter={(v: any) => [`${v} un.`, "Vendidos"]} />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {topProdutos.map((_, i) => <Cell key={i} fill={CORES_BAR[i % CORES_BAR.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <div className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
      <div className={`size-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`size-5 ${color}`} />
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="text-2xl font-bold text-ink mt-1">{value}</div>
    </div>
  );
}

function CanalBar({ icon: Icon, label, qtd, total, cor }: {
  icon: any; label: string; qtd: number; total: number; cor: string;
}) {
  const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <div className="flex items-center gap-2 text-zinc-700 font-medium">
          <Icon className="size-4" style={{ color: cor }} />
          {label}
        </div>
        <span className="font-semibold text-ink">
          {qtd} <span className="text-zinc-400 font-normal text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
    </div>
  );
}
