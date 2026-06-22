-- Adiciona chave de idempotência à tabela pedidos para prevenir pedidos duplicados em retry.
-- O índice parcial (WHERE NOT NULL) permite que pedidos sem chave coexistam livremente.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_idempotency_key_idx
  ON public.pedidos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
