CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id   UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  nota        SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler avaliações (exibidas na loja pública)
CREATE POLICY "avaliacoes_select_public" ON public.avaliacoes
  FOR SELECT USING (true);

-- Qualquer um pode criar (cliente não autenticado finaliza pedido e avalia)
CREATE POLICY "avaliacoes_insert_public" ON public.avaliacoes
  FOR INSERT WITH CHECK (true);

-- Empresa dona pode deletar avaliações da própria loja
CREATE POLICY "avaliacoes_delete_owner" ON public.avaliacoes
  FOR DELETE USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_avaliacoes_empresa ON public.avaliacoes(empresa_id);
