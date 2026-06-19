import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireEntregador, type EntregadorData } from "@/lib/entregador-auth";
import {
  LogOut, CheckCircle2, Clock,
  AlertTriangle, XCircle, Ban, Phone, Navigation,
  RefreshCw, Bike, ChevronLeft, Store,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entregadores/painel")({
  ssr: false,
  beforeLoad: () => requireEntregador(),
  component: PainelEntregador,
});

const STATUS_CADASTRO: Record<string, { label: string; cor: string; icon: React.ReactNode; desc: string }> = {
  cadastro_incompleto: { label: "Incompleto",         cor: "text-zinc-400 bg-zinc-800 border-zinc-700", icon: <AlertTriangle className="size-4" />, desc: "Complete seu cadastro para continuar." },
  aguardando_analise:  { label: "Aguardando análise", cor: "text-blue-400 bg-blue-950 border-blue-800",  icon: <Clock className="size-4" />,         desc: "Seu cadastro foi enviado e está na fila de análise. Em breve você receberá uma resposta." },
  em_analise:          { label: "Em análise",          cor: "text-yellow-400 bg-yellow-950 border-yellow-800", icon: <RefreshCw className="size-4" />, desc: "Nossa equipe está analisando seus dados." },
  aprovado:            { label: "Aprovado ✓",          cor: "text-green-400 bg-green-950 border-green-800",   icon: <CheckCircle2 className="size-4" />, desc: "Cadastro aprovado! Você já aparece automaticamente para restaurantes que usam entregadores da plataforma." },
  recusado:            { label: "Recusado",            cor: "text-red-400 bg-red-950 border-red-800",         icon: <XCircle className="size-4" />,     desc: "Seu cadastro foi recusado." },
  bloqueado:           { label: "Bloqueado",           cor: "text-red-400 bg-red-950 border-red-800",         icon: <Ban className="size-4" />,         desc: "Conta bloqueada. Entre em contato com o suporte." },
};

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    play(880, 0, 0.15); play(1108, 0.18, 0.15); play(1320, 0.36, 0.3);
  } catch (_) {}
}

