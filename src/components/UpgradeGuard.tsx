import { Lock, ArrowRight } from "lucide-react";
import type { Plano } from "@/lib/plano";
import { PLANO_LABEL } from "@/lib/plano";

const WHATSAPP = "5566981289787";

interface Props {
  feature: string;
  descricao?: string;
  minPlano: Plano;
}

export function UpgradeGuard({ feature, descricao, minPlano }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="size-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-5">
        <Lock className="size-7 text-orange-400" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 mb-2">{feature} não disponível no seu plano</h2>
      <p className="text-sm text-zinc-500 max-w-[40ch] mb-6">
        {descricao ?? `Faça upgrade para o plano ${PLANO_LABEL[minPlano]} e desbloqueie ${feature.toLowerCase()}.`}
      </p>
      <a
        href={`https://wa.me/${WHATSAPP}?text=Olá! Quero fazer upgrade para o plano ${PLANO_LABEL[minPlano]}.`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3 rounded-xl transition-all hover:scale-[1.02]"
      >
        Fazer upgrade — Plano {PLANO_LABEL[minPlano]} <ArrowRight className="size-4" />
      </a>
    </div>
  );
}

interface BannerProps {
  atual: number;
  limite: number;
  tipo: string;
  minPlano: Plano;
}

export function LimiteBanner({ atual, limite, tipo, minPlano }: BannerProps) {
  const restam = limite - atual;
  const quaseEsgotado = restam <= Math.ceil(limite * 0.2);
  if (!quaseEsgotado) return null;
  return (
    <div className="mb-6 flex items-center justify-between gap-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
      <div className="text-sm text-orange-800">
        <strong>Atenção:</strong> você usou {atual} de {limite} {tipo} do plano {PLANO_LABEL["basico"]}.{" "}
        {restam <= 0 ? `Limite atingido.` : `Restam ${restam}.`}
      </div>
      <a
        href={`https://wa.me/${WHATSAPP}?text=Quero fazer upgrade para o plano ${PLANO_LABEL[minPlano]}.`}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-xs font-bold bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-400 transition-colors"
      >
        Fazer upgrade
      </a>
    </div>
  );
}
