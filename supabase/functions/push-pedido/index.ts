// @ts-ignore - npm specifier
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK = 100;
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let fcmAccessToken: { token: string; exp: number } | null = null;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmAccessToken && fcmAccessToken.exp - 60 > now) return fcmAccessToken.token;

  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FCM_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("FCM service account secrets ausentes");

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: FCM_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`FCM OAuth erro ${res.status}: ${JSON.stringify(json)}`);

  fcmAccessToken = { token: json.access_token, exp: now + Number(json.expires_in ?? 3600) };
  return fcmAccessToken.token;
}

async function sendFcm(token: string, title: string, body: string, data: Record<string, string>) {
  const projectId = Deno.env.get("FCM_PROJECT_ID") ?? "deliverlyhub-entregador";
  const accessToken = await getFcmAccessToken();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "pedidos",
            sound: "default",
            notification_priority: "PRIORITY_MAX",
          },
        },
      },
    }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

// ── Helpers de push para loja (WebPush + Expo) ──────────────────────────────

async function desativarToken(
  supabase: ReturnType<typeof createClient>,
  table: "expo_push_tokens" | "pedido_push_tokens",
  token: string,
) {
  await supabase
    .from(table)
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("token", token);
}
async function pushParaLoja(
  supabase: ReturnType<typeof createClient>,
  empresaId: string,
  title: string,
  body: string,
  pedidoId?: string,
) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("empresa_id", empresaId);

  if (subs?.length) {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@deliverlyhub.com.br",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
    const payload = JSON.stringify({ title, body, tag: pedidoId ? `pedido-${pedidoId}` : undefined, url: "/empresa/pedidos" });
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 86400 },
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }),
    );
  }

  const { data: expoTokens } = await supabase
    .from("expo_push_tokens")
    .select("token")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (expoTokens?.length) {
    const tokens = [...new Set(expoTokens.map(({ token }: { token: string }) => token))];
    let enviados = 0;
    for (const bloco of chunk(tokens, EXPO_CHUNK)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(bloco.map((token) => ({
          to: token, title, body,
          data: { pedidoId: pedidoId ?? "", screen: "Pedidos", url: "/empresa/pedidos" },
          sound: "default", priority: "high", channelId: "pedidos",
        }))),
      });
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.data)) {
        for (let i = 0; i < json.data.length; i++) {
          const r = json.data[i];
          if (r.status === "ok") enviados++;
          if (
            r.status === "error" &&
            (r.details?.error === "DeviceNotRegistered" || r.details?.error === "InvalidCredentials")
          ) {
            await desativarToken(supabase, "expo_push_tokens", bloco[i]);
            console.log(`[Loja] token Expo desativado: ${bloco[i]}`);
          }
        }
      }
      console.log(`[Loja] ExpoPush helper bloco: ${bloco.length} tokens, status ${res.status}`);
    }
    console.log(`[Loja] ExpoPush helper: ${enviados}/${tokens.length}`);
  }
}

