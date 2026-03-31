import styles from '../styles/App.module.css';

export default function Participants({ participants }) {
  return (
    <div className={styles.participants}>
      <h3>Watching ({participants.length})</h3>
      <ul>
        {participants.map((p, i) => (
          <li key={i} className={styles.participant}>
            <span className={styles.avatar}>{p.username[0]?.toUpperCase()}</span>
            {p.username}
          </li>
        ))}
      </ul>
    </div>
  );
}
