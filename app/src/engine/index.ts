// PAPER PLANET — fold3d: the public FoldEngine. Pure TypeScript, no React, no DOM (bar one CSS read).

import type {
  CameraPose, Crease, FoldEngine, FoldKind, FoldRecipe, FoldStep,
  PaperMaterial, Vec2,
} from '../contracts'
import type { CreaseResult, SheetIntegrity } from './sheet'
import { Sheet, orientAxis } from './sheet'
import { OrbitCamera } from './camera'
import { Shader, invalidateCssCache, readLighting } from './shade'
import { Renderer } from './render'
import type { PaperFrame, RenderOptions } from './render'
import type { StepPlan } from './types'
import { HALF } from './types'
import { bowAmount, bowStrengthFor, buildFan, buildStrips, flapExtent, stripCount } from './bend'
import { DEG, EPS, clamp, clamp01, finite, matRotAboutPoint, smoothstep } from './geom'

export { Sheet, emptyIntegrity } from './sheet'
export type { SheetIntegrity, CreaseResult, CreaseOptions } from './sheet'
export { OrbitCamera } from './camera'
export { Shader, readLighting, parseColor, foldOcclusion } from './shade'
export { Renderer } from './render'
export type { PaperFacet, PaperFrame, RenderOptions } from './render'
export * from './geom'
export * from './types'
export * from './bend'

const DEFAULT_MATERIAL: PaperMaterial = { front: 'var(--paper-1)', back: 'var(--paper-back)' }
const EMPTY_RECIPE: FoldRecipe = { steps: [] }

/** How much a completed model swells as it breathes. BRAND section 7: 1 -> 1.018. */
const BREATH_AMP = 0.018
/** A pressed stack is measurably thinner than a loose one. */
const PRESSED_STACK = 0.62
/** How much of the viewport the model spans after fit(). */
const DEFAULT_FILL = 0.82
/**
 * Degrees of yaw the framing stays safe for. 90 covers a free orbit; a Studio
 * that clamps the orbit can pass its own limit and get a noticeably bigger model.
 */
const DEFAULT_ORBIT = 90
/** Default studio framing: a touch off-axis, a touch of desk. Nothing machine-perfect. */
const DEFAULT_POSE: CameraPose = { yaw: -6, pitch: 18, roll: -1.2, zoom: 1 }

interface Snapshot {
  angle: Float64Array
  layerScale: number
  inflate: number
}

/**
 * fold3d.
 *
 * The sheet is a planar subdivision of facets over a fold tree. Creasing splits
 * every facet that straddles the axis and re-parents the moving halves into
 * fresh hinges, so folding through eight layers is eight sibling rotations about
 * one line in space. Rendering projects, shades and depth-sorts those facets,
 * offsetting each stacked sheet along its normal by half a unit so the stack has
 * real thickness you can see at its edge.
 */
export class Fold3D implements FoldEngine {
  private sheet = new Sheet()
  private camera = new OrbitCamera()
  private shader = new Shader()
  private renderer: Renderer

  private recipe: FoldRecipe = EMPTY_RECIPE
  private material: PaperMaterial = DEFAULT_MATERIAL
  private stepIndex = 0
  private committed = 0
  private progress = 0
  private plan: StepPlan | null = null
  private pressFrom: Snapshot | null = null
  private breath = 0
  private motion = 1
  private vw = 390
  private vh = 640
  private centre = new Float64Array(3)
  private fitBuf = new Float64Array(8192)
  private fitFill = DEFAULT_FILL
  private fitOrbit = DEFAULT_ORBIT
  private cres: CreaseResult = { nodes: [], moved: [], extent: 0, ax: 0, ay: 0, bx: 0, by: 0, group: 0 }
  private axisBuf = new Float64Array(4)
  private opts: RenderOptions = {
    hintFrom: null, hintTo: null, targets: [], axisFrom: null, axisTo: null, shadow: true,
  }

  constructor() {
    this.renderer = new Renderer(this.sheet, this.camera, this.shader)
    readLighting(this.shader.light)
    this.shader.setMaterial(DEFAULT_MATERIAL)
    this.camera.setPose(DEFAULT_POSE)
    this.refit()
  }

  /* ══ FoldEngine ═══════════════════════════════════════════════════════ */

  reset(recipe: FoldRecipe, material: PaperMaterial): void {
    this.recipe = recipe && Array.isArray(recipe.steps) ? recipe : EMPTY_RECIPE
    this.material = material ?? DEFAULT_MATERIAL
    invalidateCssCache()
    readLighting(this.shader.light)
    this.shader.setMaterial(this.material)
    this.camera.setPose(DEFAULT_POSE)
    this.rebuild(0)
  }

  seekStep(index: number): void {
    const n = this.recipe.steps.length
    this.rebuild(clamp(Math.round(finite(index, 0)), 0, n))
  }

