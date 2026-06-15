-- Entregadores freelance: tipo, aprovado, veículo
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS tipo     TEXT    NOT NULL DEFAULT 'fixo' CHECK (tipo IN ('fixo', 'freelancer')),
  ADD COLUMN IF NOT EXISTS aprovado BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS veiculo  TEXT;

-- Anon pode se auto-cadastrar como freelancer (link de convite)
CREATE POLICY "Freelancer auto-cadastro"
  ON public.entregadores FOR INSERT TO anon
  WITH CHECK (tipo = 'freelancer' AND aprovado = false);

-- Freelancer pega entrega disponível (com lock para evitar race condition)
CREATE OR REPLACE FUNCTION public.freelancer_pegar_entrega(
  p_token    TEXT,
  p_pedido_id UUID
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      UUID;
  v_empresa UUID;
  v_ped_emp UUID;
  v_ped_st  TEXT;
  v_ped_ent UUID;
BEGIN
  SELECT id, empresa_id INTO v_id, v_empresa
    FROM entregadores
   WHERE public_token = p_token AND tipo = 'freelancer' AND aprovado = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'erro', 'Não autorizado.');
  END IF;

  SELECT empresa_id, status, entregador_id
    INTO v_ped_emp, v_ped_st, v_ped_ent
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  END IF;
  IF v_ped_emp != v_empresa THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido inválido.');
  END IF;
  IF v_ped_ent IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido já foi aceito por outro entregador.');
  END IF;
  IF v_ped_st NOT IN ('aceito', 'preparo') THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido não está disponível para entrega.');
  END IF;

  UPDATE pedidos
     SET entregador_id = v_id, status = 'entrega'
   WHERE id = p_pedido_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_pegar_entrega(text, uuid) TO anon, authenticated;

-- Lista pedidos disponíveis para um freelancer (sem entregador, tipo delivery)
CREATE OR REPLACE FUNCTION public.freelancer_pedidos_disponiveis(p_token TEXT)
RETURNS TABLE (
  id             UUID,
  numero         INT,
  cliente_nome   TEXT,
  cliente_endereco TEXT,
  taxa_entrega   NUMERIC,
  status         TEXT,
  created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID; v_empresa UUID;
BEGIN
  SELECT id, empresa_id INTO v_id, v_empresa
    FROM entregadores
   WHERE public_token = p_token AND tipo = 'freelancer' AND aprovado = true;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
           p.taxa_entrega, p.status, p.created_at
      FROM pedidos p
     WHERE p.empresa_id = v_empresa
       AND p.status IN ('aceito', 'preparo')
       AND (p.entregador_id IS NULL)
       AND (p.tipo IS NULL OR p.tipo = 'delivery')
     ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_pedidos_disponiveis(text) TO anon, authenticated;
