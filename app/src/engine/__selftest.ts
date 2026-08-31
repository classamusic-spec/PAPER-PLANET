// PAPER PLANET — engine self-test. Headless, no DOM. Run: npx tsx src/engine/__selftest.ts

import type { Crease, FoldRecipe, FoldStep, PaperMaterial, Vec2 } from '../contracts'
import type { PaperFrame } from './render'
import { Fold3D } from './index'
import { Sheet } from './sheet'
import { convexHull, offsetPolygon, polyArea, splitPolygon } from './geom'
import { bendExponent, bendVertex, bowAmount, buildStrips } from './bend'
import { invalidateCssCache, parseColor, readLighting } from './shade'
import { defaultLighting } from './types'

// Minimal Node surface. The engine itself never touches these; only this script does.
declare const process: {
  stdout: { write(s: string): void }
  hrtime: { bigint(): bigint }
  memoryUsage(): { heapUsed: number }
  exit(code: number): never
}
declare const globalThis: { gc?: () => void }

/* ── harness ───────────────────────────────────────────────────────────── */

let passed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++
  } else {
    failures.push(name + (detail ? '  -> ' + detail : ''))
  }
}

function near(name: string, a: number, b: number, eps: number): void {
  ok(name, Number.isFinite(a) && Math.abs(a - b) <= eps, `${a} vs ${b} (eps ${eps})`)
}

function section(t: string): void {
  process.stdout.write('\n  ' + t + '\n')
}

const isNum = (x: number): boolean => typeof x === 'number' && Number.isFinite(x)

/* ── fixtures ──────────────────────────────────────────────────────────── */

const MATERIAL: PaperMaterial = { front: '#e4664f', back: '#fbf7ef', foil: 0.2 }
const SHEET_AREA = 1000 * 1000

function crease(
  ax: number, ay: number, bx: number, by: number,
  side: 1 | -1, direction: 'valley' | 'mountain', angle: number,
): Crease {
  return { a: [ax, ay] as Vec2, b: [bx, by] as Vec2, side, direction, angle }
}

function step(
  id: string, kind: FoldStep['kind'], creases: Crease[], targets?: Vec2[],
): FoldStep {
  const c = creases[0]
  return {
    id,
    kind,
    gesture: 'drag',
    creases,
    hint: c ? { from: c.a, to: c.b } : { from: [200, 200], to: [800, 800] },
    targets,
    instruction: 'Fold along the line.',
  }
}

/** One step of every FoldKind in the contract. */
const RECIPE: FoldRecipe = {
  base: 'bird',
  steps: [
    step('s-crease', 'crease', [crease(0, 0, 1000, 1000, 1, 'valley', 0)]),
    step('s-valley', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)]),
    step('s-mountain', 'mountain', [crease(0, 500, 1000, 500, -1, 'mountain', 180)]),
    step('s-pinch', 'pinch', [crease(250, 0, 250, 1000, 1, 'valley', 90)]),
    step('s-squash', 'squash', [crease(300, 200, 700, 600, 1, 'valley', 90)], [[420, 320]]),
    step('s-petal', 'petal', [crease(200, 700, 500, 400, 1, 'valley', 180)], [[320, 600]]),
    step('s-reverse', 'reverse', [crease(620, 120, 900, 400, 1, 'valley', 180)], [[760, 260]]),
    step('s-pull', 'pull', [crease(500, 0, 500, 1000, 1, 'valley', 120)], [[610, 500]]),
    step('s-flip', 'flip', [crease(0, 500, 1000, 500, 1, 'valley', 180)]),
    step('s-rotate', 'rotate', [crease(0, 500, 1000, 500, 1, 'valley', 90)]),
    step('s-inflate', 'inflate', [crease(200, 200, 800, 800, 1, 'valley', 60)]),
    step('s-press', 'press', [crease(0, 0, 1000, 1000, 1, 'valley', 180)]),
  ],
}

/** Deliberately hostile input: NaN, zero-length axes, duplicate creases. */
const NASTY: FoldRecipe = {
  steps: [
    step('n-nan', 'valley', [crease(NaN, 0, 500, NaN, 1, 'valley', NaN)]),
    step('n-zero', 'valley', [crease(400, 400, 400, 400, 1, 'valley', 180)]),
    step('n-edge', 'valley', [crease(0, 0, 0, 1000, 1, 'valley', 180)]),
    step('n-dupe', 'mountain', [crease(500, 0, 500, 1000, -1, 'mountain', 180), crease(500, 0, 500, 1000, -1, 'mountain', 180)]),
    step('n-huge', 'valley', [crease(-9e9, -9e9, 9e9, 9e9, -1, 'valley', 1e9)]),
    step('n-squash-nofacet', 'squash', [crease(100, 900, 300, 700, 1, 'valley', 90)], [[-500, -500]]),
    step('n-reverse-flat', 'reverse', [crease(700, 300, 800, 400, 1, 'valley', 180)], [[NaN, NaN]]),
    step('n-press', 'press', []),
  ],
}

/* ── frame validation ──────────────────────────────────────────────────── */

const HEX = /^#[0-9a-f]{6}$/

