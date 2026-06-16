import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Valida quem chamou com o JWT dele
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Só master pode convidar usuários
    const { data: roleData } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "master")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { email, role, empresa_id } = await req.json();
    if (!email || !role || !empresa_id) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Cliente admin com service role (nunca exposto no client)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://deliverly-hub.vercel.app";

    // Tenta convidar — Supabase envia o e-mail automaticamente
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { empresa_id, role },
        redirectTo: `${appOrigin}/empresa/dashboard`,
      }
    );

    let userId: string;
    let wasInvited = true;

    if (inviteErr) {
      // Usuário já existe — só associa sem reenviar convite
      const alreadyExists =
        inviteErr.message.includes("already been registered") ||
        inviteErr.message.includes("already registered") ||
        inviteErr.message.includes("already exists");

      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // Busca o usuário existente pelo e-mail via auth.users
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (!existing) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      userId = existing.id;
      wasInvited = false;
    } else {
      userId = inviteData.user.id;
    }

    // Garante o user_role correto (upsert evita conflito)
    await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role, empresa_id }, { onConflict: "user_id,role" });

    // Atualiza empresa_id no perfil (se já existir)
    await adminClient
      .from("profiles")
      .update({ empresa_id })
      .eq("id", userId);

    return new Response(JSON.stringify({ ok: true, invited: wasInvited }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("invite-user error:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
