import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { createSession } from '../lib/session.js';
import { loadDeck } from '../lib/decks.js';

export default function Home() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreateShared() {
    setCreating(true);
    setError(null);
    try {
      const deck = await loadDeck('nature');
      const pile = deck.cards.map((c) => c.id).sort(() => Math.random() - 0.5);
      const session = await createSession(deck.id, pile);
      navigate(`/table/${session.code}`, { state: { name: 'Ведучий' } });
    } catch (e) {
      setError(e.message || 'Не вдалося створити сесію');
      setCreating(false);
    }
  }

  return (
    <div className="home">
      <header className="home-hero">
        <h1>МАК-стіл</h1>
        <p className="home-tagline">
          Онлайн-простір для роботи з метафоричними асоціативними картками —
          наодинці або разом із психологом.
        </p>
        <div className="home-cta">
          <Link to="/table" className="btn btn-primary btn-lg">
            Відкрити стіл
          </Link>
          {supabase && (
            <button
              className="btn btn-secondary btn-lg"
              onClick={handleCreateShared}
              disabled={creating}
            >
              {creating ? 'Створюємо…' : 'Створити спільний стіл'}
            </button>
          )}
        </div>
        {error && <p className="home-error">{error}</p>}
      </header>

      <section className="home-steps">
        <h2>Як це працює</h2>
        <ol>
          <li>
            <strong>Відкрийте стіл</strong> — віртуальне поле з колодою карток.
          </li>
          <li>
            <strong>Витягніть картку</strong> — наосліп або обираючи свідомо.
          </li>
          <li>
            <strong>Досліджуйте образ</strong> — рухайте, перевертайте,
            наближайте, додавайте нотатки.
          </li>
          <li>
            <strong>Працюйте разом</strong> — поділіться посиланням, і ваш
            співрозмовник побачить той самий стіл у реальному часі.
          </li>
        </ol>
      </section>

      <footer className="home-footer">
        <p className="disclaimer">
          Цей сайт — інструмент для самопізнання та роботи зі спеціалістом.
          Він не є заміною психотерапії чи медичної допомоги.
        </p>
      </footer>
    </div>
  );
}
