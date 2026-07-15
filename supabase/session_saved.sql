-- Міграція №8: збережені сесії (не видаляються автоматично).
-- Активні сесії (saved = false) видаляються через 7 днів після створення.
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.
alter table public.sessions add column if not exists saved boolean not null default false;
