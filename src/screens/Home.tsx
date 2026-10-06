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
          <img class="brand-logo" src={LOGO} alt="" width="32" height="32" />
          <span class="brand-name">TicTacBrain</span>
        </span>
        {install.mode && install.dismissed && (
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onClick={install.mode === 'prompt' ? install.install : install.reopen}
          >
            <Download size={16} aria-hidden="true" />
            <span>Installer</span>
          </button>
        )}
      </header>

      <section class="intro">
        <h1>Tic, tac… ça rentre ou ça fait boum.</h1>
        <p>Bonne réponse : la mèche tient. Une erreur : BOUM, retour à zéro. On recommence jusqu'à ce que ça rentre. C'est du bourrage de crâne, mais c'est pour ton bien.</p>
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
            <span class="hero-action-label">La mèche brûle encore</span>
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
              {run.streak} / {runPool.count} sans exploser
            </span>
          </span>
        </button>
      )}

      {stats.answered > 0 && (
        <section class="kpis" aria-label="Tes statistiques">
          <div class="kpi">
            <Flame size={16} aria-hidden="true" class="kpi-icon" />
            <strong>{stats.bestEver}</strong>
            <span>Mèche record</span>
          </div>
          <div class="kpi">
            <CircleCheck size={16} aria-hidden="true" class="kpi-icon" />
            <strong>{stats.correct}</strong>
            <span>Neurones gavés</span>
          </div>
          <div class="kpi">
            <Target size={16} aria-hidden="true" class="kpi-icon" />
            <strong>{accuracy} %</strong>
            <span>Taux de survie</span>
          </div>
        </section>
      )}

      <section class="home-block" aria-labelledby="h-play">
        <h2 class="section-title" id="h-play">
          Allume la mèche
        </h2>
        <button type="button" class={run ? 'quickplay' : 'quickplay quickplay-primary'} onClick={() => navigate('/play/all')}>
          <span class="topic-chip">
            <Shuffle size={22} aria-hidden="true" />
          </span>
          <span class="topic-body">
            <span class="topic-name">Le grand mélange</span>
            <span class="topic-meta">
              <span>{catalog.total} questions · tous thèmes, sans pitié</span>
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
      </section>

      <section class="home-block" aria-labelledby="h-themes">
        <h2 class="section-title" id="h-themes">
          Matières à bourrer <span class="count">{catalog.themes.length}</span>
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
                    <span>
                      {theme.subthemes.length} sous-thèmes · {theme.count} questions
                    </span>
                  </span>
                </span>
                {best > 0 && (
                  <span class="pill">
                    <Trophy size={13} aria-hidden="true" />
                    <span class="sr-only">Record :</span>
                    <span>{best}</span>
                  </span>
                )}
                <ChevronRight size={20} class="chevron" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <footer class="footer">
        Une question qui te démange ? Ajoute-la à l'arsenal, c'est un simple fichier JSON :{' '}
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
          contribuer sur GitHub
        </a>
      </footer>
    </main>
  )
}
