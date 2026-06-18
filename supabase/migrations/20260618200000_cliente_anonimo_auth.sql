-- ═══════════════════════════════════════════════════════════════════════════════
-- Cliente anônimo autenticado: signInAnonymously() + RLS por user_id
-- Resolve:
--   1. Realtime não funcionava para anon (sem sessão autenticada)
--   2. SELECT em pedidos/pedido_itens bloqueado para anon
--   3. PIX não aparecia no tracking (empresa JOIN retornava null)
--   4. Hack de UPDATE direto cliente→status removido; função cuida disso
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ── 1. Adiciona colunas a pedidos ──────────────────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS user_id     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS fluxo_pedido text NOT NULL DEFAULT 'automatico';

-- ── 2. RLS: cliente lê seu próprio pedido ─────────────────────────────────────
DROP POLICY IF EXISTS "cliente le proprio pedido" ON public.pedidos;
CREATE POLICY "cliente le proprio pedido" ON public.pedidos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 3. RLS: cliente lê itens do seu pedido ────────────────────────────────────
DROP POLICY IF EXISTS "cliente le itens do proprio pedido" ON public.pedido_itens;
CREATE POLICY "cliente le itens do proprio pedido" ON public.pedido_itens
  FOR SELECT TO authenticated
  USING (
    pedido_id IN (SELECT id FROM public.pedidos WHERE user_id = auth.uid())
  );

-- ── 4. finalizar_pedido v5 ────────────────────────────────────────────────────
--   • Lê fluxo_pedido da empresa
--   • Status inicial: aguardando_confirmacao se manual+não-pdv, 'novo' senão
--   • Grava user_id = auth.uid() e fluxo_pedido no pedido
--   • Retorna status e fluxo_pedido para o frontend decidir o fluxo
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_emp_fluxo      TEXT;
  v_status_inicial public.pedido_status;
