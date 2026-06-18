import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { TrendingUp, ShoppingBag, Users, DollarSign } from "lucide-react";
import { PreviewBloqueado } from "@/components/UpgradeGuard";

export const Route = createFileRoute("/_authenticated/empresa/relatorios")({
  component: RelatoriosEmpresaPage,
});

const PERIODOS = [
  { label: "7 dias",  days: 7  },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;

const CORES = ["#F97316","#fb923c","#fdba74","#fed7aa","#ffedd5"];

const FAKE_POR_DIA = [
  { dia: "10/06", total: 320 }, { dia: "11/06", total: 480 }, { dia: "12/06", total: 290 },
  { dia: "13/06", total: 650 }, { dia: "14/06", total: 870 }, { dia: "15/06", total: 540 },
  { dia: "16/06", total: 730 }, { dia: "17/06", total: 920 }, { dia: "18/06", total: 610 },
];
const FAKE_PRODUTOS = [
  { nome: "X-Burguer",        qty: 34, total: 850  },
  { nome: "Batata Frita",     qty: 28, total: 336  },
  { nome: "Frango Grelhado",  qty: 21, total: 630  },
  { nome: "Refrigerante",     qty: 19, total: 114  },
  { nome: "Salada Caesar",    qty: 12, total: 300  },
];
const FAKE_PAGAMENTO = [
  { nome: "PIX",     qty: 42 },
  { nome: "Cartão",  qty: 27 },
  { nome: "Dinheiro",qty: 11 },
];

function RelatoriosEmpresaPage() {
  const { empresaId, plano } = useAuth();
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);
  const bloqueado = plano === "basico";

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodo);
    return d.toISOString();
  }, [periodo]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["emp-relatorio-pedidos", empresaId, periodo],
    enabled: !!empresaId && !bloqueado,
    queryFn: async () =>
      (await supabase
        .from("pedidos")
        .select("id,total,status,created_at,cliente_nome,forma_pagamento")
        .eq("empresa_id", empresaId!)
        .gte("created_at", desde)
        .neq("status", "cancelado")
        .order("created_at")).data ?? [],
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["emp-relatorio-itens", empresaId, periodo],
    enabled: !!empresaId && !bloqueado,
    queryFn: async () =>
      (await supabase
        .from("pedido_itens")
        .select("nome,quantidade,subtotal,pedidos!inner(created_at,status,empresa_id)")
        .eq("pedidos.empresa_id", empresaId!)
        .gte("pedidos.created_at", desde)
        .neq("pedidos.status", "cancelado")).data ?? [],
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalFaturamento = bloqueado ? 5410 : pedidos.reduce((s: number, p: any) => s + Number(p.total), 0);
  const totalPedidos     = bloqueado ? 80   : pedidos.length;
  const ticketMedio      = bloqueado ? 67.6 : (totalPedidos > 0 ? totalFaturamento / totalPedidos : 0);
  const totalClientes    = bloqueado ? 38   : new Set(pedidos.map((p: any) => p.cliente_nome)).size;

  const porDia = useMemo(() => {
    if (bloqueado) return FAKE_POR_DIA;
    const map: Record<string, number> = {};
    pedidos.forEach((p: any) => {
      const dia = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      map[dia] = (map[dia] ?? 0) + Number(p.total);
    });
    return Object.entries(map).map(([dia, total]) => ({ dia, total }));
  }, [pedidos, bloqueado]);

  const topProdutos = useMemo(() => {
    if (bloqueado) return FAKE_PRODUTOS;
    const map: Record<string, { qty: number; total: number }> = {};
    itens.forEach((i: any) => {
      if (!map[i.nome]) map[i.nome] = { qty: 0, total: 0 };
      map[i.nome].qty   += Number(i.quantidade);
      map[i.nome].total += Number(i.subtotal);
    });
    return Object.entries(map)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [itens, bloqueado]);

  const porPagamento = useMemo(() => {
    if (bloqueado) return FAKE_PAGAMENTO;
    const map: Record<string, number> = {};
    pedidos.forEach((p: any) => {
      const f = p.forma_pagamento ?? "Outros";
      map[f] = (map[f] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([nome, qty]) => ({ nome, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [pedidos, bloqueado]);

  const content = (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign}  label="Faturamento"  value={fmt(totalFaturamento)} color="text-green-600"   bg="bg-green-50"   />
        <StatCard icon={ShoppingBag} label="Pedidos"      value={totalPedidos}           color="text-blue-600"   bg="bg-blue-50"    />
        <StatCard icon={TrendingUp}  label="Ticket médio" value={fmt(ticketMedio)}       color="text-brand"      bg="bg-orange-50"  />
        <StatCard icon={Users}       label="Clientes"     value={totalClientes}          color="text-purple-600" bg="bg-purple-50"  />
      </div>

      <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Faturamento diário</h2>
        {porDia.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-zinc-400">
            Nenhum pedido no período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={porDia} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
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

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Produtos mais vendidos</h2>
          {topProdutos.length === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">Sem dados no período</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProdutos} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                <Tooltip formatter={(v: any) => [`${v} un.`, "Vendidos"]} />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {topProdutos.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
            <h2 className="text-sm font-semibold text-ink mb-4">Forma de pagamento</h2>
            {porPagamento.length === 0 ? (
              <div className="text-sm text-zinc-400 py-4 text-center">Sem dados</div>
            ) : (
              <div className="space-y-3">
                {porPagamento.map((p, i) => (
                  <div key={p.nome}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-zinc-700">{p.nome}</span>
                      <span className="text-zinc-500">{p.qty} pedido{p.qty !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${(p.qty / porPagamento[0].qty) * 100}%`,
                          backgroundColor: CORES[i % CORES.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6">
            <h2 className="text-sm font-semibold text-ink mb-3">Top por faturamento</h2>
            {topProdutos.length === 0 ? (
              <div className="text-sm text-zinc-400 py-4 text-center">Sem dados</div>
            ) : (
              <div className="space-y-2">
                {[...topProdutos].sort((a, b) => b.total - a.total).slice(0, 5).map((p, i) => (
                  <div key={p.nome} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: CORES[i % CORES.length] }}>
                        {i + 1}
                      </span>
                      <span className="truncate text-zinc-700">{p.nome}</span>
                    </div>
                    <span className="font-semibold text-ink shrink-0 ml-2">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Desempenho do seu estabelecimento"
        action={
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
        }
      />
      {bloqueado
        ? <PreviewBloqueado feature="Relatórios" minPlano="profissional">{content}</PreviewBloqueado>
        : content
      }
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
