-- ============================================================
-- Fix: infinite recursion in policy for relation 'entregadores'
--
-- Root cause: cycle between two RLS policies
--   1) "empresa ve entregador de parceria" on entregadores FOR SELECT
--      → subqueries entregador_parcerias
--   2) "entregador ve suas parcerias" on entregador_parcerias FOR SELECT
--      → subqueries entregadores
--   → infinite recursion whenever entregadores is SELECTed
--
-- Fix A: break the cycle using a SECURITY DEFINER helper that queries
--        entregador_parcerias without triggering its RLS policies.
--
-- Fix B: SECURITY DEFINER RPC empresa_atualizar_pedido so the restaurant
--        panel never triggers RLS policies when updating pedidos.
-- ============================================================

SET search_path = public;

-- ── Fix A: break the RLS cycle ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_parceria_empresa_entregador(
  _ent_id UUID,
  _emp_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entregador_parcerias
     WHERE entregador_id = _ent_id
       AND empresa_id    = _emp_id
  );
$$;

-- Recreate the policy using the helper (no direct table access to entregador_parcerias)
DROP POLICY IF EXISTS "empresa ve entregador de parceria" ON public.entregadores;
CREATE POLICY "empresa ve entregador de parceria"
  ON public.entregadores FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    AND public.check_parceria_empresa_entregador(
          entregadores.id,
          public.get_user_empresa_id(auth.uid())
        )
  );

-- ── Fix B: SECURITY DEFINER RPC para o lojista atualizar pedidos ─────────────

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

  UPDATE public.pedidos
     SET status          = COALESCE(p_status,          status),
         entregador_id   = COALESCE(p_entregador_id,   entregador_id),
         entregador_nome = COALESCE(p_entregador_nome, entregador_nome),
         desconto        = COALESCE(p_desconto,        desconto)
   WHERE id = p_pedido_id
     AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_atualizar_pedido(UUID, TEXT, UUID, TEXT, NUMERIC) TO authenticated;
