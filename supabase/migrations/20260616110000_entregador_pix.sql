-- Chave PIX do entregador para repasse direto do estabelecimento
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS chave_pix      TEXT,
  ADD COLUMN IF NOT EXISTS tipo_chave_pix TEXT DEFAULT 'aleatoria';
