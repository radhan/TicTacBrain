import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Modal } from '../components/Modal'
import { Inline, Rich } from '../components/Rich'
import { timerLabel } from '../components/TimerPicker'
import { loadPoolQuestions, type PoolInfo } from '../lib/data'
import { buildChoices, isMilestone, milestoneProgress, pickNext, remainingCandidates } from '../lib/game'
import { goBack } from '../lib/router'
import { save } from '../lib/storage'
import type { PoolQuestion, TimerSetting } from '../lib/types'

type Phase = 'question' | 'correct' | 'wrong' | 'timeout'

interface Turn {
  q: PoolQuestion
  choices: string[]
  /** Numéro unique : relance les animations et le chrono à chaque question. */
  n: number
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
        <button type="button" class="btn" onClick={() => goBack('/')}>
          Retour
        </button>
      </main>
    )
  }
  if (!questions) return <main class="screen center loading">Chargement des questions…</main>
  return <Run pool={pool} questions={questions} timer={timer} />
}

function Run({ pool, questions, timer }: { pool: PoolInfo; questions: PoolQuestion[]; timer: TimerSetting }) {
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
    const { candidates, reshuffled } = remainingCandidates(questions, asked.current, live.current.turn?.q.id)
    if (reshuffled) {
      asked.current.clear()
      setNotice('🤯 Tu as vu toutes les questions de ce mode ! On remélange…')
    }
    const q = pickNext(candidates, save.get().seen, live.current.streak)
    asked.current.add(q.id)
    save.markSeen(q.id)
    const next: Turn = { q, choices: buildChoices(q), n: (live.current.turn?.n ?? 0) + 1 }
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
      const newPhase: Phase = correct ? 'correct' : choice === null ? 'timeout' : 'wrong'
      live.current.phase = newPhase
      live.current.streak = newStreak
      save.recordAnswer(pool.key, timer, correct, newStreak)
      setPicked(choice)
      setPhase(newPhase)
      if (correct) {
        setStreak(newStreak)
        setBest((b) => Math.max(b, newStreak))
        if (isMilestone(newStreak)) {
          setNotice(`🔥 Série de ${newStreak} !`)
          setBurstKey((k) => k + 1)
        }
      } else {
        navigator.vibrate?.(200)
      }
    },
    [pool.key, timer],
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

  // Après une réponse, le bouton principal (Suivant / Rejouer) prend le focus.
  useEffect(() => {
    if (phase !== 'question') primaryRef.current?.focus({ preventScroll: true })
  }, [phase])

  // Notifications éphémères (palier de série, paquet épuisé).
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
  const newRecord = over && streak > bestAtStart
  const milestone = milestoneProgress(streak)
  const choiceState = (c: string) => {
    if (phase === 'question') return ''
    if (c === q.answer) return 'is-correct'
    if (c === picked) return 'is-wrong'
    return 'is-dim'
  }

  return (
    <main class={`screen quiz phase-${phase}`} style={{ '--accent': pool.color }}>
      <nav class="topbar">
        <button type="button" class="icon-btn" aria-label="Quitter la partie" onClick={() => goBack('/')}>
          ✕
        </button>
        <span class="topbar-title">
          {pool.icon} {pool.title}
          {timer > 0 && <span class="timer-chip">⏱️ {timerLabel(timer)}</span>}
        </span>
        <span class="scores">
          <span key={streak} class={`streak ${streak > 0 ? 'bump' : ''}`} aria-label={`Série actuelle : ${streak}`}>
            <span class="flame" aria-hidden="true">🔥</span> {streak}
            <span class="next" aria-hidden="true">/{milestone.target}</span>
          </span>
          <span class="best" aria-label={`Record : ${best}`}>
            🏆 {best}
          </span>
        </span>
      </nav>

      <div class="milestone-bar" aria-hidden="true">
        <div class="milestone-fill" style={{ width: `${Math.round(milestone.fraction * 100)}%` }} />
      </div>

      {burstKey > 0 && <div key={burstKey} class="burst" aria-hidden="true" />}

      {timer > 0 && (
        <div class="timer-bar" aria-hidden="true">
          <div
            class={`timer-fill ${remainingMs < 3000 && phase === 'question' ? 'urgent' : ''}`}
            style={{ width: `${(remainingMs / (timer * 1000)) * 100}%` }}
          />
        </div>
      )}

      <article key={turn.n} class="question-card">
        <div class="question-meta">
          {pool.mixed && <span class="chip">{subName.get(`${q.themeId}/${q.subthemeId}`)}</span>}
          <span class={`chip difficulty d${q.difficulty}`}>{DIFFICULTY[q.difficulty]}</span>
          {timer > 0 && phase === 'question' && <span class="chip countdown">{Math.ceil(remainingMs / 1000)} s</span>}
        </div>
        <Rich text={q.question} class="question-text" />
      </article>

      <div class="choices" role="group" aria-label="Réponses">
        {choices.map((c, i) => (
          <button
            key={`${turn.n}-${c}`}
            type="button"
            class={`choice ${choiceState(c)}`}
            disabled={phase !== 'question'}
            onClick={() => answer(c)}
          >
            <span class="choice-letter">{LETTERS[i]}</span>
            <span class="choice-text">
              <Inline text={c} />
            </span>
          </button>
        ))}
      </div>

      {phase !== 'question' && (
        <section class={`feedback ${over ? 'feedback-over' : 'feedback-ok'}`} aria-live="assertive">
          {phase === 'correct' && <p class="feedback-title">✅ Bonne réponse !</p>}
          {over && (
            <>
              <p class="feedback-title">{phase === 'timeout' ? '⏰ Temps écoulé !' : '💥 Raté !'}</p>
              <p class="feedback-sub">
                {newRecord ? (
                  <strong class="record">🏆 Nouveau record : {streak} !</strong>
                ) : (
                  <>
                    Série terminée à <strong>{streak}</strong>
                    {bestAtStart > 0 && <> · record {bestAtStart}</>}
                  </>
                )}
              </p>
            </>
          )}
          <div class="feedback-actions">
            <button type="button" class="btn btn-explain" onClick={() => setExplainOpen(true)}>
              💡 Comprendre
            </button>
            {phase === 'correct' ? (
              <button ref={primaryRef} type="button" class="btn btn-primary" onClick={nextQuestion}>
                Suivant →
              </button>
            ) : (
              <>
                <button ref={primaryRef} type="button" class="btn btn-primary" onClick={restart}>
                  ↻ Rejouer
                </button>
                <button type="button" class="btn" onClick={() => goBack('/')}>
                  Thèmes
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {notice && (
        <div class="notice" role="status">
          {notice}
        </div>
      )}

      <Modal open={explainOpen} onClose={() => setExplainOpen(false)} title="💡 Explication">
        <Rich text={q.question} class="explain-question" />
        <p class="explain-answer">
          <span>Bonne réponse</span>
          <strong>
            <Inline text={q.answer} />
          </strong>
        </p>
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
