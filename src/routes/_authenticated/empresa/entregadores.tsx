import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Bike, Phone, Share2, Link, Navigation, Copy, CheckCircle2, Clock, UserCheck, UserX } from "lucide-react";
import { copiarTexto } from "@/lib/validacoes";
import { toast } from "sonner";
import { UpgradeGuard, LimiteBanner } from "@/components/UpgradeGuard";
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

type Aba = "fixos" | "freelancers" | "pendentes";

function EntregadoresPage() {
  const { empresaId, plano } = useAuth();
  const limites = PLANO_LIMITS[plano];
  const qc = useQueryClient();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [nome, setNome]         = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [aba, setAba]           = useState<Aba>("fixos");
  const [slug, setSlug]         = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle()
      .then(({ data }) => { if (data?.slug) setSlug(data.slug); });
  }, [empresaId]);

  const { data: todos = [] } = useQuery({
    queryKey: ["entregadores-admin", empresaId],
    enabled: !!empresaId,
    refetchInterval: 15000,
    queryFn: async () =>
      ((await supabase.from("entregadores").select("*").eq("empresa_id", empresaId!).order("nome")) as any).data ?? [],
  });

  const fixos       = (todos as any[]).filter(e => e.tipo !== "freelancer" && e.ativo !== false);
  const freelancers = (todos as any[]).filter(e => e.tipo === "freelancer" && e.aprovado === true && e.ativo !== false);
  const pendentes   = (todos as any[]).filter(e => e.tipo === "freelancer" && e.aprovado === false);

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
        () => qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] })
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, qc]);

  async function salvar() {
    if (!nome.trim()) { toast.error("Digite o nome do entregador."); return; }
    setSalvando(true);
    const { error } = await supabase.from("entregadores").insert({
      empresa_id: empresaId!, nome: nome.trim(), telefone: telefone.trim() || null, tipo: "fixo",
    });
    setSalvando(false);
    if (error) { toast.error(parsarErroSupabase(error)); return; }
    setNome(""); setTelefone("");
    qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] });
    toast.success("Entregador cadastrado!");
  }

  async function excluir(id: string, nomeEnt: string) {
    if (!window.confirm(`Remover "${nomeEnt}"?`)) return;
    await supabase.from("pedidos").update({ entregador_id: null } as any)
      .eq("empresa_id", empresaId!).eq("entregador_id" as any, id);
    const { error } = await supabase.from("entregadores").delete().eq("id", id);
    if (error) { toast.error("Não foi possível remover: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] });
    toast.success("Entregador removido");
  }

  async function aprovar(id: string, nomeEnt: string) {
    await (supabase as any).from("entregadores").update({ aprovado: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] });
    toast.success(`${nomeEnt} aprovado!`);
  }

  async function recusar(id: string, nomeEnt: string) {
    if (!window.confirm(`Recusar e remover "${nomeEnt}"?`)) return;
    await supabase.from("entregadores").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] });
    toast.success("Cadastro recusado.");
  }

  function compartilharLink(id: string, nomeEnt: string) {
    const url = `${window.location.origin}/entregador/${id}`;
    if (navigator.share) navigator.share({ title: `Acesso — ${nomeEnt}`, url });
    else copiarTexto(url).then(ok => ok ? toast.success("Link copiado!") : toast.error("Falha ao copiar"));
  }

  async function copiarLinkConvite() {
    const url = `${window.location.origin}/entrar-entregador/${slug}`;
    const ok = await copiarTexto(url);
    if (ok) { setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 3000); }
    else toast.error("Falha ao copiar.");
  }

  const comGps = (todos as any[]).filter(e => e.lat != null && e.lng != null);

  const listaAtual = aba === "fixos" ? fixos : aba === "freelancers" ? freelancers : pendentes;

  return (
    <>
      <PageHeader title="Entregadores" subtitle="Equipe fixa e freelancers" />

      {limites.entregadores !== null && (
        <LimiteBanner atual={fixos.length + freelancers.length} limite={limites.entregadores} tipo="entregadores" minPlano="premium" />
      )}

      {/* Link de convite para freelancers */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-orange-800">Link de convite para freelancers</p>
          <p className="text-xs text-orange-600 mt-0.5">
            Compartilhe com motoboys — eles se cadastram e você aprova
          </p>
        </div>
        <button onClick={copiarLinkConvite}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            linkCopiado ? "bg-green-500 text-white" : "bg-orange-500 text-white hover:bg-orange-600"
          }`}>
          {linkCopiado ? <><CheckCircle2 className="size-4" /> Copiado!</> : <><Copy className="size-4" /> Copiar link</>}
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-6">
        {([
          { key: "fixos",       label: "Fixos",       count: fixos.length },
          { key: "freelancers", label: "Freelancers",  count: freelancers.length },
          { key: "pendentes",   label: "Pendentes",    count: pendentes.length, alert: pendentes.length > 0 },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
              aba === t.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`size-4 rounded-full text-[10px] font-black flex items-center justify-center ${
                (t as any).alert ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-600"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Mapa ao vivo */}
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
              <MapaEntregadores entregadores={todos} />
            </Suspense>
          )}
        </div>
      )}

      {/* Formulário — só na aba Fixos */}
      {aba === "fixos" && (
        <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 mb-8">
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
              <Input placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={salvar} disabled={salvando} className="w-full bg-brand hover:bg-brand/90 gap-2">
                <Plus className="size-4" /> Cadastrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pendentes */}
      {aba === "pendentes" && (
        pendentes.length === 0 ? (
          <div className="text-center py-16 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
            <CheckCircle2 className="size-10 mx-auto mb-3 text-zinc-200" />
            Nenhum cadastro pendente.
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map((e: any) => (
              <div key={e.id} className="bg-white rounded-2xl ring-1 ring-amber-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="size-6 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900">{e.nome}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        Aguardando aprovação
                      </span>
                    </div>
                    {e.telefone && (
                      <a href={`https://wa.me/55${e.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-green-600 transition-colors mt-0.5">
                        <Phone className="size-3" /> {e.telefone}
                      </a>
                    )}
                    {e.veiculo && (
                      <p className="text-xs text-zinc-500 mt-0.5">{VEICULO_LABEL[e.veiculo] ?? e.veiculo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => aprovar(e.id, e.nome)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors">
                      <UserCheck className="size-3.5" /> Aprovar
                    </button>
                    <button onClick={() => recusar(e.id, e.nome)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-500 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors">
                      <UserX className="size-3.5" /> Recusar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Lista fixos / freelancers */}
      {aba !== "pendentes" && (
        listaAtual.length === 0 ? (
          <div className="text-center py-16 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
            <Bike className="size-10 mx-auto mb-3 text-zinc-200" />
            {aba === "fixos" ? "Nenhum entregador fixo cadastrado." : "Nenhum freelancer aprovado ainda."}
          </div>
        ) : (
          <div className="space-y-3">
            {listaAtual.map((e: any) => {
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
                        {e.tipo === "freelancer" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">Freelancer</span>
                        )}
                      </div>
                      {e.telefone && (
                        <a href={`https://wa.me/55${e.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-green-600 transition-colors mt-0.5">
                          <Phone className="size-3" /> {e.telefone}
                        </a>
                      )}
                      {e.veiculo && (
                        <p className="text-xs text-zinc-400 mt-0.5">{VEICULO_LABEL[e.veiculo] ?? e.veiculo}</p>
                      )}
                      {e.chave_pix && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full uppercase">PIX</span>
                          <span className="text-xs font-mono text-zinc-500 truncate max-w-[160px]">{e.chave_pix}</span>
                          <button
                            onClick={() => copiarTexto(e.chave_pix).then(ok => ok ? toast.success(`PIX de ${e.nome} copiado!`) : toast.error("Falha ao copiar"))}
                            className="size-5 rounded flex items-center justify-center text-zinc-400 hover:text-green-600 transition-colors shrink-0">
                            <Copy className="size-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                        <span>🛵 {stat?.qtd ?? 0} entrega{(stat?.qtd ?? 0) !== 1 ? "s" : ""} este mês</span>
                        <span>💰 {fmt(stat?.ganhos ?? 0)}</span>
                      </div>
                      {e.ultima_localizacao ? (
                        <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                          <Navigation className="size-3" />
                          GPS ativo · {new Date(e.ultima_localizacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-zinc-300 mt-1">
                          <Navigation className="size-3" /> Sem GPS
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => compartilharLink(e.public_token, e.nome)} title="Enviar link ao entregador"
                        className="size-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand hover:border-brand/30 transition-colors">
                        <Share2 className="size-3.5" />
                      </button>
                      <a href={`/entregador/${e.public_token}`} target="_blank" rel="noreferrer" title="Abrir página"
                        className="size-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand hover:border-brand/30 transition-colors">
                        <Link className="size-3.5" />
                      </a>
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
        )
      )}
    </>
  );
}
