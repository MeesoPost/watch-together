import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import styles from '../styles/App.module.css';

export default function Home() {
  const [sessions, setSessions] = useState([]);
  const [joining, setJoining] = useState(null); // session being joined
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const socket = io();
    socket.emit('lobby:join');
    socket.on('lobby:sessions', setSessions);
    return () => socket.disconnect();
  }, []);

  function handleJoin() {
    if (!username.trim() || !joining) return;
    const serverHost = window.location.hostname;
    const appLink = `watchtogether://${joining.id}@${serverHost}:3001`;
    window.location.href = appLink;
    // Fallback: also navigate in browser
    setTimeout(() => navigate(`/join/${joining.id}?username=${encodeURIComponent(username.trim())}`), 500);
    setJoining(null);
    setUsername('');
  }

  return (
    <div className={styles.homePage}>
      <div className={styles.homeHeader}>
        <h1 className={styles.title}>Watch Together</h1>
        <button className={styles.btnPrimary} onClick={() => navigate('/create')}>
          + Create Party
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className={styles.empty}>
          <p>Geen actieve sessies.</p>
          <p>Maak een party aan om te beginnen.</p>
        </div>
      ) : (
        <div className={styles.sessionGrid}>
          {sessions.map((s) => (
            <div key={s.id} className={styles.sessionCard} onClick={() => setJoining(s)}>
              <div className={styles.sessionTitle}>{s.title}</div>
              <div className={styles.sessionMeta}>
                <span className={styles.dot} />
                {s.viewerCount} watching
              </div>
              <div className={styles.sessionViewers}>
                {s.viewers.slice(0, 4).join(', ')}
                {s.viewers.length > 4 && ` +${s.viewers.length - 4}`}
              </div>
              <button className={styles.btnJoin}>Join</button>
            </div>
          ))}
        </div>
      )}

      {joining && (
        <div className={styles.modalOverlay} onClick={() => setJoining(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Join {joining.title}</h2>
            <p>{joining.viewerCount} mensen aan het kijken</p>
            <input
              className={styles.input}
              placeholder="Jouw naam"
              value={username}
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <div className={styles.modalButtons}>
              <button className={styles.btnSecondary} onClick={() => setJoining(null)}>Annuleer</button>
              <button className={styles.btnPrimary} disabled={!username.trim()} onClick={handleJoin}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
