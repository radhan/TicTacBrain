import { ChevronRight, CircleCheck, Download, Flame, Play, Shuffle, Target, Trophy } from 'lucide-preact'
import { InstallBanner } from '../components/InstallBanner'
import { TimerPicker } from '../components/TimerPicker'
import { resolvePool } from '../lib/data'
import { TopicIcon } from '../lib/icons'
import { useInstall } from '../lib/install'
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
  const bestAll = save.bestAnyTimer('all')
  const run = save.latestRun()
  const runPool = run ? resolvePool(catalog, run.pool) : null
  const install = useInstall()

  return (
    <main class="screen home">
      <header class="appbar">
        <span class="brand">
          <img class="brand-logo" src={LOGO} alt="" width="34" height="34" />
          <span class="brand-name">TicTacBrain</span>
        </span>
        {install.mode === 'prompt' && install.dismissed && (
          <button type="button" class="btn btn-tonal btn-sm" onClick={install.install}>
            <Download size={16} aria-hidden="true" /> Installer
          </button>
        )}
      </header>

      <section class="intro">
        <h1>Prêt pour une série ?</h1>
        <p>Enchaîne les bonnes réponses. À la première erreur, la série repart de zéro : on apprend au passage.</p>
      </section>

      <InstallBanner />

      {run && runPool && (
        <button
          type="button"
          class="hero-action"
          onClick={() => {
            onTimer(run.timer)
            navigate(`/play/${run.pool}`)
          }}
        >
          <span class="hero-action-top">
            <span class="hero-action-label">Reprendre ta série</span>
            <span class="hero-action-play" aria-hidden="true">
              <Play size={18} fill="currentColor" />
            </span>
          </span>
          <span class="hero-action-title">{runPool.title}</span>
          <span class="hero-progress" aria-hidden="true">
            <span style={{ width: `${Math.max(3, (run.streak / runPool.count) * 100)}%` }} />
          </span>
          <span class="hero-action-meta">
            <Flame size={15} aria-hidden="true" />
            <span>
              {run.streak} / {runPool.count} bonnes réponses d'affilée
            </span>
          </span>
        </button>
      )}

      <section class="kpis" aria-label="Tes statistiques">
        <div class="kpi">
          <span class="kpi-icon kpi-flame">
            <Flame size={18} aria-hidden="true" />
          </span>
          <strong>{stats.bestEver}</strong>
          <span>Meilleure série</span>
        </div>
        <div class="kpi">
          <span class="kpi-icon kpi-ok">
            <CircleCheck size={18} aria-hidden="true" />
          </span>
          <strong>{stats.correct}</strong>
          <span>Bonnes réponses</span>
        </div>
        <div class="kpi">
          <span class="kpi-icon">
            <Target size={18} aria-hidden="true" />
          </span>
          <strong>{accuracy} %</strong>
          <span>Réussite</span>
        </div>
      </section>

      <button type="button" class={run ? 'quickplay' : 'quickplay quickplay-primary'} onClick={() => navigate('/play/all')}>
        <span class="topic-chip">
          <Shuffle size={22} aria-hidden="true" />
        </span>
        <span class="topic-body">
          <span class="topic-name">Partie rapide</span>
          <span class="topic-meta">
            <span>Tous les thèmes mélangés · {catalog.total} questions</span>
            {bestAll > 0 && (
              <span class="meta-best">
                <Trophy size={13} aria-hidden="true" />
                <span class="sr-only">Record :</span>
                <span>{bestAll}</span>
              </span>
            )}
          </span>
        </span>
        <span class="quickplay-go" aria-hidden="true">
          <Play size={18} fill="currentColor" />
        </span>
      </button>

      <TimerPicker value={timer} onChange={onTimer} />

      <h2 class="section-title">
        Thèmes <span class="count">{catalog.themes.length}</span>
      </h2>
      <div class="topic-list">
        {catalog.themes.map((theme) => {
          const best = save.bestForTheme(theme.id)
          return (
            <button key={theme.id} type="button" class="topic-row" onClick={() => navigate(`/t/${theme.id}`)}>
              <span class="topic-chip">
                <TopicIcon id={theme.id} emoji={theme.icon} />
              </span>
              <span class="topic-body">
                <span class="topic-name">{theme.name}</span>
                <span class="topic-meta">
                  {theme.count} questions · {theme.subthemes.length} sous-thèmes
                </span>
              </span>
              {best > 0 && (
                <span class="pill pill-gold">
                  <Trophy size={13} aria-hidden="true" />
                  <span class="sr-only">Record :</span> {best}
                </span>
              )}
              <ChevronRight size={20} class="chevron" aria-hidden="true" />
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
