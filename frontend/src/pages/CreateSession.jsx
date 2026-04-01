import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/App.module.css';

export default function CreateSession() {
  const [library, setLibrary] = useState([]);
  const [search, setSearch] = useState('');
  const [activeSeries, setActiveSeries] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [username, setUsername] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/media').then((r) => r.json()).then(setLibrary).catch(() => setLibrary([]));
  }, []);

  async function openSeries(series) {
    setActiveSeries(series);
    setSeasons([]);
    setActiveSeasonId(null);
    setEpisodes([]);
    setLoading(true);
    try {
      const data = await fetch(`/api/media/${series.id}/children`).then((r) => r.json());
      setSeasons(data);
      if (data.length > 0) {
        setActiveSeasonId(data[0].id);
        const eps = await fetch(`/api/media/${data[0].id}/children`).then((r) => r.json());
        setEpisodes(eps);
      }
    } catch { /* Plex unreachable */ }
    setLoading(false);
  }

  async function pickSeason(seasonId) {
    if (seasonId === activeSeasonId) return;
    setActiveSeasonId(seasonId);
    setEpisodes([]);
    setLoading(true);
    try {
      const data = await fetch(`/api/media/${seasonId}/children`).then((r) => r.json());
      setEpisodes(data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function pickEpisode(episode) {
    const season = seasons.find((s) => s.id === activeSeasonId);
    const sNum = String(season?.index ?? '0').padStart(2, '0');
    const eNum = String(episode.index ?? '0').padStart(2, '0');
    const title = `${activeSeries.title} S${sNum}E${eNum} – ${episode.title}`;
    setSelected({ id: episode.id, title, streamPath: episode.streamPath });
    setActiveSeries(null);
  }

  async function createParty() {
    if (!selected || !username.trim()) return;
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: selected.id, title: selected.title }),
    });
    const data = await res.json();
    setSessionId(data.sessionId);
  }

  // ── Session created ────────────────────────────────────────────────────────
  if (sessionId) {
    const appLink = `watchtogether://${sessionId}@${window.location.host}`;
    return (
      <div className={styles.create}>
        <h2>Party aangemaakt!</h2>
        <p className={styles.hint}>Stuur deze link naar vrienden. Ze klikken erop en de Watch Together app start automatisch.</p>
        <div className={styles.joinLinkBox}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Join link</p>
          <div className={styles.joinLinkRow}>
            <input readOnly value={appLink} aria-label="Join link" />
            <button onClick={() => navigator.clipboard.writeText(appLink)}>Kopieer</button>
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

  // ── Series drill-down ──────────────────────────────────────────────────────
  if (activeSeries) {
    return (
      <div className={styles.create}>
        <div className={styles.seriesNav}>
          <button className={styles.seriesBack} onClick={() => setActiveSeries(null)}>
            ← Terug
          </button>
          <h2 className={styles.seriesHeading}>{activeSeries.title}</h2>
        </div>

        {loading && seasons.length === 0 ? (
          <p className={styles.loadingHint}>Laden…</p>
        ) : (
          <>
            <div className={styles.seasonTabs} role="tablist">
              {seasons.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === activeSeasonId}
                  className={`${styles.seasonTab} ${s.id === activeSeasonId ? styles.seasonTabActive : ''}`}
                  onClick={() => pickSeason(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>

            <div className={styles.mediaList} role="listbox">
              {loading ? (
                <p className={styles.loadingHint}>Laden…</p>
              ) : (
                episodes.map((ep) => (
                  <div
                    key={ep.id}
                    className={`${styles.mediaItem} ${selected?.id === ep.id ? styles.selected : ''}`}
                    role="option"
                    aria-selected={selected?.id === ep.id}
                    tabIndex={0}
                    onClick={() => pickEpisode(ep)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickEpisode(ep)}
                  >
                    <span className={styles.episodeNum}>E{String(ep.index ?? '?').padStart(2, '0')}</span>
                    <span className={styles.mediaItemTitle}>{ep.title}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Main library view ──────────────────────────────────────────────────────
  const filtered = library.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

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
        <label htmlFor="search-input">Media</label>
        <input
          id="search-input"
          className={`${styles.input} ${styles.searchInput}`}
          placeholder="Zoeken in bibliotheek…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected && (
          <div className={styles.selectedBadge}>
            <span className={styles.selectedBadgeTitle}>{selected.title}</span>
            <button
              className={styles.selectedBadgeClear}
              onClick={() => setSelected(null)}
              aria-label="Selectie wissen"
            >
              ✕
            </button>
          </div>
        )}
        <div className={styles.mediaList} role="listbox" aria-label="Media library">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`${styles.mediaItem} ${selected?.id === m.id ? styles.selected : ''}`}
              role="option"
              aria-selected={selected?.id === m.id}
              tabIndex={0}
              onClick={() => m.type === 'series' ? openSeries(m) : setSelected(m)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (m.type === 'series' ? openSeries(m) : setSelected(m))}
            >
              <span className={styles.mediaItemTitle}>
                {m.title}{m.year ? ` (${m.year})` : ''}
              </span>
              {m.type === 'series' && (
                <span className={styles.seriesMeta}>
                  {m.seasonCount} {m.seasonCount === 1 ? 'seizoen' : 'seizoenen'} ›
                </span>
              )}
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
