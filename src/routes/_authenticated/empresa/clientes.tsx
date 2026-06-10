import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, ChevronLeft, ChevronRight, Users,
  Download, Phone, MapPin, ShoppingBag, TrendingUp, Clock,
} from "lucide-react";
import { gerarCSV, baixarCSV, COLUNAS_CLIENTES } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/empresa/clientes")({
  component: ClientesPage,
});

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, string> = {
  novo:       "bg-blue-100 text-blue-700",
  aceito:     "bg-amber-100 text-amber-700",
  preparo:    "bg-orange-100 text-brand",
  entrega:    "bg-purple-100 text-purple-700",
  finalizado: "bg-green-100 text-green-700",
  cancelado:  "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", aceito: "Aceito", preparo: "Em preparo",
  entrega: "Saiu p/ entrega", finalizado: "Finalizado", cancelado: "Cancelado",
};

function ClientesPage() {
  const { empresaId } = useAuth();
  const [busca, setBusca]           = useState("");
  const [pagina, setPagina]         = useState(0);
  const [exportando, setExportando] = useState(false);
  const [clienteSel, setClienteSel] = useState<any>(null);

  useEffect(() => { setPagina(0); }, [busca]);

  // ── Clientes paginados ──────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["clientes", empresaId, pagina, busca],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("*", { count: "exact" })
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .range(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE - 1);
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      const { data: rows, count } = await q;
      return { items: rows ?? [], total: count ?? 0 };
    },
  });

  const items      = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Stats dos clientes visíveis (por telefone) ──────────────
  const telefones = useMemo(
    () => items.map((c: any) => c.telefone).filter(Boolean),
    [items],
  );

  const { data: statsMap = {} } = useQuery({
    queryKey: ["clientes-stats", empresaId, telefones],
    enabled: !!empresaId && telefones.length > 0,
    queryFn: async () => {
      const { data: ped } = await supabase
        .from("pedidos")
        .select("cliente_telefone, total, status, created_at")
        .eq("empresa_id", empresaId!)
        .in("cliente_telefone" as any, telefones);
      const map: Record<string, { qtd: number; total: number; ultimo: string }> = {};
      (ped ?? []).forEach((p: any) => {
        const tel = p.cliente_telefone;
        if (!tel || p.status === "cancelado") return;
        if (!map[tel]) map[tel] = { qtd: 0, total: 0, ultimo: p.created_at };
        map[tel].qtd++;
        map[tel].total += Number(p.total);
        if (p.created_at > map[tel].ultimo) map[tel].ultimo = p.created_at;
      });
      return map;
    },
  });

  // ── Histórico do cliente selecionado ────────────────────────
  const { data: historico = [], isLoading: loadingHist } = useQuery({
    queryKey: ["cliente-historico", clienteSel?.id, empresaId],
    enabled: !!clienteSel && !!empresaId,
    queryFn: async () =>
      (await supabase
        .from("pedidos")
        .select("id, numero, total, status, created_at, forma_pagamento, observacao, pedido_itens(nome, quantidade, subtotal)")
        .eq("empresa_id", empresaId!)
        .eq("cliente_telefone" as any, clienteSel.telefone ?? "")
        .order("created_at", { ascending: false })
        .limit(50)).data ?? [],
  });

  // ── Exportar CSV ────────────────────────────────────────────
  async function exportarCSV() {
    if (!empresaId) return;
    setExportando(true);
    try {
      let q = supabase
        .from("clientes")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      const { data: rows } = await q;
      const csv = gerarCSV((rows ?? []) as any[], COLUNAS_CLIENTES);
      baixarCSV(csv, `clientes_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`);
    } finally {
      setExportando(false);
    }
  }

  const fmt       = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const tempoAtras = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "hoje";
    if (d === 1) return "ontem";
    if (d < 30)  return `${d}d atrás`;
    const m = Math.floor(d / 30);
    return `${m} mes${m > 1 ? "es" : ""} atrás`;
  };

  // ── Stats do modal ──────────────────────────────────────────
  const histStats = useMemo(() => {
    const naoCanc = (historico as any[]).filter((p) => p.status !== "cancelado");
    const totalGasto = naoCanc.reduce((s, p) => s + Number(p.total), 0);
    const ticket = naoCanc.length > 0 ? totalGasto / naoCanc.length : 0;
    const ultimo = naoCanc[0]?.created_at;
    return { qtd: naoCanc.length, totalGasto, ticket, ultimo };
  }, [historico]);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${total} clientes cadastrados`}
        action={
          <Button size="sm" variant="outline" onClick={exportarCSV} disabled={exportando} className="gap-1.5 text-zinc-600">
            <Download className="size-3.5" />
            {exportando ? "Exportando…" : "Exportar CSV"}
          </Button>
        }
      />

      {/* Busca */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="text-center py-16 text-sm text-zinc-400">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-background rounded-2xl ring-1 ring-black/5">
          <Users className="size-10 text-zinc-200 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">
            {busca ? "Nenhum cliente encontrado." : "Nenhum cliente ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c: any) => {
            const st = (statsMap as any)[c.telefone];
            const ticket = st && st.qtd > 0 ? st.total / st.qtd : 0;
            return (
              <div key={c.id}
                className="bg-background rounded-2xl ring-1 ring-black/5 p-5 flex items-start gap-4">

                {/* Avatar */}
                <div className="size-11 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-brand font-bold text-lg">
                    {c.nome?.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-zinc-900 truncate">{c.nome}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {c.telefone && (
                      <a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-green-600 transition-colors">
                        <Phone className="size-3" /> {c.telefone}
                      </a>
                    )}
                    {c.endereco && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500 truncate max-w-[200px]">
                        <MapPin className="size-3 shrink-0" /> {c.endereco}
                      </span>
                    )}
                  </div>

                  {/* Stats inline */}
                  {st ? (
                    <div className="flex flex-wrap gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <ShoppingBag className="size-3 text-brand" />
                        <strong className="text-zinc-800">{st.qtd}</strong> pedido{st.qtd !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <TrendingUp className="size-3 text-green-500" />
                        <strong className="text-zinc-800">{fmt(st.total)}</strong> gasto
                      </span>
                      <span className="text-xs text-zinc-400">
                        Ticket médio: {fmt(ticket)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <Clock className="size-3" /> {tempoAtras(st.ultimo)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 mt-1.5">Sem pedidos registrados</p>
                  )}
                </div>

                {/* Botão histórico */}
                <Button size="sm" variant="outline"
                  onClick={() => setClienteSel(c)}
                  className="shrink-0 text-xs gap-1.5 text-zinc-600 hover:text-brand hover:border-brand/30">
                  Ver histórico
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-zinc-500">
            {pagina * PAGE_SIZE + 1}–{Math.min((pagina + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={pagina === 0}
              onClick={() => setPagina((p) => p - 1)} className="gap-1">
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <span className="text-sm text-zinc-500 px-1">{pagina + 1}/{totalPages}</span>
            <Button size="sm" variant="outline" disabled={pagina >= totalPages - 1}
              onClick={() => setPagina((p) => p + 1)} className="gap-1">
              Próxima <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal histórico ── */}
      <Dialog open={!!clienteSel} onOpenChange={(o) => !o && setClienteSel(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-brand/10 flex items-center justify-center">
                <span className="text-brand font-bold">
                  {clienteSel?.nome?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <div>{clienteSel?.nome}</div>
                <div className="text-sm font-normal text-zinc-500 flex gap-3">
                  {clienteSel?.telefone && (
                    <a href={`https://wa.me/55${clienteSel.telefone.replace(/\D/g,"")}`}
                      target="_blank" rel="noreferrer"
                      className="hover:text-green-600 transition-colors">
                      {clienteSel.telefone}
                    </a>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Stats do cliente */}
          {!loadingHist && histStats.qtd > 0 && (
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-zinc-900">{histStats.qtd}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Pedidos</div>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-zinc-900">{fmt(histStats.totalGasto)}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Total gasto</div>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-zinc-900">{fmt(histStats.ticket)}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Ticket médio</div>
              </div>
            </div>
          )}

          {/* Lista de pedidos */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loadingHist ? (
              <p className="text-sm text-zinc-400 text-center py-8">Carregando histórico…</p>
            ) : historico.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">Nenhum pedido encontrado.</p>
            ) : (
              (historico as any[]).map((p) => (
                <div key={p.id} className="bg-zinc-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 text-sm">#{p.numero}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${STATUS_TONE[p.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    <span className="font-semibold text-zinc-900 text-sm">{fmt(Number(p.total))}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                    <span>{new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    {p.forma_pagamento && <span>• {p.forma_pagamento}</span>}
                  </div>

                  {(p.pedido_itens ?? []).length > 0 && (
                    <ul className="text-xs text-zinc-600 space-y-0.5 border-t border-zinc-100 pt-2">
                      {(p.pedido_itens as any[]).map((i, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{i.quantidade}× {i.nome}</span>
                          <span className="text-zinc-500">{fmt(Number(i.subtotal))}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {p.observacao && (
                    <p className="text-xs text-zinc-500 italic mt-1.5">"{p.observacao}"</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
