// PAPER PLANET — sparse generative kalimba over a low drone. Tempo-free, never loops.

import type { AudioEngine } from './engine'
import { MUSIC_TRIM } from './mix'

/**
 * The Yo scale — the Japanese pentatonic without half-steps. Every pair of
 * notes in it is consonant, so a random walk through it cannot produce a sour
 * interval and the music never needs to resolve anything.
 */
const ROOT = 146.83 // D3
const DEGREES = [0, 2, 5, 7, 9] // D E G A B
const OCTAVES = [1, 2, 3]

export function noteFreq(degreeIndex: number, octave: number): number {
  const semis = DEGREES[degreeIndex % DEGREES.length] + 12 * octave
  return ROOT * Math.pow(2, semis / 12)
}

/* Timing. There is no tempo — the next note is simply some time from now. */
const GAP_MIN = 1.5
const GAP_MAX = 4.4
/** How often a note is followed by a quick second one, as a phrase. */
const PHRASE_CHANCE = 0.32
/** How often the music simply stops for a while. */
const REST_CHANCE = 0.14
const REST_MAX = 9

const SCHEDULE_MS = 260
const LOOKAHEAD = 0.8

/**
 * A struck metal tine is inharmonic — its overtones are not integer multiples,
 * which is exactly why a kalimba sounds like wood and metal rather than an
 * organ. These ratios come from a free bar's transverse modes.
 */
const PARTIALS: ReadonlyArray<{ ratio: number; gain: number; decay: number }> = [
  { ratio: 1.00, gain: 1.00, decay: 1.00 },
  { ratio: 2.76, gain: 0.34, decay: 0.52 },
  { ratio: 5.40, gain: 0.13, decay: 0.30 },
  { ratio: 8.93, gain: 0.05, decay: 0.18 },
]

/**
 * Sparse generative music that you should be able to *not notice*.
 *
 * Notes are synthesised rather than sampled: a kalimba is four decaying
 * inharmonic partials plus a breath of noise for the thumbnail, and that is
 * cheaper and more controllable than pitch-shifting one recording across two
 * octaves. Under it sits a drone of two slightly detuned low sines whose beat
 * frequency is under a hertz, so it breathes on its own.
 *
 * Because note choice, octave, timing and rests are all stochastic, there is no
 * loop to notice — the piece never repeats and never arrives anywhere.
 */
export class Music {
  private engine: AudioEngine
  private out: GainNode | null = null
  private droneNodes: AudioNode[] = []
  private timer: number | null = null
  private nextNote = 0
  private degree = 0
  private octave = 1
  private playing = false

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  isPlaying(): boolean {
    return this.playing
  }

  set(on: boolean): void {
    if (on === this.playing) return
    this.playing = on
    if (on) this.start()
    else this.stop()
  }

  dispose(): void {
    this.stop()
    this.playing = false
  }

  /* ── lifecycle ──────────────────────────────────────────────────────── */

  private start(): void {
    const ctx = this.engine.context()
    const bus = this.engine.bus('music')
    if (!ctx || !bus) return

    if (!this.out) {
      const out = ctx.createGain()
      out.gain.value = 0.0001
      out.connect(bus)
      this.out = out
    }
    const now = ctx.currentTime
    try {
      this.out.gain.cancelScheduledValues(now)
      this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now)
      this.out.gain.linearRampToValueAtTime(MUSIC_TRIM, now + 3.5)
    } catch { /* detached */ }