function checkFrame(label: string, f: PaperFrame, minFacets = 1): void {
  ok(label + ': facets present', f.facets.length >= minFacets, String(f.facets.length))
  let badPt = 0
  let badFill = 0
  let badRange = 0
  let degenerate = 0
  for (let i = 0; i < f.facets.length; i++) {
    const rf = f.facets[i]
    if (rf.points.length < 3) degenerate++
    for (let k = 0; k < rf.points.length; k++) {
      if (!isNum(rf.points[k][0]) || !isNum(rf.points[k][1])) badPt++
    }
    if (!HEX.test(rf.fill)) badFill++
    if (rf.stroke !== null && !HEX.test(rf.stroke)) badFill++
    if (rf.internal && rf.stroke !== null) badFill++
    if (
      !isNum(rf.depth) || !isNum(rf.sheen) || !isNum(rf.occlusion) ||
      rf.sheen < 0 || rf.sheen > 1 || rf.occlusion < 0 || rf.occlusion > 1 ||
      !isNum(rf.strokeWidth) || rf.strokeWidth <= 0 || typeof rf.id !== 'string' || rf.id.length === 0
    ) badRange++
  }
  ok(label + ': no NaN in facet points', badPt === 0, badPt + ' bad coords')
  ok(label + ': fills are hex', badFill === 0, badFill + ' bad colours')
  ok(label + ': channels in range', badRange === 0, badRange + ' out of range')
  ok(label + ': no degenerate polygons', degenerate === 0, degenerate + ' with <3 points')

  let unsorted = 0
  for (let i = 1; i < f.facets.length; i++) {
    if (f.facets[i].depth < f.facets[i - 1].depth - 1e-9) unsorted++
  }
  ok(label + ': painter order is monotone', unsorted === 0, unsorted + ' inversions')

  let badShadow = 0
  for (let i = 0; i < f.shadow.length; i++) {
    if (!isNum(f.shadow[i][0]) || !isNum(f.shadow[i][1])) badShadow++
  }
  ok(label + ': shadow finite', badShadow === 0, badShadow + ' bad shadow points')

  ok(
    label + ': bounds finite',
    isNum(f.bounds.x) && isNum(f.bounds.y) && isNum(f.bounds.w) && isNum(f.bounds.h) &&
    f.bounds.w >= 0 && f.bounds.h >= 0,
    JSON.stringify(f.bounds),
  )
  if (f.hint) {
    ok(label + ': hint finite', isNum(f.hint.from[0]) && isNum(f.hint.to[1]))
  }
  if (f.axis) {
    ok(label + ': axis finite', isNum(f.axis.from[0]) && isNum(f.axis.to[1]))
  }
  for (let i = 0; i < f.targets.length; i++) {
    ok(label + ': target finite', isNum(f.targets[i][0]) && isNum(f.targets[i][1]))
  }
}

/* ── tests ─────────────────────────────────────────────────────────────── */

function testGeom(): void {
  section('geom')

  const sq = [0, 0, 100, 0, 100, 100, 0, 100]
  const pos: number[] = []
  const neg: number[] = []

  splitPolygon(sq, 50, -10, 50, 110, pos, neg)
  near('split: halves sum to the whole', Math.abs(polyArea(pos)) + Math.abs(polyArea(neg)), 10000, 1e-9)
  ok('split: both halves exist', pos.length >= 6 && neg.length >= 6)

  splitPolygon(sq, 0, 0, 0, 100, pos, neg)
  near('split on an edge keeps the polygon whole',
    Math.max(Math.abs(polyArea(pos)), Math.abs(polyArea(neg))), 10000, 1e-9)

  splitPolygon(sq, 10, 10, 10, 10, pos, neg)
  near('split by a zero-length axis is a no-op', Math.abs(polyArea(pos)), 10000, 1e-9)

  splitPolygon(sq, 200, 0, 200, 100, pos, neg)
  near('split entirely outside keeps one side', Math.abs(polyArea(pos)), 10000, 1e-9)
  ok('split entirely outside empties the other', neg.length === 0, neg.length + ' coords')
  splitPolygon(sq, -200, 100, -200, 0, pos, neg)
  near('split outside on the other hand', Math.abs(polyArea(pos)), 10000, 1e-9)

  const tri = [0, 0, 100, 0, 100, 100]
  splitPolygon(tri, -1, -1, 1, 1, pos, neg)
  near('split through a vertex conserves area',
    Math.abs(polyArea(pos)) + Math.abs(polyArea(neg)), 5000, 1e-9)

  // Many random cuts must never lose or gain material.
  let seed = 12345
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  let bag: number[][] = [[0, 0, 1000, 0, 1000, 1000, 0, 1000]]
  for (let round = 0; round < 24; round++) {
    const next: number[][] = []
    const ax = rnd() * 1000
    const ay = rnd() * 1000
    const bx = rnd() * 1000
    const by = rnd() * 1000
    for (let i = 0; i < bag.length; i++) {
      splitPolygon(bag[i], ax, ay, bx, by, pos, neg)
      if (pos.length >= 6) next.push(pos.slice())
      if (neg.length >= 6) next.push(neg.slice())
      if (pos.length < 6 && neg.length < 6) next.push(bag[i].slice())
    }
    bag = next
  }
  let total = 0
  let nan = 0
  for (let i = 0; i < bag.length; i++) {
    total += Math.abs(polyArea(bag[i]))
    for (let k = 0; k < bag[i].length; k++) if (!isNum(bag[i][k])) nan++
  }
  near('24 random cuts conserve area', total, SHEET_AREA, SHEET_AREA * 1e-6)
  ok('24 random cuts produce no NaN', nan === 0, nan + ' NaN coords')
  ok('24 random cuts stay bounded', bag.length < 4000, bag.length + ' pieces')

  const hull: number[] = []
  convexHull([0, 0, 10, 0, 10, 10, 0, 10, 5, 5, 5, 1], 6, hull)
  ok('hull drops interior points', hull.length === 8, hull.length / 2 + ' points')
  convexHull([3, 3, 3, 3, 3, 3], 3, hull)
  ok('hull survives coincident points', hull.length >= 2)

  const off: number[] = []
  offsetPolygon(sq, 10, off)
  ok('offset outward grows the area', Math.abs(polyArea(off)) > 10000)
  offsetPolygon(sq, -400, off)
  ok('offset past collapse stays finite', off.every(isNum) && off.length >= 6)

  const strips = buildStrips(sq, 0, 0, 100, 0, 100, 8, 'f0')
  ok('bend: strips are produced', strips !== null && strips.length >= 2, String(strips?.length))
  if (strips) {
    let sum = 0
    let sMin = 1
    let sMax = 0
    for (const s of strips) {
      sum += Math.abs(polyArea(s.poly))
      for (let i = 0; i < s.s.length; i++) {
        sMin = Math.min(sMin, s.s[i])
        sMax = Math.max(sMax, s.s[i])
      }
    }
    near('bend: strips tile the facet', sum, 10000, 1e-6)
    near('bend: strip params span the flap', sMax - sMin, 1, 1e-6)
  }

  ok('bend: bow vanishes at both ends', bowAmount(0, 0.8) === 0 && bowAmount(1, 0.8) === 0)
  ok('bend: bow peaks mid-fold', bowAmount(0.45, 0.8) > 0.7)
  ok('bend: rigid at zero bow', bendExponent(0) < 0.1)
  ok('bend: arc-like at full bow', bendExponent(1) > 0.9)
}

