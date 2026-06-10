import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const PRECOS: Record<string, number> = {
  basico: 99.00,
  profissional: 199.00,
  premium: 345.00,
};

const NOMES: Record<string, string> = {
  basico: "Básico",
  profissional: "Profissional",
  premium: "Premium",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", user.id)
      .single();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const plano = body?.plano;
    if (!PRECOS[plano]) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN")!;
    const origin      = Deno.env.get("APP_ORIGIN") ?? "https://deliverly.sossistemas.com.br";
    const webhookUrl  = `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mp`;

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        items: [{
          title:       `Deliverly Hub — Plano ${NOMES[plano]}`,
          quantity:    1,
          unit_price:  PRECOS[plano],
          currency_id: "BRL",
        }],
        external_reference: `${profile.empresa_id}|${plano}`,
        back_urls: {
          success: `${origin}/empresa/planos?pagamento=sucesso&plano=${plano}`,
          failure: `${origin}/empresa/planos?pagamento=erro`,
          pending: `${origin}/empresa/planos?pagamento=pendente`,
        },
        notification_url:     webhookUrl,
        statement_descriptor: "SOS SISTEMAS",
      }),
    });

    const pref = await res.json();
    if (!pref.init_point) {
      console.error("MP preference error:", pref.code ?? pref.message ?? res.status);
      return new Response(JSON.stringify({ error: "Erro ao criar checkout no Mercado Pago" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ checkout_url: pref.init_point }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("criar-checkout error:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