  /**
   * Drive the current step. Angles track `t` one-to-one so the paper stays glued
   * to the finger; the *bow* is what carries the physicality. Callers animating
   * an auto-complete should ease `t` themselves (BRAND: --ease-crisp).
   */
  setProgress(t: number): void {
    const p = clamp01(finite(t, 0))
    this.progress = p
    const plan = this.plan
    if (!plan) return
    const sheet = this.sheet
    const nodes = sheet.nodes

    if (plan.press) {
      this.applyPress(p)
      return
    }

    for (let i = 0; i < plan.nodes.length; i++) {
      const node = nodes[plan.nodes[i]]
      if (!node) continue
      const w0 = plan.win0[i]
      const w1 = plan.win1[i]
      const u = w1 > w0 ? clamp01((p - w0) / (w1 - w0)) : p >= w1 ? 1 : 0
      node.angle = plan.from[i] + (plan.rest[i] - plan.from[i]) * u
      node.bow = bowAmount(u, plan.bow * plan.bowScale[i] * this.motion)
    }

    if (plan.model !== 'none') {
      const angle = plan.modelAngle * DEG * p
      sheet.measure(this.centre)
      matRotAboutPoint(
        sheet.pending,
        plan.model === 'flip' ? 0 : 2,
        angle,
        this.centre[0], this.centre[1], this.centre[2],
      )
    }
    if (plan.inflate > 0) {
      // Ease the balloon so it swells rather than snaps.
      sheet.inflate = plan.inflate * smoothstep(0, 1, p)
    }
    sheet.markDirty()
  }

  commitStep(): void {
    const plan = this.plan
    this.setProgress(1)
    const sheet = this.sheet

    if (plan) {
      for (let i = 0; i < plan.nodes.length; i++) {
        const node = sheet.nodes[plan.nodes[i]]
        if (!node) continue
        node.angle = plan.rest[i]
        node.bow = 0
        node.inFlight = false
      }
      sheet.commitLayers()
      if (plan.model !== 'none') {
        // Bake the whole-model turn into the model matrix and clear the pending one.
        const m = sheet.model
        const tmp = new Float64Array(12)
        for (let i = 0; i < 12; i++) tmp[i] = m[i]
        multiplyInto(sheet.pending, tmp, m)
        resetPending(sheet)
      }
      for (let i = 0; i < plan.raise.length; i++) sheet.raiseSubtree(plan.raise[i])
    }
    this.clearTransients()

    if (this.stepIndex < this.recipe.steps.length) {
      this.committed = this.stepIndex + 1
      this.stepIndex = this.committed
    }
    this.beginStep(this.stepIndex)
    if (this.isComplete()) this.applyBreath()
  }

  setCamera(pose: Partial<CameraPose>): void {
    this.camera.setPose(pose)
  }

  getCamera(): CameraPose {
    return this.camera.getPose()
  }

  /**
   * Frame the model in a viewport.
   *
   * `fill` is the fraction of the viewport the model spans; the default leaves a
   * margin for the contact shadow and for a flap swinging wide mid-fold.
   *
   * `orbitDeg` is how far the player may yaw before the framing would need
   * redoing. At the default 90 the framing survives a free orbit, which costs
   * some height when the camera is pitched — pass the Studio's actual orbit
   * clamp (say 30) for a visibly larger model. Call fit() on resize and after
   * commitStep(); it is stable in between.
   */
  fit(
    width: number, height: number,
    fill: number = DEFAULT_FILL, orbitDeg: number = DEFAULT_ORBIT,
  ): void {
    this.vw = Math.max(1, finite(width, 1))
    this.vh = Math.max(1, finite(height, 1))
    this.fitFill = clamp(finite(fill, DEFAULT_FILL), 0.2, 0.99)
    this.fitOrbit = clamp(finite(orbitDeg, DEFAULT_ORBIT), 0, 180)
    this.refit()
  }

  /**
   * Produce a frame. Cheap enough for every rAF.
   *
   * Two things to know:
   *  - the returned frame and everything in it is POOLED and overwritten by the
   *    next call. Read it inside the frame, or take renderCopy() to keep it.
   *  - `hint`, `axis` and `targets` are re-projected from material space every
   *    frame, so they travel with the paper as it folds. Never measure gesture
   *    progress against the live hint: the reference shortens as the fold
   *    closes, which feeds back and snaps the fold shut. Snapshot the anchors
   *    when the gesture starts.
   */
  render(): PaperFrame {
    const step = this.currentStep()
    const o = this.opts
    o.hintFrom = step?.hint?.from ?? null
    o.hintTo = step?.hint?.to ?? null
    o.targets = step?.targets ?? EMPTY_TARGETS
    if (this.plan && this.plan.axisFrom) {
      o.axisFrom = this.plan.axisFrom
      o.axisTo = this.plan.axisTo
    } else {
      o.axisFrom = null
      o.axisTo = null
    }
    return this.renderer.render(o)
  }

  /**
   * Idle life. Facets swell about the model centroid with a phase lag by fold
   * depth, so the breath ripples outward instead of pumping as one blob.
   * Silent until the last step is committed.
   */
  setBreath(phase: number): void {
    this.breath = finite(phase, 0)
    this.applyBreath()
  }

  isComplete(): boolean {
    return this.committed >= this.recipe.steps.length
  }

  /* ══ extensions beyond the contract ═══════════════════════════════════ */

