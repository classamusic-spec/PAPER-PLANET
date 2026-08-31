// PAPER PLANET — <Chip>: a small paper tag. Static label, or a pressable filter.

import type { CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import { Icon, type IconName } from './Icon'
import { stableTilt } from './paperShapes'
import { useSeed, usePaperSound, type CSSVars } from './hooks'

export interface ChipProps {
  children: ReactNode
  accent?: AccentToken
  /** `plain` paper, a `wash` of the dye, or a `solid` dyed tag. */
  tone?: 'plain' | 'wash' | 'solid'
  icon?: IconName
  /** A little square of the dye, cut and pasted on. */
  dot?: boolean
  /** Makes the chip a toggle button. */
  selected?: boolean
  onClick?: () => void
  seed?: string | number
  className?: string
  style?: CSSProperties
}

export function Chip({
  children,
  accent = 'beni',
  tone = 'plain',
  icon,
  dot = false,
  selected,
  onClick,
  seed,
  className,
  style,
}: ChipProps) {
  const key = useSeed(seed)
  const play = usePaperSound()
  const vars: CSSVars = { ...style, '--pp-tilt': `${stableTilt(key, 1)}deg` }
  const inner = (
    <>
      {dot ? <span className="pp-chip__dot" aria-hidden /> : null}
      {icon ? <Icon name={icon} size="sm" /> : null}
      <span>{children}</span>
    </>
  )
  const cls = className ? `pp-chip ${className}` : 'pp-chip'

  if (onClick) {
    return (
      <button
        type="button"
        className={`${cls} pp-target`}
        data-accent={accent}
        data-tone={tone}
        aria-pressed={selected}
        style={vars as CSSProperties}
        onClick={() => {
          play('ui.toggle')
          onClick()
        }}
      >
        {inner}
      </button>
    )
  }

  return (
    <span className={cls} data-accent={accent} data-tone={tone} style={vars as CSSProperties}>
      {inner}
    </span>
  )
}
