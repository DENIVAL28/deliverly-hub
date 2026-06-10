import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Bike, Phone, Share2, Link, Navigation } from "lucide-react";
import { copiarTexto } from "@/lib/validacoes";
import { toast } from "sonner";
import { UpgradeGuard, LimiteBanner } from "@/components/UpgradeGuard";
import { PLANO_LIMITS, parsarErroSupabase } from "@/lib/plano";

const MapaEntregadores = lazy(() => import("@/components/MapaEntregadores"));

export const Route = createFileRoute("/_authenticated/empresa/entregadores")({
  component: EntregadoresPage,
});

const STATUS_CONFIG: Record<string, { label: string; cor: string; dot: string }> = {
  disponivel:   { label: "Disponível",   cor: "text-green-600 bg-green-50 border-green-200",  dot: "bg-green-500" },
  em_rota:      { label: "Em rota",      cor: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  indisponivel: { label: "Indisponível", cor: "text-red-600 bg-red-50 border-red-200",         dot: "bg-red-400" },
};

function EntregadoresPage() {
  const { empresaId, plano } = useAuth();
  const limites = PLANO_LIMITS[plano];
  const qc = useQueryClient();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [nome, setNome]         = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);

  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores-admin", empresaId],
    enabled: !!empresaId,
    refetchInterval: 15000,
    queryFn: async () =>
      (await supabase.from("entregadores" as any).select("*").eq("empresa_id", empresaId!).order("nome")).data ?? [],
  });

  // Estatísticas por entregador
  const { data: stats = {} } = useQuery({
    queryKey: ["entregadores-stats", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("entregador_id, total, status")
        .eq("empresa_id", empresaId!)
        .eq("status" as any, "finalizado")
        .not("entregador_id" as any, "is", null);
      const map: Record<string, { qtd: number; total: number }> = {};
      (data ?? []).forEach((p: any) => {
        if (!map[p.entregador_id]) map[p.entregador_id] = { qtd: 0, total: 0 };
        map[p.entregador_id].qtd++;
        map[p.entregador_id].total += Number(p.total ?? 0);
      });
      return map;
    },
  });

  // Realtime — atualiza status dos entregadores ao vivo
  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase.channel(`entregadores-status-${empresaId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "entregadores" },
        () => qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] })
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, qc]);

  async function salvar() {
    if (!nome.trim()) { toast.error("Digite o nome do entregador."); return; }
    setSalvando(true);
    const { error } = await supabase.from("entregadores" as any).insert({
      empresa_id: empresaId!, nome: nome.trim(), telefone: telefone.trim() || null,
    });
    setSalvando(false);
    if (error) { toast.error(parsarErroSupabase(error)); return; }
    setNome(""); setTelefone("");
    qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] });
    toast.success("Entregador cadastrado!");
  }

  async function excluir(id: string) {
    await supabase.from("entregadores" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["entregadores-admin", empresaId] });
    toast.success("Entregador removido");
  }

  function compartilharLink(id: string, nome: string) {
    const url = `${window.location.origin}/entregador/${id}`;
    if (navigator.share) {
      navigator.share({ title: `Acesso do entregador ${nome}`, url });
    } else {
      copiarTexto(url).then(ok => ok ? toast.success("Link copiado! Envie para o entregador.") : toast.error("Falha ao copiar"));
    }
  }

  const ativos   = entregadores.filter((e: any) => e.ativo !== false);
  const inativos = entregadores.filter((e: any) => e.ativo === false);
  const comGps   = entregadores.filter((e: any) => e.lat != null && e.lng != null);

  if (plano === "basico") {
    return <UpgradeGuard feature="Entregadores" minPlano="profissional" descricao="Gerencie sua equipe de entregadores com status ao vivo. Disponível a partir do plano Profissional." />;
  }

  return (
    <>
      <PageHeader title="Entregadores" subtitle="Gerencie sua equipe — status ao vivo" />
      {limites.entregadores !== null && (
        <LimiteBanner atual={ativos.length} limite={limites.entregadores} tipo="entregadores" minPlano="premium" />
      )}

      {/* Botão mapa */}
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={() => setMostrarMapa((v) => !v)} className="gap-2">
          <Navigation className="size-3.5" />
          {mostrarMapa ? "Fechar mapa" : "Mapa ao vivo"}
          {comGps.length > 0 && !mostrarMapa && (
            <span className="ml-1 size-4 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
              {comGps.length}
            </span>
          )}
        </Button>
      </div>

      {/* Mapa ao vivo */}
      {mostrarMapa && (
        <div className="bg-background rounded-2xl ring-1 ring-black/5 mb-6 overflow-hidden" style={{ height: "380px" }}>
          {comGps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-zinc-400 gap-2">
              <Navigation className="size-8 text-zinc-200" />
              <p className="font-medium">Nenhum entregador está compartilhando localização.</p>
              <p className="text-xs">O entregador ativa o GPS na sua própria página.</p>
            </div>
          ) : (
            <Suspense fallback={
              <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                Carregando mapa…
              </div>
            }>
              <MapaEntregadores entregadores={entregadores} />
            </Suspense>
          )}
        </div>
      )}

      {/* Formulário */}
      <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 mb-8">
        <h2 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Bike className="size-4 text-brand" /> Novo entregador
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input placeholder="Ex: João Silva" value={nome} onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone <span className="text-zinc-400">(opcional)</span></Label>
            <Input placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={salvar} disabled={salvando} className="w-full bg-brand hover:bg-brand/90 gap-2">
              <Plus className="size-4" /> Cadastrar
            </Button>
          </div>
        </div>
      </div>

      {/* Lista */}
      {entregadores.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
          <Bike className="size-10 mx-auto mb-3 text-zinc-200" />
          Nenhum entregador cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {ativos.map((e: any) => {
            const st = STATUS_CONFIG[e.status ?? "disponivel"];
            const stat = (stats as any)[e.id];
            return (
              <div key={e.id} className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center">
                      <Bike className="size-6 text-brand" />
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white ${st.dot} ${e.status === "disponivel" ? "animate-pulse" : ""}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900">{e.nome}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cor}`}>
                        {st.label}
                      </span>
                    </div>
                    {e.telefone && (
                      <a href={`https://wa.me/55${e.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-green-600 transition-colors mt-0.5">
                        <Phone className="size-3" /> {e.telefone}
                      </a>
                    )}
                    {/* Stats */}
                    {stat && (
                      <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                        <span>🛵 {stat.qtd} entrega{stat.qtd !== 1 ? "s" : ""}</span>
                        <span>💰 {fmt(stat.total)} entregue</span>
                      </div>
                    )}
                    {/* GPS indicator */}
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

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => compartilharLink(e.id, e.nome)}
                      title="Copiar link do entregador"
                      className="size-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand hover:border-brand/30 transition-colors">
                      <Share2 className="size-3.5" />
                    </button>
                    <a href={`/entregador/${e.id}`} target="_blank" rel="noreferrer"
                      title="Abrir página do entregador"
                      className="size-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand hover:border-brand/30 transition-colors">
                      <Link className="size-3.5" />
                    </a>
                    <button onClick={() => excluir(e.id)}
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
  );
}
