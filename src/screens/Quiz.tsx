import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Modal } from '../components/Modal'
import { Inline, Rich } from '../components/Rich'
import { loadPoolQuestions, type PoolInfo } from '../lib/data'
import { buildChoices, isMilestone, pickNext, remainingCandidates } from '../lib/game'
import { goBack } from '../lib/router'
import { save, type SavedRun } from '../lib/storage'
import type { PoolQuestion, TimerSetting } from '../lib/types'

/** `victory` : toutes les questions du mode réussies d'affilée. */
type Phase = 'question' | 'correct' | 'wrong' | 'timeout' | 'victory'

interface Turn {
  q: PoolQuestion
  choices: string[]
  /** Numéro unique : relance les animations et le chrono à chaque question. */
  n: number
  /** Position de la question dans la partie en cours (1, 2, 3…). */
  num: number
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const DIFFICULTY = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' } as const
/** Après une réponse ou une nouvelle question, les taps sont ignorés un instant (anti double-tap). */
const TAP_LOCK_MS = 400

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const inARow = (n: number) => `${n <= 1 ? 'bonne réponse' : 'bonnes réponses'} d'affilée`

export function Quiz({ pool, timer }: { pool: PoolInfo; timer: TimerSetting }) {
  const [questions, setQuestions] = useState<PoolQuestion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setQuestions(null)
    loadPoolQuestions(pool)
      .then((qs) => !cancelled && setQuestions(qs))
      .catch((e: Error) => !cancelled && setLoadError(e.message))
    return () => {
      cancelled = true
    }
  }, [pool.key])

  if (loadError) {
    return (
      <main class="screen center">
        <p>😵 {loadError}</p>
        <button type="button" class="btn btn-outline" onClick={() => goBack('/')}>
          Retour
        </button>
      </main>
    )
  }
  if (!questions) return <main class="screen center loading">Chargement des questions…</main>
  return <Run pool={pool} questions={questions} timer={timer} />
}

/** Compte à rebours circulaire (anneau qui se vide). */
function TimerRing({ remainingMs, totalMs, active }: { remainingMs: number; totalMs: number; active: boolean }) {
  const r = 17
  const circumference = 2 * Math.PI * r
  const ratio = totalMs ? remainingMs / totalMs : 0
  const urgent = active && remainingMs < 3000
  const seconds = Math.ceil(remainingMs / 1000)
  return (
    <div class={`timer-ring ${urgent ? 'urgent' : ''}`} role="timer" aria-label={`${seconds} secondes restantes`}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle class="timer-ring-track" cx="20" cy="20" r={r} />
        <circle
          class="timer-ring-fill"
          cx="20"
          cy="20"
          r={r}
          stroke-dasharray={circumference}
          stroke-dashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span aria-hidden="true">{seconds}</span>
    </div>
  )
}

/** Vérifie qu'une partie sauvegardée correspond toujours aux questions du mode. */
function restorable(run: SavedRun | null, questions: PoolQuestion[]) {
  if (!run) return null
  const byId = new Map(questions.map((q) => [q.id, q]))
  const q = byId.get(run.qId)
  if (!q || run.asked.some((id) => !byId.has(id)) || run.choices.length !== q.wrong.length + 1) return null
  if (run.streak >= questions.length) return null
  return { run, q }
}

