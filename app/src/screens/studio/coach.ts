/**
 * PAPER PLANET — the Studio's teacher.
 *
 * A patient teacher, not a HUD (BRAND §3). It shows up on the paper, performs
 * the gesture once or twice with a ghost fingertip, and steps back the instant
 * a real finger arrives. It never blocks, never scores, never says "wrong".
 *
 * This module is the *brain*: the lesson copy, when a lesson is due, and where
 * on the sheet the demonstration happens. `FoldCoach.tsx` is the hand.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GestureKind, Vec2 } from '../../contracts'
import type { PaperFrame } from '../../engine'

/* ═══════════════════════════════════════════════════════════════════════════
   THE LESSONS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Which idea is being taught. Each is learned once, then never nagged again. */
export type CoachTopic = 'fold' | 'orbit'

/** How the ghost fingertip moves. One per shape of gesture, not per fold kind. */
export type CoachMove =
  | 'stroke'   // back and forth along a line — burnishing
  | 'sweep'    // one journey, start to finish — a fold, a flip, an orbit
  | 'press'    // stay put and lean in
  | 'tap'      // one touch, in place
  | 'tap-then' // tap the spot, then take it across
  | 'squeeze'  // two fingers together
  | 'spread'   // two fingers apart
  | 'twist'    // two fingers turning

export interface CoachLesson {
  topic: CoachTopic
  move: CoachMove
  fingers: 1 | 2
  /** Beat one: where the hand goes. */
  place: string
  /**
   * Beat one again, for a player who has turned the guides off. There is no
   * circle to aim at in expert mode, so we do not pretend there is.
   */
  bare?: string
  /** Beat two: what it then does. */
  act: string
}

/** The first line, honest about whether there is a target drawn to aim at. */
export function placeOf(lesson: CoachLesson, guides: boolean): string {
  return guides ? lesson.place : (lesson.bare ?? lesson.place)
}

/**
 * One lesson per gesture in the vocabulary (GAMEDESIGN §2). Second person,
 * short sentences, the voice of a craft kit — never a game UI.
 */
const FOLD_LESSONS: Record<GestureKind, CoachLesson> = {
  drag: {
    topic: 'fold',
    move: 'sweep',
    fingers: 1,
    place: 'Put a finger on the circle.',
    bare: 'Put a finger on the corner that moves.',
    act: 'Slide it across.',
  },
  rub: {
    topic: 'fold',
    move: 'stroke',
    fingers: 1,
    place: 'Put a finger on the circle.',
    bare: 'Put a finger on the line.',
    act: 'Rub back and forth.',
  },
  hold: {
    topic: 'fold',
    move: 'press',
    fingers: 1,
    place: 'Put your thumb flat on the paper.',
    act: 'Press, and hold.',
  },
  tap: {
    topic: 'fold',
    move: 'tap-then',
    fingers: 1,
    place: 'Tap the marked spot.',
    bare: 'Tap where the point turns.',
    act: 'Then draw it across.',
  },
  swipe: {
    topic: 'fold',
    move: 'sweep',
    fingers: 2,
    place: 'Two fingers on the paper.',
    act: 'Sweep across to turn it over.',
  },
  'pinch-in': {
    topic: 'fold',
    move: 'squeeze',
    fingers: 2,
    place: 'Two fingers on the paper.',
    act: 'Bring them together.',
  },
  'pinch-out': {
    topic: 'fold',
    move: 'spread',
    fingers: 2,
    place: 'Two fingers on the paper.',
    act: 'Take them apart.',
  },
  twist: {
    topic: 'fold',
    move: 'twist',
    fingers: 2,
    place: 'Two fingers on the paper.',
    act: 'Turn them, like a dial.',
  },
}

/**
 * The orbit is not a step — it is the free gesture that proves the paper is
 * real (GAMEDESIGN §2). It gets taught once, on its own, after the player has
 * a fold or two behind them.
 */
export const ORBIT_LESSON: CoachLesson = {
  topic: 'orbit',
  move: 'sweep',
  fingers: 2,
  place: 'Two fingers turn the paper.',
  act: 'Look at it from the side.',
}

/**
 * The orbit belongs to no step, so it is never traced onto the current crease.
 * It plays across the middle of the sheet, the way the gesture actually works:
 * anywhere, in any direction.
 */
