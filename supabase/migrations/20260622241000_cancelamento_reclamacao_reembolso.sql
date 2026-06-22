-- Sistema completo de cancelamento, reclamação e reembolso de pedidos.
-- Inclui: novas colunas em pedidos, tabelas auxiliares, RPCs para cliente/lojista/sistema,
-- pg_cron para timeout automático, e RLS para as novas tabelas.

SET search_path = public;

-- ── 1. Novas colunas em pedidos ──────────────────────────────────────────────

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cancelado_por         TEXT,         -- 'lojista' | 'cliente' | 'sistema'
  ADD COLUMN IF NOT EXISTS cancelado_em          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pedido_errado         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_pedido_errado  TEXT,
  ADD COLUMN IF NOT EXISTS reembolso_solicitado  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reembolso_status      TEXT DEFAULT NULL, -- 'pendente' | 'aprovado' | 'negado' | 'processado'
  ADD COLUMN IF NOT EXISTS reembolso_em          TIMESTAMPTZ;

-- ── 2. Tabela cancelamento_log ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cancelamento_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID        REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cancelado_por    TEXT        NOT NULL,  -- 'lojista' | 'cliente' | 'sistema'
  motivo           TEXT        NOT NULL,
  status_no_momento TEXT       NOT NULL,
  criado_em        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cancelamento_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lojista_le_cancelamento_log" ON public.cancelamento_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos p
       WHERE p.id = pedido_id
         AND p.empresa_id = public.get_user_empresa_id(auth.uid())
    )
  );

-- ── 3. Tabela reclamacoes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reclamacoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID        REFERENCES public.pedidos(id) ON DELETE CASCADE,
  empresa_id   UUID        REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo         TEXT        NOT NULL,  -- 'pedido_errado'|'nao_chegou'|'item_faltando'|'qualidade'|'outro'
  descricao    TEXT,
  status       TEXT        DEFAULT 'aberta', -- 'aberta'|'em_analise'|'resolvida'|'negada'
  criado_em    TIMESTAMPTZ DEFAULT now(),
  resolvido_em TIMESTAMPTZ,
  resolucao    TEXT
);

ALTER TABLE public.reclamacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lojista_le_reclamacoes" ON public.reclamacoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "lojista_atualiza_reclamacoes" ON public.reclamacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- ── 4. Campo timeout_aceite_minutos em empresas ───────────────────────────────

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS timeout_aceite_minutos INT DEFAULT 30;

