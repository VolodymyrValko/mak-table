import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { IconCards } from './Icons.jsx';

/* Плаваюча pill-навігація, спільна для світлих сторінок */
export function PillNav() {
  const { pathname } = useLocation();
  const items = [
    { to: '/', label: 'Головна' },
    ...(supabase
      ? [
          { to: '/decks', label: 'Колоди' },
          { to: '/sessions', label: 'Сесії' },
        ]
      : []),
  ];
  return (
    <nav className="pill-nav" aria-label="Основна навігація">
      <span className="pill-nav-logo" aria-hidden="true"><IconCards size={20} /></span>
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className={`pill-nav-link ${pathname === it.to ? 'is-current' : ''}`}
        >
          {it.label}
        </Link>
      ))}
      <Link to="/table" className="pill-nav-cta">
        Одиночний стіл
      </Link>
    </nav>
  );
}

/* Картка з ефектом «прожектора»: радіальне світло під курсором.
   Позиція передається через CSS-змінні --mx / --my. */
export function Spotlight({ as: Tag = 'div', className = '', children, ...rest }) {
  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  return (
    <Tag className={`spotlight ${className}`} onMouseMove={onMove} {...rest}>
      {children}
    </Tag>
  );
}

/* Фігурні малюнки на фоні світлих сторінок: контурні геометричні
   й «карткові» фігури низької насиченості, з повільним рухом */
export function BackgroundShapes() {
  return (
    <div className="bg-shapes" aria-hidden="true">
      {/* концентричні кільця */}
      <svg className="shape-float-slow" style={{ top: '12%', left: '6%' }} width="110" height="110" viewBox="0 0 110 110" fill="none">
        <circle cx="55" cy="55" r="52" stroke="#6366f1" strokeOpacity="0.16" strokeWidth="1.5" />
        <circle cx="55" cy="55" r="36" stroke="#6366f1" strokeOpacity="0.12" strokeWidth="1.5" />
        <circle cx="55" cy="55" r="20" stroke="#6366f1" strokeOpacity="0.09" strokeWidth="1.5" />
      </svg>
      {/* чотирипроменева іскра */}
      <svg className="shape-float" style={{ top: '20%', right: '9%' }} width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M28 2 C30 18 38 26 54 28 C38 30 30 38 28 54 C26 38 18 30 2 28 C18 26 26 18 28 2 Z" stroke="#ff4d79" strokeOpacity="0.3" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {/* півмісяць */}
      <svg className="shape-float-slow" style={{ bottom: '24%', left: '10%' }} width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M44 6 A30 30 0 1 0 58 42 A24 24 0 1 1 44 6 Z" stroke="#1685c7" strokeOpacity="0.22" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {/* хвиляста лінія */}
      <svg className="shape-float" style={{ bottom: '14%', right: '13%' }} width="130" height="26" viewBox="0 0 130 26" fill="none">
        <path d="M2 13 Q13 2 24 13 T46 13 T68 13 T90 13 T112 13 T128 13" stroke="#6366f1" strokeOpacity="0.2" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {/* контур гральної карти з ромбом */}
      <svg className="shape-float-slow" style={{ top: '46%', right: '5%' }} width="54" height="76" viewBox="0 0 54 76" fill="none">
        <rect x="1.5" y="1.5" width="51" height="73" rx="8" stroke="#6366f1" strokeOpacity="0.18" strokeWidth="1.5" transform="rotate(6 27 38)" />
        <path d="M27 28 L34 38 L27 48 L20 38 Z" stroke="#ff8040" strokeOpacity="0.3" strokeWidth="1.5" strokeLinejoin="round" transform="rotate(6 27 38)" />
      </svg>
      {/* плюсики */}
      <svg className="shape-float" style={{ top: '64%', left: '4%' }} width="70" height="46" viewBox="0 0 70 46" fill="none">
        <path d="M12 4 V20 M4 12 H20" stroke="#e92f48" strokeOpacity="0.22" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M56 26 V42 M48 34 H64" stroke="#6366f1" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {/* трикутник */}
      <svg className="shape-spin" style={{ top: '8%', left: '38%' }} width="42" height="42" viewBox="0 0 42 42" fill="none">
        <path d="M21 4 L38 36 H4 Z" stroke="#ff8040" strokeOpacity="0.22" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {/* пунктирна дуга */}
      <svg className="shape-float-slow" style={{ bottom: '38%', right: '30%' }} width="90" height="52" viewBox="0 0 90 52" fill="none">
        <path d="M4 48 A44 44 0 0 1 86 48" stroke="#6366f1" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 8" />
      </svg>
      {/* маленьке коло-крапка */}
      <svg className="shape-float" style={{ top: '34%', left: '22%' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="#1685c7" strokeOpacity="0.28" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* Скелетні рядки для станів завантаження */
export function SkeletonRows({ count = 3 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-line w-40" />
          <div className="skeleton-line w-70" />
        </div>
      ))}
    </div>
  );
}
