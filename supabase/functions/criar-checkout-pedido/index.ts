import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { pedido_id } = await req.json();
    if (!pedido_id) {
      return new Response(JSON.stringify({ error: "pedido_id obrigatório" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca pedido com itens
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .select("id, numero, total, empresa_id, pagamento_online_status, pedido_itens(quantidade, produtos(nome, preco))")
      .eq("id", pedido_id)
      .maybeSingle();

    if (error || !pedido) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (pedido.pagamento_online_status === "aprovado") {
      return new Response(JSON.stringify({ error: "Pedido já está pago" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_fantasia, slug")
      .eq("id", pedido.empresa_id)
      .maybeSingle();

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN")!;
    const origin      = Deno.env.get("APP_ORIGIN") ?? "https://deliverly-hub.vercel.app";
    const webhookUrl  = `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mp`;

    const items = ((pedido as any).pedido_itens ?? []).map((item: any) => ({
      title:      item.produtos?.nome ?? "Produto",
      quantity:   item.quantidade,
      unit_price: Number(item.produtos?.preco ?? 0),
      currency_id: "BRL",
    })).filter((i: any) => i.unit_price > 0);

    if (!items.length) {
      items.push({
        title: `Pedido #${pedido.numero} — ${empresa?.nome_fantasia ?? "Delivery Hub"}`,
        quantity: 1,
        unit_price: Number(pedido.total),
        currency_id: "BRL",
      });
    }

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        items,
        external_reference: `pedido|${pedido_id}`,
        back_urls: {
          success: `${origin}/loja/${empresa?.slug ?? ""}?pedido_pago=${pedido.numero}&status=sucesso`,
          failure: `${origin}/loja/${empresa?.slug ?? ""}?pedido_pago=${pedido.numero}&status=erro`,
          pending: `${origin}/loja/${empresa?.slug ?? ""}?pedido_pago=${pedido.numero}&status=pendente`,
        },
        notification_url:     webhookUrl,
        statement_descriptor: "DELIVERY HUB",
      }),
    });

    const pref = await mpRes.json();
    if (!pref.init_point) {
      return new Response(JSON.stringify({ error: "Erro ao criar preferência no Mercado Pago" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Marca pedido como pendente de pagamento
    await supabase.from("pedidos")
      .update({ pagamento_online_status: "pendente", pagamento_online_id: String(pref.id) } as any)
      .eq("id", pedido_id);

    return new Response(JSON.stringify({ checkout_url: pref.init_point }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("criar-checkout-pedido error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
