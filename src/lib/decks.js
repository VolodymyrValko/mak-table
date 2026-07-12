// Завантаження колод. Поки що колоди — статичні файли в /public/decks.
// Пізніше цей модуль зможе тягнути колоди з Supabase без зміни решти коду.

const DECK_IDS = ['nature'];

export async function loadDeck(deckId) {
  const res = await fetch(`/decks/${deckId}/deck.json`);
  if (!res.ok) throw new Error(`Не вдалося завантажити колоду «${deckId}»`);
  return res.json();
}

export async function loadAllDecks() {
  return Promise.all(DECK_IDS.map(loadDeck));
}
