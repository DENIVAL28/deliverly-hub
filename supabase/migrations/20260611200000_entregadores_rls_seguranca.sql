-- ================================================
-- RLS + segurança para entregadores
-- ================================================

ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;

-- Leitura pública de um entregador pelo ID (página pública do entregador)
CREATE POLICY "Entregador visível publicamente"
  ON public.entregadores FOR SELECT USING (true);

-- Empresa dona gerencia seus entregadores
CREATE POLICY "Empresa gerencia seus entregadores"
  ON public.entregadores FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Master gerencia todos
CREATE POLICY "Master gerencia entregadores"
  ON public.entregadores FOR ALL TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

-- ── RPCs seguros para a página pública do entregador ──────────────────────────
-- Substitui UPDATE direto (que não tem auth) por funções com validação

CREATE OR REPLACE FUNCTION public.entregador_atualizar_status(
  p_id   uuid,
  p_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('disponivel', 'em_rota', 'indisponivel') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;
  UPDATE public.entregadores SET status = p_status WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.entregador_atualizar_gps(
  p_id  uuid,
  p_lat double precision,
  p_lng double precision
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_lat < -90  OR p_lat > 90  THEN RAISE EXCEPTION 'Latitude inválida'; END IF;
  IF p_lng < -180 OR p_lng > 180 THEN RAISE EXCEPTION 'Longitude inválida'; END IF;
  UPDATE public.entregadores
  SET lat = p_lat, lng = p_lng, ultima_localizacao = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_atualizar_status(uuid, text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.entregador_atualizar_gps(uuid, double precision, double precision) TO anon, authenticated;
