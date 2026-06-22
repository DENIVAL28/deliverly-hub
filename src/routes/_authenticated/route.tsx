import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest-empresa.json" }],
  }),
  beforeLoad: async () => {
    // getSession() lê a sessão do storage local e renova o token se necessário
    // sem fazer chamada de rede extra — evita desconexões por falha de rede transitória.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => <Outlet />,
});