-- C3: RLS para grupos_opcoes, opcoes e cupons
-- Essas tabelas existiam sem RLS habilitado, expostas sem proteção.

-- =============================
-- grupos_opcoes
-- =============================
ALTER TABLE public.grupos_opcoes ENABLE ROW LEVEL SECURITY;

-- Clientes precisam ver as opções do cardápio sem login
CREATE POLICY "grupos_opcoes_select_public"
  ON public.grupos_opcoes FOR SELECT
  USING (true);

-- Apenas a empresa dona do produto pode criar/editar/deletar grupos de opções
CREATE POLICY "grupos_opcoes_empresa_gerencia"
  ON public.grupos_opcoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = grupos_opcoes.produto_id
        AND p.empresa_id = public.get_user_empresa_id(auth.uid())
    )
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produto_id
        AND p.empresa_id = public.get_user_empresa_id(auth.uid())
    )
    OR public.is_master(auth.uid())
  );

-- =============================
-- opcoes
-- =============================
ALTER TABLE public.opcoes ENABLE ROW LEVEL SECURITY;

-- Clientes precisam ver as opções sem login
CREATE POLICY "opcoes_select_public"
  ON public.opcoes FOR SELECT
  USING (true);

-- Apenas a empresa dona pode criar/editar/deletar opções
CREATE POLICY "opcoes_empresa_gerencia"
  ON public.opcoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_opcoes g
      JOIN public.produtos p ON p.id = g.produto_id
      WHERE g.id = opcoes.grupo_id
        AND p.empresa_id = public.get_user_empresa_id(auth.uid())
    )
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grupos_opcoes g
      JOIN public.produtos p ON p.id = g.produto_id
      WHERE g.id = grupo_id
        AND p.empresa_id = public.get_user_empresa_id(auth.uid())
    )
    OR public.is_master(auth.uid())
  );

-- =============================
-- cupons
-- =============================
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- Clientes precisam consultar o cupom pelo código no checkout (sem login)
CREATE POLICY "cupons_select_public"
  ON public.cupons FOR SELECT
  USING (true);

-- Apenas a empresa dona pode criar/editar/deletar cupons
CREATE POLICY "cupons_empresa_gerencia"
  ON public.cupons FOR ALL
  TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id(auth.uid())
    OR public.is_master(auth.uid())
  );
