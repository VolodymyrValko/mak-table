import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { loadAllDecks, createDeck, deleteDeck } from '../lib/decks.js';

export default function Decks() {
  const [decks, setDecks] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [files, setFiles] = useState([]); // [{file, url}]
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const fileInputRef = useRef(null);

  async function refresh() {
    try {
      setDecks(await loadAllDecks());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
    return () => files.forEach((f) => URL.revokeObjectURL(f.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(list) {
    const imgs = [...list].filter((f) => f.type.startsWith('image/'));
    setFiles((prev) => [
      ...prev,
      ...imgs.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  function removeFile(i) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (files.length < 2) {
      setError('Додайте щонайменше 2 картки');
      return;
    }
    setBusy(true);
    setError(null);
    const defaultName = `Колода від ${new Date().toLocaleDateString('uk-UA')}`;
    try {
      await createDeck(
        {
          name: name.trim() || defaultName,
          description: '',
          files: files.map((f) => f.file),
          cardNames: [],
        },
        (done, total) => setProgress(`${done} / ${total}`)
      );
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
      setName('');
      await refresh();
    } catch (err) {
      setError(err.message || 'Не вдалося створити колоду');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleDelete(deck) {
    if (!window.confirm(`Видалити колоду «${deck.name}» назавжди? Це не можна скасувати.`)) return;
    try {
      await deleteDeck(deck.id);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!supabase) {
    return (
      <div className="decks-page">
        <p>Власні колоди недоступні: бекенд не налаштований.</p>
        <Link to="/">← На головну</Link>
      </div>
    );
  }

  return (
    <div className="decks-page">
      <header className="decks-header">
        <Link to="/" className="btn btn-ghost">← На головну</Link>
        <h1>Мої колоди</h1>
      </header>

      {error && <p className="home-error">{error}</p>}

      <section className="deck-list">
        {decks === null && <p>Завантаження…</p>}
        {decks?.map((d) => (
          <div key={d.id} className="deck-item">
            <div>
              <strong>{d.name}</strong>
              {d.description && <p className="deck-desc">{d.description}</p>}
            </div>
            {d.custom ? (
              <button className="btn btn-delete" onClick={() => handleDelete(d)}>
                Видалити
              </button>
            ) : (
              <span className="deck-builtin-tag">вбудована</span>
            )}
          </div>
        ))}
      </section>

      <section className="deck-create">
        <h2>Нова колода</h2>
        <form onSubmit={handleCreate}>
          <label
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {files.length === 0
              ? '📂 Перетягніть зображення карток сюди або натисніть, щоб обрати'
              : `Карток: ${files.length}. Натисніть, щоб додати ще`}
          </label>

          {files.length > 0 && (
            <div className="upload-grid">
              {files.map((f, i) => (
                <div key={f.url} className="upload-card">
                  <img src={f.url} alt="" />
                  <button
                    type="button"
                    className="upload-remove"
                    title="Прибрати"
                    onClick={() => removeFile(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <>
              <input
                type="text"
                placeholder={`Назва (необовʼязково) — інакше «Колода від ${new Date().toLocaleDateString('uk-UA')}»`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? `Завантажуємо… ${progress || ''}` : `Створити колоду (${files.length} карток)`}
              </button>
            </>
          )}
          <p className="upload-hint">
            Зображення стискаються автоматично. Завантажуйте лише картинки, на
            які маєте права (власні, куплені або з вільною ліцензією).
          </p>
        </form>
      </section>
    </div>
  );
}