  /** Re-read --light-* and any var() paper colours. Call after a theme change. */
  refreshLighting(): void {
    this.shader.refresh()
  }

  /** Accessibility: heavier cut edges, calmer sheen. */
  setHighInk(on: boolean): void {
    this.shader.highInk = on
    this.shader.strokeWidth = on ? 1.5 : 0.75
  }

  /**
   * Scale the progressive bend. 1 is full paper physics; 0 turns every fold into
   * a rigid hinge, which is what `prefers-reduced-motion` wants. The model still
   * folds correctly at 0 — only the flourish goes away.
   */
  setMotion(scale: number): void {
    this.motion = clamp01(finite(scale, 1))
  }

  /** Turn the contact shadow off for reduced-motion or low-end devices. */
  setShadows(on: boolean): void {
    this.renderer.shadows = on
  }

  /**
   * Where a point of the flat sheet has ended up on screen, or null when that
   * point is not on any facet. Valid against the last render().
   *
   * Public because a caller sometimes needs a point the current step does not
   * name. A crease whose two authored endpoints have been folded onto each
   * other projects to nothing at all, from any camera, and the only way back is
   * to ask for other points along the same line.
   */
  project(p: Vec2): Vec2 | null {
    const out: [number, number] = [0, 0]
    return this.renderer.projectPoint(p, out) ? out : null
  }

  /** A retained deep copy — render()'s frame is pooled and mutated in place. */
  renderCopy(): PaperFrame {
    return this.renderer.snapshot(this.render())
  }

  getStepIndex(): number {
    return this.stepIndex
  }

  getProgress(): number {
    return this.progress
  }

  /** The step being folded right now, or null once the model is finished. */
  currentStep(): FoldStep | null {
    return this.recipe.steps[this.stepIndex] ?? null
  }

  /** Diagnostics for the Studio's debug overlay and for the self-test. */
  stats(): { facets: number; nodes: number; layers: number; area: number; step: number; steps: number } {
    return {
      facets: this.sheet.facets.length,
      nodes: this.sheet.nodes.length,
      layers: this.sheet.maxLayer() + 1,
      area: this.sheet.totalArea(),
      step: this.stepIndex,
      steps: this.recipe.steps.length,
    }
  }

  /**
   * Is the model still one sheet of paper?
   *
   * `severed` is the invariant that matters: a fold that conserves every square
   * unit of area can still hinge two layers about different lines and leave the
   * model in pieces. Cheap enough for a debug overlay or a test; do not call it
   * inside the frame loop.
   */
  integrity(out?: SheetIntegrity): SheetIntegrity {
    return this.sheet.integrity(out)
  }

  /** Escape hatch for tooling. Treat as read-only. */
  getSheet(): Sheet {
    return this.sheet
  }

  /* ══ internals ════════════════════════════════════════════════════════ */

  private rebuild(upTo: number): void {
    this.sheet.reset()
    this.plan = null
    this.pressFrom = null
    this.committed = 0
    this.stepIndex = 0
    this.progress = 0
    resetPending(this.sheet)
    const steps = this.recipe.steps
    const n = clamp(upTo, 0, steps.length)
    for (let i = 0; i < n; i++) {
      this.beginStep(i)
      this.setProgress(1)
      this.commitInPlace()
    }
    this.beginStep(this.stepIndex)
    this.refit()
    this.applyBreath()
  }

  /** commitStep() without re-entering beginStep — used by the replay loop. */
  private commitInPlace(): void {
    const plan = this.plan
    const sheet = this.sheet
    if (plan) {
      for (let i = 0; i < plan.nodes.length; i++) {
        const node = sheet.nodes[plan.nodes[i]]
        if (!node) continue
        node.angle = plan.rest[i]
        node.bow = 0
        node.inFlight = false
      }
      sheet.commitLayers()
      if (plan.model !== 'none') {
        const m = sheet.model
        const tmp = new Float64Array(12)
        for (let i = 0; i < 12; i++) tmp[i] = m[i]
        multiplyInto(sheet.pending, tmp, m)
        resetPending(sheet)
      }
      for (let i = 0; i < plan.raise.length; i++) sheet.raiseSubtree(plan.raise[i])
    }
    this.clearTransients()
    this.committed = this.stepIndex + 1
    this.stepIndex = this.committed
  }

