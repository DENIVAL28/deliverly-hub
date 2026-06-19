-- RPC SECURITY DEFINER para o lojista buscar seus pedidos ativos + itens.
-- Substitui a query direta em pedidos + pedido_itens que dependia de RLS.
-- Retorna os itens como JSONB array para evitar múltiplos round-trips.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.empresa_pedidos_ativos()
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_telefone TEXT,
  cliente_endereco TEXT,
  total            NUMERIC,
  subtotal         NUMERIC,
  desconto         NUMERIC,
  taxa_entrega     NUMERIC,
  status           TEXT,
  tipo             TEXT,
  forma_pagamento  TEXT,
  observacao       TEXT,
  entregador_id    UUID,
  entregador_nome  TEXT,
  mesa             TEXT,
  created_at       TIMESTAMPTZ,
  pedido_itens     JSONB
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE v_empresa UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.numero,
      p.cliente_nome,
      p.cliente_telefone,
      p.cliente_endereco,
      p.total,
      p.subtotal,
      p.desconto,
      p.taxa_entrega,
      p.status::text,
      p.tipo,
      p.forma_pagamento,
      p.observacao,
      p.entregador_id,
      p.entregador_nome,
      p.mesa,
      p.created_at,
      COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
              'id',              i.id,
              'nome',            i.nome,
              'quantidade',      i.quantidade,
              'preco_unitario',  i.preco_unitario,
              'subtotal',        i.subtotal,
              'observacao',      i.observacao,
              'requer_preparo',  i.requer_preparo
            )
          )
          FROM public.pedido_itens i
         WHERE i.pedido_id = p.id
        ),
        '[]'::jsonb
      ) AS pedido_itens
    FROM public.pedidos p
   WHERE p.empresa_id = v_empresa
     AND p.status IN (
       'aguardando_confirmacao', 'aguardando_pagamento',
       'novo', 'aceito', 'preparo', 'entrega'
     )
   ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_pedidos_ativos() TO authenticated;
