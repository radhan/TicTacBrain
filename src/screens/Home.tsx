import { TimerPicker } from '../components/TimerPicker'
import { navigate } from '../lib/router'
import { save } from '../lib/storage'
import type { Catalog, TimerSetting } from '../lib/types'

const REPO_URL = 'https://github.com/radhan/TicTacBrain'
const LOGO = `${import.meta.env.BASE_URL}favicon.svg`

export function Home({ catalog, timer, onTimer }: {
  catalog: Catalog
  timer: TimerSetting
  onTimer: (t: TimerSetting) => void
}) {
  const { stats } = save.get()
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0
  const bestAll = save.best('all', timer)

  return (
    <main class="screen home">
      <header class="brand">
        <img class="brand-mark" src={LOGO} alt="" width="44" height="44" />
        <span class="brand-name">
          TicTac<b>Brain</b>
        </span>
      </header>

      <section class="hero-card">
        <div class="hero-text">
          {stats.answered > 0 ? (
            <>
              <span class="hero-label">Meilleure série</span>
              <strong class="hero-value">{stats.bestEver}</strong>
              <span class="hero-stats">
                <span>
                  <b>{stats.correct}</b> bonnes réponses
                </span>
                <span>
                  <b>{accuracy} %</b> de réussite
                </span>
              </span>
            </>
          ) : (
            <>
              <span class="hero-label">Prêt ?</span>
              <strong class="hero-title">Une erreur, et ta série retombe à zéro.</strong>
              <span class="hero-sub">Enchaîne les questions, apprends avec chaque explication.</span>
            </>
          )}
        </div>
        <span class="hero-art" aria-hidden="true">
          🔥
        </span>
      </section>

      <TimerPicker value={timer} onChange={onTimer} />

      <button type="button" class="play-all" onClick={() => navigate('/play/all')}>
        <span class="play-all-text">
          <span class="play-all-title">Tout mélanger</span>
          <span class="play-all-sub">
            {catalog.total} questions · tous les thèmes
            {bestAll > 0 && <span class="badge badge-light">🏆 {bestAll}</span>}
          </span>
        </span>
        <span class="play-btn" aria-hidden="true">
          ▶
        </span>
      </button>

      <h2 class="section-title">Thèmes</h2>
      <div class="theme-grid">
        {catalog.themes.map((theme) => {
          const best = save.bestForTheme(theme.id)
          return (
            <button
              key={theme.id}
              type="button"
              class="theme-tile"
              style={{ '--c': theme.color }}
              onClick={() => navigate(`/t/${theme.id}`)}
            >
              <span class="tile-icon" aria-hidden="true">
                {theme.icon}
              </span>
              {best > 0 && <span class="tile-best">🏆 {best}</span>}
              <span class="tile-name">{theme.name}</span>
              <span class="tile-meta">{theme.count} questions</span>
            </button>
          )
        })}
      </div>

      <footer class="footer">
        Une question à proposer ? Tout se passe dans un simple fichier JSON :{' '}
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
          contribuer sur GitHub
        </a>
      </footer>
    </main>
  )
}
