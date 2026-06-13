import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, QrCode, Trash2, Users, X, ShoppingBag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/empresa/mesas")({
  ssr: false,
  component: MesasPage,
});

interface Mesa { id: string; numero: number; nome: string | null; capacidade: number; qr_token: string; ativa: boolean }
interface PedidoMesa { id: string; numero: number; status: string; total: number; created_at: string }

const STATUS_MESA = {
  livre:     { label: "Livre",              bg: "bg-green-50",  border: "border-green-200", badge: "bg-green-100 text-green-700" },
  ocupada:   { label: "Ocupada",            bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" },
  aguardando:{ label: "Aguard. pagamento",  bg: "bg-amber-50",  border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
};

function statusDaMesa(pedidos: PedidoMesa[]): keyof typeof STATUS_MESA {
  const ativos = pedidos.filter(p => !["finalizado", "cancelado"].includes(p.status));
  if (!ativos.length) return "livre";
  if (ativos.every(p => p.status === "preparo" || p.status === "entrega")) return "aguardando";
  return "ocupada";
}

function MesasPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [qrMesa, setQrMesa] = useState<Mesa | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [novaNumero, setNovaNumero] = useState("");
  const [novaNome, setNovaNome] = useState("");
  const [novaCapacidade, setNovaCapacidade] = useState("4");
  const [adicionando, setAdicionando] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pedidosPorMesa, setPedidosPorMesa] = useState<Record<string, PedidoMesa[]>>({});
  const [slug, setSlug] = useState<string>("");
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data: mesas = [] } = useQuery<Mesa[]>({
    queryKey: ["mesas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mesas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativa", true)
        .order("numero");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!empresaId) return;
    supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle()
      .then(({ data }) => { if (data?.slug) setSlug(data.slug); });
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || !mesas.length) return;
    const numeros = mesas.map(m => m.numero.toString());
    supabase.from("pedidos")
      .select("id,numero,status,total,created_at,mesa")
      .eq("empresa_id", empresaId)
      .not("mesa", "is", null)
      .not("status", "in", '("finalizado","cancelado")')
      .then(({ data }) => {
        const map: Record<string, PedidoMesa[]> = {};
        numeros.forEach(n => { map[n] = []; });
        for (const p of data ?? []) {
          const n = (p.mesa ?? "").replace(/\D/g, "");
          if (n && map[n] !== undefined) map[n].push(p as any);
        }
        setPedidosPorMesa(map);
      });
  }, [mesas, empresaId]);

  async function abrirQR(mesa: Mesa) {
    setQrMesa(mesa);
    const url = `${window.location.origin}/loja/${slug}?mesa=${mesa.numero}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#111827", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
  }

  async function adicionarMesa() {
    if (!novaNumero || !empresaId) return;
    setAdicionando(true);
    const { error } = await (supabase as any).from("mesas").insert({
      empresa_id: empresaId,
      numero: parseInt(novaNumero),
      nome: novaNome || null,
      capacidade: parseInt(novaCapacidade) || 4,
    });
    setAdicionando(false);
    if (error) { toast.error(error.code === "23505" ? `Mesa ${novaNumero} já existe.` : error.message); return; }
    toast.success(`Mesa ${novaNumero} adicionada!`);
    setNovaNumero(""); setNovaNome(""); setNovaCapacidade("4"); setShowForm(false);
    qc.invalidateQueries({ queryKey: ["mesas"] });
  }

  async function removerMesa(id: string, numero: number) {
    if (!confirm(`Remover Mesa ${numero}?`)) return;
    await (supabase as any).from("mesas").update({ ativa: false }).eq("id", id);
    toast.success(`Mesa ${numero} removida.`);
    qc.invalidateQueries({ queryKey: ["mesas"] });
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader title="Mesas" subtitle="Gerencie mesas e gere QR Codes para pedidos de mesa">
        <Button onClick={() => setShowForm(v => !v)} className="gap-2 bg-orange-500 hover:bg-orange-400 text-white">
          <Plus className="size-4" /> Nova mesa
        </Button>
      </PageHeader>

      {/* Form nova mesa */}
      {showForm && (
        <div className="bg-background rounded-xl ring-1 ring-black/5 p-5 mb-6">
          <h3 className="text-sm font-semibold text-ink mb-4">Adicionar mesa</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Número *</label>
              <input type="number" min="1" value={novaNumero} onChange={e => setNovaNumero(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="1" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Nome (opcional)</label>
              <input type="text" value={novaNome} onChange={e => setNovaNome(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Varanda" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Capacidade</label>
              <input type="number" min="1" value={novaCapacidade} onChange={e => setNovaCapacidade(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="4" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={adicionarMesa} disabled={adicionando || !novaNumero} className="bg-orange-500 hover:bg-orange-400 text-white">
              {adicionando ? "Salvando…" : "Salvar mesa"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Grid de mesas */}
      {mesas.length === 0 ? (
        <div className="bg-background rounded-xl ring-1 ring-black/5 p-12 text-center">
          <QrCode className="size-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-600 mb-1">Nenhuma mesa cadastrada</p>
          <p className="text-xs text-zinc-400">Adicione mesas para gerar QR Codes e receber pedidos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mesas.map(mesa => {
            const pedidos = pedidosPorMesa[mesa.numero.toString()] ?? [];
            const st = statusDaMesa(pedidos);
            const info = STATUS_MESA[st];
            const totalAtivo = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);
            return (
              <div key={mesa.id} className={`rounded-xl border-2 p-4 ${info.bg} ${info.border}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-2xl font-black text-zinc-900">Mesa {mesa.numero}</p>
                    {mesa.nome && <p className="text-xs text-zinc-500">{mesa.nome}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.badge}`}>{info.label}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500 mb-3">
                  <Users className="size-3" /> {mesa.capacidade} lugares
                </div>
                {pedidos.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {pedidos.map(p => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-zinc-600">Pedido #{p.numero}</span>
                        <span className="font-semibold text-zinc-800">{fmt(p.total)}</span>
                      </div>
                    ))}
                    {pedidos.length > 1 && (
                      <div className="flex justify-between text-xs pt-1 border-t border-zinc-200/50 font-bold">
                        <span>Total</span><span>{fmt(totalAtivo)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => abrirQR(mesa)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                    <QrCode className="size-3.5" /> QR Code
                  </button>
                  <button onClick={() => removerMesa(mesa.id, mesa.numero)}
                    className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-200 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal QR Code */}
      {qrMesa && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" ref={canvasRef}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-zinc-900">QR Code — Mesa {qrMesa.numero}</h3>
              <button onClick={() => { setQrMesa(null); setQrDataUrl(""); }}
                className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                <X className="size-5 text-zinc-500" />
              </button>
            </div>
            {qrMesa.nome && <p className="text-sm text-zinc-500 mb-4">{qrMesa.nome}</p>}
            {qrDataUrl && (
              <div className="flex justify-center mb-4">
                <img src={qrDataUrl} alt={`QR Mesa ${qrMesa.numero}`} className="rounded-xl" style={{ width: 220, height: 220 }} />
              </div>
            )}
            <p className="text-xs text-zinc-400 text-center mb-4">
              Cliente escaneia e faz o pedido direto da mesa.<br />
              URL: <span className="font-mono text-zinc-600">/loja/{slug}?mesa={qrMesa.numero}</span>
            </p>
            <div className="flex gap-2">
              <a href={qrDataUrl} download={`mesa-${qrMesa.numero}.png`}
                className="flex-1 text-center py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-400 transition-colors">
                Baixar PNG
              </a>
              <button onClick={() => { setQrMesa(null); setQrDataUrl(""); }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 text-sm font-semibold hover:bg-zinc-50 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
