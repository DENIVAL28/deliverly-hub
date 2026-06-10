-- Funções de validação de dados
-- Execute no Supabase SQL Editor ANTES do onboarding.sql

-- ── Validação de CNPJ (dígitos verificadores) ─────────────────
CREATE OR REPLACE FUNCTION validar_cnpj(p_cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits  TEXT;
  sum1    INT := 0;
  sum2    INT := 0;
  d1      INT;
  d2      INT;
  w1      INT[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  w2      INT[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  i       INT;
BEGIN
  digits := regexp_replace(p_cnpj, '\D', '', 'g');

  IF length(digits) != 14 THEN RETURN FALSE; END IF;
  -- Sequências inválidas (ex: 00000000000000)
  IF digits ~ '^(.)\1{13}$' THEN RETURN FALSE; END IF;

  FOR i IN 1..12 LOOP
    sum1 := sum1 + (substr(digits, i, 1)::INT * w1[i]);
  END LOOP;
  d1 := sum1 % 11;
  d1 := CASE WHEN d1 < 2 THEN 0 ELSE 11 - d1 END;
  IF substr(digits, 13, 1)::INT != d1 THEN RETURN FALSE; END IF;

  FOR i IN 1..13 LOOP
    sum2 := sum2 + (substr(digits, i, 1)::INT * w2[i]);
  END LOOP;
  d2 := sum2 % 11;
  d2 := CASE WHEN d2 < 2 THEN 0 ELSE 11 - d2 END;

  RETURN substr(digits, 14, 1)::INT = d2;
END;
$$;
