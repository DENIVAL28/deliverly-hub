-- Exibe dados do entregador no painel da loja.
-- Objetivo: lojista vê nome, telefone, veículo e placa do entregador.
--
-- Mudanças:
--   1. empresa_pedidos_ativos: DROP + CREATE (RETURNS TABLE muda).
--      Adiciona LEFT JOIN entregadores e 3 colunas novas.
--      Lógica, filtros, SECURITY DEFINER e GRANT preservados.
--      Status filter NÃO muda — novos status (pronto, com_entregador)
--      devem ser adicionados em migration separada quando o fluxo for aplicado.
--
--   2. entregador_aceitar_pedido: CREATE OR REPLACE (retorno JSONB não muda).
--      Adiciona validação de aprovado + status_cadastro.
--      Adiciona snapshot de entregador_nome no pedido.

SET search_path = public;

-- ── 1. empresa_pedidos_ativos ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.empresa_pedidos_ativos();

CREATE FUNCTION public.empresa_pedidos_ativos()
RETURNS TABLE (
  id                   UUID,
  numero               INT,
  cliente_nome         TEXT,
  cliente_telefone     TEXT,
  cliente_endereco     TEXT,
  total                NUMERIC,
  subtotal             NUMERIC,
  desconto             NUMERIC,
  taxa_entrega         NUMERIC,
  status               TEXT,
  tipo                 TEXT,
  forma_pagamento      TEXT,
  observacao           TEXT,
  entregador_id        UUID,
  entregador_nome      TEXT,
  entregador_telefone  TEXT,
  entregador_veiculo   TEXT,
  entregador_placa     TEXT,
  mesa                 TEXT,
  created_at           TIMESTAMPTZ,
  pedido_itens         JSONB
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE v_empresa UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.numero,
      p.cliente_nome,
      p.cliente_telefone,
      p.cliente_endereco,
      p.total,
      p.subtotal,
      p.desconto,
      p.taxa_entrega,
      p.status::text,
      p.tipo::text,
      p.forma_pagamento,
      p.observacao,
      p.entregador_id,
      COALESCE(ent.nome, p.entregador_nome)::text  AS entregador_nome,
      ent.telefone::text                            AS entregador_telefone,
      ent.veiculo::text                             AS entregador_veiculo,
      ent.placa::text                               AS entregador_placa,
      p.mesa,
      p.created_at,
      COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
              'id',             i.id,
              'nome',           i.nome,
              'quantidade',     i.quantidade,
              'preco_unitario', i.preco_unitario,
              'subtotal',       i.subtotal,
              'observacao',     i.observacao,
              'requer_preparo', i.requer_preparo
            )
          )
          FROM public.pedido_itens i
         WHERE i.pedido_id = p.id
        ),
        '[]'::jsonb
      ) AS pedido_itens
    FROM public.pedidos p
    LEFT JOIN public.entregadores ent ON ent.id = p.entregador_id
   WHERE p.empresa_id = v_empresa
     AND p.status IN (
       'aguardando_confirmacao', 'aguardando_pagamento',
       'novo', 'aceito', 'preparo', 'entrega'
     )
   ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_pedidos_ativos() TO authenticated;

-- ── 2. entregador_aceitar_pedido — segurança reforçada + snapshot nome ─────────

CREATE OR REPLACE FUNCTION public.entregador_aceitar_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      UUID;
  v_empresa UUID;
  v_nome    TEXT;
  v_ped_emp UUID;
  v_ped_st  TEXT;
  v_ped_ent UUID;
BEGIN
  -- Valida: entregador existe, está aprovado e com cadastro ativo
  SELECT id, empresa_id, nome
    INTO v_id, v_empresa, v_nome
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
     AND aprovado = true
     AND status_cadastro = 'aprovado'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não autorizado. Cadastro pendente ou não aprovado.');
  END IF;

  -- Busca e trava o pedido
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

  -- Valida autorização por tipo de entregador
  IF v_empresa IS NOT NULL THEN
    -- Entregador fixo: só aceita pedidos da própria empresa
    IF v_ped_emp != v_empresa THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Pedido inválido.');
    END IF;
  ELSE
    -- Entregador de plataforma: empresa deve usar modo plataforma
    IF NOT EXISTS (
      SELECT 1 FROM public.empresas
       WHERE id = v_ped_emp
         AND tipo_operacao_entrega = 'plataforma'
         AND status = 'ativa'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Esta loja não usa entregadores da plataforma.');
    END IF;
  END IF;

  -- Aceita: grava entregador_id, snapshot do nome e avança status
  UPDATE public.pedidos
     SET entregador_id   = v_id,
         entregador_nome = v_nome,
         status          = 'entrega'
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_aceitar_pedido(UUID) TO authenticated;
