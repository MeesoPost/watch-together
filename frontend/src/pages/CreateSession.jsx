import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/App.module.css';

export default function CreateSession() {
  const [media, setMedia] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/media')
      .then((r) => r.json())
      .then(setMedia)
      .catch(() => setMedia([]));
  }, []);

  async function createParty() {
    if (!selected || !username.trim()) return;
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaPath: selected.path }),
    });
    const data = await res.json();
    setSessionId(data.sessionId);
  }

  if (sessionId) {
    const serverHost = window.location.hostname;
    const appLink = `watchtogether://${sessionId}@${serverHost}:3001`;
    return (
      <div className={styles.create}>
        <h2>Party aangemaakt!</h2>
        <p className={styles.hint}>Stuur deze link naar vrienden. Ze klikken erop en de Watch Together app start automatisch.</p>
        <div className={styles.joinLinkBox}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Join link</p>
          <div className={styles.joinLinkRow}>
            <input readOnly value={appLink} aria-label="Join link" />
            <button onClick={() => navigator.clipboard.writeText(appLink)}>
              Kopieer
            </button>
          </div>
        </div>
        <button
          className={styles.btnPrimary}
          onClick={() => navigate(`/join/${sessionId}?username=${encodeURIComponent(username)}`)}
        >
          Zelf joinen als {username}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.create}>
      <h2>Maak een party</h2>

      <div className={styles.formField}>
        <label htmlFor="username-input">Jouw naam</label>
        <input
          id="username-input"
          className={styles.input}
          placeholder="Naam invoeren…"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createParty()}
          autoComplete="nickname"
        />
      </div>

      <div className={styles.formField}>
        <label>Kies een film</label>
        <div className={styles.mediaList} role="listbox" aria-label="Media library">
          {media.map((m) => (
            <div
              key={m.path}
              className={`${styles.mediaItem} ${selected?.path === m.path ? styles.selected : ''}`}
              role="option"
              aria-selected={selected?.path === m.path}
              tabIndex={0}
              onClick={() => setSelected(m)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(m)}
            >
              <span className={styles.mediaItemTitle}>{m.title}</span>
              <span className={styles.duration}>{Math.floor(m.duration / 60)}m</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className={styles.btnPrimary}
        disabled={!selected || !username.trim()}
        onClick={createParty}
      >
        Party aanmaken
      </button>
    </div>
  );
}
