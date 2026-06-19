import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, FolderTree, Users, Settings, BarChart2, Tag, Bike, Star, ReceiptText, CreditCard, TrendingUp, Grid2x2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/empresa")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // pai (_authenticated) já redireciona para /auth

    const [{ data: masterRole }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "master").maybeSingle(),
      supabase.from("profiles").select("empresa_id").eq("id", user.id).maybeSingle(),
    ]);

    const isMaster  = !!masterRole;
    const empresaId = profile?.empresa_id ?? null;

    if (isMaster && !empresaId)  throw redirect({ to: "/master" });
    if (!isMaster && !empresaId) throw redirect({ to: "/onboarding" });
  },
  component: EmpresaLayout,
});

function EmpresaLayout() {
  const { loading, plano } = useAuth();
  const basico = plano === "basico";

  if (loading) return <div className="p-10 text-sm text-zinc-500">Carregando…</div>;

  return (
    <AppShell
      title="Estabelecimento"
      items={[
        { to: "/empresa",               label: "Dashboard",                                    icon: LayoutDashboard },
        { to: "/empresa/pedidos",       label: "Pedidos",                                      icon: ShoppingBag,    section: "Operação" },
        { to: "/empresa/mesas",         label: "Mesas",                                        icon: Grid2x2 },
        { to: "/empresa/pdv",           label: "Caixa / PDV",                                  icon: ReceiptText },
        { to: "/empresa/categorias",    label: "Categorias",                                   icon: FolderTree,     section: "Cardápio" },
        { to: "/empresa/produtos",      label: "Produtos",                                     icon: UtensilsCrossed },
        { to: "/empresa/clientes",      label: "Clientes",                                     icon: Users,          section: "Clientes" },
        { to: "/empresa/cupons",        label: "Cupons",                                       icon: Tag },
        { to: "/empresa/entregadores",  label: basico ? "Entregadores 🔒" : "Entregadores",    icon: Bike,           section: "Equipe" },
        { to: "/empresa/avaliacoes",    label: basico ? "Avaliações 🔒"   : "Avaliações",      icon: Star,           section: "Desempenho" },
        { to: "/empresa/relatorios",    label: basico ? "Relatórios 🔒"   : "Relatórios",      icon: BarChart2 },
        { to: "/empresa/analytics",     label: basico ? "Analytics 🔒"    : "Analytics",       icon: TrendingUp },
        { to: "/empresa/planos",        label: "Plano & Cobrança",                             icon: CreditCard,     section: "Conta" },
        { to: "/empresa/configuracoes", label: "Configurações",                                icon: Settings },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
