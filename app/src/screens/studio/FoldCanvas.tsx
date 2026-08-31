/* PAPER PLANET — the fold surface. Gestures in, 3D paper out, ASMR all the way through. */

import { useCallback, useEffect, useImperativeHandle, useRef, type RefObject } from 'react'
import type {
  FoldRecipe,
  FoldStep,
  GestureKind,
  PaperMaterial,
  Vec2,
} from '../../contracts'
import { Fold3D, type PaperFrame } from '../../engine'
import { audio, haptics } from '../../audio'
import {
  createGestureRecogniser,
  foldProgress,
  holdProgress,
  perpendicularTravel,
  pinchProgress,
  rubProgress,
  twistProgress,
  type GestureRecogniser,
  type GestureState,
} from '../../shell/gestures'
import { landmarkAccuracy, landmarkFor, REACH, type Landmark } from '../../content/landmarks'

/** Release above this and the fold completes itself; below and it springs back. */
const COMMIT_THRESHOLD = 0.68
/** Seconds of eased travel when a fold finishes itself after release. */
const SETTLE_MS = 260
/** How close a touch must land to the handle to count as grabbing it. */
const GRAB_RADIUS = 52
/** Orbit sensitivity, degrees per pixel. */
const ORBIT_YAW = 0.42
const ORBIT_PITCH = 0.3

export interface FoldCanvasHandle {
  /** Re-frame the model, e.g. after a layout change. */
  refit(): void
  /** Auto-perform the current step — assist mode and the "show me" hint. */
  demonstrate(): void
  /**
   * The last rendered frame, or null before the first paint. Read, never held:
   * the engine reuses these arrays between frames. The coach uses it to trace
   * the real crease on the real model rather than miming across the sheet.
   */
  frame(): PaperFrame | null
}

export interface FoldCanvasProps {
  recipe: FoldRecipe
  material: PaperMaterial
  /** Index of the step the player is working on. */
  stepIndex: number
  /** Tap-to-fold instead of gesture-to-fold. */
  assist: boolean
  /** Draw the crease guide and the hint arrow. */
  guides: boolean
  reducedMotion: boolean
  /** True once every step is committed — switches to idle breathing. */
  complete: boolean
  /**
   * How much of the viewport the model should fill, 0..1. The engine frames
   * yaw-invariantly (reserving room for a full spin), which costs a lot on a
   * long model like a finished crane — the reveal pushes in.
   */
  fill?: number
  /** 0..1 while a step is in flight. */
  onProgress?: (t: number) => void
  /** Fired once per completed step, with how cleanly it was performed (0..1). */
  onStepComplete?: (quality: number) => void
  /** Fired on each burnish tick so the HUD can show the crease darkening. */
  onRub?: (t: number) => void
  handleRef?: RefObject<FoldCanvasHandle | null>
}

/**
 * A frozen snapshot of the step's screen-space anchors.
 *
 * This must NOT be re-read from the live frame each move. The hint anchors are
 * attached to the paper, so they travel as it folds: measuring against them
 * live shrinks the reference vector, which inflates progress, which folds it
 * further — a runaway that snaps any fold shut on the first few pixels.
 */
interface StepRef {
  hint: { from: Vec2; to: Vec2 } | null
  /**
   * The step's reference — what meets what — or null when the move has none
   * (a flip, a press, a free-form shaping fold). Frozen with the anchors,
   * because it decides how the gesture is scored.
   */
  landmark: Landmark | null
  axisLen: number
  /**
   * True when the authored hint collapsed on screen and we synthesised one
   * across the crease instead. Progress then ignores drag *direction* — the
   * player folds by crossing the line either way, which is forgiving and is
   * what the gesture means anyway.
   */
  synthesised: boolean
}

/** The shortest hint we will trust. Below this, screen anchors have collapsed. */
const MIN_HINT_PX = 26