-- ── 5. empresa_atualizar_pedido — cancelado_por + cancelado_em + log ──────────

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

  -- Valida cancelamento: motivo obrigatório
  IF p_status = 'cancelado' AND (p_motivo_cancelamento IS NULL OR trim(p_motivo_cancelamento) = '') THEN
    RETURN jsonb_build_object('error', 'Informe o motivo do cancelamento');
  END IF;

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

    IF p_status = 'cancelado' THEN
      -- Restaura estoque
      UPDATE public.produtos pr
         SET estoque = COALESCE(pr.estoque, 0) + pi.quantidade
        FROM public.pedido_itens pi
       WHERE pi.pedido_id  = p_pedido_id
         AND pi.produto_id = pr.id
         AND pr.controlar_estoque = true;

      -- Reverte cupom
      IF v_cupom_id IS NOT NULL THEN
        UPDATE public.cupons
           SET usos_atual = GREATEST(0, COALESCE(usos_atual, 0) - 1)
         WHERE id = v_cupom_id;
      END IF;
    END IF;
  END IF;

  -- Bloqueia finalização em modo plataforma quando entregador tem o pedido
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
     SET status               = COALESCE(p_status::pedido_status,   status),
         entregador_id        = COALESCE(p_entregador_id,           entregador_id),
         entregador_nome      = COALESCE(p_entregador_nome,         entregador_nome),
         desconto             = COALESCE(p_desconto,                desconto),
         motivo_cancelamento  = COALESCE(p_motivo_cancelamento,     motivo_cancelamento),
         cancelado_por        = CASE WHEN p_status = 'cancelado' THEN 'lojista' ELSE cancelado_por END,
         cancelado_em         = CASE WHEN p_status = 'cancelado' THEN now()    ELSE cancelado_em  END
   WHERE id = p_pedido_id
     AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  -- Registra no log de cancelamento
  IF p_status = 'cancelado' THEN
    INSERT INTO public.cancelamento_log (pedido_id, cancelado_por, motivo, status_no_momento)
    VALUES (p_pedido_id, 'lojista', trim(p_motivo_cancelamento), v_status_atual);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_atualizar_pedido(UUID, TEXT, UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ── 6. cancelar_pedido_cliente — cliente cancela se status ainda permite ──────

CREATE OR REPLACE FUNCTION public.cancelar_pedido_cliente(
  p_pedido_id UUID,
  p_motivo    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status     TEXT;
  v_numero     INT;
  v_empresa_id UUID;
  v_cupom_id   UUID;
BEGIN
  SELECT status::TEXT, numero, empresa_id, cupom_id
    INTO v_status, v_numero, v_empresa_id, v_cupom_id
    FROM public.pedidos
   WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RETURN jsonb_build_object('error', 'Informe o motivo do cancelamento');
  END IF;

  IF v_status NOT IN ('novo', 'aguardando_confirmacao', 'aguardando_pagamento') THEN
    RETURN jsonb_build_object(
      'error', 'Pedido já em preparo. Entre em contato com a loja para cancelar.'
    );
  END IF;

  -- Restaura estoque
  UPDATE public.produtos pr
     SET estoque = COALESCE(pr.estoque, 0) + pi.quantidade
    FROM public.pedido_itens pi
   WHERE pi.pedido_id  = p_pedido_id
     AND pi.produto_id = pr.id
     AND pr.controlar_estoque = true;

  -- Reverte cupom
  IF v_cupom_id IS NOT NULL THEN
    UPDATE public.cupons
       SET usos_atual = GREATEST(0, COALESCE(usos_atual, 0) - 1)
     WHERE id = v_cupom_id;
  END IF;

  UPDATE public.pedidos
     SET status              = 'cancelado'::pedido_status,
         cancelado_por       = 'cliente',
         motivo_cancelamento = trim(p_motivo),
         cancelado_em        = now()
   WHERE id = p_pedido_id;

  INSERT INTO public.cancelamento_log (pedido_id, cancelado_por, motivo, status_no_momento)
  VALUES (p_pedido_id, 'cliente', trim(p_motivo), v_status);

  RETURN jsonb_build_object('ok', true, 'numero', v_numero, 'empresa_id', v_empresa_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_pedido_cliente(UUID, TEXT) TO anon, authenticated;

-- ── 7. cancelar_pedido_timeout — chamado pelo pg_cron a cada 5 minutos ────────

CREATE OR REPLACE FUNCTION public.cancelar_pedido_timeout()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_count  INT := 0;
BEGIN
  FOR v_pedido IN
    SELECT p.id, p.numero, p.empresa_id,
           p.status::TEXT AS status, p.cupom_id
      FROM public.pedidos p
      JOIN public.empresas e ON e.id = p.empresa_id
     WHERE p.status IN ('novo', 'aguardando_confirmacao')
       AND p.created_at < now() - (COALESCE(e.timeout_aceite_minutos, 30) * INTERVAL '1 minute')
  LOOP
    UPDATE public.produtos pr
       SET estoque = COALESCE(pr.estoque, 0) + pi.quantidade
      FROM public.pedido_itens pi
     WHERE pi.pedido_id  = v_pedido.id
       AND pi.produto_id = pr.id
       AND pr.controlar_estoque = true;

    IF v_pedido.cupom_id IS NOT NULL THEN
      UPDATE public.cupons
         SET usos_atual = GREATEST(0, COALESCE(usos_atual, 0) - 1)
       WHERE id = v_pedido.cupom_id;
    END IF;

    UPDATE public.pedidos
       SET status              = 'cancelado'::pedido_status,
           cancelado_por       = 'sistema',
           motivo_cancelamento = 'Lojista não respondeu no tempo configurado',
           cancelado_em        = now()
     WHERE id = v_pedido.id;

    INSERT INTO public.cancelamento_log (pedido_id, cancelado_por, motivo, status_no_momento)
    VALUES (v_pedido.id, 'sistema', 'Lojista não respondeu no tempo configurado', v_pedido.status);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_pedido_timeout() TO authenticated;

-- ── 8. abrir_reclamacao — cliente reporta problema em pedido finalizado ────────

CREATE OR REPLACE FUNCTION public.abrir_reclamacao(
  p_pedido_id  UUID,
  p_tipo       TEXT,
  p_descricao  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_numero     INT;
  v_rec_id     UUID;
BEGIN
  SELECT empresa_id, numero
    INTO v_empresa_id, v_numero
    FROM public.pedidos
   WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  IF p_tipo NOT IN ('pedido_errado', 'nao_chegou', 'item_faltando', 'qualidade', 'outro') THEN
    RETURN jsonb_build_object('error', 'Tipo de reclamação inválido');
  END IF;

  INSERT INTO public.reclamacoes (pedido_id, empresa_id, tipo, descricao)
  VALUES (p_pedido_id, v_empresa_id, p_tipo, p_descricao)
  RETURNING id INTO v_rec_id;

  IF p_tipo = 'pedido_errado' THEN
    UPDATE public.pedidos
       SET pedido_errado       = true,
           motivo_pedido_errado = p_descricao
     WHERE id = p_pedido_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reclamacao_id', v_rec_id, 'numero', v_numero);
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_reclamacao(UUID, TEXT, TEXT) TO anon, authenticated;

-- ── 9. solicitar_reembolso ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.solicitar_reembolso(
  p_pedido_id UUID,
  p_motivo    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status               TEXT;
  v_reembolso_solicitado BOOLEAN;
  v_numero               INT;
BEGIN
  SELECT status::TEXT, reembolso_solicitado, numero
    INTO v_status, v_reembolso_solicitado, v_numero
    FROM public.pedidos
   WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  IF v_reembolso_solicitado THEN
    RETURN jsonb_build_object('error', 'Reembolso já solicitado para este pedido');
  END IF;

  UPDATE public.pedidos
     SET reembolso_solicitado = true,
         reembolso_status     = 'pendente'
   WHERE id = p_pedido_id;

  IF p_motivo IS NOT NULL AND trim(p_motivo) <> '' THEN
    INSERT INTO public.cancelamento_log (pedido_id, cancelado_por, motivo, status_no_momento)
    VALUES (p_pedido_id, 'cliente', 'Reembolso solicitado: ' || trim(p_motivo), v_status);
  END IF;

  RETURN jsonb_build_object('ok', true, 'numero', v_numero);
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_reembolso(UUID, TEXT) TO anon, authenticated;

-- ── 10. empresa_resolver_reclamacao — lojista resolve/nega reclamação ─────────

CREATE OR REPLACE FUNCTION public.empresa_resolver_reclamacao(
  p_reclamacao_id UUID,
  p_status        TEXT,           -- 'resolvida' | 'negada'
  p_resolucao     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;

  IF p_status NOT IN ('resolvida', 'negada') THEN
    RETURN jsonb_build_object('error', 'Status inválido');
  END IF;

  UPDATE public.reclamacoes
     SET status       = p_status,
         resolucao    = p_resolucao,
         resolvido_em = now()
   WHERE id         = p_reclamacao_id
     AND empresa_id = v_empresa;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Reclamação não encontrada');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_resolver_reclamacao(UUID, TEXT, TEXT) TO authenticated;

-- ── 11. empresa_resolver_reembolso — lojista aprova ou nega reembolso ─────────

CREATE OR REPLACE FUNCTION public.empresa_resolver_reembolso(
  p_pedido_id UUID,
  p_status    TEXT,           -- 'aprovado' | 'negado'
  p_motivo    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;

  IF p_status NOT IN ('aprovado', 'negado') THEN
    RETURN jsonb_build_object('error', 'Status inválido');
  END IF;

  UPDATE public.pedidos
     SET reembolso_status = p_status,
         reembolso_em     = now()
   WHERE id         = p_pedido_id
     AND empresa_id = v_empresa
     AND reembolso_solicitado = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado ou reembolso não solicitado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_resolver_reembolso(UUID, TEXT, TEXT) TO authenticated;

-- ── 12. buscar_pedido_tracking — inclui novos campos ─────────────────────────

CREATE OR REPLACE FUNCTION public.buscar_pedido_tracking(p_pedido_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',                   p.id,
    'numero',               p.numero,
    'status',               p.status::text,
    'tipo',                 p.tipo,
    'fluxo_pedido',         p.fluxo_pedido,
    'subtotal',             p.subtotal,
    'taxa_entrega',         p.taxa_entrega,
    'desconto',             p.desconto,
    'total',                p.total,
    'forma_pagamento',      p.forma_pagamento,
    'troco',                p.troco,
    'cliente_nome',         p.cliente_nome,
    'cliente_telefone',     p.cliente_telefone,
    'cliente_endereco',     p.cliente_endereco,
    'cliente_lat',          p.cliente_lat,
    'cliente_lng',          p.cliente_lng,
    'mesa',                 p.mesa,
    'observacao',           p.observacao,
    'entregador_id',        p.entregador_id,
    'entregador_nome',      p.entregador_nome,
    'empresa_id',           p.empresa_id,
    'created_at',           p.created_at,
    -- campos de cancelamento
    'cancelado_por',        p.cancelado_por,
    'cancelado_em',         p.cancelado_em,
    'motivo_cancelamento',  p.motivo_cancelamento,
    -- campos de reclamação/reembolso
    'pedido_errado',        p.pedido_errado,
    'reembolso_solicitado', p.reembolso_solicitado,
    'reembolso_status',     p.reembolso_status,
    'pedido_itens', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',             pi.id,
        'nome',           pi.nome,
        'quantidade',     pi.quantidade,
        'preco_unitario', pi.preco_unitario,
        'subtotal',       pi.subtotal,
        'observacao',     pi.observacao
      )), '[]'::jsonb)
      FROM public.pedido_itens pi
      WHERE pi.pedido_id = p.id
    ),
    'empresas', jsonb_build_object(
      'nome_fantasia',    e.nome_fantasia,
      'whatsapp',         e.whatsapp,
      'logo_url',         e.logo_url,
      'chave_pix',        e.chave_pix,
      'tipo_chave_pix',   e.tipo_chave_pix,
      'nome_recebedor',   e.nome_recebedor,
      'cidade_recebedor', e.cidade_recebedor,
      'slug',             e.slug
    )
  )
  INTO v_result
  FROM public.pedidos p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = p_pedido_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_pedido_tracking(uuid) TO anon, authenticated;

-- ── 13. pg_cron — registra job de cancelamento por timeout ───────────────────
-- Requer extensão pg_cron (disponível no Supabase Pro e acima).

DO $$
BEGIN
  PERFORM cron.schedule(
    'cancelar-pedidos-timeout',
    '*/5 * * * *',
    $cron$ SELECT cancelar_pedido_timeout(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron não disponível ou job já registrado: %', SQLERRM;
END;
$$;
