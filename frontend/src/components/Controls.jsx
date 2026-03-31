import styles from '../styles/App.module.css';

export default function Controls({ paused, position, onPlay, onPause, onSeek }) {
  return (
    <div className={styles.controls}>
      <button className={styles.btnControl} onClick={onPause} disabled={!paused ? false : true} title="Pause" style={{ display: paused ? 'none' : 'inline-flex' }}>
        ⏸ Pause
      </button>
      <button className={styles.btnControl} onClick={onPlay} style={{ display: paused ? 'inline-flex' : 'none' }}>
        ▶ Play
      </button>
      <button className={styles.btnControl} onClick={() => onSeek(Math.max(0, position - 10))}>
        ⏪ -10s
      </button>
      <button className={styles.btnControl} onClick={() => onSeek(position + 10)}>
        +10s ⏩
      </button>
      <span className={styles.timeDisplay}>{formatTime(position)}</span>
    </div>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
