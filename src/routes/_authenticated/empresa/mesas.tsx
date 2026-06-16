import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, QrCode, Trash2, Users, X, Download, TableProperties } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/empresa/mesas")({
  ssr: false,
  component: MesasPage,
});

interface Mesa { id: string; numero: number; nome: string | null; capacidade: number; qr_token: string; ativa: boolean }
interface PedidoMesa { id: string; numero: number; status: string; total: number }

const STATUS_MESA = {
  livre:      { label: "Livre",             cor: "bg-emerald-500" },
  ocupada:    { label: "Ocupada",           cor: "bg-orange-500" },
  aguardando: { label: "Aguard. pgto",      cor: "bg-amber-500" },
};

function statusDaMesa(pedidos: PedidoMesa[]): keyof typeof STATUS_MESA {
  const ativos = pedidos.filter(p => !["finalizado", "cancelado"].includes(p.status));
  if (!ativos.length) return "livre";
  // "Aguard. pgto" só quando todos os pedidos já foram entregues à mesa (status entrega)
  if (ativos.every(p => p.status === "entrega")) return "aguardando";
  return "ocupada";
}

function MesasPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [qrMesa, setQrMesa] = useState<Mesa | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [nomeEmpresa, setNomeEmpresa] = useState<string>("");
  const [novaNumero, setNovaNumero] = useState("");
  const [novaNome, setNovaNome] = useState("");
  const [novaCapacidade, setNovaCapacidade] = useState("4");
  const [loteAte, setLoteAte] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [modoLote, setModoLote] = useState(false);
  const [pedidosPorMesa, setPedidosPorMesa] = useState<Record<string, PedidoMesa[]>>({});
  const [slug, setSlug] = useState<string>("");

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
    supabase.from("empresas").select("slug,nome_fantasia").eq("id", empresaId).maybeSingle()
      .then(({ data }) => {
        if (data?.slug) setSlug(data.slug);
        if (data?.nome_fantasia) setNomeEmpresa(data.nome_fantasia);
      });
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || !mesas.length) return;
    supabase.from("pedidos")
      .select("id,numero,status,total,mesa")
      .eq("empresa_id", empresaId)
      .not("mesa", "is", null)
      .not("status", "in", '("finalizado","cancelado")')
      .then(({ data }) => {
        const map: Record<string, PedidoMesa[]> = {};
        mesas.forEach(m => { map[m.numero.toString()] = []; });
        for (const p of data ?? []) {
          const n = String(p.mesa ?? "").replace(/\D/g, "");
          if (n && map[n] !== undefined) map[n].push(p as any);
        }
        setPedidosPorMesa(map);
      });
  }, [mesas, empresaId]);

  async function abrirQR(mesa: Mesa) {
    setQrMesa(mesa);
    const url = `${window.location.origin}/loja/${slug}?mesa=${mesa.numero}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    });
    setQrDataUrl(dataUrl);
  }

  async function adicionarMesa() {
    if (!novaNumero || !empresaId) return;
    setAdicionando(true);

    if (modoLote && loteAte) {
      const de  = parseInt(novaNumero);
      const ate = parseInt(loteAte);
      if (isNaN(de) || isNaN(ate) || de > ate || ate - de > 49) {
        toast.error("Intervalo inválido (máx. 50 mesas por vez).");
        setAdicionando(false);
        return;
      }
      const rows = Array.from({ length: ate - de + 1 }, (_, i) => ({
        empresa_id: empresaId,
        numero: de + i,
        nome: null,
        capacidade: parseInt(novaCapacidade) || 4,
        ativa: true,
      }));
      const { error } = await (supabase as any).from("mesas").insert(rows);
      setAdicionando(false);
      if (error) {
        if (error.code === "23505") toast.error("Algumas mesas nesse intervalo já existem. Tente um intervalo diferente ou remova as existentes primeiro.");
        else toast.error(error.message);
        return;
      }
      toast.success(`${rows.length} mesas criadas (${de} até ${ate})!`);
      setNovaNumero(""); setLoteAte(""); setNovaCapacidade("4"); setShowForm(false);
      qc.invalidateQueries({ queryKey: ["mesas"] });
      return;
    }

    const { error } = await (supabase as any).from("mesas").insert({
      empresa_id: empresaId,
      numero: parseInt(novaNumero),
      nome: novaNome || null,
      capacidade: parseInt(novaCapacidade) || 4,
      ativa: true,
    });
    setAdicionando(false);
    if (error) {
      toast.error(error.code === "23505" ? `Mesa ${novaNumero} já existe.` : error.message);
      return;
    }
    toast.success(`Mesa ${novaNumero} adicionada!`);
    setNovaNumero(""); setNovaNome(""); setNovaCapacidade("4"); setShowForm(false);
    qc.invalidateQueries({ queryKey: ["mesas"] });
  }

  async function removerMesa(id: string, numero: number) {
    if (!confirm(`Remover Mesa ${numero}?`)) return;
    await (supabase as any).from("mesas").delete().eq("id", id);
    toast.success(`Mesa ${numero} removida.`);
    qc.invalidateQueries({ queryKey: ["mesas"] });
  }

  function imprimirQR() {
    const win = window.open("", "_blank");
    if (!win || !qrMesa) return;
    win.document.write(`
      <html><head><title>QR Mesa ${qrMesa.numero}</title>
      <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; border-radius: 16px; padding: 32px 40px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 320px; }
        .numero { font-size: 48px; font-weight: 900; color: #111; margin-bottom: 4px; }
        .nome { font-size: 16px; color: #666; margin-bottom: 20px; }
        img { width: 240px; height: 240px; display: block; margin: 0 auto 16px; }
        .instrucao { font-size: 13px; color: #555; line-height: 1.5; }
        .marca { font-size: 12px; color: #aaa; margin-top: 16px; }
      </style></head>
      <body><div class="card">
        <div class="numero">Mesa ${qrMesa.numero}</div>
        ${qrMesa.nome ? `<div class="nome">${qrMesa.nome}</div>` : ""}
        <img src="${qrDataUrl}" />
        <div class="instrucao">Escaneie o QR Code com a câmera do celular e faça seu pedido</div>
        ${nomeEmpresa ? `<div class="marca">${nomeEmpresa}</div>` : ""}
      </div></body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader title="Mesas" subtitle="Gerencie mesas e QR Codes para pedidos no local">
        <Button onClick={() => setShowForm(v => !v)} className="gap-2 bg-brand hover:bg-brand/90 text-white">
          <Plus className="size-4" /> Nova mesa
        </Button>
      </PageHeader>

      {/* Form nova mesa */}
      {showForm && (
        <div className="bg-white rounded-2xl ring-1 ring-zinc-200 p-5 mb-6">
          {/* Tabs individual / lote */}
          <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-4 w-fit">
            <button onClick={() => setModoLote(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${!modoLote ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
              Mesa individual
            </button>
            <button onClick={() => setModoLote(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${modoLote ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
              Adicionar em lote
            </button>
          </div>

          {modoLote ? (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">De (número) *</label>
                <input type="number" min="1" value={novaNumero} onChange={e => setNovaNumero(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50" placeholder="1" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Até (número) *</label>
                <input type="number" min="1" value={loteAte} onChange={e => setLoteAte(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50" placeholder="10" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Capacidade cada</label>
                <input type="number" min="1" value={novaCapacidade} onChange={e => setNovaCapacidade(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50" placeholder="4" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Número *</label>
                <input type="number" min="1" value={novaNumero} onChange={e => setNovaNumero(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50" placeholder="1" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Nome (opcional)</label>
                <input type="text" value={novaNome} onChange={e => setNovaNome(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50" placeholder="Ex: Varanda" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Capacidade</label>
                <input type="number" min="1" value={novaCapacidade} onChange={e => setNovaCapacidade(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50" placeholder="4" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={adicionarMesa} disabled={adicionando || !novaNumero || (modoLote && !loteAte)}
              className="bg-brand hover:bg-brand/90 text-white">
              {adicionando ? "Salvando…" : modoLote ? `Criar mesas ${novaNumero || "?"} até ${loteAte || "?"}` : "Salvar mesa"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Grid de mesas */}
      {mesas.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-zinc-200 p-16 text-center">
          <TableProperties className="size-14 text-zinc-200 mx-auto mb-4" />
          <p className="text-base font-bold text-zinc-700 mb-1">Nenhuma mesa cadastrada</p>
          <p className="text-sm text-zinc-400 mb-6">Adicione as mesas do seu estabelecimento.<br />Cada uma terá um QR Code exclusivo para o cliente fazer o pedido.</p>
          <Button onClick={() => setShowForm(true)} className="bg-brand hover:bg-brand/90 text-white gap-2">
            <Plus className="size-4" /> Adicionar primeira mesa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {(mesas as Mesa[]).map(mesa => {
            const pedidos = pedidosPorMesa[mesa.numero.toString()] ?? [];
            const st = statusDaMesa(pedidos);
            const info = STATUS_MESA[st];
            const totalAtivo = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);

            return (
              <div key={mesa.id} className="bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Header colorido */}
                <div className={`${info.cor} px-4 py-3 flex items-center justify-between`}>
                  <div>
                    <p className="text-white font-black text-xl leading-none">Mesa {mesa.numero}</p>
                    {mesa.nome && <p className="text-white/80 text-xs mt-0.5">{mesa.nome}</p>}
                  </div>
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    {info.label}
                  </span>
                </div>

                {/* Body */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <Users className="size-3" /> {mesa.capacidade} lugares
                  </div>

                  {/* Pedidos ativos */}
                  {pedidos.length > 0 && (
                    <div className="bg-zinc-50 rounded-xl p-2 space-y-1">
                      {pedidos.map(p => (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-zinc-600 font-medium">Pedido #{p.numero}</span>
                          <span className="text-zinc-800 font-bold">{fmt(p.total)}</span>
                        </div>
                      ))}
                      {pedidos.length > 1 && (
                        <div className="flex justify-between text-xs pt-1 border-t border-zinc-200 font-black">
                          <span>Total</span><span>{fmt(totalAtivo)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-1.5">
                    <button onClick={() => abrirQR(mesa)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand/10 text-brand text-xs font-bold hover:bg-brand/20 transition-colors">
                      <QrCode className="size-3.5" /> QR Code
                    </button>
                    <button onClick={() => removerMesa(mesa.id, mesa.numero)}
                      className="p-2 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal QR Code */}
      {qrMesa && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full overflow-hidden">
            {/* Header */}
            <div className="bg-brand px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-medium">QR Code de mesa</p>
                <p className="text-white font-black text-2xl">Mesa {qrMesa.numero}</p>
                {qrMesa.nome && <p className="text-white/70 text-sm">{qrMesa.nome}</p>}
              </div>
              <button onClick={() => { setQrMesa(null); setQrDataUrl(""); }}
                className="size-8 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
                <X className="size-4 text-white" />
              </button>
            </div>

            {/* QR */}
            <div className="px-6 py-6 text-center">
              {qrDataUrl ? (
                <div className="inline-block p-3 bg-white rounded-2xl ring-4 ring-zinc-100 shadow-inner mb-4">
                  <img src={qrDataUrl} alt={`QR Mesa ${qrMesa.numero}`} className="w-52 h-52" />
                </div>
              ) : (
                <div className="w-52 h-52 mx-auto bg-zinc-100 rounded-2xl animate-pulse mb-4" />
              )}

              <p className="text-sm text-zinc-600 font-medium mb-1">
                Cliente escaneia e faz o pedido direto da mesa
              </p>
              <p className="text-xs text-zinc-400 mb-5">
                O pedido aparece automaticamente em <strong>Pedidos</strong> com o número da mesa
              </p>

              {/* Ações */}
              <div className="flex gap-2">
                <a href={qrDataUrl} download={`qr-mesa-${qrMesa.numero}.png`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors">
                  <Download className="size-4" /> Baixar
                </a>
                <button onClick={imprimirQR}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-zinc-200 text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition-colors">
                  🖨️ Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
