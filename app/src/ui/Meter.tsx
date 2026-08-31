// PAPER PLANET — <Meter>: a paper strip that fills the way ink soaks into fibre.

import type { CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import type { CSSVars } from './hooks'

export interface MeterProps {
  value: number
  /** Defaults to 1, so `value` can be a plain 0..1 fraction. */
  max?: number
  min?: number
  /** Shown top-left, in Label style. */
  label?: ReactNode
  /** Shown top-right — "3 / 7", "62%". */
  caption?: ReactNode
  accent?: AccentToken
  size?: 'sm' | 'md' | 'lg'
  /** Score the track into tenths, like a ruler. */
  ticks?: boolean
  /** When there is no visible label, name it here. */
  ariaLabel?: string
  className?: string
  style?: CSSProperties
}

const HEIGHTS = { sm: 8, md: 12, lg: 18 } as const

export function Meter({
  value,
  max = 1,
  min = 0,
  label,
  caption,
  accent = 'matcha',
  size = 'md',
  ticks = false,
  ariaLabel,
  className,
  style,
}: MeterProps) {
  const span = max - min || 1
  const pct = Math.max(0, Math.min(1, (value - min) / span))
  const vars: CSSVars = {
    ...style,
    '--meter-v': `${(pct * 100).toFixed(2)}%`,
    '--meter-h': `${HEIGHTS[size]}px`,
  }

  return (
    <div
      className={className ? `pp-meter ${className}` : 'pp-meter'}
      data-accent={accent}
      data-ticks={ticks ? 'true' : undefined}
      style={vars as CSSProperties}
    >
      {label || caption ? (
        <div className="pp-meter__head">
          {label ? <span className="pp-label">{label}</span> : <span />}
          {caption ? <span className="pp-label pp-num">{caption}</span> : null}
        </div>
      ) : null}
      <div
        className="pp-meter__track"
        role="progressbar"
        aria-valuenow={Math.round(value * 100) / 100}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      >
        <div className="pp-meter__fill" />
      </div>
    </div>
  )
}
