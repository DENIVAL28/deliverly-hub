import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus, Trash2, ShoppingCart, Search, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa/pdv")({
  component: PDVPage,
});

interface OpcaoSel { grupoId: string; grupoNome: string; opcaoId: string; opcaoNome: string; precoAdicional: number; }
interface CartItem  { id: string; nome: string; preco: number; qty: number; opcoes?: OpcaoSel[]; }

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Produto card ───────────────────────────────────────────────────────────────
function ProdCard({ p, onAdd }: { p: any; onAdd: (p: any) => void }) {
  const esgotado = p.controlar_estoque && p.estoque === 0;
  return (
    <button disabled={esgotado} onClick={() => onAdd(p)}
      className={`bg-white rounded-2xl ring-1 ring-zinc-200 p-3 text-left flex flex-col gap-2 transition-all ${
        esgotado ? "opacity-50 cursor-not-allowed" : "hover:ring-brand/40 hover:shadow-md active:scale-[0.98]"
      }`}>
      {p.foto_url ? (
        <img src={p.foto_url} alt={p.nome} className="w-full h-24 object-cover rounded-xl" />
      ) : (
        <div className="w-full h-24 rounded-xl bg-zinc-100 flex items-center justify-center text-3xl">🍽️</div>
      )}
      <p className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2">{p.nome}</p>
      {esgotado ? (
        <p className="text-[10px] text-red-500 font-semibold">Esgotado</p>
      ) : (
        <p className="text-sm font-black text-brand">{fmt(Number(p.preco_promocional ?? p.preco))}</p>
      )}
      {!esgotado && (
        <div className="flex items-center justify-center gap-1 bg-brand/10 rounded-xl py-1.5">
          <Plus className="size-3.5 text-brand" />
          <span className="text-xs font-bold text-brand">Adicionar</span>
        </div>
      )}
    </button>
  );
}

