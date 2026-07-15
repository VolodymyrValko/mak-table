import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import {
  listSessions, endSession, reactivateSession, renameSession, deleteSessionForever,
} from '../lib/session.js';
import { loadAllDecks } from '../lib/decks.js';
import { PillNav, SkeletonRows, BackgroundShapes } from '../components/ui.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [deckNames, setDeckNames] = useState({});
  const [tab, setTab] = useState('active'); // 'active' | 'inactive'
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);

  async function refresh() {
    try {
      const [list, decks] = await Promise.all([listSessions(), loadAllDecks()]);
      setSessions(list);
      const names = {};
      decks.forEach((d) => (names[d.id] = d.name));
      setDeckNames(names);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleEnd(s) {
    if (!window.confirm('Позначити сесію завершеною? Її й далі можна буде відкрити.')) return;
    await endSession(s.id);
    refresh();
  }

  async function handleReactivate(s) {
    await reactivateSession(s.id);
    refresh();
  }

  async function handleDelete(s) {
    if (!window.confirm('Видалити сесію назавжди? Усі карти, малюнки й нотатки буде втрачено безповоротно.')) return;
    await deleteSessionForever(s.id);
    refresh();
  }

  async function handleRename(s, value) {
    setEditingId(null);
    const name = value.trim();
    if (name === (s.name || '')) return;
    await renameSession(s.id, name || null);
    refresh();
  }

  if (!supabase) {
    return (
      <div className="sessions-page">
        <PillNav />
        <p>Список сесій недоступний: бекенд не налаштований.</p>
        <Link to="/">← На головну</Link>
      </div>
    );
  }

  const filtered = sessions?.filter((s) =>
    tab === 'active' ? s.status === 'active' : s.status !== 'active'
  );

  return (
    <div className="sessions-page">
      <BackgroundShapes />
      <PillNav />

      <header className="sessions-header">
        <h1>Спільні сесії</h1>
      </header>
      <p className="page-sub">
        Кожна сесія — окремий спільний стіл. Поділіться кодом чи посиланням,
        щоб працювати з кимось у реальному часі.
      </p>

      <div className="sessions-tabs">
        <span
          className={`tab-indicator ${tab === 'inactive' ? 'pos-1' : ''}`}
          aria-hidden="true"
        />
        <button
          className={tab === 'active' ? 'is-active' : ''}
          onClick={() => setTab('active')}
        >
          Активні
        </button>
        <button
          className={tab === 'inactive' ? 'is-active' : ''}
          onClick={() => setTab('inactive')}
        >
          Неактивні
        </button>
      </div>

      {error && <p className="home-error">{error}</p>}
      {sessions === null && !error && <SkeletonRows count={3} />}

      {sessions && filtered.length === 0 && (
        <p className="sessions-empty">
          {tab === 'active' ? 'Активних сесій поки немає.' : 'Неактивних сесій немає.'}
        </p>
      )}

      <section className="session-list">
        {filtered?.map((s) => (
          <div key={s.id} className="session-item">
            <div className="session-info">
              {editingId === s.id ? (
                <input
                  type="text"
                  className="session-name-input"
                  defaultValue={s.name || deckNames[s.deck_id] || ''}
                  placeholder="Назва сесії"
                  autoFocus
                  maxLength={80}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => handleRename(s, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null);
                    if (e.key === 'Enter') e.target.blur();
                  }}
                />
              ) : (
                <span className="session-name-row">
                  <strong>{s.name || deckNames[s.deck_id] || 'Невідома колода'}</strong>
                  <button
                    className="session-edit-btn"
                    title="Перейменувати сесію"
                    onClick={() => setEditingId(s.id)}
                  >
                    ✏️
                  </button>
                </span>
              )}
              <span className="session-meta">
                <span className="session-code-chip">{s.code}</span>
                {formatDate(s.created_at)}
              </span>
            </div>
            <div className="session-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/join/${s.code}`)}
              >
                Приєднатися
              </button>
              {tab === 'active' ? (
                <button className="btn btn-ghost" onClick={() => handleEnd(s)}>
                  Завершити
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => handleReactivate(s)}>
                    Відновити
                  </button>
                  <button className="btn btn-delete" onClick={() => handleDelete(s)}>
                    Видалити назавжди
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
