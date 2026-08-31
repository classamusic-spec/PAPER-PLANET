// PAPER PLANET — the ASMR core: a continuous, velocity-mapped paper-friction voice.

import type { AudioEngine } from './engine'
import type { Sampler } from './sampler'
import { TEXTURES } from './manifest'
import type { TextureId } from './manifest'

/* ─────────────────────────── the velocity map ───────────────────────────

  Real friction is not "a sound played louder". As your finger speeds up, the
  fibres under it are struck more often, each contact is shorter, the contact
  patch rings higher, and the individual events fuse into a hiss. Every one of
  those is a separate parameter here, and all of them track one number.

  The gesture recogniser reports px/ms: a slow deliberate rub is 0.05–0.3, a
  brisk one 0.8–2.5. Linear normalisation would leave every deliberate rub in
  the bottom tenth of the range — so the curve below is a power law that gives
  slow, careful rubbing (which is what this app is *for*) most of the range.

      0.05 px/ms → 0.13      0.8 px/ms → 0.60
      0.15 px/ms → 0.24      1.5 px/ms → 0.85
      0.30 px/ms → 0.35      2.5 px/ms → 1.13
─────────────────────────────────────────────────────────────────────────── */

const V_REF = 2.0
const V_EXP = 0.55
const V_MAX = 1.15

