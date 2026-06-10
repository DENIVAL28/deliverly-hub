-- GPS tracking para entregadores
-- Execute no Supabase SQL Editor

ALTER TABLE entregadores
  ADD COLUMN IF NOT EXISTS lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ultima_localizacao TIMESTAMPTZ;
