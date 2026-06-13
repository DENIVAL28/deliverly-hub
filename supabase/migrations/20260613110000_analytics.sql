-- Analytics de cardápio: registra eventos de visita e conversão
CREATE TABLE IF NOT EXISTS public.analytics_eventos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  evento      TEXT        NOT NULL, -- visita | produto_visto | adicionado_carrinho | checkout_iniciado | pedido_finalizado
  produto_id  UUID,
  session_id  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_eventos_empresa_created
  ON public.analytics_eventos(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_eventos_empresa_evento
  ON public.analytics_eventos(empresa_id, evento);

ALTER TABLE public.analytics_eventos ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir (cardápio é público)
CREATE POLICY "Inserir evento público"
  ON public.analytics_eventos FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Apenas a empresa dona lê seus eventos
CREATE POLICY "Empresa lê seus eventos"
  ON public.analytics_eventos FOR SELECT TO authenticated
  USING (public.get_user_empresa_id(auth.uid()) = empresa_id OR public.is_master(auth.uid()));
