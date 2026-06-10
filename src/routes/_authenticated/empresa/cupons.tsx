import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { LimiteBanner } from "@/components/UpgradeGuard";
import { PLANO_LIMITS, limiteAtingido, parsarErroSupabase } from "@/lib/plano";

export const Route = createFileRoute("/_authenticated/empresa/cupons")({
  component: CuponsPage,
});

function CuponsPage() {
  const { empresaId, plano } = useAuth();
  const limites = PLANO_LIMITS[plano];
  const qc = useQueryClient();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [codigo, setCodigo]     = useState("");
  const [tipo, setTipo]         = useState<"percentual" | "fixo">("percentual");
  const [valor, setValor]       = useState("");
  const [usosMax, setUsosMax]   = useState("");
  const [validade, setValidade] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: cupons = [] } = useQuery({
    queryKey: ["cupons", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("cupons").select("*").eq("empresa_id", empresaId!).order("created_at", { ascending: false })).data ?? [],
  });

  async function salvar() {
    if (!codigo.trim() || !valor) { toast.error("Preencha o código e o valor."); return; }
    setSalvando(true);
    const { error } = await supabase.from("cupons").insert({
      empresa_id: empresaId!,
      codigo: codigo.trim().toUpperCase(),
      tipo,
      valor: Number(valor),
      usos_max: usosMax ? Number(usosMax) : null,
      validade: validade ? new Date(validade).toISOString() : null,
    });
    setSalvando(false);
    if (error) { toast.error(parsarErroSupabase(error)); return; }
    setCodigo(""); setValor(""); setUsosMax(""); setValidade("");
    qc.invalidateQueries({ queryKey: ["cupons", empresaId] });
    toast.success("Cupom criado!");
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("cupons").update({ ativo: !ativo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["cupons", empresaId] });
  }

  async function excluir(id: string) {
    await supabase.from("cupons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cupons", empresaId] });
    toast.success("Cupom excluído");
  }

  const atingiuLimite = limiteAtingido(cupons.length, limites.cupons);

  return (
    <>
      <PageHeader title="Cupons de desconto" subtitle="Crie códigos promocionais para seus clientes" />
      {limites.cupons !== null && (
        <LimiteBanner atual={cupons.length} limite={limites.cupons} tipo="cupons" minPlano="profissional" />
      )}

      {/* Formulário novo cupom */}
      <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 mb-8">
        <h2 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Tag className="size-4 text-brand" /> Novo cupom
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input
              placeholder="EX: PROMO10"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              className="uppercase font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</Label>
            <Input
              type="number"
              min="0"
              max={tipo === "percentual" ? "100" : undefined}
              placeholder={tipo === "percentual" ? "10" : "5,00"}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Usos máximos <span className="text-zinc-400">(vazio = ilimitado)</span></Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 50"
              value={usosMax}
              onChange={(e) => setUsosMax(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Validade <span className="text-zinc-400">(vazio = sem prazo)</span></Label>
            <Input
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={salvar} disabled={salvando || atingiuLimite} className="w-full bg-brand hover:bg-brand/90 gap-2">
              <Plus className="size-4" /> Criar cupom
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de cupons */}
      {cupons.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
          <Tag className="size-10 mx-auto mb-3 text-zinc-200" />
          Nenhum cupom criado ainda.
        </div>
      ) : (
        <div className="bg-background rounded-2xl ring-1 ring-black/5 divide-y divide-zinc-50">
          {cupons.map((c: any) => {
            const expirado = c.validade && new Date(c.validade) < new Date();
            const esgotado = c.usos_max && c.usos_atual >= c.usos_max;
            return (
              <div key={c.id} className={`flex items-center justify-between px-5 py-4 ${!c.ativo || expirado || esgotado ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className="font-mono font-bold text-zinc-900 text-base tracking-wider bg-zinc-100 px-3 py-1 rounded-lg">
                    {c.codigo}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">
                      {c.tipo === "percentual" ? `${c.valor}% de desconto` : `${fmt(c.valor)} de desconto`}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                      <span>{c.usos_atual} uso{c.usos_atual !== 1 ? "s" : ""}{c.usos_max ? ` / ${c.usos_max}` : ""}</span>
                      {c.validade && <span>· Válido até {new Date(c.validade).toLocaleDateString("pt-BR")}</span>}
                      {expirado && <span className="text-red-500 font-medium">· Expirado</span>}
                      {esgotado && <span className="text-red-500 font-medium">· Esgotado</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAtivo(c.id, c.ativo)}
                    className="text-zinc-400 hover:text-brand transition-colors">
                    {c.ativo ? <ToggleRight className="size-6 text-brand" /> : <ToggleLeft className="size-6" />}
                  </button>
                  <button onClick={() => excluir(c.id)}
                    className="text-zinc-300 hover:text-red-500 transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
