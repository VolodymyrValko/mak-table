import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { loadDeck } from '../lib/decks.js';
import { supabase } from '../lib/supabase.js';
import {
  fetchSession, fetchTableCards, updatePile, upsertCard, deleteCard,
  deleteAllCards, subscribeToSession, joinPresence, rowToCard,
} from '../lib/session.js';

const storageKey = (deckId) => `mak-table-${deckId}-v2`;
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
  const { sessionId: code } = useParams(); // код спільної сесії з URL
  const location = useLocation();
  const shared = Boolean(code && supabase);
  const myName = location.state?.name || (shared ? 'Учасник' : '');

  const [deck, setDeck] = useState(null);
  const [session, setSession] = useState(null); // рядок sessions із БД
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [pile, setPile] = useState([]);
  const [table, setTable] = useState([]);
  const [maxZ, setMaxZ] = useState(1);
  const [selected, setSelected] = useState(null);
  const [zoomed, setZoomed] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const lastSentRef = useRef(0);
  const noteTimerRef = useRef({});
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });

  // Розмір полотна (координати карт нормалізовані 0..1)
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
        if (shared) {
          const s = await fetchSession(code);
          const d = await loadDeck(s.deck_id);
          setDeck(d);
          setSession(s);
          setPile(s.pile);
          const rows = await fetchTableCards(s.id);
          const cards = rows.map(rowToCard);
          setTable(cards);
          setMaxZ(cards.reduce((m, c) => Math.max(m, c.z), 1));

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
            onPileChange: (p) => setPile(p),
          });
          unsubPresence = joinPresence(code, myName, setPeople);
        } else {
          const deckId =
            new URLSearchParams(location.search).get('deck') || 'nature';
          const d = await loadDeck(deckId);
          setDeck(d);
          const saved = localStorage.getItem(storageKey(d.id));
          if (saved) {
            try {
              const s = JSON.parse(saved);
              const valid = new Set(d.cards.map((c) => c.id));
              setPile(s.pile.filter((id) => valid.has(id)));
              setTable(s.table.filter((tc) => valid.has(tc.cardId)));
              setMaxZ(s.maxZ || 1);
              setLoaded(true);
              return;
            } catch { /* почнемо заново */ }
          }
          setPile(shuffle(d.cards.map((c) => c.id)));
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
    if (!loaded || shared || !deck) return;
    localStorage.setItem(storageKey(deck.id), JSON.stringify({ pile, table, maxZ }));
  }, [pile, table, maxZ, loaded, shared, deck]);

  const cardById = (id) => deck.cards.find((c) => c.id === id);

  // Локальна зміна карти + синхронізація
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
      faceUp,
      z: maxZ + 1,
      note: '',
    };
    setMaxZ(tc.z);
    setTable((t) => [...t, tc]);
    const newPile = pile.filter((id) => id !== cardId);
    setPile(newPile);
    setSelected(tc.uid);
    if (shared) {
      upsertCard(tc, session.id);
      updatePile(session.id, newPile);
    }
  }

  const drawRandom = () => pile.length && placeCard(pile[0], false);
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
    setTable((t) => t.filter((c) => c.uid !== uid));
    const newPile = [...pile, tc.cardId];
    setPile(newPile);
    if (selected === uid) setSelected(null);
    if (zoomed === uid) setZoomed(null);
    if (shared) {
      deleteCard(uid);
      updatePile(session.id, newPile);
    }
  }

  function setNote(uid, note) {
    patchCard(uid, { note }, false); // локально миттєво
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

  function shufflePile() {
    const p = shuffle(pile);
    setPile(p);
    if (shared) updatePile(session.id, p);
  }

  function clearTable() {
    if (!window.confirm('Прибрати всі карти зі столу й почати заново?')) return;
    const p = shuffle(deck.cards.map((c) => c.id));
    setTable([]);
    setPile(p);
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

  // ==== Перетягування ====
  function onCardPointerDown(e, uid) {
    e.preventDefault();
    const tc = table.find((c) => c.uid === uid);
    dragRef.current = {
      uid,
      dx: e.clientX - tc.x * canvasSize.w,
      dy: e.clientY - tc.y * canvasSize.h,
    };
    bringToFront(uid);
    setSelected(uid);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onCardPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const x = (e.clientX - d.dx) / canvasSize.w;
    const y = (e.clientY - d.dy) / canvasSize.h;
    // під час руху шлемо в мережу не частіше ніж раз на 120 мс
    const throttleOk = Date.now() - lastSentRef.current > 120;
    if (throttleOk) lastSentRef.current = Date.now();
    patchCard(d.uid, { x, y }, throttleOk);
  }

  function onCardPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && shared) {
      // фінальна позиція — завжди
      setTable((t) => {
        const tc = t.find((c) => c.uid === d.uid);
        if (tc) upsertCard(tc, session.id);
        return t;
      });
    }
  }

  if (error) return <div className="table-status">Помилка: {error}</div>;
  if (!deck || !loaded) return <div className="table-status">Завантаження столу…</div>;

  const zoomedCard = zoomed ? table.find((c) => c.uid === zoomed) : null;

  return (
    <div className="table-page">
      <header className="table-header">
        <Link to="/" className="btn btn-ghost">←</Link>
        <span className="table-deck-name">{deck.name}</span>
        <span className="pile-counter">У колоді: {pile.length}</span>

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
          <button className="btn btn-table" onClick={drawRandom} disabled={!pile.length}>
            🎴 Витягнути
          </button>
          <button className="btn btn-table" onClick={() => setPickerOpen(true)} disabled={!pile.length}>
            👁 Обрати
          </button>
          <button className="btn btn-table" onClick={shufflePile} disabled={pile.length < 2}>
            🔀 Перемішати
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
        {pile.length > 0 && (
          <button className="deck-pile" onClick={drawRandom} title="Натисніть, щоб витягнути карту">
            <img src={deck.back} alt="Колода" draggable={false} />
            <span className="deck-pile-count">{pile.length}</span>
          </button>
        )}

        {table.length === 0 && (
          <div className="table-empty-hint">
            Натисніть на колоду або «Витягнути», щоб узяти першу карту
          </div>
        )}

        {table.map((tc) => {
          const card = cardById(tc.cardId);
          if (!card) return null;
          return (
            <div
              key={tc.uid}
              className={`table-card ${selected === tc.uid ? 'is-selected' : ''}`}
              style={{
                left: tc.x * canvasSize.w,
                top: tc.y * canvasSize.h,
                zIndex: tc.z,
                transform: `rotate(${tc.rot}deg)`,
              }}
              onPointerDown={(e) => onCardPointerDown(e, tc.uid)}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onDoubleClick={() => flipCard(tc.uid)}
            >
              <div className={`card-inner ${tc.faceUp ? 'face-up' : ''}`}>
                <img className="card-face card-back" src={deck.back} alt="" draggable={false} />
                <img className="card-face card-front" src={card.image} alt={card.name} draggable={false} />
              </div>
              {tc.note && <span className="note-dot" title="Є нотатка" />}

              {selected === tc.uid && (
                <div className="card-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                  <button onClick={() => flipCard(tc.uid)} title="Перевернути">🔄</button>
                  <button onClick={() => setZoomed(tc.uid)} title="Розглянути">🔍</button>
                  <button onClick={() => returnToPile(tc.uid)} title="Повернути в колоду">↩</button>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title-row">
              <h2>Оберіть карту</h2>
              <button className="modal-close" onClick={() => setPickerOpen(false)}>✕</button>
            </div>
            <div className="picker-grid">
              {pile.map((id) => {
                const card = cardById(id);
                return (
                  <button key={id} className="picker-card" onClick={() => pickCard(id)}>
                    <img src={card.image} alt={card.name} loading="lazy" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {zoomedCard && (
        <div className="modal-overlay" onClick={() => setZoomed(null)}>
          <div className="zoom-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close zoom-close" onClick={() => setZoomed(null)}>✕</button>
            <img
              className="zoom-image"
              src={zoomedCard.faceUp ? cardById(zoomedCard.cardId).image : deck.back}
              alt=""
            />
            <div className="zoom-side">
              {zoomedCard.faceUp ? (
                <h3>{cardById(zoomedCard.cardId).name || 'Карта'}</h3>
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
