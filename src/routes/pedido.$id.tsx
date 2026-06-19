import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, ChefHat, Bike, XCircle, MapPin, MessageCircle, User, Copy, Navigation } from "lucide-react";
import QRCode from "qrcode";
import { copiarTexto } from "@/lib/validacoes";
import { toast } from "sonner";

const MapaEntrega = lazy(() => import("@/components/MapaEntrega"));

export const Route = createFileRoute("/pedido/$id")({
  ssr: false,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_itens(*), empresas(nome_fantasia,whatsapp,logo_url,chave_pix,tipo_chave_pix,nome_recebedor,cidade_recebedor,slug)")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) throw notFound();
    return data;
  },
  component: PedidoTracking,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
      Pedido não encontrado.
    </div>
  ),
});

const ETAPAS_AUTO = [
  { status: "novo",       label: "Pedido recebido",     icon: CheckCircle2, desc: "Aguardando confirmação do estabelecimento" },
  { status: "aceito",     label: "Confirmado",           icon: CheckCircle2, desc: "O estabelecimento confirmou seu pedido" },
  { status: "preparo",    label: "Em preparo",           icon: ChefHat,      desc: "Seu pedido está sendo preparado" },
  { status: "entrega",    label: "Saiu para entrega",    icon: Bike,         desc: "O entregador está a caminho" },
  { status: "finalizado", label: "Entregue!",            icon: CheckCircle2, desc: "Pedido entregue. Bom apetite!" },
];
const ORDEM_AUTO = ["novo","aceito","preparo","entrega","finalizado"];

const ETAPAS_MANUAL = [
  { status: "aguardando_confirmacao", label: "Pedido enviado",       icon: Clock,        desc: "Aguardando análise do estabelecimento" },
  { status: "aguardando_pagamento",   label: "Confirmado — pague",   icon: CheckCircle2, desc: "Estabelecimento confirmou. Realize o pagamento." },
  { status: "aceito",                 label: "Pagamento recebido",   icon: CheckCircle2, desc: "Pagamento confirmado. Preparando seu pedido!" },
  { status: "preparo",                label: "Em preparo",           icon: ChefHat,      desc: "Seu pedido está sendo preparado" },
  { status: "entrega",                label: "Saiu para entrega",    icon: Bike,         desc: "O entregador está a caminho" },
  { status: "finalizado",             label: "Entregue!",            icon: CheckCircle2, desc: "Pedido entregue. Bom apetite!" },
];
const ORDEM_MANUAL = ["aguardando_confirmacao","aguardando_pagamento","aceito","preparo","entrega","finalizado"];

const ETAPAS_LOCAL = [
  { status: "novo",       label: "Pedido recebido",  icon: CheckCircle2, desc: "Aguardando confirmação do estabelecimento" },
  { status: "aceito",     label: "Confirmado",        icon: CheckCircle2, desc: "O estabelecimento confirmou seu pedido" },
  { status: "preparo",    label: "Em preparo",        icon: ChefHat,      desc: "Seu pedido está sendo preparado" },
  { status: "finalizado", label: "Pronto!",           icon: CheckCircle2, desc: "Seu pedido está pronto. Bom apetite!" },
];
const ORDEM_LOCAL = ["novo","aceito","preparo","finalizado"];

const MANUAL_STATUSES = ["aguardando_confirmacao", "aguardando_pagamento"];

// ── PIX helpers ──────────────────────────────────────────────────────────────
function normalizarChavePix(chave: string, tipo: string): string {
  const c = chave.trim();
  if (tipo === "telefone") {
    const d = c.replace(/\D/g, "");
    return d.startsWith("55") ? `+${d}` : `+55${d}`;
  }
  if (tipo === "cpf" || tipo === "cnpj") return c.replace(/\D/g, "");
  if (tipo === "email") return c.toLowerCase();
  return c; // aleatoria (UUID)
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
    tlv("00", "01"), tlv("26", mai), tlv("52", "0000"), tlv("53", "986"),
    tlv("54", valor.toFixed(2)), tlv("58", "BR"), tlv("59", nome),
    tlv("60", cidade), tlv("62", adf), "6304",
  ].join("");
  const crc = crc16(payload).toString(16).toUpperCase().padStart(4, "0");
  return payload + crc;
}
// ─────────────────────────────────────────────────────────────────────────────

