// PAPER PLANET — the WebAudio graph: buses, focus ducking, safety limiter, iOS unlock, lifecycle.

import type { AudioBus } from '../contracts'

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

/** Buses that carry sound. `master` is a volume, not a node you connect to. */
export type SourceBus = Exclude<AudioBus, 'master'>

/**
 * Ramp a param without ever stepping. Every volume change in this app goes
 * through here — an instant gain change is an audible click, and a click in a
 * calm app is unforgivable.
 */
export function ramp(param: AudioParam, target: number, seconds: number, ctx: BaseAudioContext): void {
  const now = ctx.currentTime
  const dur = Math.max(0.008, seconds)
  try {
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + dur)
  } catch {
    /* param detached mid-teardown — nothing to do */
  }
}

/** Equal-power crossfade curve, for bed swaps and grain panning. */
export function equalPowerCurve(from: number, to: number, points = 64): Float32Array {
  const c = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    c[i] = from + (to - from) * Math.sin((t * Math.PI) / 2) ** 2
  }
  return c
}

const DEFAULT_VOLUMES: Record<AudioBus, number> = {
  master: 0.9,
  sfx: 1,
  ambience: 0.3,
  music: 0.28,
}

/**
 * A hard ceiling on the beds, applied on top of the player's setting.
 *
 * Ambience is meant to sit *under* the paper — BRAND section 8 calls it a room
 * tone, and the paper is the instrument. Tested on a phone it was competing
 * with the creases instead of sitting behind them, so the bus is trimmed at
 * source: even at a setting of 1.0 the bed stays a bed. The trim also reaches
 * players whose saved level predates this change, which a default alone
 * would not.
 */
const BUS_TRIM: Partial<Record<AudioBus, number>> = { ambience: 0.42, music: 0.6 }

/** Player setting -> actual gain, with the bed trim folded in. */
function busGain(bus: AudioBus, volume: number): number {
  return Math.max(0, Math.min(1, volume)) * (BUS_TRIM[bus] ?? 1)
}

/** How far ambience and music drop while the player is folding. */
const FOCUS_DUCK: Record<'ambience' | 'music', number> = { ambience: 0.42, music: 0.18 }
const FOCUS_RAMP = 0.85

