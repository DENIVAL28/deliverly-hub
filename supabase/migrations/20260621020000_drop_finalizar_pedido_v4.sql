-- Remove a assinatura antiga de finalizar_pedido (16 parâmetros, sem p_taxa_entrega).
-- A v5 (17 parâmetros) já existe — manter as duas causa erro de ambiguidade no PostgREST.

DROP FUNCTION IF EXISTS public.finalizar_pedido(
  uuid, text, text, text, text, text, text, text,
  uuid, jsonb, double precision, double precision,
  text, text, text, numeric
);
