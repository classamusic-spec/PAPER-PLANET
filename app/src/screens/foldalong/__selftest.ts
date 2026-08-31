/* PAPER PLANET — Fold Along self-test. Run: npx tsx src/screens/foldalong/__selftest.ts

   A diagram that is wrong is worse than no diagram: someone is holding paper.
   So the things asserted here are the things a reader would be misled by — a
   square that is not square, a crease with no direction, a number that is not a
   number — checked across every recipe in the corpus, not a sample. */

import type { PaperMaterial } from '../../contracts'
import { SPECIES } from '../../content/species/index'
import { CP_SIDE, buildCreasePattern, buildDiagrams, facingNote } from './diagram'

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

const MATERIAL: PaperMaterial = { front: '#E4664F', back: '#F6EFE2' }

/** Pull every coordinate out of a plate, so nothing hides a NaN. */
function coords(pts: string): number[] {
  return pts.split(' ').flatMap((t) => t.split(',').map(Number))
}

console.log(`\n${BOLD}fold along — diagrams${OFF}`)

let plateCount = 0
let angled = 0

for (const species of SPECIES) {
  const id = species.id
  const set = buildDiagrams(species.recipe, MATERIAL)
  const steps = species.recipe.steps.length

  check(set.plates.length === steps + 1, `${id}: one plate per step, plus the finished model`)

  const vb = set.viewBox.split(' ').map(Number)
  check(vb.length === 4 && vb.every(Number.isFinite), `${id}: the viewBox is four real numbers`)
  check(Math.abs(vb[2] - vb[3]) < 0.5, `${id}: the viewBox is square, so plates sit alike on a page`)
  check(vb[2] > 1, `${id}: the viewBox has size`)

  for (const p of set.plates) {
    plateCount++
    if (p.view === 'angled') angled++

    check(p.facets.length > 0, `${id}/plate ${p.n}: there is paper on the plate`)
    let mx0 = Infinity
    let my0 = Infinity
    let mx1 = -Infinity
    let my1 = -Infinity
    for (const f of p.facets) {
      const c = coords(f.pts)
      check(c.length >= 6, `${id}/plate ${p.n}: a facet has at least three points`)
      check(c.every(Number.isFinite), `${id}/plate ${p.n}: no facet coordinate is NaN`)
      for (let i = 0; i < c.length; i += 2) {
        if (c[i] < mx0) mx0 = c[i]
        if (c[i] > mx1) mx1 = c[i]
        if (c[i + 1] < my0) my0 = c[i + 1]
        if (c[i + 1] > my1) my1 = c[i + 1]
      }
    }
    const reach = Math.hypot(mx1 - mx0, my1 - my0)

    if (p.crease) {
      check(
        p.crease.direction === 'valley' || p.crease.direction === 'mountain',
        `${id}/plate ${p.n}: a crease is a valley or a mountain and says which`,
      )
      check(
        p.crease.under === 'front' || p.crease.under === 'back',
        `${id}/plate ${p.n}: the crease knows which face it runs over`,
      )
      check(
        [...p.crease.from, ...p.crease.to].every(Number.isFinite),
        `${id}/plate ${p.n}: the crease has real endpoints`,
      )
      const len = Math.hypot(p.crease.to[0] - p.crease.from[0], p.crease.to[1] - p.crease.from[1])
      check(len > 1, `${id}/plate ${p.n}: the crease is a line, not a dot`)

      /* The fold line lies ON the paper. Recovering a collapsed crease means
         walking the material line and keeping what projects; take the two
         samples furthest apart and the line can leap between separated parts
         of a folded model, drawing itself across empty desk. */
      const slack = reach * 0.06
      for (const end of [p.crease.from, p.crease.to]) {
        check(
          end[0] >= mx0 - slack &&
            end[0] <= mx1 + slack &&
            end[1] >= my0 - slack &&
            end[1] <= my1 + slack,
          `${id}/plate ${p.n}: the crease line stays on the model`,
        )
      }
      check(len <= reach * 1.05, `${id}/plate ${p.n}: the crease is no longer than the model`)
    }

    if (p.arrow) {
      check(
        [...p.arrow.from, ...p.arrow.to].every(Number.isFinite),
        `${id}/plate ${p.n}: the arrow has real ends`,
      )
      // A pre-crease is folded and opened again, so it always takes the
      // double-headed arrow, drawn ACROSS the line rather than along it.
      if (p.step?.kind === 'crease') {
        check(p.arrow.kind === 'unfold', `${id}/plate ${p.n}: a pre-crease gets the unfold arrow`)
        if (p.crease) {
          const cx = p.crease.to[0] - p.crease.from[0]
          const cy = p.crease.to[1] - p.crease.from[1]
          const ax = p.arrow.to[0] - p.arrow.from[0]
          const ay = p.arrow.to[1] - p.arrow.from[1]
          const cosang =
            Math.abs(cx * ax + cy * ay) / (Math.hypot(cx, cy) * Math.hypot(ax, ay) || 1)
          check(cosang < 0.2, `${id}/plate ${p.n}: the unfold arrow crosses its crease, not follows it`)
        }
      }
    }

    check(
      ['front', 'back', 'both'].includes(p.facing),
      `${id}/plate ${p.n}: the plate knows which side is up`,
    )
    check(facingNote(p.facing).length > 0, `${id}/plate ${p.n}: and can say so`)
    check(p.view === 'flat' || p.view === 'angled', `${id}/plate ${p.n}: the view is named`)
  }

  /* The first plate is the flat sheet. It has to look like the paper in the
     reader's hand: a square. Every authored step carries a staged camera for
     the game, and letting one leak into a diagram turns it into a trapezoid. */
  const first = set.plates[0]
  const pts = first.facets.flatMap((f) => {
    const c = coords(f.pts)
    const out: [number, number][] = []
    for (let i = 0; i < c.length; i += 2) out.push([c[i], c[i + 1]])
    return out
  })
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const top = pts.filter((q) => q[1] < minY + 3).map((q) => q[0])
  const bot = pts.filter((q) => q[1] > maxY - 3).map((q) => q[0])
  const wTop = Math.max(...top) - Math.min(...top)
  const wBot = Math.max(...bot) - Math.min(...bot)
  const h = maxY - minY
  const w = Math.max(...xs) - Math.min(...xs)
  check(Math.abs(wTop / wBot - 1) < 0.005, `${id}: the flat sheet has no perspective taper`)
  check(Math.abs(w / h - 1) < 0.02, `${id}: the flat sheet is square`)
  check(first.view === 'flat', `${id}: and it is seen flat`)

  /* The last plate is the model, staged — a thing you look at, not read. */
  const lastPlate = set.plates[set.plates.length - 1]
  check(lastPlate.step === null, `${id}: the last plate is the finished model`)
  check(lastPlate.crease === null, `${id}: which has nothing left to fold`)
  check(lastPlate.view === 'angled', `${id}: and is shown from an angle`)

  /* The crease pattern. Every line inside the sheet, and no duplicates. */
  const cp = buildCreasePattern(species.recipe)
  check(cp.length > 0, `${id}: the crease pattern has creases`)
  for (const c of cp) {
    check(
      [...c.a, ...c.b].every((v) => Number.isFinite(v) && v >= -0.01 && v <= CP_SIDE + 0.01),
      `${id}: every crease-pattern line lies on the sheet`,
    )
    check(Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) > 1, `${id}: no zero-length crease`)
  }
  const keys = new Set(cp.map((c) => [...c.a, ...c.b].map((n) => Math.round(n)).join(',') + c.direction))
  check(keys.size === cp.length, `${id}: the same crease is not drawn twice`)
}

console.log(`  ${plateCount} plates across ${SPECIES.length} recipes`)
console.log(`  ${plateCount - angled} seen flat, ${angled} turned because flat was edge-on`)

console.log(`\n${BOLD}verdict${OFF}`)
if (failures.length > 0) {
  for (const f of failures.slice(0, 20)) console.log(`  ${RED}FAIL${OFF} ${f}`)
  console.log('')
  throw new Error(`${failures.length} diagram failures out of ${checks} checks`)
}
console.log(`  ${GREEN}all ${checks} checks passed${OFF}`)
console.log('')
