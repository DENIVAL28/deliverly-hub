import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { InstalarPWA } from "@/components/InstalarPWA";
import { useRef, useMemo, useState, useEffect } from "react";
import { verificarAberto } from "@/lib/loja-horario";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus, MessageCircle, Store, X, ShoppingBag, ImageIcon, Clock, ShoppingCart, Search, Copy, CheckCircle2, PackageSearch, ChevronLeft, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { copiarTexto, normalizeWA } from "@/lib/validacoes";
import { trackEvento } from "@/lib/analytics";

export const Route = createFileRoute("/loja/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    const { data: empresa } = await (supabase as any)
      .from("empresas_publico")
      .select("id,nome_fantasia,slug,whatsapp,cor_primaria,taxa_entrega,status,aberto,logo_url,banner_url,tempo_entrega,pedido_minimo,horario_abertura,horario_fechamento,dias_semana,chave_pix,tipo_chave_pix,nome_recebedor,cidade_recebedor,retirada_ativa,taxa_entrega_tipo,taxa_entrega_por_km,taxa_entrega_base,empresa_lat,empresa_lng,fluxo_pedido")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!empresa) throw notFound();
    const [{ data: categorias }, { data: produtos }, { data: avs }] = await Promise.all([
      supabase.from("categorias").select("*").eq("empresa_id", empresa.id).eq("ativo", true).order("ordem"),
      (supabase.from("produtos") as any).select("*, grupos_opcoes(id, nome, opcoes(id, nome, ativo))").eq("empresa_id", empresa.id).eq("ativo", true),
      supabase.from("avaliacoes").select("nota,comentario,cliente_nome,created_at").eq("empresa_id", empresa.id).order("created_at", { ascending: false }).limit(20),
    ]);
    const avaliacoes = (avs ?? []) as any[];
    const mediaAval = avaliacoes.length ? avaliacoes.reduce((s: number, a: any) => s + a.nota, 0) / avaliacoes.length : null;
    return { empresa, categorias: categorias ?? [], produtos: produtos ?? [], mediaAval, totalAval: avaliacoes.length, avaliacoes };
  },
  component: LojaPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">Loja não encontrada.</div>
  ),
});

interface OpcaoSelecionada {
  grupoId: string; grupoNome: string; opcaoId: string; opcaoNome: string; precoAdicional: number;
}
interface CartItem { id: string; cartKey: string; nome: string; preco: number; qty: number; opcoes?: OpcaoSelecionada[]; }

