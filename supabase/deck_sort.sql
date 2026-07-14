-- Міграція №7: порядок сортування власних колод.
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.
alter table public.decks add column if not exists sort integer;
