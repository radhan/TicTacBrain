import { TIMER_OPTIONS, type TimerSetting } from '../lib/types'

export const timerLabel = (t: TimerSetting) => (t === 0 ? '∞' : t === 60 ? '1 min' : `${t} s`)

export function TimerPicker({ value, onChange }: { value: TimerSetting; onChange: (t: TimerSetting) => void }) {
  return (
    <div class="timer-picker">
      <span class="timer-picker-label">⏱️ Temps par question</span>
      <div class="segmented" role="radiogroup" aria-label="Temps par question">
        {TIMER_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            class={value === t ? 'active' : ''}
            title={t === 0 ? 'Sans limite de temps' : `${t} secondes par question`}
            onClick={() => onChange(t)}
          >
            {timerLabel(t)}
          </button>
        ))}
      </div>
    </div>
  )
}