export const ORBIT_ANCHORS: CoachAnchors = { from: [120, 500], to: [880, 500] }

/**
 * Guided assist reduces every gesture to a tap (BRAND §11). It is a setting,
 * not a difficulty, so it gets a real lesson of its own rather than being shown
 * a drag it cannot perform.
 */
export const ASSIST_LESSON: CoachLesson = {
  topic: 'fold',
  move: 'tap',
  fingers: 1,
  place: 'Tap anywhere on the paper.',
  act: 'The fold makes itself.',
}

export function lessonFor(gesture: GestureKind | undefined, assist = false): CoachLesson | null {
  if (assist) return ASSIST_LESSON
  return gesture ? FOLD_LESSONS[gesture] : null
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHEN THE TEACHER SPEAKS
   ═══════════════════════════════════════════════════════════════════════════ */

export const COACH_TIMING = {
  /** First fold: long enough for the written instruction to land first. */
  open: 1100,
  /** Any fold: this long with nothing happening, and help offers itself. */
  idle: 6500,
  /** One demonstration, ms. */
  cycle: 1900,
  /** Demonstrations before the hand rests. Never loops forever. */
  cycles: 3,
  /** The orbit lesson says its piece, then gets out of the way. */
  orbitDwell: 6200,
  /** A beat after the fold lands, so two ideas never arrive together. */
  orbitDelay: 1000,
  /** Policy is cheap to evaluate; this is not a render loop. */
  pulse: 200,
} as const

export interface CoachInput {
  stepIndex: number
  total: number
  gesture: GestureKind | undefined
  /** Every step is folded — the teacher has nothing left to say. */
  complete: boolean
  /** This player has never been shown a fold gesture. */
  teachFold: boolean
  /** This player has never been shown the orbit. */
  teachOrbit: boolean
  /** Guided assist: every gesture is a tap, so a different lesson applies. */
  assist: boolean
  /** A topic has landed; the Studio marks it seen so it never nags again. */
  onTaught: (topic: CoachTopic) => void
}

export interface CoachApi {
  lesson: CoachLesson | null
  /** Any contact with the paper: notes the activity and puts the teacher away. */
  touch: () => void
}

/**
 * The policy.
 *
 * - A player on their **first ever fold** is shown the gesture on steps 1 and 2,
 *   a beat after the step opens.
 * - **Anyone** who sits on a step doing nothing for a few seconds is offered the
 *   same help — once per visit to that step, so it is an offer, not a nag.
 * - The **orbit** is taught once, on its own, a beat after the second fold lands.
 * - Touching the paper closes it immediately, every time.
 */
interface OpenLesson {
  topic: CoachTopic
  /** The step this lesson was opened for. It never outlives that step. */
  step: number
}

export function useFoldCoach(input: CoachInput): CoachApi {
  const { stepIndex, total, gesture, complete, teachFold, teachOrbit, assist, onTaught } = input

  const [open, setOpen] = useState<OpenLesson | null>(null)

  /* A mirror the policy timer can read without wanting a render per tick, plus
     when the player last did anything, and which step has had its one offer. */
  const openRef = useRef<OpenLesson | null>(null)
  /* True while `open` holds something. `touch` runs on every pointer move, so
     it must not reach for setState sixty times a second. */
  const shownRef = useRef(false)
  /* Stamped by the step effect below, so render itself stays pure. */
  const activeAt = useRef(0)
  const offeredOn = useRef(-1)

  /* A lesson belongs to the step it opened on. Move on and it is simply gone —
     no reset render, and nothing to leak into the next step. */
  const topic = open && open.step === stepIndex ? open.topic : null

  const close = useCallback(() => {
    activeAt.current = Date.now()
    const was = openRef.current
    openRef.current = null
    /* Clearing the *state*, not just the mirror, is what guarantees a lesson
       cannot come back when an Unfold brings its step index round again. */
    if (shownRef.current) {
      shownRef.current = false
      setOpen(null)
    }
    /* The orbit has no step to complete, so seeing it *is* learning it. */
    if (was?.topic === 'orbit') onTaught('orbit')
  }, [onTaught])

  const touch = useCallback(() => {
    activeAt.current = Date.now()
    close()
  }, [close])

  /* A new step — or the same step again, after an Unfold — is a fresh slate.
     Refs only: the render above has already stopped showing the old lesson. */
  useEffect(() => {
    const was = openRef.current
    openRef.current = null
    offeredOn.current = -1
    activeAt.current = Date.now()
    /* Folding on past an open orbit lesson counts as having learned it. */
    if (was?.topic === 'orbit') onTaught('orbit')
  }, [stepIndex, onTaught])

  /* Two folds in and the gesture is theirs. */
  useEffect(() => {
    if (teachFold && stepIndex >= 2) onTaught('fold')
  }, [teachFold, stepIndex, onTaught])

  /* The orbit lesson says its piece and leaves on its own. */
  useEffect(() => {
    if (topic !== 'orbit') return
    const id = window.setTimeout(close, COACH_TIMING.orbitDwell)
    return () => window.clearTimeout(id)
  }, [topic, close])

  useEffect(() => {
    if (complete || !gesture) return
    const show = (next: CoachTopic): void => {
      const entry: OpenLesson = { topic: next, step: stepIndex }
      openRef.current = entry
      shownRef.current = true
      setOpen(entry)
    }
    const id = window.setInterval(() => {
      if (openRef.current) return
      const idleFor = Date.now() - activeAt.current

      /* Wait until they have folded, so the orbit is a discovery and not a
         second instruction competing with the first. */
      const orbitStep = Math.max(1, Math.min(2, total - 1))
      if (teachOrbit && stepIndex >= orbitStep && idleFor >= COACH_TIMING.orbitDelay) {
        show('orbit')
        return
      }

      /* One offer per visit to a step. An offer, not a nag. */
      if (offeredOn.current === stepIndex) return
      const firstEver = teachFold && stepIndex <= 1
      if (idleFor < (firstEver ? COACH_TIMING.open : COACH_TIMING.idle)) return
      offeredOn.current = stepIndex
      show('fold')
    }, COACH_TIMING.pulse)
    return () => window.clearInterval(id)
  }, [stepIndex, total, gesture, complete, teachFold, teachOrbit])

  const lesson = topic === 'orbit' ? ORBIT_LESSON : topic === 'fold' ? lessonFor(gesture, assist) : null
  return { lesson, touch }
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHERE THE DEMONSTRATION HAPPENS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CoachAnchors {
  from: Vec2
  to: Vec2
}

/** The demonstration's stage, in overlay pixels (which are canvas pixels). */
export interface CoachGeometry {
  /** Where the finger starts. */
  a: Vec2
  /** Where it ends up. */
  b: Vec2
  mid: Vec2
  /** Distance a→b. */
  span: number
  /** a→b, normalised. */
  unit: Vec2
  /** Radius of a ghost fingertip at this size. */
  tip: number
  /**
   * True when a and b are the step's real projected anchors. FoldCanvas already
   * draws the guide, the arrow and the handle along exactly that line, so the
   * coach adds only the hand — two dashed lines over one crease is clutter.
   */
  traced: boolean
}

/** Below this the anchors have collapsed on screen and mean nothing. */
const MIN_SPAN = 26

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const clamp01 = (v: number): number => clamp(v, 0, 1)
const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Quick attack, soft settle — the paper curve, in numbers. */
export function easePaper(t: number): number {
  const k = clamp01(t)
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
}

/**
 * Stage the demonstration.
 *
 * `live` is the step's anchors as they are actually projected on screen, when
 * the Studio can see them. When it cannot, the gesture is still worth teaching:
 * we play it across the middle of the sheet, pointed the way the *authored*
 * hint points in material space, which is the direction the fold really goes.
 */
export function demoGeometry(
  live: CoachAnchors | null,
  authored: CoachAnchors | null,
  size: { w: number; h: number },
  move: CoachMove,
): CoachGeometry | null {
  const { w, h } = size
  if (w < 40 || h < 40) return null
  const short = Math.min(w, h)
  const tip = clamp(short * 0.045, 12, 26)

  let a: Vec2
  let b: Vec2
  const liveSpan = live ? Math.hypot(live.to[0] - live.from[0], live.to[1] - live.from[1]) : 0
  const traced = !!live && liveSpan >= MIN_SPAN
  if (live && traced) {
    a = [live.from[0], live.from[1]]
    b = [live.to[0], live.to[1]]
  } else {
    /* Material space is a 0..1000 square with y downward, the same way round as
       the screen, so its direction survives the projection well enough to point
       a finger with. */
    let dx = authored ? authored.to[0] - authored.from[0] : 1
    let dy = authored ? authored.to[1] - authored.from[1] : 0
    const len = Math.hypot(dx, dy)
    if (len < 1e-3) {
      dx = 1
      dy = 0
    } else {
      dx /= len
      dy /= len
    }
    const reach = short * (move === 'stroke' ? 0.19 : 0.17)
    a = [w / 2 - dx * reach, h / 2 - dy * reach]
    b = [w / 2 + dx * reach, h / 2 + dy * reach]
  }

  /* A press and a tap have no journey; they happen in one place. */
  if (move === 'press' || move === 'tap') {
    const c = lerp2(a, b, 0.5)
    a = c
    b = c
  }

  /* Keep the whole fingertip on the sheet, wherever the anchors landed. */
  const m = tip * 1.9
  a = [clamp(a[0], m, w - m), clamp(a[1], m, h - m)]
  b = [clamp(b[0], m, w - m), clamp(b[1], m, h - m)]

  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const span = Math.hypot(dx, dy)
  const unit: Vec2 = span > 1e-3 ? [dx / span, dy / span] : [1, 0]
  return { a, b, mid: lerp2(a, b, 0.5), span, unit, tip, traced }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE GHOST
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Ghost {
  pos: Vec2
  /** 0..1 how hard it is pressing — drives the contact ring. */
  press: number
  /** Degrees; the pad leans the way it travels. */
  angle: number
  alpha: number
  /** 0..1 of an expanding tap ring, or 0 for none. */
  pulse: number
}

const deg = (u: Vec2): number => (Math.atan2(u[1], u[0]) * 180) / Math.PI + 90

/** Ping-pong 0→1→0, `passes` times across one cycle. */
function shuttle(phase: number, passes: number): number {
  const t = (phase * passes) % 1
  return t < 0.5 ? easePaper(t * 2) : easePaper((1 - t) * 2)
}

function rotate(u: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return [u[0] * c - u[1] * s, u[0] * s + u[1] * c]
}

/**
 * The ghost fingertips for one instant of the demonstration, `phase` 0..1
 * through a single cycle.
 */
export function ghostsAt(move: CoachMove, fingers: 1 | 2, g: CoachGeometry, phase: number): Ghost[] {
  const p = clamp01(phase)
  const angle = deg(g.unit)
  const perp: Vec2 = [-g.unit[1], g.unit[0]]

  switch (move) {
    case 'stroke': {
      const pos = lerp2(g.a, g.b, shuttle(p, 2))
      return [{ pos, press: 1, angle, alpha: 1, pulse: 0 }]
    }

    case 'press': {
      const lean = p < 0.42 ? easePaper(p / 0.42) : p > 0.88 ? 1 - easePaper((p - 0.88) / 0.12) : 1
      return [{ pos: g.mid, press: lean, angle: 0, alpha: 1, pulse: 0 }]
    }

    case 'tap': {
      /* Down, and away — with the ring the touch leaves behind. */
      const hit = p < 0.5 ? shuttle(p / 0.5, 1) : 0
      const ring = p >= 0.24 && p < 0.86 ? (p - 0.24) / 0.62 : 0
      return [{ pos: g.mid, press: hit, angle: 0, alpha: 1, pulse: ring }]
    }

    case 'tap-then': {
      if (p < 0.34) {
        const hit = shuttle(p / 0.34, 1)
        return [{ pos: g.a, press: hit, angle, alpha: 1, pulse: hit > 0.5 ? (hit - 0.5) * 2 : 0 }]
      }
      const k = clamp01((p - 0.42) / 0.46)
      const alpha = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1
      return [{ pos: lerp2(g.a, g.b, easePaper(k)), press: 1, angle, alpha, pulse: 0 }]
    }

    case 'squeeze':
    case 'spread': {
      const k = easePaper(clamp01((p - 0.1) / 0.62))
      const open = move === 'squeeze' ? 1 - k * 0.66 : 0.34 + k * 0.66
      const reach = (g.span / 2) * open
      const alpha = p > 0.86 ? 1 - (p - 0.86) / 0.14 : p < 0.08 ? p / 0.08 : 1
      return [
        { pos: [g.mid[0] - g.unit[0] * reach, g.mid[1] - g.unit[1] * reach], press: 1, angle, alpha, pulse: 0 },
        { pos: [g.mid[0] + g.unit[0] * reach, g.mid[1] + g.unit[1] * reach], press: 1, angle, alpha, pulse: 0 },
      ]
    }

    case 'twist': {
      const k = easePaper(clamp01((p - 0.1) / 0.68)) * (Math.PI * 0.46)
      const alpha = p > 0.86 ? 1 - (p - 0.86) / 0.14 : p < 0.08 ? p / 0.08 : 1
      const arm = rotate(g.unit, k)
      const reach = g.span / 2
      return [
        { pos: [g.mid[0] - arm[0] * reach, g.mid[1] - arm[1] * reach], press: 1, angle: deg(arm), alpha, pulse: 0 },
        { pos: [g.mid[0] + arm[0] * reach, g.mid[1] + arm[1] * reach], press: 1, angle: deg(arm), alpha, pulse: 0 },
      ]
    }

    case 'sweep':
    default: {
      const k = easePaper(clamp01((p - 0.12) / 0.62))
      const alpha = p < 0.1 ? p / 0.1 : p > 0.82 ? clamp01(1 - (p - 0.82) / 0.18) : 1
      const press = p < 0.12 ? p / 0.12 : 1
      const centre = lerp2(g.a, g.b, k)
      if (fingers === 1) return [{ pos: centre, press, angle, alpha, pulse: 0 }]
      /* Two fingers, side by side and clearly two — never one smudge. */
      const off = Math.max(g.tip * 1.45, g.span * 0.15)
      return [
        { pos: [centre[0] - perp[0] * off, centre[1] - perp[1] * off], press, angle, alpha, pulse: 0 },
        { pos: [centre[0] + perp[0] * off, centre[1] + perp[1] * off], press, angle, alpha, pulse: 0 },
      ]
    }
  }
}

/**
 * Where the hand rests once it has finished demonstrating — and the single pose
 * a player with reduced motion is shown. It sits a third of the way along the
 * route: clearly on the path, and clear of the handle it is pointing at.
 */
export function restPhase(move: CoachMove): number {
  switch (move) {
    case 'stroke':
      return 0.1
    case 'sweep':
      return 0.36
    case 'press':
      return 0.5
    case 'tap':
      return 0.26
    case 'tap-then':
      return 0.62
    default:
      return 0.42
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE LIVE ANCHORS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Screen-space anchors for the current step.
 *
 * The Studio does not own the projection — FoldCanvas does — and its handle
 * exposes only `refit()` and `demonstrate()`. Where the canvas publishes its
 * frame, the ghost traces the real crease on the real model; where it does not,
 * `demoGeometry` plays the gesture across the middle of the sheet instead, which
 * still teaches the movement. One `onFrame` callback on FoldCanvas would make
 * the traced version the only version — see the note in the handover.
 */
export function useLiveAnchors(active: boolean, stepIndex: number): CoachAnchors | null {
  const [anchors, setAnchors] = useState<CoachAnchors | null>(null)

  useEffect(() => {
    if (!active) return
    const read = (): void => {
      const frame = (window as unknown as { __ppFrame?: PaperFrame }).__ppFrame
      const hint = frame?.hint ?? null
      setAnchors((prev) => {
        if (!hint) return prev === null ? prev : null
        if (
          prev &&
          Math.abs(prev.from[0] - hint.from[0]) < 0.5 &&
          Math.abs(prev.from[1] - hint.from[1]) < 0.5 &&
          Math.abs(prev.to[0] - hint.to[0]) < 0.5 &&
          Math.abs(prev.to[1] - hint.to[1]) < 0.5
        ) {
          return prev
        }
        return { from: [hint.from[0], hint.from[1]], to: [hint.to[0], hint.to[1]] }
      })
    }
    read()
    const id = window.setInterval(read, 140)
    return () => window.clearInterval(id)
  }, [active, stepIndex])

  /* Stale anchors are simply not handed out — no state to clear on the way. */
  return active ? anchors : null
}
