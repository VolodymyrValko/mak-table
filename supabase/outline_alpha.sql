-- Міграція №5: колір/прозорість контуру та прозорість заливки для малюнків і тексту.
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.
alter table public.table_annotations
  add column if not exists alpha double precision not null default 1,
  add column if not exists outline_color text,
  add column if not exists outline_width double precision not null default 3,
  add column if not exists outline_alpha double precision not null default 1;
