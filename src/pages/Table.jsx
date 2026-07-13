import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { loadFullDecks } from '../lib/decks.js';
import { supabase } from '../lib/supabase.js';
import {
  fetchSession, fetchTableCards, updatePile, upsertCard, deleteCard,
  deleteAllCards, subscribeToSession, joinPresence, rowToCard,
  fetchAnnotations, upsertAnnotation, deleteAnnotation, deleteAllAnnotations,
  rowToAnnotation,
} from '../lib/session.js';

const STORAGE_KEY = 'mak-table-all-v3';
const CARD_W = 130;
const CARD_H = 195;
const PALETTE = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#1a1a1a', '#ffffff'];

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [copied, setCopied] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);

  // Малювання і текст
  const [annotations, setAnnotations] = useState([]);
  const [tool, setTool] = useState('select'); // 'select' | 'draw' | 'text'
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [editingAnn, setEditingAnn] = useState(null);
  const [drawColor, setDrawColor] = useState('#e74c3c');
  const [drawSize, setDrawSize] = useState(4);
  const [textColor, setTextColor] = useState('#1a2340');
  const [textSize, setTextSize] = useState(22);
  const annMaxZRef = useRef(1);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const lastSentRef = useRef(0);
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

          const annRows = await fetchAnnotations(s.id);
          const anns = annRows.map(rowToAnnotation);
          setAnnotations(anns);
          annMaxZRef.current = anns.reduce((m, a) => Math.max(m, a.z), 1);

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
            onAnnUpsert: (a) =>
              setAnnotations((list) => {
                const i = list.findIndex((x) => x.uid === a.uid);
                if (i === -1) return [...list, a];
                const copy = [...list];
                copy[i] = a;
                return copy;
              }),
            onAnnDelete: (uid) => setAnnotations((list) => list.filter((x) => x.uid !== uid)),
          });
          unsubPresence = joinPresence(code, myName, setPeople);
        } else {
          const qDeck = new URLSearchParams(location.search).get('deck');
          let p = {};
          let t = [];
          let z = 1;
          let act = null;

          let anns = [];
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
              anns = Array.isArray(s.annotations) ? s.annotations : [];
            } catch { /* почнемо заново */ }
          }
          if (!Object.keys(p).length) {
            all.forEach((d) => (p[d.id] = shuffle(d.cards.map((c) => c.id))));
          }

          setPiles(p);
          setTable(t);
          setMaxZ(z);
          setActiveDeckId(validDeck(qDeck) ? qDeck : act || all[0].id);
          setAnnotations(anns);
          annMaxZRef.current = anns.reduce((m, a) => Math.max(m, a.z), 1);
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
      JSON.stringify({ piles, table, maxZ, activeDeckId, annotations })
    );
  }, [piles, table, maxZ, activeDeckId, annotations, loaded, shared]);

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
    if (shared) {
      deleteCard(uid);
      updatePile(session.id, newPiles);
    }
  }

  function clearTable() {
    if (!window.confirm('Прибрати всі карти й малюнки зі столу та почати заново?')) return;
    const p = {};
    decks.forEach((d) => (p[d.id] = shuffle(d.cards.map((c) => c.id))));
    setTable([]);
    setPiles(p);
    setSelected(null);
    setAnnotations([]);
    setSelectedAnn(null);
    if (shared) {
      deleteAllCards(session.id);
      updatePile(session.id, p);
      deleteAllAnnotations(session.id);
    }
  }

  function copyLink() {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ==== Малювання і текст: спільні хелпери ====
  const patchAnn = useCallback((uid, patch, sync = true) => {
    setAnnotations((list) => {
      const next = list.map((a) => (a.uid === uid ? { ...a, ...patch } : a));
      if (shared && sync) {
        const a = next.find((x) => x.uid === uid);
        if (a) upsertAnnotation(a, session.id);
      }
      return next;
    });
  }, [shared, session]);

  function syncAnn(uid) {
    if (!shared) return;
    setAnnotations((list) => {
      const a = list.find((x) => x.uid === uid);
      if (a) upsertAnnotation(a, session.id);
      return list;
    });
  }

  function deleteAnn(uid) {
    setAnnotations((list) => list.filter((a) => a.uid !== uid));
    if (selectedAnn === uid) setSelectedAnn(null);
    if (editingAnn === uid) setEditingAnn(null);
    if (shared) deleteAnnotation(uid);
  }

  function bringAnnToFront(uid) {
    annMaxZRef.current += 1;
    patchAnn(uid, { z: annMaxZRef.current });
  }

  // ==== Клавіша Delete — прибрати вибрану карту або анотацію зі столу ====
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Delete') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editingAnn) return;
      if (pickerOpen) return;
      if (selectedAnn) deleteAnn(selectedAnn);
      else if (selected) returnToPile(selected);
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
    };
    bringToFront(uid);
    setSelected(uid);
    setSelectedAnn(null);
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
    if (d && d.moved) syncCard(d.uid);
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

  // ==== Малювання ====
  function startDrawing(e) {
    e.preventDefault();
    if (!canvasSize.w || !canvasSize.h) return;
    const { px, py } = canvasPoint(e);
    const uid = crypto.randomUUID();
    const first = { x: px / canvasSize.w, y: py / canvasSize.h };
    annMaxZRef.current += 1;
    const ann = {
      uid, kind: 'draw', points: [first], text: '',
      x: 0, y: 0, color: drawColor, size: drawSize, z: annMaxZRef.current,
    };
    setAnnotations((list) => [...list, ann]);
    let pts = [first];

    const move = (ev) => {
      const p = canvasPoint(ev);
      pts = [...pts, { x: p.px / canvasSize.w, y: p.py / canvasSize.h }];
      setAnnotations((list) => list.map((a) => (a.uid === uid ? { ...a, points: pts } : a)));
      const throttleOk = Date.now() - lastSentRef.current > 150;
      if (throttleOk && shared) {
        lastSentRef.current = Date.now();
        upsertAnnotation({ ...ann, points: pts }, session.id);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      if (pts.length < 2) {
        // просто клік без руху — прибираємо порожню крапку
        setAnnotations((list) => list.filter((a) => a.uid !== uid));
        return;
      }
      syncAnn(uid);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  // ==== Текст ====
  function addText(e) {
    e.preventDefault();
    if (!canvasSize.w || !canvasSize.h) return;
    const { px, py } = canvasPoint(e);
    const uid = crypto.randomUUID();
    annMaxZRef.current += 1;
    const ann = {
      uid, kind: 'text', points: null, text: '',
      x: px / canvasSize.w, y: py / canvasSize.h,
      color: textColor, size: textSize, z: annMaxZRef.current,
    };
    setAnnotations((list) => [...list, ann]);
    setSelectedAnn(uid);
    setSelected(null);
    setEditingAnn(uid);
    setTool('select');
  }

  function finishEditingText(uid, value) {
    setEditingAnn(null);
    const text = value.trim();
    if (!text) {
      deleteAnn(uid);
      return;
    }
    patchAnn(uid, { text });
  }

  // ==== Переміщення анотацій (текст і малюнок цілком) ====
  function onAnnPointerDown(e, uid) {
    e.stopPropagation();
    e.preventDefault();
    if (editingAnn === uid) return;
    const a = annotations.find((x) => x.uid === uid);
    if (!a) return;
    bringAnnToFront(uid);
    setSelectedAnn(uid);
    setSelected(null);

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const basePoints = a.points;
    const baseX = a.x;
    const baseY = a.y;

    const move = (ev) => {
      const ddx = (ev.clientX - startX) / canvasSize.w;
      const ddy = (ev.clientY - startY) / canvasSize.h;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 3) moved = true;
      if (!moved) return;
      const throttleOk = Date.now() - lastSentRef.current > 120;
      if (throttleOk) lastSentRef.current = Date.now();
      if (a.kind === 'text') {
        patchAnn(uid, { x: baseX + ddx, y: baseY + ddy }, throttleOk);
      } else {
        patchAnn(uid, { points: basePoints.map((p) => ({ x: p.x + ddx, y: p.y + ddy })) }, throttleOk);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      if (moved) syncAnn(uid);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  if (error) return <div className="table-status">Помилка: {error}</div>;
  if (!decks || !loaded || !activeDeck)
    return <div className="table-status">Завантаження столу…</div>;

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

        <div className="tool-group">
          <button
            className={`btn btn-tool ${tool === 'select' ? 'is-active' : ''}`}
            onClick={() => setTool('select')}
            title="Обрати / перемістити"
          >
            🖱
          </button>
          <button
            className={`btn btn-tool ${tool === 'draw' ? 'is-active' : ''}`}
            onClick={() => { setTool('draw'); setSelected(null); setSelectedAnn(null); }}
            title="Малювати"
          >
            ✏️
          </button>
          <button
            className={`btn btn-tool ${tool === 'text' ? 'is-active' : ''}`}
            onClick={() => { setTool('text'); setSelected(null); setSelectedAnn(null); }}
            title="Додати текст"
          >
            🔤
          </button>
        </div>

        {(tool === 'draw' || (selectedAnn && annotations.find((a) => a.uid === selectedAnn)?.kind === 'draw')) && (
          <div className="tool-props">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`swatch ${drawColor === c ? 'is-active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setDrawColor(c);
                  if (selectedAnn) patchAnn(selectedAnn, { color: c });
                }}
              />
            ))}
            <input
              type="range"
              min={2}
              max={20}
              value={selectedAnn ? annotations.find((a) => a.uid === selectedAnn)?.size ?? drawSize : drawSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDrawSize(v);
                if (selectedAnn) patchAnn(selectedAnn, { size: v });
              }}
              title="Товщина лінії"
            />
          </div>
        )}

        {(tool === 'text' || (selectedAnn && annotations.find((a) => a.uid === selectedAnn)?.kind === 'text')) && (
          <div className="tool-props">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`swatch ${textColor === c ? 'is-active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setTextColor(c);
                  if (selectedAnn) patchAnn(selectedAnn, { color: c });
                }}
              />
            ))}
            <input
              type="range"
              min={12}
              max={56}
              value={selectedAnn ? annotations.find((a) => a.uid === selectedAnn)?.size ?? textSize : textSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTextSize(v);
                if (selectedAnn) patchAnn(selectedAnn, { size: v });
              }}
              title="Розмір тексту"
            />
          </div>
        )}

        {selectedAnn && (
          <button className="btn btn-table btn-danger" onClick={() => deleteAnn(selectedAnn)}>
            🗑 Видалити
          </button>
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
          <button className="btn btn-table btn-danger" onClick={clearTable} disabled={!table.length && !annotations.length}>
            ✨ Очистити
          </button>
        </div>
      </header>

      <main
        className={`table-canvas tool-${tool}`}
        ref={canvasRef}
        onPointerDown={(e) => {
          if (tool === 'draw') { startDrawing(e); return; }
          if (tool === 'text') { addText(e); return; }
          if (e.target === canvasRef.current) { setSelected(null); setSelectedAnn(null); }
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
        {decks.length >= 1 && (
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
                {supabase && (
                  <Link
                    to="/decks"
                    className="deck-tray-item deck-tray-add"
                    title="Додати нову колоду"
                  >
                    <span className="deck-tray-add-icon">+</span>
                    <span className="deck-tray-name">Нова колода</span>
                  </Link>
                )}
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
              onDoubleClick={() => flipCard(tc.uid)}
            >
              <div className={`card-inner ${tc.faceUp ? 'face-up' : ''}`}>
                <img className="card-face card-back" src={entry.deck.back} alt="" draggable={false} />
                <img className="card-face card-front" src={entry.card.image} alt={entry.card.name} draggable={false} />
              </div>

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

        {/* Малюнки: завжди поверх карток, свг-полотно на весь стіл */}
        <svg className="draw-layer" width={canvasSize.w} height={canvasSize.h}>
          {annotations
            .filter((a) => a.kind === 'draw' && a.points?.length > 1)
            .map((a) => {
              const pts = a.points
                .map((p) => `${p.x * canvasSize.w},${p.y * canvasSize.h}`)
                .join(' ');
              return (
                <g key={a.uid}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={a.size + 16}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'stroke', cursor: 'grab' }}
                    onPointerDown={(e) => onAnnPointerDown(e, a.uid)}
                  />
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={a.size}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                    opacity={selectedAnn === a.uid ? 0.7 : 1}
                  />
                  {selectedAnn === a.uid && (
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="var(--gold)"
                      strokeWidth={a.size + 6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.5}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}
        </svg>

        {/* Текстові наліпки */}
        {annotations
          .filter((a) => a.kind === 'text')
          .map((a) => (
            <div
              key={a.uid}
              className={`text-ann ${selectedAnn === a.uid ? 'is-selected' : ''}`}
              style={{
                left: a.x * canvasSize.w,
                top: a.y * canvasSize.h,
                color: a.color,
                fontSize: a.size,
                zIndex: 10000 + a.z,
              }}
              onPointerDown={(e) => onAnnPointerDown(e, a.uid)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingAnn(a.uid);
              }}
            >
              {editingAnn === a.uid ? (
                <textarea
                  className="text-ann-input"
                  style={{ color: a.color, fontSize: a.size }}
                  defaultValue={a.text}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => finishEditingText(a.uid, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') finishEditingText(a.uid, a.text);
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.target.blur();
                    }
                  }}
                />
              ) : (
                a.text || <span className="text-ann-placeholder">Текст</span>
              )}
            </div>
          ))}
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

    </div>
  );
}
