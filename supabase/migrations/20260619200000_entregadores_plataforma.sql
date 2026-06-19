-- ============================================================
-- Módulo: Entregadores de Plataforma
-- Objetivo: Cadastro individual, login, validação master,
--           parcerias com lojas. Sistema token-based existente
--           permanece 100% intacto.
-- ============================================================

-- 1. Tornar empresa_id opcional em entregadores
--    Entregadores de plataforma têm empresa_id = NULL.
--    Os existentes (fixos/freelancers) mantêm seu empresa_id.
ALTER TABLE public.entregadores
  ALTER COLUMN empresa_id DROP NOT NULL;

-- 2. Novos campos para entregadores de plataforma
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS cpf              TEXT,
  ADD COLUMN IF NOT EXISTS cnh              TEXT,
  ADD COLUMN IF NOT EXISTS placa            TEXT,
  ADD COLUMN IF NOT EXISTS modelo_veiculo   TEXT,
  ADD COLUMN IF NOT EXISTS cor_veiculo      TEXT,
  ADD COLUMN IF NOT EXISTS foto_rosto_url   TEXT,
  ADD COLUMN IF NOT EXISTS status_cadastro  TEXT NOT NULL DEFAULT 'cadastro_incompleto'
    CHECK (status_cadastro IN (
      'cadastro_incompleto','aguardando_analise','em_analise',
      'aprovado','recusado','bloqueado'
    )),
  ADD COLUMN IF NOT EXISTS verificado       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_recusa    TEXT,
  ADD COLUMN IF NOT EXISTS cidade           TEXT;

-- Unicidade apenas para entregadores de plataforma (empresa_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS entregadores_email_plataforma_idx
  ON public.entregadores (email) WHERE empresa_id IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entregadores_cpf_plataforma_idx
  ON public.entregadores (cpf) WHERE empresa_id IS NULL AND cpf IS NOT NULL;

-- 3. Configuração de tipo de operação de entrega nas empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_operacao_entrega TEXT NOT NULL DEFAULT 'plataforma'
    CHECK (tipo_operacao_entrega IN ('plataforma', 'fixos'));

-- 4. Tabela de parcerias entregador ↔ empresa
CREATE TABLE IF NOT EXISTS public.entregador_parcerias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entregador_id UUID NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceita','recusada','cancelada')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entregador_id, empresa_id)
);

ALTER TABLE public.entregador_parcerias ENABLE ROW LEVEL SECURITY;

-- 5. Tabela de aceite de termos
CREATE TABLE IF NOT EXISTS public.entregador_termos_aceite (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entregador_id UUID NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  versao_termo  TEXT NOT NULL DEFAULT '1.0',
  aceito_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip            TEXT
);

ALTER TABLE public.entregador_termos_aceite ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Entregador de plataforma: lê e atualiza seu próprio registro
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entregadores'
      AND policyname = 'entregador plataforma le proprio registro'
  ) THEN
    CREATE POLICY "entregador plataforma le proprio registro"
      ON public.entregadores FOR SELECT TO authenticated
      USING (auth_user_id = auth.uid() AND empresa_id IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entregadores'
      AND policyname = 'entregador plataforma atualiza proprio'
  ) THEN
    CREATE POLICY "entregador plataforma atualiza proprio"
      ON public.entregadores FOR UPDATE TO authenticated
      USING (auth_user_id = auth.uid() AND empresa_id IS NULL)
      WITH CHECK (auth_user_id = auth.uid() AND empresa_id IS NULL);
  END IF;
END $$;

-- Insert: entregador cria seu próprio registro na plataforma
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entregadores'
      AND policyname = 'entregador plataforma insere proprio'
  ) THEN
    CREATE POLICY "entregador plataforma insere proprio"
      ON public.entregadores FOR INSERT TO authenticated
      WITH CHECK (auth_user_id = auth.uid() AND empresa_id IS NULL);
  END IF;
END $$;

-- Parcerias: entregador vê as suas
CREATE POLICY "entregador ve suas parcerias"
  ON public.entregador_parcerias FOR SELECT TO authenticated
  USING (
    entregador_id IN (
      SELECT id FROM public.entregadores WHERE auth_user_id = auth.uid()
    )
  );

-- Parcerias: entregador cria parceria
CREATE POLICY "entregador cria parceria"
  ON public.entregador_parcerias FOR INSERT TO authenticated
  WITH CHECK (
    entregador_id IN (
      SELECT id FROM public.entregadores WHERE auth_user_id = auth.uid()
    )
  );

