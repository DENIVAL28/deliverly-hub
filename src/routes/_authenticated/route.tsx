import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest-empresa.json" }],
  }),
  beforeLoad: async () => {
    // getUser() já aguarda internamente o exchangeCodeForSession (PKCE callback)
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Sessão não encontrada — redireciona para login preservando URL atual
      // para que após login o usuário volte à página que tentou acessar
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});