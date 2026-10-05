import { TimerPicker } from '../components/TimerPicker'
import { navigate } from '../lib/router'
import { save } from '../lib/storage'
import type { Catalog, TimerSetting } from '../lib/types'

const REPO_URL = 'https://github.com/radhan/TicTacBrain'

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
      <header class="hero">
        <h1 class="logo">
          <span class="logo-mark" aria-hidden="true">🧠</span>
          <span class="logo-text">TicTacBrain</span>
        </h1>
        <p class="tagline">Enchaîne les bonnes réponses. Une seule erreur et ta série retombe à zéro.</p>
      </header>

      {stats.answered > 0 && (
        <section class="stats" aria-label="Tes statistiques">
          <div class="stat">
            <strong>🏆 {stats.bestEver}</strong>
            <span>meilleure série</span>
          </div>
          <div class="stat">
            <strong>✅ {stats.correct}</strong>
            <span>bonnes réponses</span>
          </div>
          <div class="stat">
            <strong>🎯 {accuracy} %</strong>
            <span>de réussite</span>
          </div>
        </section>
      )}

      <TimerPicker value={timer} onChange={onTimer} />

      <button type="button" class="card card-wide mix" style={{ '--accent': '#a855f7' }} onClick={() => navigate('/play/all')}>
        <span class="card-icon" aria-hidden="true">🎲</span>
        <span class="card-text">
          <span class="card-title">Tout mélanger</span>
          <span class="card-desc">Tous les thèmes, {catalog.total} questions. Le mode ultime.</span>
        </span>
        {bestAll > 0 && <span class="badge">🏆 {bestAll}</span>}
      </button>

      <h2 class="section-title">Thèmes</h2>
      <div class="grid">
        {catalog.themes.map((theme) => {
          const best = save.bestForTheme(theme.id)
          return (
            <button
              key={theme.id}
              type="button"
              class="card theme-card"
              style={{ '--accent': theme.color }}
              onClick={() => navigate(`/t/${theme.id}`)}
            >
              <span class="card-icon" aria-hidden="true">{theme.icon}</span>
              <span class="card-title">{theme.name}</span>
              <span class="card-desc">{theme.description}</span>
              <span class="card-meta">
                {theme.count} questions · {theme.subthemes.length} sous-thèmes
                {best > 0 && <span class="badge">🏆 {best}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <footer class="footer">
        <p>
          Une question à proposer ? Tout se passe dans un simple fichier JSON :{' '}
          <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
            contribuer sur GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
