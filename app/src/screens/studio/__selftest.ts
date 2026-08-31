/* PAPER PLANET — Studio teaching & recovery self-test. Run: npx tsx src/screens/studio/__selftest.ts */

import type { GestureKind } from '../../contracts'
import {
  ORBIT_ANCHORS,
  ORBIT_LESSON,
  ASSIST_LESSON,
  demoGeometry,
  ghostsAt,
  lessonFor,
  placeOf,
  restPhase,
  type CoachMove,
} from './coach'
import { EMPTY_TALLY, UNMARKED_QUALITY, meanQualityOf, recordStep, unfoldStep } from './session'

let failures = 0
function ok(name: string, pass: boolean, extra?: unknown): void {
  if (!pass) failures++
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${pass || extra === undefined ? '' : `  ${JSON.stringify(extra)}`}`)
}

/* ── the tally: undo must take the sample with the crease ──────────────── */

{
  let t = EMPTY_TALLY
  ok('an unfolded sheet reads as unmarked, not as zero', meanQualityOf(t) === UNMARKED_QUALITY)

  t = recordStep(t, 0.9)
  t = recordStep(t, 0.2) // a bad one
  ok('two steps recorded', t.samples.length === 2 && t.creases === 2)
  ok('a bad crease drags the mean down', Math.abs(meanQualityOf(t) - 0.55) < 1e-9, meanQualityOf(t))

  t = unfoldStep(t)
  ok('unfolding drops the last sample', t.samples.length === 1 && t.creases === 1, t)
  ok('and the bad crease stops counting', Math.abs(meanQualityOf(t) - 0.9) < 1e-9, meanQualityOf(t))

  t = recordStep(t, 0.95)
  ok('the retry is the one that counts', Math.abs(meanQualityOf(t) - 0.925) < 1e-9, meanQualityOf(t))

  t = unfoldStep(unfoldStep(unfoldStep(t)))
  ok('unfolding past the first sheet is harmless', t.samples.length === 0 && t.creases === 0, t)
  ok('an emptied tally is unmarked again', meanQualityOf(t) === UNMARKED_QUALITY)

  ok('a nonsense sample never poisons the mean', meanQualityOf(recordStep(EMPTY_TALLY, Number.NaN)) === UNMARKED_QUALITY)
  ok('samples are clamped', meanQualityOf(recordStep(EMPTY_TALLY, 4)) === 1)
}

/* ── every gesture in the vocabulary has a lesson ──────────────────────── */

const GESTURES: GestureKind[] = ['drag', 'rub', 'pinch-in', 'pinch-out', 'twist', 'swipe', 'tap', 'hold']

for (const g of GESTURES) {
  const lesson = lessonFor(g)
  ok(`${g}: has a lesson`, !!lesson)
  if (!lesson) continue
  ok(`${g}: says where the hand goes, then what it does`, lesson.place.length > 0 && lesson.act.length > 0)
  ok(`${g}: the copy is one short sentence each`, lesson.place.length < 46 && lesson.act.length < 46, [
    lesson.place.length,
    lesson.act.length,
  ])
  ok(`${g}: two-finger gestures ask for two fingers`, (lesson.fingers === 2) === (g === 'pinch-in' || g === 'pinch-out' || g === 'twist' || g === 'swipe'))
}

ok('assist mode overrides every gesture with a tap', lessonFor('rub', true) === ASSIST_LESSON)
ok('guides off changes the copy that names the circle', placeOf(lessonFor('drag')!, false) !== placeOf(lessonFor('drag')!, true))
ok('guides off leaves copy that names no circle alone', placeOf(lessonFor('hold')!, false) === lessonFor('hold')!.place)
ok('the orbit lesson is its own topic', ORBIT_LESSON.topic === 'orbit' && ORBIT_LESSON.fingers === 2)

/* ── the demonstration stays on the sheet, whatever it is handed ───────── */

const MOVES: CoachMove[] = ['stroke', 'sweep', 'press', 'tap', 'tap-then', 'squeeze', 'spread', 'twist']
const SIZES = [
  { w: 374, h: 374 },
  { w: 737, h: 737 },
  { w: 260, h: 180 },
]
const finite = (n: number): boolean => Number.isFinite(n)

for (const size of SIZES) {
  for (const move of MOVES) {
    for (const live of [
      null,
      { from: [10, 10] as const, to: [10.2, 10.1] as const }, // collapsed on screen
      { from: [-400, -300] as const, to: [900, 1200] as const }, // way off the sheet
      { from: [40, 300] as const, to: [300, 60] as const },
    ]) {
      const g = demoGeometry(live, ORBIT_ANCHORS, size, move)
      ok(`${move} @${size.w}: has a stage`, !!g)
      if (!g) continue
      const m = g.tip * 1.9 - 0.001
      const inside = (p: readonly [number, number]): boolean =>
        p[0] >= m && p[0] <= size.w - m && p[1] >= m && p[1] <= size.h - m
      ok(`${move} @${size.w}: anchors stay on the sheet`, inside(g.a) && inside(g.b), [g.a, g.b])
      ok(`${move} @${size.w}: unit vector is unit`, Math.abs(Math.hypot(g.unit[0], g.unit[1]) - 1) < 1e-6)

      for (const phase of [0, 0.17, restPhase(move), 0.5, 0.83, 0.999]) {
        const ghosts = ghostsAt(move, move === 'squeeze' || move === 'spread' || move === 'twist' ? 2 : 1, g, phase)
        const sane = ghosts.every(
          (gh) =>
            finite(gh.pos[0]) &&
            finite(gh.pos[1]) &&
            finite(gh.angle) &&
            gh.alpha >= 0 &&
            gh.alpha <= 1 &&
            gh.press >= 0 &&
            gh.press <= 1 &&
            gh.pulse >= 0 &&
            gh.pulse <= 1,
        )
        ok(`${move} @${size.w} t=${phase}: ghosts are sane`, ghosts.length > 0 && sane, ghosts)
      }
    }
  }
}

/* A press and a tap happen in one place; everything else travels. */
{
  const g = demoGeometry({ from: [60, 90], to: [300, 250] }, null, { w: 374, h: 374 }, 'press')!
  ok('a press collapses to one spot', g.a[0] === g.b[0] && g.a[1] === g.b[1], g)
  const s = demoGeometry({ from: [60, 90], to: [300, 250] }, null, { w: 374, h: 374 }, 'sweep')!
  ok('a sweep keeps its journey', s.span > 100, s.span)
  ok('live anchors are marked as traced', s.traced)
  ok('a centred fallback is not', !demoGeometry(null, ORBIT_ANCHORS, { w: 374, h: 374 }, 'sweep')!.traced)
}

/* The hand must come to rest — a lesson that loops forever is a nag. */
for (const move of MOVES) {
  const r = restPhase(move)
  ok(`${move}: rests somewhere in the cycle`, r >= 0 && r < 1, r)
}

console.log(failures === 0 ? '\nall good' : `\n${failures} FAILED`)
const proc = (globalThis as { process?: { exitCode?: number } }).process
if (proc && failures > 0) proc.exitCode = 1