  private clearTransients(): void {
    const facets = this.sheet.facets
    for (let i = 0; i < facets.length; i++) {
      facets[i].strips = null
      facets[i].fan = null
    }
    const nodes = this.sheet.nodes
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].inFlight = false
      nodes[i].bow = 0
    }
    this.plan = null
    this.pressFrom = null
    this.progress = 0
    this.sheet.markDirty()
  }

  private applyBreath(): void {
    const on = this.isComplete()
    this.sheet.breathAmp = on ? BREATH_AMP : 0
    this.sheet.breathPhase = this.breath
  }

  private refit(): void {
    const need = this.sheet.facets.length * 9 * 3 * 5 + 24
    if (this.fitBuf.length < need && need < 1 << 22) this.fitBuf = new Float64Array(need)
    const n = this.sheet.fitProxies(
      this.centre, this.fitBuf, this.fitBuf.length, this.fitOrbit * DEG,
    )
    this.camera.fitTo(
      this.fitBuf, n,
      this.centre[0], this.centre[1], this.centre[2],
      this.vw, this.vh, this.fitFill,
    )
  }

  /* ── step planning: every FoldKind, honestly ──────────────────────────── */

  private beginStep(index: number): void {
    this.clearTransients()
    const step = this.recipe.steps[index]
    if (!step) {
      this.plan = null
      return
    }
    const plan = emptyPlan(step.kind)
    plan.bow = bowStrengthFor(step.kind)
    this.plan = plan

    switch (step.kind) {
      case 'flip':
        plan.model = 'flip'
        plan.modelAngle = magnitude(step, 180)
        break
      case 'rotate':
        plan.model = 'rotate'
        plan.modelAngle = magnitude(step, 90)
        break
      case 'press':
        plan.press = true
        this.capturePress()
        break
      case 'inflate':
        plan.inflate = 1
        this.planInflate()
        break
      case 'reverse':
        this.planReverse(step, plan)
        break
      case 'squash':
      case 'petal':
        this.planPocket(step, plan, step.kind === 'petal')
        break
      case 'pull':
        this.planPull(step, plan)
        break
      default:
        this.planSimple(step, plan)
        break
    }

    this.finishPlan(step, plan)
    this.setProgress(0)
  }

  /** valley / mountain / crease / pinch — fold through every layer on the axis. */
  private planSimple(step: FoldStep, plan: StepPlan): void {
    const creases = step.creases ?? []
    const flat = step.kind === 'crease'
    for (let i = 0; i < creases.length; i++) {
      const c = creases[i]
      const angle = flat ? 0 : signedAngle(c)
      const res = this.crease(c, {
        angle, kind: step.kind, scope: -1,
        foldUp: c.direction === 'valley', invertLayers: false, stackBias: 0,
      })
      if (!res) continue
      // Cascade multi-crease steps very slightly — paper never moves in lockstep.
      const w0 = creases.length > 1 ? Math.min(0.22, i * 0.09) : 0
      this.record(plan, w0, Math.min(1, 0.86 + i * 0.07))
    }
  }

  /**
   * Inside/outside reverse fold — the move that makes heads and tails.
   *
   * A flap is two mirrored layers joined at a spine. The reverse crease crosses
   * BOTH of them, at positions that mirror each other across that spine, so the
   * engine locates the flap under the step's tap target, reflects the crease
   * (and the target) across the spine to find the second layer, then turns both
   * halves about what is the *same* line in world space. Getting the two local
   * rotations to agree in the world is done by comparing the hinge directions
   * after transformation, not by guessing signs.
   *
   * A valley reverse tucks the tip between the layers (inside reverse); a
   * mountain reverse wraps it around the outside.
   */
  private planReverse(step: FoldStep, plan: StepPlan): void {
    const creases = step.creases ?? []
    if (creases.length === 0) return
    const c0 = creases[0]
    const target = step.targets && step.targets.length ? step.targets[0] : midpoint(c0)
    const sheet = this.sheet
    sheet.updateWorld()

    const fi = sheet.facetAtMaterial(target[0], target[1])
    const scope1 = this.resolveScope(fi >= 0 ? sheet.facets[fi].node : 0, c0)
    const spine = sheet.nodes[scope1]
    const inside = c0.direction === 'valley'
    const angle1 = signedAngle(c0, 180)

    if (creases.length >= 2) {
      // The recipe spelled out both layers. Trust it.
      for (let i = 0; i < creases.length; i++) {
        const c = creases[i]
        const t = step.targets && step.targets[i] ? step.targets[i] : midpoint(c)
        const f = sheet.facetAtMaterial(t[0], t[1])
        const res = this.crease(c, {
          angle: signedAngle(c, 180), kind: 'reverse',
          scope: this.resolveScope(f >= 0 ? sheet.facets[f].node : 0, c),
          foldUp: c.direction === 'valley', invertLayers: inside, stackBias: 0,
        })
        if (res) this.record(plan, 0, 1)
      }
      return
    }

    // One crease, every layer. The mirrored second half this used to synthesise
    // is now unnecessary and actively wrong: applyCrease pulls the one line into
    // each layer's own frame, so both faces of the flap turn about the SAME line
    // in space, with the angle sign that makes their world turns agree. Placing
    // a hand-mirrored line on the far layer instead put its crease somewhere
    // else entirely, which is what tore the head off the crane.
    const scope = spine.parent < 0 ? scope1 : reverseScope(sheet, scope1)
    const res = this.crease(c0, {
      angle: angle1, kind: 'reverse', scope,
      foldUp: inside, invertLayers: inside && spine.parent >= 0, stackBias: 0,
    })
    if (res) this.record(plan, 0, 1)
  }

  /**
   * Squash and petal — open a pocket and press it flat.
   *
   * Both are the same machine: symmetric creases that splay a pocket apart, one
   * leading and one trailing so the pocket opens before it flattens. When a
   * recipe supplies only one side, the mirror across the pocket's own spine is
   * synthesised, which is exactly the symmetry the move relies on. A petal adds
   * the lifting crease across the two side creases' far ends, so the point rises
   * as the sides come in.
   */
  private planPocket(step: FoldStep, plan: StepPlan, petal: boolean): void {
    const creases = step.creases ?? []
    if (creases.length === 0) return
    const sheet = this.sheet
    sheet.updateWorld()
    const c0 = creases[0]
    const target = step.targets && step.targets.length ? step.targets[0] : midpoint(c0)
    const fi = sheet.facetAtMaterial(target[0], target[1])
    const scope0 = this.resolveScope(fi >= 0 ? sheet.facets[fi].node : 0, c0)
    const spine = sheet.nodes[scope0]

    let c1: Crease
    let scope1: number
    if (creases.length >= 2) {
      c1 = creases[1]
      const t1 = step.targets && step.targets[1] ? step.targets[1] : midpoint(c1)
      const f1 = sheet.facetAtMaterial(t1[0], t1[1])
      scope1 = this.resolveScope(f1 >= 0 ? sheet.facets[f1].node : scope0, c1)
    } else if (spine.parent >= 0) {
      c1 = mirrorCrease(c0, spine.ax, spine.ay, spine.bx, spine.by)
      const t1 = mirrorPoint(target, spine.ax, spine.ay, spine.bx, spine.by)
      const f1 = sheet.facetAtMaterial(t1[0], t1[1])
      scope1 = this.resolveScope(f1 >= 0 ? sheet.facets[f1].node : scope0, c1)
    } else {
      c1 = flipDirection(c0)
      scope1 = scope0
    }

    const a0 = signedAngle(c0)
    if (this.crease(c0, {
      angle: a0, kind: step.kind, scope: scope0,
      foldUp: c0.direction === 'valley', invertLayers: false, stackBias: 0,
    })) this.record(plan, 0, 0.68)

    // The far side splays the opposite way — that is what makes it a squash and
    // not two folds in the same direction.
    if (this.crease(c1, {
      angle: -signedAngle(c1), kind: step.kind, scope: scope1,
      exclude: scope1 === scope0 ? -1 : scope0,
      foldUp: c1.direction !== 'valley', invertLayers: false, stackBias: 0,
    })) this.record(plan, 0.22, 1)

    if (!petal) return
    const lift = creases.length >= 3 ? creases[2] : liftCrease(c0, c1)
    if (this.crease(lift, {
      angle: signedAngle(lift, 180), kind: 'petal', scope: scope0,
      foldUp: lift.direction === 'valley', invertLayers: false, stackBias: 0,
    })) this.record(plan, 0.3, 1)
  }

  /**
   * Pull a hidden flap out: re-open an existing hinge and lift it to the top.
   *
   * A wing is not one sheet, it is a stack of them held by one crease, and that
   * crease is a whole GROUP of sibling hinges. Re-opening only the hinge under
   * the finger swings one layer and leaves the rest — which is precisely how a
   * crane ends up with a triangle floating loose beside it. So the whole group
   * moves, each sibling to the angle that reproduces one turn in space: the
   * siblings whose axis was flipped when the crease was laid take the opposite
   * sign, which is exactly what the sign of their resting angle records.
   */
  private planPull(step: FoldStep, plan: StepPlan): void {
    const creases = step.creases ?? []
    const sheet = this.sheet
    const c0 = creases.length ? creases[0] : null
    const target = step.targets && step.targets.length
      ? step.targets[0]
      : c0
        ? midpoint(c0)
        : ([HALF, HALF] as Vec2)
    const fi = sheet.facetAtMaterial(target[0], target[1])
    const under = fi >= 0 ? sheet.facets[fi].node : 0
    let node = under

    if (c0) {
      // Only re-open a hinge the gesture is genuinely ON. Grabbing whatever
      // hinge happens to own the facet under the finger is how "draw the wing
      // out" ended up re-opening the crane's spine and unfolding the bird.
      orientAxis(c0, this.axisBuf)
      node = this.findAxisMatch(under, this.axisBuf)
    }

    if (node > 0) {
      const n = sheet.nodes[node]
      const rest = c0 ? signedAngle(c0) : n.angle * 0.35
      const group = n.group
      const nodes = sheet.nodes
      const lead = n.rest >= 0 ? 1 : -1
      for (let i = 0; i < nodes.length; i++) {
        const k = nodes[i]
        if (i !== node && (group === 0 || k.group !== group)) continue
        const sign = i === node ? 1 : (k.rest >= 0 ? 1 : -1) * lead
        plan.nodes.push(i)
        plan.from.push(k.angle)
        plan.rest.push(rest * sign)
        plan.win0.push(0)
        plan.win1.push(1)
        plan.bowScale.push(1)
        k.inFlight = true
        k.rest = rest * sign
        plan.raise.push(i)
        this.buildBendFor(i, plan)
      }
      return
    }
    if (!c0) return
    // Nothing to re-open: the flap is still buried in the stack, so this is a
    // new fold of the layer under the finger — and it comes up on top.
    const scope = this.resolveScope(under, c0)
    if (this.crease(c0, {
      angle: signedAngle(c0), kind: 'pull', scope,
      foldUp: c0.direction === 'valley', invertLayers: false, stackBias: 1,
    })) {
      this.record(plan, 0, 1)
      for (let i = 0; i < this.cres.nodes.length; i++) plan.raise.push(this.cres.nodes[i])
    }
    for (let i = 1; i < creases.length; i++) {
      const c = creases[i]
      const t = step.targets && step.targets[i] ? step.targets[i] : midpoint(c)
      const f = sheet.facetAtMaterial(t[0], t[1])
      const sc = this.resolveScope(f >= 0 ? sheet.facets[f].node : 0, c)
      if (this.crease(c, {
        angle: signedAngle(c), kind: 'pull', scope: sc,
        foldUp: c.direction === 'valley', invertLayers: false, stackBias: 1,
      })) {
        this.record(plan, Math.min(0.22, i * 0.09), 1)
        for (let k = 0; k < this.cres.nodes.length; k++) plan.raise.push(this.cres.nodes[k])
      }
    }
  }

  /** Freeze the current angles so a press can relax everything toward flat. */
  private capturePress(): void {
    const nodes = this.sheet.nodes
    const angle = new Float64Array(nodes.length)
    for (let i = 0; i < nodes.length; i++) angle[i] = nodes[i].angle
    this.pressFrom = { angle, layerScale: this.sheet.layerScale, inflate: this.sheet.inflate }
  }

  /**
   * Press: the satisfying finish. Every residual bow is squeezed out, folds
   * within striking distance of flat snap to flat, the balloon deflates, and the
   * stack itself compacts — a pressed pile of paper really is thinner.
   */
  private applyPress(p: number): void {
    const snap = this.pressFrom
    const sheet = this.sheet
    if (!snap) return
    const nodes = sheet.nodes
    const e = smoothstep(0, 1, p)
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const from = i < snap.angle.length ? snap.angle[i] : n.angle
      const to = snapFlat(n.rest !== 0 ? n.rest : from)
      n.angle = from + (to - from) * e
      n.bow = 0
    }
    sheet.layerScale = snap.layerScale + (PRESSED_STACK - snap.layerScale) * e
    sheet.inflate = snap.inflate * (1 - e)
    sheet.markDirty()
  }

  /** Fan every facet so an inflate reads as volume rather than a flat push. */
  private planInflate(): void {
    const sheet = this.sheet
    sheet.updateWorld()
    const facets = sheet.facets
    const rootW = sheet.nodes[0].world
    const upx = rootW[2]
    const upy = rootW[6]
    const upz = rootW[10]
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < facets.length; i++) {
      if (facets[i].layer < lo) lo = facets[i].layer
      if (facets[i].layer > hi) hi = facets[i].layer
    }
    const mid = (lo + hi) * 0.5
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      const m = sheet.nodes[f.node].world
      // Which way is this facet's own +z pointing in the world?
      const faceUp = m[2] * upx + m[6] * upy + m[10] * upz >= 0 ? 1 : -1
      // Upper sheets balloon away from the desk, lower ones toward it: a volume.
      const side = f.layer >= mid ? 1 : -1
      const radius = Math.sqrt(f.area)
      const scale = clamp(radius / 190, 0.18, 1)
      f.fan = buildFan(f.poly, faceUp * side * scale, 0.14, f.id)
    }
  }

  /* ── plan plumbing ───────────────────────────────────────────────────── */

  private crease(
    c: Crease,
    o: {
      angle: number; kind: FoldKind; scope: number; exclude?: number
      foldUp: boolean; invertLayers: boolean; stackBias: number
    },
  ): boolean {
    OPTS.angle = o.angle
    OPTS.kind = o.kind
    OPTS.exclude = o.exclude ?? -1
    // Ask before cutting: a scope too narrow folds one layer of a two-layer flap
    // and drives the crease straight through the fold holding them together.
    OPTS.scope = this.sheet.safeScope(c, o.scope, OPTS.exclude)
    OPTS.foldUp = o.foldUp
    OPTS.invertLayers = o.invertLayers
    OPTS.stackBias = o.stackBias
    return this.sheet.applyCrease(c, OPTS, this.cres)
  }

  /** Fold the last applyCrease result into the plan. */
  private record(plan: StepPlan, w0: number, w1: number): void {
    const res = this.cres
    const sheet = this.sheet
    for (let i = 0; i < res.nodes.length; i++) {
      const id = res.nodes[i]
      const n = sheet.nodes[id]
      plan.nodes.push(id)
      plan.from.push(0)
      plan.rest.push(n.rest)
      plan.win0.push(clamp01(w0))
      plan.win1.push(clamp(w1, clamp01(w0) + 1e-3, 1))
      plan.bowScale.push(clamp(res.extent / 320, 0.4, 1.3))
      this.buildBendFor(id, plan)
    }
    if (!plan.axisFrom) {
      plan.axisFrom = [res.ax + HALF, res.ay + HALF]
      plan.axisTo = [res.bx + HALF, res.by + HALF]
    }
  }

  /**
   * Slice the flaps hanging off one hinge into strips.
   *
   * Done once, when the step begins — the strips depend only on the polygon and
   * the axis, never on progress, so the per-frame cost of bending is a handful
   * of sines rather than a re-clip.
   */
  private buildBendFor(nodeId: number, plan: StepPlan): void {
    const sheet = this.sheet
    const node = sheet.nodes[nodeId]
    const facets = sheet.facets
    const mine: number[] = []
    for (let i = 0; i < facets.length; i++) if (facets[i].node === nodeId) mine.push(i)
    if (mine.length === 0) return
    if (Math.abs(node.rest) < 2 * DEG || plan.bow <= EPS) return

    const extent = flapExtent(facets, mine, node.ax, node.ay, node.bx, node.by)
    if (!(extent > 1)) return
    const n = stripCount(mine.length)
    for (let i = 0; i < mine.length; i++) {
      const f = facets[mine[i]]
      f.strips = buildStrips(f.poly, node.ax, node.ay, node.bx, node.by, extent, n, f.id)
    }
  }

  /**
   * Which flap does this scoped move act on?
   *
   * Start at the facet the player tapped and walk up the fold tree until the
   * crease actually cuts something. That makes a reverse or squash target the
   * smallest flap the gesture can genuinely act on, and — crucially — means the
   * move is never a silent no-op because the tapped facet happened to sit
   * entirely to one side of the line.
   */
  private resolveScope(node: number, c: Crease): number {
    const sheet = this.sheet
    orientAxis(c, this.axisBuf)
    const ax = this.axisBuf[0]
    const ay = this.axisBuf[1]
    const bx = this.axisBuf[2]
    const by = this.axisBuf[3]
    let n = Math.max(0, node)
    if (n === 0) return 0
    let shallowest = n
    let guard = 0
    while (n > 0 && guard++ < 256) {
      if (sheet.creaseCrosses(n, ax, ay, bx, by)) return n
      shallowest = n
      n = Math.max(0, sheet.nodes[n].parent)
    }
    // Never widen all the way to the root: that would fold the whole model.
    return shallowest
  }

  /**
   * Walk up from `node` looking for an existing hinge on (near enough) this axis.
   *
   * Compared in SPACE, not in material coordinates: a hinge buried under a
   * folded layer carries the crease pulled back into that layer's own frame, so
   * its local numbers no longer look anything like the line the recipe wrote,
   * even though it is the very fold the player is reaching for.
   */
  private findAxisMatch(node: number, axis: Float64Array): number {
    const sheet = this.sheet
    sheet.updateWorld()
    const w0 = sheet.nodes[0].world
    const ax = w0[0] * axis[0] + w0[1] * axis[1] + w0[3]
    const ay = w0[4] * axis[0] + w0[5] * axis[1] + w0[7]
    const az = w0[8] * axis[0] + w0[9] * axis[1] + w0[11]
    const bx = w0[0] * axis[2] + w0[1] * axis[3] + w0[3]
    const by = w0[4] * axis[2] + w0[5] * axis[3] + w0[7]
    const bz = w0[8] * axis[2] + w0[9] * axis[3] + w0[11]
    const dx = bx - ax
    const dy = by - ay
    const dz = bz - az
    const l = Math.hypot(dx, dy, dz)
    if (!(l > EPS)) return -1
    const ux = dx / l
    const uy = dy / l
    const uz = dz / l
    let n = node
    let guard = 0
    while (n > 0 && guard++ < 256) {
      const nd = sheet.nodes[n]
      const m = sheet.flightParentWorld(n)
      const hax = m[0] * nd.ax + m[1] * nd.ay + m[3]
      const hay = m[4] * nd.ax + m[5] * nd.ay + m[7]
      const haz = m[8] * nd.ax + m[9] * nd.ay + m[11]
      const ex = m[0] * nd.bx + m[1] * nd.by + m[3] - hax
      const ey = m[4] * nd.bx + m[5] * nd.by + m[7] - hay
      const ez = m[8] * nd.bx + m[9] * nd.by + m[11] - haz
      const el = Math.hypot(ex, ey, ez)
      if (el > EPS) {
        const dot = Math.abs((ex * ux + ey * uy + ez * uz) / el)
        // Perpendicular offset between the two (near-parallel) lines.
        const rx = hax - ax
        const ry = hay - ay
        const rz = haz - az
        const along = rx * ux + ry * uy + rz * uz
        const perp = Math.hypot(rx - ux * along, ry - uy * along, rz - uz * along)
        if (dot > 0.985 && perp < 14) return n
      }
      n = nd.parent
    }
    return -1
  }

  private finishPlan(step: FoldStep, plan: StepPlan): void {
    plan.hint = step.hint ?? null
    plan.targets = step.targets ?? []
    if (step.camera) this.camera.setPose(step.camera)
    this.sheet.refreshFacetMeta()
    this.sheet.markDirty()
  }
}