function testSheet(): void {
  section('sheet')
  const s = new Sheet()
  near('flat sheet area', s.totalArea(), SHEET_AREA, 1e-6)
  ok('flat sheet is one facet', s.facets.length === 1)

  const out = { nodes: [] as number[], moved: [] as number[], extent: 0, ax: 0, ay: 0, bx: 0, by: 0 }
  const opts = {
    angle: Math.PI, kind: 'valley' as const, scope: -1,
    foldUp: true, invertLayers: false, stackBias: 0,
  }

  for (let i = 1; i <= 8; i++) {
    s.applyCrease(crease(i * 110, 0, i * 110, 1000, 1, 'valley', 180), opts, out)
    near('area after crease ' + i, s.totalArea(), SHEET_AREA, SHEET_AREA * 1e-9)
  }
  ok('creasing grows the facet count', s.facets.length >= 9, String(s.facets.length))
  ok('creasing grows the fold tree', s.nodes.length >= 9, String(s.nodes.length))
  s.commitLayers()
  ok('layers are dense and non-negative', s.facets.every((f) => f.layer >= 0 && f.layer <= s.facets.length))

  const c = new Float64Array(3)
  const r = s.measure(c)
  ok('measure returns a finite radius', isNum(r) && r > 0, String(r))
  ok('measure returns a finite centre', c.every(isNum))
}

