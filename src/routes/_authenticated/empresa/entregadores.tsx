import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Bike, Phone, Navigation, Copy, Users, CheckCircle2 } from "lucide-react";
import { copiarTexto } from "@/lib/validacoes";
import { toast } from "sonner";
import { LimiteBanner } from "@/components/UpgradeGuard";
import { PLANO_LIMITS, parsarErroSupabase } from "@/lib/plano";

const MapaEntregadores = lazy(() => import("@/components/MapaEntregadores"));

export const Route = createFileRoute("/_authenticated/empresa/entregadores")({
  component: EntregadoresPage,
});

const STATUS_CONFIG: Record<string, { label: string; cor: string; dot: string }> = {
  disponivel:   { label: "Disponível",   cor: "text-green-600 bg-green-50 border-green-200",   dot: "bg-green-500" },
  em_rota:      { label: "Em rota",      cor: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  indisponivel: { label: "Indisponível", cor: "text-red-600 bg-red-50 border-red-200",          dot: "bg-red-400" },
};

const VEICULO_LABEL: Record<string, string> = {
  moto: "🏍️ Moto", bicicleta: "🚲 Bicicleta", carro: "🚗 Carro", a_pe: "🚶 A pé",
};

function EntregadoresPage() {
  const { empresaId, plano } = useAuth();
  const limites = PLANO_LIMITS[plano];
  const qc = useQueryClient();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [nome, setNome]     = useState("");
  const [tel, setTel]       = useState("");
  const [salvando, setSalvando]   = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);

  // Modo de entrega da empresa
  const { data: empresa } = useQuery({
    queryKey: ["empresa-modo-entrega", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("empresas" as any)
        .select("tipo_operacao_entrega")
        .eq("id", empresaId!)
        .maybeSingle();
      return data as { tipo_operacao_entrega: "plataforma" | "fixos" } | null;
    },
  });

  const modo = empresa?.tipo_operacao_entrega ?? "plataforma";

  const { mutate: definirModo, isPending: salvandoModo } = useMutation({
    mutationFn: async (novoModo: "plataforma" | "fixos") => {
      const { data } = await supabase.rpc("empresa_definir_modo_entrega" as any, { p_modo: novoModo });
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-modo-entrega", empresaId] });
      toast.success("Modo de entrega atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Entregadores fixos da loja
  const { data: fixos = [] } = useQuery({
    queryKey: ["entregadores-fixos", empresaId],
    enabled: !!empresaId && modo === "fixos",
    refetchInterval: 15000,
    queryFn: async () =>
      ((await supabase.from("entregadores").select("*")
        .eq("empresa_id", empresaId!).eq("ativo" as any, true).order("nome")) as any).data ?? [],
  });

  // Entregadores de plataforma ativos (modo plataforma)
  const { data: plataforma = [] } = useQuery({
    queryKey: ["entregadores-plataforma-ativos"],
    enabled: !!empresaId && modo === "plataforma",
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("empresa_listar_entregadores_plataforma");
      return (data ?? []) as any[];
    },
  });

  const { data: stats = {} } = useQuery({
    queryKey: ["entregadores-stats", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);
      const { data } = await supabase.from("pedidos")
        .select("entregador_id, taxa_entrega")
        .eq("empresa_id", empresaId!)
        .eq("status" as any, "finalizado")
        .not("entregador_id" as any, "is", null)
        .gte("created_at", inicioMes.toISOString());
      const map: Record<string, { qtd: number; ganhos: number }> = {};
      (data ?? []).forEach((p: any) => {
        if (!map[p.entregador_id]) map[p.entregador_id] = { qtd: 0, ganhos: 0 };
        map[p.entregador_id].qtd++;
        map[p.entregador_id].ganhos += Number(p.taxa_entrega ?? 0);
      });
      return map;
    },
  });

  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase.channel(`entregadores-status-${empresaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entregadores" },
        () => {
          qc.invalidateQueries({ queryKey: ["entregadores-fixos", empresaId] });
          qc.invalidateQueries({ queryKey: ["entregadores-plataforma-ativos"] });
        }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, qc]);

  async function salvar() {
    if (!nome.trim()) { toast.error("Digite o nome do entregador."); return; }
    setSalvando(true);
    const { error } = await supabase.from("entregadores").insert({
      empresa_id: empresaId!, nome: nome.trim(), telefone: tel.trim() || null, tipo: "fixo",
    });
    setSalvando(false);
    if (error) { toast.error(parsarErroSupabase(error)); return; }
    setNome(""); setTel("");
    qc.invalidateQueries({ queryKey: ["entregadores-fixos", empresaId] });
    toast.success("Entregador cadastrado!");
  }

  async function excluir(id: string, nomeEnt: string) {
    if (!window.confirm(`Remover "${nomeEnt}"?`)) return;
    await supabase.from("pedidos").update({ entregador_id: null } as any)
      .eq("empresa_id", empresaId!).eq("entregador_id" as any, id);
    await supabase.from("entregadores").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["entregadores-fixos", empresaId] });
    toast.success("Entregador removido");
  }

  const comGps = (fixos as any[]).filter((e: any) => e.lat != null && e.lng != null);
  const disponiveis = (plataforma as any[]).filter((e: any) => e.status === "disponivel");

  return (
    <>
      <PageHeader title="Entregadores" subtitle="Escolha como sua loja recebe entregas" />

      {/* ── Seletor de modo ──────────────────────────────────────────── */}
      <div className="bg-background rounded-2xl ring-1 ring-black/5 p-5 mb-6">
        <p className="text-sm font-bold text-zinc-700 mb-3">Como você quer receber as entregas?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={salvandoModo}
            onClick={() => definirModo("fixos")}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              modo === "fixos"
                ? "border-brand bg-brand/5"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {modo === "fixos" && (
              <CheckCircle2 className="absolute top-3 right-3 size-4 text-brand" />
            )}
            <Bike className={`size-5 mb-2 ${modo === "fixos" ? "text-brand" : "text-zinc-400"}`} />
            <p className={`text-sm font-bold ${modo === "fixos" ? "text-zinc-900" : "text-zinc-500"}`}>
              Equipe própria
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Você cadastra e gerencia seus entregadores fixos
            </p>
          </button>

          <button
            disabled={salvandoModo}
            onClick={() => definirModo("plataforma")}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              modo === "plataforma"
                ? "border-brand bg-brand/5"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {modo === "plataforma" && (
              <CheckCircle2 className="absolute top-3 right-3 size-4 text-brand" />
            )}
            <Users className={`size-5 mb-2 ${modo === "plataforma" ? "text-brand" : "text-zinc-400"}`} />
            <p className={`text-sm font-bold ${modo === "plataforma" ? "text-zinc-900" : "text-zinc-500"}`}>
              Plataforma Deliverly
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Entregadores verificados da plataforma pegam seus pedidos
            </p>
          </button>
        </div>
      </div>

      {/* ── MODO: EQUIPE PRÓPRIA ─────────────────────────────────────── */}
      {modo === "fixos" && (
        <>
          {limites.entregadores !== null && (
            <LimiteBanner atual={fixos.length} limite={limites.entregadores} tipo="entregadores" minPlano="premium" />
          )}

          {/* Mapa */}
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => setMostrarMapa(v => !v)} className="gap-2">
              <Navigation className="size-3.5" />
              {mostrarMapa ? "Fechar mapa" : "Mapa ao vivo"}
              {comGps.length > 0 && !mostrarMapa && (
                <span className="ml-1 size-4 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">{comGps.length}</span>
              )}
            </Button>
          </div>

          {mostrarMapa && (
            <div className="bg-background rounded-2xl ring-1 ring-black/5 mb-6 overflow-hidden" style={{ height: "380px" }}>
              {comGps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sm text-zinc-400 gap-2">
                  <Navigation className="size-8 text-zinc-200" />
                  <p className="font-medium">Nenhum entregador compartilhando localização.</p>
                </div>
              ) : (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-zinc-400">Carregando mapa…</div>}>
                  <MapaEntregadores entregadores={fixos} />
                </Suspense>
              )}
            </div>
          )}

          {/* Formulário */}
          <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 mb-6">
            <h2 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Bike className="size-4 text-brand" /> Novo entregador fixo
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input placeholder="Ex: João Silva" value={nome} onChange={e => setNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && salvar()} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone <span className="text-zinc-400">(opcional)</span></Label>
                <Input placeholder="(11) 99999-9999" value={tel} onChange={e => setTel(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={salvar} disabled={salvando} className="w-full bg-brand hover:bg-brand/90 gap-2">
                  <Plus className="size-4" /> Cadastrar
                </Button>
              </div>
            </div>
          </div>

          {/* Lista fixos */}
          {(fixos as any[]).length === 0 ? (
            <div className="text-center py-16 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
              <Bike className="size-10 mx-auto mb-3 text-zinc-200" />
              Nenhum entregador fixo cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {(fixos as any[]).map((e: any) => {
                const st   = STATUS_CONFIG[e.status ?? "disponivel"];
                const stat = (stats as any)[e.id];
                return (
                  <div key={e.id} className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center">
                          <Bike className="size-6 text-brand" />
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white ${st.dot} ${e.status === "disponivel" ? "animate-pulse" : ""}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-900">{e.nome}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cor}`}>{st.label}</span>
                        </div>
                        {e.telefone && (
                          <a href={`https://wa.me/55${e.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-green-600 transition-colors mt-0.5">
                            <Phone className="size-3" /> {e.telefone}
                          </a>
                        )}
                        {e.veiculo && <p className="text-xs text-zinc-400 mt-0.5">{VEICULO_LABEL[e.veiculo] ?? e.veiculo}</p>}
                        {e.chave_pix && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full uppercase">PIX</span>
                            <span className="text-xs font-mono text-zinc-500 truncate max-w-[160px]">{e.chave_pix}</span>
                            <button onClick={() => copiarTexto(e.chave_pix).then(ok => ok ? toast.success(`PIX de ${e.nome} copiado!`) : toast.error("Falha ao copiar"))}
                              className="size-5 rounded flex items-center justify-center text-zinc-400 hover:text-green-600 transition-colors shrink-0">
                              <Copy className="size-3" />
                            </button>
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                          <span>🛵 {stat?.qtd ?? 0} entrega{(stat?.qtd ?? 0) !== 1 ? "s" : ""} este mês</span>
                          <span>💰 {fmt(stat?.ganhos ?? 0)}</span>
                        </div>
                        {e.ultima_localizacao ? (() => {
                          const ativo = Date.now() - new Date(e.ultima_localizacao).getTime() < 5 * 60 * 1000;
                          const hora  = new Date(e.ultima_localizacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                          return ativo
                            ? <div className="flex items-center gap-1 text-xs text-green-600 mt-1"><Navigation className="size-3 animate-pulse" /> GPS ativo · {hora}</div>
                            : <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1"><Navigation className="size-3" /> GPS inativo · últ. {hora}</div>;
                        })() : (
                          <div className="flex items-center gap-1 text-xs text-zinc-300 mt-1"><Navigation className="size-3" /> Sem GPS</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => excluir(e.id, e.nome)} title="Remover"
                          className="size-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:border-red-200 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── MODO: PLATAFORMA ─────────────────────────────────────────── */}
      {modo === "plataforma" && (
        <>
          {/* Banner informativo */}
          <div className="bg-brand/5 border border-brand/20 rounded-2xl p-5 mb-6 flex items-start gap-4">
            <div className="size-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <Users className="size-5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-800">Plataforma ativa</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                Seus pedidos de delivery ficam visíveis para todos os entregadores verificados da plataforma. Eles escolhem e aceitam as entregas automaticamente — sem aprovação manual da sua parte.
              </p>
            </div>
          </div>

          {/* Entregadores disponíveis agora */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-700">
              Entregadores disponíveis agora
              {disponiveis.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">{disponiveis.length}</span>
              )}
            </h3>
            <span className="text-xs text-zinc-400">Atualiza a cada 15s</span>
          </div>

          {plataforma.length === 0 ? (
            <div className="text-center py-16 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
              <Users className="size-10 mx-auto mb-3 text-zinc-200" />
              <p className="font-medium">Nenhum entregador verificado na plataforma ainda.</p>
              <p className="text-xs text-zinc-300 mt-1">Assim que houver entregadores aprovados, eles aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(plataforma as any[]).map((e: any) => {
                const st   = STATUS_CONFIG[e.status ?? "indisponivel"];
                const stat = (stats as any)[e.id];
                return (
                  <div key={e.id} className={`bg-background rounded-2xl ring-1 p-4 flex items-center gap-4 ${
                    e.status === "disponivel" ? "ring-green-100" : "ring-black/5 opacity-60"
                  }`}>
                    {e.foto_rosto_url ? (
                      <div className="relative shrink-0">
                        <img src={e.foto_rosto_url} alt={e.nome} className="w-11 h-11 rounded-xl object-cover" />
                        <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${st.dot}`} />
                      </div>
                    ) : (
                      <div className="relative shrink-0 size-11 rounded-xl bg-zinc-100 flex items-center justify-center">
                        <Bike className="size-5 text-zinc-400" />
                        <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${st.dot}`} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-zinc-900">{e.nome}</span>
                        {e.verificado && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">✓ Verificado</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${st.cor}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{VEICULO_LABEL[e.veiculo] ?? e.veiculo ?? "—"}</p>
                    </div>
                    {stat && (
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-zinc-700">{stat.qtd} entrega{stat.qtd !== 1 ? "s" : ""}</p>
                        <p className="text-xs text-zinc-400">{fmt(stat.ganhos)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
