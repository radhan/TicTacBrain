import { ArrowLeft, ChevronRight, Flame, Layers, Trophy } from 'lucide-preact'
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
  const themeBest = save.bestAnyTimer(themeKey)
  const themeRun = save.getRunAny(themeKey)

  /** Lance un mode ; s'il y a une série en cours, on la reprend avec son propre chrono. */
  const play = (key: string, path: string) => {
    const run = save.getRunAny(key)
    if (run) onTimer(run.timer)
    navigate(path)
  }

  return (
    <main class="screen theme-screen">
      <header class="appbar">
        <button type="button" class="icon-btn" aria-label="Retour à l'accueil" onClick={() => goBack('/')}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      </header>

      <section class="theme-hero">
        <div class="theme-hero-head">
          <span class="topic-chip topic-chip-lg">
            <TopicIcon id={theme.id} emoji={theme.icon} size={26} />
          </span>
          <div>
            <h1>{theme.name}</h1>
            <p class="theme-hero-meta">
              {theme.subthemes.length} sous-thèmes · {theme.count} questions
            </p>
          </div>
        </div>
        <p class="theme-hero-desc">{theme.description}</p>
      </section>

      <section class="home-block" aria-labelledby="h-subs">
        <h2 class="section-title" id="h-subs">
          Sous-thèmes <span class="count">{theme.subthemes.length}</span>
        </h2>
        <div class="topic-list topic-list-single">
          {theme.subthemes.map((sub) => {
            const key = poolKey(theme.id, sub.id)
            const best = save.bestAnyTimer(key)
            const run = save.getRunAny(key)
            const perfect = save.isPerfect(key)
            const played = best > 0 || perfect
            const mastery = perfect ? 1 : Math.min(1, best / sub.count)
            return (
              <button
                key={sub.id}
                type="button"
                class="topic-row topic-row-sub"
                onClick={() => play(key, `/play/${theme.id}/${sub.id}`)}
              >
                <span class="topic-chip">
                  <TopicIcon id={key} emoji={sub.icon} />
                </span>
                <span class="topic-body">
                  <span class="topic-name">{sub.name}</span>
                  {sub.description && <span class="topic-desc">{sub.description}</span>}
                  <span class="topic-meta">
                    <span>{sub.count} questions</span>
                    {run && (
                      <span class="meta-run">
                        <Flame size={13} aria-hidden="true" />
                        <span>En cours : {run.streak}</span>
                      </span>
                    )}
                  </span>
                  {played && (
                    <span class="mastery" aria-label={perfect ? 'Désamorcé : tout bon sans une erreur' : `Record ${best} sur ${sub.count}`}>
                      <span class="mastery-track" aria-hidden="true">
                        <span class={perfect ? 'mastery-fill perfect' : 'mastery-fill'} style={{ width: `${mastery * 100}%` }} />
                      </span>
                      <span class="mastery-label" aria-hidden="true">
                        {perfect ? (
                          <span>Désamorcé</span>
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
                  )}
                </span>
                <ChevronRight size={20} class="chevron" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section class="home-block" aria-labelledby="h-all">
        <h2 class="section-title" id="h-all">
          Gros calibre
        </h2>
        <button type="button" class="topic-row topic-row-all" onClick={() => play(themeKey, `/play/${theme.id}`)}>
          <span class="topic-chip">
            <Layers size={22} aria-hidden="true" />
          </span>
          <span class="topic-body">
            <span class="topic-name">{themeRun ? 'Reprendre tout le thème' : 'Tout le thème d\'un coup'}</span>
            <span class="topic-meta">
              <span>
                {themeRun ? `La mèche brûle encore : ${themeRun.streak} d'affilée` : `Les ${theme.count} questions en vrac`}
              </span>
              {themeBest > 0 && (
                <span class="meta-best">
                  <Trophy size={13} aria-hidden="true" />
                  <span class="sr-only">Record :</span>
                  <span>{themeBest}</span>
                </span>
              )}
            </span>
          </span>
          <ChevronRight size={20} class="chevron" aria-hidden="true" />
        </button>
      </section>

      <TimerPicker value={timer} onChange={onTimer} />
    </main>
  )
}
