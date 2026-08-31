/**
 * PAPER PLANET — the running record of a fold session.
 *
 * One accuracy sample per committed step, kept in step order. Unfolding takes
 * the crease out *and* the sample with it: a fold you undid must not go on
 * quietly holding your score down. BRAND.md §2 — the app never punishes.
 *
 * Pure and node-safe, so the rule can be tested rather than trusted.
 */

export interface FoldTally {
  /** Crease accuracy 0..1, one per committed step, in order. */
  readonly samples: readonly number[]
  /** How many creases this session has laid — it feeds `StudioResult`. */
  readonly creases: number
}

export const EMPTY_TALLY: FoldTally = { samples: [], creases: 0 }

/**
 * The quality a session reads as before anything has been creased.
 *
 * Not zero: a player who has folded nothing has not folded anything badly.
 */
export const UNMARKED_QUALITY = 0.8

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : UNMARKED_QUALITY)

/** A step landed. */
export function recordStep(tally: FoldTally, quality: number): FoldTally {
  return { samples: [...tally.samples, clamp01(quality)], creases: tally.creases + 1 }
}

/** A step was unfolded. The crease comes out, and so does its sample. */
export function unfoldStep(tally: FoldTally): FoldTally {
  if (tally.samples.length === 0) return { samples: [], creases: Math.max(0, tally.creases - 1) }
  return {
    samples: tally.samples.slice(0, -1),
    creases: Math.max(0, tally.creases - 1),
  }
}

/** Mean crease accuracy across the session, 0..1. */
export function meanQualityOf(tally: FoldTally): number {
  const n = tally.samples.length
  if (n === 0) return UNMARKED_QUALITY
  let sum = 0
  for (const s of tally.samples) sum += s
  return sum / n
}
