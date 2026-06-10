import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/master/")({
  component: MasterDashboard,
});

function MasterDashboard() {
  const { data } = useQuery({
    queryKey: ["master-overview"],
    queryFn: async () => {
      const [{ data: empresas }, { data: planos }, { count: pedidosCount }] = await Promise.all([
        supabase.from("empresas").select("id,status,plano_id,vencimento"),
        supabase.from("planos").select("id,valor"),
        supabase.from("pedidos").select("*", { count: "exact", head: true }),
      ]);
      const planoById = new Map((planos ?? []).map((p) => [p.id, Number(p.valor)]));
      const ativas = empresas?.filter((e) => e.status === "ativa").length ?? 0;
      const vencidas = empresas?.filter((e) => e.status === "vencida").length ?? 0;
      const bloqueadas = empresas?.filter((e) => e.status === "bloqueada").length ?? 0;
      const mrr = (empresas ?? []).reduce((acc, e) => acc + (e.status === "ativa" ? planoById.get(e.plano_id ?? "") ?? 0 : 0), 0);
      return { total: empresas?.length ?? 0, ativas, vencidas, bloqueadas, mrr, pedidos: pedidosCount ?? 0 };
    },
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader title="Visão geral" subtitle="Resumo da plataforma SOS Sistemas" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Empresas" value={data?.total ?? 0} />
        <StatCard label="Ativas" value={data?.ativas ?? 0} />
        <StatCard label="Vencidas" value={data?.vencidas ?? 0} />
        <StatCard label="Bloqueadas" value={data?.bloqueadas ?? 0} />
        <StatCard label="MRR" value={fmt(data?.mrr ?? 0)} />
        <StatCard label="Pedidos totais" value={data?.pedidos ?? 0} />
      </div>

      <div className="mt-10 rounded-xl ring-1 ring-black/5 bg-background p-6">
        <h2 className="text-sm font-semibold text-ink mb-1">Bem-vindo ao painel master</h2>
        <p className="text-sm text-zinc-500">
          Cadastre novos estabelecimentos em <strong>Empresas</strong>, configure preços em <strong>Planos</strong> e acompanhe a saúde financeira da plataforma aqui.
        </p>
      </div>
    </>
  );
}