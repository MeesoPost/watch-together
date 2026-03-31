import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import styles from '../styles/App.module.css';

export default function Home() {
  const [sessions, setSessions] = useState([]);
  const [joining, setJoining] = useState(null);
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
    setTimeout(() => navigate(`/join/${joining.id}?username=${encodeURIComponent(username.trim())}`), 500);
    setJoining(null);
    setUsername('');
  }

  return (
    <main className={styles.homePage}>
      <header className={styles.homeHeader}>
        <h1 className={styles.title}>Watch Together</h1>
        <button className={styles.btnPrimary} onClick={() => navigate('/create')}>
          + Nieuwe party
        </button>
      </header>

      {sessions.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">🎬</div>
          <p>Geen actieve sessies</p>
          <p>Maak een party aan om te beginnen.</p>
        </div>
      ) : (
        <div className={styles.sessionGrid} role="list" aria-label="Actieve sessies">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={styles.sessionCard}
              role="listitem"
              tabIndex={0}
              onClick={() => setJoining(s)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setJoining(s)}
              aria-label={`${s.title}, ${s.viewerCount} kijkers`}
            >
              <div className={styles.sessionTitle}>{s.title}</div>
              <div className={styles.sessionMeta}>
                <span className={styles.liveDot} aria-hidden="true" />
                {s.viewerCount} {s.viewerCount === 1 ? 'kijker' : 'kijkers'}
              </div>
              {s.viewers.length > 0 && (
                <div className={styles.sessionViewers} aria-label={`Kijkers: ${s.viewers.join(', ')}`}>
                  {s.viewers.slice(0, 4).join(', ')}
                  {s.viewers.length > 4 && ` +${s.viewers.length - 4}`}
                </div>
              )}
              <button
                className={styles.btnJoin}
                onClick={(e) => { e.stopPropagation(); setJoining(s); }}
                aria-label={`Join ${s.title}`}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      )}

      {joining && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={() => setJoining(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 id="modal-title">{joining.title}</h2>
            <p>{joining.viewerCount} {joining.viewerCount === 1 ? 'persoon' : 'mensen'} aan het kijken</p>
            <label htmlFor="modal-username" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Jouw naam
            </label>
            <input
              id="modal-username"
              className={styles.input}
              placeholder="Naam invoeren…"
              value={username}
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoComplete="nickname"
            />
            <div className={styles.modalButtons}>
              <button className={styles.btnGhost} onClick={() => setJoining(null)}>
                Annuleer
              </button>
              <button className={styles.btnPrimary} disabled={!username.trim()} onClick={handleJoin}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
