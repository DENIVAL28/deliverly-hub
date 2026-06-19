-- ============================================================
-- Fix: entregadores de plataforma (empresa_id IS NULL) não
-- apareciam para lojistas porque a policy "Entregador visível
-- por empresa ativa" nunca é verdadeira quando empresa_id = NULL.
-- ============================================================

SET search_path = public;

-- Recria a policy base incluindo entregadores aprovados de plataforma
DROP POLICY IF EXISTS "Entregador visível por empresa ativa" ON public.entregadores;
CREATE POLICY "Entregador visível por empresa ativa"
  ON public.entregadores FOR SELECT
  USING (
    -- entregador vinculado a empresa ativa (sistema token/fixo)
    EXISTS (
      SELECT 1 FROM public.empresas e
       WHERE e.id = empresa_id AND e.status = 'ativa'
    )
    -- dono da empresa vê seus entregadores (fixos)
    OR public.get_user_empresa_id(auth.uid()) = empresa_id
    -- master vê tudo
    OR public.is_master(auth.uid())
    -- entregador de plataforma aprovado: visível para qualquer usuário autenticado
    OR (empresa_id IS NULL AND status_cadastro = 'aprovado')
    -- entregador vê seu próprio registro (mesmo que não aprovado ainda)
    OR auth_user_id = auth.uid()
  );

-- Atualiza RPC para não depender de get_user_empresa_id (mais simples e robusto)
CREATE OR REPLACE FUNCTION public.empresa_listar_entregadores_plataforma()
RETURNS TABLE (
  id             UUID,
  nome           TEXT,
  veiculo        TEXT,
  foto_rosto_url TEXT,
  status         TEXT,
  verificado     BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT e.id, e.nome, e.veiculo, e.foto_rosto_url,
         COALESCE(e.status, 'indisponivel'), e.verificado
    FROM public.entregadores e
   WHERE e.empresa_id IS NULL
     AND e.status_cadastro = 'aprovado'
   ORDER BY
     CASE WHEN e.status = 'disponivel' THEN 0
          WHEN e.status = 'em_rota'    THEN 1
          ELSE 2 END,
     e.nome;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_listar_entregadores_plataforma() TO authenticated;
