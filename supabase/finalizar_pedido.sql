-- Função atômica: cria pedido + itens + decrementa estoque + valida cupom.
-- Toda operação em uma única transação — se qualquer passo falhar, tudo reverte.

DROP FUNCTION IF EXISTS finalizar_pedido(uuid,text,text,text,text,text,numeric,numeric,numeric,text,text,text,uuid,jsonb);
DROP FUNCTION IF EXISTS finalizar_pedido(uuid,text,text,text,text,text,numeric,numeric,numeric,text,text,text,uuid,jsonb,double precision,double precision);

CREATE OR REPLACE FUNCTION finalizar_pedido(
  p_empresa_id       UUID,
  p_cliente_nome     TEXT,
  p_cliente_telefone TEXT             DEFAULT NULL,
  p_cliente_endereco TEXT             DEFAULT NULL,
  p_forma_pagamento  TEXT             DEFAULT 'Dinheiro',
  p_observacao       TEXT             DEFAULT NULL,
  p_subtotal         NUMERIC          DEFAULT 0,
  p_taxa_entrega     NUMERIC          DEFAULT 0,
  p_total            NUMERIC          DEFAULT 0,
  p_mesa             TEXT             DEFAULT NULL,
  p_tipo             TEXT             DEFAULT 'delivery',
  p_status           TEXT             DEFAULT 'novo',
  p_cupom_id         UUID             DEFAULT NULL,
  p_itens            JSONB            DEFAULT '[]',
  p_cliente_lat      double precision DEFAULT NULL,
  p_cliente_lng      double precision DEFAULT NULL,
  p_cliente_cpf      TEXT             DEFAULT NULL,
  p_cliente_cep      TEXT             DEFAULT NULL,
  p_cliente_cidade   TEXT             DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido_id  UUID;
  v_numero     INT;
  v_item       JSONB;
  v_prod_id    UUID;
  v_qty        INT;
  v_estoque    INT;
  v_cupom      RECORD;
BEGIN
  -- ── 1. Revalida cupom no backend ──────────────────────────────────────────
  IF p_cupom_id IS NOT NULL THEN
    SELECT ativo, validade, usos_max, usos_atual
      INTO v_cupom
      FROM public.cupons
     WHERE id = p_cupom_id AND empresa_id = p_empresa_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido.';
    END IF;
    IF NOT v_cupom.ativo THEN
      RAISE EXCEPTION 'Este cupom está inativo.';
    END IF;
    IF v_cupom.validade IS NOT NULL AND v_cupom.validade < CURRENT_DATE THEN
      RAISE EXCEPTION 'Este cupom expirou.';
    END IF;
    IF v_cupom.usos_max IS NOT NULL AND COALESCE(v_cupom.usos_atual, 0) >= v_cupom.usos_max THEN
      RAISE EXCEPTION 'Este cupom atingiu o limite de usos.';
    END IF;
  END IF;

  -- ── 2. Inserir pedido ─────────────────────────────────────────────────────
  INSERT INTO pedidos (
    empresa_id, cliente_nome, cliente_telefone, cliente_endereco,
    forma_pagamento, observacao, subtotal, taxa_entrega, total,
    mesa, tipo, status, cliente_lat, cliente_lng,
    cliente_cpf, cliente_cep, cliente_cidade
  ) VALUES (
    p_empresa_id, p_cliente_nome, p_cliente_telefone, p_cliente_endereco,
    p_forma_pagamento, p_observacao, p_subtotal, p_taxa_entrega, p_total,
    p_mesa, p_tipo, p_status::pedido_status, p_cliente_lat, p_cliente_lng,
    p_cliente_cpf, p_cliente_cep, p_cliente_cidade
  )
  RETURNING id, numero INTO v_pedido_id, v_numero;

  -- ── 3. Inserir itens + validar e decrementar estoque ─────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := CASE WHEN (v_item->>'produto_id') IS NOT NULL
                      THEN (v_item->>'produto_id')::UUID ELSE NULL END;
    v_qty     := (v_item->>'quantidade')::INT;

    INSERT INTO pedido_itens (
      pedido_id, produto_id, nome, quantidade, preco_unitario, subtotal, observacao
    ) VALUES (
      v_pedido_id, v_prod_id,
      v_item->>'nome', v_qty,
      (v_item->>'preco_unitario')::NUMERIC,
      (v_item->>'subtotal')::NUMERIC,
      NULLIF(v_item->>'observacao', '')
    );

    -- Valida e decrementa estoque de forma atômica (bloqueia overselling)
    IF v_prod_id IS NOT NULL AND (v_item->>'controlar_estoque')::BOOLEAN IS TRUE THEN
      SELECT estoque INTO v_estoque
        FROM public.produtos
       WHERE id = v_prod_id AND empresa_id = p_empresa_id
         FOR UPDATE; -- bloqueia a linha para evitar race condition

      IF v_estoque IS NOT NULL AND v_estoque < v_qty THEN
        RAISE EXCEPTION 'Produto "%" sem estoque suficiente (disponível: %).', v_item->>'nome', v_estoque;
      END IF;

      UPDATE produtos
         SET estoque = GREATEST(0, COALESCE(estoque, 0) - v_qty)
       WHERE id = v_prod_id AND empresa_id = p_empresa_id;
    END IF;
  END LOOP;

  -- ── 4. Incrementa uso do cupom ────────────────────────────────────────────
  IF p_cupom_id IS NOT NULL THEN
    UPDATE cupons
       SET usos_atual = COALESCE(usos_atual, 0) + 1
     WHERE id = p_cupom_id AND empresa_id = p_empresa_id;
  END IF;

  RETURN json_build_object('id', v_pedido_id, 'numero', v_numero);
END;
$$;
