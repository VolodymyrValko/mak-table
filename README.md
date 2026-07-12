# МАК-стіл

Онлайн-платформа для роботи з метафоричними асоціативними картками: віртуальний стіл, колода, витягування карт наосліп чи свідомо, нотатки та **спільні сесії психолог ↔ клієнт у реальному часі**.

## Стек

- **Фронтенд:** React 18 + Vite, React Router
- **Бекенд:** Supabase (Postgres + Realtime + Presence)
- **Колода:** фото з Unsplash (через picsum.photos, вільна ліцензія), сорочка — власна SVG-графіка

## Локальний запуск

```bash
npm install
npm run dev
```

Створіть `.env.local`:

```
VITE_SUPABASE_URL=https://<ваш-проєкт>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

Без цих змінних сайт працює в соло-режимі (без спільних сесій).

## База даних

Виконайте [supabase/schema.sql](supabase/schema.sql) у Supabase → SQL Editor.

## Деплой (Cloudflare Pages / Netlify)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA-фолбек уже налаштований через `public/_redirects`

## Структура

- `src/pages/Home.jsx` — головна
- `src/pages/Table.jsx` — стіл (соло + спільний режим)
- `src/pages/Join.jsx` — вхід клієнта за посиланням
- `src/lib/session.js` — сесії, realtime-синхронізація, присутність
- `public/decks/nature/` — колода «Стихії та шляхи» (24 карти)