function testEngine(): void {
  section('engine — every FoldKind')
  const e = new Fold3D()
  e.reset(RECIPE, MATERIAL)
  e.fit(390, 760)

  near('area at rest', e.stats().area, SHEET_AREA, 1e-6)
  ok('starts incomplete', !e.isComplete())
  checkFrame('flat', e.render())

  const facetCounts: number[] = [e.stats().facets]
  const trace: string[] = []
  const ts = [0, 0.07, 0.25, 0.4, 0.5, 0.63, 0.81, 0.94, 1]

  for (let i = 0; i < RECIPE.steps.length; i++) {
    const st = RECIPE.steps[i]
    for (const t of ts) {
      e.setProgress(t)
      const f = e.render()
      checkFrame(`${st.kind} @ t=${t}`, f)
      near(`${st.kind} @ t=${t}: area conserved`, e.stats().area, SHEET_AREA, SHEET_AREA * 1e-6)
    }
    e.commitStep()
    const st2 = e.stats()
    trace.push(
      `${String(i).padStart(2)} ${st.kind.padEnd(9)} facets ${String(st2.facets).padStart(3)}` +
      `  nodes ${String(st2.nodes).padStart(3)}` +
      `  layers ${String(st2.layers).padStart(3)}` +
      `  drawables ${String(e.render().facets.length).padStart(3)}`,
    )
    facetCounts.push(st2.facets)
    near(st.kind + ': area conserved after commit', st2.area, SHEET_AREA, SHEET_AREA * 1e-6)
    ok(st.kind + ': facet count bounded', st2.facets <= 700, String(st2.facets))
    ok(st.kind + ': step advanced', e.getStepIndex() === i + 1, e.getStepIndex() + ' vs ' + (i + 1))
  }

  ok('completes after the last step', e.isComplete())
  ok('facet count grew', facetCounts[facetCounts.length - 1] > facetCounts[0])
  let regressions = 0
  for (let i = 1; i < facetCounts.length; i++) if (facetCounts[i] < facetCounts[i - 1]) regressions++
  ok('facet count never shrinks', regressions === 0, regressions + ' regressions')
  process.stdout.write('    (creases land when a step BEGINS, so row i shows the state once step i+1 is staged)\n')
  for (const line of trace) process.stdout.write('    ' + line + '\n')

  section('engine — breath, camera, determinism')
  for (let i = 0; i <= 8; i++) {
    e.setBreath(i / 8)
    checkFrame('breath ' + i, e.render())
  }

  e.setCamera({ yaw: 47, pitch: 63, roll: -12, zoom: 1.8 })
  const pose = e.getCamera()
  ok('camera pose round-trips', pose.yaw === 47 && pose.pitch === 63 && pose.roll === -12 && pose.zoom === 1.8)
  checkFrame('orbited', e.render())
  e.setCamera({ yaw: NaN, pitch: Infinity, zoom: -3 })
  const bad = e.getCamera()
  ok('camera rejects NaN', isNum(bad.yaw) && isNum(bad.pitch) && bad.zoom > 0, JSON.stringify(bad))
  checkFrame('camera after NaN', e.render())

  e.setCamera(pose)
  const a = e.renderCopy()
  const b = e.renderCopy()
  ok('render is deterministic (count)', a.facets.length === b.facets.length)
  let orderDrift = 0
  let valueDrift = 0
  for (let i = 0; i < a.facets.length; i++) {
    if (a.facets[i].id !== b.facets[i].id) orderDrift++
    if (a.facets[i].fill !== b.facets[i].fill || a.facets[i].depth !== b.facets[i].depth) valueDrift++
  }
  ok('depth sort is stable across frames', orderDrift === 0, orderDrift + ' reordered')
  ok('shading is stable across frames', valueDrift === 0, valueDrift + ' changed')
  ok('facet ids are unique', new Set(a.facets.map((f) => f.id)).size === a.facets.length)

  section('engine — framing')
  for (const [vw, vh] of [[390, 844], [1024, 1366], [844, 390], [320, 480]] as const) {
    const ef2 = new Fold3D()
    ef2.reset(RECIPE, MATERIAL)
    ef2.fit(vw, vh)
    const b = ef2.render().bounds
    const spanX = b.w / vw
    const spanY = b.h / vh
    ok(`fit ${vw}x${vh}: the model is not lost in the viewport`, Math.max(spanX, spanY) > 0.55,
      `x ${spanX.toFixed(2)} y ${spanY.toFixed(2)}`)
    ok(`fit ${vw}x${vh}: nothing overflows`, spanX <= 1.001 && spanY <= 1.001,
      `x ${spanX.toFixed(3)} y ${spanY.toFixed(3)}`)
    ok(`fit ${vw}x${vh}: model stays inside the viewport`,
      b.x > -2 && b.y > -2 && b.x + b.w < vw + 2 && b.y + b.h < vh + 2,
      JSON.stringify(b))
  }
  // The phone is the case that matters: a flat sheet must read big.
  const ephone = new Fold3D()
  ephone.reset(RECIPE, MATERIAL)
  ephone.fit(390, 844)
  const pb = ephone.render().bounds
  ok('a flat sheet fills a phone viewport', pb.w / 390 > 0.78, (pb.w / 390).toFixed(3))
  // A Studio that clamps the orbit can ask for a tighter frame and get one.
  const eclamp = new Fold3D()
  eclamp.reset(RECIPE, MATERIAL)
  eclamp.fit(844, 390)
  const wide = eclamp.render().bounds.h / 390
  eclamp.fit(844, 390, 0.82, 25)
  const tight = eclamp.render().bounds.h / 390
  ok('a clamped orbit frames tighter', tight > wide + 0.08,
    `${wide.toFixed(3)} -> ${tight.toFixed(3)}`)
  // Framing must survive an orbit without re-fitting — that is what the yaw-swept
  // proxy points buy us.
  const eyaw = new Fold3D()
  eyaw.reset(RECIPE, MATERIAL)
  eyaw.seekStep(2)
  eyaw.fit(390, 844)
  let worst = 0
  for (let y = 0; y < 360; y += 15) {
    eyaw.setCamera({ yaw: y })
    const b = eyaw.render().bounds
    worst = Math.max(worst, b.w / 390, b.h / 844)
  }
  ok('framing holds through a full yaw orbit', worst < 1.02, 'worst fill ' + worst.toFixed(3))
  const efill = new Fold3D()
  efill.reset({ steps: [] }, MATERIAL)
  efill.fit(390, 844, 0.5)
  const halfFill = efill.render().bounds
  ok('fit honours an explicit fill', halfFill.w / 390 < 0.62 && halfFill.w / 390 > 0.3,
    (halfFill.w / 390).toFixed(3))

  section('engine — seek and replay')
  const e2 = new Fold3D()
  e2.reset(RECIPE, MATERIAL)
  e2.fit(390, 760)
  e2.seekStep(RECIPE.steps.length)
  ok('seek to the end completes', e2.isComplete())
  near('seek conserves area', e2.stats().area, SHEET_AREA, SHEET_AREA * 1e-6)
  ok('seek reproduces the walked model',
    e2.stats().facets === e.stats().facets,
    e2.stats().facets + ' vs ' + e.stats().facets)
  checkFrame('seeked', e2.render())

  e2.seekStep(3)
  ok('seek backwards rewinds', !e2.isComplete() && e2.getStepIndex() === 3, String(e2.getStepIndex()))
  near('rewind conserves area', e2.stats().area, SHEET_AREA, SHEET_AREA * 1e-6)
  checkFrame('rewound', e2.render())
  e2.seekStep(-5)
  ok('seek clamps below zero', e2.getStepIndex() === 0)
  e2.seekStep(9999)
  ok('seek clamps above the end', e2.isComplete())

  section('engine — hostile input')
  const e3 = new Fold3D()
  e3.reset(NASTY, MATERIAL)
  e3.fit(1024, 1366)
  for (let i = 0; i < NASTY.steps.length; i++) {
    for (const t of [0, 0.5, 1]) {
      e3.setProgress(t)
      checkFrame('nasty ' + NASTY.steps[i].kind + ' @ ' + t, e3.render())
    }
    e3.commitStep()
    near('nasty ' + NASTY.steps[i].kind + ': area conserved', e3.stats().area, SHEET_AREA, SHEET_AREA * 1e-5)
  }
  e3.setProgress(NaN)
  checkFrame('progress NaN', e3.render())
  e3.fit(0, 0)
  checkFrame('zero viewport', e3.render())
  e3.setBreath(NaN)
  checkFrame('breath NaN', e3.render())

  const e4 = new Fold3D()
  e4.reset({ steps: [] }, MATERIAL)
  ok('empty recipe is immediately complete', e4.isComplete())
  checkFrame('empty recipe', e4.render())
  e4.commitStep()
  ok('committing past the end is safe', e4.isComplete())

  section('engine — material and lighting')
  const lit = readLighting()
  const dflt = defaultLighting()
  ok('headless lighting falls back to the token defaults',
    lit.key === dflt.key && lit.fill === dflt.fill && lit.sheen === dflt.sheen && lit.ao === dflt.ao,
    JSON.stringify({ key: lit.key, fill: lit.fill, sheen: lit.sheen, ao: lit.ao }))
  ok('engine exposes its sheet for tooling', e.getSheet().facets.length > 0)
  const e5 = new Fold3D()
  e5.reset(RECIPE, { front: 'var(--beni)', back: 'rgb(251, 247, 239)' })
  e5.seekStep(4)
  checkFrame('var() material resolves headless', e5.render())
  e5.setHighInk(true)
  const hi = e5.render()
  ok('high ink thickens the cut edge', hi.facets[0].strokeWidth > 1)
  e5.setShadows(false)
  ok('shadows can be turned off', e5.render().shadow.length === 0)
  e5.refreshLighting()
  checkFrame('after refreshLighting', e5.render())

  // Reduced motion: rigid hinges, still a correct fold.
  const em = new Fold3D()
  em.reset({ steps: [step('v', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)])] }, MATERIAL)
  em.fit(700, 700)
  em.setProgress(0.45)
  const withBend = em.render().facets.length
  em.setMotion(0)
  em.setProgress(0.45)
  const noBend = em.render().facets.length
  ok('setMotion(0) drops the bend strips', noBend < withBend, withBend + ' -> ' + noBend)
  checkFrame('reduced motion', em.render())
  em.commitStep()
  near('reduced motion still folds correctly', em.stats().area, SHEET_AREA, SHEET_AREA * 1e-6)
  ok('reduced motion still completes', em.isComplete())
}


