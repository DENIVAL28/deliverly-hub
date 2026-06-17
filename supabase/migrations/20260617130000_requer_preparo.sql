-- Produtos: flag requer_preparo (default true — só desativar para itens sem preparo como bebidas)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS requer_preparo BOOLEAN NOT NULL DEFAULT true;

-- Itens do pedido: guarda o valor no momento do pedido
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS requer_preparo BOOLEAN NOT NULL DEFAULT true;

-- Recria finalizar_pedido v6 — inclui requer_preparo nos itens
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
  p_desconto_pdv      NUMERIC          DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id      UUID;
  v_numero         INT;
  v_item           JSONB;
  v_prod_id        UUID;
  v_prod_nome      TEXT;
  v_qty            INT;
  v_preco          NUMERIC;
  v_ativo          BOOLEAN;
  v_ctrl_est       BOOLEAN;
  v_estoque        INT;
  v_req_preparo    BOOLEAN;
  v_subtotal       NUMERIC := 0;
  v_taxa           NUMERIC := 0;
  v_desconto       NUMERIC := 0;
  v_total          NUMERIC;
  v_cupom          RECORD;
  v_emp_status     public.empresa_status;
  v_emp_taxa       NUMERIC;
  v_taxa_tipo      TEXT;
  v_taxa_por_km    NUMERIC;
  v_taxa_base      NUMERIC;
  v_emp_lat        DOUBLE PRECISION;
  v_emp_lng        DOUBLE PRECISION;
  v_dist_km        NUMERIC;