async function pushParaCliente(
  supabase: ReturnType<typeof createClient>,
  pedido: any,
) {
  const status = String(pedido.status ?? "");
  const titles: Record<string, string> = {
    novo: "Pedido recebido",
    aguardando_pagamento: "Pedido confirmado",
    aceito: "Pagamento confirmado",
    preparo: "Pedido em preparo",
    entrega: "Saiu para entrega",
    finalizado: "Pedido finalizado",
    cancelado: "Pedido cancelado",
  };

  if (!titles[status]) {
    console.log(`[Cliente] status ignorado: ${status}`);
    return;
  }

  const { data: rows } = await supabase
    .from("pedido_push_tokens")
    .select("token")
    .eq("pedido_id", pedido.id)
    .eq("ativo", true);

  const tokens = [...new Set((rows ?? []).map((r: any) => r.token).filter(Boolean))];

  if (tokens.length === 0) {
    console.log(`[Cliente] nenhum token ativo para pedido ${pedido.id}`);
    return;
  }

  const title = titles[status];
  const body = `Pedido #${pedido.numero ?? ""}: ${title}`;
  const url = `/pedido/${pedido.id}`;
  let enviados = 0;

  for (const bloco of chunk(tokens, EXPO_CHUNK)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(bloco.map((token) => ({
        to: token,
        title,
        body,
        data: {
          screen: "Pedido",
          url,
          pedidoId: String(pedido.id),
        },
        sound: "default",
        priority: "high",
        channelId: "pedidos",
      }))),
    });

    const json = await res.json().catch(() => null);

    if (Array.isArray(json?.data)) {
      for (let i = 0; i < json.data.length; i++) {
        const result = json.data[i];
        if (result.status === "ok") enviados++;
        if (
          result.status === "error" &&
          (result.details?.error === "DeviceNotRegistered" || result.details?.error === "InvalidCredentials")
        ) {
          await desativarToken(supabase, "pedido_push_tokens", bloco[i]);
          console.log(`[Cliente] token desativado: ${bloco[i]}`);
        }
      }
    }

    console.log(`[Cliente] bloco ${bloco.length}, status ${res.status}`);
  }

  console.log(`[Cliente] total enviado: ${enviados}/${tokens.length}`);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const pedido = body.record ?? body;
    const eventType: string = body.event_type ?? "novo_pedido";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Eventos especiais de cancelamento / reclamação / reembolso ───────────
    if (eventType === "cliente_cancelou") {
      // Notifica lojista que cliente cancelou
      const { empresa_id, numero, cliente_nome, motivo } = body;
      if (empresa_id) {
        await pushParaLoja(
          supabase,
          empresa_id,
          `❌ Cliente cancelou o pedido #${numero}`,
          `${cliente_nome} — Motivo: ${motivo ?? "não informado"}`,
          body.pedido_id,
        );
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (eventType === "reclamacao") {
      const { empresa_id, numero, tipo } = body;
      const tipoLabel: Record<string, string> = {
        pedido_errado: "pedido errado", nao_chegou: "não chegou",
        item_faltando: "item faltando", qualidade: "qualidade ruim", outro: "outro problema",
      };
      if (empresa_id) {
        await pushParaLoja(
          supabase, empresa_id,
          `⚠️ Nova reclamação — pedido #${numero}`,
          `Tipo: ${tipoLabel[tipo] ?? tipo}`,
          body.pedido_id,
        );
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (eventType === "cliente_pagou_pix") {
      const { empresa_id, numero, pedido_id } = body;
      if (empresa_id) {
        await pushParaLoja(
          supabase,
          empresa_id,
          `💰 Cliente pagou PIX — Pedido #${numero}`,
          `Verifique o pagamento e confirme o pedido`,
          pedido_id,
        );
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (!pedido?.empresa_id || !pedido?.numero) {
      return new Response("sem dados", { status: 400, headers: CORS });
    }

    const notificarLoja = body.notificar_loja ?? true;
    const notificarEntregador = body.notificar_entregador ?? false;
    const notificarCliente = body.notificar_cliente ?? false;
    const logId: string | null = body.log_id ?? null;

    if (notificarLoja) {
      const isRetirada = pedido.tipo === "retirada";
      const isMesa = !!pedido.mesa;
      const notifTitle = isRetirada
        ? "Retirada no balcao!"
        : isMesa
          ? `Pedido na ${pedido.mesa}!`
          : "Novo pedido chegou!";
      const notifBody = `Pedido #${pedido.numero} - ${pedido.cliente_nome ?? "Cliente"}`;

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("empresa_id", pedido.empresa_id);

      if (subs?.length) {
        webpush.setVapidDetails(
          Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@deliverlyhub.com.br",
          Deno.env.get("VAPID_PUBLIC_KEY")!,
          Deno.env.get("VAPID_PRIVATE_KEY")!,
        );
        const payload = JSON.stringify({
          title: notifTitle,
          body: notifBody,
          tag: `pedido-${pedido.id}`,
          url: "/empresa/pedidos",
        });
        const results = await Promise.allSettled(
          subs.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
                { TTL: 86400 },
              );
            } catch (err: any) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
              throw err;
            }
          }),
        );
        const ok = results.filter((r) => r.status === "fulfilled").length;
        console.log(`[Loja] WebPush: ${ok}/${subs.length}`);
      }

      const { data: expoTokens } = await supabase
        .from("expo_push_tokens")
        .select("token")
        .eq("empresa_id", pedido.empresa_id)
        .eq("ativo", true);

      if (expoTokens?.length) {
        const tokens = [...new Set(expoTokens.map(({ token }: { token: string }) => token))];
        let enviados = 0;

        for (const bloco of chunk(tokens, EXPO_CHUNK)) {
          const expoPayload = bloco.map((token) => ({
            to: token,
            title: notifTitle,
            body: notifBody,
            data: { pedidoId: pedido.id, empresaId: pedido.empresa_id, screen: "Pedidos", url: "/empresa/pedidos" },
            sound: "default",
            priority: "high",
            channelId: "pedidos",
          }));

          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(expoPayload),
          });
          const json = await res.json().catch(() => null);

          if (Array.isArray(json?.data)) {
            for (let i = 0; i < json.data.length; i++) {
              const r = json.data[i];
              if (r.status === "ok") enviados++;
              if (
                r.status === "error" &&
                (r.details?.error === "DeviceNotRegistered" || r.details?.error === "InvalidCredentials")
              ) {
                await desativarToken(supabase, "expo_push_tokens", bloco[i]);
                console.log(`[Loja] token Expo desativado: ${bloco[i]}`);
              }
            }
          }

          console.log(`[Loja] ExpoPush bloco: ${bloco.length} tokens, status ${res.status}`);
        }

        console.log(`[Loja] ExpoPush total: ${enviados}/${tokens.length}`);
      }
    }

    if (notificarEntregador) {
      if (pedido.tipo !== "delivery" || pedido.entregador_id != null) {
        console.log("[Entregador] pedido nao elegivel: tipo ou entregador_id");
      } else {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("tipo_operacao_entrega, status")
          .eq("id", pedido.empresa_id)
          .single();

        if (empresa?.tipo_operacao_entrega !== "plataforma" || empresa?.status !== "ativa") {
          console.log("[Entregador] empresa fora do modo plataforma ou inativa");
        } else {
          const { data: entregadores } = await supabase
            .from("entregadores")
            .select("id")
            .eq("aprovado", true)
            .eq("status_cadastro", "aprovado")
            .is("empresa_id", null);

          const entIds = (entregadores ?? []).map((e: any) => e.id as string);

          if (entIds.length > 0) {
            const { data: tokensRows, error: tokenError } = await supabase
              .from("entregador_push_tokens")
              .select("token, fcm_token")
              .eq("ativo", true)
              .in("entregador_id", entIds);

            if (tokenError) throw tokenError;

            const title = "Novo pedido disponivel!";
            const msgBody = `Pedido #${pedido.numero} aguardando entregador`;
            const data = { pedidoId: String(pedido.id), tipo: "novo_pedido_entregador", screen: "Disponiveis" };
            const rows = tokensRows ?? [];
            const fcmTokens = [...new Set(rows.map((r: any) => r.fcm_token).filter(Boolean))] as string[];
            const expoTokens = [...new Set(rows.map((r: any) => r.token).filter(Boolean))] as string[];

            let fcmOk = 0;
            for (const fcmToken of fcmTokens) {
              const result = await sendFcm(fcmToken, title, msgBody, data);
              if (result.ok) {
                fcmOk++;
              } else {
                const status = result.json?.error?.status;
                console.log(`[Entregador] FCM erro ${result.status}: ${JSON.stringify(result.json)}`);
                if (status === "UNREGISTERED" || status === "INVALID_ARGUMENT") {
                  await supabase
                    .from("entregador_push_tokens")
                    .update({ ativo: false, updated_at: new Date().toISOString() })
                    .eq("fcm_token", fcmToken);
                }
              }
            }
            if (fcmTokens.length > 0) console.log(`[Entregador] FCM: ${fcmOk}/${fcmTokens.length}`);

            if (fcmTokens.length === 0 && expoTokens.length > 0) {
              for (const bloco of chunk(expoTokens, EXPO_CHUNK)) {
                const payload = bloco.map((token) => ({
                  to: token,
                  title,
                  body: msgBody,
                  data,
                  sound: "default",
                  priority: "high",
                  channelId: "pedidos",
                }));

                const res = await fetch(EXPO_PUSH_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify(payload),
                });
                const json = await res.json();

                if (Array.isArray(json?.data)) {
                  for (let i = 0; i < json.data.length; i++) {
                    const r = json.data[i];
                    if (
                      r.status === "error" &&
                      (r.details?.error === "DeviceNotRegistered" || r.details?.error === "InvalidCredentials")
                    ) {
                      await supabase
                        .from("entregador_push_tokens")
                        .update({ ativo: false, updated_at: new Date().toISOString() })
                        .eq("token", bloco[i]);
                      console.log(`[Entregador] token Expo desativado: ${bloco[i]}`);
                    }
                  }
                }

                console.log(`[Entregador] ExpoPush fallback: ${bloco.length} tokens, status ${res.status}`);
              }
            }

            if (fcmTokens.length === 0 && expoTokens.length === 0) {
              console.log("[Entregador] nenhum token ativo");
            }
          } else {
            console.log("[Entregador] nenhum entregador de plataforma aprovado");
          }
        }
      }
    }

    if (notificarCliente) {
      await pushParaCliente(supabase, pedido);
    }

    if (logId) {
      await supabase
        .from("notification_log")
        .update({ status: "delivered", atualizado_em: new Date().toISOString() })
        .eq("id", logId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500, headers: CORS });
  }
});