// ── Modal de opções ────────────────────────────────────────────────────────────
function OpcoesModal({ produto, onConfirm, onClose }: {
  produto: any;
  onConfirm: (opcoes: OpcaoSel[], preco: number) => void;
  onClose: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState<Record<string, OpcaoSel>>({});

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-pdv", produto.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("grupos_opcoes" as any)
        .select("*, opcoes(*)")
        .eq("produto_id", produto.id)
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []) as any[];
    },
  });

  const obrigatoriosPendentes = grupos.filter((g: any) => g.obrigatorio && !selecionadas[g.id]);
  const precoAdicional = Object.values(selecionadas).reduce((s, o) => s + o.precoAdicional, 0);
  const precoBase = Number(produto.preco_promocional ?? produto.preco);

  function toggle(grupo: any, opcao: any) {
    setSelecionadas((prev) => {
      if (prev[grupo.id]?.opcaoId === opcao.id) {
        const n = { ...prev }; delete n[grupo.id]; return n;
      }
      return { ...prev, [grupo.id]: { grupoId: grupo.id, grupoNome: grupo.nome, opcaoId: opcao.id, opcaoNome: opcao.nome, precoAdicional: Number(opcao.preco_adicional ?? 0) } };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900">{produto.nome}</p>
            <p className="text-sm text-brand font-semibold">{fmt(precoBase + precoAdicional)}</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl bg-zinc-100 flex items-center justify-center">
            <X className="size-4 text-zinc-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {grupos.map((g: any) => (
            <div key={g.id}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-bold text-zinc-800">{g.nome}</p>
                {g.obrigatorio && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">Obrigatório</span>}
              </div>
              <div className="space-y-1.5">
                {(g.opcoes ?? []).filter((o: any) => o.ativo !== false).map((o: any) => (
                  <button key={o.id} onClick={() => toggle(g, o)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                      selecionadas[g.id]?.opcaoId === o.id ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                    }`}>
                    <span className="text-sm font-medium text-zinc-800">{o.nome}</span>
                    {Number(o.preco_adicional) > 0 && <span className="text-sm font-semibold text-brand">+{fmt(Number(o.preco_adicional))}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-zinc-100">
          <Button disabled={obrigatoriosPendentes.length > 0}
            onClick={() => onConfirm(Object.values(selecionadas), precoBase + precoAdicional)}
            className="w-full bg-brand hover:bg-brand/90 h-12 text-base font-bold gap-2 disabled:opacity-50">
            {obrigatoriosPendentes.length > 0
              ? `Selecione: ${obrigatoriosPendentes.map((g: any) => g.nome).join(", ")}`
              : <><Plus className="size-4" /> Adicionar — {fmt(precoBase + precoAdicional)}</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
function PDVPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [busca, setBusca]                 = useState("");
  const [catAtiva, setCatAtiva]           = useState<string | null>(null);
  const [cart, setCart]                   = useState<Record<string, CartItem>>({});
  const [prodModal, setProdModal]         = useState<any | null>(null);
  const [pagamento, setPagamento]         = useState<"Dinheiro" | "Cartão" | "PIX">("Dinheiro");
  const [valorCliente, setValorCliente]   = useState("");
  const [descontoValor, setDescontoValor] = useState("");
  const [descontoPct, setDescontoPct]     = useState("");
  const [obs, setObs]                     = useState("");
  const [finishing, setFinishing]         = useState(false);
  const [vendaFeita, setVendaFeita]       = useState<{ numero: number } | null>(null);
  const [mobileTab, setMobileTab]         = useState<"produtos" | "pedido">("produtos");

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("categorias").select("id,nome").eq("empresa_id", empresaId!).eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-pdv", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      ((await supabase.from("produtos").select("*, grupos_opcoes(id)").eq("empresa_id", empresaId!).eq("ativo", true).order("nome")) as any).data ?? [],
  });

  const produtosFiltrados = useMemo(() =>
    (produtos as any[]).filter((p) =>
      (!catAtiva || p.categoria_id === catAtiva) &&
      (!busca || p.nome.toLowerCase().includes(busca.toLowerCase()))
    ), [produtos, catAtiva, busca]);

  const items        = Object.values(cart);
  const subtotal     = items.reduce((s, i) => s + i.preco * i.qty, 0);
  const desconto     = useMemo(() => {
    if (descontoValor) return Math.min(subtotal, Math.max(0, parseFloat(descontoValor.replace(",", ".")) || 0));
    if (descontoPct)   return Math.min(subtotal, subtotal * ((parseFloat(descontoPct.replace(",", ".")) || 0) / 100));
    return 0;
  }, [descontoValor, descontoPct, subtotal]);
  const total        = Math.max(0, subtotal - desconto);
  const trocoVal     = pagamento === "Dinheiro" && valorCliente ? parseFloat(valorCliente.replace(",", ".")) - total : null;

  function cartKey(id: string, opcoes?: OpcaoSel[]) {
    return opcoes?.length ? `${id}__${opcoes.map((o) => o.opcaoId).join("_")}` : id;
  }

  function adicionarAoCart(produto: any, opcoes?: OpcaoSel[], precoFinal?: number) {
    const temOpcoes = (produto.grupos_opcoes?.length ?? 0) > 0;
    if (temOpcoes && !opcoes) { setProdModal(produto); return; }
    const preco = precoFinal ?? Number(produto.preco_promocional ?? produto.preco);
    const key   = cartKey(produto.id, opcoes);
    setCart((prev) => ({
      ...prev,
      [key]: prev[key]
        ? { ...prev[key], qty: prev[key].qty + 1 }
        : { id: produto.id, nome: produto.nome, preco, qty: 1, opcoes },
    }));
  }

  function decrementar(key: string) {
    setCart((prev) => {
      if (prev[key].qty <= 1) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { ...prev[key], qty: prev[key].qty - 1 } };
    });
  }

  function limparVenda() {
    setCart({}); setDescontoValor(""); setDescontoPct("");
    setValorCliente(""); setObs(""); setPagamento("Dinheiro"); setVendaFeita(null);
  }

  async function finalizar() {
    if (items.length === 0) { toast.error("Carrinho vazio."); return; }
    if (trocoVal !== null && trocoVal < 0) { toast.error("Valor recebido menor que o total."); return; }
    setFinishing(true);
    try {
      const itensRpc = items.map((i) => ({
        produto_id:        i.id,
        nome:              i.nome,
        quantidade:        i.qty,
        preco_unitario:    i.preco,
        subtotal:          i.preco * i.qty,
        observacao:        i.opcoes?.length ? i.opcoes.map((o) => o.opcaoNome).join(", ") : null,
        controlar_estoque: !!(produtos as any[]).find((p) => p.id === i.id)?.controlar_estoque,
      }));

      const obsCompleta = [
        obs,
        trocoVal !== null && trocoVal >= 0 ? `Troco para ${fmt(parseFloat(valorCliente.replace(",", ".")))}` : "",
      ].filter(Boolean).join(" | ");

      const { data, error } = await supabase.rpc("finalizar_pedido", {
        p_empresa_id:       empresaId!,
        p_cliente_nome:     "Balcão",
        p_cliente_telefone: undefined,
        p_cliente_endereco: undefined,
        p_forma_pagamento:  pagamento,
        p_observacao:       obsCompleta || undefined,
        p_subtotal:         subtotal,
        p_taxa_entrega:     0,
        p_total:            total,
        p_mesa:             undefined,
        p_tipo:             "pdv",
        p_status:           "novo",
        p_cupom_id:         undefined,
        p_itens:            itensRpc,
      });

      if (error || !data) { toast.error("Erro: " + (error?.message ?? "tente novamente")); return; }
      setVendaFeita({ numero: (data as any).numero });
      qc.invalidateQueries({ queryKey: ["pedidos-empresa", empresaId] });
    } finally {
      setFinishing(false);
    }
  }

  if (vendaFeita) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="size-20 rounded-3xl bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="size-10 text-green-500" />
        </div>
        <div className="text-center">
          <p className="text-3xl font-black text-zinc-900">Venda #{vendaFeita.numero}</p>
          <p className="text-zinc-500 mt-1">registrada com sucesso!</p>
          <p className="text-2xl font-black text-brand mt-3">{fmt(total)}</p>
          {trocoVal !== null && trocoVal >= 0 && (
            <p className="text-sm text-zinc-500 mt-1">Troco: <span className="font-bold text-zinc-800">{fmt(trocoVal)}</span></p>
          )}
        </div>
        <Button onClick={limparVenda} className="bg-brand hover:bg-brand/90 px-10 h-12 text-base font-bold gap-2">
          <Plus className="size-5" /> Nova venda
        </Button>
      </div>
    );
  }

  return (
    <>
      {prodModal && (
        <OpcoesModal produto={prodModal} onClose={() => setProdModal(null)}
          onConfirm={(opcoes, preco) => { adicionarAoCart(prodModal, opcoes, preco); setProdModal(null); }} />
      )}

      <PageHeader title="Caixa / PDV" subtitle="Vendas no balcão" />

      {/* Abas mobile */}
      <div className="flex lg:hidden mb-3 bg-white rounded-2xl ring-1 ring-zinc-200 p-1 gap-1">
        <button onClick={() => setMobileTab("produtos")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mobileTab === "produtos" ? "bg-brand text-white" : "text-zinc-500"}`}>
          🍽️ Produtos
        </button>
        <button onClick={() => setMobileTab("pedido")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${mobileTab === "pedido" ? "bg-brand text-white" : "text-zinc-500"}`}>
          🛒 Pedido
          {items.length > 0 && (
            <span className={`size-5 rounded-full text-[10px] font-black flex items-center justify-center ${mobileTab === "pedido" ? "bg-white text-brand" : "bg-brand text-white"}`}>
              {items.reduce((s, i) => s + i.qty, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-11rem)]">

        {/* ── Catálogo ── */}
        <div className={`flex-1 min-w-0 flex flex-col gap-3 overflow-hidden ${mobileTab === "pedido" ? "hidden lg:flex" : "flex"}`}>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <Input placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 bg-white" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
            <button onClick={() => setCatAtiva(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${!catAtiva ? "bg-brand text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-brand/40"}`}>
              Todos
            </button>
            {(categorias as any[]).map((c) => (
              <button key={c.id} onClick={() => setCatAtiva(catAtiva === c.id ? null : c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${catAtiva === c.id ? "bg-brand text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-brand/40"}`}>
                {c.nome}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {produtosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-sm text-zinc-400 gap-2">
                <span className="text-3xl">🔍</span> Nenhum produto encontrado
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
                {produtosFiltrados.map((p: any) => (
                  <ProdCard key={p.id} p={p} onAdd={adicionarAoCart} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Carrinho ── */}
        <div className={`lg:w-80 w-full shrink-0 flex flex-col bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden ${mobileTab === "produtos" ? "hidden lg:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-brand" />
              <span className="font-bold text-zinc-800">Pedido atual</span>
              {items.length > 0 && (
                <span className="size-5 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center">
                  {items.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button onClick={() => setCart({})} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">Limpar</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-sm text-zinc-300 gap-2">
                <ShoppingCart className="size-8" /> Carrinho vazio
              </div>
            ) : items.map((item) => {
              const key = cartKey(item.id, item.opcoes);
              return (
                <div key={key} className="flex items-start gap-2 py-2 border-b border-zinc-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 leading-snug">{item.nome}</p>
                    {item.opcoes?.length ? <p className="text-[10px] text-zinc-400 truncate">{item.opcoes.map(o => o.opcaoNome).join(", ")}</p> : null}
                    <p className="text-xs text-brand font-bold mt-0.5">{fmt(item.preco * item.qty)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button onClick={() => decrementar(key)}
                      className="size-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                      {item.qty === 1 ? <Trash2 className="size-3 text-red-400" /> : <Minus className="size-3 text-zinc-500" />}
                    </button>
                    <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                    <button onClick={() => adicionarAoCart({ id: item.id, nome: item.nome, preco: item.preco, grupos_opcoes: [] }, item.opcoes, item.preco)}
                      className="size-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                      <Plus className="size-3 text-zinc-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé */}
          <div className="border-t border-zinc-100 px-4 py-3 space-y-3 shrink-0">
            {/* Desconto */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-zinc-400">Desconto R$</Label>
                <Input value={descontoValor} onChange={(e) => { setDescontoValor(e.target.value); setDescontoPct(""); }} placeholder="0,00" className="h-8 text-sm" />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-zinc-400">Desconto %</Label>
                <Input value={descontoPct} onChange={(e) => { setDescontoPct(e.target.value); setDescontoValor(""); }} placeholder="0" className="h-8 text-sm" />
              </div>
            </div>

            {/* Totais */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {desconto > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Desconto</span><span>-{fmt(desconto)}</span></div>}
              <div className="flex justify-between font-black text-base text-zinc-900 pt-1 border-t border-zinc-100">
                <span>Total</span><span className="text-brand">{fmt(total)}</span>
              </div>
            </div>

            {/* Pagamento */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["Dinheiro", "Cartão", "PIX"] as const).map((f) => (
                <button key={f} onClick={() => { setPagamento(f); setValorCliente(""); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${pagamento === f ? "bg-brand text-white shadow-sm" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                  {f === "Dinheiro" ? "💵" : f === "Cartão" ? "💳" : "🔵"} {f}
                </button>
              ))}
            </div>

            {/* Troco */}
            {pagamento === "Dinheiro" && (
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Cliente pagou R$</Label>
                <Input value={valorCliente} onChange={(e) => setValorCliente(e.target.value)} placeholder="0,00" className="h-8 text-sm" />
                {trocoVal !== null && (
                  <p className={`text-xs font-bold ${trocoVal < 0 ? "text-red-500" : "text-green-600"}`}>
                    {trocoVal < 0 ? `⚠️ Falta ${fmt(Math.abs(trocoVal))}` : `Troco: ${fmt(trocoVal)}`}
                  </p>
                )}
              </div>
            )}

            {/* Obs */}
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="resize-none text-xs h-14" />

            {/* Finalizar */}
            <Button onClick={finalizar} disabled={finishing || items.length === 0}
              className="w-full bg-brand hover:bg-brand/90 h-11 text-sm font-black disabled:opacity-50">
              {finishing ? "Registrando…" : `Finalizar — ${fmt(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
