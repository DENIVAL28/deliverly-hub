-- Fix: em modo fixos, o próprio estabelecimento finaliza o pedido.
-- A guarda anterior bloqueava qualquer finalização quando entregador_id estava preenchido,
-- forçando o entregador a entrar no portal para finalizar — desnecessário para equipe própria.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.empresa_atualizar_pedido(
  p_pedido_id       UUID,
  p_status          TEXT    DEFAULT NULL,
  p_entregador_id   UUID    DEFAULT NULL,
  p_entregador_nome TEXT    DEFAULT NULL,
  p_desconto        NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
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

  -- Bloqueia lojista de finalizar pedido em rota com entregador ativo,
  -- MAS apenas quando a empresa usa modo "plataforma" (entregadores externos).
  -- Em modo "fixos" (equipe própria) o estabelecimento finaliza diretamente.
  IF p_status = 'finalizado' AND EXISTS (
    SELECT 1
      FROM public.pedidos p2
      JOIN public.empresas e2 ON e2.id = p2.empresa_id
     WHERE p2.id          = p_pedido_id
       AND p2.empresa_id  = v_empresa
       AND p2.status      = 'entrega'
       AND p2.entregador_id IS NOT NULL
       AND COALESCE(e2.tipo_operacao_entrega, 'plataforma') != 'fixos'
  ) THEN
    RETURN jsonb_build_object('error', 'Pedido em rota — apenas o entregador pode finalizar');
  END IF;

  UPDATE public.pedidos
     SET status          = COALESCE(p_status::pedido_status, status),
         entregador_id   = COALESCE(p_entregador_id,        entregador_id),
         entregador_nome = COALESCE(p_entregador_nome,      entregador_nome),
         desconto        = COALESCE(p_desconto,             desconto)
   WHERE id = p_pedido_id
     AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_atualizar_pedido(UUID, TEXT, UUID, TEXT, NUMERIC) TO authenticated;
