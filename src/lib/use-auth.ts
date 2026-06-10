import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Plano } from "./plano";

export type AppRole = "master" | "empresa_owner" | "empresa_staff";

export interface AuthState {
  loading: boolean;
  user: User | null;
  roles: AppRole[];
  empresaId: string | null;
  isMaster: boolean;
  plano: Plano;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    roles: [],
    empresaId: null,
    isMaster: false,
    plano: "profissional",
  });

  useEffect(() => {
    let active = true;

    async function load(user: User | null) {
      if (!user) {
        if (active) setState({ loading: false, user: null, roles: [], empresaId: null, isMaster: false, plano: "profissional" });
        return;
      }
      const [{ data: rolesData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("empresa_id").eq("id", user.id).maybeSingle(),
      ]);
      const roles = (rolesData ?? []).map((r) => r.role as AppRole);
      const empresaId = profile?.empresa_id ?? null;

      let plano: Plano = "profissional";
      if (empresaId) {
        const { data: emp } = await supabase
          .from("empresas")
          .select("plano")
          .eq("id", empresaId)
          .maybeSingle();
        if ((emp as any)?.plano) plano = (emp as any).plano as Plano;
      }

      if (active) setState({
        loading: false,
        user,
        roles,
        empresaId,
        isMaster: roles.includes("master"),
        plano,
      });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