/* ── free helpers ─────────────────────────────────────────────────────── */

const EMPTY_TARGETS: Vec2[] = []

/** Reused options object — applyCrease never retains it. */
const OPTS = {
  angle: 0,
  kind: 'valley' as FoldKind,
  scope: -1,
  exclude: -1,
  foldUp: true,
  invertLayers: false,
  stackBias: 0,
}

function emptyPlan(kind: FoldKind): StepPlan {
  return {
    kind,
    nodes: [],
    from: [],
    rest: [],
    win0: [],
    win1: [],
    bowScale: [],
    bow: 0.78,
    model: 'none',
    modelAngle: 0,
    inflate: 0,
    press: false,
    invertLayers: false,
    raise: [],
    hint: null,
    targets: [],
    axisFrom: null,
    axisTo: null,
  }
}

/** Signed hinge rotation. The axis is pre-oriented so `side` is already handled. */
function signedAngle(c: Crease, dflt = 180): number {
  const deg = Math.abs(finite(c.angle, dflt))
  const dir = c.direction === 'mountain' ? -1 : 1
  return clamp(deg, 0, 360) * DEG * dir
}

function magnitude(step: FoldStep, dflt: number): number {
  const c = step.creases && step.creases.length ? step.creases[0] : null
  const v = c ? Math.abs(finite(c.angle, dflt)) : dflt
  return v > 0 ? clamp(v, 0, 360) : dflt
}

