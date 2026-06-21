-- Tokens de push do app entregador (suporta multi-device e rotação de token)
-- Separado de expo_push_tokens (que tem empresa_id NOT NULL — inadequado para plataforma)

CREATE TABLE IF NOT EXISTS public.entregador_push_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entregador_id  UUID        NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  auth_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token          TEXT        UNIQUE NOT NULL,
  platform       TEXT        NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  device_name    TEXT,
  ativo          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para a query na Edge Function (busca por entregador_id + ativo)
CREATE INDEX IF NOT EXISTS idx_entregador_push_tokens_entregador_ativo
  ON public.entregador_push_tokens(entregador_id, ativo);

CREATE INDEX IF NOT EXISTS idx_entregador_push_tokens_auth_user
  ON public.entregador_push_tokens(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_entregador_push_tokens_ativo
  ON public.entregador_push_tokens(ativo);

ALTER TABLE public.entregador_push_tokens ENABLE ROW LEVEL SECURITY;

-- Entregador só vê e gerencia seus próprios tokens
CREATE POLICY "entregador gerencia proprio token"
  ON public.entregador_push_tokens
  FOR ALL TO authenticated
  USING  (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: salvar/atualizar token (upsert por token)
-- ON CONFLICT transfere o token para o entregador atual (cobre reinstalação
-- ou troca de conta no mesmo dispositivo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entregador_salvar_push_token(
  p_token    TEXT,
  p_platform TEXT DEFAULT 'android',
  p_device   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entregador_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT id INTO v_entregador_id
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entregador não encontrado';
  END IF;

  INSERT INTO public.entregador_push_tokens
    (entregador_id, auth_user_id, token, platform, device_name, ativo, updated_at)
  VALUES
    (v_entregador_id, auth.uid(), p_token, p_platform, p_device, TRUE, NOW())
  ON CONFLICT (token) DO UPDATE
    SET entregador_id = EXCLUDED.entregador_id,
        auth_user_id  = EXCLUDED.auth_user_id,
        ativo         = TRUE,
        platform      = EXCLUDED.platform,
        device_name   = EXCLUDED.device_name,
        updated_at    = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_salvar_push_token(TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: desativar token (logout ou invalidação manual)
-- Não deleta — mantém histórico para auditoria
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entregador_remover_push_token(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entregador_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  SELECT id INTO v_entregador_id
    FROM public.entregadores
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.entregador_push_tokens
     SET ativo = FALSE, updated_at = NOW()
   WHERE token = p_token
     AND entregador_id = v_entregador_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_remover_push_token(TEXT) TO authenticated;
