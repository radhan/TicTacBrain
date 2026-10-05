import { TimerPicker } from '../components/TimerPicker'
import { poolKey } from '../lib/game'
import { goBack, navigate } from '../lib/router'
import { save } from '../lib/storage'
import type { ThemeInfo, TimerSetting } from '../lib/types'

export function ThemeScreen({ theme, timer, onTimer }: {
  theme: ThemeInfo
  timer: TimerSetting
  onTimer: (t: TimerSetting) => void
}) {
  const bestAll = save.best(poolKey(theme.id), timer)

  return (
    <main class="screen" style={{ '--accent': theme.color }}>
      <nav class="topbar">
        <button type="button" class="icon-btn" aria-label="Retour" onClick={() => goBack('/')}>
          ←
        </button>
      </nav>

      <header class="theme-header">
        <span class="theme-header-icon" aria-hidden="true">{theme.icon}</span>
        <div>
          <h1>{theme.name}</h1>
          <p>{theme.description}</p>
        </div>
      </header>

      <TimerPicker value={timer} onChange={onTimer} />

      <button type="button" class="card card-wide all-theme" onClick={() => navigate(`/play/${theme.id}`)}>
        <span class="card-icon" aria-hidden="true">🔥</span>
        <span class="card-text">
          <span class="card-title">Tout le thème</span>
          <span class="card-desc">
            Les {theme.count} questions de tous les sous-thèmes mélangées. Plus large, donc plus dur.
          </span>
        </span>
        {bestAll > 0 && <span class="badge">🏆 {bestAll}</span>}
      </button>

      <h2 class="section-title">Sous-thèmes</h2>
      <div class="list">
        {theme.subthemes.map((sub) => {
          const best = save.best(poolKey(theme.id, sub.id), timer)
          return (
            <button
              key={sub.id}
              type="button"
              class="card card-row"
              onClick={() => navigate(`/play/${theme.id}/${sub.id}`)}
            >
              <span class="card-icon" aria-hidden="true">{sub.icon}</span>
              <span class="card-text">
                <span class="card-title">{sub.name}</span>
                {sub.description && <span class="card-desc">{sub.description}</span>}
              </span>
              <span class="card-side">
                <span class="count">{sub.count} Q</span>
                {best > 0 && <span class="badge">🏆 {best}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