function midpoint(c: Crease): Vec2 {
  return [(finite(c.a[0], 500) + finite(c.b[0], 500)) * 0.5, (finite(c.a[1], 500) + finite(c.b[1], 500)) * 0.5]
}

/**
 * How wide a reverse fold reaches.
 *
 * A reverse acts on a flap, and a flap's layers are siblings scattered across
 * the fold tree, not one subtree — so scoping to the tapped layer creases one
 * face of the head and leaves the other flat. The crease's own half-plane is
 * what limits the move; widening to the whole model lets every layer at the tip
 * turn together, which is what a reverse fold is.
 */
function reverseScope(sheet: Sheet, scope: number): number {
  let n = scope
  let guard = 0
  while (n > 0 && guard++ < 256) n = sheet.nodes[n].parent
  return n
}

/** Reflect a material-space point across a model-plane line. */
function mirrorPoint(p: Vec2, ax: number, ay: number, bx: number, by: number): Vec2 {
  const px = finite(p[0], 500) - HALF
  const py = finite(p[1], 500) - HALF
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  if (!(l2 > EPS)) return [p[0], p[1]]
  const t = ((px - ax) * dx + (py - ay) * dy) / l2
  const qx = ax + t * dx
  const qy = ay + t * dy
  return [2 * qx - px + HALF, 2 * qy - py + HALF]
}

