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
    <main class="screen theme-screen" style={{ '--c': theme.color }}>
      <nav class="topbar">
        <button type="button" class="icon-btn" aria-label="Retour" onClick={() => goBack('/')}>
          ←
        </button>
        <span class="topbar-title">Thèmes</span>
      </nav>

      <section class="theme-hero">
        <span class="theme-hero-icon" aria-hidden="true">
          {theme.icon}
        </span>
        <h1>{theme.name}</h1>
        <p>{theme.description}</p>
        <div class="theme-hero-foot">
          <button type="button" class="hero-play" onClick={() => navigate(`/play/${theme.id}`)}>
            <span aria-hidden="true">▶</span> Tout le thème
            <small>{theme.count} questions</small>
          </button>
          {bestAll > 0 && (
            <span class="badge badge-light">
              <span aria-hidden="true">🏆</span>
              <span class="sr-only">Record :</span> {bestAll}
            </span>
          )}
          {save.isPerfect(poolKey(theme.id)) && <span class="badge badge-light">💯 sans faute</span>}
        </div>
      </section>

      <TimerPicker value={timer} onChange={onTimer} />

      <h2 class="section-title">
        Sous-thèmes <span>{theme.subthemes.length}</span>
      </h2>
      <div class="sub-list">
        {theme.subthemes.map((sub) => {
          const key = poolKey(theme.id, sub.id)
          const best = save.best(key, timer)
          const run = save.getRun(key, timer)
          return (
            <button key={sub.id} type="button" class="sub-row" onClick={() => navigate(`/play/${theme.id}/${sub.id}`)}>
              <span class="sub-icon" aria-hidden="true">
                {sub.icon}
              </span>
              <span class="sub-text">
                <span class="sub-name">{sub.name}</span>
                {sub.description && <span class="sub-desc">{sub.description}</span>}
                <span class="sub-meta">
                  <span>{sub.count} questions</span>
                  {save.isPerfect(key) && <span class="meta-perfect">💯 sans faute</span>}
                  {best > 0 && (
                    <span class="meta-best">
                      <span aria-hidden="true">🏆</span>
                      <span class="sr-only">Record :</span> {best}
                    </span>
                  )}
                  {run && run.streak > 0 && (
                    <span class="meta-run">
                      <span aria-hidden="true">▶</span> en cours : {run.streak}
                    </span>
                  )}
                </span>
              </span>
              <span class="chevron" aria-hidden="true">
                ›
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
