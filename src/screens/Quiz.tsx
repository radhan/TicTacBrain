import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Modal } from '../components/Modal'
import { Inline, Rich } from '../components/Rich'
import { loadPoolQuestions, type PoolInfo } from '../lib/data'
import { buildChoices, isMilestone, pickNext, remainingCandidates } from '../lib/game'
import { goBack } from '../lib/router'
import { save } from '../lib/storage'
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
  return (
    <div class={`timer-ring ${urgent ? 'urgent' : ''}`} role="timer" aria-label={`${Math.ceil(remainingMs / 1000)} secondes restantes`}>
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
      <span>{Math.ceil(remainingMs / 1000)}</span>
    </div>
  )
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
  const primaryRef = useRef<HTMLButtonElement>(null)

  // État de jeu « vivant », mis à jour immédiatement (le rendu, lui, est asynchrone) :
  // empêche les doubles réponses (double tap, clic pile au timeout) et les touches perdues.
  const live = useRef({ turn: null as Turn | null, phase: 'question' as Phase, streak: 0, explainOpen: false })
  live.current.explainOpen = explainOpen

  const subName = useMemo(() => {
    const names = new Map<string, string>()
    for (const { theme, sub } of pool.parts) {
      names.set(`${theme.id}/${sub.id}`, pool.key === 'all' ? `${theme.icon} ${sub.name}` : `${sub.icon} ${sub.name}`)
    }
    return names
  }, [pool])

  const nextQuestion = useCallback(() => {
    const candidates = remainingCandidates(questions, asked.current)
    if (candidates.length === 0) return
    const q = pickNext(candidates, save.get().seen, live.current.streak)
    asked.current.add(q.id)
    save.markSeen(q.id)
    const next: Turn = { q, choices: buildChoices(q), n: (live.current.turn?.n ?? 0) + 1, num: asked.current.size }
    live.current.turn = next
    live.current.phase = 'question'
    setTurn(next)
    setPhase('question')
    setPicked(null)
    setExplainOpen(false)
  }, [questions])

  const restart = useCallback(() => {
    asked.current.clear()
    const b = save.best(pool.key, timer)
    setBestAtStart(b)
    setBest(b)
    live.current.streak = 0
    setStreak(0)
    nextQuestion()
  }, [nextQuestion, pool.key, timer])

  // Première question.
  useEffect(() => {
    nextQuestion()
  }, [nextQuestion])

  /** `null` = temps écoulé. */
  const answer = useCallback(
    (choice: string | null) => {
      const { turn: current, phase: currentPhase, streak: currentStreak } = live.current
      if (!current || currentPhase !== 'question') return
      const correct = choice === current.q.answer
      const newStreak = correct ? currentStreak + 1 : currentStreak
      const perfect = correct && newStreak === total
      const newPhase: Phase = perfect ? 'victory' : correct ? 'correct' : choice === null ? 'timeout' : 'wrong'
      live.current.phase = newPhase
      live.current.streak = newStreak
      save.recordAnswer(pool.key, timer, correct, newStreak)
      if (perfect) save.recordPerfect(pool.key)
      setPicked(choice)
      setPhase(newPhase)
      if (correct) {
        setStreak(newStreak)
        setBest((b) => Math.max(b, newStreak))
        if (perfect || isMilestone(newStreak)) setBurstKey((k) => k + 1)
        if (!perfect && isMilestone(newStreak)) setNotice(`🔥 ${newStreak} d'affilée !`)
      } else {
        navigator.vibrate?.(200)
      }
    },
    [pool.key, timer, total],
  )

  // Chrono : une échéance absolue, donc quitter l'app pour chercher la réponse ne fige pas le temps.
  const [remainingMs, setRemainingMs] = useState(timer * 1000)
  useEffect(() => {
    if (!timer || !turn) return
    const deadline = Date.now() + timer * 1000
    setRemainingMs(timer * 1000)
    const id = setInterval(() => {
      if (live.current.phase !== 'question') return clearInterval(id)
      const left = deadline - Date.now()
      setRemainingMs(Math.max(0, left))
      if (left <= 0) {
        clearInterval(id)
        answer(null)
      }
    }, 100)
    return () => clearInterval(id)
  }, [turn, timer, answer])

  // Après une réponse : on descend pour voir la correction et le résultat, et le bouton
  // principal (Suivant / Rejouer) prend le focus. Nouvelle question : retour en haut.
  useEffect(() => {
    if (phase === 'question') {
      window.scrollTo({ top: 0 })
      return
    }
    primaryRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }, [phase, turn])

  // Notifications éphémères (paliers de série).
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2200)
    return () => clearTimeout(t)
  }, [notice])

  // Clavier : 1-6 / A-F pour répondre, Entrée pour continuer, E pour l'explication.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { turn: current, phase: currentPhase, explainOpen: modalOpen } = live.current
      if (modalOpen || e.ctrlKey || e.metaKey || e.altKey || !current) return
      const key = e.key.toUpperCase()
      if (currentPhase === 'question') {
        const index = /^[1-6]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key)
        if (index >= 0 && index < current.choices.length) answer(current.choices[index])
        return
      }
      if (key === 'E') setExplainOpen(true)
      else if (key === 'ENTER' || key === ' ') {
        // Sur un bouton, le clic natif s'en charge déjà (sinon on sauterait une question).
        if ((e.target as HTMLElement).closest('button, a')) return
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
  const over = phase === 'wrong' || phase === 'timeout'
  const ended = over || phase === 'victory'
  const newRecord = ended && streak > bestAtStart
  const choiceState = (c: string) => {
    if (phase === 'question') return ''
    if (c === q.answer) return 'is-correct'
    if (c === picked) return 'is-wrong'
    return 'is-dim'
  }

  const result =
    phase === 'victory'
      ? { tone: 'win', title: '🎉 Sans faute !', value: `${streak}/${total}`, sub: 'Toutes les questions de ce mode, sans une seule erreur.' }
      : newRecord
        ? { tone: 'win', title: '🏆 Nouveau record !', value: String(streak), sub: `bonnes réponses d'affilée sur ${total}` }
        : {
            tone: 'lose',
            title: phase === 'timeout' ? '⏰ Temps écoulé' : '💥 Raté !',
            value: String(streak),
            sub: bestAtStart > 0 ? `bonnes réponses d'affilée · record ${bestAtStart}` : "bonnes réponses d'affilée",
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
        <button type="button" class="icon-btn" aria-label="Quitter la partie" onClick={() => goBack('/')}>
          ✕
        </button>
        <div
          class="progress"
          role="progressbar"
          aria-label="Série en cours"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={streak}
        >
          <div class="progress-fill" style={{ width: `${(streak / total) * 100}%` }} />
        </div>
        {timer > 0 && <TimerRing remainingMs={remainingMs} totalMs={timer * 1000} active={phase === 'question'} />}
      </nav>

      <div class="q-head">
        <p class="q-count">
          Question <strong>{turn.num}</strong>
          <span>/{total}</span>
        </p>
        <span class="q-scores">
          <span key={streak} class={`streak-chip ${streak > 0 ? 'bump' : ''}`} aria-label={`Série actuelle : ${streak}`}>
            🔥 {streak}
          </span>
          <span class="best-chip" aria-label={`Record : ${best}`}>
            🏆 {best}
          </span>
        </span>
      </div>

      <div class="q-meta">
        <span class="chip">{pool.mixed ? subName.get(`${q.themeId}/${q.subthemeId}`) : `${pool.icon} ${pool.title}`}</span>
        <span class={`chip difficulty d${q.difficulty}`}>{DIFFICULTY[q.difficulty]}</span>
      </div>

      <hr class="divider" />

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
            <>
              <p class="verdict">✓ Bonne réponse !</p>
              <div class="actions">
                <button type="button" class="btn btn-soft" onClick={() => setExplainOpen(true)}>
                  💡 Comprendre
                </button>
                <button ref={primaryRef} type="button" class="btn btn-primary" onClick={nextQuestion}>
                  Suivant →
                </button>
              </div>
            </>
          ) : (
            <>
              <div class={`result-card ${result.tone}`}>
                <span class="result-title">{result.title}</span>
                <strong class="result-value">{result.value}</strong>
                <span class="result-sub">{result.sub}</span>
              </div>
              <div class="actions">
                <button type="button" class="btn btn-soft" onClick={() => setExplainOpen(true)}>
                  💡 Comprendre
                </button>
                <button ref={primaryRef} type="button" class="btn btn-success" onClick={restart}>
                  ↻ Rejouer
                </button>
                <button type="button" class="btn btn-outline btn-wide" onClick={() => goBack('/')}>
                  Changer de thème
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {notice && (
        <div class="notice" role="status">
          {notice}
        </div>
      )}

      {burstKey > 0 && <div key={burstKey} class="burst" aria-hidden="true" />}

      <Modal open={explainOpen} onClose={() => setExplainOpen(false)} title="💡 Explication">
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
            📚 Pour aller plus loin
          </a>
        )}
      </Modal>
    </main>
  )
}
