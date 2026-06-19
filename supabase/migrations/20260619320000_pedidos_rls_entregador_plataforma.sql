-- Entregadores de plataforma precisam de SELECT direto em pedidos para:
-- 1) Receber eventos Realtime (postgres_changes respeita RLS)
-- 2) A policy "freelancer le pedidos disponiveis" não os cobre porque
--    eles têm empresa_id IS NULL e tipo != 'freelancer'
--
-- Usa is_entregador() SECURITY DEFINER para evitar recursão.

SET search_path = public;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedidos'
      AND policyname = 'entregador plataforma ve pedidos disponiveis'
  ) THEN
    CREATE POLICY "entregador plataforma ve pedidos disponiveis"
      ON public.pedidos FOR SELECT TO authenticated
      USING (
        entregador_id IS NULL
        AND (tipo IS NULL OR tipo = 'delivery')
        AND status IN ('aceito', 'preparo', 'entrega')
        AND public.is_entregador(auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.empresas e
           WHERE e.id = empresa_id
             AND e.tipo_operacao_entrega = 'plataforma'
             AND e.status = 'ativa'
        )
      );
  END IF;
END $$;
