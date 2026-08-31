/* PAPER PLANET — Landmarks: what meets what.

   Ask any origami teacher what beginners get wrong and the answer is precision;
   ask what fixes it and the answer is references. A landmark is the point, edge
   or crease that locates a move exactly. "Fold it over" is a wish. "Top-right
   corner onto the bottom-left corner" is an instruction you can be right about.

   This module derives that reference from geometry rather than asking 34 recipes
   to restate it, because the engine already knows both points exactly and an
   authored note can drift from the crease it describes. It gives us three
   things a diagram book cannot:

     · the sentence  — landmarkLine()
     · the marks     — Landmark.moving / .onto, in material space, for drawing
     · the score     — landmarkAccuracy(), which asks the question origami asks:
                       did the corners actually meet?

   See docs/ORIGAMI.md §4.1. */

import type { Crease, FoldStep, Vec2 } from '../contracts'
import { PT, SQ } from './recipes'

/* ═══════════════════════════════════════════════════════════════════════════
   NAMING A POINT
   ═══════════════════════════════════════════════════════════════════════════ */

/** What sort of thing a landmark is. Decides how it is drawn and how it reads. */
export type LandmarkKind = 'corner' | 'edge' | 'centre' | 'mark' | 'ridge' | 'line'

export interface LandmarkPoint {
  /** Material space, 0..1000. */
  p: Vec2
  kind: LandmarkKind
  /** Reads inside a sentence: "…onto **the bottom-left corner**." */
  the: string
  /** Reads alone, on a diagram or as the head of a clause: "Bottom-left corner". */
  label: string
  /**
   * The shortest unambiguous form, for naming a line by its two ends. "The line
   * from the middle of the bottom edge to the middle of the left edge" is
   * correct and unreadable; "the line from mid-bottom to mid-left" is both.
   */
  brief: string
}

/** Two points are the same landmark within this much material distance. */
const NEAR = 1.5

/**
 * The names, in the teacher's vocabulary rather than the code's.
 *
 * Every entry here is a real origami reference — a corner, an edge midpoint, a
 * quarter mark, or one of the 22.5° marks the classical bases are built on.
 * `PT` keys that are pure construction (the ridge feet) get a plain description
 * rather than a name, because naming them would be false precision: a folder
 * does not look for "RIDGE_TL_A", they look for where the crease lands.
 */
const NAMES: Partial<Record<keyof typeof PT, { kind: LandmarkKind; the: string; label: string; brief: string }>> = {
  TL: { kind: 'corner', the: 'the top-left corner', label: 'Top-left corner', brief: 'top-left' },
  TR: { kind: 'corner', the: 'the top-right corner', label: 'Top-right corner', brief: 'top-right' },
  BR: { kind: 'corner', the: 'the bottom-right corner', label: 'Bottom-right corner', brief: 'bottom-right' },
  BL: { kind: 'corner', the: 'the bottom-left corner', label: 'Bottom-left corner', brief: 'bottom-left' },

  MT: { kind: 'edge', the: 'the middle of the top edge', label: 'Middle of the top edge', brief: 'mid-top' },
  MR: { kind: 'edge', the: 'the middle of the right edge', label: 'Middle of the right edge', brief: 'mid-right' },
  MB: { kind: 'edge', the: 'the middle of the bottom edge', label: 'Middle of the bottom edge', brief: 'mid-bottom' },
  ML: { kind: 'edge', the: 'the middle of the left edge', label: 'Middle of the left edge', brief: 'mid-left' },

  C: { kind: 'centre', the: 'the centre', label: 'The centre', brief: 'the centre' },

  QT: { kind: 'mark', the: 'the quarter mark above the centre', label: 'Quarter mark, above centre', brief: 'the quarter above centre' },
  QB: { kind: 'mark', the: 'the quarter mark below the centre', label: 'Quarter mark, below centre', brief: 'the quarter below centre' },
  QL: { kind: 'mark', the: 'the quarter mark left of the centre', label: 'Quarter mark, left of centre', brief: 'the quarter left of centre' },
  QR: { kind: 'mark', the: 'the quarter mark right of the centre', label: 'Quarter mark, right of centre', brief: 'the quarter right of centre' },

  RQ: { kind: 'mark', the: 'the mark on the right edge', label: 'Mark on the right edge', brief: 'the right-edge mark' },
  BQ: { kind: 'mark', the: 'the mark on the bottom edge', label: 'Mark on the bottom edge', brief: 'the bottom-edge mark' },
  LQ: { kind: 'mark', the: 'the mark on the left edge', label: 'Mark on the left edge', brief: 'the left-edge mark' },
  TQ: { kind: 'mark', the: 'the mark on the top edge', label: 'Mark on the top edge', brief: 'the top-edge mark' },

  W1: { kind: 'mark', the: 'the waist mark on the diagonal', label: 'Waist mark', brief: 'the waist mark' },
  W2: { kind: 'mark', the: 'the far waist mark on the diagonal', label: 'Far waist mark', brief: 'the far waist mark' },

  Q1: { kind: 'mark', the: 'the upper-left quarter corner', label: 'Upper-left quarter corner', brief: 'the upper-left quarter' },
  Q2: { kind: 'mark', the: 'the upper-right quarter corner', label: 'Upper-right quarter corner', brief: 'the upper-right quarter' },
  Q3: { kind: 'mark', the: 'the lower-right quarter corner', label: 'Lower-right quarter corner', brief: 'the lower-right quarter' },
  Q4: { kind: 'mark', the: 'the lower-left quarter corner', label: 'Lower-left quarter corner', brief: 'the lower-left quarter' },
}

