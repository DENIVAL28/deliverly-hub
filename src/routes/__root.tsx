import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // Chunk load error = novo deploy enquanto o usuário estava na página.
  // O browser tem o bundle antigo em cache e tenta carregar um chunk que não existe mais.
  // Solução: hard reload uma vez para pegar o novo bundle.
  const isChunkError = error?.message?.includes("Failed to fetch dynamically imported module")
    || error?.message?.includes("Importing a module script failed");

  useEffect(() => {
    if (isChunkError) {
      const key = "chunk_reload_at";
      const last = Number(sessionStorage.getItem(key) ?? 0);
      // Evita loop: só recarrega se não tentou nos últimos 10s
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
      return;
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">Atualizando… aguarde um instante.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente recarregar a página ou volte ao início.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SOS Sistemas — Cardápio Digital + PDV + Entregadores para Restaurantes | R$99/mês" },
      { name: "description", content: "Sistema completo para restaurantes: cardápio digital, caixa PDV para balcão e gestão de entregadores — tudo por R$99/mês sem comissão por pedido. Pizzarias, hamburguerias, marmitarias e mais." },
      { name: "keywords", content: "sistema de delivery, cardápio digital restaurante, software pdv restaurante, gestão de entregadores, pedidos pelo whatsapp, sistema para pizzaria, sistema para hamburgueria, cardápio online grátis" },
      { name: "author", content: "SOS Sistemas" },
      { name: "google-site-verification", content: "t_NpEKIaHkS11OO1NqCrFDSsClosuwQOgm_Rzgb5B5Q" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#f97316" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Delivery" },
      { property: "og:title", content: "SOS Sistemas — Cardápio Digital + PDV + Entregadores por R$99/mês" },
      { property: "og:description", content: "Cardápio digital, caixa PDV e gestão de entregadores num único sistema. Sem comissão, sem contrato. 7 dias grátis." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://delivery-hub.vercel.app" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Delivery Hub — Sistema de Delivery" },
      { name: "twitter:description", content: "Crie seu cardápio digital e receba pedidos pelo WhatsApp. Sem taxas por pedido." },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
