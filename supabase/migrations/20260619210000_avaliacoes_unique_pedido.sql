-- Impede múltiplas avaliações do mesmo pedido.
-- Se já existirem duplicatas, mantém apenas a mais recente por pedido.

DELETE FROM public.avaliacoes a
  USING public.avaliacoes b
 WHERE a.pedido_id = b.pedido_id
   AND a.created_at < b.created_at
   AND a.pedido_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_pedido_id_unique_idx
  ON public.avaliacoes (pedido_id)
  WHERE pedido_id IS NOT NULL;