const NAMED: { p: Vec2; kind: LandmarkKind; the: string; label: string; brief: string }[] = Object.entries(NAMES).map(
  ([key, v]) => ({ p: PT[key as keyof typeof PT], ...v! }),
)

/** Every ridge foot, so a bird-base crease can still say where it lands. */
const RIDGE_KEYS = Object.keys(PT).filter((k) => k.startsWith('RIDGE_')) as (keyof typeof PT)[]

function near(a: Vec2, b: Vec2): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < NEAR
}

/**
 * Name a material-space point, or return null if it is not a reference a folder
 * could actually find. Unnamed is an honest answer: a fold whose landing point
 * is nowhere in particular is described by its crease, not by its destination.
 */
export function nameMaterialPoint(p: Vec2): LandmarkPoint | null {
  for (const n of NAMED) if (near(p, n.p)) return { ...n }
  for (const k of RIDGE_KEYS) {
    if (near(p, PT[k])) {
      return {
        p: PT[k],
        kind: 'ridge',
        the: 'the foot of the ridge crease',
        label: 'Foot of the ridge',
        brief: 'the ridge foot',
      }
    }
  }
  // On an edge but not at a named mark: still a reference, if a loose one.
  const E = 1.5
  const edge =
    Math.abs(p[0]) < E ? 'left' : Math.abs(p[0] - SQ) < E ? 'right' : Math.abs(p[1]) < E ? 'top' : Math.abs(p[1] - SQ) < E ? 'bottom' : null
  if (edge) {
    return { p, kind: 'edge', the: `the ${edge} edge`, label: `The ${edge} edge`, brief: `the ${edge} edge` }
  }
  return null
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAMING A LINE
   ═══════════════════════════════════════════════════════════════════════════ */

/** The lines a folder already has a word for. Checked in both directions. */
const AXES: { a: Vec2; b: Vec2; the: string; label: string }[] = [
  { a: PT.TL, b: PT.BR, the: 'the diagonal', label: 'The diagonal' },
  { a: PT.TR, b: PT.BL, the: 'the other diagonal', label: 'The other diagonal' },
  { a: PT.MT, b: PT.MB, the: 'the centre line', label: 'The centre line' },
  { a: PT.ML, b: PT.MR, the: 'the sideways centre line', label: 'The sideways centre line' },
]

/** Distance from p to the infinite line a→b. */
function distToLine(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1) return Infinity
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len
}

