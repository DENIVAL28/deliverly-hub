-- Corrige "column reference 'id' is ambiguous" em freelancer_pedidos_disponiveis
-- Causa: RETURNS TABLE (id UUID) cria variável de saída 'id' no escopo da função,
-- causando ambiguidade com entregadores.id no SELECT INTO sem alias de tabela.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.freelancer_pedidos_disponiveis(p_token TEXT)
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_endereco TEXT,
  taxa_entrega     NUMERIC,
  status           TEXT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID; v_empresa UUID;
BEGIN
  -- Usa alias 'e' para evitar ambiguidade com coluna de retorno 'id'
  SELECT e.id, e.empresa_id INTO v_id, v_empresa
    FROM entregadores e
   WHERE e.public_token = p_token::uuid
     AND e.tipo = 'freelancer'
     AND e.aprovado = true;

  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
           p.taxa_entrega, p.status::text, p.created_at
      FROM pedidos p
     WHERE p.empresa_id = v_empresa
       AND p.status IN ('aceito', 'preparo', 'entrega')
       AND p.entregador_id IS NULL
       AND (p.tipo IS NULL OR p.tipo = 'delivery')
     ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_pedidos_disponiveis(text) TO anon, authenticated;
