import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export interface EntregadorData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  cpf: string | null;
  cnh: string | null;
  placa: string | null;
  modelo_veiculo: string | null;
  cor_veiculo: string | null;
  foto_rosto_url: string | null;
  veiculo: string | null;
  status: string | null;
  status_cadastro: string;
  verificado: boolean;
  motivo_recusa: string | null;
  public_token: string;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  aprovado: boolean;
}

export async function requireEntregador(): Promise<{ user: any; entregador: EntregadorData }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/entregadores/login" });

  const { data: entregador, error } = await supabase.rpc("entregador_me" as any);
  if (error) {
    // RPC não existe (migration pendente) ou RLS bloqueou — não é entregador
    await supabase.auth.signOut();
    throw redirect({ to: "/entregadores/login" });
  }
  if (!entregador) throw redirect({ to: "/entregadores/login" });

  return { user, entregador: entregador as EntregadorData };
}
