import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Star } from "lucide-react";
import { UpgradeGuard } from "@/components/UpgradeGuard";

export const Route = createFileRoute("/_authenticated/empresa/avaliacoes")({
  component: AvaliacoesPage,
});

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <span key={n} className={`text-base ${n <= nota ? "text-yellow-400" : "text-zinc-200"}`}>★</span>
      ))}
    </div>
  );
}

function AvaliacoesPage() {
  const { empresaId, plano } = useAuth();

  if (plano === "basico") {
    return <UpgradeGuard feature="Avaliações" minPlano="profissional" descricao="Veja o que seus clientes estão dizendo sobre cada pedido. Disponível a partir do plano Profissional." />;
  }

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["avaliacoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("avaliacoes").select("*").eq("empresa_id", empresaId!).order("created_at", { ascending: false })).data ?? [],
  });

  const media = avaliacoes.length
    ? avaliacoes.reduce((s: number, a: any) => s + a.nota, 0) / avaliacoes.length
    : 0;

  const contagem = [5,4,3,2,1].map((n) => ({
    nota: n,
    total: avaliacoes.filter((a: any) => a.nota === n).length,
  }));

  return (
    <>
      <PageHeader title="Avaliações" subtitle="Veja o que seus clientes estão dizendo" />

      {avaliacoes.length === 0 ? (
        <div className="text-center py-20 text-sm text-zinc-400 bg-background rounded-2xl ring-1 ring-black/5">
          <Star className="size-10 mx-auto mb-3 text-zinc-200" />
          Nenhuma avaliação ainda.
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-background rounded-2xl ring-1 ring-black/5 p-6 flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-zinc-900">{media.toFixed(1)}</div>
                <Estrelas nota={Math.round(media)} />
                <div className="text-xs text-zinc-400 mt-1">{avaliacoes.length} avaliação{avaliacoes.length !== 1 ? "ões" : ""}</div>
              </div>
              <div className="flex-1 space-y-1.5">
                {contagem.map(({ nota, total }) => (
                  <div key={nota} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-3">{nota}</span>
                    <span className="text-yellow-400 text-xs">★</span>
                    <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-yellow-400 rounded-full transition-all"
                        style={{ width: avaliacoes.length ? `${(total / avaliacoes.length) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-4">{total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-3">
            {avaliacoes.map((a: any) => (
              <div key={a.id} className="bg-background rounded-2xl ring-1 ring-black/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{a.cliente_nome || "Cliente"}</div>
                    <Estrelas nota={a.nota} />
                    {a.comentario && (
                      <p className="text-sm text-zinc-600 mt-2 leading-relaxed">"{a.comentario}"</p>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 shrink-0">
                    {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