-- Parcerias: empresa vê e atualiza as suas
CREATE POLICY "empresa ve parcerias da loja"
  ON public.entregador_parcerias FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "empresa atualiza parcerias da loja"
  ON public.entregador_parcerias FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Parcerias: master vê tudo
CREATE POLICY "master ve todas parcerias"
  ON public.entregador_parcerias FOR ALL TO authenticated
  USING (public.is_master(auth.uid()));

-- Termos: entregador insere e lê os seus
CREATE POLICY "entregador insere termos"
  ON public.entregador_termos_aceite FOR INSERT TO authenticated
  WITH CHECK (
    entregador_id IN (
      SELECT id FROM public.entregadores WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "entregador le seus termos"
  ON public.entregador_termos_aceite FOR SELECT TO authenticated
  USING (
    entregador_id IN (
      SELECT id FROM public.entregadores WHERE auth_user_id = auth.uid()
    )
  );

-- Master: acesso total a termos
CREATE POLICY "master ve todos termos"
  ON public.entregador_termos_aceite FOR ALL TO authenticated
  USING (public.is_master(auth.uid()));

-- ============================================================
-- RPCs
-- ============================================================

-- Checar se usuário autenticado é entregador de plataforma
CREATE OR REPLACE FUNCTION public.is_entregador(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entregadores
    WHERE auth_user_id = _user_id AND empresa_id IS NULL
  );
$$;

-- Dados completos do entregador logado
CREATE OR REPLACE FUNCTION public.entregador_me()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(e)::jsonb
  FROM public.entregadores e
  WHERE auth_user_id = auth.uid() AND empresa_id IS NULL
  LIMIT 1;
$$;

-- Solicitar parceria com uma empresa
CREATE OR REPLACE FUNCTION public.entregador_solicitar_parceria(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entregador_id UUID;
  v_status_cadastro TEXT;
BEGIN
  SELECT id, status_cadastro
    INTO v_entregador_id, v_status_cadastro
    FROM public.entregadores
   WHERE auth_user_id = auth.uid() AND empresa_id IS NULL;

  IF v_entregador_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Entregador não encontrado');
  END IF;

  IF v_status_cadastro != 'aprovado' THEN
    RETURN jsonb_build_object('error', 'Cadastro ainda não aprovado pela plataforma');
  END IF;

  INSERT INTO public.entregador_parcerias (entregador_id, empresa_id)
  VALUES (v_entregador_id, p_empresa_id)
  ON CONFLICT (entregador_id, empresa_id)
    DO UPDATE SET status = 'pendente', updated_at = now()
    WHERE entregador_parcerias.status IN ('recusada', 'cancelada');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Empresa responder solicitação de parceria
CREATE OR REPLACE FUNCTION public.empresa_responder_parceria(p_parceria_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id(auth.uid());
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário não vinculado a empresa');
  END IF;

  UPDATE public.entregador_parcerias
     SET status = p_status, updated_at = now()
   WHERE id = p_parceria_id AND empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Parceria não encontrada');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Master: validar/rejeitar cadastro de entregador
CREATE OR REPLACE FUNCTION public.master_validar_entregador(
  p_id      UUID,
  p_status  TEXT,
  p_motivo  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  UPDATE public.entregadores
     SET status_cadastro = p_status,
         verificado      = (p_status = 'aprovado'),
         motivo_recusa   = p_motivo,
         aprovado        = (p_status = 'aprovado')
   WHERE id = p_id AND empresa_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Entregador não encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Entregadores aprovados e com parceria aceita: pedidos disponíveis da empresa
-- (complementa freelancer_pedidos_disponiveis que filtra por empresa_id via entregador)
-- Os RPCs existentes continuam funcionando via public_token — zero mudanças neles.

-- Storage bucket para fotos de rosto
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entregadores',
  'entregadores',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'upload foto rosto entregador'
  ) THEN
    CREATE POLICY "upload foto rosto entregador"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'entregadores'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'foto rosto entregador publica'
  ) THEN
    CREATE POLICY "foto rosto entregador publica"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'entregadores');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'entregador atualiza propria foto'
  ) THEN
    CREATE POLICY "entregador atualiza propria foto"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'entregadores'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Grants
GRANT SELECT ON public.entregador_parcerias TO authenticated;
GRANT INSERT, UPDATE ON public.entregador_parcerias TO authenticated;
GRANT SELECT, INSERT ON public.entregador_termos_aceite TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_entregador(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.entregador_me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.entregador_solicitar_parceria(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.empresa_responder_parceria(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_validar_entregador(UUID, TEXT, TEXT) TO authenticated;
