import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { loadFullDecks } from '../lib/decks.js';
import { supabase } from '../lib/supabase.js';
import {
  fetchSession, fetchTableCards, updatePile, upsertCard, deleteCard,
  deleteAllCards, subscribeToSession, joinPresence, rowToCard,
} from '../lib/session.js';

const STORAGE_KEY = 'mak-table-all-v3';
const CARD_W = 130;
const CARD_H = 195;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Table() {
  const { sessionId: code } = useParams();
  const location = useLocation();
  const shared = Boolean(code && supabase);
  const myName = location.state?.name || (shared ? 'Учасник' : '');

  const [decks, setDecks] = useState(null);   // усі колоди з картами
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [piles, setPiles] = useState({});     // { deckId: [cardId, ...] }
  const [table, setTable] = useState([]);
  const [maxZ, setMaxZ] = useState(1);
  const [selected, setSelected] = useState(null);
  const [zoomed, setZoomed] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [copied, setCopied] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const lastSentRef = useRef(0);
  const noteTimerRef = useRef({});
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });

  // Глобальний індекс: id карти → { card, deck }
  const cardIndex = useMemo(() => {
    const m = {};
    decks?.forEach((d) =>
      d.cards.forEach((c) => {
        m[c.id] = { card: c, deck: d };
      })
    );
    return m;
  }, [decks]);

  useEffect(() => {
    function measure() {
      const el = canvasRef.current;
      if (el) setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loaded]);

  // ==== Ініціалізація ====
  useEffect(() => {
    let unsubDb = null;
    let unsubPresence = null;

    (async () => {
      try {
        const all = await loadFullDecks();
        if (!all.length) throw new Error('Немає жодної колоди');
        setDecks(all);
        const validDeck = (id) => all.some((d) => d.id === id);
        const idx = {};
        all.forEach((d) => d.cards.forEach((c) => (idx[c.id] = d.id)));

        if (shared) {
          const s = await fetchSession(code);
          setSession(s);

          const rows = await fetchTableCards(s.id);
          const cards = rows.map(rowToCard).filter((tc) => idx[tc.cardId]);
          const onTable = new Set(cards.map((c) => c.cardId));

          // pile: старі сесії — масив, нові — обʼєкт по колодах
          const p = Array.isArray(s.pile)
            ? { [s.deck_id]: s.pile }
            : { ...(s.pile || {}) };
          // колоди, яких у сесії ще нема — ініціалізуємо локально
          all.forEach((d) => {
            if (!p[d.id]) {
              p[d.id] = shuffle(
                d.cards.map((c) => c.id).filter((id) => !onTable.has(id))
              );
            } else {
              p[d.id] = p[d.id].filter((id) => idx[id] && !onTable.has(id));
            }
          });

          setPiles(p);
          setTable(cards);
          setMaxZ(cards.reduce((m, c) => Math.max(m, c.z), 1));
          setActiveDeckId(validDeck(s.deck_id) ? s.deck_id : all[0].id);

          unsubDb = subscribeToSession(s, {
            onCardUpsert: (tc) =>
              setTable((t) => {
                const i = t.findIndex((c) => c.uid === tc.uid);
                if (i === -1) return [...t, tc];
                const copy = [...t];
                copy[i] = tc;
                return copy;
              }),
            onCardDelete: (uid) => setTable((t) => t.filter((c) => c.uid !== uid)),
            onPileChange: (p2) =>
              setPiles(Array.isArray(p2) ? { [s.deck_id]: p2 } : p2 || {}),
          });
          unsubPresence = joinPresence(code, myName, setPeople);
        } else {
          const qDeck = new URLSearchParams(location.search).get('deck');
          let p = {};
          let t = [];
          let z = 1;
          let act = null;

          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const s = JSON.parse(saved);
              t = (s.table || []).filter((tc) => idx[tc.cardId]);
              const onTable = new Set(t.map((c) => c.cardId));
              all.forEach((d) => {
                const savedPile = (s.piles || {})[d.id];
                p[d.id] = savedPile
                  ? savedPile.filter((id) => idx[id] && !onTable.has(id))
                  : shuffle(d.cards.map((c) => c.id).filter((id) => !onTable.has(id)));
              });
              z = s.maxZ || 1;
              act = validDeck(s.activeDeckId) ? s.activeDeckId : null;
            } catch { /* почнемо заново */ }
          }
          if (!Object.keys(p).length) {
            all.forEach((d) => (p[d.id] = shuffle(d.cards.map((c) => c.id))));
          }

          setPiles(p);
          setTable(t);
          setMaxZ(z);
          setActiveDeckId(validDeck(qDeck) ? qDeck : act || all[0].id);
        }
        setLoaded(true);
      } catch (e) {
        setError(e.message);
      }
    })();

    return () => {
      unsubDb?.();
      unsubPresence?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Автозбереження (тільки соло)
  useEffect(() => {
    if (!loaded || shared) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ piles, table, maxZ, activeDeckId })
    );
  }, [piles, table, maxZ, activeDeckId, loaded, shared]);

  const activeDeck = decks?.find((d) => d.id === activeDeckId);
  const activePile = piles[activeDeckId] || [];

  const patchCard = useCallback((uid, patch, sync = true) => {
    setTable((t) => {
      const next = t.map((tc) => (tc.uid === uid ? { ...tc, ...patch } : tc));
      if (shared && sync) {
        const tc = next.find((c) => c.uid === uid);
        if (tc) upsertCard(tc, session.id);
      }
      return next;
    });
  }, [shared, session]);

  // ==== Дії ====
  function placeCard(cardId, faceUp) {
    const jitterX = (Math.random() - 0.5) * 0.15;
    const jitterY = (Math.random() - 0.5) * 0.15;
    const tc = {
      uid: crypto.randomUUID(),
      cardId,
      x: Math.min(Math.max(0.5 - (CARD_W / canvasSize.w) / 2 + jitterX, 0.02), 0.9),
      y: Math.min(Math.max(0.5 - (CARD_H / canvasSize.h) / 2 + jitterY, 0.02), 0.75),
      rot: (Math.random() - 0.5) * 10,
      scale: 1,
      faceUp,
      z: maxZ + 1,
      note: '',
    };
    setMaxZ(tc.z);
    setTable((t) => [...t, tc]);
    const newPiles = {
      ...piles,
      [activeDeckId]: activePile.filter((id) => id !== cardId),
    };
    setPiles(newPiles);
    setSelected(tc.uid);
    if (shared) {
      upsertCard(tc, session.id);
      updatePile(session.id, newPiles);
    }
  }

  // Витягування завжди випадкове — незалежно від порядку в стосі
  function drawRandom(faceUp) {
    if (!activePile.length) return;
    const cardId = activePile[Math.floor(Math.random() * activePile.length)];
    placeCard(cardId, faceUp);
  }
  const pickCard = (cardId) => { setPickerOpen(false); placeCard(cardId, true); };

  function bringToFront(uid) {
    const z = maxZ + 1;
    setMaxZ(z);
    patchCard(uid, { z });
  }

  const flipCard = (uid) => {
    const tc = table.find((c) => c.uid === uid);
    if (tc) patchCard(uid, { faceUp: !tc.faceUp });
  };

  function returnToPile(uid) {
    const tc = table.find((c) => c.uid === uid);
    if (!tc) return;
    const home = cardIndex[tc.cardId]?.deck.id;
    setTable((t) => t.filter((c) => c.uid !== uid));
    const newPiles = home
      ? { ...piles, [home]: [...(piles[home] || []), tc.cardId] }
      : piles;
    setPiles(newPiles);
    if (selected === uid) setSelected(null);
    if (zoomed === uid) setZoomed(null);
    if (shared) {
      deleteCard(uid);
      updatePile(session.id, newPiles);
    }
  }

  function setNote(uid, note) {
    patchCard(uid, { note }, false);
    if (shared) {
      clearTimeout(noteTimerRef.current[uid]);
      noteTimerRef.current[uid] = setTimeout(() => {
        setTable((t) => {
          const tc = t.find((c) => c.uid === uid);
          if (tc) upsertCard(tc, session.id);
          return t;
        });
      }, 600);
    }
  }

  function clearTable() {
    if (!window.confirm('Прибрати всі карти зі столу й почати заново?')) return;
    const p = {};
    decks.forEach((d) => (p[d.id] = shuffle(d.cards.map((c) => c.id))));
    setTable([]);
    setPiles(p);
    setSelected(null);
    setZoomed(null);
    if (shared) {
      deleteAllCards(session.id);
      updatePile(session.id, p);
    }
  }

  function copyLink() {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ==== Клавіша Delete — прибрати вибрану карту зі столу ====
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Delete') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (zoomed || pickerOpen || !selected) return;
      returnToPile(selected);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Фінальна синхронізація карти після жесту
  function syncCard(uid) {
    if (!shared) return;
    setTable((t) => {
      const tc = t.find((c) => c.uid === uid);
      if (tc) upsertCard(tc, session.id);
      return t;
    });
  }

  // ==== Перетягування ====
  const zoomTimerRef = useRef(null);

  function onCardPointerDown(e, uid) {
    e.preventDefault();
    const tc = table.find((c) => c.uid === uid);
    dragRef.current = {
      uid,
      dx: e.clientX - tc.x * canvasSize.w,
      dy: e.clientY - tc.y * canvasSize.h,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      wasSelected: selected === uid,
    };
    bringToFront(uid);
    setSelected(uid);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onCardPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    if (!d.moved) return;
    const x = (e.clientX - d.dx) / canvasSize.w;
    const y = (e.clientY - d.dy) / canvasSize.h;
    const throttleOk = Date.now() - lastSentRef.current > 120;
    if (throttleOk) lastSentRef.current = Date.now();
    patchCard(d.uid, { x, y }, throttleOk);
  }

  function onCardPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      syncCard(d.uid);
    } else if (d.wasSelected) {
      // клік по вже вибраній карті — розглянути (з затримкою,
      // щоб подвійний клік устиг перевернути замість цього)
      clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = setTimeout(() => setZoomed(d.uid), 280);
    }
  }

  // ==== Жести на хватах: розмір (за кут) і поворот ====
  function canvasPoint(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  }

  function startGesture(e, uid, mode) {
    e.stopPropagation();
    e.preventDefault();
    const tc = table.find((c) => c.uid === uid);
    if (!tc) return;
    const { px, py } = canvasPoint(e);
    const ox = tc.x * canvasSize.w;
    const oy = tc.y * canvasSize.h;
    const s = tc.scale ?? 1;
    const cx = ox + (CARD_W * s) / 2;
    const cy = oy + (CARD_H * s) / 2;

    const g =
      mode === 'resize'
        ? { startDist: Math.max(20, Math.hypot(px - ox, py - oy)), startScale: s, ox, oy }
        : { startAngle: Math.atan2(py - cy, px - cx), startRot: tc.rot, cx, cy };

    const move = (ev) => {
      const { px: mx, py: my } = canvasPoint(ev);
      const throttleOk = Date.now() - lastSentRef.current > 120;
      if (throttleOk) lastSentRef.current = Date.now();
      if (mode === 'resize') {
        const dist = Math.hypot(mx - g.ox, my - g.oy);
        const scale = Math.min(3, Math.max(0.4, (g.startScale * dist) / g.startDist));
        patchCard(uid, { scale }, throttleOk);
      } else {
        const angle = Math.atan2(my - g.cy, mx - g.cx);
        const rot = g.startRot + ((angle - g.startAngle) * 180) / Math.PI;
        patchCard(uid, { rot }, throttleOk);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      syncCard(uid);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  if (error) return <div className="table-status">Помилка: {error}</div>;
  if (!decks || !loaded || !activeDeck)
    return <div className="table-status">Завантаження столу…</div>;

  const zoomedCard = zoomed ? table.find((c) => c.uid === zoomed) : null;
  const zoomedEntry = zoomedCard ? cardIndex[zoomedCard.cardId] : null;

  return (
    <div className="table-page">
      <header className="table-header">
        <Link to="/" className="btn btn-ghost">←</Link>

        <span className="table-deck-name">{activeDeck.name}</span>
        <span className="pile-counter">У колоді: {activePile.length}</span>

        {shared && (
          <div className="share-block">
            <button className="btn btn-table" onClick={copyLink}>
              {copied ? '✓ Скопійовано' : '🔗 Запросити'}
            </button>
            <span className="presence" title={people.join(', ')}>
              👥 {people.length || 1}
            </span>
          </div>
        )}

        <div className="table-actions">
          <button className="btn btn-table" onClick={() => drawRandom(true)} disabled={!activePile.length}>
            🎴 Витягнути горілиць
          </button>
          <button className="btn btn-table" onClick={() => drawRandom(false)} disabled={!activePile.length}>
            🂠 Витягнути долілиць
          </button>
          <button className="btn btn-table" onClick={() => setPickerOpen(true)} disabled={!activePile.length}>
            👁 Обрати
          </button>
          <button className="btn btn-table btn-danger" onClick={clearTable} disabled={!table.length}>
            ✨ Очистити
          </button>
        </div>
      </header>

      <main
        className="table-canvas"
        ref={canvasRef}
        onPointerDown={(e) => {
          if (e.target === canvasRef.current) setSelected(null);
        }}
      >
        {activePile.length > 0 && (
          <button
            className="deck-pile"
            onClick={() => drawRandom(false)}
            title={`Витягнути карту долілиць із колоди «${activeDeck.name}»`}
          >
            <img src={activeDeck.back} alt="Колода" draggable={false} />
            <span className="deck-pile-count">{activePile.length}</span>
          </button>
        )}

        {/* Панель вибору колоди — сорочки всіх колод ліворуч від стосу */}
        {decks.length > 1 && (
          <>
            <button
              className="deck-tray-toggle"
              onClick={() => setTrayOpen((o) => !o)}
              title={trayOpen ? 'Сховати колоди' : 'Показати колоди'}
            >
              {trayOpen ? '›' : '‹'}
            </button>
            {trayOpen && (
              <div className="deck-tray">
                {decks.map((d) => (
                  <button
                    key={d.id}
                    className={`deck-tray-item ${d.id === activeDeckId ? 'is-active' : ''}`}
                    onClick={() => setActiveDeckId(d.id)}
                    title={d.name}
                  >
                    <img src={d.back} alt="" draggable={false} />
                    <span className="deck-tray-name">{d.name}</span>
                    <span className="deck-tray-count">{piles[d.id]?.length ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {table.length === 0 && (
          <div className="table-empty-hint">
            Натисніть на колоду або «Витягнути», щоб узяти першу карту
          </div>
        )}

        {table.map((tc) => {
          const entry = cardIndex[tc.cardId];
          if (!entry) return null;
          const s = tc.scale ?? 1;
          return (
            <div
              key={tc.uid}
              className={`table-card ${selected === tc.uid ? 'is-selected' : ''}`}
              style={{
                left: tc.x * canvasSize.w,
                top: tc.y * canvasSize.h,
                width: CARD_W * s,
                height: CARD_H * s,
                zIndex: tc.z,
                transform: `rotate(${tc.rot}deg)`,
              }}
              onPointerDown={(e) => onCardPointerDown(e, tc.uid)}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onDoubleClick={() => {
                clearTimeout(zoomTimerRef.current);
                flipCard(tc.uid);
              }}
            >
              <div className={`card-inner ${tc.faceUp ? 'face-up' : ''}`}>
                <img className="card-face card-back" src={entry.deck.back} alt="" draggable={false} />
                <img className="card-face card-front" src={entry.card.image} alt={entry.card.name} draggable={false} />
              </div>
              {tc.note && <span className="note-dot" title="Є нотатка" />}

              {selected === tc.uid && (
                <>
                  <div
                    className="handle handle-rotate"
                    title="Повернути"
                    onPointerDown={(e) => startGesture(e, tc.uid, 'rotate')}
                  >
                    ⟳
                  </div>
                  <div
                    className="handle handle-resize"
                    title="Змінити розмір"
                    onPointerDown={(e) => startGesture(e, tc.uid, 'resize')}
                  />
                </>
              )}
            </div>
          );
        })}
      </main>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title-row">
              <h2>Оберіть карту · {activeDeck.name}</h2>
              <button className="modal-close" onClick={() => setPickerOpen(false)}>✕</button>
            </div>
            <div className="picker-grid">
              {activePile.map((id) => {
                const entry = cardIndex[id];
                if (!entry) return null;
                return (
                  <button key={id} className="picker-card" onClick={() => pickCard(id)}>
                    <img src={entry.card.image} alt={entry.card.name} loading="lazy" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {zoomedCard && zoomedEntry && (
        <div className="modal-overlay" onClick={() => setZoomed(null)}>
          <div className="zoom-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close zoom-close" onClick={() => setZoomed(null)}>✕</button>
            <img
              className="zoom-image"
              src={zoomedCard.faceUp ? zoomedEntry.card.image : zoomedEntry.deck.back}
              alt=""
            />
            <div className="zoom-side">
              {zoomedCard.faceUp ? (
                <h3>{zoomedEntry.card.name || 'Карта'}</h3>
              ) : (
                <h3>Карта ще закрита</h3>
              )}
              <button className="btn btn-table" onClick={() => flipCard(zoomedCard.uid)}>
                🔄 Перевернути
              </button>
              <label className="note-label">
                Ваші асоціації
                <textarea
                  value={zoomedCard.note}
                  onChange={(e) => setNote(zoomedCard.uid, e.target.value)}
                  placeholder="Що ви бачите? Про що це для вас?"
                  rows={6}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