function normVelocity(pxPerMs: number): number {
  if (!(pxPerMs > 0)) return 0
  return Math.min(V_MAX, Math.pow(pxPerMs / V_REF, V_EXP))
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/* ── scheduling constants ── */
const TICK_MS = 25
const LOOKAHEAD = 0.09
/** No friction() call for this long means the finger stopped: fade, don't hang. */
const STALL_SEC = 0.09
const START_FADE = 0.045
const END_FADE = 0.19

/* ── grain shape ── */
const GRAIN_RATE_MIN = 14
const GRAIN_RATE_MAX = 100
const GRAIN_DUR_MAX = 0.130
const GRAIN_DUR_MIN = 0.042
const RATE_MIN = 0.72
const RATE_MAX = 1.35
const PAN_SPREAD = 0.42

/** One Hann window, reused by every grain. */
const HANN = ((n: number): Float32Array => {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) c[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return c
})(48)

const SOURCES: readonly TextureId[] = ['texture.rub.slow', 'texture.rub.fast', 'texture.burnish']

/**
 * One pre-scaled grain envelope per source, built once. The per-source factor
 * undoes the level differences mastering left between the textures, so swapping
 * sources mid-rub never steps in loudness.
 */
const GRAIN_ENVELOPE: Record<TextureId, Float32Array> = (() => {
  const ref = -22
  const out = {} as Record<TextureId, Float32Array>
  for (const id of Object.keys(TEXTURES) as TextureId[]) {
    const trim = Math.pow(10, (ref - TEXTURES[id].rmsDb) / 20) * 0.5
    const curve = new Float32Array(HANN.length)
    for (let i = 0; i < HANN.length; i++) curve[i] = HANN[i] * trim
    out[id] = curve
  }
  return out
})()

/**
 * A continuous paper-friction voice built from granular playback.
 *
 * Two recordings sit at the ends of the velocity axis — a slow deep rub and a
 * fast bright one — plus a third for the pressure axis (a fingernail burnishing
 * a crease). Grains are drawn from them stochastically, so the blend is a
 * statistical mixture rather than a crossfade: it never sounds like two files
 * being faded, because at any instant it *is* one of them.
 *
 * On top of the grains sits a filtered-noise layer for the very fine fibres,
 * which only appears once the rub is brisk enough to produce them.
 *
 * Nothing here runs on the main thread beyond a 25ms timer that schedules a
 * handful of nodes into the future on the audio clock.
 */
export class GranularFriction {
  private engine: AudioEngine
  private sampler: Sampler

  private out: GainNode | null = null       // start/stop envelope
  private level: GainNode | null = null     // velocity-driven loudness
  private grainSum: GainNode | null = null
  private tone: BiquadFilterNode | null = null
  private pans: AudioNode[] = []

  private noiseSrc: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private noiseFilter: BiquadFilterNode | null = null

  private timer: number | null = null
  private nextGrain = 0
  private active = false
  private loading = false

  /** Raw target set by friction(); smoothed on the scheduler tick. */
  private targetV = 0
  private pressure = 0.5
  private smoothV = 0
  private lastCall = 0
  private idleTicks = 0

  constructor(engine: AudioEngine, sampler: Sampler) {
    this.engine = engine
    this.sampler = sampler
  }

  /* ── public API ─────────────────────────────────────────────────────── */

  /**
   * Called on every pointermove. Deliberately trivial: store two numbers and a
   * timestamp. All the work happens on the scheduler tick, at a fixed rate, so
   * irregular pointer events can never make the texture stutter.
   */
  friction(velocity: number, pressure = 0.5): void {
    this.targetV = normVelocity(velocity)
    this.pressure = Math.max(0, Math.min(1, pressure))
    this.lastCall = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.idleTicks = 0
    if (!this.active) this.begin()
  }

  /** Let the voice die away the way a finger lifting off paper does. */
  end(): void {
    if (!this.active) return
    this.active = false
    this.targetV = 0
    const ctx = this.engine.context()
    if (ctx && this.out) {
      const g = this.out.gain
      const now = ctx.currentTime
      try {
        g.cancelScheduledValues(now)
        g.setValueAtTime(g.value, now)
        // Exponential-ish decay reads as a release, not a fade-out.
        g.setTargetAtTime(0, now, END_FADE / 3)
      } catch { /* detached */ }
    }
    window.setTimeout(() => { if (!this.active) this.stopScheduler() }, END_FADE * 1000 + 90)
  }

  /** Decode the friction textures ahead of the first gesture. */
  async preload(): Promise<void> {
    await Promise.all(SOURCES.map((id) => this.sampler.load(TEXTURES[id].file)))
  }

  dispose(): void {
    this.stopScheduler()
    try {
      this.noiseSrc?.stop()
      this.out?.disconnect()
      this.level?.disconnect()
      this.grainSum?.disconnect()
      this.tone?.disconnect()
      this.noiseGain?.disconnect()
      this.noiseFilter?.disconnect()
      for (const p of this.pans) p.disconnect()
    } catch { /* ignore */ }
    this.out = null
    this.level = null
    this.grainSum = null
    this.tone = null
    this.pans = []
    this.noiseSrc = null
    this.noiseGain = null
    this.noiseFilter = null
  }

  /* ── graph ──────────────────────────────────────────────────────────── */

  /**
   *   grains ─▶ pan×3 ─▶ grainSum ─▶ bandpass ─┐
   *                                            ├─▶ level ─▶ envelope ─▶ sfx
   *   noise  ─▶ noise bandpass ────────────────┘
   *
   * The bandpass and the panners are shared, so a grain costs exactly two
   * nodes. At the busiest (100 grains/sec, 42ms each) that is about four
   * concurrent voices — nothing, even on an old phone.
   */
  private build(): boolean {
    if (this.out) return true
    const ctx = this.engine.context()
    const bus = this.engine.bus('sfx')
    if (!ctx || !bus) return false

    const out = ctx.createGain()
    out.gain.value = 0
    out.connect(bus)

    const level = ctx.createGain()
    level.gain.value = 0.0001
    level.connect(out)

    const tone = ctx.createBiquadFilter()
    tone.type = 'bandpass'
    tone.frequency.value = 900
    tone.Q.value = 0.75
    tone.connect(level)

    const grainSum = ctx.createGain()
    grainSum.gain.value = 1
    grainSum.connect(tone)

    // Three fixed pan positions instead of a panner per grain: the friction
    // spreads out under the fingertip on headphones for three nodes total.
    const positions = [-PAN_SPREAD, 0, PAN_SPREAD]
    this.pans = positions.map((p) => {
      if (typeof ctx.createStereoPanner === 'function') {
        const node = ctx.createStereoPanner()
        node.pan.value = p
        node.connect(grainSum)
        return node
      }
      const g = ctx.createGain()
      g.connect(grainSum)
      return g
    })

    // The fine-fibre layer. Generated, not sampled — it is pure filtered noise
    // and a file would only be a worse version of it.
    const noiseLen = Math.floor(ctx.sampleRate * 2)
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    let last = 0
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1
      last = 0.86 * last + 0.14 * white
      nd[i] = last * 1.6
    }
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    noiseSrc.loop = true

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 4200
    noiseFilter.Q.value = 0.6

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.0001

    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(level)
    try { noiseSrc.start() } catch { /* ignore */ }

    this.out = out
    this.level = level
    this.tone = tone
    this.grainSum = grainSum
    this.noiseSrc = noiseSrc
    this.noiseFilter = noiseFilter
    this.noiseGain = noiseGain
    return true
  }

  /* ── lifecycle ──────────────────────────────────────────────────────── */

  private begin(): void {
    const ctx = this.engine.context()
    if (!ctx) return

    // Textures not decoded yet: start loading and stay silent. The next gesture
    // — or this one, a moment later — will find them ready.
    const ready = SOURCES.some((id) => this.sampler.peek(TEXTURES[id].file))
    if (!ready) {
      if (!this.loading) {
        this.loading = true
        void this.preload().finally(() => { this.loading = false })
      }
      return
    }
    if (!this.build()) return

    this.active = true
    this.smoothV = Math.max(this.smoothV, this.targetV * 0.5)
    this.nextGrain = ctx.currentTime + 0.015

    const g = this.out?.gain
    if (g) {
      const now = ctx.currentTime
      try {
        g.cancelScheduledValues(now)
        g.setValueAtTime(g.value, now)
        g.linearRampToValueAtTime(1, now + START_FADE)
      } catch { /* detached */ }
    }
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  private stopScheduler(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  /* ── the scheduler ──────────────────────────────────────────────────── */

  private tick(): void {
    const ctx = this.engine.context()
    if (!ctx || !this.out) return

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()

    // Watchdog: a finger resting on the glass sends no pointermove events. If
    // nothing arrived recently the rub has stopped, so decay toward silence
    // rather than holding the last velocity forever.
    if (this.active && (nowMs - this.lastCall) / 1000 > STALL_SEC) {
      this.targetV *= 0.55
      if (this.targetV < 0.02) this.targetV = 0
    }

    // …and the same conclusion by the other route: a recogniser that keeps
    // reporting on every frame while the finger is stationary sends a real
    // stream of zeroes. Either way, no movement means no friction.
    if (this.active && this.targetV < 0.015 && this.smoothV < 0.015) {
      if (++this.idleTicks > 10) { this.end(); return }
    } else {
      this.idleTicks = 0
    }

    // Asymmetric smoothing: rise fast so the sound is under your finger the
    // instant you move, fall slower so pointer jitter cannot make it chatter.
    const rising = this.targetV > this.smoothV
    const k = rising ? 0.55 : 0.20
    this.smoothV += (this.targetV - this.smoothV) * k

    const n = this.smoothV
    const p = this.pressure

    /* ── map velocity onto every parameter at once ── */
    const gain = (0.12 + 0.88 * Math.min(1, n)) * (0.55 + 0.45 * p)
    // More pressure means a wider contact patch, which means more low end.
    const toneHz = 620 * Math.pow(6.8, Math.min(1, n)) * (1.15 - 0.3 * p)
    const noiseHz = 3200 * Math.pow(2.6, Math.min(1, n))
    const noiseAmt = Math.max(0, n - 0.32) * 0.55

    const t = ctx.currentTime
    this.set(this.level?.gain, gain, t, 0.035)
    this.set(this.tone?.frequency, Math.min(12000, toneHz), t, 0.04)
    this.set(this.noiseFilter?.frequency, Math.min(14000, noiseHz), t, 0.05)
    this.set(this.noiseGain?.gain, noiseAmt, t, 0.05)

    if (!this.active) return

    /* ── schedule grains up to LOOKAHEAD ahead ── */
    const rate = lerp(GRAIN_RATE_MIN, GRAIN_RATE_MAX, Math.min(1, n))
    const dur = lerp(GRAIN_DUR_MAX, GRAIN_DUR_MIN, Math.min(1, n))
    const speed = lerp(RATE_MIN, RATE_MAX, Math.min(1, n))
    const fastProb = smoothstep(0.25, 0.95, n)
    const burnishProb = smoothstep(0.55, 1.0, p) * 0.6

    const horizon = t + LOOKAHEAD
    if (this.nextGrain < t) this.nextGrain = t + 0.005
    let budget = 24
    while (this.nextGrain < horizon && budget-- > 0) {
      this.grain(ctx, this.nextGrain, dur, speed, fastProb, burnishProb)
      // Jittered onsets. Perfectly periodic grains ring at the grain rate and
      // turn the texture into a buzz; ±22% removes the pitch entirely.
      this.nextGrain += (1 / rate) * (0.78 + Math.random() * 0.44)
    }
  }

  private set(param: AudioParam | undefined | null, value: number, now: number, tau: number): void {
    if (!param) return
    try { param.setTargetAtTime(value, now, tau) } catch { /* detached */ }
  }

  private grain(
    ctx: AudioContext,
    when: number,
    dur: number,
    speed: number,
    fastProb: number,
    burnishProb: number,
  ): void {
    // Pick a source stochastically. Over a hundred grains a second this *is* a
    // crossfade, but at any instant it is one real recording, not a blend.
    const r = Math.random()
    let id: TextureId
    if (r < burnishProb) id = 'texture.burnish'
    else if (r < burnishProb + (1 - burnishProb) * fastProb) id = 'texture.rub.fast'
    else id = 'texture.rub.slow'

    const sample = this.sampler.peek(TEXTURES[id].file)
    if (!sample) return

    const rate = speed * (1 + (Math.random() * 2 - 1) * 0.04)
    const span = Math.max(0.05, TEXTURES[id].loopEnd - dur * rate - 0.02)
    const offset = sample.leadIn + Math.random() * span

    const src = ctx.createBufferSource()
    src.buffer = sample.buffer
    src.playbackRate.value = rate

    const g = ctx.createGain()
    g.gain.value = 0

    const dest = this.pans[(Math.random() * this.pans.length) | 0]
    src.connect(g).connect(dest)

    try {
      g.gain.setValueCurveAtTime(GRAIN_ENVELOPE[id], when, dur)
      src.start(when, offset)
      src.stop(when + dur + 0.02)
    } catch {
      try { src.disconnect(); g.disconnect() } catch { /* ignore */ }
      return
    }
    src.onended = (): void => {
      try { src.disconnect(); g.disconnect() } catch { /* already gone */ }
    }
  }
}
