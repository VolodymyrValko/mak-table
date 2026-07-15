import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { createSession } from '../lib/session.js';
import { loadFullDecks } from '../lib/decks.js';
import { PillNav, Spotlight, BackgroundShapes } from '../components/ui.jsx';

export default function Home() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreateShared() {
    setCreating(true);
    setError(null);
    try {
      const decks = await loadFullDecks();
      if (!decks.length) throw new Error('Немає жодної колоди');
      // одразу готуємо перемішані стоси всіх колод — всі вони доступні за столом
      const piles = {};
      decks.forEach((d) => {
        piles[d.id] = d.cards
          .map((c) => c.id)
          .sort(() => Math.random() - 0.5);
      });
      const session = await createSession(decks[0].id, piles);
      navigate(`/table/${session.code}`, { state: { name: 'Ведучий' } });
    } catch (e) {
      setError(e.message || 'Не вдалося створити сесію');
      setCreating(false);
    }
  }

  return (
    <div className="home">
      <BackgroundShapes />
      <PillNav />

      <header className="home-hero">
        <span className="eyebrow">Простір для внутрішньої роботи</span>
        <h1>МАК-<span className="accent">стіл</span></h1>
        <p className="home-tagline">
          Тихий простір для роботи з метафоричними асоціативними картками —
          розкладайте образи, вдивляйтесь, ведіть діалог із собою чи з психологом.
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

        <div className="hero-cards" aria-hidden="true">
          <div className="hc hc-1" style={{ backgroundImage: 'url(/decks/nature/cards/card-05.jpg)' }} />
          <div className="hc hc-2" style={{ backgroundImage: 'url(/decks/nature/cards/card-02.jpg)' }} />
          <div className="hc hc-3" style={{ backgroundImage: 'url(/decks/nature/cards/card-10.jpg)' }} />
          <div className="hc hc-4" style={{ backgroundImage: 'url(/decks/nature/cards/card-21.jpg)' }} />
          <div className="hc hc-5" style={{ backgroundImage: 'url(/decks/nature/cards/card-03.jpg)' }} />
        </div>
      </header>

      <section className="home-steps">
        <h2>Як це працює</h2>
        <ol className="bento">
          <Spotlight as="li">
            <strong>Відкрийте стіл</strong> — усі ваші колоди вже там,
            перемикайтеся між ними просто за столом.
          </Spotlight>
          <Spotlight as="li">
            <strong>Витягніть картку</strong> — наосліп або обираючи свідомо.
            Карти з різних колод можуть лежати поруч.
          </Spotlight>
          <Spotlight as="li">
            <strong>Досліджуйте образ</strong> — рухайте, перевертайте,
            наближайте, додавайте нотатки.
          </Spotlight>
          <li className="bento-featured">
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