BEGIN
  -- ── 0. Valida tipo ────────────────────────────────────────────────────────────
  IF p_tipo NOT IN ('delivery', 'retirada', 'pdv', 'mesa', 'balcao') THEN
    RAISE EXCEPTION 'Tipo de pedido inválido: %', p_tipo;
  END IF;

  -- ── 1. Valida empresa ─────────────────────────────────────────────────────────
  SELECT status, taxa_entrega, taxa_entrega_tipo, taxa_entrega_por_km,
         taxa_entrega_base, empresa_lat, empresa_lng,
         COALESCE(fluxo_pedido, 'automatico')
    INTO v_emp_status, v_emp_taxa, v_taxa_tipo, v_taxa_por_km,
         v_taxa_base, v_emp_lat, v_emp_lng,
         v_emp_fluxo
    FROM public.empresas
   WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;
  IF v_emp_status <> 'ativa' THEN
    RAISE EXCEPTION 'Esta loja não está aceitando pedidos no momento.';
  END IF;

  -- ── 2. Valida itens e recalcula subtotal ──────────────────────────────────────
  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido deve ter ao menos um item.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'produto_id')::UUID;
    v_qty     := (v_item->>'quantidade')::INT;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida no pedido.';
    END IF;

    SELECT nome,
           COALESCE(preco_promocional, preco),
           ativo,
           controlar_estoque,
           estoque
      INTO v_prod_nome, v_preco, v_ativo, v_ctrl_est, v_estoque
      FROM public.produtos
     WHERE id = v_prod_id AND empresa_id = p_empresa_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado ou não pertence a esta empresa (id: %).', v_prod_id;
    END IF;
    IF NOT v_ativo THEN
      RAISE EXCEPTION 'Produto "%" está indisponível.', v_prod_nome;
    END IF;

    IF v_ctrl_est IS TRUE THEN
      IF COALESCE(v_estoque, 0) < v_qty THEN
        RAISE EXCEPTION 'Produto "%" sem estoque suficiente (disponível: %).', v_prod_nome, COALESCE(v_estoque, 0);
      END IF;
      UPDATE public.produtos
         SET estoque = GREATEST(0, COALESCE(estoque, 0) - v_qty)
       WHERE id = v_prod_id;
    END IF;

    v_subtotal := v_subtotal + (v_preco * v_qty);
  END LOOP;

  -- ── 3. Taxa de entrega (fixa ou por km) ───────────────────────────────────────
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

  -- ── 4. Valida cupom e calcula desconto ────────────────────────────────────────
  IF p_cupom_id IS NOT NULL THEN
    SELECT ativo, validade, usos_max, usos_atual, tipo, valor
      INTO v_cupom
      FROM public.cupons
     WHERE id = p_cupom_id AND empresa_id = p_empresa_id
       FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido.'; END IF;
    IF NOT v_cupom.ativo THEN RAISE EXCEPTION 'Este cupom está inativo.'; END IF;
    IF v_cupom.validade IS NOT NULL AND v_cupom.validade < CURRENT_DATE THEN
      RAISE EXCEPTION 'Este cupom expirou.';
    END IF;
    IF v_cupom.usos_max IS NOT NULL AND COALESCE(v_cupom.usos_atual, 0) >= v_cupom.usos_max THEN
      RAISE EXCEPTION 'Este cupom atingiu o limite de usos.';
    END IF;

    IF v_cupom.tipo = 'percentual' THEN
      v_desconto := LEAST(v_subtotal, ROUND(v_subtotal * (v_cupom.valor / 100.0), 2));
    ELSE
      v_desconto := LEAST(v_subtotal, v_cupom.valor);
    END IF;

    UPDATE public.cupons SET usos_atual = COALESCE(usos_atual, 0) + 1 WHERE id = p_cupom_id;

  ELSIF p_tipo = 'pdv' AND p_desconto_pdv > 0 THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Autenticação necessária para aplicar desconto PDV.';
    END IF;
    v_desconto := LEAST(v_subtotal, GREATEST(0, p_desconto_pdv));
  END IF;

  -- ── 5. Total final ────────────────────────────────────────────────────────────
  v_total := GREATEST(0, v_subtotal + v_taxa - v_desconto);

  -- ── 6. Status inicial ─────────────────────────────────────────────────────────
  --   Fluxo manual e pedido de cliente (não PDV/mesa): aguarda confirmação do dono
  IF v_emp_fluxo = 'manual' AND p_tipo NOT IN ('pdv', 'mesa', 'balcao') THEN
    v_status_inicial := 'aguardando_confirmacao';
  ELSE
    v_status_inicial := 'novo';
  END IF;

  -- ── 7. Insere pedido ──────────────────────────────────────────────────────────
  INSERT INTO public.pedidos (
    empresa_id, cliente_nome, cliente_telefone, cliente_endereco,
    forma_pagamento, observacao,
    subtotal, taxa_entrega, desconto, total,
    mesa, tipo, status, cupom_id,
    cliente_lat, cliente_lng,
    cliente_cpf, cliente_cep, cliente_cidade,
    user_id, fluxo_pedido
  ) VALUES (
    p_empresa_id, p_cliente_nome, p_cliente_telefone, p_cliente_endereco,
    p_forma_pagamento, p_observacao,
    v_subtotal, v_taxa, v_desconto, v_total,
    p_mesa, p_tipo, v_status_inicial, p_cupom_id,
    p_cliente_lat, p_cliente_lng,
    p_cliente_cpf, p_cliente_cep, p_cliente_cidade,
    auth.uid(), v_emp_fluxo
  )
  RETURNING id, numero INTO v_pedido_id, v_numero;

  -- ── 8. Insere itens com preços do banco ────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'produto_id')::UUID;
    v_qty     := (v_item->>'quantidade')::INT;

    SELECT nome, COALESCE(preco_promocional, preco)
      INTO v_prod_nome, v_preco
      FROM public.produtos
     WHERE id = v_prod_id AND empresa_id = p_empresa_id;

    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, nome, quantidade, preco_unitario, subtotal, observacao
    ) VALUES (
      v_pedido_id, v_prod_id,
      v_prod_nome, v_qty,
      v_preco, v_preco * v_qty,
      NULLIF(v_item->>'observacao', '')
    );
  END LOOP;

  RETURN json_build_object(
    'id',           v_pedido_id,
    'numero',       v_numero,
    'subtotal',     v_subtotal,
    'taxa_entrega', v_taxa,
    'desconto',     v_desconto,
    'total',        v_total,
    'status',       v_status_inicial::text,
    'fluxo_pedido', v_emp_fluxo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_pedido(uuid,text,text,text,text,text,text,text,uuid,jsonb,double precision,double precision,text,text,text,numeric) TO anon, authenticated;
