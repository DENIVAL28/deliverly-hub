CREATE TABLE public.expo_push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario gerencia proprio token"
  ON public.expo_push_tokens
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
