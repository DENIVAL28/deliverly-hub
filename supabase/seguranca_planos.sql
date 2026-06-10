-- ============================================================
-- SEGURANÇA: Validação de limites de plano no backend
-- Rodar no SQL Editor do Supabase (uma vez)
-- ============================================================

-- ── 1. PRODUTOS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_limite_produtos()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM empresas WHERE id = NEW.empresa_id;
  SELECT COUNT(*) INTO v_count FROM produtos WHERE empresa_id = NEW.empresa_id AND ativo = true;

  v_limite := CASE COALESCE(v_plano, 'profissional')
    WHEN 'basico'       THEN 50
    WHEN 'profissional' THEN 150
    ELSE NULL  -- premium = ilimitado
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_PLANO: Limite de % produtos atingido no plano %. Faça upgrade para adicionar mais.', v_limite, v_plano;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_limite_produtos ON produtos;
CREATE TRIGGER trg_limite_produtos
  BEFORE INSERT ON produtos
  FOR EACH ROW EXECUTE FUNCTION enforce_limite_produtos();


-- ── 2. CUPONS ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_limite_cupons()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM empresas WHERE id = NEW.empresa_id;
  SELECT COUNT(*) INTO v_count FROM cupons WHERE empresa_id = NEW.empresa_id AND ativo = true;

  v_limite := CASE COALESCE(v_plano, 'profissional')
    WHEN 'basico' THEN 3
    ELSE NULL
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_PLANO: Limite de % cupons ativos atingido no plano %. Desative cupons existentes ou faça upgrade.', v_limite, v_plano;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_limite_cupons ON cupons;
CREATE TRIGGER trg_limite_cupons
  BEFORE INSERT ON cupons
  FOR EACH ROW EXECUTE FUNCTION enforce_limite_cupons();


-- ── 3. ENTREGADORES ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_limite_entregadores()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM empresas WHERE id = NEW.empresa_id;
  SELECT COUNT(*) INTO v_count FROM entregadores WHERE empresa_id = NEW.empresa_id;

  v_limite := CASE COALESCE(v_plano, 'profissional')
    WHEN 'basico'       THEN 0
    WHEN 'profissional' THEN 10
    ELSE NULL
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    IF v_limite = 0 THEN
      RAISE EXCEPTION 'LIMITE_PLANO: O plano % não inclui entregadores. Faça upgrade para o plano Profissional.', v_plano;
    ELSE
      RAISE EXCEPTION 'LIMITE_PLANO: Limite de % entregadores atingido no plano %. Faça upgrade para o plano Premium.', v_limite, v_plano;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_limite_entregadores ON entregadores;
CREATE TRIGGER trg_limite_entregadores
  BEFORE INSERT ON entregadores
  FOR EACH ROW EXECUTE FUNCTION enforce_limite_entregadores();


-- ── 4. PROTEGER CAMPO PLANO (só master pode alterar) ─────────
CREATE OR REPLACE FUNCTION protect_plano_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plano IS DISTINCT FROM NEW.plano THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'master'
    ) THEN
      RAISE EXCEPTION 'ACESSO_NEGADO: Apenas administradores da plataforma podem alterar o plano.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_plano ON empresas;
CREATE TRIGGER trg_protect_plano
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION protect_plano_change();


-- ── 5. RLS — garantir isolamento entre empresas ───────────────

-- Empresas: cada dono vê e edita apenas a própria
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_owner_select" ON empresas;
CREATE POLICY "empresa_owner_select" ON empresas
  FOR SELECT USING (
    id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
  );

DROP POLICY IF EXISTS "empresa_owner_update" ON empresas;
CREATE POLICY "empresa_owner_update" ON empresas
  FOR UPDATE USING (
    id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Produtos: apenas empresa dona
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produtos_empresa" ON produtos;
CREATE POLICY "produtos_empresa" ON produtos
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Cupons: apenas empresa dona
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cupons_empresa" ON cupons;
CREATE POLICY "cupons_empresa" ON cupons
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Entregadores: apenas empresa dona
ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entregadores_empresa" ON entregadores;
CREATE POLICY "entregadores_empresa" ON entregadores
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Pedidos: empresa dona + acesso público para inserção (checkout do cardápio)
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_empresa_read" ON pedidos;
CREATE POLICY "pedidos_empresa_read" ON pedidos
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
    OR auth.uid() IS NULL  -- acesso anônimo para leitura do próprio pedido via /pedido/$id
  );

DROP POLICY IF EXISTS "pedidos_insert_publico" ON pedidos;
CREATE POLICY "pedidos_insert_publico" ON pedidos
  FOR INSERT WITH CHECK (true);  -- qualquer um pode criar pedido (checkout público)

DROP POLICY IF EXISTS "pedidos_empresa_update" ON pedidos;
CREATE POLICY "pedidos_empresa_update" ON pedidos
  FOR UPDATE USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master'
    )
  );
