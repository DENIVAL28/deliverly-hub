import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, Building2, Package, Receipt, BarChart2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/master")({
  component: MasterLayout,
});

function MasterLayout() {
  const { loading, isMaster } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isMaster) navigate({ to: "/empresa", replace: true });
  }, [loading, isMaster, navigate]);

  if (loading) return <div className="p-10 text-sm text-zinc-500">Carregando…</div>;

  if (!isMaster) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center space-y-2">
        <div className="text-4xl">🔒</div>
        <p className="text-sm font-semibold text-zinc-700">Acesso restrito</p>
        <p className="text-xs text-zinc-400">Você não tem permissão para acessar esta área.</p>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Master"
      items={[
        { to: "/master", label: "Dashboard", icon: LayoutDashboard },
        { to: "/master/empresas", label: "Empresas", icon: Building2 },
        { to: "/master/planos", label: "Planos", icon: Package },
        { to: "/master/mensalidades", label: "Mensalidades", icon: Receipt },
        { to: "/master/relatorios", label: "Relatórios", icon: BarChart2 },
        { to: "/master/seguranca", label: "Segurança", icon: ShieldCheck },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}