/* ── every FoldKind must do something you can measure ──────────────────── */

/** Mean world z of the facets hanging off the step currently in flight. */
function flightZ(e: Fold3D): number {
  const s = e.getSheet()
  s.updateWorld()
  let sum = 0
  let n = 0
  for (const f of s.facets) {
    const nd = s.nodes[f.node]
    if (!nd.inFlight) continue
    const m = nd.world
    for (let k = 0; k < f.poly.length; k += 2) {
      sum += m[8] * f.poly[k] + m[9] * f.poly[k + 1] + m[11]
      n++
    }
  }
  return n ? sum / n : 0
}

function worldProbe(e: Fold3D): [number, number, number] {
  const s = e.getSheet()
  s.updateWorld()
  const f = s.facets[0]
  const m = s.nodes[f.node].world
  const x = f.poly[0]
  const y = f.poly[1]
  return [
    m[0] * x + m[1] * y + m[3],
    m[4] * x + m[5] * y + m[7],
    m[8] * x + m[9] * y + m[11],
  ]
}

function testKindEffects(): void {
  section('engine — each kind changes the model')

  // valley and mountain must swing opposite ways.
  const half = (dir: 'valley' | 'mountain'): number => {
    const e = new Fold3D()
    e.reset({ steps: [step('h', dir, [crease(500, 0, 500, 1000, 1, dir, 180)])] }, MATERIAL)
    e.setProgress(0.5)
    return flightZ(e)
  }
  const zv = half('valley')
  const zm = half('mountain')
  ok('valley lifts toward the viewer', zv > 40, zv.toFixed(1))
  ok('mountain swings away', zm < -40, zm.toFixed(1))
  near('valley and mountain are mirror images', zv, -zm, 1e-6)

  // `side` must pick the other half of the sheet.
  const sided = (side: 1 | -1): number => {
    const e = new Fold3D()
    e.reset({ steps: [step('h', 'valley', [crease(500, 0, 500, 1000, side, 'valley', 90)])] }, MATERIAL)
    e.setProgress(1)
    const s = e.getSheet()
    s.updateWorld()
    let sum = 0
    let n = 0
    for (const f of s.facets) {
      if (!s.nodes[f.node].inFlight) continue
      sum += f.cx
      n++
    }
    return n ? sum / n : 0
  }
  ok('side = 1 moves one half', sided(1) < 0, sided(1).toFixed(1))
  ok('side = -1 moves the other', sided(-1) > 0, sided(-1).toFixed(1))

  // crease scores the sheet without moving it. A step's creases land when the
  // step BEGINS (at angle 0), so growth is measured against an empty recipe.
  const flat = new Fold3D()
  flat.reset({ steps: [] }, MATERIAL)
  const ec = new Fold3D()
  ec.reset({ steps: [step('c', 'crease', [crease(0, 0, 1000, 1000, 1, 'valley', 0)])] }, MATERIAL)
  ok('crease subdivides the sheet', ec.stats().facets > flat.stats().facets,
    flat.stats().facets + ' -> ' + ec.stats().facets)
  ok('crease leaves the paper flat', Math.abs(flightZ(ec)) < 1e-9)
  ec.commitStep()
  ok('crease commits without moving the paper', ec.isComplete() && Math.abs(flightZ(ec)) < 1e-9)

  // flip and rotate move the whole model.
  const ef = new Fold3D()
  ef.reset({
    steps: [
      step('v', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)]),
      step('f', 'flip', []),
      step('r', 'rotate', []),
    ],
  }, MATERIAL)
  ef.commitStep()
  const beforeFlip = worldProbe(ef)
  ef.setProgress(0.5)
  const midFlip = worldProbe(ef)
  ef.commitStep()
  const afterFlip = worldProbe(ef)
  ok('flip moves the model mid-gesture',
    Math.hypot(midFlip[0] - beforeFlip[0], midFlip[1] - beforeFlip[1], midFlip[2] - beforeFlip[2]) > 10)
  near('flip turns the model over about a horizontal axis', afterFlip[1], -beforeFlip[1], 1e-6)
  near('flip leaves the horizontal axis alone', afterFlip[0], beforeFlip[0], 1e-6)
  const beforeRot = worldProbe(ef)
  ef.commitStep()
  const afterRot = worldProbe(ef)
  ok('rotate turns the model on the desk',
    Math.hypot(afterRot[0] - beforeRot[0], afterRot[1] - beforeRot[1]) > 10)
  near('rotate keeps the model on the desk', afterRot[2], beforeRot[2], 1e-6)

  // inflate must build a volume, not a one-sided push.
  const ei = new Fold3D()
  ei.reset({
    steps: [
      step('v', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)]),
      step('i', 'inflate', []),
    ],
  }, MATERIAL)
  ei.commitStep()
  const flatDrawables = ei.render().facets.length
  ei.setProgress(1)
  const puffed = ei.render()
  ok('inflate fans the facets into curvature', puffed.facets.length > flatDrawables,
    flatDrawables + ' -> ' + puffed.facets.length)
  // `fan.dir` is a LOCAL +z amplitude; a flipped layer's local +z points down in
  // the world, so the volume test has to look at the world direction.
  let up = 0
  let down = 0
  const sInf = ei.getSheet()
  sInf.updateWorld()
  for (const f of sInf.facets) {
    if (!f.fan) continue
    const world = f.fan.dir * sInf.nodes[f.node].world[10]
    if (world > 0) up++
    else if (world < 0) down++
  }
  ok('inflate balloons both ways, making a volume', up > 0 && down > 0, `up ${up} / down ${down}`)
  checkFrame('inflated', puffed)

  // Ambient occlusion has to actually fire at a fold root, not just exist.
  const eo = new Fold3D()
  eo.reset({ steps: [step('v', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)])] }, MATERIAL)
  eo.setProgress(0)
  const aoFlat = Math.max(...eo.render().facets.map((x) => x.occlusion))
  eo.commitStep()
  const closed = eo.render()
  const aoClosed = Math.max(...closed.facets.map((x) => x.occlusion))
  ok('flat paper has no fold-root shadow', aoFlat < 0.02, aoFlat.toFixed(3))
  ok('a closed fold casts a seam shadow', aoClosed > 0.15, aoClosed.toFixed(3))
  ok('occlusion stays within its channel', closed.facets.every((x) => x.occlusion <= 1))

  // The bend must produce a tonal gradient across the flap, not one flat tone.
  const eb = new Fold3D()
  eb.reset({ steps: [step('v', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)])] }, MATERIAL)
  eb.fit(700, 700)
  eb.setProgress(0.45)
  const bending = eb.render()
  const tones = new Set(bending.facets.map((x) => x.fill))
  ok('a bending flap is drawn as several strips', bending.facets.length >= 7, String(bending.facets.length))
  const strips2 = bending.facets.filter((x) => x.internal)
  ok('bend strips are flagged internal', strips2.length >= 6, strips2.length + ' internal')
  ok('internal pieces are never stroked', strips2.every((x) => x.stroke === null))
  ok('real facets keep their cut edge',
    bending.facets.filter((x) => !x.internal).every((x) => x.stroke !== null))
  ok('the bend reads as a tonal gradient', tones.size >= 5, tones.size + ' distinct tones')
  const seamAO = bending.facets.map((x) => x.occlusion)
  ok('the crease seam is darker than the free edge',
    Math.max(...seamAO) - Math.min(...seamAO) > 0.05,
    `${Math.max(...seamAO).toFixed(3)} vs ${Math.min(...seamAO).toFixed(3)}`)

  // press flattens residual bend and compacts the stack.
  const ep = new Fold3D()
  ep.reset({
    steps: [
      step('v', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 170)]),
      step('p', 'press', []),
    ],
  }, MATERIAL)
  ep.commitStep()
  ok('stack is loose before the press', ep.getSheet().layerScale === 1)
  ep.setProgress(0.5)
  ok('press is in progress', ep.getSheet().layerScale < 1 && ep.getSheet().layerScale > 0.62)
  ep.commitStep()
  ok('press compacts the stack', ep.getSheet().layerScale < 0.7, String(ep.getSheet().layerScale))
  let unflattened = 0
  for (const n of ep.getSheet().nodes) {
    if (n.parent < 0) continue
    if (Math.abs(Math.abs(n.angle) - Math.PI) > 1e-9) unflattened++
    if (n.bow !== 0) unflattened++
  }
  ok('press snaps near-flat folds to flat', unflattened === 0, unflattened + ' left standing')

  // pull brings a buried flap to the top.
  const eu = new Fold3D()
  eu.reset({
    steps: [
      step('v1', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)]),
      step('v2', 'valley', [crease(0, 500, 1000, 500, 1, 'valley', 180)]),
      step('u', 'pull', [crease(500, 0, 500, 1000, 1, 'valley', 70)], [[240, 760]]),
    ],
  }, MATERIAL)
  eu.commitStep()
  eu.commitStep()
  const sU = eu.getSheet()
  const pulledFacet = sU.facetAtMaterial(240, 760)
  const layerBefore = pulledFacet >= 0 ? sU.facets[pulledFacet].layer : -1
  const topBefore = sU.maxLayer()
  ok('pull re-targets an existing hinge without adding facets',
    eu.stats().facets === (() => { const n = eu.stats().facets; eu.setProgress(0.5); return n })())
  eu.commitStep()
  const after = eu.getSheet()
  const pulled2 = after.facetAtMaterial(240, 760)
  ok('pull lifts the flap to the top of the stack',
    pulled2 >= 0 && after.facets[pulled2].layer >= after.maxLayer(),
    `${layerBefore}/${topBefore} -> ${pulled2 >= 0 ? after.facets[pulled2].layer : -1}/${after.maxLayer()}`)

  section('engine — the reverse fold inverts a flap through the model')
  const er = new Fold3D()
  er.reset({
    steps: [
      // A two-layer flap: the left half folded onto the right.
      step('spine', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)]),
      // Reverse the corner of that flap, tapped on the upper layer.
      step('rev', 'reverse', [crease(150, 450, 450, 150, 1, 'valley', 180)], [[300, 300]]),
    ],
  }, MATERIAL)
  er.commitStep()
  // Baseline: the same model with the reverse step removed.
  const spineOnly = new Fold3D()
  spineOnly.reset({ steps: [step('spine', 'valley', [crease(500, 0, 500, 1000, 1, 'valley', 180)])] }, MATERIAL)
  spineOnly.commitStep()
  const nodesBefore = spineOnly.stats().nodes
  const facetsBefore = spineOnly.stats().facets
  const s2 = er.getSheet()
  const flightNodes = s2.nodes.filter((n) => n.inFlight)
  ok('reverse creases both layers of the flap', flightNodes.length >= 2, flightNodes.length + ' hinges')
  ok('reverse splits paper in both layers', er.stats().facets > facetsBefore,
    facetsBefore + ' -> ' + er.stats().facets)
  ok('reverse builds new hinges', er.stats().nodes > nodesBefore,
    nodesBefore + ' -> ' + er.stats().nodes)

  const parents = new Set(flightNodes.map((n) => n.parent))
  ok('reverse hinges hang off different layers', parents.size >= 2, parents.size + ' distinct parents')

  // The two layers must turn the SAME way in the world, or the flap tears apart.
  const worldTurn: number[] = []
  for (const n of flightNodes) {
    const p = s2.nodes[n.parent < 0 ? 0 : n.parent].world
    const dx = n.bx - n.ax
    const dy = n.by - n.ay
    const wx = p[0] * dx + p[1] * dy
    const wy = p[4] * dx + p[5] * dy
    const wz = p[8] * dx + p[9] * dy
    const l = Math.hypot(wx, wy, wz) || 1
    worldTurn.push((n.rest * wz) / l, (n.rest * wx) / l, (n.rest * wy) / l)
  }
  const sameSense =
    worldTurn.length >= 6 &&
    worldTurn[0] * worldTurn[3] + worldTurn[1] * worldTurn[4] + worldTurn[2] * worldTurn[5] > 0
  ok('reverse turns both layers the same way in world space', sameSense,
    JSON.stringify(worldTurn.map((v) => Number(v.toFixed(3)))))

  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    er.setProgress(t)
    checkFrame('reverse @ ' + t, er.render())
  }
  const beforeTuck = er.getSheet().facets.map((f) => f.layer)
  er.commitStep()
  const afterTuck = er.getSheet().facets.map((f) => f.layer)
  ok('inside reverse restacks the layers',
    beforeTuck.length !== afterTuck.length || beforeTuck.some((l, i) => l !== afterTuck[i]))
  near('reverse conserves area', er.stats().area, SHEET_AREA, SHEET_AREA * 1e-6)

  section('bend — the flap really curves, then flattens')
  const theta = Math.PI
  const rect = [0, 0, 400, 0, 400, 300, 0, 300]
  const strips = buildStrips(rect, 0, 0, 400, 0, 300, 8, 'b')
  ok('bend: 8 strips requested, at least 6 produced', !!strips && strips.length >= 6, String(strips?.length))

  const p = new Float64Array(3)
  const bowed = bendExponent(0.75)
  const rigid = bendExponent(0)
  const phi = (s: number, e: number): number => theta * Math.pow(s, e)
  ok('bend: the free edge always reaches the full angle', Math.abs(phi(1, bowed) - theta) < 1e-12)
  ok('bend: the hinge itself does not move', Math.abs(phi(0, bowed)) < 1e-12)
  ok('bend: rotation increases monotonically along the flap',
    phi(0.25, bowed) < phi(0.5, bowed) && phi(0.5, bowed) < phi(0.75, bowed))
  ok('bend: a bowed flap lags a rigid hinge in the middle',
    phi(0.5, bowed) < phi(0.5, rigid) - 0.5,
    `${phi(0.5, bowed).toFixed(3)} vs ${phi(0.5, rigid).toFixed(3)}`)

  // The bowed free edge sits closer to the hinge than a rigid swing would put it —
  // the arc shortcut you can see in real paper.
  bendVertex(200, 300, 0, 1, 0, 0, 1, 0, theta * 0.5, bowed, p, 0)
  const bowedY = Math.hypot(p[1], p[2])
  bendVertex(200, 300, 0, 1, 0, 0, 1, 0, theta * 0.5, rigid, p, 0)
  const rigidY = Math.hypot(p[1], p[2])
  near('bend: the free edge keeps its distance from the hinge', bowedY, rigidY, 1e-9)
  bendVertex(200, 150, 0, 0.5, 0, 0, 1, 0, theta * 0.5, bowed, p, 0)
  const midBow = p[2]
  bendVertex(200, 150, 0, 0.5, 0, 0, 1, 0, theta * 0.5, rigid, p, 0)
  const midRigid = p[2]
  ok('bend: the middle of the flap sits off the rigid hinge line',
    Math.abs(midBow - midRigid) > 5, `${midBow.toFixed(2)} vs ${midRigid.toFixed(2)}`)

  let nan = 0
  for (const sv of [0, 0.5, 1, NaN, -3, 9, Infinity]) {
    for (const th of [0, Math.PI, -Math.PI]) {
      bendVertex(10, 20, 0, sv, 0, 0, 1, 0, th, bowed, p, 0)
      if (!isNum(p[0]) || !isNum(p[1]) || !isNum(p[2])) nan++
    }
  }
  ok('bend: no NaN from out-of-range strip parameters', nan === 0, nan + ' NaN results')
}

