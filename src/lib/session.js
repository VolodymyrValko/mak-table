import { supabase } from './supabase.js';

// Кожен браузер має власний clientId — щоб не застосовувати власні ж realtime-події
export const clientId =
  sessionStorage.getItem('mak-client-id') ||
  (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('mak-client-id', id);
    return id;
  })();

function randomCode() {
  // 10 символів без схожих (0/O, 1/l) — секрет посилання
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((n) => abc[n % abc.length])
    .join('');
}

export async function createSession(deckId, pile) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ code: randomCode(), deck_id: deckId, pile })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSession(code) {
  const { data, error } = await supabase
    .from('sessions')
    .select()
    .eq('code', code)
    .single();
  if (error) throw new Error('Сесію не знайдено. Перевірте посилання.');
  return data;
}

export async function fetchTableCards(sessionId) {
  const { data, error } = await supabase
    .from('table_cards')
    .select()
    .eq('session_id', sessionId);
  if (error) throw error;
  return data;
}

export async function updatePile(sessionId, pile) {
  await supabase.from('sessions').update({ pile }).eq('id', sessionId);
}

// Перетворення: рядок БД ↔ карта на столі
export function rowToCard(row) {
  return {
    uid: row.id,
    cardId: row.card_id,
    x: row.x,
    y: row.y,
    rot: row.rot,
    scale: row.scale ?? 1,
    faceUp: row.face_up,
    z: row.z,
    note: row.note,
  };
}

export function cardToRow(tc, sessionId) {
  return {
    id: tc.uid,
    session_id: sessionId,
    card_id: tc.cardId,
    x: tc.x,
    y: tc.y,
    rot: tc.rot,
    scale: tc.scale ?? 1,
    face_up: tc.faceUp,
    z: tc.z,
    note: tc.note,
    updated_by: clientId,
  };
}

export async function upsertCard(tc, sessionId) {
  await supabase.from('table_cards').upsert(cardToRow(tc, sessionId));
}

export async function deleteCard(uid) {
  await supabase.from('table_cards').delete().eq('id', uid);
}

export async function deleteAllCards(sessionId) {
  await supabase.from('table_cards').delete().eq('session_id', sessionId);
}

// Перетворення: рядок БД ↔ анотація (малюнок або текст) на столі
export function rowToAnnotation(row) {
  return {
    uid: row.id,
    kind: row.kind,
    points: row.points,
    text: row.text,
    x: row.x,
    y: row.y,
    color: row.color,
    size: row.size,
    alpha: row.alpha ?? 1,
    outlineColor: row.outline_color ?? null,
    outlineWidth: row.outline_width ?? 3,
    outlineAlpha: row.outline_alpha ?? 1,
    z: row.z,
  };
}

export function annotationToRow(a, sessionId) {
  return {
    id: a.uid,
    session_id: sessionId,
    kind: a.kind,
    points: a.points ?? null,
    text: a.text ?? '',
    x: a.x,
    y: a.y,
    color: a.color,
    size: a.size,
    alpha: a.alpha ?? 1,
    outline_color: a.outlineColor ?? null,
    outline_width: a.outlineWidth ?? 3,
    outline_alpha: a.outlineAlpha ?? 1,
    z: a.z,
    updated_by: clientId,
  };
}

export async function fetchAnnotations(sessionId) {
  const { data, error } = await supabase
    .from('table_annotations')
    .select()
    .eq('session_id', sessionId);
  if (error) throw error;
  return data;
}

export async function upsertAnnotation(a, sessionId) {
  await supabase.from('table_annotations').upsert(annotationToRow(a, sessionId));
}

export async function deleteAnnotation(uid) {
  await supabase.from('table_annotations').delete().eq('id', uid);
}

export async function deleteAllAnnotations(sessionId) {
  await supabase.from('table_annotations').delete().eq('session_id', sessionId);
}

// Підписка на зміни столу; повертає функцію відписки
export function subscribeToSession(session, handlers) {
  // Унікальна назва каналу — інакше повторний mount (StrictMode) впаде
  // на спробі додати колбеки до вже підписаного каналу
  const channel = supabase
    .channel(`session-db:${session.id}:${crypto.randomUUID().slice(0, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'table_cards', filter: `session_id=eq.${session.id}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          handlers.onCardDelete?.(payload.old.id);
        } else if (payload.new.updated_by !== clientId) {
          handlers.onCardUpsert?.(rowToCard(payload.new));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
      (payload) => handlers.onPileChange?.(payload.new.pile)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'table_annotations', filter: `session_id=eq.${session.id}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          handlers.onAnnDelete?.(payload.old.id);
        } else if (payload.new.updated_by !== clientId) {
          handlers.onAnnUpsert?.(rowToAnnotation(payload.new));
        }
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Присутність: хто зараз за столом
export function joinPresence(code, name, onChange) {
  // Тема присутності мусить бути однакова в усіх учасників,
  // тому прибираємо канал-дублікат, якщо він лишився з попереднього mount
  const stale = supabase
    .getChannels()
    .find((c) => c.topic === `realtime:presence:${code}`);
  if (stale) supabase.removeChannel(stale);

  const channel = supabase.channel(`presence:${code}`, {
    config: { presence: { key: clientId } },
  });
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onChange(Object.values(state).map((arr) => arr[0]?.name).filter(Boolean));
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ name });
    });
  return () => supabase.removeChannel(channel);
}