function Run({ pool, questions, timer }: { pool: PoolInfo; questions: PoolQuestion[]; timer: TimerSetting }) {
  const total = questions.length
  const asked = useRef(new Set<string>())
  const [streak, setStreak] = useState(0)
  const [bestAtStart, setBestAtStart] = useState(() => save.best(pool.key, timer))
  const [best, setBest] = useState(bestAtStart)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [picked, setPicked] = useState<string | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [burstKey, setBurstKey] = useState(0)
  const [remainingMs, setRemainingMs] = useState(timer * 1000)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // État de jeu « vivant », mis à jour immédiatement (le rendu, lui, est asynchrone) :
  // empêche les doubles réponses, les touches perdues et les taps fantômes.
  const live = useRef({
    turn: null as Turn | null,
    phase: 'question' as Phase,
    streak: 0,
    explainOpen: false,
    deadline: null as number | null,
    lockUntil: 0,
  })
  live.current.explainOpen = explainOpen

  const locked = () => performance.now() < live.current.lockUntil
  const lock = () => {
    live.current.lockUntil = performance.now() + TAP_LOCK_MS
  }
  /** Bouton du panneau de résultat protégé contre le double-tap. */
  const guard = (fn: () => void) => () => {
    if (!locked()) fn()
  }

  const subName = useMemo(() => {
    const names = new Map<string, string>()
    for (const { theme, sub } of pool.parts) {
      names.set(`${theme.id}/${sub.id}`, pool.key === 'all' ? `${theme.icon} ${sub.name}` : `${sub.icon} ${sub.name}`)
    }
    return names
  }, [pool])

  const persistRun = useCallback(
    (runPhase: 'question' | 'correct', runPicked: string | null) => {
      const t = live.current.turn
      if (!t) return
      save.setRun({
        pool: pool.key,
        timer,
        asked: [...asked.current],
        streak: live.current.streak,
        qId: t.q.id,
        choices: t.choices,
        num: t.num,
        phase: runPhase,
        picked: runPicked,
        deadline: live.current.deadline,
        updatedAt: Date.now(),
      })
    },
    [pool.key, timer],
  )

  const nextQuestion = useCallback(() => {
    const candidates = remainingCandidates(questions, asked.current)
    if (candidates.length === 0) return
    const q = pickNext(candidates, save.get().seen, live.current.streak)
    asked.current.add(q.id)
    save.markSeen(q.id)
    const next: Turn = { q, choices: buildChoices(q), n: (live.current.turn?.n ?? 0) + 1, num: asked.current.size }
    live.current.turn = next
    live.current.phase = 'question'
    live.current.deadline = timer ? Date.now() + timer * 1000 : null
    lock()
    setTurn(next)
    setPhase('question')
    setPicked(null)
    setExplainOpen(false)
    setRemainingMs(timer * 1000)
    persistRun('question', null)
  }, [questions, timer, persistRun])

  const restart = useCallback(() => {
    save.clearRun(pool.key, timer)
    asked.current.clear()
    const b = save.best(pool.key, timer)
    setBestAtStart(b)
    setBest(b)
    setNotice(null)
    live.current.streak = 0
    setStreak(0)
    nextQuestion()
  }, [nextQuestion, pool.key, timer])

  // Première question, ou reprise de la partie en cours de ce mode.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const saved = restorable(save.getRun(pool.key, timer), questions)
    if (!saved) {
      nextQuestion()
      return
    }
    const { run, q } = saved
    asked.current = new Set(run.asked)
    const t: Turn = { q, choices: run.choices, n: 1, num: run.num }
    Object.assign(live.current, { turn: t, phase: run.phase, streak: run.streak, deadline: run.deadline })
    setTurn(t)
    setPhase(run.phase)
    setPicked(run.picked)
    setStreak(run.streak)
    if (run.streak > 0) setNotice(`▶ Reprise : ${run.streak} d'affilée`)
  }, [nextQuestion, pool.key, questions, timer])

  /** `null` = temps écoulé. */
  const answer = useCallback(
    (choice: string | null) => {
      const { turn: current, phase: currentPhase, streak: currentStreak } = live.current
      if (!current || currentPhase !== 'question' || (choice !== null && locked())) return
      const correct = choice === current.q.answer
      const newStreak = correct ? currentStreak + 1 : currentStreak
      const perfect = correct && newStreak === total
      const newPhase: Phase = perfect ? 'victory' : correct ? 'correct' : choice === null ? 'timeout' : 'wrong'
      live.current.phase = newPhase
      live.current.streak = newStreak
      lock()
      save.recordAnswer(pool.key, timer, correct, newStreak)
      if (perfect) save.recordPerfect(pool.key)
      if (newPhase === 'correct') persistRun('correct', choice)
      else save.clearRun(pool.key, timer)
      setPicked(choice)
      setPhase(newPhase)
      if (correct) {
        setStreak(newStreak)
        setBest((b) => Math.max(b, newStreak))
        if (perfect || isMilestone(newStreak)) setBurstKey((k) => k + 1)
        setNotice(!perfect && isMilestone(newStreak) ? `🔥 ${newStreak} d'affilée !` : null)
      } else {
        setNotice(null)
        navigator.vibrate?.(200)
      }
    },
    [pool.key, timer, total, persistRun],
  )

  // Chrono : échéance absolue (gardée dans la sauvegarde) — quitter l'app ou recharger
  // pour chercher la réponse ne rend pas de temps.
  useEffect(() => {
    if (!timer || !turn) return
    const tick = () => {
      if (live.current.phase !== 'question') return false
      const left = (live.current.deadline ?? 0) - Date.now()
      setRemainingMs(Math.max(0, left))
      if (left <= 0) {
        answer(null)
        return false
      }
      return true
    }
    if (!tick()) return
    const id = setInterval(() => {
      if (!tick()) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [turn, timer, answer])

  // Nouvelle question : retour en haut, focus sur le titre (annoncé par les lecteurs d'écran).
  // Après une réponse : défilement minimal pour garder la bonne réponse visible au-dessus
  // du panneau de résultat, et focus sur le bouton principal.
  useEffect(() => {
    if (!turn) return
    if (phase === 'question') {
      window.scrollTo({ top: 0 })
      if (turn.n > 1) headingRef.current?.focus({ preventScroll: true })
      return
    }
    primaryRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('.feedback')
      const good = document.querySelector<HTMLElement>('.answer.is-correct')
      if (!panel || !good) return
      const r = good.getBoundingClientRect()
      const limit = window.innerHeight - panel.offsetHeight - 12
      const behavior = reducedMotion() ? 'auto' : 'smooth'
      if (r.bottom > limit) window.scrollBy({ top: Math.min(r.bottom - limit, r.top - 12), behavior })
      else if (r.top < 12) window.scrollBy({ top: r.top - 12, behavior })
    })
  }, [phase, turn])

  // Notifications éphémères (paliers, reprise).
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2200)
    return () => clearTimeout(t)
  }, [notice])

  // Clavier : 1-6 / A-F pour répondre, Entrée pour continuer, E pour l'explication.
  // Seulement hors des autres contrôles (taper « b » sur « Quitter » ne doit pas répondre).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { turn: current, phase: currentPhase, explainOpen: modalOpen } = live.current
      if (modalOpen || e.ctrlKey || e.metaKey || e.altKey || !current) return
      const target = e.target as HTMLElement
      const neutral = target === document.body || !!target.closest('.answers, .feedback, .q-count')
      const key = e.key.toUpperCase()
      if (currentPhase === 'question') {
        if (!neutral) return
        const index = /^[1-6]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key)
        if (index >= 0 && index < current.choices.length) answer(current.choices[index])
        return
      }
      if (key === 'E' && neutral) setExplainOpen(true)
      else if (key === 'ENTER' || key === ' ') {
        // Sur un bouton, le clic natif s'en charge déjà (sinon on sauterait une question).
        if (target.closest('button, a') || locked()) return
        e.preventDefault()
        if (currentPhase === 'correct') nextQuestion()
        else restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, nextQuestion, restart])

  if (!turn) return <main class="screen center loading">Mélange des questions…</main>

  const { q, choices } = turn
  const ended = phase === 'wrong' || phase === 'timeout' || phase === 'victory'
  const newRecord = ended && streak > bestAtStart
  const choiceState = (c: string) => {
    if (phase === 'question') return ''
    if (c === q.answer) return 'is-correct'
    if (c === picked) return 'is-wrong'
    return 'is-dim'
  }

  const result =
    phase === 'victory'
      ? { tone: 'win', title: '🎉 Sans faute !', value: `${streak}/${total}`, sub: 'Toutes les questions du mode, sans une seule erreur.' }
      : {
          tone: newRecord ? 'record' : 'lose',
          title: phase === 'timeout' ? '⏰ Temps écoulé' : '💥 Raté !',
          value: String(streak),
          sub: newRecord
            ? bestAtStart > 0
              ? `🏆 Nouveau record ! (ancien : ${bestAtStart})`
              : '🏆 Premier record !'
            : `${inARow(streak)}${bestAtStart > 0 ? ` · record ${bestAtStart}` : ''}`,
        }

  const closeExplain = () => {
    setExplainOpen(false)
    requestAnimationFrame(() => primaryRef.current?.focus({ preventScroll: true }))
  }

  return (
    <main class={`screen quiz phase-${phase}`} style={{ '--accent': pool.color }}>
      <div class="deco" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <nav class="quiz-top">
        <button type="button" class="icon-btn" aria-label="Quitter (la série est gardée pour plus tard)" onClick={() => goBack('/')}>
          ✕
        </button>
        <div
          class="progress"
          role="progressbar"
          aria-label="Série en cours"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={streak}
          aria-valuetext={`${streak} sur ${total}`}
        >
          <div class="progress-fill" style={{ width: streak ? `max(12px, ${(streak / total) * 100}%)` : '0' }} />
        </div>
        {timer > 0 && <TimerRing remainingMs={remainingMs} totalMs={timer * 1000} active={phase === 'question'} />}
      </nav>

      <div class="q-head">
        <h1 class="q-count" ref={headingRef} tabIndex={-1}>
          Question <strong>{turn.num}</strong>
          <span>
            <span class="sr-only"> sur </span>
            <span aria-hidden="true">/</span>
            {total}
          </span>
        </h1>
        <span class="q-scores">
          <span key={streak} class={`streak-chip ${streak > 0 ? 'bump' : ''}`}>
            <span aria-hidden="true">🔥</span>
            <span class="sr-only">Série :</span> {streak}
          </span>
          <span class="best-chip">
            <span aria-hidden="true">🏆</span>
            <span class="sr-only">Record :</span> {best}
          </span>
        </span>
      </div>

      <div class="q-meta">
        <span class="chip">{pool.mixed ? subName.get(`${q.themeId}/${q.subthemeId}`) : `${pool.icon} ${pool.title}`}</span>
        <span class={`chip difficulty d${q.difficulty}`}>{DIFFICULTY[q.difficulty]}</span>
      </div>

      <Rich key={turn.n} text={q.question} class="q-text" />

      <div class="answers" role="group" aria-label="Réponses">
        {choices.map((c) => {
          const state = choiceState(c)
          return (
            <button
              key={`${turn.n}-${c}`}
              type="button"
              class={`answer ${state}`}
              disabled={phase !== 'question'}
              onClick={() => answer(c)}
            >
              <span class="answer-text">
                <Inline text={c} />
                {state === 'is-correct' && <span class="sr-only"> — bonne réponse</span>}
                {state === 'is-wrong' && <span class="sr-only"> — ta réponse, fausse</span>}
              </span>
              <span class="radio" aria-hidden="true">
                {state === 'is-correct' ? '✓' : state === 'is-wrong' ? '✕' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {phase !== 'question' && (
        <section class="feedback" aria-live="assertive">
          {phase === 'correct' ? (
            <p class="verdict">✓ Bonne réponse !</p>
          ) : (
            <div class={`result-card ${result.tone}`}>
              <span class="result-title">{result.title}</span>
              <strong class="result-value">{result.value}</strong>
              <span class="result-sub">
                {result.sub}
                {phase !== 'victory' && <span class="sr-only">. La bonne réponse était : {q.answer.replace(/`/g, '')}</span>}
              </span>
            </div>
          )}
          <div class="actions">
            <button type="button" class="btn btn-soft" onClick={guard(() => setExplainOpen(true))}>
              <span aria-hidden="true">💡</span> Comprendre
            </button>
            {phase === 'correct' ? (
              <button ref={primaryRef} type="button" class="btn btn-primary" onClick={guard(nextQuestion)}>
                Suivant <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button ref={primaryRef} type="button" class="btn btn-success" onClick={guard(restart)}>
                <span aria-hidden="true">↻</span> Rejouer
              </button>
            )}
            {ended && (
              <button type="button" class="btn btn-outline btn-wide" onClick={guard(() => goBack('/'))}>
                Changer de thème
              </button>
            )}
          </div>
        </section>
      )}

      {notice && (
        <div class="notice" role="status">
          {notice}
        </div>
      )}

      {burstKey > 0 && <div key={burstKey} class="burst" aria-hidden="true" />}

      <Modal open={explainOpen} onClose={closeExplain} title="💡 Explication">
        <Rich text={q.question} class="explain-question" />
        <div class="explain-answer">
          <span>Bonne réponse</span>
          <strong>
            <Inline text={q.answer} />
          </strong>
        </div>
        {picked && picked !== q.answer && (
          <p class="explain-picked">
            Ta réponse : <Inline text={picked} />
          </p>
        )}
        <Rich text={q.explanation} class="explain-text" />
        {q.source && (
          <a class="explain-source" href={q.source} target="_blank" rel="noreferrer">
            <span aria-hidden="true">📚</span> Pour aller plus loin
          </a>
        )}
        <button
          type="button"
          class="btn btn-primary modal-cta"
          onClick={() => {
            if (phase === 'correct') {
              setExplainOpen(false)
              nextQuestion()
            } else closeExplain()
          }}
        >
          {phase === 'correct' ? 'Question suivante →' : 'Fermer'}
        </button>
      </Modal>
    </main>
  )
}
