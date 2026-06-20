-- Clientes podem buscar seus pedidos por telefone mesmo em sessão diferente da que fez o pedido.
-- O problema: RLS policy "cliente le proprio pedido" usa user_id = auth.uid(), que falha quando
-- o cliente abre uma nova sessão anônima (auth.uid() diferente do momento do pedido).
-- Solução: RPC SECURITY DEFINER que normaliza o telefone (só dígitos) e busca sem passar pelo RLS.

CREATE OR REPLACE FUNCTION public.buscar_pedidos_por_telefone(
  p_empresa_id uuid,
  p_telefone   text
)
RETURNS TABLE(
  id         uuid,
  numero     int,
  status     text,
  total      numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
BEGIN
  v_tel := regexp_replace(p_telefone, '\D', '', 'g');
  IF length(v_tel) < 8 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.numero,
    p.status::text,
    p.total,
    p.created_at
  FROM public.pedidos p
  WHERE p.empresa_id = p_empresa_id
    AND regexp_replace(COALESCE(p.cliente_telefone, ''), '\D', '', 'g') = v_tel
  ORDER BY p.created_at DESC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_pedidos_por_telefone(uuid, text) TO anon, authenticated;
