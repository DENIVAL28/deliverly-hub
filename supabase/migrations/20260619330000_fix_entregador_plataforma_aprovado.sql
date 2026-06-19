-- Fix: freelancer_pedidos_disponiveis usava apenas "aprovado = true"
-- mas entregadores de plataforma aprovados via painel master ou dashboard
-- podem ter status_cadastro = 'aprovado' sem o boolean "aprovado" atualizado.
--
-- 1. Sincroniza o boolean aprovado para entregadores de plataforma
-- 2. Atualiza freelancer_pedidos_disponiveis para checar status_cadastro
--    (mais robusto que o boolean isolado)

SET search_path = public;

-- 1. Sincroniza: todos os entregadores de plataforma com status_cadastro='aprovado'
--    devem ter aprovado=true
UPDATE public.entregadores
   SET aprovado  = true,
       verificado = true
 WHERE empresa_id IS NULL
   AND status_cadastro = 'aprovado'
   AND aprovado = false;

-- 2. Recria freelancer_pedidos_disponiveis com checagem mais robusta
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
  v_sc      TEXT;
BEGIN
  SELECT id, empresa_id, status_cadastro
    INTO v_id, v_empresa, v_sc
    FROM public.entregadores
   WHERE public_token = p_token::uuid
     AND (aprovado = true OR status_cadastro = 'aprovado');

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
    -- Plataforma: pedidos de todas as empresas com modo 'plataforma'
    -- Sem filtro por tipo para compatibilidade — a loja controla o modo
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

GRANT EXECUTE ON FUNCTION public.freelancer_pedidos_disponiveis(text) TO anon, authenticated;
