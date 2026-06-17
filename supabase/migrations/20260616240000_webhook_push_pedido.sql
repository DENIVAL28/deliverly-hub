-- Habilita extensao pg_net para chamadas HTTP dentro do banco
create extension if not exists pg_net with schema extensions;

-- Funcao que dispara o push quando chega pedido novo
create or replace function public.trigger_push_novo_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform extensions.http_post(
    url    := 'https://ilgzvcfisrhrfmpcgtcx.supabase.co/functions/v1/push-pedido',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body   := jsonb_build_object('record', row_to_json(NEW))::text
  );
  return NEW;
exception when others then
  -- nao bloqueia o insert se o push falhar
  return NEW;
end;
$$;

-- Trigger na tabela pedidos — roda apos cada INSERT
drop trigger if exists on_new_order_push on public.pedidos;
create trigger on_new_order_push
  after insert on public.pedidos
  for each row
  execute procedure public.trigger_push_novo_pedido();