BEGIN
  IF p_tipo NOT IN ('delivery', 'retirada', 'pdv', 'mesa', 'balcao') THEN
    RAISE EXCEPTION 'Tipo de pedido inválido: %', p_tipo;
  END IF;

  UPDATE public.empresas
     SET proximo_numero = proximo_numero + 1
   WHERE id = p_empresa_id AND status = 'ativa'
  RETURNING proximo_numero, taxa_entrega, taxa_entrega_tipo, taxa_entrega_por_km,
            taxa_entrega_base, empresa_lat, empresa_lng
       INTO v_numero, v_emp_taxa, v_taxa_tipo, v_taxa_por_km, v_taxa_base, v_emp_lat, v_emp_lng;

  IF NOT FOUND THEN
    SELECT status INTO v_emp_status FROM public.empresas WHERE id = p_empresa_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
    RAISE EXCEPTION 'Esta loja não está aceitando pedidos no momento.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido deve ter ao menos um item.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'produto_id')::UUID;
    v_qty     := (v_item->>'quantidade')::INT;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida no pedido.'; END IF;

    SELECT nome, COALESCE(preco_promocional, preco), ativo, controlar_estoque, estoque, requer_preparo
      INTO v_prod_nome, v_preco, v_ativo, v_ctrl_est, v_estoque, v_req_preparo
      FROM public.produtos
     WHERE id = v_prod_id AND empresa_id = p_empresa_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado (id: %).', v_prod_id; END IF;
    IF NOT v_ativo THEN RAISE EXCEPTION 'Produto "%" está indisponível.', v_prod_nome; END IF;

    IF v_ctrl_est IS TRUE THEN
      IF COALESCE(v_estoque, 0) < v_qty THEN
        RAISE EXCEPTION 'Produto "%" sem estoque suficiente (disponível: %).', v_prod_nome, COALESCE(v_estoque, 0);
      END IF;
      UPDATE public.produtos SET estoque = GREATEST(0, COALESCE(estoque, 0) - v_qty) WHERE id = v_prod_id;
    END IF;

    v_subtotal := v_subtotal + (v_preco * v_qty);
  END LOOP;

  IF p_tipo IN ('pdv', 'retirada', 'balcao') THEN
    v_taxa := 0;
  ELSIF COALESCE(v_taxa_tipo, 'fixo') = 'km'
        AND v_emp_lat IS NOT NULL AND v_emp_lng IS NOT NULL
        AND p_cliente_lat IS NOT NULL AND p_cliente_lng IS NOT NULL THEN
    v_dist_km := public.haversine_km(v_emp_lat, v_emp_lng, p_cliente_lat, p_cliente_lng);
    v_taxa := COALESCE(v_taxa_base, 0) + (v_dist_km * COALESCE(v_taxa_por_km, 2));
  ELSE
    v_taxa := COALESCE(v_emp_taxa, 0);
  END IF;

  IF p_cupom_id IS NOT NULL THEN
    SELECT ativo, validade, usos_max, usos_atual, tipo, valor INTO v_cupom
      FROM public.cupons WHERE id = p_cupom_id AND empresa_id = p_empresa_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido.'; END IF;
    IF NOT v_cupom.ativo THEN RAISE EXCEPTION 'Este cupom está inativo.'; END IF;
    IF v_cupom.validade IS NOT NULL AND v_cupom.validade < CURRENT_DATE THEN RAISE EXCEPTION 'Este cupom expirou.'; END IF;
    IF v_cupom.usos_max IS NOT NULL AND COALESCE(v_cupom.usos_atual, 0) >= v_cupom.usos_max THEN RAISE EXCEPTION 'Este cupom atingiu o limite de usos.'; END IF;
    IF v_cupom.tipo = 'percentual' THEN
      v_desconto := LEAST(v_subtotal, ROUND(v_subtotal * (v_cupom.valor / 100.0), 2));
    ELSE
      v_desconto := LEAST(v_subtotal, v_cupom.valor);
    END IF;
    UPDATE public.cupons SET usos_atual = COALESCE(usos_atual, 0) + 1 WHERE id = p_cupom_id;
  ELSIF p_tipo = 'pdv' AND p_desconto_pdv > 0 THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária para aplicar desconto PDV.'; END IF;
    v_desconto := LEAST(v_subtotal, GREATEST(0, p_desconto_pdv));
  END IF;

  v_total := GREATEST(0, v_subtotal + v_taxa - v_desconto);

  INSERT INTO public.pedidos (
    empresa_id, numero, cliente_nome, cliente_telefone, cliente_endereco,
    forma_pagamento, observacao, subtotal, taxa_entrega, desconto, total,
    mesa, tipo, status, cupom_id, cliente_lat, cliente_lng, cliente_cpf, cliente_cep, cliente_cidade
  ) VALUES (
    p_empresa_id, v_numero, p_cliente_nome, p_cliente_telefone, p_cliente_endereco,
    p_forma_pagamento, p_observacao, v_subtotal, v_taxa, v_desconto, v_total,
    p_mesa, p_tipo, 'novo', p_cupom_id, p_cliente_lat, p_cliente_lng, p_cliente_cpf, p_cliente_cep, p_cliente_cidade
  ) RETURNING id INTO v_pedido_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'produto_id')::UUID;
    v_qty     := (v_item->>'quantidade')::INT;

    SELECT nome, COALESCE(preco_promocional, preco), requer_preparo
      INTO v_prod_nome, v_preco, v_req_preparo
      FROM public.produtos WHERE id = v_prod_id AND empresa_id = p_empresa_id;

    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, nome, quantidade, preco_unitario, subtotal, observacao, requer_preparo
    ) VALUES (
      v_pedido_id, v_prod_id, v_prod_nome, v_qty, v_preco, v_preco * v_qty,
      NULLIF(v_item->>'observacao', ''), COALESCE(v_req_preparo, true)
    );
  END LOOP;

  RETURN json_build_object(
    'id', v_pedido_id, 'numero', v_numero,
    'subtotal', v_subtotal, 'taxa_entrega', v_taxa, 'desconto', v_desconto, 'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_pedido(uuid,text,text,text,text,text,text,text,uuid,jsonb,double precision,double precision,text,text,text,numeric) TO anon, authenticated;
