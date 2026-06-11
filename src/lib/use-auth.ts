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
  vencimento: string | null;
  diasRestantes: number | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    roles: [],
    empresaId: null,
    isMaster: false,
    plano: "profissional",
    vencimento: null,
    diasRestantes: null,
  });

  useEffect(() => {
    let active = true;

    async function load(user: User | null) {
      if (!user) {
        if (active) setState({ loading: false, user: null, roles: [], empresaId: null, isMaster: false, plano: "profissional", vencimento: null, diasRestantes: null });
        return;
      }
      const [{ data: rolesData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("empresa_id").eq("id", user.id).maybeSingle(),
      ]);
      const roles = (rolesData ?? []).map((r) => r.role as AppRole);
      const empresaId = profile?.empresa_id ?? null;

      let plano: Plano = "profissional";
      let vencimento: string | null = null;
      let diasRestantes: number | null = null;

      if (empresaId) {
        const { data: emp } = await supabase
          .from("empresas")
          .select("plano,vencimento")
          .eq("id", empresaId)
          .maybeSingle();
        if ((emp as any)?.plano) plano = (emp as any).plano as Plano;
        if ((emp as any)?.vencimento) {
          vencimento = (emp as any).vencimento as string;
          const diff = new Date(vencimento).getTime() - Date.now();
          diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
      }

      if (active) setState({
        loading: false,
        user,
        roles,
        empresaId,
        isMaster: roles.includes("master"),
        plano,
        vencimento,
        diasRestantes,
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
