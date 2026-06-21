import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, FolderTree, Users, Settings, BarChart2, Tag, Bike, Star, ReceiptText, CreditCard, TrendingUp, Grid2x2, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
  const { loading, plano, empresaId, user } = useAuth();
  const basico = plano === "basico";

  // staleTime = 0: sempre refetch ao montar — garante modo correto após F5 e após salvar config
  const { data: operationMode = "full_delivery" } = useQuery({
    queryKey: ["operation-mode", empresaId],
    enabled: !!empresaId,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("operation_mode").eq("id", empresaId!).single();
      return (data as any)?.operation_mode ?? "full_delivery";
    },
  });

  const isSimplified = operationMode === "simplified_delivery";

  useEffect(() => {
    if (!empresaId || !user) return;
    const rnBridge = (window as any).ReactNativeWebView;
    if (!rnBridge?.postMessage) return;

    rnBridge.postMessage(JSON.stringify({
      type: "DEVHUB_EMPRESA_CONTEXT",
      empresaId,
      userId: user.id,
    }));

    async function handleNativePushToken(event: Event) {
      const detail = (event as CustomEvent<{ token?: string; platform?: string }>).detail;
      const token = detail?.token;
      if (!token || !empresaId || !user) return;

      const lastToken = localStorage.getItem("devhub_native_expo_token");
      if (lastToken === token) return;

      const { error } = await supabase.from("expo_push_tokens" as any).upsert({
        empresa_id: empresaId,
        user_id: user.id,
        token,
      }, { onConflict: "token" });

      if (!error) {
        localStorage.setItem("devhub_native_expo_token", token);
      } else {
        console.warn("[push] falha ao salvar Expo Push Token:", error.message);
      }
    }

    window.addEventListener("devhub:nativePushToken", handleNativePushToken);
    return () => window.removeEventListener("devhub:nativePushToken", handleNativePushToken);
  }, [empresaId, user]);

  const { data: pedidosPendentes = 0 } = useQuery({
    queryKey: ["badge-pedidos", empresaId],
    enabled: !!empresaId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .in("status", ["aguardando_confirmacao", "aguardando_pagamento", "novo", "aceito", "preparo", "entrega"]);
      return count ?? 0;
    },
  });

  if (loading) return <div className="p-10 text-sm text-zinc-500">Carregando…</div>;

  return (
    <AppShell
      title="Estabelecimento"
      items={[
        { to: "/empresa",               label: "Dashboard",                                    icon: LayoutDashboard },
        {
          to:         isSimplified ? "/empresa/pedidos-simples" : "/empresa/pedidos",
          label:      isSimplified ? "Painel Simples"           : "Pedidos",
          icon:       isSimplified ? Layers                     : ShoppingBag,
          section:    "Operação",
          badge:      pedidosPendentes,
          badgeColor: "red" as const,
        },
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