/**
 * Build a usable hint across the crease when the authored one has collapsed.
 *
 * Prior folds can carry two material anchors onto the same point — the crane's
 * mountain fold takes corners (1000,0) and (0,1000), which the two valleys
 * before it bring together. The fold is still perfectly performable: you drag
 * across the crease. So we synthesise exactly that.
 */
function acrossCrease(axis: { from: Vec2; to: Vec2 }): { from: Vec2; to: Vec2 } {
  const ax = axis.to[0] - axis.from[0]
  const ay = axis.to[1] - axis.from[1]
  const len = Math.hypot(ax, ay) || 1
  const mx = (axis.from[0] + axis.to[0]) / 2
  const my = (axis.from[1] + axis.to[1]) / 2
  const nx = -ay / len
  const ny = ax / len
  const reach = Math.max(MIN_HINT_PX, len * 0.34)
  return { from: [mx - nx * reach * 0.5, my - ny * reach * 0.5], to: [mx + nx * reach * 0.5, my + ny * reach * 0.5] }
}

/** Which gesture a step wants, and how to score progress for it. */
function progressFor(step: FoldStep, s: GestureState, ref: StepRef): number {
  const hint = ref.hint
  switch (step.gesture) {
    case 'rub':
      return rubProgress(s, ref.axisLen)
    case 'pinch-in':
      return pinchProgress(s, 'in')
    case 'pinch-out':
      return pinchProgress(s, 'out')
    case 'twist':
      return twistProgress(s, 90)
    case 'hold':
      return holdProgress(s, 900)
    case 'swipe':
    case 'drag':
    case 'tap':
    default: {
      if (!hint) return 0
      if (!ref.synthesised) return foldProgress(s, hint)
      // A synthesised hint already points across the crease, so progress is
      // travel ALONG it — measured unsigned, because crossing the line counts
      // whichever way the finger came from.
      const hx = hint.to[0] - hint.from[0]
      const hy = hint.to[1] - hint.from[1]
      const len2 = hx * hx + hy * hy
      if (len2 < 1) return 0
      return Math.max(0, Math.min(1, (Math.abs(s.dx * hx + s.dy * hy) / len2) * 1.12))
    }
  }
}

/**
 * How cleanly the gesture tracked what the step asked for, 0..1.
 *
 * Where the step has a landmark — a corner that has to arrive somewhere exact —
 * this is the real measure: did you carry it there? See content/landmarks.ts.
 * Where it does not (a shaping fold, a pull), it falls back to how little the
 * finger wandered off the hint vector.
 *
 * Either way this is the only "score" in the game and it never fails you: it
 * decides how crisp the paper looks, and BRAND section 12 floors the reward.
 */
function accuracyFor(step: FoldStep, s: GestureState, ref: StepRef): number {
  if (step.gesture === 'rub') {
    // Long, even strokes beat frantic scrubbing.
    const legs = Math.max(1, s.rubReversals)
    const perLeg = s.rubDistance / legs
    return Math.max(0, Math.min(1, perLeg / 90))
  }
  const hint = ref.hint
  if (!hint) return 0.8
  if (ref.landmark) {
    return landmarkAccuracy([hint.to[0] - hint.from[0], hint.to[1] - hint.from[1]], [s.dx, s.dy])
  }
  const drift = Math.abs(perpendicularTravel(s, hint))
  const span = Math.hypot(hint.to[0] - hint.from[0], hint.to[1] - hint.from[1]) || 1
  return Math.max(0, Math.min(1, 1 - drift / (span * 0.55)))
}

