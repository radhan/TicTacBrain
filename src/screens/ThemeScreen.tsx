import { ArrowLeft, ChevronRight, Flame, Play, Trophy } from 'lucide-preact'
import { TimerPicker } from '../components/TimerPicker'
import { poolKey } from '../lib/game'
import { TopicIcon } from '../lib/icons'
import { goBack, navigate } from '../lib/router'
import { save } from '../lib/storage'
import type { ThemeInfo, TimerSetting } from '../lib/types'

export function ThemeScreen({ theme, timer, onTimer }: {
  theme: ThemeInfo
  timer: TimerSetting
  onTimer: (t: TimerSetting) => void
}) {
  const themeKey = poolKey(theme.id)
  const bestAll = save.best(themeKey, timer)
  const themeRun = save.getRun(themeKey, timer)

  return (
    <main class="screen theme-screen">
      <header class="appbar">
        <button type="button" class="icon-btn" aria-label="Retour" onClick={() => goBack('/')}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span class="appbar-title">Thèmes</span>
      </header>

      <section class="theme-hero">
        <span class="topic-chip topic-chip-lg">
          <TopicIcon id={theme.id} emoji={theme.icon} size={28} />
        </span>
        <h1>{theme.name}</h1>
        <p>{theme.description}</p>
        <dl class="hero-stats">
          <div>
            <dt>Sous-thèmes</dt>
            <dd>{theme.subthemes.length}</dd>
          </div>
          <div>
            <dt>Questions</dt>
            <dd>{theme.count}</dd>
          </div>
          <div>
            <dt>Record</dt>
            <dd>{bestAll}</dd>
          </div>
        </dl>
        <button type="button" class="btn btn-primary btn-block" onClick={() => navigate(`/play/${theme.id}`)}>
          <Play size={18} fill="currentColor" aria-hidden="true" />
          {themeRun && themeRun.streak > 0 ? `Reprendre tout le thème (${themeRun.streak})` : 'Jouer tout le thème'}
        </button>
      </section>

      <TimerPicker value={timer} onChange={onTimer} />

      <h2 class="section-title">
        Sous-thèmes <span class="count">{theme.subthemes.length}</span>
      </h2>
      <div class="topic-list topic-list-single">
        {theme.subthemes.map((sub) => {
          const key = poolKey(theme.id, sub.id)
          const best = save.best(key, timer)
          const run = save.getRun(key, timer)
          const perfect = save.isPerfect(key)
          const mastery = Math.min(1, best / sub.count)
          return (
            <button key={sub.id} type="button" class="topic-row topic-row-sub" onClick={() => navigate(`/play/${theme.id}/${sub.id}`)}>
              <span class="topic-chip">
                <TopicIcon id={key} emoji={sub.icon} />
              </span>
              <span class="topic-body">
                <span class="topic-name">{sub.name}</span>
                {sub.description && <span class="topic-desc">{sub.description}</span>}
                <span class="topic-meta">
                  {sub.count} questions
                  {run && run.streak > 0 && (
                    <span class="meta-run">
                      <Flame size={13} aria-hidden="true" />
                      <span>en cours : {run.streak}</span>
                    </span>
                  )}
                </span>
                <span class="mastery" aria-label={`Record ${best} sur ${sub.count}`}>
                  <span class="mastery-track" aria-hidden="true">
                    <span class={perfect ? 'mastery-fill perfect' : 'mastery-fill'} style={{ width: `${mastery * 100}%` }} />
                  </span>
                  <span class="mastery-label" aria-hidden="true">
                    {perfect ? (
                      'Sans faute'
                    ) : (
                      <>
                        <Trophy size={12} />
                        <span>
                          {best}/{sub.count}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </span>
              <ChevronRight size={20} class="chevron" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </main>
  )
}
