import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { ChefHat, Clock, CheckCircle2, Utensils } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa/kds")({
  ssr: false,
  component: KDSPage,
});

interface Item { id: string; quantidade: number; observacao: string | null; produtos: { nome: string } | null }
interface PedidoKDS { id: string; numero: number; status: string; tipo: string | null; mesa: string | null; observacao: string | null; created_at: string; pedido_itens: Item[] }

const COLUNAS = [
  { status: "novo",    label: "Novos",      bg: "bg-blue-950/60",   border: "border-blue-700",   badge: "bg-blue-900 text-blue-300",   btn: "bg-blue-600 hover:bg-blue-500",   label_btn: "Aceitar" },
  { status: "aceito",  label: "Aceitos",    bg: "bg-amber-950/60",  border: "border-amber-700",  badge: "bg-amber-900 text-amber-300", btn: "bg-amber-500 hover:bg-amber-400", label_btn: "Iniciar preparo" },
  { status: "preparo", label: "Em preparo", bg: "bg-orange-950/60", border: "border-orange-700", badge: "bg-orange-900 text-orange-300", btn: "bg-orange-500 hover:bg-orange-400", label_btn: "Marcar pronto ✓" },
];

const NEXT: Record<string, string> = { novo: "aceito", aceito: "preparo", preparo: "finalizado" };

function tempo(dt: string) {
  const s = Math.floor((Date.now() - new Date(dt).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}min`;
}

function KDSPage() {
  const { empresaId } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoKDS[]>([]);
  const [avancando, setAvancando] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 20000);
    return () => clearInterval(t);
  }, []);

  async function carregar() {
    if (!empresaId) return;
    const { data } = await supabase
      .from("pedidos")
      .select("id,numero,status,tipo,mesa,observacao,created_at,pedido_itens(id,quantidade,observacao,produtos(nome))")
      .eq("empresa_id", empresaId)
      .in("status", ["novo", "aceito", "preparo"])
      .order("created_at", { ascending: true });
    setPedidos((data as any) ?? []);
  }

  useEffect(() => {
    carregar();
    if (!empresaId) return;
    const ch = supabase.channel("kds")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId]);

  async function avancar(p: PedidoKDS) {
    const prox = NEXT[p.status];
    if (!prox || avancando) return;
    setAvancando(p.id);
    await supabase.from("pedidos").update({ status: prox }).eq("id", p.id);
    setAvancando(null);
    if (prox === "finalizado") toast.success(`Pedido #${p.numero} finalizado!`);
  }

  const total = pedidos.length;

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-orange-500 flex items-center justify-center">
            <ChefHat className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Cozinha / KDS</h1>
            <p className="text-xs text-zinc-400">{total} pedido{total !== 1 ? "s" : ""} em andamento</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          Tempo real
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUNAS.map(col => {
          const lista = pedidos.filter(p => p.status === col.status);
          return (
            <div key={col.status}>
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 border ${col.bg} ${col.border}`}>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${col.badge}`}>{col.label}</span>
                <span className="text-sm font-bold text-zinc-300">{lista.length}</span>
              </div>
              <div className="space-y-3">
                {lista.length === 0 && (
                  <div className="bg-zinc-900 rounded-xl p-8 text-center border border-zinc-800">
                    <CheckCircle2 className="size-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-600">Nenhum pedido</p>
                  </div>
                )}
                {lista.map(p => (
                  <div key={p.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-black text-xl">#{p.numero}</span>
                        {p.mesa && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">🪑 {p.mesa}</span>}
                        {p.tipo === "retirada" && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">🏃 Retirada</span>}
                        {p.tipo === "pdv" && <span className="text-xs bg-violet-900/60 text-violet-300 px-2 py-0.5 rounded-full">PDV</span>}
                        {p.tipo === "delivery" && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">🛵 Delivery</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                        <Clock className="size-3" />{tempo(p.created_at)}
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {(p.pedido_itens ?? []).map(item => (
                        <div key={item.id} className="flex items-start gap-2">
                          <span className="text-orange-400 font-bold text-base min-w-[1.8rem]">{item.quantidade}×</span>
                          <div>
                            <p className="text-white text-sm font-medium">{item.produtos?.nome ?? "—"}</p>
                            {item.observacao && <p className="text-xs text-zinc-400 mt-0.5">↳ {item.observacao}</p>}
                          </div>
                        </div>
                      ))}
                      {p.observacao && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                          <p className="text-xs text-amber-400">📝 {p.observacao}</p>
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => avancar(p)}
                        disabled={!!avancando}
                        className={`w-full py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${col.btn} disabled:opacity-50`}
                      >
                        {avancando === p.id ? "…" : col.label_btn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {total === 0 && (
        <div className="mt-24 text-center">
          <Utensils className="size-16 text-zinc-800 mx-auto mb-4" />
          <p className="text-zinc-500 text-lg font-semibold">Cozinha tranquila</p>
          <p className="text-zinc-700 text-sm mt-1">Nenhum pedido em andamento agora</p>
        </div>
      )}
    </div>
  );
}
