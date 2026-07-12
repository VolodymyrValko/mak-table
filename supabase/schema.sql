-- Схема БД для МАК-столу. Виконати в Supabase: SQL Editor → New query → вставити → Run.

-- Сесії (спільні столи)
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  deck_id text not null,
  pile jsonb not null default '[]',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- Карти, викладені на стіл
create table public.table_cards (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  card_id text not null,
  x double precision not null default 0.4,   -- нормалізовані координати 0..1
  y double precision not null default 0.35,
  rot double precision not null default 0,
  face_up boolean not null default false,
  z integer not null default 1,
  note text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create index table_cards_session_idx on public.table_cards (session_id);

-- RLS: для MVP доступ відкритий (секретом є код сесії).
-- Коли з'являться акаунти психологів — політики стануть суворішими.
alter table public.sessions enable row level security;
alter table public.table_cards enable row level security;

create policy "sessions open" on public.sessions
  for all using (true) with check (true);

create policy "table_cards open" on public.table_cards
  for all using (true) with check (true);

-- Увімкнути realtime-трансляцію змін
alter publication supabase_realtime add table public.table_cards;
alter publication supabase_realtime add table public.sessions;
