import { useParams } from 'react-router-dom';
import styles from '../styles/App.module.css';

export default function MPVSetup({ title }) {
  const { sessionId } = useParams();

  return (
    <div className={styles.mpvSetup}>
      <div className={styles.mpvIcon}>🎬</div>
      <h2>{title || 'Watch Together'}</h2>
      <p>Run these two commands in separate terminals to start watching:</p>
      <div className={styles.codeBlock}>
        <strong>1. Start MPV</strong>
        <pre>{'mpv --input-ipc-server=/tmp/mpvsocket --idle'}</pre>
        <strong>2. Start bridge</strong>
        <pre>{`cd bridge && npm install && node index.js ${sessionId}`}</pre>
      </div>
      <p className={styles.hint}>The bridge loads the file in MPV and keeps it in sync. Use the controls below to play/pause/seek.</p>
    </div>
  );
}