    this.buildDrone(ctx)
    this.nextNote = now + 1.2 + Math.random() * 2
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), SCHEDULE_MS)
  }

  private stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    const ctx = this.engine.context()
    if (ctx && this.out) {
      const now = ctx.currentTime
      try {
        this.out.gain.cancelScheduledValues(now)
        this.out.gain.setValueAtTime(this.out.gain.value, now)
        this.out.gain.linearRampToValueAtTime(0, now + 2.2)
      } catch { /* detached */ }
    }
    window.setTimeout(() => {
      if (this.playing) return
      for (const n of this.droneNodes) {
        try {
          const osc = n as OscillatorNode
          if (typeof osc.stop === 'function') osc.stop()
        } catch { /* ignore */ }
        try { n.disconnect() } catch { /* ignore */ }
      }
      this.droneNodes = []
    }, 2500)
  }

  /* ── the drone ──────────────────────────────────────────────────────── */

  private buildDrone(ctx: AudioContext): void {
    if (this.droneNodes.length || !this.out) return
    this.droneNodes = buildDrone(ctx, this.out)
  }

  /* ── the scheduler ──────────────────────────────────────────────────── */

  private tick(): void {
    const ctx = this.engine.context()
    if (!ctx || !this.out) return
    const horizon = ctx.currentTime + LOOKAHEAD
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.05

    let budget = 6
    while (this.nextNote < horizon && budget-- > 0) {
      this.step(ctx, this.nextNote)
    }
  }

  private step(ctx: AudioContext, when: number): void {
    // A weighted walk: mostly neighbouring degrees, occasionally a leap. This is
    // the difference between a melody and a random number generator.
    const move = Math.random()
    if (move < 0.44) this.degree += Math.random() < 0.5 ? 1 : -1
    else if (move < 0.62) this.degree += Math.random() < 0.5 ? 2 : -2
    else if (move < 0.70) this.degree += Math.random() < 0.5 ? 3 : -3

    if (this.degree < 0) { this.degree += DEGREES.length; this.octave-- }
    if (this.degree >= DEGREES.length) { this.degree -= DEGREES.length; this.octave++ }
    if (this.octave < OCTAVES[0]) this.octave = OCTAVES[0] + 1
    if (this.octave > OCTAVES[OCTAVES.length - 1]) this.octave = OCTAVES[OCTAVES.length - 1] - 1

    const velocity = 0.5 + Math.random() * 0.5
    this.pluck(ctx, when, noteFreq(this.degree, this.octave), velocity)

    // A quick answering note, humanised — never a machine-exact grace note.
    if (Math.random() < PHRASE_CHANCE) {
      const follow = when + 0.17 + Math.random() * 0.16
      const up = Math.random() < 0.6 ? 1 : -1
      let d = this.degree + up
      let o = this.octave
      if (d < 0) { d += DEGREES.length; o-- }
      if (d >= DEGREES.length) { d -= DEGREES.length; o++ }
      this.pluck(ctx, follow, noteFreq(d, o), velocity * 0.72)
      this.nextNote = follow
    }

    this.nextNote += GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN)
    if (Math.random() < REST_CHANCE) this.nextNote += Math.random() * REST_MAX
  }

  /** One kalimba note now, at a middling velocity. What the Music fader auditions. */
  previewNote(): void {
    const ctx = this.engine.context()
    const bus = this.engine.bus('music')
    if (!ctx || !bus) return
    // Straight to the bus, not through `out` — the fader should be auditionable
    // whether or not the music itself is running.
    const g = ctx.createGain()
    g.gain.value = MUSIC_TRIM
    g.connect(bus)
    pluckNote(ctx, g, ctx.currentTime + 0.02, noteFreq(2, 2), 0.85)
    window.setTimeout(() => { try { g.disconnect() } catch { /* ignore */ } }, 6000)
  }

  private pluck(ctx: AudioContext, when: number, freq: number, velocity: number): void {
    if (this.out) pluckNote(ctx, this.out, when, freq, velocity)
  }
}

/**
 * The drone: root and fifth, each detuned a few cents against a twin. The pairs
 * beat at well under 1Hz, which is what makes a drone feel alive rather than
 * synthetic — no LFO required.
 *
 * Standalone so `tools/mix-report` can render the real thing into an
 * OfflineAudioContext and read its level, instead of a copy of it that could
 * drift out of step.
 */
export function buildDrone(ctx: BaseAudioContext, dest: AudioNode): AudioNode[] {
  const nodes: AudioNode[] = []

  const shelf = ctx.createBiquadFilter()
  shelf.type = 'lowpass'
  shelf.frequency.value = 420
  shelf.Q.value = 0.4
  shelf.connect(dest)

  const g = ctx.createGain()
  g.gain.value = 0.09
  g.connect(shelf)

  for (const [freq, detune, level] of [
    [ROOT / 2, -4, 1],
    [ROOT / 2, +5, 0.9],
    [(ROOT / 2) * 1.5, -3, 0.45],
    [(ROOT / 2) * 1.5, +4, 0.4],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.detune.value = detune
    const og = ctx.createGain()
    og.gain.value = level
    osc.connect(og).connect(g)
    try { osc.start() } catch { /* ignore */ }
    nodes.push(osc, og)
  }
  nodes.push(g, shelf)
  return nodes
}

/** One kalimba note: inharmonic partials plus a thumbnail transient. */
export function pluckNote(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  freq: number,
  velocity: number,
): void {
  const body = ctx.createGain()
  body.gain.value = 0.16 * velocity
  // Higher notes are naturally quieter and shorter on a real tine.
  const bright = Math.min(1, 320 / freq)
  const life = 2.4 + bright * 2.6

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2600 + 1800 * bright
  tone.Q.value = 0.5
  body.connect(tone).connect(out)

  for (const p of PARTIALS) {
    const f = freq * p.ratio
    if (f > 16000) continue
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    // A hair of detune per note so no two strikes are identical.
    osc.detune.value = (Math.random() * 2 - 1) * 6

    const g = ctx.createGain()
    const decay = life * p.decay
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, p.gain), when + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay)

    osc.connect(g).connect(body)
    try {
      osc.start(when)
      osc.stop(when + decay + 0.05)
    } catch {
      continue
    }
    osc.onended = (): void => {
      try { osc.disconnect(); g.disconnect() } catch { /* ignore */ }
    }
  }

  // The thumbnail leaving the tine.
  const nlen = Math.max(1, Math.floor(ctx.sampleRate * 0.02))
  const nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate)
  const nd = nbuf.getChannelData(0)
  for (let i = 0; i < nlen; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nlen)
  const nsrc = ctx.createBufferSource()
  nsrc.buffer = nbuf
  const nf = ctx.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.value = Math.min(9000, freq * 4)
  nf.Q.value = 0.8
  const ng = ctx.createGain()
  ng.gain.value = 0.06 * velocity
  nsrc.connect(nf).connect(ng).connect(out)
  try { nsrc.start(when) } catch { /* ignore */ }
  nsrc.onended = (): void => {
    try { nsrc.disconnect(); nf.disconnect(); ng.disconnect() } catch { /* ignore */ }
  }

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      try { body.disconnect(); tone.disconnect() } catch { /* ignore */ }
    }, (when - ctx.currentTime + life + 0.5) * 1000)
  }
}