/**
 * Mirror a crease into the flap's other layer. Reflection reverses orientation,
 * so the moving half-plane index flips with it.
 */
function mirrorCrease(c: Crease, ax: number, ay: number, bx: number, by: number): Crease {
  return {
    a: mirrorPoint(c.a, ax, ay, bx, by),
    b: mirrorPoint(c.b, ax, ay, bx, by),
    side: c.side === 1 ? -1 : 1,
    direction: c.direction,
    angle: c.angle,
  }
}

function flipDirection(c: Crease): Crease {
  return {
    a: c.a,
    b: c.b,
    side: c.side === 1 ? -1 : 1,
    direction: c.direction === 'valley' ? 'mountain' : 'valley',
    angle: c.angle,
  }
}

/** The petal's lifting crease runs between the far ends of the two side creases. */
function liftCrease(c0: Crease, c1: Crease): Crease {
  return {
    a: [finite(c0.b[0], 500), finite(c0.b[1], 500)],
    b: [finite(c1.b[0], 500), finite(c1.b[1], 500)],
    side: c0.side,
    direction: c0.direction === 'valley' ? 'mountain' : 'valley',
    angle: 180,
  }
}

/** Folds within 30 degrees of flat go flat when pressed. */
function snapFlat(a: number): number {
  const m = Math.abs(a)
  if (m >= 150 * DEG) return a >= 0 ? Math.PI : -Math.PI
  return a
}

function multiplyInto(a: Float64Array, b: Float64Array, out: Float64Array): void {
  for (let r = 0; r < 3; r++) {
    const r4 = r * 4
    const a0 = a[r4]
    const a1 = a[r4 + 1]
    const a2 = a[r4 + 2]
    const a3 = a[r4 + 3]
    out[r4] = a0 * b[0] + a1 * b[4] + a2 * b[8]
    out[r4 + 1] = a0 * b[1] + a1 * b[5] + a2 * b[9]
    out[r4 + 2] = a0 * b[2] + a1 * b[6] + a2 * b[10]
    out[r4 + 3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3
  }
}

function resetPending(sheet: Sheet): void {
  const p = sheet.pending
  p[0] = 1; p[1] = 0; p[2] = 0; p[3] = 0
  p[4] = 0; p[5] = 1; p[6] = 0; p[7] = 0
  p[8] = 0; p[9] = 0; p[10] = 1; p[11] = 0
  sheet.markDirty()
}

/** Make one. */
export function createFoldEngine(): Fold3D {
  return new Fold3D()
}

export default Fold3D
