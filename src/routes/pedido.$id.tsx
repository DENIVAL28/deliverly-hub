import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, ChefHat, Bike, XCircle, MapPin, MessageCircle, User } from "lucide-react";

export const Route = createFileRoute("/pedido/$id")({
  ssr: false,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_itens(*), empresas(nome_fantasia,whatsapp,logo_url)")
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

const ETAPAS = [
  { status: "novo",       label: "Pedido recebido",     icon: CheckCircle2, desc: "Aguardando confirmação do estabelecimento" },
  { status: "aceito",     label: "Confirmado",           icon: CheckCircle2, desc: "O estabelecimento confirmou seu pedido" },
  { status: "preparo",    label: "Em preparo",           icon: ChefHat,      desc: "Seu pedido está sendo preparado" },
  { status: "entrega",    label: "Saiu para entrega",    icon: Bike,         desc: "O entregador está a caminho" },
  { status: "finalizado", label: "Entregue!",            icon: CheckCircle2, desc: "Pedido entregue. Bom apetite!" },
];
const ORDEM = ["novo","aceito","preparo","entrega","finalizado"];

// Pedido local (mesa): sem etapa de entrega
const ETAPAS_LOCAL = [
  { status: "novo",       label: "Pedido recebido",  icon: CheckCircle2, desc: "Aguardando confirmação do estabelecimento" },
  { status: "aceito",     label: "Confirmado",        icon: CheckCircle2, desc: "O estabelecimento confirmou seu pedido" },
  { status: "preparo",    label: "Em preparo",        icon: ChefHat,      desc: "Seu pedido está sendo preparado" },
  { status: "finalizado", label: "Pronto!",           icon: CheckCircle2, desc: "Seu pedido está pronto. Bom apetite!" },
];
const ORDEM_LOCAL = ["novo","aceito","preparo","finalizado"];

function PedidoTracking() {
  const pedidoInicial = Route.useLoaderData();
  const [pedido, setPedido] = useState<any>(pedidoInicial);
  const [notaHover, setNotaHover] = useState(0);
  const [notaSel, setNotaSel] = useState(0);
  const [comentario, setComentario] = useState("");
  const [avaliando, setAvaliando] = useState(false);
  const [avaliado, setAvaliado] = useState(false);

  // Realtime — atualiza status sem precisar recarregar
  useEffect(() => {
    const channel = supabase
      .channel(`tracking-${pedido.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pedido.id}` },
        (payload) => setPedido((prev: any) => ({ ...prev, ...payload.new }))
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pedido.id]);

  async function enviarAvaliacao() {
    if (!notaSel) return;
    setAvaliando(true);
    await supabase.from("avaliacoes" as any).insert({
      pedido_id: pedido.id,
      empresa_id: pedido.empresa_id,
      nota: notaSel,
      comentario: comentario.trim() || null,
      cliente_nome: pedido.cliente_nome,
    });
    setAvaliando(false);
    setAvaliado(true);
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const empresa = pedido.empresas as any;
  const cancelado = pedido.status === "cancelado";
  const finalizado = pedido.status === "finalizado";
  const isLocal = !!pedido.mesa;
  const etapas = isLocal ? ETAPAS_LOCAL : ETAPAS;
  const ordem  = isLocal ? ORDEM_LOCAL  : ORDEM;
  const idxAtual = ordem.indexOf(pedido.status);

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

        {/* Progresso */}
        {!cancelado && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-5">Status do pedido</h2>
            <div className="space-y-0">
              {etapas.map((etapa, i) => {
                const concluido = idxAtual > i;
                const atual     = idxAtual === i;
                const futuro    = idxAtual < i;
                const Icon      = etapa.icon;
                const ultimo    = i === etapas.length - 1;

                return (
                  <div key={etapa.status} className="flex gap-4">
                    {/* Linha + ícone */}
                    <div className="flex flex-col items-center">
                      <div className={`size-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        concluido ? "bg-green-500 text-white" :
                        atual     ? "bg-brand text-white ring-4 ring-brand/20" :
                                    "bg-zinc-100 text-zinc-300"
                      }`}>
                        {concluido ? (
                          <CheckCircle2 className="size-5" />
                        ) : (
                          <Icon className="size-5" />
                        )}
                      </div>
                      {!ultimo && (
                        <div className={`w-0.5 flex-1 my-1 min-h-[24px] rounded-full transition-all ${
                          concluido ? "bg-green-400" : "bg-zinc-200"
                        }`} />
                      )}
                    </div>

                    {/* Texto */}
                    <div className={`pb-5 min-w-0 ${ultimo ? "" : ""}`}>
                      <div className={`font-semibold text-sm ${
                        concluido ? "text-green-600" :
                        atual     ? "text-zinc-900" :
                                    "text-zinc-400"
                      }`}>
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
            <div className="flex justify-between font-bold text-base text-zinc-900 pt-1">
              <span>Total</span>
              <span>{fmt(Number(pedido.total))}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-zinc-400 space-y-1">
            {isLocal ? (
              <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                🪑 {pedido.mesa}
              </div>
            ) : pedido.cliente_endereco && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3" /> {pedido.cliente_endereco}
              </div>
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

        {/* Botão WhatsApp */}
        {empresa?.whatsapp && (
          <a
            href={`https://wa.me/${empresa.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pedido #${pedido.numero}`)}`}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl h-12 font-semibold transition-colors"
          >
            <MessageCircle className="size-5" /> Falar com o estabelecimento
          </a>
        )}

        {/* Avaliação — só aparece quando finalizado */}
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

                {/* Estrelas */}
                <div className="flex gap-2 justify-center mb-4">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n}
                      onMouseEnter={() => setNotaHover(n)}
                      onMouseLeave={() => setNotaHover(0)}
                      onClick={() => setNotaSel(n)}
                      className="text-4xl transition-transform hover:scale-110 active:scale-95">
                      {n <= (notaHover || notaSel) ? "⭐" : "☆"}
                    </button>
                  ))}
                </div>

                {notaSel > 0 && (
                  <>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Deixe um comentário (opcional)..."
                      rows={3}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/40 mb-3"
                    />
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
