/* PAPER PLANET — The Practice Sheet: choosing today's five folds.

   The main game deliberately hides your accuracy: a fold is never a failure,
   only a fold that looks more or less crisp. That is right for the Studio and
   wrong for practice, because you cannot get better at something you are never
   told the measure of.

   So this is the one place the number is shown. Five folds, drawn from the
   whole corpus rather than one recipe, each dropped in mid-model at the moment
   its landmark matters — you are handed a half-folded crane and asked to put
   the corner exactly where it goes. Seeded by the date, so it is the same sheet
   for everyone today and a different one tomorrow.

   See docs/ORIGAMI.md section 4.6 — progression gated on technique
   demonstrated, not folds counted. This is the drill half of that. */

import type { FoldStep, PaperMaterial } from '../../contracts'
import { SPECIES } from '../../content/species/index'
import { landmarkFor, type Landmark } from '../../content/landmarks'
import { Fold3D } from '../../engine'
import { seededRng } from '../../systems/rand'

export interface DrillRound {
  speciesId: string
  speciesName: string
  /** Where in that species' recipe this fold sits. */
  stepIndex: number
  step: FoldStep
  landmark: Landmark
}

/** How many folds make a sheet. Short enough to do while the kettle boils. */
export const ROUNDS = 5

/**
 * Only gestures whose accuracy `landmarkAccuracy` actually measures.
 *
 * It scores a displacement — how far the hand carried the landmark, and how
 * straight. A rub is scored on evenness, a hold on patience, a twist on angle;
 * none of those are a landmark arriving somewhere, so putting one in a drill
 * that reports landmark accuracy would be reporting a number about a different
 * thing.
 */
const SCORABLE = new Set(['drag', 'swipe'])

interface Candidate extends DrillRound {
  /** Later in a recipe means more paper in your hand and a harder fold. */
  depth: number
}

/**
 * The hint has to survive being projected, or the score is about something else.
 *
 * A fold's two hint anchors are material points, and a previous fold can carry
 * both onto the same place — the classic fold-in-half mountain does it, because
 * the two corners it names have already been brought together. The Studio
 * copes: it notices the collapse and synthesises a hint across the crease, so
 * the fold is still perfectly performable. But that synthetic hint is not the
 * landmark's travel, so the score falls back to a proxy.
 *
 * In the Studio that is invisible and fine. Here it would mean printing a
 * number under a reference it did not measure, on the one screen whose entire
 * job is the number. So those folds are kept out of the sheet.
 */
const MIN_HINT_SHARE = 0.08

const PROBE_PAPER: PaperMaterial = { front: '#E4664F', back: '#F6EFE2' }
const PROBE_SIZE = 1000

function hintSurvives(engine: Fold3D, stepIndex: number): boolean {
  engine.seekStep(stepIndex)
  engine.setProgress(0)
  const f = engine.render()
  if (!f.hint) return false
  const span = Math.hypot(f.hint.to[0] - f.hint.from[0], f.hint.to[1] - f.hint.from[1])
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const rf of f.facets) {
    for (const p of rf.points) {
      if (p[0] < x0) x0 = p[0]
      if (p[0] > x1) x1 = p[0]
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
  }
  if (!Number.isFinite(x0)) return false
  const reach = Math.hypot(x1 - x0, y1 - y0)
  return reach > 0 && span / reach >= MIN_HINT_SHARE
}

/** Every fold in the corpus that can be drilled. Built once. */
let cache: Candidate[] | null = null

export function drillCandidates(): Candidate[] {
  if (cache) return cache
  const out: Candidate[] = []
  const engine = new Fold3D()
  for (const species of SPECIES) {
    const steps = species.recipe.steps
    let ready = false
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!SCORABLE.has(step.gesture)) continue
      const landmark = landmarkFor(step)
      // A drill with no reference is just "fold it somewhere" — nothing to be
      // right about, and nothing for the score to mean.
      if (!landmark) continue
      if (!ready) {
        engine.reset(species.recipe, PROBE_PAPER)
        engine.fit(PROBE_SIZE, PROBE_SIZE, 0.9, 0)
        engine.setShadows(false)
        ready = true
      }
      if (!hintSurvives(engine, i)) continue
      out.push({
        speciesId: species.id,
        speciesName: species.name,
        stepIndex: i,
        step,
        landmark,
        depth: steps.length > 1 ? i / (steps.length - 1) : 0,
      })
    }
  }
  cache = out
  return out
}

/**
 * Today's sheet: five folds, easiest first.
 *
 * Ordered by depth so the sheet opens on a flat square and ends with something
 * half-built — a warm-up, not a cold start. Two folds of the same species would
 * make the second one free, so each appears at most once.
 */
export function drillFor(dateKey: string, count = ROUNDS): DrillRound[] {
  const pool = drillCandidates()
  if (pool.length === 0) return []
  const rng = seededRng(`paper-planet/drill/${dateKey}`)

  // Fisher-Yates on a copy: an unbiased shuffle, and the same one all day.
  const bag = pool.slice()
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }

  /* Two passes, because a sheet of five identical asks teaches nothing.
     'Onto the diagonal' is the commonest reference in the corpus by a long way,
     so an unconstrained draw hands you it five times and the sheet reads as one
     fold repeated. The first pass caps how often a kind of reference may
     repeat; the second fills whatever the cap left short. */
  const taken: Candidate[] = []
  const usedSpecies = new Set<string>()
  const relationCount = new Map<string, number>()
  const CAP = Math.max(1, Math.ceil(count / 2))

  const admit = (c: Candidate, capped: boolean): boolean => {
    if (usedSpecies.has(c.speciesId)) return false
    if (capped && (relationCount.get(c.landmark.relation) ?? 0) >= CAP) return false
    usedSpecies.add(c.speciesId)
    relationCount.set(c.landmark.relation, (relationCount.get(c.landmark.relation) ?? 0) + 1)
    taken.push(c)
    return true
  }

  for (const c of bag) {
    if (taken.length >= count) break
    admit(c, true)
  }
  for (const c of bag) {
    if (taken.length >= count) break
    admit(c, false)
  }

  taken.sort((a, b) => a.depth - b.depth)
  return taken.map((c) => ({
    speciesId: c.speciesId,
    speciesName: c.speciesName,
    stepIndex: c.stepIndex,
    step: c.step,
    landmark: c.landmark,
  }))
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE GRADE

   Origami has no score, so this one is about the hand rather than the result:
   it says how close the corner came, and it never says you failed. The lowest
   band is "keep going", not "poor".
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Grade {
  /** Shown large. */
  label: string
  /** One line about what to do differently. */
  note: string
  /** For the colour of the mark. */
  tone: 'clean' | 'close' | 'rough'
}

export function gradeFor(score: number): Grade {
  if (score >= 0.94) {
    return { label: 'Clean', note: 'The corners met. That is the whole craft.', tone: 'clean' }
  }
  if (score >= 0.78) {
    return { label: 'Close', note: 'A hair off. Let them touch before you press.', tone: 'close' }
  }
  if (score >= 0.5) {
    return { label: 'Near', note: 'Watch the mark, not your finger.', tone: 'close' }
  }
  return { label: 'Keep going', note: 'Take it all the way to the mark, slowly.', tone: 'rough' }
}

/** The sheet's own grade, from the folds on it. */
export function sheetGrade(scores: readonly number[]): number {
  if (scores.length === 0) return 0
  let total = 0
  for (const s of scores) total += s
  return total / scores.length
}
