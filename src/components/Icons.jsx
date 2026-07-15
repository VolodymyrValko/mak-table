/* Мінімалістичні лінійні піктограми (у дусі Lucide/Feather).
   24×24, stroke=currentColor — успадковують колір тексту/кнопки. */

function base(props) {
  return {
    width: props.size ?? 18,
    height: props.size ?? 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: props.strokeWidth ?? 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `icon ${props.className || ''}`,
    'aria-hidden': true,
  };
}

export function IconCards(props) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="4" width="12" height="17" rx="2.2" transform="rotate(-8 12 12)" opacity="0.55" />
      <rect x="6.5" y="4.5" width="12" height="17" rx="2.2" />
    </svg>
  );
}

export function IconCardFace(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="16" height="18" rx="2.2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconCardBack(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="16" height="18" rx="2.2" />
      <path d="M12 7 L15.5 12 L12 17 L8.5 12 Z" />
    </svg>
  );
}

export function IconEye(props) {
  return (
    <svg {...base(props)}>
      <path d="M2 12c2.6-4.8 6.2-7.2 10-7.2s7.4 2.4 10 7.2c-2.6 4.8-6.2 7.2-10 7.2S4.6 16.8 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c3.8 0 7.4 2.4 10 7.2-1 1.9-2.2 3.4-3.5 4.6M6.8 6.8C4.9 8 3.3 9.8 2 12c2.6 4.8 6.2 7.2 10 7.2 1.4 0 2.7-.3 4-.9" />
      <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function IconLink(props) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6.5l1.2-1.2a3.6 3.6 0 0 1 5.1 5.1L16 11.6" />
      <path d="M13 17.5l-1.2 1.2a3.6 3.6 0 0 1-5.1-5.1L8 12.4" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M16 8.3a3 3 0 1 1 .5 6" />
      <path d="M15 13.6c2.4.3 4.5 2.3 4.5 5.4" />
    </svg>
  );
}

export function IconCursor(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 3.5 19 10l-6 1.6L11 18 5 3.5Z" />
    </svg>
  );
}

export function IconPencil(props) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 4.5 19.5 9.5 8 21H3v-5L14.5 4.5Z" />
      <path d="M12.5 6.5 17.5 11.5" />
    </svg>
  );
}

export function IconType(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 5h14" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </svg>
  );
}

export function IconEraser(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 15.5 13 6.5c.8-.8 2-.8 2.8 0l3.7 3.7c.8.8.8 2 0 2.8L11 21.5" />
      <path d="M4 15.5 9.5 21H18" />
      <path d="M8.5 11 15 17.5" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V4.6c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1V7" />
      <path d="M6 7l1 12.4c.1 1 .9 1.6 1.8 1.6h6.4c.9 0 1.7-.7 1.8-1.6L18 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconPalette(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.7 1.7-1.7H16A4.5 4.5 0 0 0 20.5 10c0-3.6-3.8-6.5-8.5-6.5Z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRing(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="7.5" />
    </svg>
  );
}

export function IconX(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export function IconChevronUp(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 15l7-7 7 7" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}

export function IconChevronLeft(props) {
  return (
    <svg {...base(props)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconChevronRight(props) {
  return (
    <svg {...base(props)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function IconFolderOpen(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 8.5V6a1.6 1.6 0 0 1 1.6-1.6h4l2 2.2h7.8A1.6 1.6 0 0 1 20 8.2" />
      <path d="M3 8.5h16.6c1 0 1.7.9 1.5 1.9l-1.6 7.4a1.8 1.8 0 0 1-1.8 1.4H5.4a1.8 1.8 0 0 1-1.8-1.4L2 10.4c-.2-1 .5-1.9 1.5-1.9Z" />
    </svg>
  );
}

export function IconBookmark(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.8c0-.7.6-1.3 1.3-1.3h9.4c.7 0 1.3.6 1.3 1.3v16.7l-6-4-6 4V3.8Z" />
    </svg>
  );
}

export function IconClock(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

export function IconArrowLeft(props) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

export function IconRotate(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 12a8 8 0 1 1 2.6 5.9" />
      <path d="M4 17.5V13h4.5" />
    </svg>
  );
}

export function IconSave(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 4.8C5 3.8 5.8 3 6.8 3H15l4 4v11.2c0 1-.8 1.8-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.2V4.8Z" />
      <path d="M8 3v5h7V3.3" />
      <path d="M8 21v-6h8v6" />
    </svg>
  );
}

export function IconSparkle(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c.6 3.6 2 5 5.5 5.6-3.6.6-5 2-5.6 5.6-.6-3.6-2-5-5.6-5.6 3.6-.6 5-2 5.6-5.6Z" />
      <path d="M18.5 15.5c.3 1.7.9 2.3 2.6 2.6-1.7.3-2.3.9-2.6 2.6-.3-1.7-.9-2.3-2.6-2.6 1.7-.3 2.3-.9 2.6-2.6Z" />
    </svg>
  );
}
