import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { joinSession, emitPlay, emitPause, emitSeek } from '../services/sync.js';
import Controls from '../components/Controls.jsx';
import Participants from '../components/Participants.jsx';
import MPVSetup from '../components/MPVSetup.jsx';
import styles from '../styles/App.module.css';

export default function WatchTogether() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [playbackState, setPlaybackState] = useState({ paused: true, position: 0 });
  const [mpvClosed, setMpvClosed] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [joined, setJoined] = useState(false);
  const socketRef = useRef(null);
  const usernameRef = useRef('');

  const urlUsername = searchParams.get('username');

  function addNotification(msg) {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  }

  function doJoin(username) {
    usernameRef.current = username;
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('session:joined', ({ session }) => {
      setSession(session);
      setParticipants(session.viewers || []);
      setJoined(true);
    });
    socket.on('session:userJoined', ({ username: u, count }) => {
      setParticipants((prev) => [...prev.filter((p) => p.username !== u), { username: u }]);
      addNotification(`${u} joined (${count} watching)`);
    });
    socket.on('session:userLeft', ({ username: u, count }) => {
      setParticipants((prev) => prev.filter((p) => p.username !== u));
      addNotification(`${u} left (${count} watching)`);
    });
    socket.on('action:play', ({ executedBy }) => {
      setPlaybackState((s) => ({ ...s, paused: false }));
      addNotification(`${executedBy} pressed Play`);
    });
    socket.on('action:pause', ({ executedBy }) => {
      setPlaybackState((s) => ({ ...s, paused: true }));
      addNotification(`${executedBy} paused`);
    });
    socket.on('action:seeked', ({ seconds, executedBy }) => {
      setPlaybackState((s) => ({ ...s, position: seconds }));
      addNotification(`${executedBy} skipped to ${formatTime(seconds)}`);
    });
    socket.on('action:position', ({ seconds }) => {
      setPlaybackState((s) => ({ ...s, position: seconds }));
    });
    socket.on('error', ({ message }) => {
      alert(`Error: ${message}`);
    });

    joinSession(sessionId, username);
  }

  useEffect(() => {
    if (urlUsername) doJoin(urlUsername);

    if (window.electronBridge) {
      window.electronBridge.onMpvClosed(() => setMpvClosed(true));
    }

    return () => disconnectSocket();
  }, []);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  if (!joined) {
    return (
      <div className={styles.joinPage}>
        <h2>Join Watch Party</h2>
        <input
          className={styles.input}
          placeholder="Your name"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && usernameInput.trim() && doJoin(usernameInput.trim())}
        />
        <button
          className={styles.btnPrimary}
          disabled={!usernameInput.trim()}
          onClick={() => doJoin(usernameInput.trim())}
        >
          Join
        </button>
      </div>
    );
  }

  return (
    <div className={styles.watchPage}>
      <div className={styles.main}>
        <div className={styles.videoArea}>
          <MPVSetup mediaPath={session?.mediaPath} title={session?.title} />
          <Controls
            paused={playbackState.paused}
            position={playbackState.position}
            onPlay={() => emitPlay(sessionId)}
            onPause={() => emitPause(sessionId)}
            onSeek={(s) => emitSeek(sessionId, s)}
          />
        </div>
        <div className={styles.sidebar}>
          <Participants participants={participants} />
        </div>
      </div>
      {mpvClosed && (
        <div className={styles.mpvClosedBanner}>
          <span>MPV was closed</span>
          <button
            className={styles.btnPrimary}
            onClick={() => {
              window.electronBridge.reopenMpv(playbackState.position);
              setMpvClosed(false);
            }}
          >
            Reopen at {formatTime(playbackState.position)}
          </button>
        </div>
      )}
      <div className={styles.notifications}>
        {notifications.map((n) => (
          <div key={n.id} className={styles.notification}>{n.msg}</div>
        ))}
      </div>
    </div>
  );
}
