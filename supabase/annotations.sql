-- Міграція №4: малювання та текстові наліпки на столі.
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.

create table public.table_annotations (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  kind text not null,               -- 'draw' | 'text'
  points jsonb,                     -- [{x,y}] нормалізовані 0..1, для kind='draw'
  text text not null default '',    -- для kind='text'
  x double precision not null default 0,
  y double precision not null default 0,
  color text not null default '#e74c3c',
  size double precision not null default 4,
  z integer not null default 1,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create index table_annotations_session_idx on public.table_annotations (session_id);

alter table public.table_annotations enable row level security;

create policy "table_annotations open" on public.table_annotations
  for all using (true) with check (true);

alter publication supabase_realtime add table public.table_annotations;
