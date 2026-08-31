// PAPER PLANET — <Paper>: the base sheet. Every surface in the app is one of these.

import { forwardRef, useMemo } from 'react'
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import type { Elevation } from '../contracts'
import { edgePath, stableTilt, type EdgeKind } from './paperShapes'
import { useElementSize, useSeed, type CSSVars } from './hooks'

export type { EdgeKind }

/** Which sheet in the stack this is. Higher sheets are lighter. */
export type PaperTone = 0 | 1 | 2 | 3 | 4 | 'back'

export type PaperRadius = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none'

const RADIUS_PX: Record<PaperRadius, number> = { none: 0, xs: 5, sm: 9, md: 14, lg: 20, xl: 28 }
const RADIUS_VAR: Record<PaperRadius, string> = {
  none: '0px',
  xs: 'var(--r-xs)',
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)',
}
const TONE_VAR: Record<string, string> = {
  '0': 'var(--paper-0)',
  '1': 'var(--paper-1)',
  '2': 'var(--paper-2)',
  '3': 'var(--paper-3)',
  '4': 'var(--paper-4)',
  back: 'var(--paper-back)',
}
const SHADOW_VAR = ['none', 'var(--sh-1)', 'var(--sh-2)', 'var(--sh-3)', 'var(--sh-4)'] as const
/** How far the shadow substrate hides under an irregular boundary. */
const CAST_INSET: Record<EdgeKind, number> = { clean: 2, cut: 2.5, deckle: 4, torn: 5.5 }

export interface PaperProps extends Omit<HTMLAttributes<HTMLElement>, 'style' | 'children'> {
  children?: ReactNode
  /** 0 = lying flat on the desk, 4 = a modal held above everything. */
  elevation?: Elevation
  /** How the boundary was made. */
  edge?: EdgeKind
  /** Degrees. Omit for a small, stable, seed-derived tilt — nothing is square. */
  tilt?: number
  /** Which sheet of the paper stack this is cut from. */
  tone?: PaperTone
  /** Fibre texture. On by default; turn it off inside a scrolling list of many. */
  grain?: boolean
  /** Corner radius token. */
  radius?: PaperRadius
  /** Stable irregularity seed. Two sheets with the same seed are the same sheet. */
  seed?: string | number
  /** Peel the top-right corner. Keep the top-right ~24px of content clear. */
  dogEar?: boolean
  /** Render as something other than a div. */
  as?: ElementType
  style?: CSSProperties
  'data-closing'?: string
  'data-testid'?: string
}

/**
 * A real sheet of paper: fibre, an edge treatment, and a warm directional
 * shadow matched to its elevation.
 *
 * The irregular boundaries (`deckle`, `torn`, `cut`) are generated in pixel
 * space from the seed, so the wobble is the same size on a wide card as on a
 * tall one — and identical on every render.
 */
export const Paper = forwardRef<HTMLElement, PaperProps>(function Paper(
  {
    children,
    elevation = 1,
    edge = 'cut',
    tilt,
    tone = 1,
    grain = true,
    radius = 'md',
    seed,
    dogEar = false,
    as,
    className,
    style,
    ...rest
  },
  forwardedRef,
) {
  const Tag = (as ?? 'div') as ElementType
  const key = useSeed(seed)
  const needsPath = edge !== 'clean'
  const [measureRef, size] = useElementSize<HTMLDivElement>(needsPath)

  const angle = tilt ?? stableTilt(key)

  const d = useMemo(() => {
    if (!needsPath || size.w < 6 || size.h < 6) return null
    return edgePath(size.w, size.h, key, edge, RADIUS_PX[radius])
  }, [needsPath, size.w, size.h, key, edge, radius])

  const vars: CSSVars = {
    ...style,
    '--pp-tone': TONE_VAR[String(tone)],
    '--pp-radius': RADIUS_VAR[radius],
    '--pp-tilt': `${angle}deg`,
    '--pp-shadow': SHADOW_VAR[elevation],
    '--pp-cast-inset': `${CAST_INSET[edge]}px`,
    ...(d ? { '--pp-clip': `path("${d}")` } : null),
  }

  const setRefs = (node: HTMLDivElement | null): void => {
    measureRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  return (
    <Tag
      ref={setRefs}
      className={className ? `pp-paper ${className}` : 'pp-paper'}
      data-edge={edge}
      data-elev={elevation}
      data-grain={grain ? 'on' : 'off'}
      data-dogear={dogEar ? 'true' : undefined}
      style={vars as CSSProperties}
      {...rest}
    >
      {elevation > 0 ? <span className="pp-paper__cast" aria-hidden /> : null}
      <span className="pp-paper__sheet" aria-hidden />
      {d && (edge === 'deckle' || edge === 'torn') ? (
        <svg
          className="pp-paper__rim"
          viewBox={`0 0 ${size.w} ${size.h}`}
          width={size.w}
          height={size.h}
          aria-hidden
          focusable="false"
        >
          <path d={d} fill="none" stroke="var(--paper-edge)" strokeWidth={1.3} />
        </svg>
      ) : null}
      <div className="pp-paper__body">{children}</div>
    </Tag>
  )
})
