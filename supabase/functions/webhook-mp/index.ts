import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verifica assinatura HMAC do Mercado Pago
async function verificarAssinatura(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[webhook-mp] MP_WEBHOOK_SECRET não configurado — rejeitando requisição");
    return false;
  }

  const xSig = req.headers.get("x-signature") ?? "";
  const xReqId = req.headers.get("x-request-id") ?? "";

  const ts = xSig.match(/ts=([^,]+)/)?.[1];
  const v1 = xSig.match(/v1=([^,]+)/)?.[1];
  if (!ts || !v1) return false;

  const url   = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? "";

  const manifest = `id:${dataId};request-id:${xReqId};ts:${ts};`;
  const key   = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig   = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex   = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return hex === v1;
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

serve(async (req) => {
  try {
    const rawBody = await req.text();

    // Verifica assinatura antes de qualquer processamento
    if (!await verificarAssinatura(req, rawBody)) {
      console.error("[webhook-mp] Assinatura inválida — requisição rejeitada");
      return new Response("unauthorized", { status: 401, headers: SECURITY_HEADERS });
    }

    const url     = new URL(req.url);
    const type    = url.searchParams.get("type");
    const queryId = url.searchParams.get("data.id");

    let bodyId: string | undefined;
    try {
      const body = JSON.parse(rawBody);
      bodyId = body?.data?.id ? String(body.data.id) : undefined;
    } catch { /* body pode ser vazio */ }

    const paymentId = queryId ?? bodyId;

    if (!paymentId || type !== "payment") {
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN")!;

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    const payment = await mpRes.json();

    if (payment.status !== "approved") {
      console.log(`[webhook-mp] Payment ${paymentId} status: ${payment.status} — ignorado`);
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    const ref = (payment.external_reference ?? "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pagamento de PEDIDO DO CARDÁPIO
    if (ref.startsWith("pedido|")) {
      const pedidoId = ref.split("|")[1];
      if (!pedidoId) return new Response("ok", { status: 200, headers: SECURITY_HEADERS });

      const novoStatus = payment.status === "approved" ? "aprovado"
        : payment.status === "rejected" || payment.status === "cancelled" ? "recusado"
        : "pendente";

      await supabase.from("pedidos")
        .update({ pagamento_online_status: novoStatus } as any)
        .eq("id", pedidoId);

      console.log(`[webhook-mp] Pedido ${pedidoId} pagamento: ${novoStatus}`);
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    // Pagamento de PLANO (fluxo original)
    const [empresaId, plano] = ref.split("|");
    if (!empresaId || !plano) {
      console.error("[webhook-mp] external_reference inválido:", ref);
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    const PLANOS_VALIDOS = ["basico", "profissional", "premium"];
    if (!PLANOS_VALIDOS.includes(plano)) {
      console.error("[webhook-mp] Plano inválido:", plano);
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    // Evita processar o mesmo pagamento duas vezes
    const { data: jaProcessado } = await supabase
      .from("pagamentos")
      .select("id")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (jaProcessado) {
      console.log(`[webhook-mp] Payment ${paymentId} já processado — ignorado`);
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    // Verifica que empresa existe antes de atualizar
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id, vencimento")
      .eq("id", empresaId)
      .maybeSingle();

    if (!empresa) {
      console.error("[webhook-mp] Empresa não encontrada:", empresaId);
      return new Response("ok", { status: 200, headers: SECURITY_HEADERS });
    }

    const base = empresa.vencimento && new Date(empresa.vencimento) > new Date()
      ? new Date(empresa.vencimento)
      : new Date();
    base.setDate(base.getDate() + 30);
    const novoVencimento = base.toISOString();

    const { error: updateErr } = await supabase
      .from("empresas")
      .update({ plano, vencimento: novoVencimento, status: "ativa" })
      .eq("id", empresaId);

    if (updateErr) {
      console.error("[webhook-mp] Erro ao atualizar empresa:", updateErr);
      return new Response("error", { status: 500, headers: SECURITY_HEADERS });
    }

    await supabase.from("pagamentos").insert({
      empresa_id:        empresaId,
      plano,
      valor:             payment.transaction_amount,
      mp_payment_id:     String(paymentId),
      status:            "aprovado",
      vencimento_gerado: novoVencimento,
    });

    console.log(`[webhook-mp] ✅ Payment ${paymentId} aprovado — empresa ${empresaId} → plano ${plano} até ${novoVencimento}`);
    return new Response("ok", { status: 200, headers: SECURITY_HEADERS });

  } catch (err) {
    console.error("[webhook-mp] Erro:", err);
    return new Response("error", { status: 500, headers: SECURITY_HEADERS });
  }
});
