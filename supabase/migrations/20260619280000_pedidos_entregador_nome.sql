-- Adiciona coluna entregador_nome em pedidos.
-- O campo era referenciado pelo app e pelo painel web (advance/atribuirEntregador)
-- mas nunca foi criado via migration, causando erro 400 silencioso na query
-- do HomeScreen do app restaurante → lista de pedidos vazia.
--
-- Também garante entregador_id e mesa com IF NOT EXISTS caso
-- estejam faltando em algum ambiente.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS mesa            TEXT,
  ADD COLUMN IF NOT EXISTS entregador_id   UUID,
  ADD COLUMN IF NOT EXISTS entregador_nome TEXT;
