-- Adiciona colunas que foram marcadas como aplicadas mas nunca rodaram
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_lat    double precision,
  ADD COLUMN IF NOT EXISTS cliente_lng    double precision,
  ADD COLUMN IF NOT EXISTS cliente_cpf    text,
  ADD COLUMN IF NOT EXISTS cliente_cep    text,
  ADD COLUMN IF NOT EXISTS cliente_cidade text;
