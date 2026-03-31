import styles from '../styles/App.module.css';

export default function Controls({ paused, position, onPlay, onPause, onSeek }) {
  return (
    <div className={styles.controls} role="group" aria-label="Playback controls">
      <button
        className={styles.btnPlayPause}
        onClick={paused ? onPlay : onPause}
        aria-label={paused ? 'Play' : 'Pause'}
      >
        {paused ? '▶ Play' : '⏸ Pause'}
      </button>
      <button
        className={styles.btnSeek}
        onClick={() => onSeek(Math.max(0, position - 10))}
        aria-label="Rewind 10 seconds"
      >
        ⏪ −10s
      </button>
      <button
        className={styles.btnSeek}
        onClick={() => onSeek(position + 10)}
        aria-label="Forward 10 seconds"
      >
        +10s ⏩
      </button>
      <span className={styles.timeDisplay} aria-label={`Current position: ${formatTime(position)}`}>
        {formatTime(position)}
      </span>
    </div>
  );
}

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
