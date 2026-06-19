-- ============================================================
-- Simplificação: entrega por modo da empresa, sem parcerias individuais
--
-- Antes: entregador de plataforma precisava solicitar parceria
--        com cada loja e esperar aprovação individual.
-- Agora: empresa escolhe o modo de operação:
--   'plataforma' → qualquer entregador aprovado vê os pedidos
--   'fixos'      → só entregadores vinculados diretamente
--
-- A tabela entregador_parcerias fica (não é droppada) mas deixa
-- de ser o mecanismo de autorização dos RPCs.
-- ============================================================

SET search_path = public;

-- Garantir que a coluna existe (já foi criada em migração anterior)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_operacao_entrega TEXT NOT NULL DEFAULT 'plataforma'
    CHECK (tipo_operacao_entrega IN ('plataforma', 'fixos'));

-- RLS: restaurante pode ver entregadores aprovados da plataforma
-- (para exibir lista de disponíveis no painel)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entregadores'
      AND policyname = 'empresa ve entregadores plataforma aprovados'
  ) THEN
    CREATE POLICY "empresa ve entregadores plataforma aprovados"
      ON public.entregadores FOR SELECT TO authenticated
      USING (
        empresa_id IS NULL
        AND aprovado = true
        AND status_cadastro = 'aprovado'
        AND public.get_user_empresa_id(auth.uid()) IS NOT NULL
      );
  END IF;
END $$;

-- ── freelancer_pedidos_disponiveis ───────────────────────────────────────────
-- Entregador de plataforma: vê pedidos de todas as empresas com modo 'plataforma'
-- Entregador fixo/freelancer antigo: vê pedidos da sua empresa (comportamento antigo)
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
    -- Sistema antigo: entregador vinculado a empresa específica
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
    -- Plataforma: pedidos de todas as empresas ativas com modo 'plataforma'
    RETURN QUERY
      SELECT p.id, p.numero, p.cliente_nome, p.cliente_endereco,
             p.taxa_entrega, p.status::text, p.created_at
        FROM public.pedidos p
        JOIN public.empresas e ON e.id = p.empresa_id
       WHERE e.tipo_operacao_entrega = 'plataforma'
         AND e.status = 'ativa'
         AND p.status IN ('aceito', 'preparo', 'entrega')
         AND p.entregador_id IS NULL
         AND (p.tipo IS NULL OR p.tipo = 'delivery')
       ORDER BY p.created_at ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_pedidos_disponiveis(text) TO anon, authenticated;

-- ── freelancer_pegar_entrega ─────────────────────────────────────────────────
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

  -- Verificar autorização
  IF v_empresa IS NOT NULL THEN
    -- Sistema antigo: deve ser da mesma empresa
    IF v_ped_emp != v_empresa THEN
      RETURN json_build_object('ok', false, 'erro', 'Pedido inválido.');
    END IF;
  ELSE
    -- Plataforma: empresa do pedido deve estar no modo 'plataforma'
    IF NOT EXISTS (
      SELECT 1 FROM public.empresas
       WHERE id = v_ped_emp
         AND tipo_operacao_entrega = 'plataforma'
         AND status = 'ativa'
    ) THEN
      RETURN json_build_object('ok', false, 'erro', 'Esta loja não usa entregadores da plataforma.');
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

-- RPC: empresa atualiza seu modo de operação de entrega
CREATE OR REPLACE FUNCTION public.empresa_definir_modo_entrega(p_modo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_empresa UUID;
BEGIN
  IF p_modo NOT IN ('plataforma', 'fixos') THEN
    RETURN jsonb_build_object('error', 'Modo inválido');
  END IF;
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;
  UPDATE public.empresas SET tipo_operacao_entrega = p_modo WHERE id = v_empresa;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_definir_modo_entrega(text) TO authenticated;