export default function FoldCanvas({
  recipe,
  material,
  stepIndex,
  assist,
  guides,
  reducedMotion,
  complete,
  fill,
  onProgress,
  onStepComplete,
  onRub,
  handleRef,
}: FoldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Fold3D | null>(null)
  const gestureRef = useRef<GestureRecogniser | null>(null)
  const frameRef = useRef<PaperFrame | null>(null)
  const rafRef = useRef(0)

  /* Live values the rAF loop reads without re-subscribing. */
  const stepRef = useRef(stepIndex)
  const completeRef = useRef(complete)
  const guidesRef = useRef(guides)
  const motionRef = useRef(reducedMotion)
  const progressRef = useRef(0)
  const settleRef = useRef<{ from: number; to: number; t0: number } | null>(null)
  const orbitingRef = useRef(false)
  const committedRef = useRef(false)
  const dprRef = useRef(1)
  const fillRef = useRef(fill ?? 0.82)
  const stepRefRef = useRef<StepRef>({ hint: null, axisLen: 200, synthesised: false, landmark: null })
  const grabbedRef = useRef(false)
  /** Whether the current step has a reference worth drawing a mark for. */
  const landmarkRef = useRef(false)

  stepRef.current = stepIndex
  completeRef.current = complete
  guidesRef.current = guides
  motionRef.current = reducedMotion
  fillRef.current = fill ?? 0.82

  const step: FoldStep | undefined = recipe.steps[stepIndex]
  landmarkRef.current = step ? landmarkFor(step) !== null : false

  /* ── engine bootstrap ─────────────────────────────────────────────────── */
  useEffect(() => {
    const engine = new Fold3D()
    engineRef.current = engine
    return () => {
      engineRef.current = null
    }
  }, [])

  /* The Studio is sacred: duck everything but the paper, and make sure the
     fold vocabulary is decoded before the player's first crease. */
  useEffect(() => {
    audio.setFocusMode(true)
    void audio.preload([
      'crease.soft', 'crease.crisp', 'crease.set',
      'fold.valley', 'fold.mountain', 'fold.reverse', 'fold.petal', 'fold.squash',
      'sheet.flip', 'sheet.settle', 'press.flatten', 'ui.tap',
    ])
    return () => {
      audio.setFocusMode(false)
      audio.frictionEnd()
    }
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.reset(recipe, material)
    engine.seekStep(stepIndex)
    progressRef.current = 0
    committedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, material])


  /* ── sizing: canvas is backed at device pixel ratio so paper stays crisp ─ */
  const resize = useCallback(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!host || !canvas || !engine) return
    const r = host.getBoundingClientRect()
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    dprRef.current = dpr
    const w = Math.max(1, Math.round(r.width))
    const h = Math.max(1, Math.round(r.height))
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    // fit() solves for the eye distance by measuring the real projection, and
    // frames yaw-invariantly so orbiting never needs a re-fit.
    engine.fit(w, h, fillRef.current)
  }, [])

  useEffect(() => {
    resize()
    const host = hostRef.current
    if (!host) return
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    window.addEventListener('orientationchange', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', resize)
    }
  }, [resize])

  useEffect(() => {
    resize()
  }, [fill, resize])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.seekStep(stepIndex)
    engine.setProgress(0)
    progressRef.current = 0
    committedRef.current = false
    settleRef.current = null
    // The model's centroid travels as it folds; re-frame so the paper stays
    // the subject instead of drifting into a corner.
    resize()
  }, [stepIndex, resize])

  /* ── committing a step ────────────────────────────────────────────────── */
  const commit = useCallback(
    (quality: number) => {
      const engine = engineRef.current
      if (!engine || committedRef.current) return
      committedRef.current = true
      engine.commitStep()
      const kind = step?.kind
      switch (kind) {
        case 'mountain':
          audio.play('fold.mountain')
          break
        case 'reverse':
          audio.play('fold.reverse')
          break
        case 'petal':
          audio.play('fold.petal')
          break
        case 'squash':
          audio.play('fold.squash')
          break
        case 'crease':
          audio.play('crease.set')
          break
        case 'flip':
          audio.play('sheet.flip')
          break
        case 'press':
          audio.play('press.flatten')
          break
        default:
          audio.play('fold.valley')
      }
      haptics.fire(kind === 'crease' ? 'creaseSet' : 'foldComplete')
      onStepComplete?.(quality)
    },
    [step, onStepComplete],
  )

  /* ── gestures ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const rec = createGestureRecogniser(host, {
      assist,
      onStart: (g) => {
        void audio.unlock()
        orbitingRef.current = false
        settleRef.current = null
        // Freeze the anchors now, before the paper starts moving under them.
        const f = frameRef.current
        const axis = f?.axis
          ? { from: [...f.axis.from] as Vec2, to: [...f.axis.to] as Vec2 }
          : null
        let hint = f?.hint
          ? { from: [...f.hint.from] as Vec2, to: [...f.hint.to] as Vec2 }
          : null
        let synthesised = false
        const span = hint
          ? Math.hypot(hint.to[0] - hint.from[0], hint.to[1] - hint.from[1])
          : 0
        if (span < MIN_HINT_PX && axis) {
          hint = acrossCrease(axis)
          synthesised = true
        }
        stepRefRef.current = {
          hint,
          axisLen: axis ? Math.hypot(axis.to[0] - axis.from[0], axis.to[1] - axis.from[1]) : 200,
          synthesised,
          // A synthesised hint no longer points at the landing point, so the
          // reference cannot be scored against it — fall back to the proxy.
          landmark: synthesised ? null : landmarkFor(recipe.steps[stepRef.current]),
        }
        // Landing on the handle is an unambiguous "I am folding this".
        const anchor = hint?.from
        const near =
          !!anchor && Math.hypot(g.x - anchor[0], g.y - anchor[1]) <= GRAB_RADIUS
        grabbedRef.current = near
        if (near) {
          audio.play('sheet.pickup', { volume: 0.5 })
          haptics.fire('tick')
        }
      },
      onClassify: (kind: GestureKind) => {
        const s = recRef.current?.state()
        const cur = recipe.steps[stepRef.current]
        if (!s || !cur) return
        /**
         * One finger always folds. Two fingers orbit.
         *
         * The old rule orbited whenever the recogniser's classification did not
         * match the step, which broke the first step of every recipe: a rub is
         * only *called* a rub after two confirmed reversals, so the opening
         * stroke arrives as 'drag', did not match 'rub', and latched the model
         * into an orbit. The paper just spun under your finger.
         */
        const twoUp = s.pointers >= 2
        const wantsTwo =
          cur.gesture === 'pinch-in' || cur.gesture === 'pinch-out' || cur.gesture === 'twist'
        orbitingRef.current = completeRef.current || (twoUp && !wantsTwo && kind !== 'swipe')
      },
      onUpdate: (s) => {
        const engine = engineRef.current
        const frame = frameRef.current
        if (!engine || !frame) return

        // The ASMR voice runs for ANY dragging contact with the paper, orbiting
        // included — your finger is on the sheet either way. It self-schedules
        // on a lookahead timer, so calling it every move is two assignments.
        audio.friction(s.velocity, s.pressure)

        if (orbitingRef.current) {
          const pose = engine.getCamera()
          engine.setCamera({
            yaw: pose.yaw + s.stepX * ORBIT_YAW,
            pitch: Math.max(-25, Math.min(72, pose.pitch - s.stepY * ORBIT_PITCH)),
          })
          return
        }

        const cur = recipe.steps[stepRef.current]
        if (!cur || completeRef.current || committedRef.current) return

        const t = progressFor(cur, s, stepRefRef.current)
        progressRef.current = t
        engine.setProgress(t)
        onProgress?.(t)

        if (cur.gesture === 'rub') onRub?.(t)
        // Self-throttles to one pulse per 45ms; safe to call every move.
        haptics.tick(Math.min(1, s.velocity))

        if (t >= 0.999) commit(accuracyFor(cur, s, stepRefRef.current))
      },
      onTap: () => {
        const cur = recipe.steps[stepRef.current]
        const frame = frameRef.current
        if (!cur || !frame || completeRef.current || committedRef.current) return
        if (assist || cur.gesture === 'tap') {
          // Assist mode and tap steps animate the fold themselves.
          settleRef.current = { from: progressRef.current, to: 1, t0: performance.now() }
          audio.play('ui.tap')
        }
      },
      onEnd: (s) => {
        audio.frictionEnd()
        grabbedRef.current = false
        if (orbitingRef.current) {
          orbitingRef.current = false
          return
        }
        const cur = recipe.steps[stepRef.current]
        const frame = frameRef.current
        if (!cur || !frame || completeRef.current || committedRef.current) return
        const t = progressRef.current
        if (t >= COMMIT_THRESHOLD) {
          // Carry it the rest of the way rather than snapping.
          settleRef.current = { from: t, to: 1, t0: performance.now() }
          pendingQuality.current = accuracyFor(cur, s, stepRefRef.current)
        } else if (t > 0.02) {
          settleRef.current = { from: t, to: 0, t0: performance.now() }
          audio.play('sheet.settle', { volume: 0.5 })
        }
      },
    })

    recRef.current = rec
    gestureRef.current = rec
    return () => {
      rec.destroy()
      recRef.current = null
      gestureRef.current = null
    }
  }, [recipe, assist, commit, onProgress, onRub])

  const recRef = useRef<GestureRecogniser | null>(null)
  const pendingQuality = useRef(0.8)

  /* Keep the recogniser's rub axis pointed at the live crease. */
  useEffect(() => {
    const id = window.setInterval(() => {
      const frame = frameRef.current
      recRef.current?.setAxis(frame?.axis ?? null)
    }, 200)
    return () => clearInterval(id)
  }, [])

  /* ── the render loop ──────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      const engine = engineRef.current
      if (!engine) return

      // Ease an in-flight settle (release-to-complete, or spring-back).
      const settle = settleRef.current
      if (settle) {
        const k = Math.min(1, (now - settle.t0) / (motionRef.current ? 90 : SETTLE_MS))
        const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        const v = settle.from + (settle.to - settle.from) * eased
        progressRef.current = v
        engine.setProgress(v)
        onProgress?.(v)
        if (k >= 1) {
          settleRef.current = null
          if (settle.to === 1) commit(pendingQuality.current)
        }
      }

      /* A press is held, not moved: with the finger still there are no pointer
         events at all, so this is the only place its progress can advance. */
      const cur = recipe.steps[stepRef.current]
      if (
        cur &&
        cur.gesture === 'hold' &&
        !completeRef.current &&
        !committedRef.current &&
        !settleRef.current
      ) {
        const gs = recRef.current?.state()
        if (gs?.held) {
          const t = holdProgress(gs, 900)
          progressRef.current = t
          engine.setProgress(t)
          onProgress?.(t)
          if (t >= 0.999) commit(0.9)
        }
      }

      if (completeRef.current && !motionRef.current) {
        engine.setBreath((now / 4200) % 1)
      }

      const frame = engine.render()
      frameRef.current = frame
      if (import.meta.env.DEV) {
        ;(window as unknown as { __ppFrame?: PaperFrame }).__ppFrame = frame
      }
      paint(
        ctx,
        frame,
        dprRef.current,
        guidesRef.current && !completeRef.current,
        grabbedRef.current,
        progressRef.current,
        landmarkRef.current,
      )
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [commit, onProgress, recipe])

  useImperativeHandle(
    handleRef,
    () => ({
      refit: resize,
      demonstrate: () => {
        if (committedRef.current) return
        settleRef.current = { from: progressRef.current, to: 1, t0: performance.now() }
        pendingQuality.current = 0.7
      },
      frame: () => frameRef.current,
    }),
    [resize],
  )

  return (
    <div
      ref={hostRef}
      className="pp-fold-canvas"
      style={{ touchAction: 'none' }}
      role="application"
      aria-label={step ? step.instruction : 'Folded paper'}
    >
      <canvas ref={canvasRef} className="pp-fold-canvas__c" />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Painting. Canvas2D at DPR: ~200 facets is under a millisecond, where SVG
   reconciliation through React would not hold 60fps on a mid-tier phone.
   ══════════════════════════════════════════════════════════════════════════ */


/* ── paper grain ───────────────────────────────────────────────────────────
   One 128px noise tile, built once and reused as a canvas pattern. The old
   code instantiated a separate SVG turbulence filter per creature, which is a
   compositing disaster on mobile; this costs one texture upload, total.
   ────────────────────────────────────────────────────────────────────────── */
let grainPattern: CanvasPattern | null = null
let grainKey = ''

function paperGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const key = 'g128'
  if (grainPattern && grainKey === key) return grainPattern
  const size = 128
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const tctx = tile.getContext('2d')
  if (!tctx) return null
  const img = tctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // Fine speckle plus a long horizontal fibre streak — that pairing is what
      // reads as handmade paper rather than TV static.
      const speck = Math.random()
      const fibre = Math.sin(y * 0.7 + Math.sin(x * 0.06) * 3) * 0.5 + 0.5
      const v = 168 + speck * 52 + fibre * 26
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 30
    }
  }
  tctx.putImageData(img, 0, 0)
  grainPattern = ctx.createPattern(tile, 'repeat')
  grainKey = key
  return grainPattern
}

