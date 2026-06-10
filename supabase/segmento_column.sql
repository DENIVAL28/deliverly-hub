-- Coluna de segmento nas empresas (pizzaria, hamburgueria etc.)
-- Execute no Supabase SQL Editor

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS segmento TEXT;
