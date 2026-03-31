import styles from '../styles/App.module.css';

export default function Participants({ participants }) {
  return (
    <section className={styles.participants} aria-label="Participants">
      <p className={styles.sectionLabel}>Watching ({participants.length})</p>
      <ul className={styles.participantList} role="list">
        {participants.map((p, i) => (
          <li key={i} className={styles.participant}>
            <span className={styles.avatar} aria-hidden="true">
              {p.username[0]?.toUpperCase()}
            </span>
            <span>{p.username}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
