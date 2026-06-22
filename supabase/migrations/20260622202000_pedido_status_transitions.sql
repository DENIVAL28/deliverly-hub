-- Tabela de transições válidas de status de pedido.
-- Garante que nenhuma chamada direta ao RPC possa pular etapas (ex: novo → finalizado).

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.pedido_status_transitions (
  status_de   TEXT NOT NULL,
  status_para TEXT NOT NULL,
  PRIMARY KEY (status_de, status_para)
);

INSERT INTO public.pedido_status_transitions (status_de, status_para) VALUES
  ('novo',                    'aceito'),
  ('novo',                    'cancelado'),
  ('aguardando_confirmacao',  'aceito'),
  ('aguardando_confirmacao',  'aguardando_pagamento'),
  ('aguardando_confirmacao',  'cancelado'),
  ('aguardando_pagamento',    'aceito'),
  ('aguardando_pagamento',    'cancelado'),
  ('aceito',                  'preparo'),
  ('aceito',                  'cancelado'),
  ('preparo',                 'entrega'),
  ('preparo',                 'finalizado'),
  ('preparo',                 'cancelado'),
  ('entrega',                 'finalizado'),
  ('entrega',                 'cancelado')
ON CONFLICT DO NOTHING;

-- Atualiza empresa_atualizar_pedido para validar a transição antes do UPDATE.
-- Baseado na última versão (20260622130000).

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
  v_empresa      UUID;
  v_status_atual TEXT;
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

  -- Valida transição de status usando a tabela pedido_status_transitions
  IF p_status IS NOT NULL THEN
    SELECT status::TEXT INTO v_status_atual
      FROM public.pedidos
     WHERE id = p_pedido_id AND empresa_id = v_empresa;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Pedido não encontrado');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_status_transitions
       WHERE status_de = v_status_atual AND status_para = p_status
    ) THEN
      RETURN jsonb_build_object(
        'error', 'Transição de status inválida: ' || v_status_atual || ' → ' || p_status
      );
    END IF;
  END IF;

  -- Em modo plataforma, qualquer pedido com status "entrega" é bloqueado para o lojista.
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
