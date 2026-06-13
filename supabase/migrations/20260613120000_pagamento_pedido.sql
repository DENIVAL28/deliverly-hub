-- Pagamento online em pedidos do cardápio
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pagamento_online_status TEXT
    CHECK (pagamento_online_status IN ('pendente', 'aprovado', 'recusado')),
  ADD COLUMN IF NOT EXISTS pagamento_online_id TEXT;

CREATE INDEX IF NOT EXISTS pedidos_pagamento_online_id
  ON public.pedidos(pagamento_online_id)
  WHERE pagamento_online_id IS NOT NULL;
