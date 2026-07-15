import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function guestName() {
  return `Гість ${Math.floor(10 + Math.random() * 90)}`;
}

export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/table/${code}`, { state: { name: guestName() }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return <div className="table-status">Приєднуємось до сесії…</div>;
}
