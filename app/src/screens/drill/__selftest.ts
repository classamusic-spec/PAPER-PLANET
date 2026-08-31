/* PAPER PLANET — Practice Sheet self-test. Run: npx tsx src/screens/drill/__selftest.ts */

import { drillCandidates, drillFor, gradeFor, sheetGrade, ROUNDS } from './rounds'
import { landmarkAccuracy } from '../../content/landmarks'
import { readPractice, recordPractice } from '../../systems/progression'
import { SPECIES } from '../../content/species/index'
import { Fold3D } from '../../engine'

const RED = '[31m'
const GREEN = '[32m'
const BOLD = '[1m'
const OFF = '[0m'

const failures: string[] = []
let checks = 0
function check(ok: boolean, message: string): void {
  checks++
  if (!ok) failures.push(message)
}

console.log(`\n${BOLD}the practice sheet${OFF}`)

/* ── the pool ───────────────────────────────────────────────────────────── */

const pool = drillCandidates()
check(pool.length >= ROUNDS * 4, `the pool is deep enough to stay fresh (${pool.length})`)
for (const c of pool) {
  check(!!c.landmark, `${c.speciesId}/${c.stepIndex}: every drill has a reference to be right about`)
  check(
    c.step.gesture === 'drag' || c.step.gesture === 'swipe',
    `${c.speciesId}/${c.stepIndex}: only gestures the score actually measures`,
  )
  const species = SPECIES.find((s) => s.id === c.speciesId)
  check(!!species, `${c.speciesId}: the species exists`)
  check(
    !!species && c.stepIndex >= 0 && c.stepIndex < species.recipe.steps.length,
    `${c.speciesId}/${c.stepIndex}: the step index is inside the recipe`,
  )
  check(c.depth >= 0 && c.depth <= 1, `${c.speciesId}/${c.stepIndex}: depth is a fraction`)
}

/* Independently of the filter that built the pool: seek each fold and confirm
   the hint really is there. A drilled fold whose hint collapses would be scored
   by a proxy while a landmark was printed above it. */
{
  const engine = new Fold3D()
  let checked = 0
  let thin = 0
  for (const c of pool) {
    const species = SPECIES.find((s) => s.id === c.speciesId)
    if (!species) continue
    engine.reset(species.recipe, { front: '#E4664F', back: '#F6EFE2' })
    engine.fit(1000, 1000, 0.9, 0)
    engine.seekStep(c.stepIndex)
    engine.setProgress(0)
    const f = engine.render()
    const span = f.hint
      ? Math.hypot(f.hint.to[0] - f.hint.from[0], f.hint.to[1] - f.hint.from[1])
      : 0
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const rf of f.facets) for (const p of rf.points) {
      if (p[0] < x0) x0 = p[0]
      if (p[0] > x1) x1 = p[0]
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
    const reach = Math.hypot(x1 - x0, y1 - y0)
    checked++
    if (!(reach > 0 && span / reach >= 0.08)) thin++
    check(
      reach > 0 && span / reach >= 0.08,
      `${c.speciesId}/${c.stepIndex}: the hint survives projection, so the score measures the landmark`,
    )
  }
  check(checked === pool.length, 'every candidate was probed')
  check(thin === 0, `no drilled fold has a collapsed hint (${thin})`)
}

/* ── today's sheet ──────────────────────────────────────────────────────── */

const DAYS = ['2026-08-31', '2026-09-01', '2026-09-02', '2027-01-01', '2025-02-28']
const fingerprints = new Set<string>()

for (const day of DAYS) {
  const sheet = drillFor(day)
  const fp = sheet.map((r) => `${r.speciesId}:${r.stepIndex}`).join('|')
  fingerprints.add(fp)

  check(sheet.length === ROUNDS, `${day}: a full sheet (${sheet.length})`)
  check(drillFor(day).map((r) => r.speciesId).join() === sheet.map((r) => r.speciesId).join(),
    `${day}: the same day is the same sheet — no reroll by reopening`)

  const ids = sheet.map((r) => r.speciesId)
  check(new Set(ids).size === ids.length, `${day}: no species twice, so no fold is free`)

  // Easiest first: a warm-up, not a cold start.
  const steps = sheet.map((r) => r.stepIndex)
  const species = sheet.map((r) => SPECIES.find((s) => s.id === r.speciesId)!)
  const depths = steps.map((s, i) => {
    const n = species[i].recipe.steps.length
    return n > 1 ? s / (n - 1) : 0
  })
  check(
    depths.every((d, i) => i === 0 || d >= depths[i - 1] - 1e-9),
    `${day}: the sheet opens easy and gets harder`,
  )

  for (const r of sheet) {
    check(r.landmark.line.length > 0, `${day}/${r.speciesId}: the reference reads as a sentence`)
    check(r.speciesName.length > 0, `${day}/${r.speciesId}: the fold says where it came from`)
  }

  /* A sheet of five identical asks teaches nothing, and "onto the diagonal" is
     the commonest reference in the corpus by a wide margin. */
  const rel = new Map<string, number>()
  for (const r of sheet) rel.set(r.landmark.relation, (rel.get(r.landmark.relation) ?? 0) + 1)
  check(rel.size > 1, `${day}: the sheet asks for more than one kind of reference`)
  check(
    Math.max(...rel.values()) <= Math.ceil(ROUNDS / 2) + 1,
    `${day}: no reference kind dominates the sheet`,
  )
}
check(fingerprints.size === DAYS.length, 'a different sheet every day')

