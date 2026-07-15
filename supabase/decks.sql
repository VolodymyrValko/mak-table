-- Міграція №2: власні колоди користувачів.
-- Виконати в Supabase: SQL Editor → New query → вставити → Run.

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  back_url text,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  image_url text not null,
  name text not null default '',
  sort int not null default 0
);

create index cards_deck_idx on public.cards (deck_id);

-- RLS: відкрито, як і решта MVP (секрет — посилання)
alter table public.decks enable row level security;
alter table public.cards enable row level security;

create policy "decks open" on public.decks
  for all using (true) with check (true);

create policy "cards open" on public.cards
  for all using (true) with check (true);

-- Сховище зображень карток (публічне читання)
insert into storage.buckets (id, name, public)
values ('deck-images', 'deck-images', true);

create policy "deck images read" on storage.objects
  for select using (bucket_id = 'deck-images');

create policy "deck images write" on storage.objects
  for insert with check (bucket_id = 'deck-images');

create policy "deck images delete" on storage.objects
  for delete using (bucket_id = 'deck-images');
