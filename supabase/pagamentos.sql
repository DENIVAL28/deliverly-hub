CREATE TABLE IF NOT EXISTS public.pagamentos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano             TEXT        NOT NULL,
  valor             NUMERIC     NOT NULL,
  mp_payment_id     TEXT        UNIQUE,
  status            TEXT        NOT NULL DEFAULT 'aprovado',
  vencimento_gerado TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Empresa vê seus próprios pagamentos
CREATE POLICY "pagamentos_owner" ON public.pagamentos
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  );

-- Master vê e gerencia todos
CREATE POLICY "pagamentos_master" ON public.pagamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master')
  );

CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa ON public.pagamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mp_id   ON public.pagamentos(mp_payment_id);
