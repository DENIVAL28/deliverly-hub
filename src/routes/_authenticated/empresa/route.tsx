import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, FolderTree, Users, Settings, BarChart2, Tag, Bike, Star, ReceiptText, CreditCard, TrendingUp, Grid2x2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa")({
  component: EmpresaLayout,
});

function EmpresaLayout() {
  const { loading, isMaster, empresaId, plano } = useAuth();
  const navigate = useNavigate();
  const basico = plano === "basico";

  useEffect(() => {
    if (loading) return;
    if (isMaster && !empresaId)   navigate({ to: "/master",     replace: true });
    if (!isMaster && !empresaId)  navigate({ to: "/onboarding", replace: true });
  }, [loading, isMaster, empresaId, navigate]);

  if (loading) return <div className="p-10 text-sm text-zinc-500">Carregando…</div>;

  return (
    <AppShell
      title="Estabelecimento"
      items={[
        { to: "/empresa",               label: "Dashboard",                                    icon: LayoutDashboard },
        { to: "/empresa/pedidos",       label: "Pedidos",                                      icon: ShoppingBag },
        { to: "/empresa/mesas",         label: "Mesas",                                        icon: Grid2x2 },
        { to: "/empresa/pdv",           label: "Caixa / PDV",                                  icon: ReceiptText },
        { to: "/empresa/produtos",      label: "Produtos",                                     icon: UtensilsCrossed },
        { to: "/empresa/categorias",    label: "Categorias",                                   icon: FolderTree },
        { to: "/empresa/clientes",      label: "Clientes",                                     icon: Users },
        { to: "/empresa/cupons",        label: "Cupons",                                       icon: Tag },
        { to: "/empresa/entregadores",  label: basico ? "Entregadores 🔒" : "Entregadores",    icon: Bike },
        { to: "/empresa/avaliacoes",    label: basico ? "Avaliações 🔒"   : "Avaliações",      icon: Star },
        { to: "/empresa/relatorios",    label: basico ? "Relatórios 🔒"   : "Relatórios",      icon: BarChart2 },
        { to: "/empresa/analytics",     label: basico ? "Analytics 🔒"    : "Analytics",       icon: TrendingUp },
        { to: "/empresa/planos",        label: "Plano & Cobrança",                             icon: CreditCard },
        { to: "/empresa/configuracoes", label: "Configurações",                                icon: Settings },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
