-- Fix: "column reference id is ambiguous"
-- RETURNS TABLE (id UUID, ...) cria variável de saída "id" que conflita
-- com a coluna "id" nos SELECTs internos. Solução: alias de tabela em todas
-- as queries que usam "id" sem qualificador.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.entregador_pedidos_disponiveis()
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_endereco TEXT,
  taxa_entrega     NUMERIC,
  status           TEXT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_id      UUID;
  v_empresa UUID;
BEGIN
  SELECT ent.id, ent.empresa_id
    INTO v_id, v_empresa
    FROM public.entregadores ent
   WHERE ent.auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_empresa IS NOT NULL THEN
    RETURN QUERY
      SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
             p.taxa_entrega, p.status::text, p.created_at
        FROM public.pedidos p
       WHERE p.empresa_id = v_empresa
         AND p.status IN ('aceito', 'preparo', 'entrega')
         AND p.entregador_id IS NULL
         AND (p.tipo IS NULL OR p.tipo = 'delivery')
       ORDER BY p.created_at ASC;
  ELSE
    RETURN QUERY
      SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
             p.taxa_entrega, p.status::text, p.created_at
        FROM public.pedidos p
        JOIN public.empresas e ON e.id = p.empresa_id
       WHERE e.tipo_operacao_entrega = 'plataforma'
         AND e.status = 'ativa'
         AND p.status IN ('aceito', 'preparo', 'entrega')
         AND p.entregador_id IS NULL
         AND p.tipo = 'delivery'
       ORDER BY p.created_at ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_pedidos_disponiveis() TO authenticated;

CREATE OR REPLACE FUNCTION public.entregador_meus_pedidos_ativos()
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_telefone TEXT,
  cliente_endereco TEXT,
  cliente_lat      double precision,
  cliente_lng      double precision,
  taxa_entrega     NUMERIC,
  status           TEXT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT ent.id INTO v_id
    FROM public.entregadores ent
   WHERE ent.auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.numero, p.cliente_nome, p.cliente_telefone,
           p.cliente_endereco, p.cliente_lat, p.cliente_lng,
           p.taxa_entrega, p.status::text, p.created_at
      FROM public.pedidos p
     WHERE p.entregador_id = v_id
       AND p.status IN ('aceito', 'preparo', 'entrega')
     ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_meus_pedidos_ativos() TO authenticated;
