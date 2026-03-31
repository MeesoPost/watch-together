import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CreateSession from './pages/CreateSession.jsx';
import WatchTogether from './pages/WatchTogether.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateSession />} />
      <Route path="/join/:sessionId" element={<WatchTogether />} />
    </Routes>
  );
}
