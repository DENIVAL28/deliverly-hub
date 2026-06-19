import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, CheckCircle2, Clock, MapPin, Navigation, Package, Phone, PackageSearch, QrCode, Copy } from "lucide-react";
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
}

export const Route = createFileRoute("/entregador/$id")({
  ssr: false,
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

const STATUS_PEDIDO: Record<string, { label: string; cor: string }> = {
  entrega:    { label: "Em entrega",  cor: "bg-purple-100 text-purple-700" },
  finalizado: { label: "Entregue",    cor: "bg-green-100 text-green-700" },
};

function EntregadorPage() {
  const entregadorInicial = Route.useLoaderData();
  const [entregador, setEntregador] = useState<Entregador>(entregadorInicial);
  const [pedidos, setPedidos] = useState<PedidoEntregador[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const [disponiveis, setDisponiveis] = useState<PedidoDisponivel[]>([]);
  const [pegando, setPegando] = useState<string | null>(null);
  const isFreelancer = entregador.tipo === "freelancer";

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
    return err.message;
  }

  async function enviarPosicao(): Promise<boolean> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
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

  const empresa = entregador.empresas;
  const statusAtual = STATUS_OPTIONS.find((s) => s.value === entregador.status) ?? STATUS_OPTIONS[0];

  async function carregarPedidos() {
    const { data } = await (supabase as any).rpc("entregador_meus_pedidos", { p_token: entregador.public_token });
    setPedidos((data ?? []) as PedidoEntregador[]);
  }

  async function carregarDisponiveis() {
    if (!isFreelancer) return;
    const { data } = await (supabase as any).rpc("freelancer_pedidos_disponiveis", { p_token: entregador.public_token });
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
    await carregarPedidos();
    await carregarDisponiveis();
  }

  async function mudarStatus(novoStatus: string) {
    setAtualizando(true);
    const { error } = await (supabase as any).rpc("entregador_atualizar_status", { p_token: entregador.public_token, p_status: novoStatus });
    setAtualizando(false);
    if (error) { toast.error("Erro ao atualizar status. Tente novamente."); return; }
    setEntregador((e) => ({ ...e, status: novoStatus }));
  }

  useEffect(() => {
    // Sessão anônima autenticada: permite realtime + RLS em pedidos
    async function iniciar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.signInAnonymously();
      // Vincula a sessão ao entregador para que as políticas RLS funcionem
      await (supabase as any).rpc("entregador_vincular_sessao", {
        p_token: entregador.public_token,
      });
      carregarPedidos();
      if (isFreelancer) carregarDisponiveis();
    }
    iniciar();

    // Polling 15s como fallback garantido
    const poll = setInterval(() => {
      carregarPedidos();
      if (isFreelancer) carregarDisponiveis();
    }, 15000);

    // Realtime — funciona após vincular sessão autenticada
    const ch = supabase.channel(`entregador-pedidos-${entregador.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => { carregarPedidos(); if (isFreelancer) carregarDisponiveis(); }
      ).subscribe();

    return () => { clearInterval(poll); supabase.removeChannel(ch); };
  }, [entregador.id]);

  const pedidosAtivos    = pedidos.filter((p) => p.status === "entrega");
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
            <h2 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-green-500 animate-pulse" />
              Pedidos disponíveis ({disponiveis.length})
            </h2>
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
                  {/* Mini mapa — exibe se o cliente compartilhou localização GPS */}
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
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                    <span className="text-sm font-bold text-green-600">Taxa: {fmt(Number(p.taxa_entrega ?? 0))}</span>
                    <a
                      href={
                        p.cliente_lat != null
                          ? `https://maps.google.com/?daddr=${p.cliente_lat},${p.cliente_lng}`
                          : `https://maps.google.com/?q=${encodeURIComponent(p.cliente_endereco ?? "")}`
                      }
                      target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                      <Navigation className="size-3" /> Navegar
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-zinc-900">Histórico de entregas</h2>
              <span className="text-xs text-zinc-400">{pedidosHistorico.length} no total</span>
            </div>

            {/* Resumo do mês */}
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