/* ── the grade ──────────────────────────────────────────────────────────── */

check(gradeFor(1).tone === 'clean', 'a perfect fold reads clean')
check(gradeFor(0.8).tone === 'close', 'a near miss reads close')
check(gradeFor(0).tone === 'rough', 'a bad one still gets a tone, not a failure')
check(
  !/fail|wrong|bad|poor/i.test(DAYS.map(() => '').join('') + [0, 0.3, 0.6, 0.9, 1].map((s) => gradeFor(s).label + gradeFor(s).note).join(' ')),
  'nothing in the grade vocabulary tells the player they failed',
)
check(sheetGrade([1, 1, 1, 1, 1]) === 1, 'a clean sheet is 1')
check(sheetGrade([]) === 0, 'an empty sheet does not divide by zero')
check(Math.abs(sheetGrade([1, 0]) - 0.5) < 1e-9, 'the sheet is the average of its folds')

/* The grade bands have to line up with what the gesture can actually produce.
   Carrying a landmark all the way must be able to read "Clean" — a drill you
   cannot get right is not a drill. */
const need: [number, number] = [300, 0]
check(gradeFor(landmarkAccuracy(need, [300, 0])).tone === 'clean', 'carrying it all the way is Clean')
check(gradeFor(landmarkAccuracy(need, [268, 0])).tone === 'clean', 'reaching the commit line is Clean')
check(gradeFor(landmarkAccuracy(need, [186, 0])).tone !== 'clean', 'stopping well short is not')
check(gradeFor(landmarkAccuracy(need, [268, 66])).tone !== 'clean', 'nor is landing off to the side')

/* ── the ledger ─────────────────────────────────────────────────────────── */

let seen: string[] = []
const day1 = '2026-08-31'
check(readPractice(seen, day1).streak === 0, 'a new player has practised nothing')
check(readPractice(seen, day1).doneToday === false, 'and has not done today')

let out = recordPractice(seen, day1, 0.8)
seen = out.seen
check(out.log.streak === 1, 'the first sheet starts a streak')
check(Math.abs(out.log.best - 0.8) < 1e-3, 'and sets the best')
check(readPractice(seen, day1).doneToday, 'today is marked done')

// A second sheet the same day: a better score counts, the streak does not double.
out = recordPractice(seen, day1, 0.95)
seen = out.seen
check(out.log.streak === 1, 'practising twice in a day does not advance the streak twice')
check(Math.abs(out.log.best - 0.95) < 1e-3, 'but a better sheet is still your best')

// And a worse one never takes the record away.
out = recordPractice(seen, day1, 0.2)
seen = out.seen
check(Math.abs(out.log.best - 0.95) < 1e-3, 'a worse sheet cannot lower your best')

out = recordPractice(seen, '2026-09-01', 0.7)
seen = out.seen
check(out.log.streak === 2, 'the next day continues the streak')

out = recordPractice(seen, '2026-09-05', 0.7)
seen = out.seen
check(out.log.streak === 1, 'a missed day restarts at one, and never at zero')

out = recordPractice(seen, '2026-09-06', Number.NaN)
check(Number.isFinite(out.log.best), 'a broken score cannot poison the record')
check(out.log.streak === 2, 'and still counts as having practised')

console.log(`  ${pool.length} drillable folds across ${new Set(pool.map((c) => c.speciesId)).size} species`)
console.log(`  sample sheet: ${drillFor(day1).map((r) => r.speciesName).join(' · ')}`)

console.log(`\n${BOLD}verdict${OFF}`)
if (failures.length > 0) {
  for (const f of failures.slice(0, 20)) console.log(`  ${RED}FAIL${OFF} ${f}`)
  console.log('')
  throw new Error(`${failures.length} practice failures out of ${checks} checks`)
}
console.log(`  ${GREEN}all ${checks} checks passed${OFF}`)
console.log('')
