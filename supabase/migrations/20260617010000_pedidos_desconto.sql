alter table public.pedidos
  add column if not exists desconto numeric(10,2) not null default 0;
