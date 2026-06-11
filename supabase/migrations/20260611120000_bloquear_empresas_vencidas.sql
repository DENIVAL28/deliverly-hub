-- Função que bloqueia todas as empresas com vencimento expirado
create or replace function bloquear_empresas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  update empresas
  set status = 'bloqueada'
  where status = 'ativa'
    and vencimento is not null
    and vencimento < now();

  get diagnostics total = row_count;
  return total;
end;
$$;

-- Permite chamar via RPC autenticado (master) ou service_role
revoke all on function bloquear_empresas_vencidas() from public;
grant execute on function bloquear_empresas_vencidas() to service_role;

-- Agenda execução diária às 03:00 UTC via pg_cron (disponível no Supabase Pro)
-- Se não tiver pg_cron, a função pode ser chamada manualmente via painel SQL
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    -- Remove agendamento anterior se existir
    perform cron.unschedule('bloquear-empresas-vencidas');
  end if;
exception when others then
  null; -- pg_cron não disponível, ignora silenciosamente
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule(
      'bloquear-empresas-vencidas',
      '0 3 * * *',
      'select bloquear_empresas_vencidas()'
    );
  end if;
exception when others then
  null;
end;
$$;
