-- Audit fixes:
-- 1. Adiciona coluna troco e motivo_cancelamento em pedidos
-- 2. finalizar_pedido v8 — armazena troco
-- 3. empresa_atualizar_pedido — restaura estoque + cupom no cancelamento, grava motivo
-- 4. entregador_meus_pedidos_ativos — expõe troco, forma_pagamento e endereço da loja

SET search_path = public;

-- ── 1. Colunas novas em pedidos ───────────────────────────────────────────────

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS troco              NUMERIC,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- ── 2. finalizar_pedido v8: aceita e armazena troco ──────────────────────────
-- Adiciona p_troco como último parâmetro opcional (DEFAULT NULL).
-- Todas as chamadas existentes sem esse parâmetro continuam funcionando.

CREATE OR REPLACE FUNCTION public.finalizar_pedido(
  p_empresa_id        UUID,
  p_cliente_nome      TEXT,
  p_cliente_telefone  TEXT             DEFAULT NULL,
  p_cliente_endereco  TEXT             DEFAULT NULL,
  p_forma_pagamento   TEXT             DEFAULT 'Dinheiro',
  p_observacao        TEXT             DEFAULT NULL,
  p_mesa              TEXT             DEFAULT NULL,
  p_tipo              TEXT             DEFAULT 'delivery',
  p_cupom_id          UUID             DEFAULT NULL,
  p_itens             JSONB            DEFAULT '[]',
  p_cliente_lat       double precision DEFAULT NULL,
  p_cliente_lng       double precision DEFAULT NULL,
  p_cliente_cpf       TEXT             DEFAULT NULL,
  p_cliente_cep       TEXT             DEFAULT NULL,
  p_cliente_cidade    TEXT             DEFAULT NULL,
  p_desconto_pdv      NUMERIC          DEFAULT 0,
  p_taxa_entrega      NUMERIC          DEFAULT 0,
  p_idempotency_key   UUID             DEFAULT NULL,
  p_troco             NUMERIC          DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id    UUID;
  v_numero       INT;
  v_item         JSONB;
  v_prod_id      UUID;
  v_prod_nome    TEXT;
  v_qty          INT;
  v_preco        NUMERIC;
  v_ativo        BOOLEAN;
  v_ctrl_est     BOOLEAN;
  v_estoque      INT;
  v_subtotal     NUMERIC := 0;
  v_taxa         NUMERIC := 0;
  v_desconto     NUMERIC := 0;
  v_total        NUMERIC;
  v_cupom        RECORD;
  v_emp_status   public.empresa_status;
  v_emp_taxa     NUMERIC;
  v_taxa_tipo    TEXT;
  v_taxa_por_km  NUMERIC;
  v_taxa_base    NUMERIC;
  v_emp_lat      DOUBLE PRECISION;
  v_emp_lng      DOUBLE PRECISION;
  v_dist_km      NUMERIC;
  v_fluxo        TEXT;
  v_status_ini   public.pedido_status;
BEGIN
  -- ── Idempotência ──────────────────────────────────────────────────────────
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, numero, subtotal, taxa_entrega, desconto, total
      INTO v_pedido_id, v_numero, v_subtotal, v_taxa, v_desconto, v_total
      FROM public.pedidos
     WHERE idempotency_key = p_idempotency_key
       AND empresa_id      = p_empresa_id;

    IF FOUND THEN
      RETURN json_build_object(
        'id',          v_pedido_id,
        'numero',      v_numero,
        'subtotal',    v_subtotal,
        'taxa_entrega',v_taxa,
        'desconto',    v_desconto,
        'total',       v_total,
        'status',      'idempotent'
      );
    END IF;
  END IF;

  -- ── Validação da empresa ──────────────────────────────────────────────────
  SELECT e.status, e.taxa_entrega, e.taxa_entrega_tipo,
         e.taxa_entrega_por_km, e.taxa_entrega_base,
         e.empresa_lat, e.empresa_lng, e.fluxo_pedido
    INTO v_emp_status, v_emp_taxa, v_taxa_tipo,
         v_taxa_por_km, v_taxa_base,
         v_emp_lat, v_emp_lng, v_fluxo
    FROM public.empresas e
   WHERE e.id = p_empresa_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Empresa não encontrada');
  END IF;
  IF v_emp_status <> 'ativa' THEN
    RETURN json_build_object('error', 'Loja não está ativa');
  END IF;

  -- ── Taxa de entrega (server-side) ─────────────────────────────────────────
  IF p_tipo = 'pdv' AND auth.uid() IS NOT NULL THEN
    v_taxa := COALESCE(p_taxa_entrega, 0);
  ELSIF p_tipo IN ('retirada', 'mesa') THEN
    v_taxa := 0;
  ELSIF v_taxa_tipo = 'km'
        AND p_cliente_lat IS NOT NULL AND p_cliente_lng IS NOT NULL
        AND v_emp_lat IS NOT NULL AND v_emp_lng IS NOT NULL THEN
    v_dist_km := (
      2 * 6371 * ASIN(SQRT(
        POWER(SIN(RADIANS((p_cliente_lat - v_emp_lat) / 2)), 2) +
        COS(RADIANS(v_emp_lat)) * COS(RADIANS(p_cliente_lat)) *
        POWER(SIN(RADIANS((p_cliente_lng - v_emp_lng) / 2)), 2)
      ))
    );
    v_taxa := GREATEST(
      COALESCE(v_taxa_base, 0),
      COALESCE(v_taxa_base, 0) + v_dist_km * COALESCE(v_taxa_por_km, 0)
    );
  ELSE
    v_taxa := COALESCE(v_emp_taxa, 0);
  END IF;

  -- ── Cupom ─────────────────────────────────────────────────────────────────
  IF p_cupom_id IS NOT NULL THEN
    SELECT * INTO v_cupom
      FROM public.cupons
     WHERE id        = p_cupom_id
       AND empresa_id = p_empresa_id
       AND ativo      = true
     FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('error', 'Cupom inválido ou inativo');
    END IF;
    IF v_cupom.validade IS NOT NULL AND v_cupom.validade < now() THEN
      RETURN json_build_object('error', 'Cupom expirado');
    END IF;
    IF v_cupom.usos_max IS NOT NULL AND COALESCE(v_cupom.usos_atual, 0) >= v_cupom.usos_max THEN
      RETURN json_build_object('error', 'Cupom esgotado');
    END IF;
  END IF;

  -- ── Itens ─────────────────────────────────────────────────────────────────
  IF jsonb_array_length(p_itens) = 0 THEN
    RETURN json_build_object('error', 'Pedido sem itens');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id  := (v_item->>'produto_id')::UUID;
    v_qty      := COALESCE((v_item->>'quantidade')::INT, 1);

    SELECT nome, preco, ativo, controlar_estoque, estoque
      INTO v_prod_nome, v_preco, v_ativo, v_ctrl_est, v_estoque
      FROM public.produtos
     WHERE id         = v_prod_id
       AND empresa_id = p_empresa_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('error', 'Produto não encontrado: ' || v_prod_id);
    END IF;
    IF NOT v_ativo THEN
      RETURN json_build_object('error', 'Produto indisponível: ' || v_prod_nome);
    END IF;
    IF v_ctrl_est AND COALESCE(v_estoque, 0) < v_qty THEN
      RETURN json_build_object('error', 'Produto "' || v_prod_nome || '" sem estoque suficiente');
    END IF;

    -- Preço promocional
    IF (v_item->>'preco_unitario') IS NOT NULL THEN
      v_preco := LEAST(v_preco, (v_item->>'preco_unitario')::NUMERIC);
    END IF;

    v_subtotal := v_subtotal + (v_preco * v_qty);

    IF v_ctrl_est THEN
      UPDATE public.produtos SET estoque = GREATEST(0, COALESCE(estoque, 0) - v_qty)
       WHERE id = v_prod_id;
    END IF;
  END LOOP;

  -- ── Desconto do cupom ─────────────────────────────────────────────────────
  IF p_cupom_id IS NOT NULL AND v_cupom IS NOT NULL THEN
    IF v_cupom.tipo = 'percentual' THEN
      v_desconto := ROUND(v_subtotal * v_cupom.valor / 100, 2);
    ELSE
      v_desconto := LEAST(v_cupom.valor, v_subtotal);
    END IF;
    UPDATE public.cupons
       SET usos_atual = COALESCE(usos_atual, 0) + 1
     WHERE id = p_cupom_id;
  END IF;

  -- Desconto PDV
  v_desconto := v_desconto + COALESCE(p_desconto_pdv, 0);

  -- ── Total ─────────────────────────────────────────────────────────────────
  v_total := GREATEST(0, v_subtotal + v_taxa - v_desconto);

  -- ── Status inicial ────────────────────────────────────────────────────────
  v_status_ini := CASE
    WHEN v_fluxo = 'manual' THEN 'aguardando_confirmacao'::public.pedido_status
    WHEN p_forma_pagamento = 'PIX' AND v_fluxo != 'auto' THEN 'aguardando_confirmacao'::public.pedido_status
    ELSE 'novo'::public.pedido_status
  END;

  -- ── Número sequencial por empresa ─────────────────────────────────────────
  UPDATE public.empresas
     SET proximo_numero = COALESCE(proximo_numero, 0) + 1
   WHERE id = p_empresa_id
  RETURNING proximo_numero INTO v_numero;

  -- ── Inserir pedido ────────────────────────────────────────────────────────
  INSERT INTO public.pedidos (
    empresa_id, numero, cliente_nome, cliente_telefone,
    cliente_endereco, observacao, forma_pagamento,
    subtotal, taxa_entrega, desconto, total, status,
    tipo, cupom_id, cliente_lat, cliente_lng,
    cliente_cpf, cliente_cep, cliente_cidade, mesa,
    idempotency_key, troco
  ) VALUES (
    p_empresa_id, v_numero, p_cliente_nome, p_cliente_telefone,
    p_cliente_endereco, p_observacao, p_forma_pagamento,
    v_subtotal, v_taxa, v_desconto, v_total, v_status_ini,
    p_tipo, p_cupom_id, p_cliente_lat, p_cliente_lng,
    p_cliente_cpf, p_cliente_cep, p_cliente_cidade, p_mesa,
    p_idempotency_key, p_troco
  )
  RETURNING id INTO v_pedido_id;

  -- ── Itens do pedido ───────────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id  := (v_item->>'produto_id')::UUID;
    v_qty      := COALESCE((v_item->>'quantidade')::INT, 1);

    SELECT nome, COALESCE(preco_promocional, preco), requer_preparo
      INTO v_prod_nome, v_preco, v_ativo  -- reusing v_ativo as requer_preparo bool
      FROM public.produtos
     WHERE id = v_prod_id;

    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, nome, quantidade,
      preco_unitario, subtotal, observacao, requer_preparo
    ) VALUES (
      v_pedido_id, v_prod_id, v_prod_nome, v_qty,
      COALESCE((v_item->>'preco_unitario')::NUMERIC, v_preco),
      COALESCE((v_item->>'preco_unitario')::NUMERIC, v_preco) * v_qty,
      v_item->>'observacao',
      v_ativo
    );
  END LOOP;

  RETURN json_build_object(
    'id',           v_pedido_id,
    'numero',       v_numero,
    'subtotal',     v_subtotal,
    'taxa_entrega', v_taxa,
    'desconto',     v_desconto,
    'total',        v_total,
    'status',       v_status_ini::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_pedido(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  UUID, JSONB, double precision, double precision,
  TEXT, TEXT, TEXT, NUMERIC, NUMERIC, UUID, NUMERIC
) TO anon, authenticated;

-- ── 3. empresa_atualizar_pedido — restauração + motivo_cancelamento ───────────

CREATE OR REPLACE FUNCTION public.empresa_atualizar_pedido(
  p_pedido_id              UUID,
  p_status                 TEXT    DEFAULT NULL,
  p_entregador_id          UUID    DEFAULT NULL,
  p_entregador_nome        TEXT    DEFAULT NULL,
  p_desconto               NUMERIC DEFAULT NULL,
  p_motivo_cancelamento    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa      UUID;
  v_status_atual TEXT;
  v_cupom_id     UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN (
    'aguardando_confirmacao', 'aguardando_pagamento', 'novo',
    'aceito', 'preparo', 'entrega', 'finalizado', 'cancelado'
  ) THEN
    RETURN jsonb_build_object('error', 'Status inválido');
  END IF;

  -- Valida transição e captura cupom_id para eventual rollback
  IF p_status IS NOT NULL THEN
    SELECT status::TEXT, cupom_id
      INTO v_status_atual, v_cupom_id
      FROM public.pedidos
     WHERE id = p_pedido_id AND empresa_id = v_empresa;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Pedido não encontrado');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_status_transitions
       WHERE status_de = v_status_atual AND status_para = p_status
    ) THEN
      RETURN jsonb_build_object(
        'error', 'Transição de status inválida: ' || v_status_atual || ' → ' || p_status
      );
    END IF;

    -- Cancelamento: restaurar estoque e cupom
    IF p_status = 'cancelado' THEN
      -- Restaura estoque dos itens com controle ativado
      UPDATE public.produtos pr
         SET estoque = COALESCE(pr.estoque, 0) + pi.quantidade
        FROM public.pedido_itens pi
       WHERE pi.pedido_id  = p_pedido_id
         AND pi.produto_id = pr.id
         AND pr.controlar_estoque = true;

      -- Reverte uso do cupom
      IF v_cupom_id IS NOT NULL THEN
        UPDATE public.cupons
           SET usos_atual = GREATEST(0, COALESCE(usos_atual, 0) - 1)
         WHERE id = v_cupom_id;
      END IF;
    END IF;
  END IF;

  -- Em modo plataforma, entrega→finalizado é bloqueado para o lojista
  IF p_status = 'finalizado' AND EXISTS (
    SELECT 1
      FROM public.pedidos p2
      JOIN public.empresas e2 ON e2.id = p2.empresa_id
     WHERE p2.id         = p_pedido_id
       AND p2.empresa_id = v_empresa
       AND p2.status     = 'entrega'
       AND COALESCE(e2.tipo_operacao_entrega, 'plataforma') != 'fixos'
  ) THEN
    RETURN jsonb_build_object('error', 'Pedido em rota — apenas o entregador pode finalizar');
  END IF;

  UPDATE public.pedidos
     SET status                = COALESCE(p_status::pedido_status,  status),
         entregador_id         = COALESCE(p_entregador_id,          entregador_id),
         entregador_nome       = COALESCE(p_entregador_nome,        entregador_nome),
         desconto              = COALESCE(p_desconto,               desconto),
         motivo_cancelamento   = COALESCE(p_motivo_cancelamento,    motivo_cancelamento)
   WHERE id = p_pedido_id
     AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_atualizar_pedido(UUID, TEXT, UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ── 4. entregador_meus_pedidos_ativos + troco + forma_pagamento + empresa_endereco ──

DROP FUNCTION IF EXISTS public.entregador_meus_pedidos_ativos();

CREATE FUNCTION public.entregador_meus_pedidos_ativos()
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_telefone TEXT,
  cliente_endereco TEXT,
  cliente_lat      double precision,
  cliente_lng      double precision,
  taxa_entrega     NUMERIC,
  troco            NUMERIC,
  forma_pagamento  TEXT,
  status           TEXT,
  created_at       TIMESTAMPTZ,
  empresa_nome     TEXT,
  empresa_endereco TEXT
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
           p.taxa_entrega, p.troco, p.forma_pagamento, p.status::text, p.created_at,
           e.nome_fantasia,
           COALESCE(e.endereco || ', ' || e.cidade, e.cidade, e.endereco)
      FROM public.pedidos p
      LEFT JOIN public.empresas e ON e.id = p.empresa_id
     WHERE p.entregador_id = v_id
       AND p.status IN ('aceito', 'preparo', 'entrega')
     ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_meus_pedidos_ativos() TO authenticated;

-- ── 5. entregador_pedidos_disponiveis + forma_pagamento ──────────────────────

DROP FUNCTION IF EXISTS public.entregador_pedidos_disponiveis();

CREATE FUNCTION public.entregador_pedidos_disponiveis()
RETURNS TABLE (
  id               UUID,
  numero           INT,
  cliente_nome     TEXT,
  cliente_endereco TEXT,
  taxa_entrega     NUMERIC,
  forma_pagamento  TEXT,
  status           TEXT,
  created_at       TIMESTAMPTZ,
  empresa_nome     TEXT
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
             p.taxa_entrega, p.forma_pagamento, p.status::text, p.created_at,
             e.nome_fantasia
        FROM public.pedidos p
        JOIN public.empresas e ON e.id = p.empresa_id
       WHERE p.empresa_id = v_empresa
         AND p.status IN ('aceito', 'preparo', 'entrega')
         AND p.entregador_id IS NULL
         AND (p.tipo IS NULL OR p.tipo = 'delivery')
       ORDER BY p.created_at ASC;
  ELSE
    RETURN QUERY
      SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
             p.taxa_entrega, p.forma_pagamento, p.status::text, p.created_at,
             e.nome_fantasia
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