/**
 * Owns the AudioContext and everything permanent hanging off it.
 *
 *   sources ─┬─ sfx ───────────────┐
 *            ├─ ambience ─ duck ───┼─ master ─ limiter ─ destination
 *            └─ music ──── duck ───┘
 *
 * Nothing here throws. If WebAudio is unavailable or blocked, every method is a
 * no-op and the app runs silently rather than breaking.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private busNodes: Partial<Record<SourceBus, GainNode>> = {}
  private duckNodes: Partial<Record<'ambience' | 'music', GainNode>> = {}
  private volumes: Record<AudioBus, number> = { ...DEFAULT_VOLUMES }
  private focus = false
  private unlocked = false
  private disposed = false
  private suspendTimer: number | null = null
  private lifecycleBound = false
  private gestureBound = false

  /* ── construction ───────────────────────────────────────────────────── */

  /** Build the graph. Safe to call repeatedly; only the first call does work. */
  private build(): AudioContext | null {
    if (this.disposed) return null
    if (this.ctx) return this.ctx
    if (typeof window === 'undefined') return null

    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!Ctor) return null

    let ctx: AudioContext
    try {
      ctx = new Ctor({ latencyHint: 'interactive' })
    } catch {
      return null
    }

    // A gentle safety limiter. Not a loudness maximiser — it only catches the
    // rare moment when many grains and a reward cue land on the same sample.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -8
    limiter.knee.value = 8
    limiter.ratio.value = 10
    limiter.attack.value = 0.004
    limiter.release.value = 0.22
    limiter.connect(ctx.destination)

    const master = ctx.createGain()
    master.gain.value = this.volumes.master
    master.connect(limiter)

    // Raw gain node. The bed trim is applied at the bus nodes only, never on
    // the duck stages, or it would be counted twice.
    const mk = (v: number): GainNode => {
      const g = ctx.createGain()
      g.gain.value = v
      return g
    }

    const sfx = mk(busGain('sfx', this.volumes.sfx))
    sfx.connect(master)

    const ambDuck = mk(1)
    ambDuck.connect(master)
    const ambience = mk(busGain('ambience', this.volumes.ambience))
    ambience.connect(ambDuck)

    const musicDuck = mk(1)
    musicDuck.connect(master)
    const music = mk(busGain('music', this.volumes.music))
    music.connect(musicDuck)

    this.ctx = ctx
    this.limiter = limiter
    this.master = master
    this.busNodes = { sfx, ambience, music }
    this.duckNodes = { ambience: ambDuck, music: musicDuck }

    this.bindLifecycle()
    if (this.focus) this.applyFocus(0)
    return ctx
  }

  /* ── access ─────────────────────────────────────────────────────────── */

  /** The context, creating it if needed. Null when WebAudio is unavailable. */
  context(): AudioContext | null {
    return this.build()
  }

  /** Destination node for a bus. Null when unavailable. */
  bus(name: SourceBus): GainNode | null {
    this.build()
    return this.busNodes[name] ?? null
  }

  /** Context clock, or 0. */
  now(): number {
    return this.ctx?.currentTime ?? 0
  }

  ready(): boolean {
    return this.unlocked && this.ctx?.state === 'running'
  }

  /* ── unlock ─────────────────────────────────────────────────────────── */

  /**
   * iOS and every locked-down autoplay policy need three things: the context
   * created or resumed inside a real user gesture, a buffer actually played
   * through it, and a `statechange` watcher because iOS re-suspends the context
   * after an interruption (a call, Siri, the ringer switch).
   */
  async unlock(): Promise<void> {
    const ctx = this.build()
    if (!ctx) return

    try {
      if (ctx.state !== 'running') await ctx.resume()
    } catch {
      /* not in a gesture yet — the fallback listeners below will retry */
    }

    // Play one silent sample. Safari treats a context as unlocked only once
    // something has actually been rendered through it.
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
    } catch {
      /* ignore */
    }

    if (ctx.state === 'running') {
      this.unlocked = true
    } else {
      this.bindGestureFallback()
    }
  }

  /**
   * If `unlock()` was called outside a gesture, latch onto the next real one.
   * Listeners remove themselves as soon as the context runs.
   */
  private bindGestureFallback(): void {
    if (this.gestureBound || typeof window === 'undefined') return
    this.gestureBound = true
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'click']
    const onGesture = (): void => {
      const ctx = this.ctx
      if (!ctx) return
      void ctx.resume().then(() => {
        if (ctx.state === 'running') {
          this.unlocked = true
          for (const e of events) window.removeEventListener(e, onGesture)
          this.gestureBound = false
        }
      }).catch(() => undefined)
    }
    for (const e of events) window.addEventListener(e, onGesture, { passive: true })
  }

  /* ── lifecycle ──────────────────────────────────────────────────────── */

  /**
   * A mobile app that keeps playing in the background is a bug. Fade out, then
   * suspend so the tab stops burning battery; fade back in on return.
   */
  private bindLifecycle(): void {
    if (this.lifecycleBound || typeof document === 'undefined') return
    this.lifecycleBound = true

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') this.pause()
      else this.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', () => this.pause())
    window.addEventListener('pageshow', () => this.resume())

    // iOS drops the context to 'interrupted'/'suspended' after a phone call.
    this.ctx?.addEventListener('statechange', () => {
      if (this.ctx?.state === 'suspended' && document.visibilityState === 'visible' && this.unlocked) {
        void this.ctx.resume().catch(() => undefined)
      }
    })
  }

  /** Fade down and suspend. */
  pause(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || ctx.state !== 'running') return
    ramp(master.gain, 0, 0.12, ctx)
    if (this.suspendTimer !== null) window.clearTimeout(this.suspendTimer)
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = null
      if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined)
    }, 160)
  }

  /** Resume and fade back to the player's master volume. */
  resume(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer)
      this.suspendTimer = null
    }
    const restore = (): void => ramp(master.gain, this.volumes.master, 0.25, ctx)
    if (ctx.state === 'running') restore()
    else void ctx.resume().then(restore).catch(() => undefined)
  }

  /* ── volumes & ducking ──────────────────────────────────────────────── */

  setBusVolume(bus: AudioBus, volume: number): void {
    const v = Math.max(0, Math.min(1, volume))
    this.volumes[bus] = v
    const ctx = this.ctx
    if (!ctx) return
    const node = bus === 'master' ? this.master : this.busNodes[bus]
    if (node) ramp(node.gain, busGain(bus, v), 0.14, ctx)
  }

  getBusVolume(bus: AudioBus): number {
    return this.volumes[bus]
  }

  /** During a fold the paper is the star: everything else steps back. */
  setFocusMode(on: boolean): void {
    if (this.focus === on) return
    this.focus = on
    this.applyFocus(FOCUS_RAMP)
  }

  isFocused(): boolean {
    return this.focus
  }

  private applyFocus(seconds: number): void {
    const ctx = this.ctx
    if (!ctx) return
    for (const key of ['ambience', 'music'] as const) {
      const node = this.duckNodes[key]
      if (node) ramp(node.gain, this.focus ? FOCUS_DUCK[key] : 1, seconds, ctx)
    }
  }

  /* ── teardown ───────────────────────────────────────────────────────── */

  dispose(): void {
    this.disposed = true
    if (this.suspendTimer !== null) window.clearTimeout(this.suspendTimer)
    try {
      this.master?.disconnect()
      this.limiter?.disconnect()
      for (const n of Object.values(this.busNodes)) n?.disconnect()
      for (const n of Object.values(this.duckNodes)) n?.disconnect()
      void this.ctx?.close().catch(() => undefined)
    } catch {
      /* ignore */
    }
    this.ctx = null
    this.master = null
    this.limiter = null
    this.busNodes = {}
    this.duckNodes = {}
  }
}