function PedidoTracking() {
  const pedidoInicial = Route.useLoaderData();
  const [pedido, setPedido] = useState<any>(pedidoInicial);
  const [notaHover, setNotaHover] = useState(0);
  const [notaSel, setNotaSel] = useState(0);
  const [comentario, setComentario] = useState("");
  const [avaliando, setAvaliando] = useState(false);
  const [avaliado, setAvaliado] = useState(false);
  const [pixData, setPixData] = useState<{ payload: string; qrUrl: string; total: number } | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  // Inicia como "já compartilhou" se o pedido já tem lat/lng do cliente no banco
  const [localizacaoCompartilhada, setLocalizacaoCompartilhada] = useState(
    pedidoInicial.cliente_lat != null
  );
  const [entregadorPos, setEntregadorPos] = useState<{ lat: number; lng: number; nome: string | null } | null>(null);
  const [gpsHora, setGpsHora] = useState<string | null>(null);
  const locIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const empresa = pedido.empresas as any;
  const pedidoRef  = useRef(pedido);
  const pixDataRef = useRef(pixData);
  useEffect(() => { pedidoRef.current  = pedido;  }, [pedido]);
  useEffect(() => { pixDataRef.current = pixData; }, [pixData]);

  const aplicarAtualizacao = useCallback(async (novoStatus: string, dadosExtras: any = {}) => {
    setPedido((prev: any) => {
      const atualizado = { ...prev, ...dadosExtras, status: novoStatus };
      pedidoRef.current = atualizado;
      return atualizado;
    });
    if (novoStatus === "aguardando_pagamento" && !pixDataRef.current) {
      await gerarPix({ ...pedidoRef.current, status: novoStatus, ...dadosExtras });
      toast.success("Pedido confirmado! Realize o pagamento via PIX.");
    }
  }, []); // eslint-disable-line

  async function gerarPix(p: any) {
    // empresa pode ser null (RLS bloqueia JOIN para anon) — tenta sessionStorage como fallback
    let emp = empresa as any;
    if (!emp?.chave_pix) {
      try {
        const cached = sessionStorage.getItem(`pix_empresa_${p.id}`);
        if (cached) emp = JSON.parse(cached);
      } catch {}
    }
    const chaveRaw = emp?.chave_pix as string | null;
    if (!chaveRaw) return;
    const chave = normalizarChavePix(chaveRaw.trim(), emp?.tipo_chave_pix ?? "aleatoria");
    const desc = Number(p.desconto ?? 0);
    const total = Math.max(0, Number(p.subtotal) + Number(p.taxa_entrega) - desc);
    const nomeRec   = (emp?.nome_recebedor || emp?.nome_fantasia || "Loja").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").substring(0, 25).trim() || "Loja";
    const cidadeRec = (emp?.cidade_recebedor || "Brasil").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").substring(0, 15).trim() || "Brasil";
    const payload = gerarPixPayload(chave, nomeRec, cidadeRec, total);
    try {
      const qrUrl = await QRCode.toDataURL(payload, { width: 240, margin: 2, color: { dark: "#18181b", light: "#ffffff" } });
      setPixData({ payload, qrUrl, total });
    } catch {}
  }

  function enviarPosicaoCliente() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await (supabase as any).rpc("cliente_atualizar_localizacao", {
          p_pedido_id: pedidoRef.current.id,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  function iniciarCompartilhamento() {
    if (locIntervalRef.current) return;
    locIntervalRef.current = setInterval(enviarPosicaoCliente, 30000);
  }

  function pararCompartilhamento() {
    if (locIntervalRef.current) { clearInterval(locIntervalRef.current); locIntervalRef.current = null; }
  }

  async function compartilharLocalizacao() {
    if (!navigator.geolocation) { toast.error("GPS não disponível neste dispositivo."); return; }
    setCompartilhando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await (supabase as any).rpc("cliente_atualizar_localizacao", {
          p_pedido_id: pedido.id,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
        });
        setLocalizacaoCompartilhada(true);
        setCompartilhando(false);
        toast.success("Localização compartilhada! Atualizando a cada 30s.");
        iniciarCompartilhamento();
      },
      () => {
        setCompartilhando(false);
        toast.error("Não foi possível obter sua localização. Verifique as permissões.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Gera PIX se já chegou com status aguardando_pagamento
  useEffect(() => {
    if (pedido.status === "aguardando_pagamento" && !pixData) {
      gerarPix(pedido);
    }
  }, []);

  // Realtime — caminho rápido (pode não funcionar para usuários anônimos por RLS)
  useEffect(() => {
    const channel = supabase
      .channel(`tracking-${pedido.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pedido.id}` },
        async (payload) => {
          if (payload.new.status !== pedidoRef.current.status) {
            await aplicarAtualizacao(payload.new.status, payload.new);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pedido.id, aplicarAtualizacao]);

  // Polling — fallback garantido a cada 5s (funciona mesmo sem realtime)
  useEffect(() => {
    const FINAIS = ["finalizado", "cancelado"];
    if (FINAIS.includes(pedido.status)) return;

    const interval = setInterval(async () => {
      const curr = pedidoRef.current;
      if (FINAIS.includes(curr.status)) { clearInterval(interval); return; }

      const { data } = await (supabase as any)
        .from("pedidos")
        .select("status")
        .eq("id", curr.id)
        .maybeSingle();

      if (data && data.status !== curr.status) {
        await aplicarAtualizacao(data.status, data);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pedido.id, aplicarAtualizacao]);

  // Compartilhamento contínuo do GPS do cliente
  // — retoma no F5 se já tinha compartilhado, para quando entregue/cancelado
  useEffect(() => {
    if (pedido.status === "entrega" && pedidoInicial.cliente_lat != null) {
      iniciarCompartilhamento();
    } else {
      pararCompartilhamento();
    }
    return () => pararCompartilhamento();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.status]);

  // Polling do GPS do entregador — só quando status = "entrega"
  useEffect(() => {
    if (pedido.status !== "entrega") return;

    async function buscarGps() {
      const { data } = await (supabase as any).rpc("pedido_rastrear_entregador", {
        p_pedido_id: pedido.id,
      });
      if (data?.gps_ativo) {
        setEntregadorPos({ lat: data.lat, lng: data.lng, nome: data.nome ?? null });
        setGpsHora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    }

    buscarGps();
    const interval = setInterval(buscarGps, 20000);
    return () => clearInterval(interval);
  }, [pedido.status, pedido.id]);

  async function enviarAvaliacao() {
    if (!notaSel) return;
    setAvaliando(true);
    const { error } = await supabase.from("avaliacoes").insert({
      pedido_id: pedido.id,
      empresa_id: pedido.empresa_id,
      nota: notaSel,
      comentario: comentario.trim() || null,
      cliente_nome: pedido.cliente_nome,
    });
    setAvaliando(false);
    if (error) {
      if (error.code === "23505") {
        setAvaliado(true); // já avaliado (constraint única)
        return;
      }
      toast.error("Não foi possível enviar a avaliação. Tente novamente.");
      return;
    }
    setAvaliado(true);
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const cancelado  = pedido.status === "cancelado";
  const finalizado = pedido.status === "finalizado";
  const isLocal    = !!pedido.mesa;
  const isManual   = MANUAL_STATUSES.includes(pedido.status) || (pedido.status === "aceito" && !pedido.mesa && false); // detecta pelo status inicial

  // fluxo_pedido="manual" salvo no banco — não depende do status atual
  const fluxoManual = pedido.fluxo_pedido === "manual" || MANUAL_STATUSES.includes(pedido.status);

  const etapas = isLocal ? ETAPAS_LOCAL : fluxoManual ? ETAPAS_MANUAL : ETAPAS_AUTO;
  const ordem  = isLocal ? ORDEM_LOCAL  : fluxoManual ? ORDEM_MANUAL  : ORDEM_AUTO;
  const idxAtual = ordem.indexOf(pedido.status);

  const desconto = Number(pedido.desconto ?? 0);
  // subtotal + taxa_entrega são sempre os valores brutos; desconto é o desconto vigente.
  // Não usar pedido.total porque ele já foi gravado com desconto deduzido pelo RPC,
  // mas o campo desconto pode ser sobrescrito manualmente pelo dono depois.
  const totalFinal = Math.max(0, Number(pedido.subtotal) + Number(pedido.taxa_entrega) - desconto);

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          {empresa?.logo_url && (
            <img src={empresa.logo_url} alt={empresa.nome_fantasia}
              className="size-10 rounded-xl object-cover" />
          )}
          <div>
            <div className="text-xs text-zinc-400">Acompanhamento do pedido</div>
            <div className="font-bold text-zinc-900">{empresa?.nome_fantasia}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-zinc-400">Pedido</div>
            <div className="font-bold text-brand text-lg">#{pedido.numero}</div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Status cancelado */}
        {cancelado && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
            <XCircle className="size-10 text-red-500 shrink-0" />
            <div>
              <div className="font-bold text-red-700 text-lg">Pedido cancelado</div>
              <div className="text-sm text-red-500 mt-0.5">Entre em contato com o estabelecimento para mais informações.</div>
            </div>
          </div>
        )}

        {/* PIX — aparece quando aguardando_pagamento */}
        {pedido.status === "aguardando_pagamento" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <div className="size-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">💸</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900">Pague via PIX</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-1">Pedido #{pedido.numero}</p>
            {desconto > 0 ? (
              <div className="mb-4">
                <p className="text-sm line-through text-zinc-400">{fmt(Number(pedido.subtotal) + Number(pedido.taxa_entrega))}</p>
                <p className="text-2xl font-black text-green-600">{fmt(totalFinal)}</p>
                <p className="text-xs text-green-600 font-medium">🎁 Desconto de {fmt(desconto)} aplicado!</p>
              </div>
            ) : (
              <p className="text-2xl font-black text-zinc-900 mb-4">{fmt(totalFinal)}</p>
            )}

            {pixData ? (
              <>
                <div className="flex justify-center mb-4">
                  <img src={pixData.qrUrl} alt="QR Code PIX" className="size-48 rounded-2xl border border-zinc-100 shadow-sm" />
                </div>
                <p className="text-xs text-zinc-500 mb-2 font-medium">Ou copie o código:</p>
                <div className="flex gap-2 mb-4">
                  <input readOnly value={pixData.payload}
                    className="flex-1 text-[10px] font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-600 truncate focus:outline-none" />
                  <button
                    onClick={async () => { await copiarTexto(pixData.payload) ? toast.success("Código PIX copiado!") : toast.error("Não foi possível copiar."); }}
                    className="shrink-0 px-3 py-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="py-6 text-zinc-400 text-sm text-center space-y-2">
                <span className="block text-2xl animate-spin">⟳</span>
                <p>Gerando QR Code…</p>
                {empresa?.whatsapp && (
                  <p className="text-xs">Se demorar, <a href={`https://wa.me/${empresa.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-green-600 underline">fale com o estabelecimento</a> para receber o PIX.</p>
                )}
              </div>
            )}

            {empresa?.whatsapp && (
              <a href={`https://wa.me/${empresa.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá! Realizei o pagamento do pedido #${pedido.numero}`)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white rounded-xl h-10 text-sm font-semibold transition-colors mt-2">
                <MessageCircle className="size-4" /> Avisar que paguei
              </a>
            )}
          </div>
        )}

        {/* Aguardando confirmação */}
        {pedido.status === "aguardando_confirmacao" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <div className="size-14 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl animate-pulse">⏳</span>
            </div>
            <h3 className="text-base font-bold text-zinc-900">Pedido recebido!</h3>
            <p className="text-sm text-zinc-500 mt-1">Aguardando confirmação do estabelecimento.</p>
            <p className="text-xs text-zinc-400 mt-1">O valor poderá ser ajustado antes da confirmação.</p>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <span className="size-2 rounded-full bg-zinc-300 animate-pulse" />
              <span className="size-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:200ms]" />
              <span className="size-2 rounded-full bg-zinc-300 animate-pulse [animation-delay:400ms]" />
            </div>
          </div>
        )}

        {/* Progresso */}
        {!cancelado && pedido.status !== "aguardando_confirmacao" && pedido.status !== "aguardando_pagamento" && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-5">Status do pedido</h2>
            <div className="space-y-0">
              {etapas.map((etapa, i) => {
                const concluido = idxAtual > i;
                const atual     = idxAtual === i;
                const Icon      = etapa.icon;
                const ultimo    = i === etapas.length - 1;

                return (
                  <div key={etapa.status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`size-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        concluido ? "bg-green-500 text-white" :
                        atual     ? "bg-brand text-white ring-4 ring-brand/20" :
                                    "bg-zinc-100 text-zinc-300"
                      }`}>
                        {concluido ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                      </div>
                      {!ultimo && (
                        <div className={`w-0.5 flex-1 my-1 min-h-[24px] rounded-full transition-all ${concluido ? "bg-green-400" : "bg-zinc-200"}`} />
                      )}
                    </div>
                    <div className="pb-5 min-w-0">
                      <div className={`font-semibold text-sm ${concluido ? "text-green-600" : atual ? "text-zinc-900" : "text-zinc-400"}`}>
                        {etapa.label}
                        {atual && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-brand text-white px-2 py-0.5 rounded-full animate-pulse">
                            <Clock className="size-2.5" /> Agora
                          </span>
                        )}
                      </div>
                      {(atual || concluido) && (
                        <div className={`text-xs mt-0.5 ${concluido ? "text-green-500" : "text-zinc-400"}`}>
                          {etapa.desc}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumo do pedido */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Resumo</h2>
          <div className="space-y-2 mb-3">
            {(pedido.pedido_itens ?? []).map((i: any) => (
              <div key={i.id} className="flex justify-between text-sm text-zinc-700">
                <span>{i.quantidade}× {i.nome}</span>
                <span className="font-medium">{fmt(Number(i.subtotal))}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span>{fmt(Number(pedido.subtotal))}</span>
            </div>
            {Number(pedido.taxa_entrega) > 0 && (
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Taxa de entrega</span>
                <span>{fmt(Number(pedido.taxa_entrega))}</span>
              </div>
            )}
            {desconto > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Desconto</span>
                <span>-{fmt(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-zinc-900 pt-1">
              <span>Total</span>
              <span>{fmt(totalFinal)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-zinc-400 space-y-1">
            {isLocal ? (
              <div className="flex items-center gap-1.5 text-amber-600 font-medium">🪑 {pedido.mesa}</div>
            ) : pedido.cliente_endereco && (
              <div className="flex items-center gap-1.5"><MapPin className="size-3" /> {pedido.cliente_endereco}</div>
            )}
            <div>Pagamento: {pedido.forma_pagamento}</div>
            {pedido.entregador_nome && (
              <div className="flex items-center gap-1.5 text-purple-600 font-medium">
                <User className="size-3" /> Entregador: {pedido.entregador_nome}
              </div>
            )}
            {pedido.observacao && <div className="italic">"{pedido.observacao}"</div>}
          </div>
        </div>

        {/* Rastreamento do entregador em tempo real */}
        {pedido.status === "entrega" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Cabeçalho */}
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-zinc-900">
                  {entregadorPos?.nome
                    ? `${entregadorPos.nome} está a caminho`
                    : "Entregador a caminho"}
                </span>
              </div>
              {gpsHora && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1 shrink-0">
                  <Navigation className="size-3" /> {gpsHora}
                </span>
              )}
            </div>

            {/* Mapa */}
            {entregadorPos ? (
              <Suspense fallback={
                <div className="flex items-center justify-center bg-zinc-50" style={{ height: 240 }}>
                  <span className="text-xs text-zinc-400">Carregando mapa…</span>
                </div>
              }>
                <MapaEntrega
                  clienteLat={pedido.cliente_lat}
                  clienteLng={pedido.cliente_lng}
                  clienteNome={pedido.cliente_nome}
                  entregadorLat={entregadorPos.lat}
                  entregadorLng={entregadorPos.lng}
                  entregadorNome={entregadorPos.nome ?? "Entregador"}
                  height={240}
                />
              </Suspense>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 bg-zinc-50 py-8">
                <Bike className="size-8 text-zinc-200" />
                <p className="text-sm font-medium">Aguardando GPS do entregador…</p>
                <p className="text-xs text-zinc-300 text-center max-w-[24ch]">O entregador precisa ativar o compartilhamento de localização.</p>
              </div>
            )}

            {/* Compartilhar localização */}
            <div className="px-4 py-3 border-t border-zinc-100">
              <p className="text-xs text-zinc-400 mb-2">Compartilhe sua localização para o entregador te encontrar:</p>
              {localizacaoCompartilhada ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                  <CheckCircle2 className="size-4" /> Localização compartilhada!
                </div>
              ) : (
                <button
                  onClick={compartilharLocalizacao}
                  disabled={compartilhando}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl h-10 font-semibold text-sm transition-colors disabled:opacity-60">
                  {compartilhando
                    ? <><span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Obtendo localização…</>
                    : <><MapPin className="size-4" /> Compartilhar minha localização</>
                  }
                </button>
              )}
            </div>
          </div>
        )}

        {/* Botão WhatsApp */}
        {empresa?.whatsapp && pedido.status !== "aguardando_pagamento" && (
          <a href={`https://wa.me/${empresa.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pedido #${pedido.numero}`)}`}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl h-12 font-semibold transition-colors">
            <MessageCircle className="size-5" /> Falar com o estabelecimento
          </a>
        )}

        {/* Avaliação */}
        {finalizado && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            {avaliado ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">⭐</div>
                <div className="font-bold text-zinc-900">Obrigado pela avaliação!</div>
                <div className="text-sm text-zinc-400 mt-1">Sua opinião é muito importante para nós.</div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-zinc-900 mb-1">Como foi sua experiência?</h3>
                <p className="text-xs text-zinc-400 mb-4">Avalie o pedido #{pedido.numero}</p>
                <div className="flex gap-2 justify-center mb-4">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n}
                      onMouseEnter={() => setNotaHover(n)} onMouseLeave={() => setNotaHover(0)}
                      onClick={() => setNotaSel(n)}
                      className="text-4xl transition-transform hover:scale-110 active:scale-95">
                      {n <= (notaHover || notaSel) ? "⭐" : "☆"}
                    </button>
                  ))}
                </div>
                {notaSel > 0 && (
                  <>
                    <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
                      placeholder="Deixe um comentário (opcional)..." rows={3}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/40 mb-3" />
                    <button onClick={enviarAvaliacao} disabled={avaliando}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-11 font-semibold transition-colors disabled:opacity-50">
                      {avaliando ? "Enviando..." : "Enviar avaliação"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
