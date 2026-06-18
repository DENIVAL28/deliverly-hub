-- RPC segura para entregador ler seus próprios pedidos via public_token
-- Substitui SELECT direto que era bloqueado pelo RLS para anon

SET search_path = public;

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
  cliente_lng      DOUBLE PRECISION
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
    FROM public.entregadores
   WHERE public_token = p_token;

  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
           p.taxa_entrega, p.status::text, p.created_at,
           p.cliente_lat, p.cliente_lng
      FROM public.pedidos p
     WHERE p.entregador_id = v_id
     ORDER BY p.created_at DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_meus_pedidos(uuid) TO anon, authenticated;
