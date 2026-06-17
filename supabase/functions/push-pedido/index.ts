// @ts-ignore — npm specifier
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const pedido = body.record ?? body;

    if (!pedido?.empresa_id || !pedido?.numero) {
      return new Response("sem dados", { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("empresa_id", pedido.empresa_id);

    if (!subs?.length) {
      return new Response("sem subscriptions", { status: 200, headers: CORS });
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@deliverlyhub.com.br",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    const payload = JSON.stringify({
      title: "🛒 Novo pedido chegou!",
      body: `Pedido #${pedido.numero} — ${pedido.cliente_nome ?? "Cliente"}`,
      tag: `pedido-${pedido.id}`,
      url: "/empresa/pedidos",
    });

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 86400 }
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        }
      })
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    console.log(`Push: ${ok}/${subs.length} enviados`);

    return new Response(JSON.stringify({ sent: ok, total: subs.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500, headers: CORS });
  }
});
