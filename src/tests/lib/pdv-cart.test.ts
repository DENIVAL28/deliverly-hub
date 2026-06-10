import { describe, it, expect } from "vitest";
import {
  cartSubtotal,
  cartCount,
  calcularDesconto,
  calcularTroco,
  addItemToCart,
  changeQty,
  removeItemFromCart,
  type CartItem,
} from "@/lib/pdv-cart";

// ── Fixtures ───────────────────────────────────────────────
const cartBase: Record<string, CartItem> = {
  pizza: { id: "pizza", nome: "Pizza Calabresa GG", preco: 50, qty: 2 },
  coca:  { id: "coca",  nome: "Coca-Cola 2L",       preco: 8,  qty: 3 },
};
// subtotal = 50*2 + 8*3 = 124

// ── cartSubtotal ───────────────────────────────────────────
describe("cartSubtotal", () => {
  it("soma preco × qty de todos os itens", () => {
    expect(cartSubtotal(cartBase)).toBe(124);
  });

  it("retorna 0 para carrinho vazio", () => {
    expect(cartSubtotal({})).toBe(0);
  });

  it("funciona com item único", () => {
    expect(cartSubtotal({ p: { id: "p", nome: "X", preco: 25.5, qty: 4 } })).toBe(102);
  });
});

// ── cartCount ──────────────────────────────────────────────
describe("cartCount", () => {
  it("soma quantidades de todos os itens", () => {
    expect(cartCount(cartBase)).toBe(5); // 2 + 3
  });

  it("retorna 0 para carrinho vazio", () => {
    expect(cartCount({})).toBe(0);
  });
});

// ── calcularDesconto ───────────────────────────────────────
describe("calcularDesconto", () => {
  it("aplica desconto em valor fixo R$", () => {
    expect(calcularDesconto(100, "15", "")).toBe(15);
  });

  it("aplica desconto percentual", () => {
    expect(calcularDesconto(200, "", "10")).toBe(20);
  });

  it("desconto fixo não ultrapassa o subtotal", () => {
    expect(calcularDesconto(50, "200", "")).toBe(50);
  });

  it("percentual de 100% zera o total", () => {
    expect(calcularDesconto(100, "", "100")).toBe(100);
  });

  it("percentual não ultrapassa 100%", () => {
    expect(calcularDesconto(100, "", "150")).toBe(100);
  });

  it("valor fixo tem prioridade quando ambos preenchidos", () => {
    expect(calcularDesconto(100, "20", "50")).toBe(20);
  });

  it("retorna 0 sem desconto", () => {
    expect(calcularDesconto(100, "", "")).toBe(0);
  });

  it("ignora strings inválidas", () => {
    expect(calcularDesconto(100, "abc", "")).toBe(0);
  });
});

// ── calcularTroco ──────────────────────────────────────────
describe("calcularTroco", () => {
  it("calcula troco positivo corretamente", () => {
    expect(calcularTroco(50, "Dinheiro", "100")).toBe(50);
  });

  it("retorna negativo quando valor insuficiente", () => {
    expect(calcularTroco(100, "Dinheiro", "80")).toBe(-20);
  });

  it("retorna null quando pagamento não é dinheiro", () => {
    expect(calcularTroco(100, "PIX", "200")).toBeNull();
    expect(calcularTroco(100, "Cartão", "200")).toBeNull();
  });

  it("retorna null quando valor não informado", () => {
    expect(calcularTroco(100, "Dinheiro", "")).toBeNull();
  });

  it("troco zero quando valor exato", () => {
    expect(calcularTroco(50, "Dinheiro", "50")).toBe(0);
  });
});

// ── addItemToCart ──────────────────────────────────────────
describe("addItemToCart", () => {
  const produto = { id: "x", nome: "Hambúrguer", preco: 30, preco_promocional: null };

  it("adiciona novo item ao carrinho", () => {
    const c = addItemToCart({}, produto, 1);
    expect(c["x"]).toMatchObject({ id: "x", nome: "Hambúrguer", preco: 30, qty: 1 });
  });

  it("incrementa qty de item existente", () => {
    const c1 = addItemToCart({}, produto, 2);
    const c2 = addItemToCart(c1, produto, 1);
    expect(c2["x"].qty).toBe(3);
  });

  it("usa preco_promocional quando disponível", () => {
    const promo = { ...produto, preco: 30, preco_promocional: 20 };
    const c = addItemToCart({}, promo, 1);
    expect(c["x"].preco).toBe(20);
  });

  it("soma precos adicionais das opções", () => {
    const opcoes = [
      { grupoId: "g1", grupoNome: "Tamanho", opcaoId: "o1", opcaoNome: "GG", precoAdicional: 5 },
    ];
    const c = addItemToCart({}, produto, 1, opcoes);
    expect(c["x"].preco).toBe(35); // 30 + 5
    expect(c["x"].opcoes).toHaveLength(1);
  });

  it("não muta o carrinho original", () => {
    const original = { ...cartBase };
    addItemToCart(original, produto, 1);
    expect(original["x"]).toBeUndefined();
  });
});

// ── changeQty ──────────────────────────────────────────────
describe("changeQty", () => {
  const cart: Record<string, CartItem> = {
    p: { id: "p", nome: "X", preco: 10, qty: 3 },
  };

  it("incrementa quantidade", () => {
    expect(changeQty(cart, "p", +1)["p"].qty).toBe(4);
  });

  it("decrementa quantidade", () => {
    expect(changeQty(cart, "p", -1)["p"].qty).toBe(2);
  });

  it("remove item quando qty chegar a 0", () => {
    const single: Record<string, CartItem> = { p: { id: "p", nome: "X", preco: 10, qty: 1 } };
    expect(changeQty(single, "p", -1)["p"]).toBeUndefined();
  });

  it("retorna carrinho inalterado para id inexistente", () => {
    const result = changeQty(cart, "inexistente", +1);
    expect(result).toEqual(cart);
  });
});

// ── removeItemFromCart ─────────────────────────────────────
describe("removeItemFromCart", () => {
  it("remove item pelo id", () => {
    const c = removeItemFromCart(cartBase, "coca");
    expect(c["coca"]).toBeUndefined();
    expect(c["pizza"]).toBeDefined();
  });

  it("não muta o carrinho original", () => {
    const original = { ...cartBase };
    removeItemFromCart(original, "pizza");
    expect(original["pizza"]).toBeDefined();
  });

  it("retorna cópia vazia ao remover único item", () => {
    const single: Record<string, CartItem> = { p: { id: "p", nome: "X", preco: 10, qty: 1 } };
    expect(Object.keys(removeItemFromCart(single, "p"))).toHaveLength(0);
  });
});
