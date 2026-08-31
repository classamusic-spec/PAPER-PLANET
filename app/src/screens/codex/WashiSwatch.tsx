/* PAPER PLANET — <WashiSwatch>: one sheet of paper, drawn with its real pattern. */

import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Washi } from '../../contracts'

export interface WashiSwatchProps {
  washi: Washi
  /** Edge length in px, or any CSS length. */
  size?: number | string
  /** The sheet is described by its label; do not repeat it to a screen reader. */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * `Washi.patternDefs` declares a global id (`wp-<washi id>`). Two swatches of the
 * same paper on one screen would then be two elements claiming one id, and the
 * browser resolves `url(#…)` to whichever it saw first. Namespacing every def
 * with the component's own `useId()` makes each swatch self-contained.
 */
function scopeDefs(defs: string, prefix: string): string {
  return defs.split('id="').join(`id="${prefix}`)
}

export function WashiSwatch({ washi, size = 64, decorative = false, className, style }: WashiSwatchProps) {
  const raw = useId()
  const prefix = `${raw.replace(/[^a-zA-Z0-9_-]/g, '')}-`
  const defs = useMemo(
    () => (washi.patternDefs ? scopeDefs(washi.patternDefs, prefix) : null),
    [washi.patternDefs, prefix],
  )
  const patternId = washi.material.patternId
  const fill = defs && patternId ? `url(#${prefix}${patternId})` : washi.material.front
  const foil = washi.material.foil ?? 0
  const sheenId = `${prefix}sheen`

  return (
    <svg
      viewBox="0 0 150 150"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid slice"
      className={className ? `cx-swatch ${className}` : 'cx-swatch'}
      style={style}
      focusable="false"
      {...(decorative
        ? { role: 'presentation' as const, 'aria-hidden': true }
        : { role: 'img' as const, 'aria-label': `${washi.name} paper` })}
    >
      <defs>
        {defs ? <g dangerouslySetInnerHTML={{ __html: defs }} /> : null}
        {foil > 0 && (
          <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-hi)" stopOpacity={0.75 * foil} />
            <stop offset="45%" stopColor="var(--gold-hi)" stopOpacity={0.05 * foil} />
            <stop offset="62%" stopColor="var(--gold-hi)" stopOpacity={0.65 * foil} />
            <stop offset="100%" stopColor="var(--gold-hi)" stopOpacity={0.12 * foil} />
          </linearGradient>
        )}
      </defs>
      <rect x="0" y="0" width="150" height="150" fill={fill} />
      {foil > 0 && <rect x="0" y="0" width="150" height="150" fill={`url(#${sheenId})`} />}
      {/* the corner turned back: this is a sheet, not a colour chip */}
      <path d="M150 0 L150 34 L116 0 Z" fill="var(--paper-back)" opacity="0.92" />
      <path d="M150 34 L116 0 L150 0 Z" fill="var(--paper-3)" opacity="0.35" />
      <path d="M116 0 L150 34" stroke="var(--ink-hair)" strokeWidth="1.4" fill="none" />
    </svg>
  )
}

export default WashiSwatch
