// Lógica pura do carrinho PDV — sem dependências de React ou Supabase
// Exportada separadamente para facilitar testes

export interface OpcaoSelecionada {
  grupoId: string;
  grupoNome: string;
  opcaoId: string;
  opcaoNome: string;
  precoAdicional: number;
}

export interface CartItem {
  id: string;
  nome: string;
  preco: number;
  qty: number;
  opcoes?: OpcaoSelecionada[];
}

export interface Comanda {
  id: string;
  identificacao: string;
  cart: Record<string, CartItem>;
  pagamento: "Dinheiro" | "Cartão" | "PIX";
  valorCliente: string;
  descontoValor: string;
  descontoPct: string;
  obs: string;
  criadaEm: Date;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeComanda(): Comanda {
  return {
    id: uid(),
    identificacao: "",
    cart: {},
    pagamento: "Dinheiro",
    valorCliente: "",
    descontoValor: "",
    descontoPct: "",
    obs: "",
    criadaEm: new Date(),
  };
}

export function cartSubtotal(cart: Record<string, CartItem>): number {
  // Somar em centavos (inteiros) para evitar imprecisão de ponto flutuante
  const cents = Object.values(cart).reduce((s, i) => s + Math.round(i.preco * 100) * i.qty, 0);
  return cents / 100;
}

export function cartCount(cart: Record<string, CartItem>): number {
  return Object.values(cart).reduce((s, i) => s + i.qty, 0);
}

export function calcularDesconto(
  subtotal: number,
  descontoValor: string,
  descontoPct: string
): number {
  if (descontoValor) {
    return Math.min(subtotal, Math.max(0, Number(descontoValor) || 0));
  }
  if (descontoPct) {
    const pct = Math.min(100, Math.max(0, Number(descontoPct) || 0));
    return Math.round((subtotal * pct) / 100 * 100) / 100;
  }
  return 0;
}

export function calcularTroco(
  totalFinal: number,
  pagamento: string,
  valorCliente: string
): number | null {
  if (pagamento !== "Dinheiro" || !valorCliente) return null;
  return Number(valorCliente) - totalFinal;
}

export function addItemToCart(
  cart: Record<string, CartItem>,
  produto: { id: string; nome: string; preco: number; preco_promocional?: number | null },
  qty: number,
  opcoes?: OpcaoSelecionada[]
): Record<string, CartItem> {
  const precoBase = Number(produto.preco_promocional ?? produto.preco);
  const extra = opcoes ? opcoes.reduce((s, o) => s + o.precoAdicional, 0) : 0;
  const preco = precoBase + extra;
  const cur = cart[produto.id];

  if (opcoes !== undefined) {
    return { ...cart, [produto.id]: { id: produto.id, nome: produto.nome, preco, qty: (cur?.qty ?? 0) + qty, opcoes } };
  }
  return {
    ...cart,
    [produto.id]: cur
      ? { ...cur, qty: cur.qty + qty }
      : { id: produto.id, nome: produto.nome, preco, qty },
  };
}

export function removeItemFromCart(
  cart: Record<string, CartItem>,
  id: string
): Record<string, CartItem> {
  const { [id]: _, ...rest } = cart;
  return rest;
}

export function changeQty(
  cart: Record<string, CartItem>,
  id: string,
  delta: number
): Record<string, CartItem> {
  const cur = cart[id];
  if (!cur) return cart;
  if (cur.qty + delta <= 0) return removeItemFromCart(cart, id);
  return { ...cart, [id]: { ...cur, qty: cur.qty + delta } };
}
