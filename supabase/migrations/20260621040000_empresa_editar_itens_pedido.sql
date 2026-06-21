-- RPC: lojista remove itens de um pedido ativo e recalcula o total.
-- Retorna o novo total e o valor a reembolsar ao cliente.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.empresa_editar_itens_pedido(
  p_pedido_id   UUID,
  p_remover_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa     UUID;
  v_status      TEXT;
  v_total_atual NUMERIC;
  v_taxa        NUMERIC;
  v_desconto    NUMERIC;
  v_subtotal    NUMERIC;
  v_total_novo  NUMERIC;
  v_reembolso   NUMERIC;
  v_qtd_itens   INT;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;

  -- Valida pedido e pertence à empresa
  SELECT status, total, taxa_entrega, desconto
    INTO v_status, v_total_atual, v_taxa, v_desconto
    FROM public.pedidos
   WHERE id = p_pedido_id AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  IF v_status IN ('finalizado', 'cancelado') THEN
    RETURN jsonb_build_object('error', 'Não é possível editar pedido ' || v_status);
  END IF;

  -- Garante que ao menos 1 item ficará
  SELECT COUNT(*) INTO v_qtd_itens
    FROM public.pedido_itens
   WHERE pedido_id = p_pedido_id
     AND id <> ALL(p_remover_ids);

  IF v_qtd_itens = 0 THEN
    RETURN jsonb_build_object('error', 'O pedido deve ter ao menos 1 item. Para remover tudo, cancele o pedido.');
  END IF;

  -- Remove os itens selecionados
  DELETE FROM public.pedido_itens
   WHERE pedido_id = p_pedido_id
     AND id = ANY(p_remover_ids)
     AND pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id = v_empresa);

  -- Recalcula subtotal com os itens restantes
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM public.pedido_itens
   WHERE pedido_id = p_pedido_id;

  -- Desconto não pode exceder novo subtotal
  v_desconto := LEAST(COALESCE(v_desconto, 0), v_subtotal);
  v_total_novo := GREATEST(0, v_subtotal + COALESCE(v_taxa, 0) - v_desconto);
  v_reembolso  := GREATEST(0, v_total_atual - v_total_novo);

  -- Atualiza o pedido
  UPDATE public.pedidos
     SET subtotal = v_subtotal,
         desconto = v_desconto,
         total    = v_total_novo
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'subtotal',    v_subtotal,
    'total_novo',  v_total_novo,
    'reembolso',   v_reembolso
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_editar_itens_pedido(UUID, UUID[]) TO authenticated;
