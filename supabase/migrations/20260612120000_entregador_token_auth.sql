-- ═══════════════════════════════════════════════════════════════════════════════
-- Autenticação por token para a página pública do entregador
-- Substitui autenticação por UUID interno por public_token opaco
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- Adiciona token público ao entregador
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.entregadores
  DROP CONSTRAINT IF EXISTS entregadores_public_token_unique;
ALTER TABLE public.entregadores
  ADD CONSTRAINT entregadores_public_token_unique UNIQUE (public_token);

-- Restringe SELECT público: anon só acessa entregadores de empresas ativas
DROP POLICY IF EXISTS "Entregador visível publicamente" ON public.entregadores;

CREATE POLICY "Entregador visível por empresa ativa"
  ON public.entregadores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empresas e
       WHERE e.id = empresa_id AND e.status = 'ativa'
    )
    OR public.get_user_empresa_id(auth.uid()) = empresa_id
    OR public.is_master(auth.uid())
  );

-- ── RPCs atualizados: validam por token, não por UUID interno ──────────────────

DROP FUNCTION IF EXISTS public.entregador_atualizar_status(uuid, text);
DROP FUNCTION IF EXISTS public.entregador_atualizar_gps(uuid, double precision, double precision);

CREATE OR REPLACE FUNCTION public.entregador_atualizar_status(
  p_token  uuid,
  p_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_status NOT IN ('disponivel', 'em_rota', 'indisponivel') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  SELECT id INTO v_id
    FROM public.entregadores
   WHERE public_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de entregador inválido.';
  END IF;

  UPDATE public.entregadores SET status = p_status WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.entregador_atualizar_gps(
  p_token uuid,
  p_lat   double precision,
  p_lng   double precision
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_lat < -90  OR p_lat > 90  THEN RAISE EXCEPTION 'Latitude inválida';  END IF;
  IF p_lng < -180 OR p_lng > 180 THEN RAISE EXCEPTION 'Longitude inválida'; END IF;

  SELECT id INTO v_id
    FROM public.entregadores
   WHERE public_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de entregador inválido.';
  END IF;

  UPDATE public.entregadores
     SET lat = p_lat, lng = p_lng, ultima_localizacao = now()
   WHERE id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_atualizar_status(uuid, text)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.entregador_atualizar_gps(uuid, double precision, double precision) TO anon, authenticated;
