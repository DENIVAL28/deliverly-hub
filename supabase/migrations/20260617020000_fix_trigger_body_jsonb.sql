-- Corrige o trigger: body deve ser jsonb, nao text
-- Tambem remove o exception silencioso para conseguir ver erros nos logs
create or replace function public.trigger_push_novo_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_id bigint;
begin
  select net.http_post(
    url     := 'https://ilgzvcfisrhrfmpcgtcx.supabase.co/functions/v1/push-pedido',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('record', row_to_json(NEW))
  ) into v_req_id;
  return NEW;
exception when others then
  raise warning 'push trigger error: %', sqlerrm;
  return NEW;
end;
$$;
