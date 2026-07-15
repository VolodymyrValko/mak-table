-- Міграція №6: назва сесії (редагована користувачем).
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.
alter table public.sessions add column if not exists name text;
