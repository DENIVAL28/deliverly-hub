-- Melhorias na página do entregador:
-- 1. entregador_meus_pedidos: adiciona telefone, empresa, todos status ativos
-- 2. entregador_finalizar_entrega: botão "Entregue com sucesso!"
-- 3. cliente_atualizar_localizacao: cliente compartilha GPS na página de rastreio

SET search_path = public;

-- ── 1. Atualizar entregador_meus_pedidos ─────────────────────────────────────
-- DROP necessário porque o RETURNS TABLE mudou (novos campos)
DROP FUNCTION IF EXISTS public.entregador_meus_pedidos(uuid);

CREATE OR REPLACE FUNCTION public.entregador_meus_pedidos(p_token UUID)
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_endereco TEXT,
  taxa_entrega     NUMERIC,
  status           TEXT,
  created_at       TIMESTAMPTZ,
  cliente_lat      DOUBLE PRECISION,
  cliente_lng      DOUBLE PRECISION,
  cliente_telefone TEXT,
  empresa_nome     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT ent.id INTO v_id
    FROM public.entregadores ent
   WHERE ent.public_token = p_token;

  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
           p.taxa_entrega, p.status::text, p.created_at,
           p.cliente_lat, p.cliente_lng,
           p.cliente_telefone,
           e.nome_fantasia
      FROM public.pedidos p
      JOIN public.empresas e ON e.id = p.empresa_id
     WHERE p.entregador_id = v_id
       AND p.status NOT IN ('cancelado')
     ORDER BY
       CASE WHEN p.status IN ('aceito', 'preparo', 'entrega') THEN 0 ELSE 1 END,
       p.created_at DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_meus_pedidos(uuid) TO anon, authenticated;

-- ── 2. entregador_finalizar_entrega ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_finalizar_entrega(
  p_token     UUID,
  p_pedido_id UUID
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      UUID;
  v_ent_id  UUID;
  v_status  TEXT;
BEGIN
  SELECT ent.id INTO v_id
    FROM public.entregadores ent
   WHERE ent.public_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'erro', 'Token inválido.');
  END IF;

  SELECT p.entregador_id, p.status::text
    INTO v_ent_id, v_status
    FROM public.pedidos p
   WHERE p.id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  END IF;
  IF v_ent_id IS DISTINCT FROM v_id THEN
    RETURN json_build_object('ok', false, 'erro', 'Este pedido não está atribuído a você.');
  END IF;
  IF v_status <> 'entrega' THEN
    RETURN json_build_object('ok', false, 'erro', 'O pedido precisa estar no status "Saiu p/ entrega" para finalizar.');
  END IF;

  UPDATE public.pedidos
     SET status = 'finalizado'
   WHERE id = p_pedido_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_finalizar_entrega(uuid, uuid) TO anon, authenticated;

-- ── 3. cliente_atualizar_localizacao ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cliente_atualizar_localizacao(
  p_pedido_id UUID,
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_lat < -90  OR p_lat > 90  THEN RAISE EXCEPTION 'Latitude inválida';  END IF;
  IF p_lng < -180 OR p_lng > 180 THEN RAISE EXCEPTION 'Longitude inválida'; END IF;

  UPDATE public.pedidos
     SET cliente_lat = p_lat,
         cliente_lng = p_lng
   WHERE id = p_pedido_id
     AND status NOT IN ('finalizado', 'cancelado');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_atualizar_localizacao(uuid, double precision, double precision) TO anon, authenticated;
