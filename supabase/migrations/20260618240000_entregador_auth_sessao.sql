-- Solução definitiva: entregador vincula sessão anônima autenticada
-- Resolve realtime para entregadores (mesmo problema que os clientes tinham)

SET search_path = public;

-- 1. Adiciona auth_user_id na tabela de entregadores
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- 2. RPC para vincular a sessão anônima ao entregador via token
--    Chamada no mount da página do entregador após signInAnonymously()
CREATE OR REPLACE FUNCTION public.entregador_vincular_sessao(p_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada.';
  END IF;

  SELECT id INTO v_id
    FROM public.entregadores
   WHERE public_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de entregador inválido.';
  END IF;

  UPDATE public.entregadores
     SET auth_user_id = auth.uid()
   WHERE id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregador_vincular_sessao(uuid) TO authenticated;

-- 3. RLS: entregador lê os próprios pedidos atribuídos (realtime funciona)
DROP POLICY IF EXISTS "entregador le seus pedidos" ON public.pedidos;
CREATE POLICY "entregador le seus pedidos" ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    entregador_id IN (
      SELECT id FROM public.entregadores WHERE auth_user_id = auth.uid()
    )
  );

-- 4. RLS: freelancer aprovado lê pedidos disponíveis da sua empresa (realtime funciona)
DROP POLICY IF EXISTS "freelancer le pedidos disponiveis" ON public.pedidos;
CREATE POLICY "freelancer le pedidos disponiveis" ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    entregador_id IS NULL
    AND (tipo IS NULL OR tipo = 'delivery')
    AND status IN ('aceito', 'preparo', 'entrega')
    AND empresa_id IN (
      SELECT empresa_id FROM public.entregadores
       WHERE auth_user_id = auth.uid()
         AND tipo = 'freelancer'
         AND aprovado = true
    )
  );
