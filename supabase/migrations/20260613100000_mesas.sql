-- Tabela de mesas para QR Code e comandas
CREATE TABLE IF NOT EXISTS public.mesas (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID    NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL,
  nome        TEXT,
  capacidade  INTEGER DEFAULT 4,
  qr_token    UUID    NOT NULL DEFAULT gen_random_uuid(),
  ativa       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, numero)
);

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa gerencia suas mesas"
  ON public.mesas FOR ALL TO authenticated
  USING  (public.get_user_empresa_id(auth.uid()) = empresa_id OR public.is_master(auth.uid()))
  WITH CHECK (public.get_user_empresa_id(auth.uid()) = empresa_id OR public.is_master(auth.uid()));