/**
 * Name the line a point has landed on, if it is one a folder has a word for.
 *
 * This is the reference the classical bases are actually built on: a kite base
 * is not "the corner over some line", it is *the edge down to the centre
 * crease*. Naming the destination beats naming the axis every time — it is
 * what the folder is looking at while they do it.
 */
function landedOn(p: Vec2): { the: string; label: string } | null {
  for (const ax of AXES) if (distToLine(p, ax.a, ax.b) < 3) return { the: ax.the, label: ax.label }
  return null
}

/** Name the fold axis: "the diagonal", or "the line from the centre to the top-right corner". */
export function nameAxis(a: Vec2, b: Vec2): string | null {
  for (const ax of AXES) {
    if ((near(a, ax.a) && near(b, ax.b)) || (near(a, ax.b) && near(b, ax.a))) return ax.the
  }
  const na = nameMaterialPoint(a)
  const nb = nameMaterialPoint(b)
  if (na && nb && !near(na.p, nb.p)) return `the line from ${na.brief} to ${nb.brief}`
  return null
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE LANDMARK
   ═══════════════════════════════════════════════════════════════════════════ */

export type LandmarkRelation =
  /** A point lands on a point. The strongest reference there is. */
  | 'meet'
  /** A point lands on a line we can name — the reference the bases are built on. */
  | 'onto-line'
  /** A point folds over a line we can name, landing nowhere in particular. */
  | 'across'
  /** The crease itself is the lesson — a pre-crease, laid between two references. */
  | 'line'

export interface Landmark {
  relation: LandmarkRelation
  /** The point that travels. Present for 'meet' and 'across'. */
  moving: LandmarkPoint | null
  /** Where it must arrive. Present for 'meet'. */
  onto: LandmarkPoint | null
  /** The named crease. Present for 'across' and 'line'. */
  axis: { from: Vec2; to: Vec2; the: string } | null
  /** The reference, as a teacher would say it. One clause, no verb ceremony. */
  line: string
  /**
   * How far apart, in material units, still counts as met. Scaled to the move:
   * a long fold forgives more than a 60-unit nudge, because the paper does.
   */
  tolerance: number
}

/** The kinds that move the model rather than the paper. They have no landmark. */
const CREASELESS = new Set(['flip', 'rotate', 'press', 'inflate'])

/**
 * Longest crease first: when a step lays several, the lesson is the long one.
 *
 * Exported because a diagram has to draw the same crease this names — taking
 * the line style from one crease and the geometry from another puts dashes on
 * a plate that describe a different fold.
 */
export function principal(creases: readonly Crease[]): Crease | null {
  let best: Crease | null = null
  let bestLen = 0
  for (const c of creases) {
    const len = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1])
    if (len > bestLen) {
      bestLen = len
      best = c
    }
  }
  return best
}

/**
 * Derive the reference for a step, or null when there honestly isn't one.
 *
 * The rule is per fold kind, because "what meets what" means different things:
 * a valley moves a point, a pre-crease lays a line between two points, and a
 * flip moves nothing at all.
 */
