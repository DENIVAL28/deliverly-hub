import { describe, it, expect } from "vitest";
import { limiteAtingido, parsarErroSupabase, PLANO_LIMITS } from "@/lib/plano";

describe("limiteAtingido", () => {
  it("retorna false quando limite é null (ilimitado)", () => {
    expect(limiteAtingido(9999, null)).toBe(false);
  });

  it("retorna false quando atual < limite", () => {
    expect(limiteAtingido(49, 50)).toBe(false);
  });

  it("retorna true quando atual === limite (atingiu exato)", () => {
    expect(limiteAtingido(50, 50)).toBe(true);
  });

  it("retorna true quando atual > limite", () => {
    expect(limiteAtingido(51, 50)).toBe(true);
  });

  it("retorna false com zero atual e limite positivo", () => {
    expect(limiteAtingido(0, 10)).toBe(false);
  });
});

describe("PLANO_LIMITS — valores corretos por plano", () => {
  it("básico: 50 produtos, 3 cupons, 0 entregadores", () => {
    expect(PLANO_LIMITS.basico.produtos).toBe(50);
    expect(PLANO_LIMITS.basico.cupons).toBe(3);
    expect(PLANO_LIMITS.basico.entregadores).toBe(0);
  });

  it("profissional: 150 produtos, cupons ilimitados, 10 entregadores", () => {
    expect(PLANO_LIMITS.profissional.produtos).toBe(150);
    expect(PLANO_LIMITS.profissional.cupons).toBeNull();
    expect(PLANO_LIMITS.profissional.entregadores).toBe(10);
  });

  it("premium: tudo ilimitado (null)", () => {
    expect(PLANO_LIMITS.premium.produtos).toBeNull();
    expect(PLANO_LIMITS.premium.cupons).toBeNull();
    expect(PLANO_LIMITS.premium.entregadores).toBeNull();
  });
});

describe("parsarErroSupabase", () => {
  it("extrai e limpa mensagem de limite de plano", () => {
    const err = { message: "LIMITE_PLANO: Limite de 50 produtos atingido no plano basico." };
    const resultado = parsarErroSupabase(err);
    expect(resultado).toBe("Limite de 50 produtos atingido no plano basico.");
    expect(resultado).not.toContain("LIMITE_PLANO:");
  });

  it("extrai mensagem de acesso negado", () => {
    const err = { message: "ACESSO_NEGADO: Apenas administradores podem alterar o plano." };
    const resultado = parsarErroSupabase(err);
    expect(resultado).toBe("Apenas administradores podem alterar o plano.");
  });

  it("transforma duplicate key em mensagem amigável", () => {
    const err = { message: "duplicate key value violates unique constraint" };
    expect(parsarErroSupabase(err)).toBe("Já existe um registro com esse valor.");
  });

  it("transforma foreign key em mensagem amigável", () => {
    const err = { message: "violates foreign key constraint" };
    expect(parsarErroSupabase(err)).toBe("Referência inválida. Verifique os dados.");
  });

  it("retorna mensagem original para erros desconhecidos", () => {
    const err = { message: "connection timeout" };
    expect(parsarErroSupabase(err)).toBe("connection timeout");
  });

  it("retorna 'Erro desconhecido' para null", () => {
    expect(parsarErroSupabase(null)).toBe("Erro desconhecido");
  });

  it("retorna 'Erro desconhecido' quando message é undefined", () => {
    expect(parsarErroSupabase({})).toBe("Erro desconhecido");
  });
});
