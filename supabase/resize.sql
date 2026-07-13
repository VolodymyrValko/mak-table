-- Міграція №3: масштаб карти на столі.
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.
alter table public.table_cards
  add column if not exists scale double precision not null default 1;
