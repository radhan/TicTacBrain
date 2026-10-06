import { Timer } from 'lucide-preact'
import { TIMER_OPTIONS, type TimerSetting } from '../lib/types'

export const timerLabel = (t: TimerSetting) => (t === 0 ? 'Libre' : `${t} s`)
const timerName = (t: TimerSetting) => (t === 0 ? 'Sans limite de temps' : `${t} secondes`)

/** Groupe radio accessible : une seule tabulation, flèches pour changer d'option. */
export function TimerPicker({ value, onChange }: { value: TimerSetting; onChange: (t: TimerSetting) => void }) {
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = (TIMER_OPTIONS.indexOf(value) + step + TIMER_OPTIONS.length) % TIMER_OPTIONS.length
    onChange(TIMER_OPTIONS[i])
    const group = e.currentTarget as HTMLElement
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
  }

  return (
    <div class="setting">
      <span class="setting-label" id="timer-label">
        <Timer size={18} aria-hidden="true" />
        <span>Compte à rebours</span>
      </span>
      <div class="segmented" role="radiogroup" aria-labelledby="timer-label" onKeyDown={onKeyDown}>
        {TIMER_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            aria-label={timerName(t)}
            tabIndex={value === t ? 0 : -1}
            class={value === t ? 'active' : ''}
            onClick={() => onChange(t)}
          >
            {timerLabel(t)}
          </button>
        ))}
      </div>
    </div>
  )
}
