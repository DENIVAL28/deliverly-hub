alter table empresas
  add column if not exists retirada_ativa boolean not null default false;
