/* PAPER PLANET — multi-touch gesture recogniser. Framework-agnostic; drives every fold. */

import type { GestureKind, Vec2 } from '../contracts'

/* ────────────────────────────────────────────────────────────────────────────
   Tunables. These are feel numbers — change them only with a device in hand.
   ──────────────────────────────────────────────────────────────────────────── */
const TAP_MAX_MS = 260
const TAP_MAX_PX = 12
const HOLD_MS = 420
const HOLD_SLOP_PX = 14
const DRAG_START_PX = 6
/** A rub is confirmed after this many direction reversals along the axis. */
const RUB_REVERSALS = 2
/** Minimum travel between reversals for one to count (kills jitter). */
const RUB_MIN_LEG_PX = 14
const SWIPE_MIN_VELOCITY = 0.55 // px/ms
const SWIPE_MAX_MS = 420
const TWIST_MIN_DEG = 8
const PINCH_MIN_RATIO = 0.08
/** Exponential moving-average weight for velocity. Higher = twitchier. */
const VEL_SMOOTHING = 0.32

export interface PointerSample {
  id: number
  x: number
  y: number
  /** Pen/touch force where available, else 0.5. */
  pressure: number
}

export interface GestureState {
  /** Null until the recogniser has enough evidence to classify. */
  kind: GestureKind | null
  /** How many pointers are down right now. */
  pointers: number

  /** Centroid of all active pointers, element-local px. */
  x: number
  y: number
  /** Centroid at gesture start. */
  startX: number
  startY: number
  /** Total displacement of the centroid from start. */
  dx: number
  dy: number
  /** Displacement since the previous event. */
  stepX: number
  stepY: number

  /** Smoothed speed of the centroid, px/ms. Drives the friction audio. */
  velocity: number
  /** Mean pointer pressure 0..1. */
  pressure: number

  /** Total absolute travel projected onto `axis`, px. Drives rub progress. */
  rubDistance: number
  /** Confirmed direction reversals along the axis. */
  rubReversals: number

  /** Current pinch spread ÷ starting spread. 1 = unchanged. */
  scale: number
  /** Two-finger rotation since start, degrees, CCW-positive. */
  rotation: number

  /** ms the gesture has been active. */
  elapsed: number
  /** True once a hold has been recognised. */
  held: boolean
}

export interface GestureCallbacks {
  onStart?: (s: GestureState) => void
  onUpdate?: (s: GestureState) => void
  onEnd?: (s: GestureState) => void
  onTap?: (point: Vec2, count: number) => void
  onHold?: (s: GestureState) => void
  /** Fired once when the recogniser commits to a classification. */
  onClassify?: (kind: GestureKind, s: GestureState) => void
}

export interface GestureOptions extends GestureCallbacks {
  /**
   * Axis used to measure rub travel and to bias drag classification, in
   * element-local px. Set this to the active crease line each step.
   */
  axis?: { from: Vec2; to: Vec2 } | null
  /** Disable input entirely (e.g. during the reveal animation). */
  disabled?: boolean
  /** Treat every gesture as a tap — accessibility assist mode. */
  assist?: boolean
}

/* ──────────────────────────────────────────────────────────────────────────── */

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}

/** Signed angle of b−a in degrees. */
function angleOf(ax: number, ay: number, bx: number, by: number): number {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI
}

/** Shortest signed difference between two angles, degrees. */
function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function emptyState(): GestureState {
  return {
    kind: null,
    pointers: 0,
    x: 0, y: 0, startX: 0, startY: 0,
    dx: 0, dy: 0, stepX: 0, stepY: 0,
    velocity: 0, pressure: 0.5,
    rubDistance: 0, rubReversals: 0,
    scale: 1, rotation: 0,
    elapsed: 0, held: false,
  }
}

export interface GestureRecogniser {
  /** Update the crease axis when the fold step changes. */
  setAxis(axis: { from: Vec2; to: Vec2 } | null): void
  setDisabled(disabled: boolean): void
  setAssist(assist: boolean): void
  /** Current state — safe to read inside rAF. */
  state(): Readonly<GestureState>
  destroy(): void
}

