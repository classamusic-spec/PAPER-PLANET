// PAPER PLANET — <Currency>: Sheets and Gold Leaf pills. Tabular, so they never jitter.

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { AccentToken } from '../contracts'
import { Icon, type IconName } from './Icon'
import { stableTilt } from './paperShapes'
import { useCountUp, useSeed, type CSSVars } from './hooks'

export type CurrencyKind = 'sheets' | 'goldleaf'

const KIND: Record<CurrencyKind, { icon: IconName; accent: AccentToken; name: string }> = {
  sheets: { icon: 'sheets', accent: 'kincha', name: 'Sheets' },
  goldleaf: { icon: 'goldleaf', accent: 'gold-leaf', name: 'Gold Leaf' },
}

const nf = new Intl.NumberFormat('en-US')

export interface CurrencyProps {
  kind: CurrencyKind
  value: number
  /** Count up to the new value instead of snapping. */
  animate?: boolean
  /** Show a `+12` beside the number for a moment after a reward. */
  delta?: number | null
  /** Milliseconds the count-up takes. */
  duration?: number
  seed?: string | number
  className?: string
  style?: CSSProperties
}

export function Currency({
  kind,
  value,
  animate = true,
  delta = null,
  duration = 620,
  seed,
  className,
  style,
}: CurrencyProps) {
  const meta = KIND[kind]
  const key = useSeed(seed)
  const shown = useCountUp(animate ? value : 0, animate ? duration : 0)
  const display = animate ? Math.round(shown) : value

  /* the mark gives one satisfying pop when the purse grows */
  const [flash, setFlash] = useState(false)
  const previous = useRef(value)
  useEffect(() => {
    if (value > previous.current) {
      setFlash(true)
      const t = window.setTimeout(() => setFlash(false), 560)
      previous.current = value
      return () => window.clearTimeout(t)
    }
    previous.current = value
  }, [value])

  const vars: CSSVars = { ...style, '--pp-tilt': `${stableTilt(key, 0.7)}deg` }

  return (
    <span
      className={className ? `pp-coin ${className}` : 'pp-coin'}
      data-accent={meta.accent}
      data-flash={flash ? 'true' : undefined}
      style={vars as CSSProperties}
    >
      <span className="pp-coin__mark" aria-hidden>
        <Icon name={meta.icon} size={14} cut={false} />
      </span>
      <span className="pp-coin__value" aria-label={`${nf.format(value)} ${meta.name}`}>
        {nf.format(display)}
      </span>
      {delta != null && delta !== 0 ? (
        <span className="pp-coin__delta" aria-hidden>
          {delta > 0 ? '+' : ''}
          {nf.format(delta)}
        </span>
      ) : null}
    </span>
  )
}

export const SheetsPill = (props: Omit<CurrencyProps, 'kind'>) => <Currency kind="sheets" {...props} />
export const GoldLeafPill = (props: Omit<CurrencyProps, 'kind'>) => <Currency kind="goldleaf" {...props} />
