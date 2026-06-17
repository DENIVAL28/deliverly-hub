create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "empresa pode gerenciar suas proprias subscriptions"
  on public.push_subscriptions
  for all
  using (empresa_id = (select empresa_id from public.profiles where id = auth.uid()))
  with check (empresa_id = (select empresa_id from public.profiles where id = auth.uid()));
