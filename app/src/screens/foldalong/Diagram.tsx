/* PAPER PLANET — Fold Along: one plate, drawn in Yoshizawa–Randlett notation.

   The symbols here are the international standard, unchanged since the 1950s.
   Learning them is the transferable part of this whole feature: a player who
   can read a dash-dot line and a hollow arrowhead can open any origami book in
   any language and follow it. So we draw the real ones, not friendlier
   inventions. See docs/ORIGAMI.md §4.2. */

import type { Vec2 } from '../../contracts'
import type { ArrowKind, DiagramPlate } from './diagram'

/** Stroke weights, in viewBox units, so they hold at any rendered size. */
const W = { edge: 5, crease: 6, arrow: 7, mark: 6 }

function mid(a: Vec2, b: Vec2, bulge: number): Vec2 {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [mx - (dy / len) * bulge, my + (dx / len) * bulge]
}

/** A head, as a path. `hollow` draws the outline only — the mountain/unfold form. */
function head(tip: Vec2, from: Vec2, size: number, half: boolean): string {
  const dx = tip[0] - from[0]
  const dy = tip[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const bx = tip[0] - ux * size
  const by = tip[1] - uy * size
  const w = size * 0.46
  // A valley head is split: only one barb, the convention that separates it
  // from the mountain head at a glance.
  const p1: Vec2 = [bx - uy * w, by + ux * w]
  const p2: Vec2 = [bx + uy * w, by - ux * w]
  return half
    ? `M ${tip[0]} ${tip[1]} L ${p1[0]} ${p1[1]} L ${bx + ux * size * 0.3} ${by + uy * size * 0.3} Z`
    : `M ${tip[0]} ${tip[1]} L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} Z`
}

function Arrow({ from, to, kind, plate }: { from: Vec2; to: Vec2; kind: ArrowKind; plate: number }) {
  const span = Math.hypot(to[0] - from[0], to[1] - from[1])
  const size = Math.max(26, Math.min(64, span * 0.22))
  /* A rotate mark is an annotation on the page, not a measure of the motion, so
     it is sized from the plate. Taken from the hint span it came out about
     fifteen pixels across with the 1 and the 4 sitting on top of each other. */
  const glyph = plate * 0.055

  if (kind === 'hold') {
    /* An open circle: hold here. Two of them, because a press needs two hands. */
    return (
      <g className="pp-dia__arrow">
        <circle cx={from[0]} cy={from[1]} r={size * 0.5} fill="none" strokeWidth={W.arrow} />
        <circle cx={to[0]} cy={to[1]} r={size * 0.5} fill="none" strokeWidth={W.arrow} />
      </g>
    )
  }

  if (kind === 'rotate') {
    /* A fraction in a circle: turn the model on the desk. */
    const c = mid(from, to, 0)
    const r = glyph
    return (
      <g className="pp-dia__arrow">
        <circle cx={c[0]} cy={c[1]} r={r} fill="none" strokeWidth={W.arrow} />
        <path
          d={`M ${c[0] - r * 0.52} ${c[1] + r * 0.48} L ${c[0] + r * 0.52} ${c[1] - r * 0.48}`}
          strokeWidth={W.arrow}
        />
        <text
          x={c[0] - r * 0.4}
          y={c[1] - r * 0.14}
          className="pp-dia__frac"
          style={{ fontSize: r * 0.78 }}
        >
          1
        </text>
        <text
          x={c[0] + r * 0.02}
          y={c[1] + r * 0.74}
          className="pp-dia__frac"
          style={{ fontSize: r * 0.78 }}
        >
          4
        </text>
      </g>
    )
  }

  if (kind === 'turn') {
    /* A loop in the stem: turn the whole model over. */
    const c = mid(from, to, span * 0.38)
    return (
      <g className="pp-dia__arrow">
        <path
          d={`M ${from[0]} ${from[1]} Q ${c[0]} ${c[1]} ${to[0]} ${to[1]}`}
          fill="none"
          strokeWidth={W.arrow}
        />
        <path d={head(to, c, size, false)} className="pp-dia__hollow" strokeWidth={W.arrow * 0.7} />
      </g>
    )
  }

  const hollow = kind === 'mountain' || kind === 'unfold' || kind === 'push'
  const c = mid(from, to, span * (kind === 'push' ? 0.06 : 0.26))
  return (
    <g className="pp-dia__arrow">
      <path
        d={`M ${from[0]} ${from[1]} Q ${c[0]} ${c[1]} ${to[0]} ${to[1]}`}
        fill="none"
        strokeWidth={kind === 'push' ? W.arrow * 1.9 : W.arrow}
        strokeDasharray={kind === 'push' ? undefined : undefined}
        className={kind === 'push' ? 'pp-dia__stem-hollow' : undefined}
      />
      <path
        d={head(to, c, size, kind === 'valley')}
        className={hollow ? 'pp-dia__hollow' : undefined}
        strokeWidth={W.arrow * 0.7}
      />
      {/* An unfold arrow is double-headed: fold it, then bring it back. */}
      {kind === 'unfold' && (
        <path d={head(from, c, size, false)} className="pp-dia__hollow" strokeWidth={W.arrow * 0.7} />
      )}
    </g>
  )
}

export interface DiagramProps {
  plate: DiagramPlate
  viewBox: string
  /** Colours of the two faces of the sheet. */
  front: string
  back: string
  /** Rendered size. Omit to fill the container. */
  size?: number | string
  /** A sentence for anyone who cannot see it. */
  label: string
  className?: string
}

export default function Diagram({ plate, viewBox, front, back, size, label, className }: DiagramProps) {
  const c = plate.crease
  return (
    <svg
      className={'pp-dia' + (className ? ' ' + className : '')}
      viewBox={viewBox}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* The paper. Fill says which side you are looking at — the colour
          reference that makes "coloured side to white side" unambiguous. */}
      <g className="pp-dia__paper">
        {plate.facets.map((f, i) => (
          <polygon key={i} points={f.pts} fill={f.back ? back : front} strokeWidth={W.edge} />
        ))}
      </g>

      {/* The crease to make. Dashed is a valley, dash-dot is a mountain: the
          two lines every origami book in the world uses. */}
      {c && (
        <>
          {/* Erase the tessellation outline the engine leaves where this fold is
              about to go: an unfolded crease is not an edge. */}
          <line
            x1={c.from[0]}
            y1={c.from[1]}
            x2={c.to[0]}
            y2={c.to[1]}
            stroke={c.under === 'back' ? back : front}
            strokeWidth={W.edge * 1.6}
            strokeLinecap="butt"
          />
          <line
            x1={c.from[0]}
            y1={c.from[1]}
            x2={c.to[0]}
            y2={c.to[1]}
            className={'pp-dia__crease pp-dia__crease--' + c.direction}
            strokeWidth={W.crease}
          />
        </>
      )}

      {plate.arrow && (
        <Arrow
          from={plate.arrow.from}
          to={plate.arrow.to}
          kind={plate.arrow.kind}
          plate={Number(viewBox.split(' ')[2]) || 1000}
        />
      )}

      {/* Where to put a finger. */}
      {plate.marks.map((m, i) => (
        <circle key={i} cx={m[0]} cy={m[1]} r={16} className="pp-dia__mark" strokeWidth={W.mark} />
      ))}
    </svg>
  )
}
