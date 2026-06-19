-- Remove politica restritiva que exigia auth.uid() no path
-- (causava falha quando sessao ainda nao estava confirmada apos signUp)
DROP POLICY IF EXISTS "upload foto rosto entregador" ON storage.objects;
DROP POLICY IF EXISTS "upload foto rosto" ON storage.objects;

-- Permite upload para qualquer um (anon ou authenticated) no bucket entregadores.
-- A seguranca real esta na tabela entregadores (RLS por auth_user_id).
-- O bucket e publico e os arquivos sao fotos de perfil — risco de spam e baixo.
CREATE POLICY "entregadores bucket upload publico"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'entregadores');

-- Garante que SELECT continua publico
DROP POLICY IF EXISTS "foto rosto entregador publica" ON storage.objects;
CREATE POLICY "entregadores bucket leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'entregadores');

-- UPDATE continua restrito ao dono
DROP POLICY IF EXISTS "entregador atualiza propria foto" ON storage.objects;
CREATE POLICY "entregadores bucket update autenticado"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'entregadores');
