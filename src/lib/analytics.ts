import { supabase } from "@/integrations/supabase/client";

let sessionId: string | null = null;

function getSession(): string {
  if (!sessionId) {
    try {
      sessionId = sessionStorage.getItem("_dhsid") ?? crypto.randomUUID();
      sessionStorage.setItem("_dhsid", sessionId);
    } catch {
      sessionId = crypto.randomUUID();
    }
  }
  return sessionId;
}

export async function trackEvento(
  empresaId: string,
  evento: "visita" | "produto_visto" | "adicionado_carrinho" | "checkout_iniciado" | "pedido_finalizado",
  extra?: { produto_id?: string; metadata?: Record<string, unknown> }
) {
  try {
    await (supabase as any).from("analytics_eventos").insert({
      empresa_id: empresaId,
      evento,
      session_id: getSession(),
      produto_id: extra?.produto_id ?? null,
      metadata: extra?.metadata ?? null,
    });
  } catch {
    // nunca quebrar o app por falha de analytics
  }
}