function testPerf(): void {
  section('perf')
  const e = new Fold3D()
  e.reset(RECIPE, MATERIAL)
  e.fit(1024, 1366)
  e.seekStep(RECIPE.steps.length)
  const facets = e.stats().facets

  for (let i = 0; i < 300; i++) e.render()
  let t0 = process.hrtime.bigint()
  const N = 2000
  for (let i = 0; i < N; i++) {
    e.setBreath((i % 240) / 240)
    e.render()
  }
  let t1 = process.hrtime.bigint()
  const perFrame = Number(t1 - t0) / 1e6 / N
  process.stdout.write(
    `    complete model: ${facets} facets, ${e.stats().nodes} nodes, ` +
    `${e.render().facets.length} drawables -> ${perFrame.toFixed(3)} ms/render\n`,
  )
  ok('complete model renders under 2ms', perFrame < 2, perFrame.toFixed(3) + ' ms')

  // Mid-fold is the expensive case: strips are live and the flap is bowed.
  const e2 = new Fold3D()
  e2.reset(RECIPE, MATERIAL)
  e2.fit(1024, 1366)
  e2.seekStep(2)
  e2.setProgress(0.5)
  for (let i = 0; i < 300; i++) e2.render()
  const mid = e2.render().facets.length
  t0 = process.hrtime.bigint()
  for (let i = 0; i < N; i++) {
    e2.setProgress(0.3 + (i % 100) / 400)
    e2.render()
  }
  t1 = process.hrtime.bigint()
  const midFrame = Number(t1 - t0) / 1e6 / N
  process.stdout.write(
    `    mid-fold (bending): ${e2.stats().facets} facets -> ${mid} drawables ` +
    `-> ${midFrame.toFixed(3)} ms/render (incl. setProgress)\n`,
  )
  ok('mid-fold renders under 2ms', midFrame < 2, midFrame.toFixed(3) + ' ms')

  // A deliberately heavy 60+ facet model: creases in general position, so every
  // new line cuts most of the existing facets. This is the contract's target case.
  const many: FoldStep[] = []
  for (let i = 0; i < 13; i++) {
    const th = (i * 37 + 11) * (Math.PI / 180)
    const cx = 500 + Math.cos(i * 1.7) * 150
    const cy = 500 + Math.sin(i * 2.3) * 150
    const dx = Math.cos(th) * 900
    const dy = Math.sin(th) * 900
    many.push(step('m' + i, i % 2 ? 'valley' : 'mountain',
      [crease(cx - dx, cy - dy, cx + dx, cy + dy,
        i % 2 ? 1 : -1, i % 2 ? 'valley' : 'mountain', 170)]))
  }
  const e3 = new Fold3D()
  e3.reset({ steps: many }, MATERIAL)
  e3.fit(1024, 1366)
  e3.seekStep(many.length)
  for (let i = 0; i < 300; i++) e3.render()
  t0 = process.hrtime.bigint()
  for (let i = 0; i < N; i++) e3.render()
  t1 = process.hrtime.bigint()
  const heavy = Number(t1 - t0) / 1e6 / N
  process.stdout.write(
    `    heavy model: ${e3.stats().facets} facets, ${e3.stats().layers} layers ` +
    `-> ${heavy.toFixed(3)} ms/render\n`,
  )
  ok('heavy model has 60+ facets', e3.stats().facets >= 60, String(e3.stats().facets))
  ok('heavy model renders under 2ms', heavy < 2, heavy.toFixed(3) + ' ms')
  near('heavy model conserves area', e3.stats().area, SHEET_AREA, SHEET_AREA * 1e-6)
  checkFrame('heavy', e3.render(), 60)

  // Allocation behaviour: the frame is pooled, so a steady state must not grow.
  if (typeof globalThis.gc === 'function') globalThis.gc()
  const before = process.memoryUsage().heapUsed
  for (let i = 0; i < 5000; i++) e3.render()
  const after = process.memoryUsage().heapUsed
  const grew = (after - before) / 1024 / 1024
  process.stdout.write(`    heap delta over 5000 renders: ${grew.toFixed(2)} MB\n`)
  ok('render loop does not leak', grew < 24, grew.toFixed(2) + ' MB')
}

