import styles from '../styles/App.module.css';

export default function MPVSetup({ title }) {
  return (
    <div className={styles.mpvSetup}>
      <div className={styles.mpvIcon}>🎬</div>
      <h2>{title || 'Watch Together'}</h2>
      <p className={styles.hint}>MPV is starting… Use the controls below to play/pause/seek.</p>
    </div>
  );
}
