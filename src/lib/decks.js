// Колоди: вбудовані (статичні файли в /public/decks) + власні (Supabase).
import { supabase } from './supabase.js';

const BUILTIN_IDS = ['nature'];
export const DEFAULT_BACK = '/decks/nature/back.svg';

// Рубашки не закріплені за колодою постійно — видаються "у лобі" по колу
// залежно від позиції колоди у списку на момент відкриття столу.
export const BACKS = [
  '/decks/nature/back.svg',
  '/decks/backs/back-2.svg',
  '/decks/backs/back-3.svg',
  '/decks/backs/back-4.svg',
];

export function backForIndex(i) {
  return BACKS[i % BACKS.length];
}

// Присвоює рубашки за поточним порядком колод (без збереження в БД)
export function assignBacks(decks) {
  return decks.map((d, i) => ({ ...d, back: backForIndex(i) }));
}

async function loadBuiltinDeck(deckId) {
  const res = await fetch(`/decks/${deckId}/deck.json`);
  if (!res.ok) throw new Error(`Не вдалося завантажити колоду «${deckId}»`);
  return res.json();
}

export async function loadDeck(deckId) {
  if (BUILTIN_IDS.includes(deckId)) return loadBuiltinDeck(deckId);
  if (!supabase) throw new Error('Власні колоди недоступні без Supabase');

  const { data: deck, error } = await supabase
    .from('decks').select().eq('id', deckId).single();
  if (error) throw new Error('Колоду не знайдено');

  const { data: cards, error: cardsErr } = await supabase
    .from('cards').select().eq('deck_id', deckId).order('sort');
  if (cardsErr) throw cardsErr;

  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    back: deck.back_url || DEFAULT_BACK,
    custom: true,
    cards: cards.map((c) => ({ id: c.id, image: c.image_url, name: c.name })),
  };
}

// Список усіх колод (без карт) — для вибору на головній і сторінки керування
export async function loadAllDecks() {
  const builtin = await Promise.all(BUILTIN_IDS.map(loadBuiltinDeck));
  if (!supabase) return builtin;
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('id, name, description, sort, created_at')
      .order('sort', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    const custom = (data || []).map((d) => ({ ...d, custom: true }));
    return [...builtin, ...custom];
  } catch (e) {
    // Таблиць ще нема (міграцію не виконано) — працюємо з вбудованими
    console.warn('Власні колоди недоступні:', e.message);
    return builtin;
  }
}

// Усі колоди разом із картами — для столу з кількома колодами
export async function loadFullDecks() {
  const list = await loadAllDecks();
  return Promise.all(list.map((d) => (d.cards ? d : loadDeck(d.id))));
}

export async function countCards(deckId) {
  const { count } = await supabase
    .from('cards').select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId);
  return count ?? 0;
}

// Стиснення зображення в браузері перед завантаженням
async function compressImage(file, maxSide = 1200, quality = 0.85) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  img.close?.();
  if (!blob) throw new Error(`Не вдалося обробити файл «${file.name}»`);
  return blob;
}

export async function createDeck({ name, description, files, cardNames }, onProgress) {
  const { data: deck, error } = await supabase
    .from('decks').insert({ name, description }).select().single();
  if (error) throw error;

  try {
    const rows = [];
    for (let i = 0; i < files.length; i++) {
      const blob = await compressImage(files[i]);
      const path = `${deck.id}/${String(i).padStart(3, '0')}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('deck-images')
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('deck-images').getPublicUrl(path);
      rows.push({
        deck_id: deck.id,
        image_url: pub.publicUrl,
        name: cardNames?.[i]?.trim() || '',
        sort: i,
      });
      onProgress?.(i + 1, files.length);
    }
    const { error: cardsErr } = await supabase.from('cards').insert(rows);
    if (cardsErr) throw cardsErr;
    return deck;
  } catch (e) {
    // не лишаємо порожню колоду, якщо завантаження зірвалося
    await deleteDeck(deck.id).catch(() => {});
    throw e;
  }
}

export async function renameDeck(deckId, name) {
  const { error } = await supabase.from('decks').update({ name }).eq('id', deckId);
  if (error) throw error;
}

export async function updateDeckDescription(deckId, description) {
  const { error } = await supabase
    .from('decks').update({ description }).eq('id', deckId);
  if (error) throw error;
}

// Переставляє колоду на позицію вище/нижче серед власних колод користувача.
// Нормалізує sort усіх власних колод за поточним порядком показу.
export async function reorderDeck(customDecks, deckId, direction) {
  const idx = customDecks.findIndex((d) => d.id === deckId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= customDecks.length) return;

  const sorts = customDecks.map((_, i) => i);
  [sorts[idx], sorts[swapIdx]] = [sorts[swapIdx], sorts[idx]];

  await Promise.all(
    customDecks.map((d, i) => supabase.from('decks').update({ sort: sorts[i] }).eq('id', d.id))
  );
}

export async function deleteDeck(deckId) {
  const { data: files } = await supabase.storage.from('deck-images').list(deckId);
  if (files?.length) {
    await supabase.storage
      .from('deck-images')
      .remove(files.map((f) => `${deckId}/${f.name}`));
  }
  const { error } = await supabase.from('decks').delete().eq('id', deckId);
  if (error) throw error;
}
