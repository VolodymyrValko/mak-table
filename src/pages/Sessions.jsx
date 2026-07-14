import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { listSessions, endSession, reactivateSession } from '../lib/session.js';
import { loadAllDecks } from '../lib/decks.js';

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

  if (!supabase) {
    return (
      <div className="sessions-page">
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
      <header className="sessions-header">
        <Link to="/" className="btn btn-ghost">← На головну</Link>
        <h1>Спільні сесії</h1>
      </header>

      <div className="sessions-tabs">
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
      {sessions === null && !error && <p>Завантаження…</p>}

      {sessions && filtered.length === 0 && (
        <p className="sessions-empty">
          {tab === 'active' ? 'Активних сесій поки немає.' : 'Неактивних сесій немає.'}
        </p>
      )}

      <section className="session-list">
        {filtered?.map((s) => (
          <div key={s.id} className="session-item">
            <div className="session-info">
              <strong>{deckNames[s.deck_id] || 'Невідома колода'}</strong>
              <span className="session-meta">
                Код: {s.code} · {formatDate(s.created_at)}
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
                <button className="btn btn-ghost" onClick={() => handleReactivate(s)}>
                  Відновити
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
