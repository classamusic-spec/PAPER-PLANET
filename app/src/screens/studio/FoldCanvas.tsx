/* PAPER PLANET — the fold surface. Gestures in, 3D paper out, ASMR all the way through. */

import { useCallback, useEffect, useImperativeHandle, useRef, type RefObject } from 'react'
import type {
  FoldRecipe,
  FoldStep,
  GestureKind,
  PaperMaterial,
  RenderFrame,
  Vec2,
} from '../../contracts'
import { Fold3D } from '../../engine'
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

/** Release above this and the fold completes itself; below and it springs back. */
const COMMIT_THRESHOLD = 0.68
/** Seconds of eased travel when a fold finishes itself after release. */
const SETTLE_MS = 260
/** Orbit sensitivity, degrees per pixel. */
const ORBIT_YAW = 0.42
const ORBIT_PITCH = 0.3

export interface FoldCanvasHandle {
  /** Re-frame the model, e.g. after a layout change. */
  refit(): void
  /** Auto-perform the current step — assist mode and the "show me" hint. */
  demonstrate(): void
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
  /** 0..1 while a step is in flight. */
  onProgress?: (t: number) => void
  /** Fired once per completed step, with how cleanly it was performed (0..1). */
  onStepComplete?: (quality: number) => void
  /** Fired on each burnish tick so the HUD can show the crease darkening. */
  onRub?: (t: number) => void
  handleRef?: RefObject<FoldCanvasHandle | null>
}

/** Which gesture a step wants, and how to score progress for it. */
function progressFor(
  step: FoldStep,
  s: GestureState,
  frame: RenderFrame,
): number {
  const hint = frame.hint
  switch (step.gesture) {
    case 'rub': {
      const ax = frame.axis
      if (!ax) return 0
      const len = Math.hypot(ax.to[0] - ax.from[0], ax.to[1] - ax.from[1])
      return rubProgress(s, len)
    }
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
    default:
      return hint ? foldProgress(s, hint) : 0
  }
}

/**
 * How cleanly the gesture tracked what the step asked for, 0..1.
 *
 * For a fold, that is how little the finger wandered off the hint vector. For a
 * burnish, it is how evenly the rub was distributed. This is the only "score" in
 * the game and it never fails you — it just decides how crisp the paper looks.
 */
function accuracyFor(step: FoldStep, s: GestureState, frame: RenderFrame): number {
  if (step.gesture === 'rub') {
    // Long, even strokes beat frantic scrubbing.
    const legs = Math.max(1, s.rubReversals)
    const perLeg = s.rubDistance / legs
    return Math.max(0, Math.min(1, perLeg / 90))
  }
  const hint = frame.hint
  if (!hint) return 0.8
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
  onProgress,
  onStepComplete,
  onRub,
  handleRef,
}: FoldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Fold3D | null>(null)
  const gestureRef = useRef<GestureRecogniser | null>(null)
  const frameRef = useRef<RenderFrame | null>(null)
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

  stepRef.current = stepIndex
  completeRef.current = complete
  guidesRef.current = guides
  motionRef.current = reducedMotion

  const step: FoldStep | undefined = recipe.steps[stepIndex]

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

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.seekStep(stepIndex)
    engine.setProgress(0)
    progressRef.current = 0
    committedRef.current = false
    settleRef.current = null
  }, [stepIndex])

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
    engine.fit(w, h)
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
      onStart: () => {
        void audio.unlock()
        orbitingRef.current = false
        settleRef.current = null
      },
      onClassify: (kind: GestureKind) => {
        const s = recRef.current?.state()
        const frame = frameRef.current
        const cur = recipe.steps[stepRef.current]
        if (!s || !frame || !cur) return
        // A gesture the current step does not want becomes a free orbit, so the
        // player can always look at their paper from another angle.
        const wanted = cur.gesture
        const isOrbit =
          completeRef.current ||
          (kind === 'twist' && wanted !== 'twist') ||
          (kind === 'drag' && wanted !== 'drag' && wanted !== 'swipe' && wanted !== 'tap')
        orbitingRef.current = isOrbit
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

        const t = progressFor(cur, s, frame)
        progressRef.current = t
        engine.setProgress(t)
        onProgress?.(t)

        if (cur.gesture === 'rub') onRub?.(t)
        // Self-throttles to one pulse per 45ms; safe to call every move.
        haptics.tick(Math.min(1, s.velocity))

        if (t >= 0.999) commit(accuracyFor(cur, s, frame))
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
          pendingQuality.current = accuracyFor(cur, s, frame)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (completeRef.current && !motionRef.current) {
        engine.setBreath((now / 4200) % 1)
      }

      const frame = engine.render()
      frameRef.current = frame
      paint(ctx, frame, dprRef.current, guidesRef.current && !completeRef.current)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [commit, onProgress])

  useImperativeHandle(
    handleRef,
    () => ({
      refit: resize,
      demonstrate: () => {
        if (committedRef.current) return
        settleRef.current = { from: progressRef.current, to: 1, t0: performance.now() }
        pendingQuality.current = 0.7
      },
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

function tracePoly(ctx: CanvasRenderingContext2D, pts: Vec2[]) {
  if (pts.length < 3) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

function paint(
  ctx: CanvasRenderingContext2D,
  frame: RenderFrame,
  dpr: number,
  guides: boolean,
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
  const facets = frame.facets
  for (let i = 0; i < facets.length; i++) {
    const f = facets[i]
    if (f.points.length < 3) continue
    tracePoly(ctx, f.points)
    ctx.fillStyle = f.fill
    ctx.fill()

    // Specular sheen: paper catches light at grazing angles.
    if (f.sheen > 0.01) {
      ctx.save()
      ctx.globalAlpha = f.sheen * 0.5
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = '#fff6e4'
      ctx.fill()
      ctx.restore()
    }

    // Occlusion at the fold seam reads as the crease having depth.
    if (f.occlusion > 0.01) {
      ctx.save()
      ctx.globalAlpha = f.occlusion * 0.45
      ctx.fillStyle = '#3a2c1e'
      ctx.fill()
      ctx.restore()
    }

    if (f.stroke) {
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

    // the fingertip
    ctx.globalAlpha = 1
    ctx.fillStyle = '#E0A340'
    ctx.strokeStyle = '#2E2438'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(h.from[0], h.from[1], 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
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
