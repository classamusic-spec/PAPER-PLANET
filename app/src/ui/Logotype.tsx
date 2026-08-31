// PAPER PLANET — the logotype, the folded-paper planet glyph, and the crane mark.

import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { CSSVars } from './hooks'
import { CRANE_FACETS } from './crane'

/* ═══════════════════════════════════════════════════════════════════════════
   THE CRANE
   Five cut facets: tail, far wing, neck-and-beak, near wing, keel. Drawn as a
   paper model photographed from just above — flat polygon on flat polygon,
   one shade facet, no gradients.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CraneProps {
  /** Rendered width in px. Height follows the 120:100 sheet. */
  size?: number
  /** The dye the crane is folded from. Defaults to safflower. */
  color?: string
  title?: string
  className?: string
  style?: CSSProperties
}

/** The brand mascot: the first fold every player makes. */
export function Crane({ size = 96, color = 'var(--beni)', title, className, style }: CraneProps) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 100) / 120}
      viewBox="0 0 120 100"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ ...style, color }}
      fill="currentColor"
    >
      {title ? <title>{title}</title> : null}
      {CRANE_FACETS.map((facet, i) => (
        <path
          key={i}
          d={facet.d}
          fill={
            facet.shade === 'deep'
              ? 'color-mix(in srgb, currentColor 78%, var(--ink))'
              : facet.shade === 'soft'
                ? 'color-mix(in srgb, currentColor 82%, var(--paper-0))'
                : 'currentColor'
          }
        />
      ))}
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE APP MARK — a crane on a paper disc, one crease crossing it at 34°
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CraneMarkProps {
  size?: number
  title?: string
  className?: string
  style?: CSSProperties
}

export function CraneMark({ size = 84, title = 'Paper Planet', className, style }: CraneMarkProps) {
  const clip = useId().replace(/:/g, '')
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      focusable="false"
      style={style}
    >
      <defs>
        <clipPath id={`pp-disc-${clip}`}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="var(--paper-1)" />
      <g clipPath={`url(#pp-disc-${clip})`}>
        {/* the crease shadow: the disc is a folded sheet, lit from above-left */}
        <path d="M-14 96 L118 7 L118 118 L-14 118 Z" fill="var(--paper-3)" opacity="0.55" />
        <path d="M-14 96 L118 7 L119 9 L-13 98 Z" fill="var(--paper-edge)" />
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--paper-edge)" strokeWidth="1.6" />
      <g transform="translate(11 18) scale(0.64)" fill="var(--beni)">
        {CRANE_FACETS.map((facet, i) => (
          <path
            key={i}
            d={facet.d}
            fill={
              facet.shade === 'deep'
                ? 'var(--beni-deep)'
                : facet.shade === 'soft'
                  ? 'color-mix(in srgb, var(--beni) 84%, var(--paper-0))'
                  : 'var(--beni)'
            }
          />
        ))}
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PLANET GLYPH
   A folded-paper disc standing in for the A of PLANET: the mountain-fold ridge
   runs down the centre, and the A is cut out of the disc as negative space —
   so it reads as both a letter and a little world.
   ═══════════════════════════════════════════════════════════════════════════ */

/* apex, two legs, one crossbar — an A, punched out of the disc */
const A_CUT = 'M43 9h14L76 88H62L50 34 38 88H24Z' + 'M31 56.5h38l4.4 13H26.6Z'

function PlanetGlyph() {
  const mask = useId().replace(/:/g, '')
  return (
    <svg className="pp-logo__disc" viewBox="0 0 100 100" aria-hidden focusable="false">
      <defs>
        <mask id={`pp-a-${mask}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <circle cx="50" cy="50" r="49" fill="#fff" />
          <path d={A_CUT} fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#pp-a-${mask})`}>
        <circle cx="50" cy="50" r="49" fill="currentColor" />
        {/* the lit half of the mountain fold */}
        <path d="M50 1a49 49 0 0 0 0 98Z" fill="var(--paper-1)" opacity="0.15" />
        {/* the ridge itself */}
        <rect x="49" y="1" width="1.9" height="98" fill="var(--paper-1)" opacity="0.55" />
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE LOGOTYPE
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LogotypeProps {
  /** Any CSS length. Defaults to the fluid `--fs-display-l`. */
  size?: string
  /** The crane mark above the words. */
  mark?: boolean
  markSize?: number
  /** The hairline rule and FOLD · BREATHE · COME ALIVE. */
  tagline?: boolean
  className?: string
  style?: CSSProperties
}

export function Logotype({
  size,
  mark = false,
  markSize = 84,
  tagline = true,
  className,
  style,
}: LogotypeProps) {
  const vars: CSSVars = { ...style, ...(size ? { '--logo-size': size } : null) }
  return (
    <div
      className={className ? `pp-logo ${className}` : 'pp-logo'}
      role="img"
      aria-label="Paper Planet — fold, breathe, come alive"
      style={vars as CSSProperties}
    >
      {mark ? <CraneMark size={markSize} className="pp-logo__mark" title="" /> : null}
      <p className="pp-logo__word" aria-hidden>
        <span className="pp-logo__part">
          P<span className="pp-logo__glyph pp-logo__glyph--crease">A</span>PER
        </span>
        <span className="pp-logo__part">
          PL
          <PlanetGlyph />
          NET
        </span>
      </p>
      {tagline ? (
        <>
          <span className="pp-logo__rule" aria-hidden />
          <span className="pp-logo__tag" aria-hidden>
            Fold · Breathe · Come alive
          </span>
        </>
      ) : null}
    </div>
  )
}
