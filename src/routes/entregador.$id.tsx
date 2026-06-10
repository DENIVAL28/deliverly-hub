import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, CheckCircle2, Clock, MapPin, Navigation, Package, Phone } from "lucide-react";

export const Route = createFileRoute("/entregador/$id")({
  ssr: false,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("entregadores" as any)
      .select("*, empresas(nome_fantasia, logo_url, cor_primaria)")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) throw notFound();
    return data as any;
  },
  component: EntregadorPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
      Entregador não encontrado.
    </div>
  ),
});

const STATUS_OPTIONS = [
  { value: "disponivel",   label: "Disponível",    cor: "bg-green-500",  light: "bg-green-50 border-green-300 text-green-700" },
  { value: "em_rota",      label: "Em rota",        cor: "bg-yellow-500", light: "bg-yellow-50 border-yellow-300 text-yellow-700" },
  { value: "indisponivel", label: "Indisponível",   cor: "bg-red-500",    light: "bg-red-50 border-red-300 text-red-700" },
];

const STATUS_PEDIDO: Record<string, { label: string; cor: string }> = {
  entrega:    { label: "Em entrega",  cor: "bg-purple-100 text-purple-700" },
  finalizado: { label: "Entregue",    cor: "bg-green-100 text-green-700" },
};

function EntregadorPage() {
  const entregadorInicial = Route.useLoaderData();
  const [entregador, setEntregador] = useState<any>(entregadorInicial);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [atualizando, setAtualizando] = useState(false);

  // GPS tracking
  const [tracking, setTracking]   = useState(false);
  const [gpsErro, setGpsErro]     = useState("");
  const [gpsCarreg, setGpsCarreg] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function formatarErroGps(err: GeolocationPositionError): string {
    if (err.message.toLowerCase().includes("secure"))
      return "GPS requer HTTPS. Em produção funcionará normalmente.";
    if (err.code === err.PERMISSION_DENIED)
      return "Permissão de GPS negada. Verifique as configurações do navegador.";
    return err.message;
  }

  async function enviarPosicao(): Promise<boolean> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await (supabase.from("entregadores" as any) as any)
            .update({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              ultima_localizacao: new Date().toISOString(),
            })
            .eq("id", entregador.id);
          resolve(true);
        },
        (err) => { setGpsErro(formatarErroGps(err)); resolve(false); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function iniciarTracking() {
    if (!navigator.geolocation) { setGpsErro("GPS não disponível neste dispositivo."); return; }
    setGpsErro("");
    setGpsCarreg(true);
    const ok = await enviarPosicao();
    setGpsCarreg(false);
    if (!ok) return;
    setTracking(true);
    intervalRef.current = setInterval(enviarPosicao, 30000);
  }

  function pararTracking() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setTracking(false);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const empresa = entregador.empresas as any;
  const statusAtual = STATUS_OPTIONS.find((s) => s.value === entregador.status) ?? STATUS_OPTIONS[0];

  async function carregarPedidos() {
    const { data } = await supabase
      .from("pedidos")
      .select("id, numero, cliente_nome, cliente_endereco, total, status, created_at")
      .eq("entregador_id" as any, entregador.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setPedidos(data ?? []);
  }

  async function mudarStatus(novoStatus: string) {
    setAtualizando(true);
    await supabase.from("entregadores" as any).update({ status: novoStatus }).eq("id", entregador.id);
    setEntregador((e: any) => ({ ...e, status: novoStatus }));
    setAtualizando(false);
  }

  useEffect(() => {
    carregarPedidos();
    const ch = supabase.channel(`entregador-pedidos-${entregador.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `entregador_id=eq.${entregador.id}` },
        () => carregarPedidos()
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [entregador.id]);

  const pedidosAtivos    = pedidos.filter((p) => p.status === "entrega");
  const pedidosHistorico = pedidos.filter((p) => p.status === "finalizado");
  const totalEntregue    = pedidosHistorico.reduce((s, p) => s + Number(p.total ?? 0), 0);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-zinc-100">

      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-4">
            {empresa?.logo_url ? (
              <img src={empresa.logo_url} alt={empresa.nome_fantasia} className="size-12 rounded-xl object-cover" />
            ) : (
              <div className="size-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Bike className="size-6 text-orange-500" />
              </div>
            )}
            <div>
              <div className="text-xs text-zinc-400">{empresa?.nome_fantasia}</div>
              <div className="text-lg font-bold text-zinc-900">{entregador.nome}</div>
              {entregador.telefone && (
                <a href={`tel:${entregador.telefone}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
                  <Phone className="size-3" /> {entregador.telefone}
                </a>
              )}
            </div>
            {/* Indicador de status */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${statusAtual.cor} ${entregador.status === "disponivel" ? "animate-pulse" : ""}`} />
              <span className="text-xs font-semibold text-zinc-600">{statusAtual.label}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Mudar status */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Meu status</h2>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button key={s.value}
                onClick={() => mudarStatus(s.value)}
                disabled={atualizando}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-semibold text-xs transition-all ${
                  entregador.status === s.value
                    ? `${s.light} border-current`
                    : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-300"
                }`}>
                <span className={`size-3 rounded-full ${s.cor}`} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* GPS Tracking */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Navigation className="size-4" /> Localização GPS
          </h2>
          {tracking ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <span className="size-2.5 rounded-full bg-green-500 animate-pulse" />
                Localização sendo compartilhada
              </div>
              <button onClick={pararTracking}
                className="w-full py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
                Parar compartilhamento
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Compartilhe sua localização para que o restaurante acompanhe suas entregas em tempo real.
              </p>
              <button onClick={iniciarTracking} disabled={gpsCarreg}
                className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {gpsCarreg
                  ? <><span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Obtendo GPS…</>
                  : <><Navigation className="size-4" /> Compartilhar localização</>
                }
              </button>
            </div>
          )}
          {gpsErro && <p className="text-xs text-red-500 mt-2">{gpsErro}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-zinc-900">{pedidosHistorico.length}</div>
            <div className="text-xs text-zinc-400 mt-0.5">Entregas realizadas</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="text-xl font-bold text-zinc-900">{fmt(totalEntregue)}</div>
            <div className="text-xs text-zinc-400 mt-0.5">Total entregue</div>
          </div>
        </div>

        {/* Pedidos em entrega agora */}
        {pedidosAtivos.length > 0 && (
          <div>
            <h2 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-purple-500 animate-pulse" />
              Em entrega agora ({pedidosAtivos.length})
            </h2>
            <div className="space-y-3">
              {pedidosAtivos.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-zinc-900">Pedido #{p.numero}</span>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">Em entrega</span>
                  </div>
                  <div className="text-sm font-semibold text-zinc-800">{p.cliente_nome}</div>
                  {p.cliente_endereco && (
                    <div className="flex items-start gap-1.5 text-xs text-zinc-500 mt-1">
                      <MapPin className="size-3 mt-0.5 shrink-0" />
                      {p.cliente_endereco}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                    <span className="text-sm font-bold text-zinc-900">{fmt(Number(p.total))}</span>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(p.cliente_endereco ?? "")}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                      <MapPin className="size-3" /> Ver no mapa
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pedidosAtivos.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Package className="size-10 text-zinc-200 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Nenhum pedido em entrega no momento.</p>
          </div>
        )}

        {/* Histórico */}
        {pedidosHistorico.length > 0 && (
          <div>
            <h2 className="font-bold text-zinc-900 mb-3">Histórico de entregas</h2>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-zinc-50">
              {pedidosHistorico.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">#{p.numero} — {p.cliente_nome}</div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900">{fmt(Number(p.total))}</span>
                    <CheckCircle2 className="size-4 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