const STATUS_PEDIDO: Record<string, { label: string; cor: string }> = {
  aceito:   { label: "Confirmado",      cor: "text-blue-600 bg-blue-50" },
  preparo:  { label: "Em preparo",      cor: "text-yellow-700 bg-yellow-50" },
  entrega:  { label: "Saiu p/ entrega", cor: "text-orange-600 bg-orange-50" },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PainelEntregador() {
  const { entregador } = Route.useRouteContext() as { entregador: EntregadorData };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = entregador.public_token;
  const aprovado = entregador.status_cadastro === "aprovado";

  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const prevIdsRef = useRef<string[]>([]);
  const primeiroCarregamento = useRef(true);

  // Pedidos ativos
  const { data: pedidosAtivos = [], refetch: refetchAtivos } = useQuery({
    queryKey: ["meus-pedidos-painel", token],
    enabled: aprovado && !!token,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.rpc("entregador_meus_pedidos", { p_token: token });
      return (data ?? []) as any[];
    },
  });

  // Pedidos disponíveis (freelancer aprovado)
  const { data: pedidosDisp = [], refetch: refetchDisp } = useQuery({
    queryKey: ["disp-painel", token],
    enabled: aprovado && !!token,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.rpc("freelancer_pedidos_disponiveis", { p_token: token });
      return (data ?? []) as any[];
    },
  });

  // Notificação quando novo pedido disponível aparece
  useEffect(() => {
    const currentIds = pedidosDisp.map((p: any) => p.id as string);
    if (!primeiroCarregamento.current) {
      const novos = currentIds.filter(id => !prevIdsRef.current.includes(id));
      if (novos.length > 0) {
        playBeep();
        toast(`Nova entrega disponível! (${novos.length})`, { duration: 8000 });
      }
    } else if (currentIds.length > 0) {
      primeiroCarregamento.current = false;
    }
    if (currentIds.length > 0) primeiroCarregamento.current = false;
    prevIdsRef.current = currentIds;
  }, [pedidosDisp]);

  // Realtime: refetch imediato quando qualquer pedido muda
  useEffect(() => {
    if (!aprovado || !token) return;
    const channel = supabase
      .channel("pedidos-entregador-disp")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => { refetchDisp(); refetchAtivos(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [aprovado, token, refetchDisp, refetchAtivos]);

  // Histórico + métricas
  const { data: historico = [] } = useQuery({
    queryKey: ["historico-painel", token],
    enabled: aprovado && !!token,
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos" as any)
        .select("id,numero,taxa_entrega,cliente_nome,created_at")
        .eq("entregador_id", entregador.id)
        .eq("status", "finalizado")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const agora = new Date();
  const mesAtual = historico.filter((p: any) => {
    const d = new Date(p.created_at);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });
  const ganhosMes = mesAtual.reduce((s: number, p: any) => s + (p.taxa_entrega ?? 0), 0);

  async function atualizarStatus(status: string) {
    if (!token) return;
    setAtualizandoStatus(true);
    try {
      await supabase.rpc("entregador_atualizar_status", { p_token: token, p_status: status });
      toast.success("Status atualizado");
    } finally {
      setAtualizandoStatus(false);
    }
  }

  async function finalizarEntrega(pedidoId: string) {
    const { data } = await supabase.rpc("entregador_finalizar_entrega", {
      p_token: token,
      p_pedido_id: pedidoId,
    });
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success("Entrega finalizada!");
    refetchAtivos();
  }

  async function aceitarEntrega(pedidoId: string) {
    const { data } = await supabase.rpc("freelancer_pegar_entrega", {
      p_token: token,
      p_pedido_id: pedidoId,
    });
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success("Entrega aceita!");
    refetchAtivos();
    refetchDisp();
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/entregadores", replace: true });
  }

  const statusInfo = STATUS_CADASTRO[entregador.status_cadastro] ?? STATUS_CADASTRO.cadastro_incompleto;
  const veiculoLabel: Record<string, string> = { moto: "🏍️ Moto", carro: "🚗 Carro", bicicleta: "🚲 Bicicleta" };

  // Aprovado mas sem token — estado inválido (migration pendente ou token não gerado)
  if (aprovado && !token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-xs">
          <AlertTriangle className="size-10 text-yellow-500 mx-auto" />
          <p className="text-sm font-bold text-white">Configuração pendente</p>
          <p className="text-xs text-zinc-400">Seu cadastro foi aprovado mas o token de acesso ainda não foi gerado. Entre em contato com o suporte.</p>
          <button onClick={sair} className="text-xs text-orange-400 hover:underline">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-orange-500 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/entregadores" className="shrink-0 p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-100 uppercase tracking-wider">Painel do Entregador</p>
            <h1 className="text-lg font-extrabold text-white truncate">{entregador.nome}</h1>
            <p className="text-xs text-orange-100">{veiculoLabel[entregador.veiculo ?? ""] ?? entregador.veiculo}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to="/entregadores/perfil" className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
              <Bike className="size-5" />
            </Link>
            <button onClick={sair} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Status do cadastro */}
        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${statusInfo.cor}`}>
          <div className="mt-0.5 shrink-0">{statusInfo.icon}</div>
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-bold">{statusInfo.label}</p>
            <p className="text-xs opacity-80">{statusInfo.desc}</p>
            {entregador.motivo_recusa && (
              <p className="text-xs mt-1 font-medium">Motivo: {entregador.motivo_recusa}</p>
            )}
          </div>
        </div>

        {/* Badge verificado */}
        {entregador.verificado && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-950 border border-green-800 rounded-xl">
            <CheckCircle2 className="size-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">Entregador Verificado pela plataforma</span>
          </div>
        )}

        {/* Nav rápida */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/entregadores/parceiros" className="flex flex-col items-center gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-orange-500 transition text-center">
            <Store className="size-5 text-orange-400" />
            <span className="text-xs font-semibold text-zinc-300">Restaurantes</span>
          </Link>
          <Link to="/entregadores/perfil" className="flex flex-col items-center gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-orange-500 transition text-center">
            <Bike className="size-5 text-orange-400" />
            <span className="text-xs font-semibold text-zinc-300">Meu Perfil</span>
          </Link>
        </div>

        {/* Seções só para aprovados */}
        {aprovado && (
          <>
            {/* Status de operação */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Meu Status</h2>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "disponivel",   label: "Disponível",    cor: "border-green-500 bg-green-500/10 text-green-400" },
                  { value: "em_rota",      label: "Em rota",       cor: "border-yellow-500 bg-yellow-500/10 text-yellow-400" },
                  { value: "indisponivel", label: "Indisponível",  cor: "border-zinc-600 bg-zinc-800 text-zinc-400" },
                ].map((s) => (
                  <button
                    key={s.value}
                    disabled={atualizandoStatus}
                    onClick={() => atualizarStatus(s.value)}
                    className={`py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                      entregador.status === s.value ? s.cor : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Métricas */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                <p className="text-2xl font-extrabold text-orange-400">{mesAtual.length}</p>
                <p className="text-xs text-zinc-500 mt-1">Entregas este mês</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                <p className="text-lg font-extrabold text-green-400">{fmt(ganhosMes)}</p>
                <p className="text-xs text-zinc-500 mt-1">Ganhos este mês</p>
              </div>
            </section>

            {/* Pedidos disponíveis */}
            {pedidosDisp.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                  Disponíveis ({pedidosDisp.length})
                </h2>
                {pedidosDisp.map((p: any) => (
                  <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">#{p.numero}</p>
                        <p className="text-xs text-zinc-400">{p.cliente_endereco}</p>
                      </div>
                      <span className="text-sm font-extrabold text-green-400 shrink-0">{fmt(p.taxa_entrega ?? 0)}</span>
                    </div>
                    <button
                      onClick={() => aceitarEntrega(p.id)}
                      className="w-full py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition"
                    >
                      ✓ Aceitar Entrega
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* Pedidos em andamento */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Em andamento</h2>
              {pedidosAtivos.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">Nenhuma entrega em andamento</p>
              ) : (
                pedidosAtivos.map((p: any) => {
                  const statusP = STATUS_PEDIDO[p.status] ?? { label: p.status, cor: "text-zinc-400 bg-zinc-800" };
                  return (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-white">#{p.numero}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusP.cor}`}>{statusP.label}</span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{p.cliente_endereco}</p>
                          <p className="text-xs text-zinc-500">{p.cliente_nome}</p>
                        </div>
                        <span className="text-sm font-extrabold text-green-400 shrink-0">{fmt(p.taxa_entrega ?? 0)}</span>
                      </div>
                      <div className="flex gap-2">
                        {p.cliente_telefone && (
                          <a
                            href={`tel:${p.cliente_telefone}`}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                          >
                            <Phone className="size-3" /> Ligar
                          </a>
                        )}
                        {p.cliente_lat && p.cliente_lng && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${p.cliente_lat},${p.cliente_lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                          >
                            <Navigation className="size-3" /> Navegar
                          </a>
                        )}
                        {p.status === "entrega" && (
                          <button
                            onClick={() => finalizarEntrega(p.id)}
                            className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold transition"
                          >
                            Entregue!
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}

        {/* Histórico resumido */}
        {aprovado && historico.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Últimas entregas</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
              {historico.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-zinc-300">#{p.numero} · {p.cliente_nome}</p>
                    <p className="text-xs text-zinc-600">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-xs font-bold text-green-400">{fmt(p.taxa_entrega ?? 0)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
