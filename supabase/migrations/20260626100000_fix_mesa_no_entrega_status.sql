-- Bloqueia pedidos de mesa de atingirem status "entrega" (mesa não tem entregador).
-- Também garante que ao toglar categoria para sem_preparo os produtos herdem o valor.

SET search_path = public;

-- ── Protege empresa_atualizar_pedido contra status "entrega" em pedidos de mesa ──
CREATE OR REPLACE FUNCTION public.empresa_atualizar_pedido(
  p_pedido_id              UUID,
  p_status                 TEXT    DEFAULT NULL,
  p_entregador_id          UUID    DEFAULT NULL,
  p_entregador_nome        TEXT    DEFAULT NULL,
  p_desconto               NUMERIC DEFAULT NULL,
  p_motivo_cancelamento    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa      UUID;
  v_status_atual TEXT;
  v_tipo_pedido  TEXT;
  v_cupom_id     UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN (
    'aguardando_confirmacao', 'aguardando_pagamento', 'novo',
    'aceito', 'preparo', 'entrega', 'finalizado', 'cancelado'
  ) THEN
    RETURN jsonb_build_object('error', 'Status inválido');
  END IF;

  IF p_status = 'cancelado' AND (p_motivo_cancelamento IS NULL OR trim(p_motivo_cancelamento) = '') THEN
    RETURN jsonb_build_object('error', 'Informe o motivo do cancelamento');
  END IF;

  IF p_status IS NOT NULL THEN
    SELECT status::TEXT, tipo, cupom_id
      INTO v_status_atual, v_tipo_pedido, v_cupom_id
      FROM public.pedidos
     WHERE id = p_pedido_id AND empresa_id = v_empresa;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Pedido não encontrado');
    END IF;

    -- Pedidos de mesa, retirada e PDV nunca vão para "entrega" (não há entregador)
    IF p_status = 'entrega' AND v_tipo_pedido IN ('mesa', 'retirada', 'pdv', 'balcao') THEN
      RETURN jsonb_build_object('error', 'Este tipo de pedido não usa entregador');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_status_transitions
       WHERE status_de = v_status_atual AND status_para = p_status
    ) THEN
      RETURN jsonb_build_object(
        'error', 'Transição de status inválida: ' || v_status_atual || ' → ' || p_status
      );
    END IF;

    IF p_status = 'cancelado' THEN
      UPDATE public.produtos pr
         SET estoque = COALESCE(pr.estoque, 0) + pi.quantidade
        FROM public.pedido_itens pi
       WHERE pi.pedido_id  = p_pedido_id
         AND pi.produto_id = pr.id
         AND pr.controlar_estoque = true;

      IF v_cupom_id IS NOT NULL THEN
        UPDATE public.cupons
           SET usos_atual = GREATEST(0, COALESCE(usos_atual, 0) - 1)
         WHERE id = v_cupom_id;
      END IF;
    END IF;
  END IF;

  -- Bloqueia finalização em modo plataforma quando entregador tem o pedido
  IF p_status = 'finalizado' AND EXISTS (
    SELECT 1
      FROM public.pedidos p2
      JOIN public.empresas e2 ON e2.id = p2.empresa_id
     WHERE p2.id         = p_pedido_id
       AND p2.empresa_id = v_empresa
       AND p2.status     = 'entrega'
       AND COALESCE(e2.tipo_operacao_entrega, 'plataforma') != 'fixos'
  ) THEN
    RETURN jsonb_build_object('error', 'Pedido em rota — apenas o entregador pode finalizar');
  END IF;

  UPDATE public.pedidos
     SET status              = COALESCE(p_status::pedido_status,  status),
         entregador_id       = COALESCE(p_entregador_id,          entregador_id),
         entregador_nome     = COALESCE(p_entregador_nome,        entregador_nome),
         desconto            = COALESCE(p_desconto,               desconto),
         motivo_cancelamento = COALESCE(p_motivo_cancelamento,    motivo_cancelamento),
         cancelado_por       = CASE WHEN p_status = 'cancelado' THEN 'lojista' ELSE cancelado_por END,
         cancelado_em        = CASE WHEN p_status = 'cancelado' THEN now()     ELSE cancelado_em  END,
         cliente_lat         = CASE WHEN p_status = 'finalizado' THEN NULL ELSE cliente_lat END,
         cliente_lng         = CASE WHEN p_status = 'finalizado' THEN NULL ELSE cliente_lng END
   WHERE id = p_pedido_id
     AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  IF p_status = 'cancelado' THEN
    INSERT INTO public.cancelamento_log (pedido_id, cancelado_por, motivo, status_no_momento)
    VALUES (p_pedido_id, 'lojista', trim(p_motivo_cancelamento), v_status_atual);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_atualizar_pedido(UUID, TEXT, UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ── Propaga requer_preparo=false de categorias para produtos (corrige herança retroativa) ──
-- Só sincroniza para false (sem preparo): produtos que ainda estão em true por default
-- mas cuja categoria já foi marcada como sem preparo pelo lojista.
UPDATE public.produtos p
   SET requer_preparo = false
  FROM public.categorias c
 WHERE p.categoria_id = c.id
   AND c.requer_preparo = false
   AND p.requer_preparo = true;
