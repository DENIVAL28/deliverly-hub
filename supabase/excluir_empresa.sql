-- Exclusão completa de empresa (cascata)
-- Execute no Supabase SQL Editor

CREATE OR REPLACE FUNCTION excluir_empresa_completo(p_empresa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  DELETE FROM pedido_itens
  WHERE pedido_id IN (SELECT id FROM pedidos WHERE empresa_id = p_empresa_id);

  DELETE FROM pedidos       WHERE empresa_id = p_empresa_id;
  DELETE FROM produtos      WHERE empresa_id = p_empresa_id;
  DELETE FROM categorias    WHERE empresa_id = p_empresa_id;
  DELETE FROM clientes      WHERE empresa_id = p_empresa_id;
  DELETE FROM entregadores  WHERE empresa_id = p_empresa_id;
  DELETE FROM cupons        WHERE empresa_id = p_empresa_id;
  DELETE FROM user_roles    WHERE empresa_id = p_empresa_id;

  UPDATE profiles SET empresa_id = NULL WHERE empresa_id = p_empresa_id;

  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_empresa_completo TO authenticated;
