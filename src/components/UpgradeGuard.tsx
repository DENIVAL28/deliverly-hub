import { Lock, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Plano } from "@/lib/plano";
import { PLANO_LABEL } from "@/lib/plano";
import type { ReactNode } from "react";

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

interface PreviewProps {
  children: ReactNode;
  feature: string;
  minPlano: Plano;
}

export function PreviewBloqueado({ children, feature, minPlano }: PreviewProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-60">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-zinc-100 px-8 py-7 flex flex-col items-center text-center max-w-xs">
          <div className="size-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <Lock className="size-6 text-orange-400" />
          </div>
          <h3 className="font-bold text-zinc-900 text-base mb-1">{feature} bloqueado</h3>
          <p className="text-sm text-zinc-500 mb-5">
            Disponível a partir do plano <strong className="text-zinc-700">{PLANO_LABEL[minPlano]}</strong>.
          </p>
          <Link
            to="/empresa/planos"
            className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-[1.02]"
          >
            Ver planos <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
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
