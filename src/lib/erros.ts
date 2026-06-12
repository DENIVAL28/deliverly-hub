const MAPA: Array<[RegExp | string, string]> = [
  // Auth
  ["Invalid login credentials",          "E-mail ou senha incorretos."],
  ["Email not confirmed",                 "Confirme seu e-mail antes de entrar."],
  ["User already registered",            "Este e-mail já está cadastrado."],
  ["Password should be at least",        "A senha deve ter pelo menos 6 caracteres."],
  ["Too many requests",                   "Muitas tentativas. Aguarde um momento e tente novamente."],
  ["Email rate limit exceeded",           "Limite de e-mails atingido. Aguarde alguns minutos e tente novamente."],
  ["over_email_send_rate_limit",          "Limite de e-mails atingido. Aguarde alguns minutos e tente novamente."],
  ["Error sending confirmation email",   "Não foi possível enviar o e-mail de confirmação. Aguarde alguns minutos e tente novamente."],
  ["For security purposes",              "Muitas tentativas. Aguarde um momento e tente novamente."],
  ["User not found",                      "Usuário não encontrado."],
  ["New password should be different",   "A nova senha deve ser diferente da atual."],
  ["Auth session missing",               "Sessão expirada. Faça login novamente."],
  ["Signups not allowed",                "Cadastros estão desativados temporariamente."],
  ["Email signups are disabled",         "Cadastros por e-mail estão desativados."],
  ["Invalid email",                       "E-mail inválido."],
  ["Email link is invalid",              "O link do e-mail é inválido ou expirou. Solicite um novo."],
  ["Token has expired",                  "O link expirou. Solicite um novo."],
  ["signup_disabled",                    "Cadastros estão desativados temporariamente."],
  ["Database error",                     "Erro interno. Tente novamente em instantes."],
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
  // Exibe a mensagem original quando não há tradução (ajuda a diagnosticar erros novos)
  return msg.length <= 150 ? msg : "Ocorreu um erro. Tente novamente.";
}