export function landmarkFor(step: FoldStep): Landmark | null {
  if (CREASELESS.has(step.kind)) return null

  const axis = principal(step.creases)

  /* A pre-crease travels nowhere. Its reference is the line itself. */
  if (step.kind === 'crease') {
    if (!axis) return null
    const named = nameAxis(axis.a, axis.b)
    if (!named) return null
    const a = nameMaterialPoint(axis.a)
    const b = nameMaterialPoint(axis.b)
    const line =
      a && b && a.kind === 'corner' && b.kind === 'corner'
        ? `${a.label} to ${b.label.toLowerCase()}`
        : `Along ${named}`
    return {
      relation: 'line',
      moving: null,
      onto: null,
      axis: { from: axis.a, to: axis.b, the: named },
      line,
      tolerance: SQ * TOL_PERFECT,
    }
  }

  const moving = nameMaterialPoint(step.hint.from)
  if (!moving) return null

  const travel = Math.hypot(step.hint.to[0] - step.hint.from[0], step.hint.to[1] - step.hint.from[1])
  const tolerance = Math.max(SQ * 0.02, travel * TOL_PERFECT)

  const namedAxis = axis ? { from: axis.a, to: axis.b, the: nameAxis(axis.a, axis.b) ?? 'the crease' } : null

  /* The strongest case: the corner lands on something with a name of its own. */
  const onto = nameMaterialPoint(step.hint.to)
  if (onto && travel > NEAR && !near(moving.p, onto.p)) {
    return {
      relation: 'meet',
      moving,
      onto,
      axis: namedAxis,
      line: `${moving.label} to ${onto.the.replace(/^the /, '')}`,
      tolerance,
    }
  }

  /* Next strongest, and the one the classical bases live on: it lands on a line
     we can name. "Onto the diagonal" is what a folder is actually watching for. */
  const lands = travel > NEAR ? landedOn(step.hint.to) : null
  if (lands) {
    return {
      relation: 'onto-line',
      moving,
      onto: { p: step.hint.to, kind: 'line', the: lands.the, label: lands.label, brief: lands.the },
      axis: namedAxis,
      line: `${moving.label} onto ${lands.the}`,
      tolerance,
    }
  }

  /* Otherwise the reference is the line it folds over. Still real — this is how
     a diagram specifies a fold whose landing point is nowhere in particular.
     Skipped when the point sits on its own axis, where the phrasing would name
     the moving corner twice and say nothing. */
  if (axis && travel > NEAR) {
    const named = nameAxis(axis.a, axis.b)
    const selfReferential = near(moving.p, axis.a) || near(moving.p, axis.b)
    if (named && !selfReferential) {
      return {
        relation: 'across',
        moving,
        onto: null,
        axis: { from: axis.a, to: axis.b, the: named },
        line: `${moving.label} across ${named}`,
        tolerance,
      }
    }
  }
  return null
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORING

   The old measure asked how far the finger strayed sideways off the hint. It
   could not tell a fold that stopped short from one that met its mark, and
   stopping short is the commonest real mistake in origami.

   This asks the question the craft asks: the landmark had to travel a certain
   way, by a certain distance — how close did the hand come to carrying it
   there? Two errors, and they are not the same error:

     · sideways  — the corner went somewhere else. Always counts.
     · short     — the corner did not arrive. Counts only below the point at
                   which the app itself calls the fold done, because past that
                   line the paper really has landed and the hand really was
                   right; the player is not owed a penalty for our forgiveness.

   Measured as displacement, so grabbing a little off-centre costs nothing —
   only the journey is judged. And it still cannot fail you: BRAND §12 floors
   the reward multiplier, so this decides how crisp the paper looks, nothing more.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Perfect within this share of the travel; nothing left beyond the second. */
const TOL_PERFECT = 0.04
const TOL_LOST = 0.34

/**
 * How far along the hint the fold auto-completes — `foldProgress`'s 1.12
 * overshoot allowance, inverted. Reach this and the corner has arrived.
 */
export const REACH = 1 / 1.12

/**
 * 0..1 for a gesture that had to carry a landmark by `need` and carried it by
 * `got`. Both in the same space: screen pixels, frozen at the gesture's start.
 */
export function landmarkAccuracy(need: Vec2, got: Vec2): number {
  const len2 = need[0] * need[0] + need[1] * need[1]
  if (len2 < 1) return 0.8
  // Along the hint, and across it — both in units of the travel itself.
  const along = (got[0] * need[0] + got[1] * need[1]) / len2
  const across = Math.abs(got[0] * need[1] - got[1] * need[0]) / len2
  const short = Math.max(0, REACH - along)
  const miss = Math.hypot(short, across)
  if (miss <= TOL_PERFECT) return 1
  if (miss >= TOL_LOST) return 0
  return 1 - (miss - TOL_PERFECT) / (TOL_LOST - TOL_PERFECT)
}

/** How the miss reads, for a coach line. Never a failure — only a description. */
export function landmarkVerdict(score: number): 'met' | 'close' | 'off' {
  return score >= 0.86 ? 'met' : score >= 0.5 ? 'close' : 'off'
}
