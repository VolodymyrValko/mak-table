-- Виправлення: DELETE-події не доходили до інших учасників сесії,
-- бо Postgres за замовчуванням не включає session_id у payload.old
-- для видалених рядків, а наш realtime-фільтр саме по session_id.
-- REPLICA IDENTITY FULL змушує Postgres класти весь рядок у payload.old.
alter table public.table_cards replica identity full;
alter table public.table_annotations replica identity full;
