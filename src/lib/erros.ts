const MAPA: Array<[RegExp | string, string]> = [
  // Auth
  ["Invalid login credentials",          "E-mail ou senha incorretos."],
  ["Email not confirmed",                 "Confirme seu e-mail antes de entrar."],
  ["User already registered",            "Este e-mail já está cadastrado."],
  ["Password should be at least",        "A senha deve ter pelo menos 6 caracteres."],
  ["Too many requests",                   "Muitas tentativas. Aguarde um momento e tente novamente."],
  ["Email rate limit exceeded",           "Limite de e-mails atingido. Aguarde alguns minutos."],
  ["User not found",                      "Usuário não encontrado."],
  ["New password should be different",   "A nova senha deve ser diferente da atual."],
  ["Auth session missing",               "Sessão expirada. Faça login novamente."],
  // DB — constraints
  [/unique.*cnpj/i,                       "Este CNPJ já está cadastrado."],
  [/unique.*slug/i,                       "Este endereço de loja já está em uso."],
  [/unique.*email/i,                      "Este e-mail já está cadastrado."],
  ["SLUG_OCUPADO",                        "Este endereço de loja já está em uso."],
  ["LIMITE_PRODUTOS",                     "Limite de produtos do plano atingido."],
  ["LIMITE_CUPONS",                       "Limite de cupons do plano atingido."],
  ["LIMITE_ENTREGADORES",                 "Limite de entregadores do plano atingido."],
  // Genérico
  ["permission denied",                   "Sem permissão para realizar esta ação."],
  ["violates row-level security",         "Sem permissão para realizar esta ação."],
  ["network",                             "Erro de conexão. Verifique sua internet."],
];

export function traduzirErro(msg: string | undefined | null): string {
  if (!msg) return "Ocorreu um erro. Tente novamente.";
  for (const [chave, texto] of MAPA) {
    if (typeof chave === "string" ? msg.includes(chave) : chave.test(msg)) return texto;
  }
  return "Ocorreu um erro. Tente novamente.";
}
