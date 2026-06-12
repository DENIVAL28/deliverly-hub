-- Adiciona suporte a cancelamento ao fim do período
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;
