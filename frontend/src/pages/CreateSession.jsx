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
        <h2>Party Created!</h2>
        <p>Stuur deze link naar vrienden:</p>
        <div className={styles.joinLink}>
          <input readOnly value={appLink} />
          <button onClick={() => navigator.clipboard.writeText(appLink)}>Copy</button>
        </div>
        <p className={styles.hint}>Vrienden klikken de link → Watch Together app opent → film start automatisch.</p>
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
      <h2>Create Watch Party</h2>
      <label>Your name</label>
      <input
        className={styles.input}
        placeholder="Enter your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <label>Select video</label>
      <div className={styles.mediaList}>
        {media.map((m) => (
          <div
            key={m.path}
            className={`${styles.mediaItem} ${selected?.path === m.path ? styles.selected : ''}`}
            onClick={() => setSelected(m)}
          >
            <span>{m.title}</span>
            <span className={styles.duration}>{Math.floor(m.duration / 60)}m</span>
          </div>
        ))}
      </div>
      <button
        className={styles.btnPrimary}
        disabled={!selected || !username.trim()}
        onClick={createParty}
      >
        Create Party
      </button>
    </div>
  );
}
