import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Plus, Minus, Trash2, Search, X, QrCode, ImageIcon, History, CheckCircle2, Printer, User, Banknote, CreditCard, ScrollText } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { copiarTexto } from "@/lib/validacoes";

export const Route = createFileRoute("/_authenticated/empresa/pdv")({
  component: PdvPage,
});

// ─── Types ────────────────────────────────────────────────
import {
  type OpcaoSelecionada,
  type CartItem,
  type Comanda,
  uid,
  makeComanda,
  cartSubtotal,
  cartCount,
  calcularDesconto,
  calcularTroco,
  addItemToCart,
  changeQty,
  removeItemFromCart,
} from "@/lib/pdv-cart";

interface Comprovante {
  numero: number; identificacao: string; itens: CartItem[]; subtotal: number;
  desconto: number; total: number; pagamento: string; troco: number | null;
  obs: string; horario: Date;
}

// Símbolo oficial do PIX — Banco Central do Brasil
function PixIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-label="PIX">
      {/* 4 losangos formam o símbolo oficial do PIX */}
      <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.7 369.7C345.1 375.1 345.1 384.4 339.7 389.7L262.4 466.1C257.1 471.5 247.8 471.5 242.4 466.1L165.2 388.9C159.8 383.5 159.8 374.2 165.2 368.8L242.4 292.5z
             M242.4 45.9C247.8 40.6 257.1 40.6 262.5 45.9L339.7 123.2C345.1 128.5 345.1 137.8 339.7 143.2L262.4 220.5C257.1 225.8 247.8 225.8 242.4 220.5L165.2 143.2C159.8 137.8 159.8 128.5 165.2 123.2L242.4 45.9z
             M45.9 242.4C40.6 247.8 40.6 257.1 45.9 262.5L123.2 339.7C128.5 345.1 137.8 345.1 143.2 339.7L220.5 262.4C225.8 257.1 225.8 247.8 220.5 242.4L143.2 165.2C137.8 159.8 128.5 159.8 123.2 165.2L45.9 242.4z
             M466.1 242.4C460.7 247.8 460.7 257.1 466.1 262.5L388.9 339.7C383.5 345.1 374.2 345.1 368.8 339.7L291.5 262.4C286.2 257.1 286.2 247.8 291.5 242.4L368.8 165.2C374.2 159.8 383.5 159.8 388.9 165.2L466.1 242.4z" />
    </svg>
  );
}