function LojaPage() {
  const { empresa, categorias, produtos, mediaAval, totalAval, avaliacoes } = Route.useLoaderData();
  const navigate = useNavigate();
  // Lê mesa da URL: /loja/slug?mesa=3
  const mesa = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("mesa");
  }, []);
  const [cart, setCart]                   = useState<Record<string, CartItem>>({});
  const [checkoutOpen, setCheckoutOpen]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [busca, setBusca]                 = useState("");
  const [pedidoFeito, setPedidoFeito]     = useState<{ id: string; numero: number; waUrl: string | null } | null>(null);
  const [codigoCupom, setCodigoCupom]     = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ id: string; tipo: string; valor: number; codigo: string; usos_atual: number } | null>(null);
  const [cupomLoading, setCupomLoading]   = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutErro, setCheckoutErro]   = useState<string | null>(null);
  const [catAtiva, setCatAtiva]           = useState<string | null>(null);
  const [formaPagamento, setFormaPagamento] = useState(() => (empresa as any).chave_pix ? "PIX" : "Dinheiro");
  const [trocoDelivery, setTrocoDelivery]   = useState("");
  const [tipoEntrega, setTipoEntrega]       = useState<"delivery" | "retirada">("delivery");
  const [clienteLat, setClienteLat]         = useState<number | null>(null);
  const [clienteLng, setClienteLng]         = useState<number | null>(null);
  const [clienteCpf, setClienteCpf]         = useState("");
  const [clienteCep, setClienteCep]         = useState("");
  const [clienteCidade, setClienteCidade]   = useState("");
  const [pixModal, setPixModal]           = useState<{ payload: string; qrUrl: string; total: number; desconto: number; waLink: string; pedidoNum: number; pedidoId: string; pixChave: string; pixNome: string; pixCidade: string } | null>(null);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState<{ pedidoId: string; numero: number } | null>(null);
  const [acompanharOpen, setAcompanharOpen] = useState(false);
  const [telBusca, setTelBusca]           = useState("");
  const [pedidosBusca, setPedidosBusca]   = useState<any[] | null>(null);
  const [buscandoPedidos, setBuscandoPedidos] = useState(false);
  const catRefs = useRef<Record<string, HTMLElement | null>>({});
  const checkoutKeyRef = useRef<string>(crypto.randomUUID());
  const [cepCarregando, setCepCarregando] = useState(false);
  const [whatsappEnviado, setWhatsappEnviado] = useState(false);
  const [dadosSalvos, setDadosSalvos] = useState<{ nome: string; telefone: string; endereco: string } | null>(null);

  // Carrega dados do cliente salvos em pedidos anteriores
  useEffect(() => {
    try {
      const saved = localStorage.getItem("deliverly_cliente_dados");
      if (saved) setDadosSalvos(JSON.parse(saved));
    } catch {}
  }, []);

  // Sessão anônima autenticada — necessário para realtime e RLS em pedidos
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) supabase.auth.signInAnonymously();
    });
  }, []);

  // Analytics: visita ao cardápio
  useEffect(() => { trackEvento(empresa.id, "visita"); }, []);

  // Realtime: atualiza QR PIX se o dono aplicar desconto enquanto modal está aberto
  useEffect(() => {
    if (!pixModal?.pedidoId) return;
    const channel = supabase
      .channel(`pix-desconto-${pixModal.pedidoId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pixModal.pedidoId}` },
        async (payload) => {
          const novoDesconto = Number((payload.new as any).desconto ?? 0);
          if (novoDesconto === pixModal.desconto) return;
          const novoTotal = pixModal.total - novoDesconto;
          const novoPayload = gerarPixPayload(pixModal.pixChave, pixModal.pixNome, pixModal.pixCidade, novoTotal);
          try {
            const novoQr = await QRCode.toDataURL(novoPayload, { width: 240, margin: 2, color: { dark: "#18181b", light: "#ffffff" } });
            setPixModal((m) => m ? { ...m, desconto: novoDesconto, payload: novoPayload, qrUrl: novoQr } : m);
            toast.success(`Desconto de ${fmt(novoDesconto)} aplicado! Novo total: ${fmt(novoTotal)}`);
          } catch {}
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pixModal?.pedidoId]);

  // Salva dados PIX no sessionStorage e redireciona para tracking
  function irParaTracking(pedidoId: string) {
    const emp = empresa as any;
    if (emp?.chave_pix) {
      try {
        sessionStorage.setItem(`pix_empresa_${pedidoId}`, JSON.stringify({
          chave_pix:       emp.chave_pix,
          tipo_chave_pix:  emp.tipo_chave_pix ?? "aleatoria",
          nome_recebedor:  emp.nome_recebedor  ?? emp.nome_fantasia ?? "",
          cidade_recebedor: emp.cidade_recebedor ?? "Brasil",
          nome_fantasia:   emp.nome_fantasia ?? "",
        }));
      } catch {}
    }
    window.location.href = `/pedido/${pedidoId}`;
  }


  async function salvarPushClientePedido(pedidoId: string) {
    const native = (window as any).ReactNativeWebView;
    if (!native?.postMessage) return;

    return new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 20_000);

      const handler = async (event: Event) => {
        const detail = (event as CustomEvent<{ token?: string; platform?: string }>).detail;
        window.clearTimeout(timeout);
        window.removeEventListener("devhub:nativePushToken", handler);

        if (detail?.token) {
          await (supabase as any).rpc("cliente_salvar_push_token", {
            p_pedido_id: pedidoId,
            p_token: detail.token,
            p_platform: detail.platform ?? "android",
          });
        }
        resolve();
      };

      window.addEventListener("devhub:nativePushToken", handler, { once: true });

      native.postMessage(JSON.stringify({
        type: "DEVHUB_CLIENTE_PEDIDO_CONTEXT",
        pedidoId,
      }));
    });
  }
  // Realtime: fluxo manual — detecta confirmação (caminho rápido, pode não funcionar por RLS)
  useEffect(() => {
    if (!aguardandoConfirmacao?.pedidoId) return;
    const { pedidoId } = aguardandoConfirmacao;
    const channel = supabase
      .channel(`fluxo-manual-${pedidoId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pedidoId}` },
        (payload) => {
          const novo = payload.new as any;
          if (novo.status !== "aguardando_confirmacao") {
            irParaTracking(pedidoId);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [aguardandoConfirmacao?.pedidoId]);

  // Polling fallback — RLS bloqueia realtime para usuários anônimos
  const aguardandoRef = useRef(aguardandoConfirmacao);
  useEffect(() => { aguardandoRef.current = aguardandoConfirmacao; }, [aguardandoConfirmacao]);

  useEffect(() => {
    if (!aguardandoConfirmacao?.pedidoId) return;
    const pedidoId = aguardandoConfirmacao.pedidoId;

    const interval = setInterval(async () => {
      if (!aguardandoRef.current) { clearInterval(interval); return; }
      const { data } = await (supabase as any)
        .from("pedidos")
        .select("status")
        .eq("id", pedidoId)
        .maybeSingle();
      if (!data) return;

      if (data.status !== "aguardando_confirmacao") {
        clearInterval(interval);
        irParaTracking(pedidoId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [aguardandoConfirmacao?.pedidoId]);

  const totalQty   = useMemo(() => Object.values(cart).reduce((s, i) => s + i.qty, 0), [cart]);
  const totalPrice = useMemo(
    () => Object.values(cart).reduce((s, i) => s + Math.round(i.preco * 100) * i.qty, 0) / 100,
    [cart]
  );
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const taxaEntrega = useMemo(() => {
    if (mesa) return 0;
    if (tipoEntrega === "retirada") return 0;
    const emp = empresa as any;
    if (emp.taxa_entrega_tipo === "km" && emp.empresa_lat && emp.empresa_lng && clienteLat && clienteLng) {
      const R = 6371;
      const dLat = (clienteLat - emp.empresa_lat) * Math.PI / 180;
      const dLng = (clienteLng - emp.empresa_lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(emp.empresa_lat * Math.PI/180) * Math.cos(clienteLat * Math.PI/180) * Math.sin(dLng/2)**2;
      const distKm = R * 2 * Math.asin(Math.sqrt(a));
      return Math.round(((emp.taxa_entrega_base ?? 0) + distKm * (emp.taxa_entrega_por_km ?? 2)) * 100) / 100;
    }
    return Number(emp.taxa_entrega ?? 0);
  }, [tipoEntrega, empresa, clienteLat, clienteLng]);

  const desconto = useMemo(() => {
    if (!cupomAplicado) return 0;
    if (cupomAplicado.tipo === "percentual") return (totalPrice * cupomAplicado.valor) / 100;
    return Math.min(cupomAplicado.valor, totalPrice);
  }, [cupomAplicado, totalPrice]);

  async function aplicarCupom() {
    if (!codigoCupom.trim()) return;
    setCupomLoading(true);
    const { data } = await supabase.from("cupons")
      .select("id,tipo,valor,usos_max,usos_atual,ativo,validade")
      .eq("empresa_id", empresa.id)
      .eq("codigo", codigoCupom.trim().toUpperCase())
      .maybeSingle();
    setCupomLoading(false);
    if (!data) { toast.error("Cupom não encontrado."); return; }
    if (!data.ativo) { toast.error("Este cupom está inativo."); return; }
    if (data.validade && new Date(data.validade) < new Date()) { toast.error("Este cupom expirou."); return; }
    if (data.usos_max && (data.usos_atual ?? 0) >= data.usos_max) { toast.error("Este cupom atingiu o limite de usos."); return; }
    setCupomAplicado({ id: data.id, tipo: data.tipo, valor: Number(data.valor), codigo: codigoCupom.trim().toUpperCase(), usos_atual: data.usos_atual ?? 0 });
    toast.success(`Cupom ${codigoCupom.toUpperCase()} aplicado!`);
  }

  function addToCart(p: any, qty = 1, opcoes?: OpcaoSelecionada[]) {
    trackEvento(empresa.id, "adicionado_carrinho", { produto_id: p.id, metadata: { nome: p.nome } });
    setCart((c) => {
      const precoBase = Number(p.preco_promocional ?? p.preco);
      const extra = opcoes?.length ? opcoes.reduce((s, o) => s + o.precoAdicional, 0) : 0;
      const preco = precoBase + extra;
      const cartKey = opcoes?.length
        ? `${p.id}_${opcoes.map(o => o.opcaoId).sort().join("|")}`
        : p.id;
      const cur = c[cartKey];
      return { ...c, [cartKey]: cur ? { ...cur, qty: cur.qty + qty } : { id: p.id, cartKey, nome: p.nome, preco, qty, opcoes } };
    });
  }
  function decCart(id: string) {
    setCart((c) => {
      const cur = c[id]; if (!cur) return c;
      if (cur.qty <= 1) { const { [id]: _, ...rest } = c; return rest; }
      return { ...c, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  }

  function decCartProduto(produtoId: string) {
    setCart((c) => {
      const key = Object.keys(c).find(k => k === produtoId || k.startsWith(produtoId + "_"));
      if (!key) return c;
      const cur = c[key];
      if (cur.qty <= 1) { const { [key]: _, ...rest } = c; return rest; }
      return { ...c, [key]: { ...cur, qty: cur.qty - 1 } };
    });
  }

  function selecionarCat(catId: string | null) {
    setCatAtiva(catId);
    setBusca("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCheckoutErro(null);

    if (empresa.status === "bloqueada") {
      setCheckoutErro("Esta loja está bloqueada e não aceita pedidos no momento.");
      return;
    }
    const { aberto: lojaAberta, label: lojaLabel } = verificarAberto(empresa);
    if (!lojaAberta) {
      setCheckoutErro(`Loja fechada. ${lojaLabel}`);
      return;
    }

    const items = Object.values(cart);
    if (items.length === 0) { setCheckoutErro("Carrinho vazio."); return; }

    const isKmDelivery = tipoEntrega === "delivery" && (empresa as any).taxa_entrega_tipo === "km";
    if (isKmDelivery && !clienteLat) {
      setCheckoutErro("Informe o endereço para calcularmos a taxa de entrega.");
      return;
    }

    const pedidoMin = Number((empresa as any).pedido_minimo ?? 0);
    if (pedidoMin > 0 && totalPrice < pedidoMin) {
      setCheckoutErro(`Pedido mínimo de ${fmt(pedidoMin)}. Faltam ${fmt(pedidoMin - totalPrice)}.`);
      return;
    }

    const fd               = new FormData(e.currentTarget);
    const cliente_nome     = String(fd.get("nome")).trim().slice(0, 120);
    const cliente_telefone = mesa ? "" : String(fd.get("telefone")).replace(/\D/g, "").slice(0, 15);
    const isRetirada       = tipoEntrega === "retirada";
    const cliente_endereco = mesa ? `Mesa ${mesa}` : isRetirada ? "Retirada no balcão" : String(fd.get("endereco")).trim().slice(0, 255);
    const forma_pagamento  = String(fd.get("pagamento"));
    const trocoVal         = forma_pagamento === "Dinheiro" && !mesa && tipoEntrega === "delivery" && trocoDelivery.trim()
      ? parseFloat(trocoDelivery.replace(",", "."))
      : null;
    const totalFinal       = Math.max(0, totalPrice + taxaEntrega - desconto);
    if (trocoVal !== null && trocoVal < totalFinal) {
      setCheckoutErro(`Troco deve ser no mínimo ${fmt(totalFinal)}. O cliente pagará com quanto?`);
      return;
    }
    const obsBase          = String(fd.get("observacao") || "").trim().slice(0, 500);
    const observacao       = obsBase || undefined;

    if (!cliente_nome || cliente_nome.length < 2) { setCheckoutErro("Informe seu nome completo."); return; }
    if (!mesa && !isRetirada && (!cliente_telefone || cliente_telefone.length < 8)) { setCheckoutErro("Informe um telefone válido."); return; }
    if (!mesa && !isRetirada && clienteCep.replace(/\D/g,"").length !== 8) { setCheckoutErro("Informe o CEP da entrega."); return; }
    if (!mesa && !isRetirada && (!cliente_endereco || cliente_endereco.length < 10)) { setCheckoutErro("Informe o endereço completo (rua, número e bairro)."); return; }
    if (!["Dinheiro", "Cartão", "PIX"].includes(forma_pagamento)) { setCheckoutErro("Selecione a forma de pagamento."); return; }

    trackEvento(empresa.id, "checkout_iniciado");
    setCheckoutLoading(true);
    try {
      // Garante sessão autenticada antes do RPC (signInAnonymously já foi chamado no mount)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.signInAnonymously();

      const itensRpc = items.map((i) => ({
        produto_id:  i.id,
        quantidade:  i.qty,
        observacao:  i.opcoes?.length ? i.opcoes.map((o: { opcaoNome: string }) => o.opcaoNome).join(", ") : null,
      }));

      const { data: pedidoJson, error } = await supabase.rpc("finalizar_pedido", {
        p_empresa_id:       empresa.id,
        p_cliente_nome:     cliente_nome,
        p_cliente_telefone: mesa ? undefined : cliente_telefone || undefined,
        p_cliente_endereco: cliente_endereco,
        p_forma_pagamento:  forma_pagamento,
        p_observacao:       observacao || undefined,
        p_mesa:             mesa ? `Mesa ${mesa}` : undefined,
        p_tipo:             mesa ? "mesa" : isRetirada ? "retirada" : "delivery",
        p_cupom_id:         cupomAplicado?.id ?? undefined,
        p_itens:            itensRpc,
        p_cliente_lat:      clienteLat ?? undefined,
        p_cliente_lng:      clienteLng ?? undefined,
        p_cliente_cpf:      clienteCpf.replace(/\D/g, "").length === 11 ? clienteCpf : undefined,
        p_cliente_cep:      clienteCep.replace(/\D/g, "").length === 8  ? clienteCep : undefined,
        p_cliente_cidade:   clienteCidade || undefined,
        p_idempotency_key:  checkoutKeyRef.current,
        p_troco:            trocoVal ?? undefined,
      });

      if (error || !pedidoJson) {
        setCheckoutErro(`Erro ao registrar pedido: ${error?.message ?? "tente novamente."}`);
        return;
      }

      trackEvento(empresa.id, "pedido_finalizado");
      // Salva dados do cliente para pré-preenchimento no próximo pedido
      if (!mesa) {
        try {
          const novos = { nome: cliente_nome, telefone: cliente_telefone || "", endereco: isRetirada ? "" : cliente_endereco };
          localStorage.setItem("deliverly_cliente_dados", JSON.stringify(novos));
          setDadosSalvos(novos);
        } catch {}
      }
      const pedido = pedidoJson as { id: string; numero: number; subtotal: number | string; taxa_entrega: number | string; desconto: number | string; total: number | string; status: string; fluxo_pedido: string };
      await salvarPushClientePedido(pedido.id);
      const subtotal = Number(pedido.subtotal ?? 0);
      const taxa     = Number(pedido.taxa_entrega ?? 0);
      const desconto = Number(pedido.desconto ?? 0);
      const total    = Number(pedido.total ?? Math.max(0, subtotal + taxa - desconto));
      const separador = "─────────────────────";
      const cabecalho = mesa
        ? `📍 *Mesa ${mesa}*\n👤 Cliente: ${cliente_nome}\n`
        : isRetirada
          ? `🏪 *RETIRADA NO BALCÃO*\n👤 Cliente: ${cliente_nome}\n📞 Telefone: ${cliente_telefone}\n`
          : `🛵 *DELIVERY*\n👤 Cliente: ${cliente_nome}\n📞 Telefone: ${cliente_telefone}\n📍 Endereço: ${cliente_endereco}\n`;
      const linhaEntrega = mesa
        ? `🪑 Pedido na mesa — sem taxa`
        : isRetirada
          ? `🏃 Retirada: _grátis_`
          : `🛵 Entrega: ${fmt(taxa)}`;
      const msg = encodeURIComponent(
        `🔔 *Novo Pedido #${pedido.numero}*\n${separador}\n\n` +
        cabecalho +
        `\n${separador}\n*🛒 Itens:*\n${items.map((i) => {
          const opStr = i.opcoes?.length ? `\n   ↳ ${i.opcoes.map((o) => o.opcaoNome).join(", ")}` : "";
          return `▸ ${i.qty}× ${i.nome} — ${fmt(i.preco * i.qty)}${opStr}`;
        }).join("\n")}\n${separador}\n` +
        `💰 Subtotal: ${fmt(subtotal)}` +
        (desconto > 0 ? `\n🎟 Desconto (${cupomAplicado?.codigo}): -${fmt(desconto)}` : "") +
        `\n${linhaEntrega}\n✅ *Total: ${fmt(total)}*\n\n` +
        `💳 Pagamento: ${forma_pagamento}` +
        (trocoVal && trocoVal > 0 ? `\n💵 Troco para: ${fmt(trocoVal)}` : "") +
        (observacao ? `\n📝 Obs: ${observacao}` : "")
      );

      const waUrl = empresa.whatsapp ? `https://wa.me/${normalizeWA(empresa.whatsapp)}?text=${msg}` : null;

      const limparCheckout = () => {
        setCart({}); setCheckoutOpen(false); setCupomAplicado(null); setCodigoCupom("");
        checkoutKeyRef.current = crypto.randomUUID();
      };

      // Fluxo manual: função já inseriu com status aguardando_confirmacao; aguarda dono confirmar
      if (pedido.status === "aguardando_confirmacao") {
        limparCheckout();
        setAguardandoConfirmacao({ pedidoId: pedido.id, numero: pedido.numero });
        return;
      }

      // Pedido de mesa: vai direto para acompanhamento (cliente está no local, sem WA necessário)
      if (mesa) {
        limparCheckout();
        window.location.href = `/pedido/${pedido.id}`;
        return;
      }

      if (forma_pagamento === "PIX") {
        const emp = empresa as any;
        const chaveRaw = emp.chave_pix as string | null;
        const tipoChave = emp.tipo_chave_pix ?? "aleatoria";
        const chave = chaveRaw ? normalizarChavePix(chaveRaw.trim(), tipoChave) : null;
        if (chave) {
          const nomeRec   = (emp.nome_recebedor || emp.nome_fantasia || "Loja").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").substring(0, 25).trim() || "Loja";
          const cidadeRec = (emp.cidade_recebedor || "Brasil").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").substring(0, 15).trim() || "Brasil";
          const payload   = gerarPixPayload(chave, nomeRec, cidadeRec, total);
          try {
            const qrUrl = await QRCode.toDataURL(payload, { width: 240, margin: 2, color: { dark: "#18181b", light: "#ffffff" } });
            limparCheckout();
            setPixModal({ payload, qrUrl, total, desconto: 0, waLink: waUrl ?? "", pedidoNum: pedido.numero, pedidoId: pedido.id, pixChave: chave, pixNome: nomeRec, pixCidade: cidadeRec });
          } catch (e) {
            console.error("Erro ao gerar QR PIX:", e);
            limparCheckout();
            setWhatsappEnviado(false);
            setPedidoFeito({ id: pedido.id, numero: pedido.numero, waUrl });
          }
          return;
        }
      }
      limparCheckout();
      setWhatsappEnviado(false);
      setPedidoFeito({ id: pedido.id, numero: pedido.numero, waUrl });
    } catch (err) {
      console.error("Erro ao finalizar pedido", err);
      const message = err instanceof Error && err.message
        ? err.message
        : "Não foi possível finalizar o pedido. Tente novamente.";
      setCheckoutErro(message);
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function buscarPedidosPorTel() {
    const tel = telBusca.replace(/\D/g, "");
    if (tel.length < 8) return;
    setBuscandoPedidos(true);
    const { data } = await (supabase as any).rpc("buscar_pedidos_por_telefone", {
      p_empresa_id: empresa.id,
      p_telefone: tel,
    });
    setPedidosBusca(data ?? []);
    setBuscandoPedidos(false);
  }

  const STATUS_COR: Record<string, string> = {
    aguardando_confirmacao: "bg-zinc-100 text-zinc-600",
    aguardando_pagamento:   "bg-blue-100 text-blue-700",
    novo:       "bg-blue-100 text-blue-700",
    aceito:     "bg-amber-100 text-amber-700",
    preparo:    "bg-orange-100 text-orange-700",
    entrega:    "bg-purple-100 text-purple-700",
    finalizado: "bg-green-100 text-green-700",
    cancelado:  "bg-red-100 text-red-700",
  };
  const STATUS_LABEL: Record<string, string> = {
    aguardando_confirmacao: "Aguard. confirmação",
    aguardando_pagamento:   "Pagar PIX ➜",
    novo:       "Aguardando", aceito: "Aceito", preparo: "Em preparo",
    entrega:    "Saiu p/ entrega", finalizado: "Entregue", cancelado: "Cancelado",
  };

  const termoBusca = busca.trim().toLowerCase();
  const produtosFiltrados = termoBusca
    ? produtos.filter((p: any) =>
        p.nome.toLowerCase().includes(termoBusca) ||
        (p.descricao ?? "").toLowerCase().includes(termoBusca)
      )
    : null; // null = sem busca ativa, mostra categorias normalmente

  const categoriasComProdutos = categorias.filter((c: any) =>
    produtos.some((p: any) => p.categoria_id === c.id)
  );
  const semCategoria = produtos.filter((p: any) => !p.categoria_id);

  const brandColor = (empresa as any).cor_primaria || "#F97316";

  return (
    <div className="min-h-screen bg-zinc-100" data-loja>
      <style>{`
        [data-loja] .b-btn  { background-color: ${brandColor}; border-color: ${brandColor}; }
        [data-loja] .b-btn:hover { filter: brightness(0.92); }
        [data-loja] .b-text { color: ${brandColor}; }
        [data-loja] .b-border { border-color: ${brandColor}; }
        [data-loja] .b-ring:focus { ring-color: ${brandColor}; outline-color: ${brandColor}; }
      `}</style>

      {/* Banner mesa */}
      {mesa && (
        <div className="text-white text-center py-2.5 text-sm font-bold flex items-center justify-center gap-2"
          style={{ backgroundColor: brandColor }}>
          🪑 Você está na <strong>Mesa {mesa}</strong> — faça seu pedido!
        </div>
      )}

      {/* Banner fechada (manual ou fora do horário) */}
      {!verificarAberto(empresa).aberto && empresa.status !== "bloqueada" && (
        <div className="bg-zinc-800 text-white text-center py-3 text-sm font-semibold flex items-center justify-center gap-2">
          🔴 Loja fechada no momento — voltamos em breve!
        </div>
      )}

      {/* Banner bloqueada */}
      {empresa.status === "bloqueada" && (
        <div className="bg-red-500 text-white text-center py-2.5 text-sm font-semibold">
          Esta loja está temporariamente indisponível para pedidos.
        </div>
      )}

      {/* Banner + header */}
      <div>
        {empresa.banner_url ? (
          <div className="h-40 sm:h-52 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${empresa.banner_url})` }}>
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/50" />
            <button
              onClick={() => navigate({ to: "/" })}
              className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-black/40 hover:bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
              <ChevronLeft className="size-3.5" />Início
            </button>
          </div>
        ) : (
          <div className="h-28 bg-gradient-to-br from-zinc-800 to-zinc-900 relative">
            <button
              onClick={() => navigate({ to: "/" })}
              className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
              <ChevronLeft className="size-3.5" />Início
            </button>
          </div>
        )}
        <div className="bg-white shadow-sm">
          <div className="max-w-2xl mx-auto px-4 pb-4">
            <div className="flex items-start gap-4 relative z-10">
              {empresa.logo_url ? (
                <img src={empresa.logo_url} alt={empresa.nome_fantasia}
                  className="size-20 rounded-2xl object-cover ring-4 ring-white shadow-lg shrink-0 -mt-10" />
              ) : (
                <div className="size-20 rounded-2xl bg-zinc-100 ring-4 ring-white shadow-lg flex items-center justify-center shrink-0 -mt-10">
                  <Store className="size-9 text-zinc-400" />
                </div>
              )}
              <div className="pt-2 min-w-0 flex-1">
                <h1 className="text-xl font-bold text-zinc-900 leading-tight break-words">{empresa.nome_fantasia}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {mediaAval !== null && totalAval > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                      ★ {mediaAval.toFixed(1)} <span className="font-normal text-yellow-500">({totalAval})</span>
                    </span>
                  )}
                  {(() => {
                    const { aberto, label } = verificarAberto(empresa);
                    return (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        aberto ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        <span className={`size-1.5 rounded-full ${aberto ? "bg-green-500" : "bg-red-500"}`} />
                        {label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500 flex-wrap">
                  {/* Tempo de entrega */}
                  {empresa.tempo_entrega && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-zinc-400" />
                      {empresa.tempo_entrega}
                    </span>
                  )}
                  {/* Taxa de entrega */}
                  {(empresa as any).taxa_entrega_tipo === "km" ? (
                    <span className="flex items-center gap-1 text-zinc-500">
                      <ShoppingCart className="size-3 text-zinc-400" />
                      Entrega <strong className="text-zinc-700">por km</strong>
                    </span>
                  ) : Number(empresa.taxa_entrega) > 0 ? (
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="size-3 text-zinc-400" />
                      Entrega <strong className="text-zinc-700">{fmt(Number(empresa.taxa_entrega))}</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-600 font-semibold">
                      <ShoppingCart className="size-3" /> Entrega grátis
                    </span>
                  )}
                  {/* Pedido mínimo */}
                  {Number(empresa.pedido_minimo) > 0 && (
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="size-3 text-zinc-400" />
                      Mín. <strong className="text-zinc-700">{fmt(Number(empresa.pedido_minimo))}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botão acompanhar pedido + contato WhatsApp */}
      <div className="bg-white border-t border-zinc-100">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <button
            onClick={() => { setAcompanharOpen(true); setTelBusca(""); setPedidosBusca(null); }}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <PackageSearch className="size-4" style={{ color: brandColor }} />
            Acompanhar meu pedido
          </button>
          {empresa.whatsapp && (
            <a
              href={`https://wa.me/${normalizeWA(empresa.whatsapp)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
            >
              <MessageCircle className="size-4" />
              Falar com a loja
            </a>
          )}
        </div>
      </div>

      {/* Nav de categorias — filtro ativo */}
      {categoriasComProdutos.length > 0 && (
        <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 shadow-sm">
          <div className="max-w-2xl mx-auto relative">
            {/* fade direito indica que há mais para rolar */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-10" />
            <div className="flex gap-1.5 overflow-x-auto py-3 px-4 pr-10"
                 style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
              <button
                onClick={() => selecionarCat(null)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
                  catAtiva === null && !busca
                    ? "b-btn text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
                style={catAtiva === null && !busca ? { background: brandColor } : undefined}
              >
                Todos
              </button>
              {categoriasComProdutos.map((c: any) => (
                <button key={c.id}
                  onClick={() => selecionarCat(c.id)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
                    catAtiva === c.id
                      ? "text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                  style={catAtiva === c.id ? { background: brandColor } : undefined}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra de busca */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio..."
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white shadow-sm border border-zinc-200 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
          />
          {busca && (
            <button onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-zinc-200 flex items-center justify-center hover:bg-zinc-300 transition-colors">
              <X className="size-3 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* Produtos */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6 pb-32">

        {/* Resultado da busca */}
        {produtosFiltrados !== null && (
          produtosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-sm text-zinc-400">
              <Search className="size-10 mx-auto mb-3 text-zinc-200" />
              Nenhum item encontrado para "<strong>{busca}</strong>"
            </div>
          ) : (
            <section>
              <p className="text-xs text-zinc-400 mb-2 px-1">{produtosFiltrados.length} resultado{produtosFiltrados.length !== 1 ? "s" : ""}</p>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {produtosFiltrados.map((p: any, i: number, arr: any[]) => (
                  <ProductCard key={p.id} p={p} cart={cart}
                    onOpen={() => setSelectedProduct(p)}
                    onAdd={() => addToCart(p)}
                    onDec={() => decCartProduto(p.id)}
                    fmt={fmt}
                    last={i === arr.length - 1}
                  />
                ))}
              </div>
            </section>
          )
        )}

        {/* Lista normal por categorias (quando não há busca) */}
        {produtosFiltrados === null && (
          <>
            {categoriasComProdutos.length === 0 && semCategoria.length === 0 && (
              <div className="text-center py-20 text-sm text-zinc-400">
                Esta loja ainda não tem itens no cardápio.
              </div>
            )}

            {/* Filtro por categoria ativa */}
            {catAtiva !== null ? (
              (() => {
                const cat = categoriasComProdutos.find((c: any) => c.id === catAtiva);
                const itens = produtos.filter((p: any) => p.categoria_id === catAtiva);
                return cat && itens.length > 0 ? (
                  <section>
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 px-1">{cat.nome} · {itens.length} item{itens.length !== 1 ? "s" : ""}</h2>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {itens.map((p: any, i: number, arr: any[]) => (
                        <ProductCard key={p.id} p={p} cart={cart}
                          onOpen={() => setSelectedProduct(p)}
                          onAdd={() => addToCart(p)}
                          onDec={() => decCartProduto(p.id)}
                          fmt={fmt}
                          last={i === arr.length - 1}
                        />
                      ))}
                    </div>
                  </section>
                ) : null;
              })()
            ) : (
              /* Todas as categorias */
              <>
                {categoriasComProdutos.map((cat: any) => (
                  <section key={cat.id}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{cat.nome}</h2>
                      <button
                        onClick={() => selecionarCat(cat.id)}
                        className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        Ver só isso →
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {produtos
                        .filter((p: any) => p.categoria_id === cat.id)
                        .map((p: any, i: number, arr: any[]) => (
                          <ProductCard key={p.id} p={p} cart={cart}
                            onOpen={() => setSelectedProduct(p)}
                            onAdd={() => addToCart(p)}
                            onDec={() => decCartProduto(p.id)}
                            fmt={fmt}
                            last={i === arr.length - 1}
                          />
                        ))}
                    </div>
                  </section>
                ))}

                {semCategoria.length > 0 && (
                  <section>
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">Outros</h2>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {semCategoria.map((p: any, i: number, arr: any[]) => (
                        <ProductCard key={p.id} p={p} cart={cart}
                          onOpen={() => setSelectedProduct(p)}
                          onAdd={() => addToCart(p)}
                          onDec={() => decCartProduto(p.id)}
                          fmt={fmt}
                          last={i === arr.length - 1}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Seção de avaliações públicas */}
      {avaliacoes.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pb-6 mt-2">
          <h2 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
            <span className="text-yellow-400">★</span> Avaliações dos clientes
            <span className="text-zinc-400 font-normal">({totalAval})</span>
          </h2>
          <div className="space-y-3">
            {avaliacoes.filter((a: any) => a.comentario?.trim()).map((a: any, i: number) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <span key={n} className={`text-sm ${n <= a.nota ? "text-yellow-400" : "text-zinc-200"}`}>★</span>
                    ))}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{a.comentario}</p>
                {a.cliente_nome && (
                  <p className="text-xs text-zinc-400 mt-1">— {a.cliente_nome.split(" ")[0]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra do carrinho */}
      {totalQty > 0 && !selectedProduct && !checkoutOpen && (() => {
        const { aberto: lojaAberta, label: lojaLabel } = verificarAberto(empresa);
        return (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-6 bg-gradient-to-t from-zinc-100 via-zinc-100/95 to-transparent" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="max-w-2xl mx-auto">
            {!lojaAberta ? (
              <div className="w-full bg-zinc-800 text-white rounded-2xl h-14 flex items-center justify-center gap-2 font-semibold shadow-xl text-sm">
                🔴 {lojaLabel} — pedidos desativados
              </div>
            ) : (
            <button onClick={() => {
              checkoutKeyRef.current = crypto.randomUUID();
              setCheckoutErro(null);
              setTrocoDelivery("");
              setClienteLat(null);
              setClienteLng(null);
              setClienteCep("");
              setClienteCidade("");
              setClienteCpf("");
              setCheckoutOpen(true);
            }}
              className="w-full b-btn text-white rounded-2xl h-14 flex items-center justify-between px-5 font-semibold transition-colors shadow-xl">
              <span className="bg-white/20 text-white text-sm font-bold px-2.5 py-1 rounded-lg min-w-[28px] text-center">
                {totalQty}
              </span>
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-4" /> Fazer pedido
              </span>
              <span>{fmt(totalPrice)}</span>
            </button>
            )}
          </div>
        </div>
        );
      })()}

      {/* Modal acompanhar pedido */}
      {acompanharOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setAcompanharOpen(false)}>
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 overflow-y-auto" style={{ maxHeight: "90dvh" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PackageSearch className="size-5" style={{ color: brandColor }} />
                <h3 className="text-base font-bold text-zinc-900">Acompanhar pedido</h3>
              </div>
              <button onClick={() => setAcompanharOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-500 mb-4">
              Digite seu telefone para encontrar seus pedidos nesta loja.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                value={telBusca}
                onChange={(e) => setTelBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarPedidosPorTel()}
                className="flex-1 h-11 rounded-xl border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as any}
                autoFocus
              />
              <button
                onClick={buscarPedidosPorTel}
                disabled={buscandoPedidos || telBusca.replace(/\D/g, "").length < 8}
                className="h-11 px-4 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: brandColor }}
              >
                {buscandoPedidos ? "…" : "Buscar"}
              </button>
            </div>

            {pedidosBusca !== null && (
              pedidosBusca.length === 0 ? (
                <p className="text-sm text-center text-zinc-400 py-4">Nenhum pedido encontrado para este telefone.</p>
              ) : (
                <div className="space-y-2">
                  {pedidosBusca.map((p: any) => (
                    <a
                      key={p.id}
                      href={`/pedido/${p.id}`}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${p.status === "aguardando_pagamento" ? "bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200" : "bg-zinc-50 hover:bg-zinc-100"}`}
                    >
                      <div>
                        <div className="font-bold text-zinc-900 text-sm">Pedido #{p.numero}</div>
                        <div className="text-xs text-zinc-400">
                          {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${STATUS_COR[p.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </a>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Modal fluxo manual — aguardando confirmação */}
      {aguardandoConfirmacao && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 text-center">
            <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl animate-pulse">⏳</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900">Pedido #{aguardandoConfirmacao.numero} enviado!</h3>
            <p className="text-sm text-zinc-500 mt-1">Aguardando confirmação do estabelecimento.</p>
            <p className="text-xs text-zinc-400 mt-2 mb-4">Você será redirecionado automaticamente assim que o pedido for confirmado.</p>
            <button
              onClick={() => irParaTracking(aguardandoConfirmacao.pedidoId)}
              className="w-full bg-zinc-900 hover:bg-zinc-700 text-white rounded-2xl h-12 font-semibold text-sm transition-colors mb-3"
            >
              📦 Acompanhar pedido agora
            </button>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
              <span className="size-2 rounded-full bg-zinc-300 animate-pulse" />
              <span className="size-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:200ms]" />
              <span className="size-2 rounded-full bg-zinc-300 animate-pulse [animation-delay:400ms]" />
            </div>
          </div>
        </div>
      )}

      {/* Modal pedido confirmado */}
      {pedidoFeito && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 text-center">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="size-8 text-green-600" />
            </div>
            <h3 className="text-xl font-black text-zinc-900">Pedido #{pedidoFeito.numero} registrado!</h3>

            {pedidoFeito.waUrl ? (
              <>
                {!whatsappEnviado && (
                  <div className="mt-3 mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-sm font-bold text-amber-800">⚠️ Falta um passo!</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Toque no botão abaixo para o restaurante receber seu pedido pelo WhatsApp. Sem isso, o pedido não chega.</p>
                  </div>
                )}
                <a
                  href={pedidoFeito.waUrl}
                  target="_blank" rel="noreferrer"
                  onClick={() => setWhatsappEnviado(true)}
                  className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl h-14 font-bold text-base transition-colors mb-3 shadow-lg"
                >
                  <MessageCircle className="size-5" /> {whatsappEnviado ? "Reenviar pelo WhatsApp" : "Enviar pedido pelo WhatsApp"}
                </a>
              </>
            ) : (
              <p className="text-sm text-zinc-500 mt-2 mb-5">Seu pedido foi registrado com sucesso!</p>
            )}

            <a
              href={`/pedido/${pedidoFeito.id}`}
              target="_blank" rel="noreferrer"
              aria-disabled={!whatsappEnviado && !!pedidoFeito.waUrl}
              className={`flex items-center justify-center gap-2 w-full border rounded-2xl h-11 font-medium text-sm transition-colors ${
                !whatsappEnviado && pedidoFeito.waUrl
                  ? "border-zinc-100 text-zinc-300 pointer-events-none select-none"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {!whatsappEnviado && pedidoFeito.waUrl ? "Envie pelo WhatsApp primeiro" : "Ver status do pedido →"}
            </a>
          </div>
        </div>
      )}

      {/* Modal PIX */}
      {pixModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 text-center">
            <div className="size-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">💸</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900">Pague via PIX</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-1">Pedido #{pixModal.pedidoNum}</p>
            {pixModal.desconto > 0 ? (
              <div className="mb-4">
                <p className="text-sm line-through text-zinc-400">{fmt(pixModal.total)}</p>
                <p className="text-2xl font-black text-green-600">{fmt(pixModal.total - pixModal.desconto)}</p>
                <p className="text-xs text-green-600 font-medium">🎁 Desconto de {fmt(pixModal.desconto)} aplicado!</p>
              </div>
            ) : (
              <p className="text-2xl font-black text-zinc-900 mb-4">{fmt(pixModal.total)}</p>
            )}

            {pixModal.qrUrl && (
              <div className="flex justify-center mb-4">
                <img src={pixModal.qrUrl} alt="QR Code PIX" className="size-40 sm:size-52 rounded-2xl border border-zinc-100 shadow-sm" />
              </div>
            )}

            <p className="text-xs text-zinc-500 mb-2 font-medium">Ou copie o código:</p>
            <div className="flex gap-2 mb-5">
              <input readOnly value={pixModal.payload}
                className="flex-1 text-[10px] font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-600 truncate focus:outline-none" />
              <button
                onClick={async () => { await copiarTexto(pixModal.payload) ? toast.success("Código PIX copiado!") : toast.error("Não foi possível copiar automaticamente."); }}
                className="shrink-0 px-3 py-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                <Copy className="size-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-4">Após o pagamento, clique abaixo para notificar o estabelecimento.</p>

            <button
              onClick={() => {
                const num = pixModal.pedidoNum;
                const id  = pixModal.pedidoId;
                supabase.functions.invoke("push-pedido", {
                  body: {
                    event_type: "cliente_pagou_pix",
                    empresa_id: (empresa as any)?.id,
                    numero: num,
                    pedido_id: id,
                  },
                }).catch(() => {});
                setPixModal(null);
                setPedidoFeito(null);
                toast.success(`Pedido #${num}: loja notificada!`);
                irParaTracking(id);
              }}
              className="w-full h-12 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-semibold text-base flex items-center justify-center gap-2 mb-3 transition-colors"
            >
              <CheckCircle2 className="size-5" /> Já paguei — notificar loja
            </button>
            <button onClick={() => irParaTracking(pixModal!.pedidoId)}
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
              Fechar — ver pedido
            </button>
          </div>
        </div>
      )}

      {/* Modal de produto */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          cartQty={cart[selectedProduct.id]?.qty ?? 0}
          fmt={fmt}
          onClose={() => setSelectedProduct(null)}
          onAdd={(qty, opcoes) => {
            addToCart(selectedProduct, qty, opcoes);
            setSelectedProduct(null);
            toast.success(`${selectedProduct.nome} adicionado!`);
          }}
        />
      )}

      {/* Modal checkout */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setCheckoutOpen(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: "92dvh", WebkitOverflowScrolling: "touch" } as any}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-zinc-900">Seu pedido</h3>
                <button onClick={() => setCheckoutOpen(false)}
                  className="size-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200">
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {Object.values(cart).map((i) => (
                  <div key={i.cartKey} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-700 font-medium">{i.nome}</span>
                      {i.opcoes && i.opcoes.length > 0 && (
                        <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          {i.opcoes.map((o) => o.opcaoNome).join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => decCart(i.cartKey)}
                        className="size-8 rounded-full border border-zinc-200 flex items-center justify-center hover:border-orange-400">
                        <Minus className="size-3.5" />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{i.qty}</span>
                      <button onClick={() => setCart(c => ({ ...c, [i.cartKey]: { ...i, qty: i.qty + 1 } }))}
                        className="size-8 rounded-full bg-orange-500 text-white flex items-center justify-center">
                        <Plus className="size-3.5" />
                      </button>
                      <span className="text-sm font-semibold w-20 text-right text-zinc-900">
                        {fmt(i.preco * i.qty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {mesa && (
                <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-xl px-4 py-2.5 mb-2"
                  style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}30` }}>
                  <span className="text-xl">🪑</span>
                  <div>
                    <div className="text-sm font-bold" style={{ color: brandColor }}>Mesa {mesa}</div>
                    <div className="text-xs text-zinc-500">Pedido será entregue na mesa</div>
                  </div>
                </div>
              )}

              <form onSubmit={checkout} className="space-y-3">
                {/* Selector Delivery / Retirada — primeiro para o total ficar correto abaixo */}
                {!mesa && (empresa as any).retirada_ativa && (
                  <div className="grid grid-cols-2 gap-2">
                    {(["delivery", "retirada"] as const).map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setTipoEntrega(tipo)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          tipoEntrega === tipo
                            ? "b-btn text-white border-transparent"
                            : "bg-white border-zinc-200 text-zinc-500"
                        }`}
                        style={tipoEntrega === tipo ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                      >
                        {tipo === "delivery" ? "🛵 Delivery" : "🏪 Retirar no balcão"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Resumo de valores */}
                <div className="bg-zinc-50 rounded-xl px-4 py-3 space-y-1.5">
                  {/* Campo de cupom */}
                  <div className="pb-1.5 mb-1 border-b border-zinc-200">
                    {cupomAplicado ? (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-green-700 font-medium">
                          🎉 Cupom <span className="font-mono font-bold">{cupomAplicado.codigo}</span> aplicado!
                        </div>
                        <button onClick={() => { setCupomAplicado(null); setCodigoCupom(""); }}
                          className="text-green-500 hover:text-green-700 text-xs underline">
                          Remover
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={codigoCupom}
                          onChange={(e) => setCodigoCupom(e.target.value.toUpperCase())}
                          placeholder="Tem cupom? Digite aqui"
                          className="flex-1 h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-mono uppercase placeholder:normal-case placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarCupom(); } }}
                        />
                        <button onClick={aplicarCupom} disabled={cupomLoading || !codigoCupom.trim()}
                          className="px-4 h-9 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors">
                          {cupomLoading ? "..." : "Aplicar"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span>{fmt(totalPrice)}</span>
                  </div>
                  {desconto > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Desconto ({cupomAplicado?.codigo})</span>
                      <span>-{fmt(desconto)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Taxa de entrega</span>
                    {mesa || tipoEntrega === "retirada" ? (
                      <span className="text-green-600 font-semibold">Grátis</span>
                    ) : (empresa as any).taxa_entrega_tipo === "km" && !clienteLat ? (
                      <span className="text-amber-500 text-xs">Informe o endereço</span>
                    ) : (
                      <span>{fmt(taxaEntrega)}</span>
                    )}
                  </div>
                  <div className="flex justify-between font-bold text-base pt-1.5 border-t border-zinc-200">
                    <span>Total</span>
                    {!mesa && tipoEntrega !== "retirada" && (empresa as any).taxa_entrega_tipo === "km" && !clienteLat ? (
                      <span className="text-amber-500 text-sm font-semibold">{fmt(Math.max(0, totalPrice - desconto))} + taxa</span>
                    ) : (
                      <span>{fmt(Math.max(0, totalPrice - desconto + taxaEntrega))}</span>
                    )}
                  </div>
                </div>
                {dadosSalvos && !mesa && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs text-green-700">
                    <span>✓ Seus dados foram preenchidos automaticamente</span>
                    <button type="button" onClick={() => {
                      setDadosSalvos(null);
                      try { localStorage.removeItem("deliverly_cliente_dados"); } catch {}
                    }} className="underline ml-2 shrink-0">Não sou eu</button>
                  </div>
                )}
                <FormField name="nome" label="Seu nome" required defaultValue={dadosSalvos?.nome} />
                {!mesa && <TelField initialValue={dadosSalvos?.telefone} />}
                {!mesa && tipoEntrega === "delivery" && (
                  <CepField
                    cep={clienteCep}
                    onCepChange={setClienteCep}
                    onCidadeChange={setClienteCidade}
                    onLoadingChange={setCepCarregando}
                    brandColor={brandColor}
                  />
                )}
                {!mesa && tipoEntrega === "delivery" && (
                  <AddressField
                    brandColor={brandColor}
                    onCapture={(lat, lng) => { setClienteLat(lat); setClienteLng(lng); }}
                    defaultValue={dadosSalvos?.endereco}
                  />
                )}
                {!mesa && tipoEntrega === "retirada" && (
                  <div className="text-xs text-zinc-500 bg-zinc-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    🏪 Você retirará o pedido no balcão do estabelecimento.
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <select name="pagamento" required value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/40">
                    {(empresa as any).chave_pix && <option value="PIX">💳 PIX (QR code gerado na hora)</option>}
                    <option value="Dinheiro">💵 Dinheiro na entrega</option>
                    <option value="Cartão">💳 Cartão na entrega</option>
                  </select>
                  {formaPagamento === "PIX" && (empresa as any).chave_pix && (
                    <p className="text-xs text-green-600 font-medium">✓ QR code será gerado após confirmar o pedido</p>
                  )}
                  {formaPagamento !== "PIX" && (
                    <p className="text-xs text-zinc-400">Pagamento feito no momento da entrega</p>
                  )}
                </div>
                {formaPagamento === "Dinheiro" && !mesa && tipoEntrega === "delivery" && (
                  <div className="space-y-1.5">
                    <Label>Troco para (opcional)</Label>
                    <input
                      type="number" min="0" step="0.01" placeholder="Ex: 50,00"
                      value={trocoDelivery} onChange={(e) => setTrocoDelivery(e.target.value)}
                      className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                    />
                    <p className="text-xs text-zinc-400">Deixe vazio se não precisar de troco</p>
                  </div>
                )}
                <CpfField value={clienteCpf} onChange={setClienteCpf} />
                <div className="space-y-1.5">
                  <Label>Observação (opcional)</Label>
                  <Textarea name="observacao" rows={2} className="rounded-xl resize-none" />
                </div>
                {checkoutErro && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-medium">
                    ⚠️ {checkoutErro}
                  </div>
                )}
                <p className="text-[11px] text-zinc-400 leading-relaxed text-center px-1">
                  Ao finalizar, seus dados (nome, telefone, endereço) serão compartilhados com a loja e o entregador para entrega do pedido. CPF, se informado, será usado apenas para nota fiscal.
                </p>
                <Button type="submit" disabled={checkoutLoading || cepCarregando}
                  className="w-full b-btn h-14 rounded-xl gap-2 text-base font-bold mt-2 text-white disabled:opacity-60">
                  {checkoutLoading
                    ? <><span className="animate-spin">⏳</span> Registrando pedido...</>
                    : cepCarregando
                      ? <><span className="animate-spin">⏳</span> Consultando CEP...</>
                      : <><MessageCircle className="size-5" /> Finalizar via WhatsApp</>
                  }
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
      <InstalarPWA />
    </div>
  );
}

/* ─── Card de produto ─── */
function ProductCard({ p, cart, onOpen, onAdd, onDec, fmt, last }: {
  p: any; cart: Record<string, CartItem>;
  onOpen: () => void; onAdd: () => void; onDec: () => void;
  fmt: (v: number) => string; last: boolean;
}) {
  const preco      = Number(p.preco_promocional ?? p.preco);
  const qty        = Object.entries(cart)
    .filter(([k]) => k === p.id || k.startsWith(p.id + "_"))
    .reduce((s, [, v]) => s + v.qty, 0);
  const esgotado   = p.controlar_estoque && p.estoque === 0;
  const temOpcoes  = (p.grupos_opcoes?.length ?? 0) > 0;
  const saboresDisponiveis: string[] = temOpcoes
    ? (p.grupos_opcoes[0]?.opcoes ?? [])
        .filter((o: any) => o.ativo !== false)
        .map((o: any) => o.nome as string)
    : [];

  return (
    <div
      className={`flex items-start gap-3 px-4 py-4 transition-colors ${!last ? "border-b border-zinc-100" : ""} ${esgotado ? "opacity-60" : "cursor-pointer active:bg-zinc-50"}`}
      onClick={esgotado ? undefined : onOpen}
    >
      {/* Info esquerda */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-zinc-900 text-sm leading-snug">{p.nome}</h3>
        {p.descricao && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{p.descricao}</p>
        )}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="font-bold text-zinc-900 text-sm">{fmt(preco)}</span>
          {p.preco_promocional && (
            <span className="text-xs text-zinc-400 line-through">{fmt(Number(p.preco))}</span>
          )}
          {esgotado && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Esgotado</span>
          )}
          {!esgotado && p.controlar_estoque && p.estoque <= 5 && p.estoque > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">Últimas {p.estoque}</span>
          )}
          {temOpcoes && !esgotado && saboresDisponiveis.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 w-full">
              {saboresDisponiveis.slice(0, 4).map((s) => (
                <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">{s}</span>
              ))}
              {saboresDisponiveis.length > 4 && (
                <span className="text-[10px] text-zinc-400 self-center">+{saboresDisponiveis.length - 4}</span>
              )}
            </div>
          )}
          {temOpcoes && !esgotado && saboresDisponiveis.length === 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">✦ Personalizável</span>
          )}
        </div>
      </div>

      {/* Foto + controles — coluna direita */}
      <div className="shrink-0 flex flex-col items-end gap-2 mt-0.5" onClick={(e) => e.stopPropagation()}>
        {p.foto_url && (
          <img src={p.foto_url} alt={p.nome} className="w-24 h-24 rounded-xl object-cover" />
        )}
        {!esgotado && (qty === 0 ? (
          temOpcoes ? (
            <button onClick={onOpen}
              className="h-10 px-4 rounded-xl b-btn text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors active:opacity-80">
              <Plus className="size-4" /> Personalizar
            </button>
          ) : (
            <button onClick={onAdd}
              className="h-10 px-4 rounded-xl b-btn text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors active:opacity-80">
              <Plus className="size-4" /> Adicionar
            </button>
          )
        ) : (
          <div className="flex items-center gap-1 bg-white rounded-xl shadow-md border border-zinc-100 px-1.5 py-1">
            <button onClick={onDec} className="size-8 flex items-center justify-center b-text rounded-lg active:bg-zinc-100">
              <Minus className="size-4" />
            </button>
            <span className="text-sm font-bold b-text min-w-[20px] text-center">{qty}</span>
            <button onClick={temOpcoes ? onOpen : onAdd} className="size-8 flex items-center justify-center b-text rounded-lg active:bg-zinc-100">
              <Plus className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Modal de produto estilo Menu Dino ─── */
function ProductModal({ product: p, cartQty, fmt, onClose, onAdd }: {
  product: any; cartQty: number; fmt: (v: number) => string;
  onClose: () => void; onAdd: (qty: number, opcoes: OpcaoSelecionada[]) => void;
}) {
  const [qty, setQty] = useState(Math.max(1, cartQty));
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});
  const precoBase = Number(p.preco_promocional ?? p.preco);

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-opcoes", p.id],
    queryFn: async () =>
      (await (supabase.from("grupos_opcoes") as any).select("*, opcoes(*)").eq("produto_id", p.id).order("ordem")).data ?? [],
  });

  // Preço total com adicionais
  const precoAdicionais = useMemo(() => {
    let extra = 0;
    grupos.forEach((g: any) => {
      const ids = selecoes[g.id] ?? [];
      ids.forEach((id: string) => {
        const op = g.opcoes?.find((o: any) => o.id === id);
        if (op) extra += Number(op.preco_adicional);
      });
    });
    return extra;
  }, [selecoes, grupos]);

  const precoTotal = (precoBase + precoAdicionais) * qty;

  // Valida obrigatórios
  const obrigatoriosPendentes = grupos.filter((g: any) =>
    g.obrigatorio && (!selecoes[g.id] || selecoes[g.id].length === 0)
  );
  const podAdicionar = obrigatoriosPendentes.length === 0;

  function toggleOpcao(grupoId: string, opcaoId: string, multiplo: boolean, maxEscolhas: number) {
    setSelecoes((prev) => {
      const atual = prev[grupoId] ?? [];
      if (!multiplo) return { ...prev, [grupoId]: [opcaoId] };
      if (atual.includes(opcaoId)) return { ...prev, [grupoId]: atual.filter((id) => id !== opcaoId) };
      if (atual.length >= maxEscolhas) return { ...prev, [grupoId]: [...atual.slice(1), opcaoId] };
      return { ...prev, [grupoId]: [...atual, opcaoId] };
    });
  }

  function buildOpcoesSelecionadas(): OpcaoSelecionada[] {
    const result: OpcaoSelecionada[] = [];
    grupos.forEach((g: any) => {
      const ids = selecoes[g.id] ?? [];
      ids.forEach((id: string) => {
        const op = g.opcoes?.find((o: any) => o.id === id);
        if (op) result.push({ grupoId: g.id, grupoNome: g.nome, opcaoId: op.id, opcaoNome: op.nome, precoAdicional: Number(op.preco_adicional) });
      });
    });
    return result;
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "92dvh" }} onClick={(e) => e.stopPropagation()}>

        {/* Foto */}
        {p.foto_url ? (
          <div className="relative shrink-0">
            <img src={p.foto_url} alt={p.nome} className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-24 bg-zinc-100 flex items-center justify-center shrink-0">
            <ImageIcon className="size-10 text-zinc-300" />
          </div>
        )}

        <button onClick={onClose}
          className="absolute top-3 right-3 size-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10">
          <X className="size-4" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5">
            <h2 className="text-xl font-bold text-zinc-900">{p.nome}</h2>
            {p.descricao && <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{p.descricao}</p>}
            <div className="flex items-center gap-3 mt-3">
              <span className="text-2xl font-bold text-zinc-900">{fmt(precoBase)}</span>
              {p.preco_promocional && (
                <>
                  <span className="text-base text-zinc-400 line-through">{fmt(Number(p.preco))}</span>
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Promoção</span>
                </>
              )}
            </div>
          </div>

          {/* Grupos de opções */}
          {grupos.map((g: any) => (
            <div key={g.id} className="border-t border-zinc-100">
              <div className="px-5 py-3 bg-zinc-50 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-900 text-sm">{g.nome}</span>
                  {g.multiplo && <span className="text-xs text-zinc-400 ml-2">Escolha até {g.max_escolhas}</span>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  g.obrigatorio ? "bg-orange-100 text-orange-600" : "bg-zinc-100 text-zinc-400"
                }`}>
                  {g.obrigatorio ? "Obrigatório" : "Opcional"}
                </span>
              </div>
              <div className="divide-y divide-zinc-50">
                {(g.opcoes ?? []).filter((o: any) => o.ativo !== false).map((o: any) => {
                  const selecionado = (selecoes[g.id] ?? []).includes(o.id);
                  return (
                    <button key={o.id}
                      onClick={() => toggleOpcao(g.id, o.id, g.multiplo, g.max_escolhas)}
                      className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${
                        selecionado ? "bg-orange-50" : "hover:bg-zinc-50"
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selecionado ? "b-btn b-border" : "border-zinc-300"
                        }`}>
                          {selecionado && <div className="size-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm text-zinc-800">{o.nome}</span>
                      </div>
                      {Number(o.preco_adicional) > 0 && (
                        <span className="text-sm font-semibold text-green-600">
                          +{fmt(Number(o.preco_adicional))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Contador + botão */}
        <div className="p-5 border-t border-zinc-100 space-y-4 shrink-0 bg-white">
          {obrigatoriosPendentes.length > 0 && (
            <p className="text-xs text-orange-500 font-medium text-center">
              Selecione: {obrigatoriosPendentes.map((g: any) => g.nome).join(", ")}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Quantidade</span>
            <div className="flex items-center gap-4">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}
                className="size-9 rounded-full border-2 b-border b-text flex items-center justify-center disabled:opacity-30">
                <Minus className="size-4" />
              </button>
              <span className="text-xl font-bold text-zinc-900 min-w-[24px] text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)}
                className="size-9 rounded-full b-btn text-white flex items-center justify-center">
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <button onClick={() => podAdicionar && onAdd(qty, buildOpcoesSelecionadas())}
            disabled={!podAdicionar}
            className={`w-full text-white rounded-2xl h-14 flex items-center justify-between px-6 font-bold text-base transition-colors ${
              podAdicionar ? "b-btn" : "bg-zinc-200 cursor-not-allowed"
            }`}>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-sm font-bold">{qty}×</span>
            <span>Adicionar ao carrinho</span>
            <span>{fmt(precoTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Helper ─── */
function FormField({ name, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} defaultValue={defaultValue} className="rounded-xl h-12 text-base" />
    </div>
  );
}

/* ─── Campo telefone com auto-formatação ─── */
function TelField({ initialValue }: { initialValue?: string }) {
  function format(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  const [value, setValue] = useState(initialValue ? format(initialValue) : "");

  return (
    <div className="space-y-1.5">
      <Label htmlFor="telefone">Telefone / WhatsApp</Label>
      <input
        id="telefone"
        name="telefone"
        type="tel"
        inputMode="numeric"
        required
        value={value}
        onChange={(e) => setValue(format(e.target.value))}
        placeholder="(11) 99999-9999"
        className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
      />
    </div>
  );
}

/* ─── Campo CEP com auto-fill ViaCEP ─── */
function CepField({ cep, onCepChange, onCidadeChange, onLoadingChange, brandColor }: {
  cep: string;
  onCepChange: (v: string) => void;
  onCidadeChange: (v: string) => void;
  onLoadingChange?: (v: boolean) => void;
  brandColor: string;
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState("");
  const cidadeRef = useRef<HTMLInputElement>(null);

  function formatCep(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function buscarCep(valor: string) {
    const digits = valor.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoading(true); onLoadingChange?.(true); setErro("");
    let cidade = "";
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) cidade = `${data.localidade}/${data.uf}`;
    } catch { /* tenta BrasilAPI abaixo */ }
    if (!cidade) {
      try {
        const res  = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
        if (res.ok) {
          const data = await res.json();
          if (data.city) cidade = `${data.city}/${data.state}`;
        }
      } catch { /* sem fallback */ }
    }
    if (cidade) {
      onCidadeChange(cidade);
      if (cidadeRef.current) cidadeRef.current.value = cidade;
    } else {
      setErro("CEP não encontrado. Preencha a cidade manualmente.");
    }
    setLoading(false);
    onLoadingChange?.(false);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <Label>CEP</Label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => {
              const v = formatCep(e.target.value);
              onCepChange(v);
              if (v.replace(/\D/g,"").length === 8) buscarCep(v);
            }}
            className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          )}
        </div>
        {erro && <p className="text-xs text-red-500">{erro}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Cidade</Label>
        <input
          ref={cidadeRef}
          type="text"
          placeholder="Preenchida pelo CEP"
          autoComplete="off"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value.replace(/[0-9]/g, "");
            e.target.value = v;
            onCidadeChange(v);
          }}
          className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          style={{ "--tw-ring-color": brandColor } as any}
        />
      </div>
    </div>
  );
}

/* ─── Campo CPF com formatação ─── */
function CpfField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function formatCpf(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }

  const digits = value.replace(/\D/g, "");
  const valido = digits.length === 0 || digits.length === 11;

  return (
    <div className="space-y-1.5">
      <Label>CPF <span className="text-zinc-400 font-normal">(opcional)</span></Label>
      <input
        type="text"
        inputMode="numeric"
        placeholder="000.000.000-00"
        value={value}
        onChange={(e) => onChange(formatCpf(e.target.value))}
        className={`w-full h-12 rounded-xl border bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/40 ${
          !valido ? "border-red-300" : "border-zinc-200"
        }`}
      />
      {!valido
        ? <p className="text-xs text-red-500">CPF incompleto.</p>
        : <p className="text-xs text-zinc-400">Informe seu CPF para incluir na nota fiscal do pedido.</p>
      }
    </div>
  );
}

/* ─── Campo de endereço com captura de GPS ─── */
function AddressField({ brandColor, onCapture, defaultValue }: {
  brandColor: string;
  onCapture: (lat: number, lng: number) => void;
  defaultValue?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState("");
  const [capturado, setCapturado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultValue && inputRef.current) inputRef.current.value = defaultValue;
  }, []);

  async function usarGps() {
    if (!navigator.geolocation) { setErro("GPS não disponível neste dispositivo."); return; }
    setLoading(true); setErro(""); setCapturado(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onCapture(latitude, longitude);
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": "DeliverlyHub/1.0" } }
          );
          const data = await res.json();
          const a    = data.address ?? {};
          const partes = [
            a.road ? (a.house_number ? `${a.road}, ${a.house_number}` : a.road) : null,
            a.suburb ?? a.neighbourhood ?? a.quarter ?? null,
            a.city ?? a.town ?? a.village ?? a.municipality ?? null,
          ].filter(Boolean);
          const addr = partes.length >= 2
            ? partes.join(", ")
            : (data.display_name ?? "").split(",").slice(0, 3).join(",").trim();
          if (addr && inputRef.current) {
            inputRef.current.value = addr;
            setCapturado(true);
          } else {
            if (inputRef.current) inputRef.current.value = "";
            setErro("GPS captado, mas endereço não identificado. Digite o endereço manualmente.");
          }
        } catch {
          if (inputRef.current) inputRef.current.value = "";
          setErro("Não foi possível converter a localização. Digite o endereço manualmente.");
        }
        setLoading(false);
      },
      (err) => {
        setErro(err.code === 1 ? "Permissão de GPS negada. Digite o endereço manualmente." : "Não foi possível obter localização.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="endereco">Endereço de entrega</Label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="endereco"
          name="endereco"
          required
          placeholder="Rua, número, bairro"
          className="flex-1 h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
        />
        <button
          type="button"
          onClick={usarGps}
          disabled={loading}
          title="Usar minha localização GPS"
          className={`h-12 px-3 rounded-xl border transition-colors disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
            capturado
              ? "bg-green-50 border-green-300 text-green-600"
              : "border-zinc-200 text-zinc-500 hover:text-orange-500 hover:border-orange-300"
          }`}
        >
          {loading
            ? <span className="size-4 block rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <LocateFixed className="size-4" />
          }
          <span>{capturado ? "✓ GPS" : "📍 GPS"}</span>
        </button>
      </div>
      {capturado && (
        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
          ✓ Localização GPS capturada
        </p>
      )}
      {erro && <p className="text-xs text-red-500">{erro}</p>}
    </div>
  );
}

/* ─── PIX BR Code (EMV) ─── */
function normalizarChavePix(chave: string, tipo: string): string {
  const c = chave.trim();
  if (tipo === "telefone") {
    const d = c.replace(/\D/g, "");
    return d.startsWith("55") ? `+${d}` : `+55${d}`;
  }
  if (tipo === "cpf" || tipo === "cnpj") return c.replace(/\D/g, "");
  if (tipo === "email") return c.toLowerCase();
  return c; // aleatoria (UUID) — mantém case original
}
function crc16(str: string): number {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
    }
    crc &= 0xFFFF;
  }
  return crc;
}

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

function gerarPixPayload(chave: string, nome: string, cidade: string, valor: number): string {
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", chave);
  const adf = tlv("05", "PEDIDO");
  const payload = [
    tlv("00", "01"),
    tlv("26", mai),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("54", valor.toFixed(2)),
    tlv("58", "BR"),
    tlv("59", nome),
    tlv("60", cidade),
    tlv("62", adf),
    "6304",
  ].join("");
  const crc = crc16(payload).toString(16).toUpperCase().padStart(4, "0");
  return payload + crc;
}
