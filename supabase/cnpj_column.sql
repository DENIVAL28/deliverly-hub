-- Adiciona coluna CNPJ na tabela empresas
-- Execute no Supabase SQL Editor

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- CNPJ único quando informado (impede mesma empresa cadastrar duas vezes)
CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_unique
  ON empresas (cnpj)
  WHERE cnpj IS NOT NULL;