// ─── Component ────────────────────────────────────────────
function PdvPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  // ── Comandas
  const firstId = useRef(uid());
  const [comandas, setComandas] = useState<Comanda[]>([{
    id: firstId.current, identificacao: "", cart: {}, pagamento: "Dinheiro",
    valorCliente: "", descontoValor: "", descontoPct: "", obs: "", criadaEm: new Date(),
  }]);
  const [ativaId, setAtivaId] = useState(firstId.current);
  const comanda = comandas.find((c) => c.id === ativaId) ?? comandas[0];
  const { cart, identificacao, pagamento, valorCliente, descontoValor, descontoPct, obs } = comanda;

  function upd(patch: Partial<Omit<Comanda, "id" | "criadaEm">>) {
    setComandas((prev) => prev.map((c) => c.id === comanda.id ? { ...c, ...patch } : c));
  }
  function updCart(fn: (c: Record<string, CartItem>) => Record<string, CartItem>) {
    setComandas((prev) => prev.map((c) => c.id === comanda.id ? { ...c, cart: fn(c.cart) } : c));
  }

  // ── UI state (shared, não pertence a uma comanda específica)
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [tabDireita, setTabDireita] = useState<"carrinho" | "mesas" | "historico">("carrinho");
  const [finishing, setFinishing] = useState(false);
  const [comprovante, setComprovante] = useState<Comprovante | null>(null);
  const [qrModal, setQrModal] = useState<string | null>(null);
  const [qrMesaNum, setQrMesaNum] = useState("1");
  const [qrMesaUrl, setQrMesaUrl] = useState<string | null>(null);
  const [qrMesaLink, setQrMesaLink] = useState("");

  const identificacaoRef = useRef<HTMLInputElement>(null);

  // ── Queries
  const { data: vendasHoje = [] } = useQuery({
    queryKey: ["pdv-hoje", empresaId],
    enabled: !!empresaId,
    refetchInterval: 30000,
    queryFn: async () => {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      return (await supabase.from("pedidos")
        .select("id,numero,total,subtotal,forma_pagamento,cliente_nome,created_at,pedido_itens(nome,quantidade,preco_unitario,subtotal)")
        .eq("empresa_id", empresaId!)
        .eq("tipo", "pdv")
        .eq("status", "finalizado")
        .gte("created_at", hoje.toISOString())
        .order("created_at", { ascending: false })
      ).data ?? [];
    },
  });

  const resumo = useMemo(() => {
    const v = vendasHoje as any[];
    const total    = v.reduce((s, x) => s + Number(x.total), 0);
    const dinheiro = v.filter((x) => x.forma_pagamento === "Dinheiro").reduce((s, x) => s + Number(x.total), 0);
    const cartao   = v.filter((x) => x.forma_pagamento === "Cartão").reduce((s, x) => s + Number(x.total), 0);
    const pix      = v.filter((x) => x.forma_pagamento === "PIX").reduce((s, x) => s + Number(x.total), 0);
    return { total, dinheiro, cartao, pix, qtd: v.length };
  }, [vendasHoje]);

  const { data: empresa } = useQuery({
    queryKey: ["empresa-pdv", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("empresas").select("nome_fantasia,slug").eq("id", empresaId!).single()).data,
  });

  // ── Pedidos das mesas (QR code) em tempo real ──────────────
  const { data: pedidosMesa = [], refetch: refetchMesas } = useQuery({
    queryKey: ["pdv-mesas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, numero, mesa, status, total, created_at, cliente_nome, pedido_itens(nome, quantidade, subtotal)")
        .eq("empresa_id", empresaId!)
        .not("mesa", "is", null)
        .not("status", "in", '("finalizado","cancelado")')
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase
      .channel(`pdv-mesas-${empresaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        () => { refetchMesas(); qc.invalidateQueries({ queryKey: ["pdv-mesas", empresaId] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("categorias").select("id,nome").eq("empresa_id", empresaId!).eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("produtos").select("*, categorias(nome)").eq("empresa_id", empresaId!).eq("ativo", true)).data ?? [],
  });

  const produtoIds = useMemo(() => (produtos as any[]).map((p: any) => p.id), [produtos]);
  const { data: gruposExistentes = [] } = useQuery({
    queryKey: ["grupos-existentes-pdv", produtoIds.join(",")],
    enabled: produtoIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (await (supabase.from("grupos_opcoes") as any).select("produto_id").in("produto_id", produtoIds)).data ?? [],
  });
  const produtosComGrupos = useMemo(() => {
    const set = new Set<string>();
    (gruposExistentes as any[]).forEach((g) => set.add(g.produto_id));
    return set;
  }, [gruposExistentes]);

  // ── Computed (active comanda)
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const subtotal = cartSubtotal(cart);
  const cartIsEmpty = Object.keys(cart).length === 0;
  const descontoCalculado = useMemo(
    () => calcularDesconto(subtotal, descontoValor, descontoPct),
    [subtotal, descontoValor, descontoPct]
  );
  const totalFinal = Math.round(Math.max(0, subtotal - descontoCalculado) * 100) / 100;
  const troco = useMemo(
    () => calcularTroco(totalFinal, pagamento, valorCliente),
    [pagamento, valorCliente, totalFinal]
  );

  const termoBusca = busca.trim().toLowerCase();
  const produtosFiltrados = useMemo(() => {
    let lista = produtos as any[];
    if (catAtiva) lista = lista.filter((p) => p.categoria_id === catAtiva);
    if (termoBusca) lista = lista.filter((p) => p.nome.toLowerCase().includes(termoBusca) || (p.descricao ?? "").toLowerCase().includes(termoBusca));
    return lista;
  }, [produtos, catAtiva, termoBusca]);

  const categoriasComProdutos = (categorias as any[]).filter((c) =>
    (produtos as any[]).some((p) => p.categoria_id === c.id)
  );

  // ── Cart actions
  function addToCart(p: any, qty = 1, opcoes?: OpcaoSelecionada[]) {
    updCart((c) => addItemToCart(c, p, qty, opcoes));
  }
  function incCart(id: string)  { updCart((c) => changeQty(c, id, +1)); }
  function decCart(id: string)  { updCart((c) => changeQty(c, id, -1)); }
  function removeFromCart(id: string) { updCart((c) => removeItemFromCart(c, id)); }

  // ── Comanda actions
  function novaComanda() {
    const nova = makeComanda();
    setComandas((prev) => [...prev, nova]);
    setAtivaId(nova.id);
    setTabDireita("carrinho");
    setTimeout(() => identificacaoRef.current?.focus(), 100);
  }

  function fecharComanda(id: string, force = false) {
    const c = comandas.find((x) => x.id === id)!;
    const hasItems = Object.keys(c.cart).length > 0;
    if (!force && hasItems && !window.confirm(`Fechar "${c.identificacao.trim() || "comanda"}"? Os itens serão perdidos.`)) return;
    if (comandas.length === 1) {
      // Não pode fechar a última — só reseta
      setComandas([{ ...makeComanda(), id }]);
      return;
    }
    const idx = comandas.findIndex((x) => x.id === id);
    const remaining = comandas.filter((x) => x.id !== id);
    setComandas(remaining);
    if (ativaId === id) setAtivaId(remaining[Math.max(0, idx - 1)].id);
  }

  function resetComandaAtiva() {
    upd({ cart: {}, identificacao: "", pagamento: "Dinheiro", valorCliente: "", descontoValor: "", descontoPct: "", obs: "" });
  }

  // ── Produto click
  function handleProductClick(p: any) {
    if (p.controlar_estoque && p.estoque === 0) { toast.error(`${p.nome} está esgotado`); return; }
    if (!produtosComGrupos.has(p.id)) {
      addToCart(p);
      toast.success(`${p.nome} adicionado!`, { duration: 1000 });
      return;
    }
    setSelectedProduct(p);
  }

  async function abrirQrCardapio() {
    if (!empresa?.slug) return;
    const url = `${window.location.origin}/loja/${empresa.slug}`;
    setQrMesaLink(url);
    setQrMesaNum("1");
    setQrMesaUrl(null);
    try {
      setQrModal(await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: "#18181b", light: "#ffffff" } }));
    } catch { toast.error("Erro ao gerar QR code"); }
  }

  async function gerarQrMesa(num: string) {
    if (!empresa?.slug) return;
    const url = `${window.location.origin}/loja/${empresa.slug}?mesa=${encodeURIComponent(num)}`;
    setQrMesaLink(url);
    try {
      setQrMesaUrl(await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: "#18181b", light: "#ffffff" } }));
    } catch { toast.error("Erro ao gerar QR code"); }
  }

  const statusMesaLabel: Record<string, { label: string; cls: string }> = {
    novo:    { label: "Aguardando", cls: "bg-blue-100 text-blue-700"   },
    aceito:  { label: "Aceito",     cls: "bg-amber-100 text-amber-700" },
    preparo: { label: "Em preparo", cls: "bg-orange-100 text-orange-700" },
    entrega: { label: "A caminho",  cls: "bg-purple-100 text-purple-700" },
  };

  // ── Finalizar venda
  async function finalizar() {
    const items = Object.values(cart);
    if (items.length === 0) { toast.error("Carrinho vazio"); return; }
    if (pagamento === "Dinheiro" && valorCliente && troco !== null && troco < 0) { toast.error("Valor recebido menor que o total"); return; }
    setFinishing(true);

    const nomeCliente = identificacao.trim() || "Balcão";

    const itensRpc = items.map((i) => {
      const prod = (produtos as any[]).find((p: any) => p.id === i.id);
      return {
        produto_id: i.id,
        nome: i.nome,
        quantidade: i.qty,
        preco_unitario: i.preco,
        subtotal: i.preco * i.qty,
        observacao: i.opcoes?.length ? i.opcoes.map((o: any) => o.opcaoNome).join(", ") : null,
        controlar_estoque: !!prod?.controlar_estoque,
      };
    });

    const { data: pedidoJson, error } = await supabase.rpc("finalizar_pedido", {
      p_empresa_id:      empresaId!,
      p_cliente_nome:    nomeCliente,
      p_forma_pagamento: pagamento,
      p_observacao:      obs || undefined,
      p_subtotal:        subtotal,
      p_taxa_entrega:    0,
      p_total:           totalFinal,
      p_tipo:            "pdv",
      p_status:          "finalizado",
      p_itens:           itensRpc,
    });

    if (error || !pedidoJson) { toast.error("Erro ao finalizar venda. Tente novamente."); setFinishing(false); return; }
    const pedido = pedidoJson as { id: string; numero: number };

    setComprovante({ numero: pedido.numero, identificacao: nomeCliente, itens: items, subtotal, desconto: descontoCalculado, total: totalFinal, pagamento, troco, obs, horario: new Date() });

    qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
    qc.invalidateQueries({ queryKey: ["pdv-hoje", empresaId] });

    // Fechar a comanda ou resetar se for a última
    fecharComanda(comanda.id, true);
    setFinishing(false);
  }

  // ── Atalho Enter
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !cartIsEmpty && !finishing && !selectedProduct && !comprovante) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        finalizar();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cartIsEmpty, finishing, selectedProduct, comprovante, cart, pagamento, totalFinal, obs, identificacao]);

  // ─── JSX ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col -m-4 md:-m-10 h-[calc(100vh-56px)] md:h-screen overflow-hidden">

      {/* ══ TOPBAR ══ */}
      <div className="shrink-0 bg-white border-b border-black/5">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 gap-3">
          <h1 className="text-base font-bold text-zinc-900 shrink-0">Caixa / PDV</h1>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={abrirQrCardapio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              <QrCode className="size-3.5" /> QR Mesas
            </button>
            {(pedidosMesa as any[]).length > 0 && (
              <button
                onClick={() => setTabDireita("mesas")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold animate-pulse hover:animate-none hover:bg-orange-400 transition-colors">
                🪑 {(pedidosMesa as any[]).length} mesa{(pedidosMesa as any[]).length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
        {/* Resumo caixa */}
        <div className="flex items-center gap-2 px-4 md:px-6 pb-3 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 shrink-0 mr-1">Hoje</span>
          <div className="flex items-center gap-1.5 bg-brand/5 border border-brand/15 rounded-xl px-3 py-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-zinc-500">Total</span>
            <span className="text-sm font-black text-brand">{fmt(resumo.total)}</span>
            <span className="text-[10px] text-zinc-400 border-l border-zinc-200 pl-1.5 ml-0.5">{resumo.qtd} {resumo.qtd === 1 ? "venda" : "vendas"}</span>
          </div>
          {resumo.dinheiro > 0 && <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-xl px-3 py-1.5 shrink-0"><span className="text-xs">💵</span><span className="text-xs font-bold text-green-700">{fmt(resumo.dinheiro)}</span></div>}
          {resumo.cartao > 0 && <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 shrink-0"><span className="text-xs">💳</span><span className="text-xs font-bold text-blue-700">{fmt(resumo.cartao)}</span></div>}
          {resumo.pix > 0 && <div className="flex items-center gap-1.5 bg-[#32BCAD]/10 border border-[#32BCAD]/20 rounded-xl px-3 py-1.5 shrink-0"><PixIcon className="size-3.5 text-[#32BCAD]" /><span className="text-xs font-bold text-[#32BCAD]">{fmt(resumo.pix)}</span></div>}
          {resumo.qtd === 0 && <span className="text-xs text-zinc-400 italic">Nenhuma venda registrada hoje</span>}
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="flex flex-1 min-h-0">

        {/* ═══ LEFT: Catálogo ═══ */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-black/5 overflow-hidden">
          {/* Category + Search bar */}
          <div className="shrink-0 bg-white border-b border-black/5">
            <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
              <button onClick={() => { setCatAtiva(null); setBusca(""); }}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${!catAtiva && !busca ? "bg-brand text-white shadow-sm shadow-brand/20" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                Todos
              </button>
              {categoriasComProdutos.map((c: any) => (
                <button key={c.id} onClick={() => { setCatAtiva(c.id); setBusca(""); }}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${catAtiva === c.id ? "bg-brand text-white shadow-sm shadow-brand/20" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                  {c.nome}
                </button>
              ))}
              <div className="relative ml-auto shrink-0 w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                <input value={busca} onChange={(e) => { setBusca(e.target.value); setCatAtiva(null); }}
                  placeholder="Buscar..."
                  className="w-full h-9 pl-8 pr-7 rounded-xl border border-zinc-200 text-xs bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-zinc-400" />
                {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600"><X className="size-3.5" /></button>}
              </div>
            </div>
          </div>
          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#f8f8fa]">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {produtosFiltrados.map((p: any) => {
                const esgotado = p.controlar_estoque && p.estoque === 0;
                const preco = Number(p.preco_promocional ?? p.preco);
                const qtyInCart = cart[p.id]?.qty ?? 0;
                const temGrupos = produtosComGrupos.has(p.id);
                const inicial = p.nome.charAt(0).toUpperCase();
                return (
                  <button key={p.id} onClick={() => handleProductClick(p)} disabled={esgotado}
                    className={`relative bg-white rounded-2xl text-left overflow-hidden transition-all duration-150 group ${
                      esgotado ? "opacity-50 cursor-not-allowed shadow-sm"
                      : qtyInCart > 0 ? "shadow-lg shadow-brand/10 ring-2 ring-brand"
                      : "shadow-sm hover:shadow-md active:scale-[0.98]"
                    }`}>

                    {/* Foto / Placeholder */}
                    {p.foto_url ? (
                      <div className="w-full h-32 overflow-hidden relative">
                        <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        {qtyInCart > 0 && (
                          <div className="absolute inset-0 bg-brand/10" />
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, #f1f0ff, #e8e6ff)` }}>
                        <span className="text-5xl font-black text-brand/20 select-none">{inicial}</span>
                      </div>
                    )}

                    {/* Badges sobre a imagem */}
                    {qtyInCart > 0 && (
                      <div className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-brand text-white text-[11px] font-black flex items-center justify-center shadow-lg ring-2 ring-white">{qtyInCart}</div>
                    )}
                    {temGrupos && !esgotado && qtyInCart === 0 && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/40 text-white text-[9px] font-bold backdrop-blur-sm tracking-wide">+ opções</div>
                    )}
                    {esgotado && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-wide">ESGOTADO</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="p-3.5">
                      <p className="text-sm font-extrabold text-black leading-tight line-clamp-2 mb-2.5 tracking-tight">{p.nome}</p>
                      <div className="flex items-end justify-between gap-1">
                        <div>
                          <div className="text-base font-black text-brand leading-none">{fmt(preco)}</div>
                          {p.preco_promocional && (
                            <div className="text-[10px] text-zinc-400 line-through mt-0.5">{fmt(Number(p.preco))}</div>
                          )}
                        </div>
                        {!esgotado && (
                          <div className={`size-8 rounded-xl flex items-center justify-center transition-all shrink-0 font-black ${
                            qtyInCart > 0
                              ? "bg-brand text-white"
                              : "bg-zinc-100 text-zinc-400 group-hover:bg-brand group-hover:text-white"
                          }`}>
                            {qtyInCart > 0
                              ? <span className="text-sm">{qtyInCart}</span>
                              : <Plus className="size-4" />}
                          </div>
                        )}
                      </div>
                      {!esgotado && p.controlar_estoque && p.estoque > 0 && p.estoque <= 5 && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                          ⚠ Últimas {p.estoque}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {produtosFiltrados.length === 0 && (
                <div className="col-span-full py-24 text-center">
                  <div className="size-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-3">
                    <Search className="size-7 text-zinc-300" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-400">{busca ? `Nenhum resultado para "${busca}"` : "Nenhum produto nesta categoria"}</p>
                  {busca && <button onClick={() => setBusca("")} className="mt-2 text-xs text-brand hover:underline">Limpar busca</button>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Comandas Panel ═══ */}
        <div className="w-[300px] xl:w-[320px] shrink-0 flex flex-col bg-white overflow-hidden">

          {/* Comanda tabs bar */}
          <div className="shrink-0 border-b border-black/5 bg-white">
            <div className="flex items-center gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-none">
              {comandas.map((c, idx) => {
                const isAtiva = c.id === ativaId;
                const sub = cartSubtotal(c.cart);
                const cnt = cartCount(c.cart);
                const label = c.identificacao.trim() || `Mesa ${idx + 1}`;
                return (
                  <button key={c.id}
                    onClick={() => { setAtivaId(c.id); setTabDireita("carrinho"); }}
                    className={`group flex items-center gap-1.5 shrink-0 pl-3 pr-2 py-2 rounded-xl text-[11px] font-bold transition-all ${
                      isAtiva
                        ? "bg-brand text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}>
                    <span className="truncate max-w-[64px]">{label}</span>
                    {cnt > 0 && (
                      <span className={`tabular-nums shrink-0 text-[10px] font-black ${isAtiva ? "text-white/70" : "text-zinc-400"}`}>
                        {fmt(sub)}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); fecharComanda(c.id); }}
                      className={`size-4 flex items-center justify-center rounded-full shrink-0 transition-colors ${
                        isAtiva ? "hover:bg-white/30 text-white/80 hover:text-white" : "hover:bg-zinc-300 text-zinc-400"
                      }`}>
                      <X className="size-2.5" />
                    </button>
                  </button>
                );
              })}
              <button onClick={novaComanda}
                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-zinc-300 text-zinc-400 text-[11px] font-bold hover:border-brand hover:text-brand hover:bg-brand/5 transition-all"
                title="Nova comanda">
                <Plus className="size-3" /> Nova
              </button>
              <button onClick={() => setTabDireita(tabDireita === "mesas" ? "carrinho" : "mesas")}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-colors relative ${
                  tabDireita === "mesas" ? "bg-brand text-white shadow-sm" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
                title="Pedidos das mesas">
                🪑 Mesas
                {(pedidosMesa as any[]).length > 0 && tabDireita !== "mesas" && (
                  <span className="absolute -top-1 -right-1 size-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {(pedidosMesa as any[]).length}
                  </span>
                )}
              </button>
              <button onClick={() => setTabDireita((t) => t === "historico" ? "carrinho" : "historico")}
                className={`ml-auto shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-colors ${
                  tabDireita === "historico" ? "bg-brand text-white shadow-sm" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
                title="Histórico do dia">
                <ScrollText className="size-3.5" />
                Histórico
              </button>
            </div>
          </div>

          {/* ── TAB: Carrinho da comanda ativa ── */}
          {tabDireita === "carrinho" && (
            <>
              {/* Identificação */}
              <div className="px-3 pt-3 pb-2.5 shrink-0 border-b border-black/5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    ref={identificacaoRef}
                    value={identificacao}
                    onChange={(e) => upd({ identificacao: e.target.value })}
                    placeholder="Mesa, cliente ou identificação..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 focus:bg-white placeholder:text-zinc-300 placeholder:font-normal transition-all"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                {cartIsEmpty ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                    <div className="size-16 rounded-3xl bg-zinc-50 flex items-center justify-center border border-zinc-100">
                      <span className="text-3xl">🛒</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-400">Pedido vazio</p>
                      <p className="text-xs text-zinc-300 mt-1">Selecione produtos ao lado</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-1.5 mt-1">
                      <kbd className="text-[10px] font-bold bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-500 shadow-sm">Enter</kbd>
                      <span className="text-[11px] text-zinc-400">para finalizar</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {Object.values(cart).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 bg-zinc-50 rounded-2xl px-3 py-3 group hover:bg-zinc-100 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-black leading-tight truncate tracking-tight">{item.nome}</p>
                          {item.opcoes && item.opcoes.length > 0 && (
                            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{item.opcoes.map((o) => o.opcaoNome).join(" · ")}</p>
                          )}
                          <p className="text-sm font-black text-brand mt-1 leading-none">{fmt(item.preco * item.qty)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => decCart(item.id)}
                            className="size-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:border-red-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <Minus className="size-3.5 text-zinc-500" />
                          </button>
                          <span className="text-sm font-black text-zinc-900 min-w-[20px] text-center tabular-nums">{item.qty}</span>
                          <button onClick={() => incCart(item.id)}
                            className="size-7 rounded-lg bg-brand text-white flex items-center justify-center hover:bg-brand/80 transition-colors">
                            <Plus className="size-3.5" />
                          </button>
                          <button onClick={() => removeFromCart(item.id)}
                            className="size-6 flex items-center justify-center text-zinc-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={resetComandaAtiva}
                      className="w-full text-[11px] text-zinc-300 hover:text-red-400 transition-colors py-1.5 text-center font-medium mt-1">
                      Limpar tudo
                    </button>
                  </>
                )}
              </div>

              {/* Payment + totals */}
              {!cartIsEmpty && (
                <div className="border-t border-black/5 px-3 pt-3 pb-4 space-y-3 shrink-0">

                  {/* Totais */}
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden">
                    <div className="px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Subtotal ({Object.values(cart).reduce((s, i) => s + i.qty, 0)} itens)</span>
                        <span className="font-semibold">{fmt(subtotal)}</span>
                      </div>
                      {descontoCalculado > 0 && (
                        <div className="flex justify-between text-xs font-semibold text-green-600">
                          <span>Desconto</span><span>- {fmt(descontoCalculado)}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-3 bg-brand/5 border-t border-brand/10 flex justify-between items-center">
                      <span className="text-sm font-bold text-zinc-600">Total</span>
                      <span className="text-2xl font-black text-brand leading-none">{fmt(totalFinal)}</span>
                    </div>
                  </div>

                  {/* Desconto */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Desconto</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none font-medium">R$</span>
                        <input type="number" min="0" placeholder="0,00" value={descontoValor}
                          onChange={(e) => upd({ descontoValor: e.target.value, ...(e.target.value ? { descontoPct: "" } : {}) })}
                          className="w-full h-9 pl-8 pr-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 bg-zinc-50" />
                      </div>
                      <div className="relative">
                        <input type="number" min="0" max="100" placeholder="0" value={descontoPct}
                          onChange={(e) => upd({ descontoPct: e.target.value, ...(e.target.value ? { descontoValor: "" } : {}) })}
                          className="w-full h-9 pl-3 pr-7 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 bg-zinc-50" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none font-medium">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Pagamento */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Forma de pagamento</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { key: "Dinheiro", icon: <Banknote className="size-5" />, cor: "bg-brand shadow-brand/20" },
                        { key: "Cartão",   icon: <CreditCard className="size-5" />, cor: "bg-brand shadow-brand/20" },
                        { key: "PIX",      icon: <PixIcon className="size-5" />,  cor: "bg-[#32BCAD] shadow-[#32BCAD]/30" },
                      ] as const).map(({ key, icon, cor }) => (
                        <button key={key}
                          onClick={() => upd({ pagamento: key, valorCliente: "" })}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[11px] font-bold transition-all ${
                            pagamento === key
                              ? `${cor} text-white shadow-md scale-[1.02]`
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                          }`}>
                          {icon}
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Troco */}
                  {pagamento === "Dinheiro" && (
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none font-medium">R$</span>
                        <input type="number" min="0" placeholder="Valor recebido" value={valorCliente}
                          onChange={(e) => upd({ valorCliente: e.target.value })}
                          className="w-full h-9 pl-8 pr-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 bg-zinc-50" />
                      </div>
                      {troco !== null && (
                        <div className={`text-xs font-black px-3 py-2 rounded-xl whitespace-nowrap shrink-0 ${troco >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {troco >= 0 ? `Troco ${fmt(troco)}` : "Insuf."}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Obs */}
                  <input value={obs} onChange={(e) => upd({ obs: e.target.value })}
                    placeholder="Observação (opcional)"
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 bg-zinc-50 placeholder:text-zinc-300" />

                  {/* Finalizar */}
                  <button onClick={finalizar} disabled={finishing}
                    className="w-full h-13 py-3.5 rounded-2xl bg-brand hover:bg-brand/90 active:scale-[0.99] disabled:opacity-60 text-white font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-brand/25">
                    <CheckCircle2 className="size-5" />
                    {finishing ? "Finalizando…" : `Finalizar — ${fmt(totalFinal)}`}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── TAB: Mesas ── */}
          {tabDireita === "mesas" && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {(pedidosMesa as any[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <span className="text-4xl">🪑</span>
                  <p className="text-sm font-semibold text-zinc-400">Nenhum pedido de mesa ativo</p>
                  <p className="text-xs text-zinc-300">Os pedidos chegam aqui quando clientes escaneiam o QR da mesa</p>
                </div>
              ) : (
                (pedidosMesa as any[]).map((p: any) => {
                  const meta = statusMesaLabel[p.status] ?? { label: p.status, cls: "bg-zinc-100 text-zinc-500" };
                  const itens = (p.pedido_itens ?? []) as any[];
                  const minutos = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
                  return (
                    <div key={p.id} className="bg-zinc-50 rounded-2xl p-3.5 ring-1 ring-black/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-zinc-900">🪑 {p.mesa}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-brand">
                            {Number(p.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                          <div className="text-[10px] text-zinc-400">{minutos < 1 ? "agora" : `${minutos}min atrás`}</div>
                        </div>
                      </div>
                      {p.cliente_nome && p.cliente_nome !== "Balcão" && (
                        <div className="text-xs text-zinc-500 mb-1.5">👤 {p.cliente_nome}</div>
                      )}
                      <ul className="space-y-0.5 border-t border-zinc-200 pt-2">
                        {itens.map((i: any, idx: number) => (
                          <li key={idx} className="flex justify-between text-xs text-zinc-600">
                            <span>{i.quantidade}× {i.nome}</span>
                            <span className="text-zinc-400">{Number(i.subtotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </li>
                        ))}
                      </ul>
                      <a href={`/pedido/${p.id}`} target="_blank" rel="noreferrer"
                        className="mt-2.5 flex items-center justify-center w-full text-[11px] font-semibold text-brand hover:underline">
                        Ver detalhes / atualizar status →
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB: Histórico ── */}
          {tabDireita === "historico" && (
            <div className="flex-1 overflow-y-auto">
              {(vendasHoje as any[]).length === 0 ? (
                <div className="py-16 text-center">
                  <div className="size-16 rounded-2xl bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                    <ScrollText className="size-8 text-zinc-200" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-400">Nenhuma venda hoje</p>
                  <p className="text-xs text-zinc-300 mt-1">As vendas finalizadas aparecerão aqui</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {(vendasHoje as any[]).map((v: any) => (
                    <div key={v.id} className="bg-zinc-50 rounded-xl p-3 space-y-2 border border-zinc-100">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-zinc-800">#{v.numero}</span>
                            <span className="text-[10px] text-zinc-400">{new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{v.cliente_nome}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-brand">{fmt(Number(v.total))}</p>
                          <p className="text-[10px] text-zinc-400">{v.forma_pagamento}</p>
                        </div>
                      </div>
                      {v.pedido_itens?.length > 0 && (
                        <div className="border-t border-zinc-200 pt-2 space-y-0.5">
                          {v.pedido_itens.map((it: any, i: number) => (
                            <div key={i} className="flex justify-between text-[11px] text-zinc-500">
                              <span>{it.quantidade}× {it.nome}</span>
                              <span>{fmt(Number(it.subtotal))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL: Opções ══ */}
      {selectedProduct && (
        <OptionsModal product={selectedProduct} fmt={fmt}
          onClose={() => setSelectedProduct(null)}
          onAdd={(qty, opcoes) => {
            addToCart(selectedProduct, qty, opcoes.length > 0 ? opcoes : undefined);
            setSelectedProduct(null);
            toast.success(`${selectedProduct.nome} adicionado!`, { duration: 1000 });
          }} />
      )}

      {/* ══ MODAL: Comprovante ══ */}
      {comprovante && (
        <ComprovanteModal comprovante={comprovante} nomeEmpresa={empresa?.nome_fantasia ?? "Estabelecimento"}
          fmt={fmt} onClose={() => setComprovante(null)} />
      )}

      {/* ══ MODAL: QR ══ */}
      {qrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setQrModal(null); setQrMesaUrl(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

            {/* Header fixo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-brand" />
                <h3 className="text-base font-bold text-zinc-900">QR Mesas / Cardápio</h3>
              </div>
              <button onClick={() => { setQrModal(null); setQrMesaUrl(null); }}
                className="size-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                <X className="size-4" />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* Duas colunas: QR geral + QR mesa */}
              <div className="grid grid-cols-2 gap-4">

                {/* QR Geral */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-500 mb-2">QR Geral</p>
                  <div className="p-2 bg-zinc-50 rounded-xl inline-block">
                    <img src={qrModal} alt="QR" className="size-28 rounded-md" />
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1 font-mono truncate">/loja/{empresa?.slug}</p>
                  <a href={qrModal} download="cardapio-geral.png"
                    className="mt-1.5 inline-block text-[10px] font-semibold px-2 py-1 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
                    Baixar
                  </a>
                </div>

                {/* QR por mesa */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-500 mb-2">QR por mesa</p>
                  <div className="flex items-center gap-1.5 justify-center mb-2">
                    <span className="text-xs text-zinc-500">Mesa</span>
                    <input
                      type="number" min="1" max="99"
                      value={qrMesaNum}
                      onChange={(e) => setQrMesaNum(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && gerarQrMesa(qrMesaNum)}
                      className="w-14 h-8 rounded-lg border border-zinc-200 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <button onClick={() => gerarQrMesa(qrMesaNum)}
                      className="h-8 px-3 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-colors">
                      Gerar
                    </button>
                  </div>
                  {qrMesaUrl ? (
                    <>
                      <div className="p-2 bg-zinc-50 rounded-xl inline-block">
                        <img src={qrMesaUrl} alt={`QR Mesa ${qrMesaNum}`} className="size-28 rounded-md" />
                      </div>
                      <p className="text-[9px] text-zinc-400 mt-1 font-mono truncate">?mesa={qrMesaNum}</p>
                      <div className="flex gap-1.5 justify-center mt-1.5">
                        <button
                          onClick={async () => { await copiarTexto(qrMesaLink) ? toast.success("Link copiado!") : toast.error("Não foi possível copiar. Copie manualmente."); }}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
                          Copiar
                        </button>
                        <a href={qrMesaUrl} download={`mesa-${qrMesaNum}.png`}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-brand text-white hover:bg-brand/90">
                          Baixar
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="size-28 rounded-xl bg-zinc-50 border-2 border-dashed border-zinc-200 flex items-center justify-center mx-auto">
                      <span className="text-2xl">🪑</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Gerar múltiplas mesas */}
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-semibold text-zinc-700 mb-2">Gerar e baixar mesas em sequência</p>
                <div className="flex gap-2 flex-wrap">
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <button key={n}
                      onClick={() => { setQrMesaNum(String(n)); gerarQrMesa(String(n)); }}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        qrMesaNum === String(n) && qrMesaUrl
                          ? "bg-brand text-white border-brand"
                          : "border-zinc-200 text-zinc-600 hover:border-brand hover:text-brand"
                      }`}>
                      Mesa {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   COMPROVANTE MODAL
══════════════════════════════════════════════ */
function ComprovanteModal({ comprovante: c, nomeEmpresa, fmt, onClose }: {
  comprovante: Comprovante; nomeEmpresa: string; fmt: (v: number) => string; onClose: () => void;
}) {
  function imprimir() {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante #${c.numero}</title>
    <style>body{font-family:'Courier New',monospace;font-size:12px;max-width:300px;margin:0 auto;padding:16px}
    .center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #999;margin:8px 0}
    .row{display:flex;justify-content:space-between}.total{font-size:15px;font-weight:bold}</style></head><body>
    <div class="center bold">${nomeEmpresa}</div><div class="center">PDV — Comprovante</div>
    <div class="divider"></div>
    <div class="row"><span>#${c.numero}</span><span>${c.horario.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div>${c.identificacao}</div><div class="divider"></div>
    ${c.itens.map((i) => `<div class="row"><span>${i.qty}x ${i.nome}</span><span>${fmt(i.preco * i.qty)}</span></div>`).join("")}
    <div class="divider"></div>
    ${c.desconto > 0 ? `<div class="row"><span>Desconto</span><span>-${fmt(c.desconto)}</span></div>` : ""}
    <div class="row total"><span>TOTAL</span><span>${fmt(c.total)}</span></div>
    <div class="divider"></div><div>${c.pagamento}</div>
    ${c.troco !== null && c.troco >= 0 ? `<div>Troco: ${fmt(c.troco)}</div>` : ""}
    ${c.obs ? `<div class="divider"></div><div>Obs: ${c.obs}</div>` : ""}
    <div class="divider"></div><div class="center">Obrigado!</div></body></html>`;
    const win = window.open("", "_blank", "width=360,height=600");
    if (!win) return;
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 300);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="bg-green-500 px-5 py-4 text-center">
          <CheckCircle2 className="size-10 text-white mx-auto mb-1" />
          <h3 className="text-white font-black text-lg">Venda #{c.numero} concluída!</h3>
          <p className="text-green-100 text-sm">{c.identificacao} · {c.horario.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <div className="px-5 py-4 space-y-1 max-h-48 overflow-y-auto">
          {c.itens.map((i) => (
            <div key={i.id} className="flex justify-between text-sm text-zinc-600">
              <span>{i.qty}× {i.nome}{i.opcoes?.length ? ` (${i.opcoes.map((o) => o.opcaoNome).join(", ")})` : ""}</span>
              <span className="font-semibold shrink-0 ml-2">{fmt(i.preco * i.qty)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-3 pt-2 border-t border-zinc-100 space-y-1">
          {c.desconto > 0 && <div className="flex justify-between text-sm text-green-600 font-semibold"><span>Desconto</span><span>-{fmt(c.desconto)}</span></div>}
          <div className="flex justify-between font-black text-xl text-zinc-900"><span>Total</span><span className="text-brand">{fmt(c.total)}</span></div>
          <div className="flex justify-between text-sm text-zinc-500">
            <span>{c.pagamento}</span>
            {c.troco !== null && c.troco >= 0 && <span>Troco: {fmt(c.troco)}</span>}
          </div>
          {c.obs && <p className="text-xs text-zinc-400 italic">Obs: {c.obs}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={imprimir} className="flex-1 h-10 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors">
            <Printer className="size-4" /> Imprimir
          </button>
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-brand text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors">
            Nova venda →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   OPTIONS MODAL
══════════════════════════════════════════════ */
function OptionsModal({ product: p, fmt, onClose, onAdd }: {
  product: any; fmt: (v: number) => string;
  onClose: () => void; onAdd: (qty: number, opcoes: OpcaoSelecionada[]) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-opcoes", p.id],
    queryFn: async () =>
      (await (supabase.from("grupos_opcoes") as any).select("*, opcoes(*)").eq("produto_id", p.id).order("ordem")).data ?? [],
  });

  const precoBase = Number(p.preco_promocional ?? p.preco);
  const precoAdicionais = useMemo(() => {
    let extra = 0;
    grupos.forEach((g: any) => {
      (selecoes[g.id] ?? []).forEach((id: string) => {
        const op = g.opcoes?.find((o: any) => o.id === id);
        if (op) extra += Number(op.preco_adicional);
      });
    });
    return extra;
  }, [selecoes, grupos]);

  const precoTotal = (precoBase + precoAdicionais) * qty;
  const obrigatoriosPendentes = grupos.filter((g: any) => g.obrigatorio && (!selecoes[g.id] || selecoes[g.id].length === 0));

  function toggleOpcao(grupoId: string, opcaoId: string, multiplo: boolean, maxEscolhas: number) {
    setSelecoes((prev) => {
      const atual = prev[grupoId] ?? [];
      if (!multiplo) return { ...prev, [grupoId]: [opcaoId] };
      if (atual.includes(opcaoId)) return { ...prev, [grupoId]: atual.filter((id) => id !== opcaoId) };
      if (atual.length >= maxEscolhas) return { ...prev, [grupoId]: [...atual.slice(1), opcaoId] };
      return { ...prev, [grupoId]: [...atual, opcaoId] };
    });
  }

  function buildOpcoes(): OpcaoSelecionada[] {
    const result: OpcaoSelecionada[] = [];
    grupos.forEach((g: any) => {
      (selecoes[g.id] ?? []).forEach((id: string) => {
        const op = g.opcoes?.find((o: any) => o.id === id);
        if (op) result.push({ grupoId: g.id, grupoNome: g.nome, opcaoId: op.id, opcaoNome: op.nome, precoAdicional: Number(op.preco_adicional) });
      });
    });
    return result;
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        {p.foto_url ? (
          <div className="w-full h-40 shrink-0 overflow-hidden relative">
            <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-4 text-white">
              <h3 className="text-lg font-black leading-tight">{p.nome}</h3>
              {p.descricao && <p className="text-xs text-white/80 mt-0.5 line-clamp-1">{p.descricao}</p>}
            </div>
            <button onClick={onClose} className="absolute top-3 right-3 size-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><X className="size-4" /></button>
          </div>
        ) : (
          <div className="h-16 bg-brand/5 border-b border-black/5 flex items-center px-5 justify-between shrink-0">
            <h3 className="font-bold text-zinc-900">{p.nome}</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {grupos.length === 0 && <p className="text-sm text-zinc-500">Sem opções adicionais.</p>}
          {grupos.map((g: any) => (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-zinc-800">{g.nome}</h4>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${g.obrigatorio ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-500"}`}>{g.obrigatorio ? "Obrigatório" : "Opcional"}</span>
                {g.multiplo && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-500">Até {g.max_escolhas}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(g.opcoes ?? []).map((o: any) => {
                  const sel = (selecoes[g.id] ?? []).includes(o.id);
                  return (
                    <button key={o.id} onClick={() => toggleOpcao(g.id, o.id, g.multiplo, g.max_escolhas)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${sel ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-zinc-200 hover:border-brand/40 bg-white"}`}>
                      <span className="text-xs font-semibold truncate">{o.nome}</span>
                      {Number(o.preco_adicional) > 0 && <span className={`text-xs ml-1 shrink-0 font-bold ${sel ? "text-brand" : "text-zinc-400"}`}>+{fmt(Number(o.preco_adicional))}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-black/5 shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2 bg-zinc-50">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-7 flex items-center justify-center text-zinc-500 hover:text-brand"><Minus className="size-4" /></button>
            <span className="text-sm font-black min-w-[24px] text-center">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="size-7 flex items-center justify-center text-zinc-500 hover:text-brand"><Plus className="size-4" /></button>
          </div>
          <button
            onClick={() => {
              if (obrigatoriosPendentes.length > 0) { toast.error(`Selecione: ${obrigatoriosPendentes.map((g: any) => g.nome).join(", ")}`); return; }
              onAdd(qty, buildOpcoes());
            }}
            className="flex-1 h-11 rounded-xl bg-brand hover:bg-brand/90 text-white font-black text-sm transition-colors">
            Adicionar — {fmt(precoTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}
