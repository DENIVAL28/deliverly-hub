-- RPC pública (anon) para o cliente acompanhar o GPS do entregador em tempo real.
-- Retorna apenas lat/lng/nome se o pedido estiver no status "entrega".
-- Não expõe dados sensíveis do entregador.

CREATE OR REPLACE FUNCTION public.pedido_rastrear_entregador(p_pedido_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent_id UUID;
  v_lat    FLOAT8;
  v_lng    FLOAT8;
  v_ultima TIMESTAMPTZ;
  v_nome   TEXT;
  v_status TEXT;
BEGIN
  SELECT p.entregador_id, p.status::text
    INTO v_ent_id, v_status
    FROM public.pedidos p
   WHERE p.id = p_pedido_id;

  IF NOT FOUND OR v_ent_id IS NULL THEN
    RETURN json_build_object('gps_ativo', false);
  END IF;

  SELECT e.lat, e.lng, e.ultima_localizacao, e.nome
    INTO v_lat, v_lng, v_ultima, v_nome
    FROM public.entregadores e
   WHERE e.id = v_ent_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('gps_ativo', false, 'nome', v_nome);
  END IF;

  RETURN json_build_object(
    'gps_ativo', true,
    'lat',               v_lat,
    'lng',               v_lng,
    'ultima_localizacao', v_ultima,
    'nome',              v_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pedido_rastrear_entregador(uuid) TO anon, authenticated;
