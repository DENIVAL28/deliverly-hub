-- Novos status para o fluxo manual
alter type pedido_status add value if not exists 'aguardando_confirmacao';
alter type pedido_status add value if not exists 'aguardando_pagamento';

-- Configuracao de fluxo por estabelecimento
alter table public.empresas
  add column if not exists fluxo_pedido text not null default 'automatico';
