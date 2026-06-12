import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, User, Phone, ShoppingBag, TrendingUp, Clock, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const { empresaId } = useAuth();
  const [busca, setBusca]         = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("cliente_nome, cliente_telefone, total, created_at, status")
        .eq("empresa_id", empresaId!)
        .neq("status", "cancelado")
        .not("cliente_telefone", "is", null)
        .order("created_at", { ascending: false });

      const mapa: Record<string, {
        nome: string; telefone: string;
        total_pedidos: number; total_gasto: number; ultimo_pedido: string;
      }> = {};

      (data ?? []).forEach((p: any) => {
        const tel = p.cliente_telefone?.trim();
        if (!tel) return;
        if (!mapa[tel]) {
          mapa[tel] = { nome: p.cliente_nome, telefone: tel, total_pedidos: 0, total_gasto: 0, ultimo_pedido: p.created_at };
        }
        mapa[tel].total_pedidos++;
        mapa[tel].total_gasto += Number(p.total ?? 0);
        if (p.created_at > mapa[tel].ultimo_pedido) mapa[tel].ultimo_pedido = p.created_at;
      });

      return Object.values(mapa).sort((a, b) => b.total_gasto - a.total_gasto);
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["cliente-historico", empresaId, expandido],
    enabled: !!empresaId && !!expandido,
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, numero, total, status, created_at, forma_pagamento, cliente_endereco")
        .eq("empresa_id", empresaId!)
        .eq("cliente_telefone" as any, expandido!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const STATUS_COR: Record<string, string> = {
    novo: "bg-blue-100 text-blue-700", aceito: "bg-amber-100 text-amber-700",
    preparo: "bg-orange-100 text-orange-700", entrega: "bg-purple-100 text-purple-700",
    finalizado: "bg-green-100 text-green-700", cancelado: "bg-red-100 text-red-700",
  };
  const STATUS_LABEL: Record<string, string> = {
    novo: "Novo", aceito: "Aceito", preparo: "Preparo",
    entrega: "Em entrega", finalizado: "Entregue", cancelado: "Cancelado",
  };

  const filtrados = busca.trim()
    ? clientes.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.telefone.includes(busca.replace(/\D/g, ""))
      )
    : clientes;

  const totalFaturado = clientes.reduce((s, c) => s + c.total_gasto, 0);
  const totalPedidos  = clientes.reduce((s, c) => s + c.total_pedidos, 0);
  const ticketMedio   = totalPedidos > 0 ? totalFaturado / totalPedidos : 0;
  const recorrentes   = clientes.filter((c) => c.total_pedidos > 1).length;

  return (
    <>
      <PageHeader title="Clientes" subtitle="Histórico e fidelidade dos seus clientes" />

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total de clientes", valor: clientes.length.toString(), icon: "👥" },
          { label: "Clientes recorrentes", valor: recorrentes.toString(), icon: "🔄" },
          { label: "Ticket médio", valor: fmt(ticketMedio), icon: "🎟️" },
          { label: "Total faturado", valor: fmt(totalFaturado), icon: "💰" },
        ].map((c) => (
          <div key={c.label} className="bg-background rounded-2xl ring-1 ring-black/5 p-4">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-xl font-bold text-zinc-900">{c.valor}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nome ou telefone…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-sm text-zinc-400">Carregando clientes…</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 bg-background rounded-2xl ring-1 ring-black/5">
          <User className="size-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">
            {busca ? "Nenhum cliente encontrado." : "Nenhum cliente ainda. Os clientes aparecem aqui após o primeiro pedido."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => {
            const aberto = expandido === c.telefone;
            return (
              <div key={c.telefone} className="bg-background rounded-2xl ring-1 ring-black/5 overflow-hidden">
                <button
                  onClick={() => setExpandido(aberto ? null : c.telefone)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zinc-50/50 transition-colors text-left"
                >
                  <div className="size-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <User className="size-5 text-brand" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">{c.nome}</div>
                    <a
                      href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`}
                      target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-green-600 transition-colors w-fit"
                    >
                      <Phone className="size-3" /> {c.telefone}
                    </a>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-zinc-400 justify-end"><ShoppingBag className="size-3" /> Pedidos</div>
                      <div className="font-bold text-zinc-900">{c.total_pedidos}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-zinc-400 justify-end"><TrendingUp className="size-3" /> Gasto total</div>
                      <div className="font-bold text-zinc-900">{fmt(c.total_gasto)}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-zinc-400 justify-end"><Clock className="size-3" /> Último pedido</div>
                      <div className="text-xs text-zinc-600">
                        {new Date(c.ultimo_pedido).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </div>
                    </div>
                  </div>

                  {c.total_pedidos > 1 && (
                    <span className="hidden sm:inline text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
                      Fiel 🏆
                    </span>
                  )}
                  {aberto ? <ChevronUp className="size-4 text-zinc-400 shrink-0" /> : <ChevronDown className="size-4 text-zinc-400 shrink-0" />}
                </button>

                {/* Stats mobile */}
                <div className="sm:hidden flex items-center gap-3 px-5 pb-3 text-sm">
                  <span className="text-zinc-500">{c.total_pedidos} pedido{c.total_pedidos !== 1 ? "s" : ""}</span>
                  <span className="text-zinc-400">·</span>
                  <span className="font-semibold text-zinc-900">{fmt(c.total_gasto)}</span>
                  {c.total_pedidos > 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Fiel 🏆</span>}
                </div>

                {/* Histórico */}
                {aberto && (
                  <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                    {historico.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-zinc-400 text-center">Carregando…</div>
                    ) : (
                      historico.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3 bg-zinc-50/30">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">Pedido #{p.numero}</div>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                              <Clock className="size-3" />
                              {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              {p.forma_pagamento && <span>· {p.forma_pagamento}</span>}
                            </div>
                            {p.cliente_endereco && (
                              <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{p.cliente_endereco}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${STATUS_COR[p.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                            <span className="text-sm font-bold text-zinc-900">{fmt(Number(p.total))}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
