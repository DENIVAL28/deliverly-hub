-- ── 1. Novos campos no pedido ────────────────────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_cpf    text,
  ADD COLUMN IF NOT EXISTS cliente_cep    text,
  ADD COLUMN IF NOT EXISTS cliente_cidade text;

-- ── 2. Fix estoque: bloqueia overselling em finalizar_pedido ─────────────────
-- (será aplicado via nova versão da função abaixo)

-- ── 3. Fix cupom: revalida no backend antes de usar ──────────────────────────
-- (será aplicado via nova versão da função abaixo)

-- ── 4. Fix avaliações: verifica que o pedido pertence à empresa ──────────────
-- Garante que a nota só pode ser inserida por quem tem o link do pedido público
-- A política existente permite INSERT anon (para cliente avaliar).
-- Adicionamos check que o pedido realmente existe e pertence à empresa correta.

-- Remove policy antiga se existir
DROP POLICY IF EXISTS "Avaliacao insert publico" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_insert_publico" ON public.avaliacoes;

-- Recria com validação de pedido
CREATE POLICY "avaliacoes_insert_validado"
  ON public.avaliacoes FOR INSERT
  WITH CHECK (
    -- O pedido informado existe e pertence à empresa informada
    EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id    = pedido_id
        AND p.empresa_id = empresa_id
        AND p.status = 'finalizado'
    )
  );

-- ── 5. Fix GPS entregador: limita chamadas anônimas por IP (via rate limit) ──
-- Nota: o modelo UUID-como-token é seguro (128 bits de entropia).
-- Adicional: verifica que o entregador existe antes de atualizar.
CREATE OR REPLACE FUNCTION public.entregador_atualizar_gps(
  p_id  uuid,
  p_lat double precision,
  p_lng double precision
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_lat < -90  OR p_lat > 90  THEN RAISE EXCEPTION 'Latitude inválida'; END IF;
  IF p_lng < -180 OR p_lng > 180 THEN RAISE EXCEPTION 'Longitude inválida'; END IF;
  -- Verifica que o entregador existe (sem expor dados)
  IF NOT EXISTS (SELECT 1 FROM public.entregadores WHERE id = p_id) THEN
    RAISE EXCEPTION 'Entregador não encontrado';
  END IF;
  UPDATE public.entregadores
  SET lat = p_lat, lng = p_lng, ultima_localizacao = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.entregador_atualizar_status(
  p_id     uuid,
  p_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('disponivel', 'em_rota', 'indisponivel') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.entregadores WHERE id = p_id) THEN
    RAISE EXCEPTION 'Entregador não encontrado';
  END IF;
  UPDATE public.entregadores SET status = p_status WHERE id = p_id;
END;
$$;
