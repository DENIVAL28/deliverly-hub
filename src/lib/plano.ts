export type Plano = "basico" | "profissional" | "premium";

export const PLANO_LIMITS = {
  basico:       { produtos: 50,  cupons: 3,    pedidos: 600,  entregadores: 0 },
  profissional: { produtos: 150, cupons: null, pedidos: null, entregadores: 10 },
  premium:      { produtos: null, cupons: null, pedidos: null, entregadores: null },
} as const;

export const PLANO_LABEL: Record<Plano, string> = {
  basico:       "Básico",
  profissional: "Profissional",
  premium:      "Premium",
};

export function limiteAtingido(atual: number, limite: number | null): boolean {
  if (limite === null) return false;
  return atual >= limite;
}

/**
 * Trata erros do Supabase vindos de triggers de segurança.
 * Retorna mensagem amigável se for um erro de limite de plano,
 * ou a mensagem original do banco para outros erros.
 */
export function parsarErroSupabase(error: { message?: string } | null): string {
  if (!error?.message) return "Erro desconhecido";
  const msg = error.message;

  if (msg.includes("LIMITE_PLANO:")) {
    return msg.replace("LIMITE_PLANO:", "").trim();
  }
  if (msg.includes("ACESSO_NEGADO:")) {
    return msg.replace("ACESSO_NEGADO:", "").trim();
  }
  // Erros comuns de banco com mensagem genérica
  if (msg.includes("duplicate key")) return "Já existe um registro com esse valor.";
  if (msg.includes("violates foreign key")) return "Referência inválida. Verifique os dados.";
  if (msg.includes("violates not-null")) return "Campo obrigatório não preenchido.";

  return msg;
}
