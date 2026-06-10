-- Onboarding self-service
-- Execute no Supabase SQL Editor

-- Remove todas as sobrecargas anteriores da função
DROP FUNCTION IF EXISTS criar_empresa_onboarding(text, text, text);
DROP FUNCTION IF EXISTS criar_empresa_onboarding(text, text, text, text);
DROP FUNCTION IF EXISTS criar_empresa_onboarding(text, text, text, text, text);
DROP FUNCTION IF EXISTS criar_empresa_onboarding(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS criar_empresa_onboarding(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION criar_empresa_onboarding(
  p_nome_fantasia TEXT,
  p_slug          TEXT,
  p_cor_primaria  TEXT,
  p_cidade        TEXT DEFAULT NULL,
  p_whatsapp      TEXT DEFAULT NULL,
  p_cnpj          TEXT DEFAULT NULL,
  p_segmento      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_user_id    UUID;
  v_plano_id   UUID;
BEGIN
  -- Verificar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Bloquear duplicata
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND empresa_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Você já possui uma empresa vinculada.';
  END IF;

  -- Verificar slug disponível
  IF EXISTS (SELECT 1 FROM empresas WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'SLUG_OCUPADO: Este endereço já está em uso. Tente outro.';
  END IF;

  -- CNPJ: validar dígitos verificadores (se informado)
  IF p_cnpj IS NOT NULL AND NOT validar_cnpj(p_cnpj) THEN
    RAISE EXCEPTION 'CNPJ_INVALIDO: O CNPJ informado não é válido. Verifique os números.';
  END IF;

  -- CNPJ único (se informado)
  IF p_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM empresas WHERE cnpj = p_cnpj) THEN
    RAISE EXCEPTION 'CNPJ_OCUPADO: Este CNPJ já possui uma conta cadastrada.';
  END IF;

  -- Rate limit: máximo 15 novos trials por hora (proteção contra cadastros em massa)
  IF (
    SELECT COUNT(*) FROM empresas
    WHERE vencimento IS NOT NULL
      AND created_at > NOW() - INTERVAL '60 minutes'
  ) >= 15 THEN
    RAISE EXCEPTION 'RATE_LIMIT: Muitos cadastros em curto período. Tente novamente em alguns minutos.';
  END IF;

  -- Plano básico (o de menor valor)
  SELECT id INTO v_plano_id
  FROM planos
  ORDER BY valor ASC
  LIMIT 1;

  -- Criar empresa com 7 dias de teste grátis
  INSERT INTO empresas (nome_fantasia, slug, cor_primaria, cidade, whatsapp, cnpj, segmento, status, plano_id, vencimento)
  VALUES (p_nome_fantasia, p_slug, p_cor_primaria, p_cidade, p_whatsapp, p_cnpj, p_segmento, 'ativa', v_plano_id, NOW() + INTERVAL '7 days')
  RETURNING id INTO v_empresa_id;

  -- Vincular usuário
  UPDATE profiles SET empresa_id = v_empresa_id WHERE id = v_user_id;

  -- Atribuir role
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'empresa_owner')
  ON CONFLICT DO NOTHING;

  RETURN v_empresa_id;
END;
$$;

-- Permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION criar_empresa_onboarding TO authenticated;
