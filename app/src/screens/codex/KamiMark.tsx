/* PAPER PLANET — <KamiMark>: a species drawn as folded paper, or teased as cut paper. */

import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { ArtPoly } from '../../contracts'

export type MarkMode = 'folded' | 'silhouette'

export interface KamiMarkProps {
  art: readonly ArtPoly[]
  /** Accessible name. Ignored when `decorative` — the card says it already. */
  name: string
  size?: number | string
  mode?: MarkMode
  /** Lay gold leaf over the whole model. */
  gold?: boolean
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/** One cut piece of paper. `fill` overrides the art's own dye (silhouettes). */
function Shape({ poly, fill, edge }: { poly: ArtPoly; fill?: string; edge?: string }): React.ReactElement | null {
  const paint = fill ?? poly.fill
  const stroke = poly.noStroke || !edge ? undefined : edge
  const strokeProps = stroke ? { stroke, strokeWidth: 1.5, strokeLinejoin: 'round' as const } : {}

  if (poly.circle) {
    const [cx, cy, r] = poly.circle
    return <circle cx={cx} cy={cy} r={r} fill={paint} {...strokeProps} />
  }
  if (poly.line) {
    const [x1, y1, x2, y2] = poly.line
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={paint} strokeWidth={3.2} strokeLinecap="round" />
  }
  if (poly.pts) return <polygon points={poly.pts} fill={paint} {...strokeProps} />
  return null
}

/** Everything that can act as a clip: filled areas only, never a drawn line. */
function clipShapes(art: readonly ArtPoly[]): React.ReactElement[] {
  const out: React.ReactElement[] = []
  art.forEach((poly, i) => {
    if (poly.circle) out.push(<circle key={i} cx={poly.circle[0]} cy={poly.circle[1]} r={poly.circle[2]} />)
    else if (poly.pts) out.push(<polygon key={i} points={poly.pts} />)
  })
  return out
}

/**
 * The creature, in a 0..200 square, as flat polygon on flat polygon — a paper
 * model photographed from directly above (BRAND §9).
 *
 * Every gradient and clip id is namespaced with `useId()`, so the same species
 * can appear in the grid and in the detail pane at once without the two
 * fighting over one global id — which is exactly what the old Codex did.
 */
export function KamiMark({
  art,
  name,
  size = 96,
  mode = 'folded',
  gold = false,
  decorative = false,
  className,
  style,
}: KamiMarkProps) {
  const raw = useId()
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  const clipId = `km-clip-${uid}`
  const foilId = `km-foil-${uid}`
  const cls = className ? `cx-mark ${className}` : 'cx-mark'

  const a11y = decorative
    ? ({ role: 'presentation' as const, 'aria-hidden': true })
    : ({ role: 'img' as const, 'aria-label': name })

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cls}
      data-mode={mode}
      style={style}
      focusable="false"
      {...a11y}
    >
      <defs>
        <clipPath id={clipId}>{clipShapes(art)}</clipPath>
        {gold && (
          <linearGradient id={foilId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-hi)" stopOpacity="0.9" />
            <stop offset="42%" stopColor="var(--gold-leaf)" stopOpacity="0.55" />
            <stop offset="70%" stopColor="var(--gold-hi)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--gold-leaf)" stopOpacity="0.5" />
          </linearGradient>
        )}
      </defs>

      {mode === 'silhouette' ? (
        <g>
          {/* the cut edge: the same shape one hair behind, so it reads as a sheet */}
          <g transform="translate(2.4 3.2)" opacity="0.42">
            {art.map((poly, i) => (
              <Shape key={i} poly={poly} fill="var(--paper-edge)" />
            ))}
          </g>
          <g fill="currentColor">
            {art.map((poly, i) => (
              <Shape key={i} poly={poly} fill="currentColor" />
            ))}
          </g>
          {/* one crease, at the icon's 34°, so it is paper and not a shadow */}
          <g clipPath={`url(#${clipId})`} opacity="0.24">
            <path d="M-30 168 L230 -8" stroke="var(--paper-0)" strokeWidth="7" fill="none" />
            <path d="M-30 214 L230 38" stroke="var(--paper-0)" strokeWidth="3" fill="none" />
          </g>
        </g>
      ) : (
        <g>
          {art.map((poly, i) => (
            <Shape key={i} poly={poly} edge="var(--ink-hair)" />
          ))}
          {gold && (
            <g clipPath={`url(#${clipId})`}>
              <rect x="0" y="0" width="200" height="200" fill={`url(#${foilId})`} />
            </g>
          )}
        </g>
      )}
    </svg>
  )
}

export default KamiMark
