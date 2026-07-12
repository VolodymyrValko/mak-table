import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    // Пізніше: приєднання до сесії через Supabase за кодом `code`.
    // Поки що просто ведемо на стіл.
    navigate(`/table/${code}`, { state: { name } });
  }

  return (
    <div className="join-page">
      <form className="join-card" onSubmit={handleSubmit}>
        <h1>Приєднатися до столу</h1>
        <p>Вас запросили до спільної сесії. Як вас звати?</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше ім'я"
          maxLength={40}
          required
          autoFocus
        />
        <button type="submit" className="btn btn-primary">
          Увійти до столу
        </button>
      </form>
    </div>
  );
}
