-- Torna aberto nullable: null=auto (segue horário), true=forçar aberto, false=forçar fechado
alter table public.empresas alter column aberto drop not null;
alter table public.empresas alter column aberto set default null;
-- Lojas sem horário configurado ficam em auto (null) = comporta como aberto
update public.empresas set aberto = null where aberto = true;
