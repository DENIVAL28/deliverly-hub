-- Identificação de mesa nos pedidos
-- Execute no Supabase SQL Editor

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mesa TEXT;
