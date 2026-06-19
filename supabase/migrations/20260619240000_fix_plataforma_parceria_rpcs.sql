-- ============================================================
-- Fix: entregadores de plataforma (empresa_id IS NULL)
-- Problema 1: freelancer_pedidos_disponiveis filtrava por empresa_id
--             que é NULL para entregadores de plataforma → retornava vazio
-- Problema 2: RLS impedia lojista de ver dados do entregador de plataforma
--             no card de Parcerias (nested select bloqueado)
-- Problema 3: freelancer_pegar_entrega não validava parceria aceita,
--             permitindo (teoricamente) aceitar pedidos sem parceria
-- ============================================================

SET search_path = public;

-- ── 1. RLS: empresa pode ver entregadores de plataforma com parceria ────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entregadores' AND policyname = 'empresa ve entregador de parceria'
  ) THEN
    CREATE POLICY "empresa ve entregador de parceria"
      ON public.entregadores FOR SELECT TO authenticated
      USING (
        empresa_id IS NULL AND
        EXISTS (
          SELECT 1 FROM public.entregador_parcerias ep
           WHERE ep.entregador_id = entregadores.id
             AND ep.empresa_id = public.get_user_empresa_id(auth.uid())
        )
      );
  END IF;
END $$;

-- ── 2. freelancer_pedidos_disponiveis com suporte a parcerias ───────────────────
-- Sistema antigo: entregador tem empresa_id → filtra pedidos da empresa
-- Sistema novo:   entregador tem empresa_id IS NULL → filtra pedidos das empresas parceiras (aceitas)
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
DECLARE
  v_id      UUID;
  v_empresa UUID;
BEGIN
  SELECT id, empresa_id INTO v_id, v_empresa
    FROM public.entregadores
   WHERE public_token = p_token::uuid
     AND aprovado = true;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_empresa IS NOT NULL THEN
    -- Sistema antigo: freelancer vinculado a empresa específica
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
    -- Sistema novo: entregador de plataforma, pedidos das empresas parceiras aceitas
    RETURN QUERY
      SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
             p.taxa_entrega, p.status::text, p.created_at
        FROM public.pedidos p
        JOIN public.entregador_parcerias ep ON ep.empresa_id = p.empresa_id
       WHERE ep.entregador_id = v_id
         AND ep.status = 'aceita'
         AND p.status IN ('aceito', 'preparo', 'entrega')
         AND p.entregador_id IS NULL
         AND (p.tipo IS NULL OR p.tipo = 'delivery')
       ORDER BY p.created_at ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_pedidos_disponiveis(text) TO anon, authenticated;

-- ── 3. freelancer_pegar_entrega com validação de parceria ──────────────────────
CREATE OR REPLACE FUNCTION public.freelancer_pegar_entrega(
  p_token     TEXT,
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
    FROM public.entregadores
   WHERE public_token = p_token::uuid
     AND aprovado = true;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'erro', 'Não autorizado.');
  END IF;

  SELECT empresa_id, status, entregador_id
    INTO v_ped_emp, v_ped_st, v_ped_ent
    FROM public.pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  END IF;

  IF v_ped_ent IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido já foi aceito por outro entregador.');
  END IF;

  IF v_ped_st NOT IN ('aceito', 'preparo', 'entrega') THEN
    RETURN json_build_object('ok', false, 'erro', 'Pedido não está disponível para entrega.');
  END IF;

  -- Verificar autorização pela empresa
  IF v_empresa IS NOT NULL THEN
    -- Sistema antigo: empresa_id deve bater
    IF v_ped_emp != v_empresa THEN
      RETURN json_build_object('ok', false, 'erro', 'Pedido inválido.');
    END IF;
  ELSE
    -- Sistema novo (plataforma): deve ter parceria aceita com a empresa do pedido
    IF NOT EXISTS (
      SELECT 1 FROM public.entregador_parcerias
       WHERE entregador_id = v_id
         AND empresa_id = v_ped_emp
         AND status = 'aceita'
    ) THEN
      RETURN json_build_object('ok', false, 'erro', 'Sem parceria ativa com esta empresa.');
    END IF;
  END IF;

  UPDATE public.pedidos
     SET entregador_id = v_id,
         status = 'entrega'
   WHERE id = p_pedido_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_pegar_entrega(text, uuid) TO anon, authenticated;
