import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Eye, ShoppingCart, CheckCircle2, MousePointerClick } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/analytics")({
  ssr: false,
  component: AnalyticsPage,
});

const EVENTO_LABEL: Record<string, string> = {
  visita: "Visitas",
  produto_visto: "Produtos vistos",
  adicionado_carrinho: "Adicionados ao carrinho",
  checkout_iniciado: "Checkouts iniciados",
  pedido_finalizado: "Pedidos finalizados",
};

const CORES = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];

function AnalyticsPage() {
  const { empresaId } = useAuth();

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["analytics", empresaId],
    enabled: !!empresaId,
    refetchInterval: 60000,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 29);
      const { data } = await (supabase as any)
        .from("analytics_eventos")
        .select("evento, produto_id, session_id, created_at, metadata")
        .eq("empresa_id", empresaId)
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const { data: produtosMaisVistos } = useQuery({
    queryKey: ["analytics-produtos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 29);
      const { data } = await (supabase as any)
        .from("analytics_eventos")
        .select("produto_id, metadata")
        .eq("empresa_id", empresaId)
        .eq("evento", "adicionado_carrinho")
        .gte("created_at", desde.toISOString());
      // agrupar por produto_id + nome
      const map: Record<string, { nome: string; count: number }> = {};
      for (const e of data ?? []) {
        if (!e.produto_id) continue;
        if (!map[e.produto_id]) map[e.produto_id] = { nome: e.metadata?.nome ?? "Produto", count: 0 };
        map[e.produto_id].count++;
      }
      return Object.entries(map)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    },
  });

  // Visitas = sessões únicas (evita contar refresh como nova visita)
  const visitas = new Set(
    (eventos ?? []).filter((e: any) => e.evento === "visita" && e.session_id).map((e: any) => e.session_id)
  ).size;

  // Demais eventos: contagem total (ações intencionais)
  const totais = (eventos ?? []).reduce((acc: Record<string, number>, e: any) => {
    if (e.evento !== "visita") acc[e.evento] = (acc[e.evento] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  totais["visita"] = visitas;

  const pedidos = totais["pedido_finalizado"] ?? 0;
  const conversao = visitas > 0 ? ((pedidos / visitas) * 100).toFixed(1) : "0.0";

  // Visitas por dia — sessões únicas por dia
  const visitasPorDia = (() => {
    const dias: Record<string, Set<string>> = {};
    const hoje = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      dias[d.toISOString().slice(0, 10)] = new Set();
    }
    for (const e of (eventos ?? [])) {
      if (e.evento !== "visita" || !e.session_id) continue;
      const dia = e.created_at.slice(0, 10);
      if (dia in dias) dias[dia].add(e.session_id);
    }
    return Object.entries(dias).map(([data, sessions]) => ({
      data: data.slice(5),
      visitas: sessions.size,
    }));
  })();

  const stats = [
    { label: "Visitas (30d)",          value: visitas,                    icon: Eye,             color: "text-blue-500" },
    { label: "Produtos adicionados",   value: totais["adicionado_carrinho"] ?? 0, icon: ShoppingCart, color: "text-orange-500" },
    { label: "Checkouts iniciados",    value: totais["checkout_iniciado"] ?? 0,   icon: MousePointerClick, color: "text-amber-500" },
    { label: "Pedidos finalizados",    value: pedidos,                    icon: CheckCircle2,    color: "text-green-500" },
    { label: "Taxa de conversão",      value: `${conversao}%`,            icon: TrendingUp,      color: "text-violet-500" },
  ];

  if (isLoading) return <div className="p-10 text-sm text-zinc-500">Carregando analytics…</div>;

  return (
    <>
      <PageHeader title="Analytics" subtitle="Desempenho do seu cardápio nos últimos 30 dias" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-background rounded-xl ring-1 ring-black/5 p-4">
              <Icon className={`size-5 mb-2 ${s.color}`} />
              <div className="text-xl font-bold text-ink">{s.value}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Gráfico visitas por dia */}
      <div className="bg-background rounded-xl ring-1 ring-black/5 p-5 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Visitas por dia (últimos 14 dias)</h2>
        {visitas === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-zinc-400">
            Nenhuma visita registrada ainda. Os dados aparecem conforme os clientes acessam o cardápio.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={visitasPorDia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="data" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, "Visitas"]} />
              <Bar dataKey="visitas" radius={[4, 4, 0, 0]} fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Funil de conversão */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-background rounded-xl ring-1 ring-black/5 p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Funil de conversão</h2>
          {visitas === 0 ? (
            <p className="text-sm text-zinc-400">Sem dados ainda.</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Visitas",              key: "visita",               color: "bg-blue-500" },
                { label: "Produtos vistos",      key: "produto_visto",        color: "bg-indigo-500" },
                { label: "Adicionados",          key: "adicionado_carrinho",  color: "bg-orange-500" },
                { label: "Checkout iniciado",    key: "checkout_iniciado",    color: "bg-amber-500" },
                { label: "Pedidos finalizados",  key: "pedido_finalizado",    color: "bg-green-500" },
              ].map(step => {
                const v = totais[step.key] ?? 0;
                const pct = visitas > 0 ? Math.min(100, Math.round((v / visitas) * 100)) : 0;
                return (
                  <div key={step.key}>
                    <div className="flex justify-between text-xs text-zinc-600 mb-1">
                      <span>{step.label}</span>
                      <span className="font-semibold">{v} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Produtos mais adicionados */}
        <div className="bg-background rounded-xl ring-1 ring-black/5 p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Produtos mais adicionados ao carrinho</h2>
          {!produtosMaisVistos?.length ? (
            <p className="text-sm text-zinc-400">Sem dados ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={produtosMaisVistos} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => [v, "adicionamentos"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(produtosMaisVistos ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}
