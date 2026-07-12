import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Table from './pages/Table.jsx';
import Join from './pages/Join.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/table" element={<Table />} />
      <Route path="/table/:sessionId" element={<Table />} />
      <Route path="/join/:code" element={<Join />} />
    </Routes>
  );
}
