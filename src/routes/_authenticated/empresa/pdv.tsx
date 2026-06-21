import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus, Trash2, ShoppingCart, Search, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { gerarPixPayload, normalizarChavePix, normalizarTexto } from "@/lib/pix";

export const Route = createFileRoute("/_authenticated/empresa/pdv")({
  component: PDVPage,
});

interface OpcaoSel { grupoId: string; grupoNome: string; opcaoId: string; opcaoNome: string; precoAdicional: number; }
interface CartItem  { id: string; nome: string; preco: number; qty: number; opcoes?: OpcaoSel[]; }

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Produto card ───────────────────────────────────────────────────────────────
function ProdCard({ p, onAdd }: { p: any; onAdd: (p: any) => void }) {
  const esgotado  = p.controlar_estoque && p.estoque === 0;
  const temOpcoes = (p.grupos_opcoes?.length ?? 0) > 0;
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
        temOpcoes ? (
          <div className="flex items-center justify-center gap-1 bg-orange-500 rounded-xl py-1.5">
            <Plus className="size-3.5 text-white" />
            <span className="text-xs font-bold text-white">Personalizar</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 bg-brand/10 rounded-xl py-1.5">
            <Plus className="size-3.5 text-brand" />
            <span className="text-xs font-bold text-brand">Adicionar</span>
          </div>
        )
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
  const [selecionadas, setSelecionadas] = useState<Record<string, OpcaoSel[]>>({});
  useEffect(() => { setSelecionadas({}); }, [produto.id]);

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-pdv", produto.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("grupos_opcoes")
        .select("*, opcoes(*)")
        .eq("produto_id", produto.id)
        .order("ordem");
      return (data ?? []) as any[];
    },
  });

  const obrigatoriosPendentes = grupos.filter((g: any) => g.obrigatorio && !(selecionadas[g.id]?.length));
  const precoAdicional = Object.values(selecionadas).flat().reduce((s, o) => s + o.precoAdicional, 0);
  const precoBase = Number(produto.preco_promocional ?? produto.preco);

  function toggle(grupo: any, opcao: any) {
    const novaOpcao: OpcaoSel = { grupoId: grupo.id, grupoNome: grupo.nome, opcaoId: opcao.id, opcaoNome: opcao.nome, precoAdicional: Number(opcao.preco_adicional ?? 0) };
    setSelecionadas((prev) => {
      const atual = prev[grupo.id] ?? [];
      const jaSelected = atual.some((s) => s.opcaoId === opcao.id);

      if (grupo.multiplo) {
        if (jaSelected) {
          const novo = atual.filter((s) => s.opcaoId !== opcao.id);
          if (novo.length === 0) { const n = { ...prev }; delete n[grupo.id]; return n; }
          return { ...prev, [grupo.id]: novo };
        }
        const max = grupo.max_escolhas;
        if (max && atual.length >= max) return prev;
        return { ...prev, [grupo.id]: [...atual, novaOpcao] };
      } else {
        if (jaSelected) { const n = { ...prev }; delete n[grupo.id]; return n; }
        return { ...prev, [grupo.id]: [novaOpcao] };
      }
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
          {grupos.map((g: any) => {
            const qtdSel = selecionadas[g.id]?.length ?? 0;
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm font-bold text-zinc-800">{g.nome}</p>
                  {g.obrigatorio && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">Obrigatório</span>}
                  {g.multiplo && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                      {g.max_escolhas ? `Até ${g.max_escolhas}` : "Vários"}{qtdSel > 0 ? ` · ${qtdSel} sel.` : ""}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(g.opcoes ?? []).filter((o: any) => o.ativo !== false).map((o: any) => {
                    const sel = (selecionadas[g.id] ?? []).some((s) => s.opcaoId === o.id);
                    const bloqueado = g.multiplo && g.max_escolhas && !sel && qtdSel >= g.max_escolhas;
                    return (
                      <button key={o.id} onClick={() => !bloqueado && toggle(g, o)}
                        disabled={!!bloqueado}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                          sel ? "border-brand bg-brand/5 ring-1 ring-brand" : bloqueado ? "border-zinc-100 opacity-40 cursor-not-allowed" : "border-zinc-200 hover:border-zinc-300"
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className={`size-4 rounded flex items-center justify-center shrink-0 border ${sel ? "bg-brand border-brand" : "border-zinc-300"}`}>
                            {sel && <span className="text-white text-[10px] font-black">✓</span>}
                          </span>
                          <span className="text-sm font-medium text-zinc-800">{o.nome}</span>
                        </div>
                        {Number(o.preco_adicional) > 0 && <span className="text-sm font-semibold text-brand">+{fmt(Number(o.preco_adicional))}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-zinc-100">
          <Button disabled={obrigatoriosPendentes.length > 0}
            onClick={() => onConfirm(Object.values(selecionadas).flat(), precoBase + precoAdicional)}
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
  const [nomeCliente, setNomeCliente]     = useState("");
  const [cpfCliente, setCpfCliente]       = useState("");
  const [finishing, setFinishing]         = useState(false);
  const [vendaFeita, setVendaFeita]       = useState<{ numero: number; total: number; nome: string; cpf: string; itens: CartItem[]; troco: number | null } | null>(null);
  const [mobileTab, setMobileTab]         = useState<"produtos" | "pedido">("produtos");

  const [pixQrUrl, setPixQrUrl] = useState<string | null>(null);

  const { data: empresaData } = useQuery({
    queryKey: ["empresa-pdv", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("empresas")
        .select("nome_fantasia,chave_pix,tipo_chave_pix,nome_recebedor,cidade_recebedor")
        .eq("id", empresaId!).single();
      return data;
    },
  });
  const nomeEmpresa = empresaData?.nome_fantasia ?? "Estabelecimento";

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

  // Gera QR PIX — precisa ficar APÓS total ser calculado
  useEffect(() => {
    if (pagamento !== "PIX" || total <= 0 || !empresaData?.chave_pix) { setPixQrUrl(null); return; }
    const chave  = normalizarChavePix(empresaData.chave_pix, empresaData.tipo_chave_pix ?? "aleatoria");
    const nome   = normalizarTexto(empresaData.nome_recebedor ?? "ESTABELECIMENTO", 25);
    const cidade = normalizarTexto(empresaData.cidade_recebedor ?? "BRASIL", 15);
    const payload = gerarPixPayload(chave, nome, cidade, total);
    QRCode.toDataURL(payload, { width: 200, margin: 1 }).then(setPixQrUrl).catch(() => setPixQrUrl(null));
  }, [pagamento, total, empresaData]);

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
    setValorCliente(""); setObs(""); setPagamento("Dinheiro");
    setNomeCliente(""); setCpfCliente(""); setVendaFeita(null);
  }

  function imprimirCupom(venda: NonNullable<typeof vendaFeita>, nomeEmpresa: string) {
    const data = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const itensHtml = venda.itens.map((i) =>
      `<tr><td>${i.qty}x ${i.nome}${i.opcoes?.length ? `<br><small>${i.opcoes.map(o => o.opcaoNome).join(", ")}</small>` : ""}</td><td style="text-align:right">${fmt(i.preco * i.qty)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cupom #${venda.numero}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:13px;width:80mm;padding:8px}
    .c{text-align:center}.b{font-weight:bold}.line{border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{vertical-align:top}
    @media print{body{width:80mm}}</style></head><body>
    <div class="c b" style="font-size:15px">${nomeEmpresa}</div>
    <div class="c" style="font-size:11px">${data}</div>
    <div class="line"></div>
    <div class="c b" style="font-size:18px">CUPOM #${venda.numero}</div>
    <div class="line"></div>
    ${venda.nome ? `<div><b>Cliente:</b> ${venda.nome}</div>` : ""}
    ${venda.cpf  ? `<div><b>CPF:</b> ${venda.cpf}</div>` : ""}
    ${(venda.nome || venda.cpf) ? '<div class="line"></div>' : ""}
    <table>${itensHtml}</table>
    <div class="line"></div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px"><span>TOTAL</span><span>${fmt(venda.total)}</span></div>
    ${venda.troco !== null && venda.troco >= 0 ? `<div style="font-size:11px;margin-top:4px">Troco: ${fmt(venda.troco)}</div>` : ""}
    <div class="line"></div>
    <div class="c" style="font-size:11px">Obrigado pela preferência!</div>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
    </body></html>`;
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) { win.document.write(html); win.document.close(); }
  }

  async function finalizar() {
    if (items.length === 0) { toast.error("Carrinho vazio."); return; }
    if (trocoVal !== null && trocoVal < 0) { toast.error("Valor recebido menor que o total."); return; }
    setFinishing(true);
    try {
      const itensRpc = items.map((i) => ({
        produto_id: i.id,
        quantidade: i.qty,
        observacao: i.opcoes?.length ? i.opcoes.map((o) => o.opcaoNome).join(", ") : null,
      }));

      const obsCompleta = [
        obs,
        trocoVal !== null && trocoVal >= 0 ? `Troco para ${fmt(parseFloat(valorCliente.replace(",", ".")))}` : "",
      ].filter(Boolean).join(" | ");

      const { data, error } = await supabase.rpc("finalizar_pedido", {
        p_empresa_id:      empresaId!,
        p_cliente_nome:    nomeCliente.trim() || "Balcão",
        p_cliente_cpf:     cpfCliente.trim() || undefined,
        p_forma_pagamento: pagamento,
        p_observacao:      obsCompleta || undefined,
        p_tipo:            "pdv",
        p_itens:           itensRpc,
        p_desconto_pdv:    desconto > 0 ? desconto : undefined,
      });

      if (error || !data) { toast.error("Erro: " + (error?.message ?? "tente novamente")); return; }
      const pedido = data as { numero: number; total: number };
      setVendaFeita({ numero: pedido.numero, total: pedido.total, nome: nomeCliente.trim(), cpf: cpfCliente.trim(), itens: items, troco: trocoVal });
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
          <p className="text-2xl font-black text-brand mt-3">{fmt(vendaFeita.total)}</p>
          {vendaFeita.troco !== null && vendaFeita.troco >= 0 && (
            <p className="text-sm text-zinc-500 mt-1">Troco: <span className="font-bold text-zinc-800">{fmt(vendaFeita.troco)}</span></p>
          )}
          {vendaFeita.nome && <p className="text-sm text-zinc-600 mt-1">Cliente: <span className="font-semibold">{vendaFeita.nome}</span></p>}
          {vendaFeita.cpf  && <p className="text-sm text-zinc-600">CPF: <span className="font-semibold">{vendaFeita.cpf}</span></p>}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => imprimirCupom(vendaFeita, nomeEmpresa as string)} className="gap-2 border-zinc-300">
            🖨️ Imprimir cupom
          </Button>
          <Button onClick={limparVenda} className="bg-brand hover:bg-brand/90 px-10 h-12 text-base font-bold gap-2">
            <Plus className="size-5" /> Nova venda
          </Button>
        </div>
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
                    <button onClick={() => setCart((prev) => ({ ...prev, [key]: { ...prev[key], qty: prev[key].qty + 1 } }))}
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

            {/* PIX QR Code */}
            {pagamento === "PIX" && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 flex flex-col items-center gap-2">
                {!empresaData?.chave_pix ? (
                  <p className="text-xs text-amber-600 text-center">Configure a chave PIX nas Configurações para usar este método.</p>
                ) : pixQrUrl && total > 0 ? (
                  <>
                    <img src={pixQrUrl} alt="QR PIX" className="w-40 h-40 rounded-lg" />
                    <p className="text-xs text-zinc-500 text-center">Mostre o QR para o cliente escanear</p>
                    <p className="text-sm font-bold text-zinc-800">{fmt(total)}</p>
                  </>
                ) : (
                  <p className="text-xs text-zinc-400">Adicione itens para gerar o QR PIX</p>
                )}
              </div>
            )}

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

            {/* Cliente */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-zinc-400">Nome do cliente</Label>
                <Input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Opcional" className="h-8 text-sm" />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-zinc-400">CPF (nota fiscal)</Label>
                <Input value={cpfCliente} onChange={(e) => setCpfCliente(e.target.value)} placeholder="000.000.000-00" className="h-8 text-sm" />
              </div>
            </div>

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