/**
 * Attach a recogniser to an element. Uses Pointer Events so touch, pen and
 * mouse all work, and multi-touch is handled natively.
 *
 * The element MUST have `touch-action: none` or the browser will steal
 * two-finger gestures for scroll/zoom before we ever see them.
 */
export function createGestureRecogniser(
  el: HTMLElement,
  opts: GestureOptions = {},
): GestureRecogniser {
  let axis = opts.axis ?? null
  let disabled = opts.disabled ?? false
  let assist = opts.assist ?? false

  const pointers = new Map<number, PointerSample>()
  const s = emptyState()

  let active = false
  let startTime = 0
  let lastTime = 0
  let lastX = 0
  let lastY = 0

  /* rub tracking */
  let rubSign = 0
  let rubLeg = 0

  /* pinch/twist baselines */
  let baseSpread = 0
  let baseAngle = 0

  /* hold */
  let holdTimer: number | null = null

  /* tap chaining */
  let tapCount = 0
  let lastTapTime = 0

  function centroid(): { x: number; y: number; pressure: number } {
    let x = 0
    let y = 0
    let p = 0
    for (const pt of pointers.values()) {
      x += pt.x
      y += pt.y
      p += pt.pressure
    }
    const n = pointers.size || 1
    return { x: x / n, y: y / n, pressure: p / n }
  }

  function twoPointers(): [PointerSample, PointerSample] | null {
    const it = pointers.values()
    const a = it.next().value
    const b = it.next().value
    return a && b ? [a, b] : null
  }

  function local(e: PointerEvent): { x: number; y: number } {
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function clearHold() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
  }

  function armHold() {
    clearHold()
    holdTimer = window.setTimeout(() => {
      holdTimer = null
      if (!active || s.kind !== null) return
      if (Math.hypot(s.dx, s.dy) > HOLD_SLOP_PX) return
      s.held = true
      classify('hold')
      opts.onHold?.(s)
    }, HOLD_MS)
  }

  function classify(kind: GestureKind) {
    if (s.kind === kind) return
    s.kind = kind
    opts.onClassify?.(kind, s)
  }

  /** Project a displacement onto the crease axis; returns signed px. */
  function projectOnAxis(vx: number, vy: number): number {
    if (!axis) return Math.hypot(vx, vy)
    const ax = axis.to[0] - axis.from[0]
    const ay = axis.to[1] - axis.from[1]
    const len = Math.hypot(ax, ay)
    if (len < 1e-6) return Math.hypot(vx, vy)
    return (vx * ax + vy * ay) / len
  }

  function onPointerDown(e: PointerEvent) {
    if (disabled) return
    const p = local(e)
    pointers.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, pressure: e.pressure || 0.5 })
    el.setPointerCapture?.(e.pointerId)

    const c = centroid()

    if (!active) {
      active = true
      startTime = performance.now()
      lastTime = startTime
      s.kind = null
      s.startX = c.x
      s.startY = c.y
      s.dx = 0
      s.dy = 0
      s.stepX = 0
      s.stepY = 0
      s.velocity = 0
      s.rubDistance = 0
      s.rubReversals = 0
      s.scale = 1
      s.rotation = 0
      s.elapsed = 0
      s.held = false
      rubSign = 0
      rubLeg = 0
      lastX = c.x
      lastY = c.y
      if (!assist) armHold()
      s.x = c.x
      s.y = c.y
      s.pointers = pointers.size
      s.pressure = c.pressure
      opts.onStart?.(s)
    } else {
      // A second finger landed — rebaseline for pinch/twist without a jump.
      s.startX = c.x
      s.startY = c.y
      lastX = c.x
      lastY = c.y
      s.dx = 0
      s.dy = 0
      clearHold()
    }

    const pair = twoPointers()
    if (pair) {
      baseSpread = dist(pair[0].x, pair[0].y, pair[1].x, pair[1].y)
      baseAngle = angleOf(pair[0].x, pair[0].y, pair[1].x, pair[1].y)
      s.scale = 1
      s.rotation = 0
    }
    s.pointers = pointers.size
  }

  function onPointerMove(e: PointerEvent) {
    if (!active || disabled) return
    const known = pointers.get(e.pointerId)
    if (!known) return
    const p = local(e)
    known.x = p.x
    known.y = p.y
    known.pressure = e.pressure || known.pressure

    const now = performance.now()
    const dt = Math.max(1, now - lastTime)
    const c = centroid()

    s.stepX = c.x - lastX
    s.stepY = c.y - lastY
    s.x = c.x
    s.y = c.y
    s.dx = c.x - s.startX
    s.dy = c.y - s.startY
    s.elapsed = now - startTime
    s.pressure = c.pressure
    s.pointers = pointers.size

    const stepLen = Math.hypot(s.stepX, s.stepY)
    const instant = stepLen / dt
    s.velocity = s.velocity + (instant - s.velocity) * VEL_SMOOTHING

    /* ── two-pointer: pinch / twist / two-finger swipe ─────────────────────── */
    const pair = twoPointers()
    if (pair && baseSpread > 1e-3) {
      const spread = dist(pair[0].x, pair[0].y, pair[1].x, pair[1].y)
      const ang = angleOf(pair[0].x, pair[0].y, pair[1].x, pair[1].y)
      s.scale = spread / baseSpread
      s.rotation = angleDelta(baseAngle, ang)

      if (s.kind === null || s.kind === 'drag') {
        const ratio = Math.abs(s.scale - 1)
        const rot = Math.abs(s.rotation)
        // Whichever signal is strongest relative to its threshold wins.
        const pinchScore = ratio / PINCH_MIN_RATIO
        const twistScore = rot / TWIST_MIN_DEG
        const swipeScore =
          s.velocity >= SWIPE_MIN_VELOCITY && Math.hypot(s.dx, s.dy) > DRAG_START_PX * 4 ? 1.2 : 0

        if (pinchScore >= 1 && pinchScore >= twistScore && pinchScore >= swipeScore) {
          classify(s.scale < 1 ? 'pinch-in' : 'pinch-out')
        } else if (twistScore >= 1 && twistScore >= swipeScore) {
          classify('twist')
        } else if (swipeScore > 0) {
          classify('swipe')
        }
      }
      lastX = c.x
      lastY = c.y
      lastTime = now
      opts.onUpdate?.(s)
      return
    }

    /* ── single pointer: rub / drag ─────────────────────────────────────────── */
    const along = projectOnAxis(s.stepX, s.stepY)
    s.rubDistance += Math.abs(along)

    // Reversal detection along the axis, with a minimum leg to reject jitter.
    const sign = along > 0.5 ? 1 : along < -0.5 ? -1 : 0
    if (sign !== 0) {
      if (rubSign === 0) {
        rubSign = sign
        rubLeg = 0
      } else if (sign === rubSign) {
        rubLeg += Math.abs(along)
      } else {
        if (rubLeg >= RUB_MIN_LEG_PX) {
          s.rubReversals++
          rubSign = sign
          rubLeg = 0
        }
      }
    }

    if (Math.hypot(s.dx, s.dy) > DRAG_START_PX) clearHold()

    if (s.kind === null || s.kind === 'drag') {
      if (s.rubReversals >= RUB_REVERSALS) {
        classify('rub')
      } else if (
        s.velocity >= SWIPE_MIN_VELOCITY &&
        s.elapsed <= SWIPE_MAX_MS &&
        Math.hypot(s.dx, s.dy) > DRAG_START_PX * 5
      ) {
        classify('swipe')
      } else if (Math.hypot(s.dx, s.dy) > DRAG_START_PX) {
        // Perpendicular travel means folding across the crease; along-axis
        // travel with no reversal yet is still ambiguous, so stay on 'drag'.
        classify('drag')
      }
    }

    lastX = c.x
    lastY = c.y
    lastTime = now
    opts.onUpdate?.(s)
  }

  function finish(e: PointerEvent) {
    if (!active) return
    pointers.delete(e.pointerId)
    el.releasePointerCapture?.(e.pointerId)
    s.pointers = pointers.size

    // Other fingers still down — rebaseline and keep going.
    if (pointers.size > 0) {
      const c = centroid()
      s.startX = c.x
      s.startY = c.y
      lastX = c.x
      lastY = c.y
      s.dx = 0
      s.dy = 0
      const pair = twoPointers()
      if (pair) {
        baseSpread = dist(pair[0].x, pair[0].y, pair[1].x, pair[1].y)
        baseAngle = angleOf(pair[0].x, pair[0].y, pair[1].x, pair[1].y)
      }
      return
    }

    clearHold()
    active = false
    s.elapsed = performance.now() - startTime

    const travel = Math.hypot(s.dx, s.dy)
    const isTap = s.kind === null && s.elapsed <= TAP_MAX_MS && travel <= TAP_MAX_PX

    if (isTap || (assist && s.kind === null)) {
      const now = performance.now()
      tapCount = now - lastTapTime < 320 ? tapCount + 1 : 1
      lastTapTime = now
      classify('tap')
      opts.onTap?.([s.x, s.y], tapCount)
    }

    opts.onEnd?.(s)
    s.kind = null
    s.velocity = 0
  }

  function onCancel(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (pointers.size === 0 && active) {
      clearHold()
      active = false
      s.velocity = 0
      opts.onEnd?.(s)
      s.kind = null
    }
    s.pointers = pointers.size
  }

  /* Block the browser's own gesture handling so two fingers reach us. */
  function preventDefault(e: Event) {
    e.preventDefault()
  }

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', finish)
  el.addEventListener('pointercancel', onCancel)
  el.addEventListener('lostpointercapture', onCancel)
  // Safari-only: stops pinch-zoom hijacking the canvas.
  el.addEventListener('gesturestart', preventDefault)
  el.addEventListener('gesturechange', preventDefault)
  el.addEventListener('contextmenu', preventDefault)

  return {
    setAxis(next) {
      axis = next
    },
    setDisabled(next) {
      disabled = next
      if (next && active) {
        pointers.clear()
        clearHold()
        active = false
        s.kind = null
        s.velocity = 0
      }
    },
    setAssist(next) {
      assist = next
    },
    state() {
      return s
    },
    destroy() {
      clearHold()
      pointers.clear()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('lostpointercapture', onCancel)
      el.removeEventListener('gesturestart', preventDefault)
      el.removeEventListener('gesturechange', preventDefault)
      el.removeEventListener('contextmenu', preventDefault)
    },
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Progress helpers — turn raw gesture state into a 0..1 completion for a step.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Signed perpendicular travel relative to a crease axis, px. Positive means the
 * drag crossed to the left of `from -> to`. The Studio uses this to tell a
 * valley fold from a mountain fold made on the same crease.
 */
export function perpendicularTravel(
  s: GestureState,
  axis: { from: Vec2; to: Vec2 },
): number {
  const ax = axis.to[0] - axis.from[0]
  const ay = axis.to[1] - axis.from[1]
  const len = Math.hypot(ax, ay)
  if (len < 1e-6) return 0
  return (s.dx * -ay + s.dy * ax) / len
}

/** Fold progress: how far the drag has carried across the crease. */
export function foldProgress(
  s: GestureState,
  hint: { from: Vec2; to: Vec2 },
): number {
  const hx = hint.to[0] - hint.from[0]
  const hy = hint.to[1] - hint.from[1]
  const len2 = hx * hx + hy * hy
  if (len2 < 1e-6) return 0
  // Overshoot a little so the player doesn't have to land exactly on target.
  const t = ((s.dx * hx + s.dy * hy) / len2) * 1.12
  return Math.max(0, Math.min(1, t))
}

/** Rub progress: burnishing needs sustained travel, not one swipe. */
export function rubProgress(s: GestureState, axisLengthPx: number): number {
  const needed = Math.max(60, axisLengthPx * 3.2)
  return Math.max(0, Math.min(1, s.rubDistance / needed))
}

/** Pinch progress, for pinch-in and pinch-out steps. */
export function pinchProgress(s: GestureState, direction: 'in' | 'out'): number {
  const t = direction === 'in' ? (1 - s.scale) / 0.45 : (s.scale - 1) / 0.6
  return Math.max(0, Math.min(1, t))
}

/** Twist progress, normalised against a target rotation in degrees. */
export function twistProgress(s: GestureState, targetDeg: number): number {
  if (Math.abs(targetDeg) < 1e-6) return 0
  return Math.max(0, Math.min(1, s.rotation / targetDeg))
}

/** Hold progress, for `press` steps. */
export function holdProgress(s: GestureState, durationMs = 900): number {
  if (!s.held) return 0
  return Math.max(0, Math.min(1, (s.elapsed - HOLD_MS) / durationMs))
}