function tracePoly(ctx: CanvasRenderingContext2D, pts: Vec2[]) {
  if (pts.length < 3) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

function paint(
  ctx: CanvasRenderingContext2D,
  frame: PaperFrame,
  dpr: number,
  guides: boolean,
  grabbed: boolean,
  progress: number,
  landmark: boolean,
) {
  const { canvas } = ctx
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

  /* contact shadow on the desk */
  if (frame.shadow.length > 2) {
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = 'rgba(62,44,30,1)'
    ctx.filter = 'blur(10px)'
    tracePoly(ctx, frame.shadow)
    ctx.fill()
    ctx.restore()
  }

  /* facets, already depth-sorted by the engine */
  const grain = paperGrain(ctx)
  const facets = frame.facets
  for (let i = 0; i < facets.length; i++) {
    const f = facets[i]
    if (f.points.length < 3) continue
    tracePoly(ctx, f.points)
    ctx.fillStyle = f.fill
    ctx.fill()

    // Fibre. Multiply keeps it a texture on the dye rather than a grey veil.
    if (grain) {
      ctx.save()
      ctx.globalCompositeOperation = 'multiply'
      ctx.globalAlpha = 0.5
      ctx.fillStyle = grain
      ctx.fill()
      ctx.restore()
    }

    // Specular sheen: paper catches light at grazing angles.
    if (f.sheen > 0.01) {
      ctx.save()
      ctx.globalAlpha = Math.min(0.3, f.sheen * 0.34)
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = '#fff6e4'
      ctx.fill()
      ctx.restore()
    }

    // Occlusion at the fold seam reads as the crease having depth. Multiply, so
    // it deepens the dye instead of laying grey over it — source-over at this
    // strength turned red paper into slate.
    if (f.occlusion > 0.01) {
      ctx.save()
      ctx.globalCompositeOperation = 'multiply'
      ctx.globalAlpha = Math.min(0.34, f.occlusion * 0.34)
      ctx.fillStyle = '#8a6a4a'
      ctx.fill()
      ctx.restore()
    }

    // `internal` marks a tessellation seam (bend strip, inflate fan) rather than
    // a real cut edge. The engine already nulls their stroke; this is belt and
    // braces, because outlining them turns a smooth bow into corrugated iron.
    if (f.stroke && !f.internal) {
      ctx.strokeStyle = f.stroke
      ctx.lineWidth = f.strokeWidth
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }

  if (!guides) return

  /* the crease guide: a dashed ink line the player is aiming along */
  const ax = frame.axis
  if (ax) {
    ctx.save()
    ctx.strokeStyle = 'rgba(46,36,56,0.45)'
    ctx.lineWidth = 2
    ctx.setLineDash([9, 7])
    ctx.beginPath()
    ctx.moveTo(ax.from[0], ax.from[1])
    ctx.lineTo(ax.to[0], ax.to[1])
    ctx.stroke()
    ctx.restore()
  }

  /* the hint: where to put your finger, and which way to take it */
  const h = frame.hint
  if (h) {
    const dx = h.to[0] - h.from[0]
    const dy = h.to[1] - h.from[1]
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 420)

    ctx.save()
    ctx.globalAlpha = pulse
    ctx.strokeStyle = 'rgba(46,36,56,0.55)'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(h.from[0], h.from[1])
    ctx.lineTo(h.to[0] - ux * 12, h.to[1] - uy * 12)
    ctx.stroke()

    // arrowhead
    ctx.fillStyle = 'rgba(46,36,56,0.62)'
    ctx.beginPath()
    ctx.moveTo(h.to[0], h.to[1])
    ctx.lineTo(h.to[0] - ux * 15 - uy * 8, h.to[1] - uy * 15 + ux * 8)
    ctx.lineTo(h.to[0] - ux * 15 + uy * 8, h.to[1] - uy * 15 - ux * 8)
    ctx.closePath()
    ctx.fill()

    ctx.restore()

    /* The reference mark. Where a step has a landmark, the destination is not
       "somewhere over there" — it is an exact place the corner has to arrive,
       so it gets a mark of its own that closes as the two meet. This is the
       matched-tick convention from real diagrams, doing the job it does there:
       telling you what to watch, not just which way to pull. */
    if (landmark) {
      const met = Math.min(1, progress / REACH)
      ctx.save()
      ctx.translate(h.to[0], h.to[1])
      ctx.globalAlpha = 0.5 + 0.5 * met
      ctx.strokeStyle = met > 0.98 ? '#7E9E7B' : 'rgba(46,36,56,0.6)'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      // The ring draws itself closed as the corner comes in.
      ctx.setLineDash(met > 0.98 ? [] : [4, 5])
      ctx.beginPath()
      ctx.arc(0, 0, 13, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      // Two ticks across the mark: the origami sign for "these are the same".
      const tick = 5 + 3 * met
      for (const a of [-Math.PI / 4, Math.PI / 4]) {
        const cx = Math.cos(a)
        const cy = Math.sin(a)
        ctx.beginPath()
        ctx.moveTo(cx * 13 - cy * tick, cy * 13 + cx * tick)
        ctx.lineTo(cx * 13 + cy * tick, cy * 13 - cx * tick)
        ctx.stroke()
      }
      if (met > 0.98) {
        ctx.fillStyle = 'rgba(126,158,123,0.28)'
        ctx.beginPath()
        ctx.arc(0, 0, 13, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    /* The handle. This is the thing you actually put a finger on, so it is
       drawn at a real thumb's size, says when it is held, and carries the
       fold's progress around its rim. */
    const R = grabbed ? 21 : 16
    ctx.save()
    // a soft halo so the target reads before you touch it
    ctx.globalAlpha = grabbed ? 0.3 : 0.16 + 0.06 * Math.sin(performance.now() / 420)
    ctx.fillStyle = '#E0A340'
    ctx.beginPath()
    ctx.arc(h.from[0], h.from[1], R + 15, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.fillStyle = grabbed ? '#F2BC5E' : '#E0A340'
    ctx.strokeStyle = '#2E2438'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(h.from[0], h.from[1], R, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // progress rim: the fold filling in as you pull
    if (progress > 0.01) {
      ctx.strokeStyle = '#7E9E7B'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(h.from[0], h.from[1], R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress))
      ctx.stroke()
    }
    ctx.restore()
  }

  /* discrete tap targets, for reverse folds and tap steps */
  for (const t of frame.targets) {
    ctx.save()
    ctx.strokeStyle = '#E4664F'
    ctx.fillStyle = 'rgba(228,102,79,0.22)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(t[0], t[1], 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
