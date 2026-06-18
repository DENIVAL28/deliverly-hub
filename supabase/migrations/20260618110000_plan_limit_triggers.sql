-- C2: Triggers de limite de plano no banco de dados
-- Garante que os limites de plano sejam aplicados server-side,
-- independente de qualquer validação client-side.

-- ── 1. PRODUTOS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_limite_produtos()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM public.empresas WHERE id = NEW.empresa_id;
  SELECT COUNT(*) INTO v_count FROM public.produtos WHERE empresa_id = NEW.empresa_id AND ativo = true;

  v_limite := CASE COALESCE(v_plano, 'profissional')
    WHEN 'basico'       THEN 50
    WHEN 'profissional' THEN 150
    ELSE NULL
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_PLANO: Limite de % produtos atingido no plano %. Faça upgrade para adicionar mais.', v_limite, v_plano;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_limite_produtos ON public.produtos;
CREATE TRIGGER trg_limite_produtos
  BEFORE INSERT ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_limite_produtos();


-- ── 2. CUPONS ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_limite_cupons()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM public.empresas WHERE id = NEW.empresa_id;
  SELECT COUNT(*) INTO v_count FROM public.cupons WHERE empresa_id = NEW.empresa_id AND ativo = true;

  v_limite := CASE COALESCE(v_plano, 'profissional')
    WHEN 'basico' THEN 3
    ELSE NULL
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_PLANO: Limite de % cupons ativos atingido no plano %. Desative cupons existentes ou faça upgrade.', v_limite, v_plano;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_limite_cupons ON public.cupons;
CREATE TRIGGER trg_limite_cupons
  BEFORE INSERT ON public.cupons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_limite_cupons();


-- ── 3. ENTREGADORES ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_limite_entregadores()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM public.empresas WHERE id = NEW.empresa_id;
  SELECT COUNT(*) INTO v_count FROM public.entregadores WHERE empresa_id = NEW.empresa_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_limite_entregadores ON public.entregadores;
CREATE TRIGGER trg_limite_entregadores
  BEFORE INSERT ON public.entregadores
  FOR EACH ROW EXECUTE FUNCTION public.enforce_limite_entregadores();


-- ── 4. PROTEGER CAMPO PLANO (só master pode alterar) ─────────
CREATE OR REPLACE FUNCTION public.protect_plano_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plano IS DISTINCT FROM NEW.plano THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'master'
    ) THEN
      RAISE EXCEPTION 'ACESSO_NEGADO: Apenas administradores da plataforma podem alterar o plano.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_plano ON public.empresas;
CREATE TRIGGER trg_protect_plano
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.protect_plano_change();