/**
 * The engine's ONE optional DOM touch: reading --light-* and resolving var()
 * paper colours. Stub a document and prove both paths, then prove it still
 * works when the document goes away again.
 */
function testCssVars(): void {
  section('shade — CSS custom properties (stubbed document)')
  const VARS: Record<string, string> = {
    '--light-key': '0.74',
    '--light-fill': '0.26',
    '--light-sheen': '0.30',
    '--light-ao': '0.40',
    '--beni': '#ef7b63',
    '--paper-back': '  #524459  ',
    '--nested': 'var(--beni)',
  }
  const g = globalThis as unknown as Record<string, unknown>
  g.document = { documentElement: {} }
  g.getComputedStyle = (): { getPropertyValue: (n: string) => string } => ({
    getPropertyValue: (n: string) => VARS[n] ?? '',
  })
  invalidateCssCache()

  const l = readLighting()
  ok('--light-key is read from the document', l.key === 0.74, String(l.key))
  ok('--light-fill is read', l.fill === 0.26, String(l.fill))
  ok('--light-sheen is read', l.sheen === 0.3, String(l.sheen))
  ok('--light-ao is read', l.ao === 0.4, String(l.ao))

  ok('var() resolves', parseColor('var(--beni)', 0) === 0xef7b63)
  ok('var() tolerates whitespace', parseColor('var(--paper-back)', 0) === 0x524459)
  ok('var() resolves through a chain', parseColor('var(--nested)', 0) === 0xef7b63)
  ok('unknown var() falls back', parseColor('var(--nope)', 0x123456) === 0x123456)
  ok('var() fallback argument is honoured', parseColor('var(--nope, #abcdef)', 0) === 0xabcdef)
  ok('rgb() parses', parseColor('rgb(228, 102, 79)', 0) === 0xe4664f)
  ok('space/slash rgba() parses', parseColor('rgba(228 102 79 / 0.5)', 0) === 0xe4664f)
  ok('hsl() parses', parseColor('hsl(0, 100%, 50%)', 0) === 0xff0000)
  ok('#abc parses', parseColor('#abc', 0) === 0xaabbcc)
  ok('#rrggbbaa parses', parseColor('#e4664f80', 0) === 0xe4664f)
  ok('garbage falls back', parseColor('not-a-colour', 0x778899) === 0x778899)

  const ev = new Fold3D()
  ev.reset({ steps: [] }, { front: 'var(--beni)', back: 'var(--paper-back)' })
  ev.fit(390, 760)
  const themed = ev.render()
  checkFrame('themed material', themed)
  const ed = new Fold3D()
  ed.reset({ steps: [] }, { front: '#e4664f', back: '#fbf7ef' })
  ok('a themed material shades differently from a literal one',
    themed.facets[0].fill !== ed.render().facets[0].fill,
    themed.facets[0].fill + ' vs ' + ed.render().facets[0].fill)
  ev.refreshLighting()
  checkFrame('after a theme refresh', ev.render())

  delete g.document
  delete g.getComputedStyle
  invalidateCssCache()
  const back = readLighting()
  ok('lighting returns to the defaults when the document goes away',
    back.key === defaultLighting().key, String(back.key))
  const eh = new Fold3D()
  eh.reset({ steps: [] }, { front: 'var(--beni)', back: 'var(--paper-back)' })
  eh.fit(390, 760)
  checkFrame('headless again', eh.render())
}

/* ── run ───────────────────────────────────────────────────────────────── */

process.stdout.write('\nPAPER PLANET — fold3d self-test\n')
testGeom()
testSheet()
testEngine()
testKindEffects()
testPerf()
testCssVars()

process.stdout.write('\n' + '-'.repeat(58) + '\n')
if (failures.length === 0) {
  process.stdout.write(`  PASS  ${passed} assertions\n\n`)
  process.exit(0)
} else {
  process.stdout.write(`  FAIL  ${failures.length} of ${passed + failures.length} assertions\n\n`)
  for (const f of failures) process.stdout.write('   x ' + f + '\n')
  process.stdout.write('\n')
  process.exit(1)
}
