import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, CheckCircle2, Clock, MapPin, Navigation, Package, Phone, PackageSearch, QrCode, Copy, ChefHat, Store, ChevronLeft } from "lucide-react";
import { copiarTexto } from "@/lib/validacoes";
import { toast } from "sonner";

const MapaEntrega = lazy(() => import("@/components/MapaEntrega"));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Entregador {
  id: string;
  public_token: string;
  nome: string;
  telefone: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  ultima_localizacao: string | null;
  tipo: string | null;
  aprovado: boolean | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  empresas: { nome_fantasia: string; logo_url: string | null; cor_primaria: string | null } | null;
}

interface PedidoDisponivel {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  taxa_entrega: number;
  status: string;
  created_at: string;
}

interface PedidoEntregador {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  taxa_entrega: number;
  status: string;
  created_at: string;
  cliente_lat: number | null;
  cliente_lng: number | null;
  cliente_telefone: string | null;
  empresa_nome: string | null;
}

export const Route = createFileRoute("/entregador/$id")({
  ssr: false,
  head: () => ({
    meta: [{ name: "apple-mobile-web-app-title", content: "Entregador" }],
    links: [
      { rel: "manifest", href: "/manifest-entregador.json" },
      { rel: "apple-touch-icon", href: "/icon-entregador-192.png" },
    ],
  }),
  loader: async ({ params }) => {
    if (!UUID_RE.test(params.id)) throw notFound();
    const { data } = await supabase
      .from("entregadores")
      .select("id, public_token, nome, telefone, status, lat, lng, ultima_localizacao, tipo, aprovado, chave_pix, tipo_chave_pix, empresas(nome_fantasia, logo_url, cor_primaria)")
      .eq("public_token" as never, params.id)
      .maybeSingle();
    if (!data) throw notFound();
    return data as unknown as Entregador;
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

const STATUS_PEDIDO: Record<string, { label: string; cor: string; icon: React.ComponentType<{ className?: string }> }> = {
  aceito:     { label: "Confirmado",        cor: "bg-amber-100 text-amber-700",   icon: CheckCircle2 },
  preparo:    { label: "Em preparo",        cor: "bg-orange-100 text-orange-700", icon: ChefHat },
  entrega:    { label: "Saiu p/ entrega",   cor: "bg-purple-100 text-purple-700", icon: Bike },
  finalizado: { label: "Entregue",          cor: "bg-green-100 text-green-700",   icon: CheckCircle2 },
};

function EntregadorPage() {
  const entregadorInicial = Route.useLoaderData();
  const navigate = useNavigate();
  const [entregador, setEntregador] = useState<Entregador>(entregadorInicial);

  // Salva token no localStorage para o PWA conseguir redirecionar de volta
  useEffect(() => {
    localStorage.setItem("entregador_token", entregadorInicial.public_token);
  }, [entregadorInicial.public_token]);
  const [pedidos, setPedidos] = useState<PedidoEntregador[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const [disponiveis, setDisponiveis] = useState<PedidoDisponivel[]>([]);
  const [pegando, setPegando] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState<string | null>(null);
  const [erroDisponiveis, setErroDisponiveis] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const isFreelancer = entregador.tipo === "freelancer";
  const isFixo       = entregador.tipo === "fixo";

  const [pixKey,     setPixKey]     = useState(entregador.chave_pix ?? "");
  const [pixTipo,    setPixTipo]    = useState(entregador.tipo_chave_pix ?? "aleatoria");
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [pixSalvo,    setPixSalvo]    = useState(false);

  async function salvarPix() {
    if (!pixKey.trim()) { toast.error("Digite sua chave PIX."); return; }
    setSalvandoPix(true);
    const { error } = await (supabase as any).rpc("entregador_atualizar_pix", {
      p_token:          entregador.public_token,
      p_chave_pix:      pixKey.trim(),
      p_tipo_chave_pix: pixTipo,
    });
    setSalvandoPix(false);
    if (error) { toast.error("Erro ao salvar chave PIX."); return; }
    setPixSalvo(true);
    setTimeout(() => setPixSalvo(false), 3000);
    toast.success("Chave PIX salva!");
  }

  // GPS tracking
  const [tracking, setTracking]   = useState(false);
  const [gpsErro, setGpsErro]     = useState("");
  const [gpsCarreg, setGpsCarreg] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(
    entregador.lat != null && entregador.lng != null ? { lat: entregador.lat, lng: entregador.lng } : null
  );

  function formatarErroGps(err: GeolocationPositionError): string {
    if (err.message.toLowerCase().includes("secure"))
      return "GPS requer HTTPS. Em produção funcionará normalmente.";
    if (err.code === err.PERMISSION_DENIED)
      return "Permissão de GPS negada. Verifique as configurações do navegador.";
    if (err.code === err.TIMEOUT)
      return "Tempo esgotado ao obter GPS. Verifique sua conexão e tente novamente.";
    if (err.code === err.POSITION_UNAVAILABLE)
      return "Localização indisponível. Verifique se o GPS está ativado no dispositivo.";
    return "Não foi possível obter o GPS. Tente novamente.";
  }

  async function enviarPosicao(): Promise<boolean> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setGpsErro("");
          await (supabase as any).rpc("entregador_atualizar_gps", {
            p_token: entregador.public_token,
            p_lat:   pos.coords.latitude,
            p_lng:   pos.coords.longitude,
          });
          setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          resolve(true);
        },
        (err) => { setGpsErro(formatarErroGps(err)); resolve(false); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  const GPS_KEY = `gps_tracking_${entregador.public_token}`;

  async function iniciarTracking() {
    if (!navigator.geolocation) { setGpsErro("GPS não disponível neste dispositivo."); return; }
    setGpsErro("");
    setGpsCarreg(true);
    const ok = await enviarPosicao();
    setGpsCarreg(false);
    if (!ok) return;
    setTracking(true);
    localStorage.setItem(GPS_KEY, "1");
    intervalRef.current = setInterval(enviarPosicao, 15000);
  }

  function pararTracking() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setTracking(false);
    localStorage.removeItem(GPS_KEY);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Retoma o tracking automaticamente se estava ativo antes do F5
  useEffect(() => {
    if (localStorage.getItem(GPS_KEY)) iniciarTracking();
  }, []);

  const empresa = entregador.empresas;
  const statusAtual = STATUS_OPTIONS.find((s) => s.value === entregador.status) ?? STATUS_OPTIONS[0];

  async function carregarPedidos() {
    const { data } = await (supabase as any).rpc("entregador_meus_pedidos", { p_token: entregador.public_token });
    setPedidos((data ?? []) as PedidoEntregador[]);
  }

  async function carregarDisponiveis() {
    if (!isFreelancer) return;
    const { data, error } = await (supabase as any).rpc("freelancer_pedidos_disponiveis", { p_token: entregador.public_token });
    setUltimaAtualizacao(new Date());
    if (error) {
      setErroDisponiveis(error.message ?? "Erro ao buscar pedidos");
      return;
    }
    setErroDisponiveis(null);
    setDisponiveis((data ?? []) as PedidoDisponivel[]);
  }

  async function pegarEntrega(pedidoId: string) {
    setPegando(pedidoId);
    const { data } = await (supabase as any).rpc("freelancer_pegar_entrega", {
      p_token: entregador.public_token,
      p_pedido_id: pedidoId,
    });
    setPegando(null);
    if (!data?.ok) {
      toast.error(data?.erro ?? "Não foi possível aceitar. Tente novamente.");
      carregarDisponiveis();
      return;
    }
    // Muda status para "em_rota" automaticamente ao aceitar a primeira entrega
    if (entregador.status !== "em_rota") {
      mudarStatus("em_rota");
    }
    await carregarPedidos();
    await carregarDisponiveis();
    // Rola para o topo para mostrar a seção "Em andamento" que acabou de aparecer
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 200);
  }

  async function finalizarEntrega(pedidoId: string) {
    setFinalizando(pedidoId);
    const { data } = await (supabase as any).rpc("entregador_finalizar_entrega", {
      p_token: entregador.public_token,
      p_pedido_id: pedidoId,
    });
    setFinalizando(null);
    if (!data?.ok) {
      toast.error(data?.erro ?? "Erro ao finalizar entrega.");
      return;
    }
    toast.success("Entrega finalizada! Boa entrega!");
    carregarPedidos();
  }

  async function mudarStatus(novoStatus: string) {
    setAtualizando(true);
    const { error } = await (supabase as any).rpc("entregador_atualizar_status", { p_token: entregador.public_token, p_status: novoStatus });
    setAtualizando(false);
    if (error) { toast.error("Erro ao atualizar status. Tente novamente."); return; }
    setEntregador((e) => ({ ...e, status: novoStatus }));
  }

  useEffect(() => {
    async function iniciar() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) await supabase.auth.signInAnonymously();
        await (supabase as any).rpc("entregador_vincular_sessao", {
          p_token: entregador.public_token,
        });
      } catch {
        // Falha silenciosa — polling garante atualização mesmo sem realtime
      } finally {
        carregarPedidos();
        if (isFreelancer) carregarDisponiveis();
      }
    }
    iniciar();

    const poll = setInterval(() => {
      carregarPedidos();
      if (isFreelancer) carregarDisponiveis();
    }, 8000);

    const ch = supabase.channel(`entregador-pedidos-${entregador.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => { carregarPedidos(); if (isFreelancer) carregarDisponiveis(); }
      ).subscribe();

    return () => { clearInterval(poll); supabase.removeChannel(ch); };
  }, [entregador.id]);

  const pedidosAtivos    = pedidos.filter((p) => ["aceito", "preparo", "entrega"].includes(p.status));
  const pedidosHistorico = pedidos.filter((p) => p.status === "finalizado");
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const doMes    = pedidosHistorico.filter(p => new Date(p.created_at) >= inicioMes);
  const ganhosMes   = doMes.reduce((s, p) => s + Number(p.taxa_entrega ?? 0), 0);
  const ganhosTotal = pedidosHistorico.reduce((s, p) => s + Number(p.taxa_entrega ?? 0), 0);

  return (
    <div className="min-h-screen bg-zinc-100">

      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/entregadores" })}
              className="shrink-0 p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
              <ChevronLeft className="size-5 text-zinc-500" />
            </button>
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
            <div className="ml-auto flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${statusAtual.cor} ${entregador.status === "disponivel" ? "animate-pulse" : ""}`} />
              <span className="text-xs font-semibold text-zinc-600">{statusAtual.label}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Status */}
        {isFixo ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3">
            <span className={`size-3 rounded-full shrink-0 ${statusAtual.cor} ${entregador.status === "disponivel" ? "animate-pulse" : ""}`} />
            <div>
              <p className="text-sm font-semibold text-zinc-700">{statusAtual.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">O estabelecimento atribui os pedidos para você</p>
            </div>
          </div>
        ) : (
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
        )}

        {/* ── Pedidos em andamento (ativos) ── */}
        {pedidosAtivos.length > 0 && (
          <div>
            <h2 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-purple-500 animate-pulse" />
              Em andamento ({pedidosAtivos.length})
            </h2>
            <div className="space-y-3">
              {pedidosAtivos.map((p) => {
                const st = STATUS_PEDIDO[p.status] ?? STATUS_PEDIDO.entrega;
                const Icon = st.icon;
                return (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4 border-2 border-purple-100">

                    {/* Cabeçalho do card */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="font-bold text-zinc-900 text-base">Pedido #{p.numero}</span>
                        {p.empresa_nome && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                            <Store className="size-3 shrink-0" />
                            {p.empresa_nome}
                          </div>
                        )}
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full shrink-0 ${st.cor}`}>
                        <Icon className="size-3" />
                        {st.label}
                      </span>
                    </div>

                    {/* Cliente */}
                    <div className="text-sm font-semibold text-zinc-800">{p.cliente_nome}</div>

                    {/* Telefone do cliente */}
                    {p.cliente_telefone && (
                      <a href={`tel:${p.cliente_telefone}`}
                        className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-800 mt-1">
                        <Phone className="size-3" />
                        {p.cliente_telefone}
                        <span className="text-zinc-400 font-normal">· Ligar</span>
                      </a>
                    )}

                    {/* Endereço */}
                    {p.cliente_endereco && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-500 mt-1.5">
                        <MapPin className="size-3 mt-0.5 shrink-0" />
                        {p.cliente_endereco}
                      </div>
                    )}

                    {/* Mini mapa */}
                    {p.cliente_lat != null && p.cliente_lng != null && (
                      <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-200">
                        <Suspense fallback={<div className="h-44 bg-zinc-100 flex items-center justify-center text-xs text-zinc-400">Carregando mapa…</div>}>
                          <MapaEntrega
                            clienteLat={p.cliente_lat}
                            clienteLng={p.cliente_lng}
                            clienteNome={p.cliente_nome}
                            entregadorLat={currentPos?.lat}
                            entregadorLng={currentPos?.lng}
                          />
                        </Suspense>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 gap-2">
                      <span className="text-sm font-black text-green-600">Taxa: {fmt(Number(p.taxa_entrega ?? 0))}</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={
                            p.cliente_lat != null
                              ? `https://maps.google.com/maps?daddr=${p.cliente_lat},${p.cliente_lng}`
                              : `https://maps.google.com/maps?daddr=${encodeURIComponent(p.cliente_endereco ?? "")}`
                          }
                          target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                          <Navigation className="size-3" /> Navegar
                        </a>
                        {p.status === "entrega" && (
                          <button
                            onClick={() => finalizarEntrega(p.id)}
                            disabled={finalizando === p.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 disabled:opacity-60 transition-colors">
                            {finalizando === p.id
                              ? <><span className="size-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Finalizando…</>
                              : <><CheckCircle2 className="size-3.5" /> Entregue!</>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pedidosAtivos.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Package className="size-10 text-zinc-200 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Nenhum pedido em andamento no momento.</p>
          </div>
        )}

        {/* GPS Tracking */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Navigation className="size-4" /> Localização GPS
          </h2>
          {tracking ? (
            <div className="space-y-3">
              {gpsErro ? (
                <>
                  <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                    <span className="size-2.5 rounded-full bg-amber-500" />
                    Falha ao atualizar GPS
                  </div>
                  <p className="text-xs text-amber-600">{gpsErro}</p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <span className="size-2.5 rounded-full bg-green-500 animate-pulse" />
                  Localização sendo compartilhada
                </div>
              )}
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
              {gpsErro && <p className="text-xs text-red-500">{gpsErro}</p>}
            </div>
          )}
        </div>

        {/* Meu PIX */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <QrCode className="size-4" /> Minha chave PIX
          </h2>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Cadastre sua chave PIX para que o estabelecimento pague sua taxa de entrega diretamente para você.
          </p>
          <div className="space-y-3">
            <select
              value={pixTipo}
              onChange={e => setPixTipo(e.target.value)}
              className="w-full h-10 rounded-xl border border-zinc-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400/40">
              <option value="aleatoria">Chave aleatória</option>
              <option value="cpf">CPF</option>
              <option value="telefone">Telefone</option>
              <option value="email">E-mail</option>
            </select>
            <input
              type="text"
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
              placeholder={
                pixTipo === "aleatoria" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                : pixTipo === "cpf" ? "000.000.000-00"
                : pixTipo === "telefone" ? "(66) 99999-9999"
                : "seu@email.com"
              }
              className="w-full h-10 rounded-xl border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/40"
            />
            <button
              onClick={salvarPix}
              disabled={salvandoPix}
              className={`w-full h-10 rounded-xl text-sm font-bold transition-all ${
                pixSalvo ? "bg-green-500 text-white" : "bg-green-500 hover:bg-green-600 text-white"
              } disabled:opacity-60`}>
              {pixSalvo ? "✓ PIX salvo!" : salvandoPix ? "Salvando…" : "Salvar chave PIX"}
            </button>
          </div>
          {entregador.chave_pix && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-green-600 font-bold uppercase">PIX atual</p>
                <p className="text-xs text-zinc-700 font-mono truncate mt-0.5">{entregador.chave_pix}</p>
              </div>
              <button onClick={() => copiarTexto(entregador.chave_pix!).then(() => toast.success("Chave copiada!"))}
                className="shrink-0 size-8 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors">
                <Copy className="size-3.5 text-green-600" />
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-zinc-900">{doMes.length}</div>
            <div className="text-xs text-zinc-400 mt-0.5">Entregas este mês</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="text-base font-bold text-green-600">{fmt(ganhosMes)}</div>
            <div className="text-xs text-zinc-400 mt-0.5">Ganhos este mês</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="text-base font-bold text-zinc-700">{fmt(ganhosTotal)}</div>
            <div className="text-xs text-zinc-400 mt-0.5">Total geral</div>
          </div>
        </div>

        {/* Freelancer — aviso aguardando aprovação */}
        {isFreelancer && entregador.aprovado === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <Clock className="size-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-amber-800">Cadastro em análise</p>
            <p className="text-xs text-amber-600 mt-1">Aguarde a aprovação do estabelecimento para começar a receber entregas.</p>
          </div>
        )}

        {/* Pedidos disponíveis para freelancer pegar */}
        {isFreelancer && entregador.aprovado === true && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                Pedidos disponíveis ({disponiveis.length})
              </h2>
              <button
                onClick={carregarDisponiveis}
                className="text-xs text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-1">
                ↻ Atualizar
              </button>
            </div>
            {ultimaAtualizacao && (
              <p className="text-[10px] text-zinc-400 mb-2">
                Atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
              </p>
            )}
            {erroDisponiveis && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-xs text-red-600">
                Erro ao buscar pedidos: {erroDisponiveis}
              </div>
            )}
            {disponiveis.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <Package className="size-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">Nenhum pedido disponível agora.</p>
                <p className="text-xs text-zinc-300 mt-1">Novos pedidos aparecem aqui em tempo real.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {disponiveis.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4 border-2 border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-zinc-900">Pedido #{p.numero}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">Disponível</span>
                    </div>
                    <div className="text-sm font-semibold text-zinc-800">{p.cliente_nome}</div>
                    {p.cliente_endereco && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-500 mt-1">
                        <MapPin className="size-3 mt-0.5 shrink-0" />
                        {p.cliente_endereco}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                      <span className="text-sm font-black text-green-600">Taxa: {fmt(Number(p.taxa_entrega ?? 0))}</span>
                      <button
                        onClick={() => pegarEntrega(p.id)}
                        disabled={pegando === p.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 disabled:opacity-60 transition-colors">
                        {pegando === p.id
                          ? <><span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Aceitando…</>
                          : <><Bike className="size-3.5" /> Aceitar entrega</>
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Histórico */}
        {pedidosHistorico.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-zinc-900">Histórico de entregas</h2>
              <span className="text-xs text-zinc-400">{pedidosHistorico.length} no total</span>
            </div>

            {doMes.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-green-700">Este mês</p>
                  <p className="text-xs text-green-600 mt-0.5">{doMes.length} entrega{doMes.length !== 1 ? "s" : ""} realizadas</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-green-700">{fmt(ganhosMes)}</p>
                  <p className="text-xs text-green-500">em taxas de entrega</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {pedidosHistorico.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="size-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="size-4 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-zinc-900">
                          #{p.numero} — {p.cliente_nome}
                        </div>
                        {p.empresa_nome && (
                          <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
                            <Store className="size-3" /> {p.empresa_nome}
                          </div>
                        )}
                        {p.cliente_endereco && (
                          <div className="flex items-start gap-1 text-xs text-zinc-500 mt-1">
                            <MapPin className="size-3 mt-0.5 shrink-0 text-zinc-400" />
                            <span className="leading-relaxed">{p.cliente_endereco}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1.5">
                          <Clock className="size-3" />
                          {new Date(p.created_at).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-green-600">{fmt(Number(p.taxa_entrega ?? 0))}</span>
                      <p className="text-[10px] text-zinc-400 mt-0.5">taxa recebida</p>
                    </div>
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
