-- Sincroniza limites do banco com a landing page:
-- Básico: 3 entregadores, 400 pedidos/mês
-- Profissional: 20 entregadores, 600 pedidos/mês

-- ── Entregadores ─────────────────────────────────────────────
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
    WHEN 'basico'       THEN 3
    WHEN 'profissional' THEN 20
    ELSE NULL
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_PLANO: Limite de % entregadores atingido no plano %. Faça upgrade para adicionar mais.', v_limite, v_plano;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Pedidos (novo — limite mensal) ───────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_limite_pedidos()
RETURNS TRIGGER AS $$
DECLARE
  v_plano text;
  v_count integer;
  v_limite integer;
BEGIN
  SELECT plano INTO v_plano FROM public.empresas WHERE id = NEW.empresa_id;

  SELECT COUNT(*) INTO v_count
  FROM public.pedidos
  WHERE empresa_id = NEW.empresa_id
    AND created_at >= date_trunc('month', now());

  v_limite := CASE COALESCE(v_plano, 'profissional')
    WHEN 'basico'       THEN 400
    WHEN 'profissional' THEN 600
    ELSE NULL
  END;

  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_PLANO: Limite de % pedidos por mês atingido no plano %. Faça upgrade para continuar recebendo pedidos.', v_limite, v_plano;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_limite_pedidos ON public.pedidos;
CREATE TRIGGER trg_limite_pedidos
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_limite_pedidos();
