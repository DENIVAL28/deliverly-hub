-- Corrige o schema do pg_net: usa net.http_post em vez de extensions.http_post
create or replace function public.trigger_push_novo_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://ilgzvcfisrhrfmpcgtcx.supabase.co/functions/v1/push-pedido',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('record', row_to_json(NEW))::text
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;
