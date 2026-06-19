-- RPC alternativa: usa auth.uid() em vez do public_token.
-- O token é opaco e depende de sincronização; auth.uid() é sempre
-- o usuário logado — zero chance de mismatch.

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
  -- Busca entregador pelo usuário autenticado
  SELECT id, empresa_id
    INTO v_id, v_empresa
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_empresa IS NOT NULL THEN
    -- Sistema antigo: entregador fixo/freelancer vinculado a empresa
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
    -- Entregador de plataforma: vê pedidos de todas as empresas no modo plataforma
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

-- Mesmo padrão para "meus pedidos em andamento"
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
  SELECT id INTO v_id
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
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

-- Aceitar entrega usando auth.uid() em vez de token
CREATE OR REPLACE FUNCTION public.entregador_aceitar_pedido(p_pedido_id UUID)
RETURNS JSONB
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
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não autorizado.');
  END IF;

  SELECT empresa_id, status, entregador_id
    INTO v_ped_emp, v_ped_st, v_ped_ent
    FROM public.pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  END IF;

  IF v_ped_ent IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pedido já aceito por outro entregador.');
  END IF;

  IF v_ped_st NOT IN ('aceito', 'preparo', 'entrega') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pedido não disponível.');
  END IF;

  -- Validar autorização
  IF v_empresa IS NOT NULL THEN
    IF v_ped_emp != v_empresa THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Pedido inválido.');
    END IF;
  ELSE
    -- Plataforma: empresa deve estar em modo plataforma
    IF NOT EXISTS (
      SELECT 1 FROM public.empresas
       WHERE id = v_ped_emp
         AND tipo_operacao_entrega = 'plataforma'
         AND status = 'ativa'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Esta loja não usa entregadores da plataforma.');
    END IF;
  END IF;

  UPDATE public.pedidos
     SET entregador_id = v_id,
         status = 'entrega'
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_aceitar_pedido(UUID) TO authenticated;

-- Finalizar entrega usando auth.uid()
CREATE OR REPLACE FUNCTION public.entregador_finalizar_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não autorizado.');
  END IF;

  UPDATE public.pedidos
     SET status = 'finalizado'
   WHERE id = p_pedido_id
     AND entregador_id = v_id
     AND status = 'entrega';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pedido não encontrado ou já finalizado.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_finalizar_pedido(UUID) TO authenticated;
