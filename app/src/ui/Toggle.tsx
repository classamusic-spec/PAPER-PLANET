// PAPER PLANET — <Toggle>: a little paper card that slides in a scored well.

import type { CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import { usePaperSound } from './hooks'

export interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** Visible label. Required — a switch with no name is not a control. */
  label: ReactNode
  /** One quiet line explaining what it does. */
  hint?: ReactNode
  accent?: AccentToken
  disabled?: boolean
  /** Put the switch after the label instead of before it (settings rows). */
  labelFirst?: boolean
  className?: string
  style?: CSSProperties
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  accent = 'matcha',
  disabled = false,
  labelFirst = false,
  className,
  style,
}: ToggleProps) {
  const play = usePaperSound()
  const well = (
    <span className="pp-toggle__well" aria-hidden>
      <span className="pp-toggle__knob" />
    </span>
  )
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-accent={accent}
      className={className ? `pp-toggle ${className}` : 'pp-toggle'}
      style={{ ...style, opacity: disabled ? 0.45 : undefined, width: labelFirst ? '100%' : undefined }}
      onClick={() => {
        play('ui.toggle')
        onChange(!checked)
      }}
    >
      {labelFirst ? null : well}
      <span className="pp-toggle__text">
        <span>{label}</span>
        {hint ? <span className="pp-toggle__hint">{hint}</span> : null}
      </span>
      {labelFirst ? (
        <>
          <span className="pp-spacer" />
          {well}
        </>
      ) : null}
    </button>
  )
}
