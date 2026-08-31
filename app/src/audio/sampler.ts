// PAPER PLANET — sample loading, decoding, caching, round-robin variants and per-play jitter.

import type { PlayOptions, SfxCue } from '../contracts'
import type { AudioEngine, SourceBus } from './engine'
import { SFX } from './manifest'
import type { AudioAsset } from './manifest'
import { fileGain } from './mix'

/** A decoded buffer plus where its audible content actually starts. */
export interface LoadedSample {
  readonly buffer: AudioBuffer
  /**
   * Seconds of dead air at the head. MP3 carries ~25ms of encoder delay that
   * some decoders strip and some don't; measuring it means a tap fires the
   * instant it's asked for, on every browser.
   */
  readonly leadIn: number
}

export interface PlaySpec extends PlayOptions {
  bus?: SourceBus
  /** Extra gain jitter range, 0 disables. Default ±8%. */
  gainJitter?: number
  /** Extra pitch jitter as a ratio, 0 disables. Default ±3%. */
  pitchJitter?: number
  /**
   * Override the mix trim for this file. Only the previews in Settings use
   * this — everything else wants the mix, which is why it is the default.
   */
  trim?: number
}

const DEFAULT_GAIN_JITTER = 0.08
const DEFAULT_PITCH_JITTER = 0.03

function findLeadIn(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0)
  let peak = 0
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i])
    if (a > peak) peak = a
  }
  if (peak <= 1e-6) return 0
  const gate = peak * 0.0032 // −50 dB relative to the clip's own peak
  const block = 64
  for (let i = 0; i < data.length; i += block) {
    const end = Math.min(i + block, data.length)
    for (let j = i; j < end; j++) {
      if (Math.abs(data[j]) >= gate) {
        // Step back a touch so we never shave the very front of the attack.
        return Math.max(0, (i - block) / buffer.sampleRate)
      }
    }
  }
  return 0
}

/** Promise-form decodeAudioData with the old callback form as a fallback. */
function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false
    const ok = (b: AudioBuffer): void => { if (!settled) { settled = true; resolve(b) } }
    const bad = (e: unknown): void => { if (!settled) { settled = true; reject(e) } }
    try {
      const maybe = ctx.decodeAudioData(data, ok, bad) as unknown
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === 'function') {
        void (maybe as Promise<AudioBuffer>).then(ok, bad)
      }
    } catch (e) {
      bad(e)
    }
  })
}

/**
 * Loads, decodes and plays cues.
 *
 * Everything is lazy and failure-tolerant: a cue whose file is missing resolves
 * to null once, is remembered as null, and every later play of it is a silent
 * no-op. The app never blocks on audio and never throws because of it.
 */
export class Sampler {
  private engine: AudioEngine
  private cache = new Map<string, LoadedSample | null>()
  private inflight = new Map<string, Promise<LoadedSample | null>>()
  private bags = new Map<string, number[]>()
  private lastPick = new Map<string, number>()
  private warmed = false

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  /* ── loading ────────────────────────────────────────────────────────── */

  async load(file: string): Promise<LoadedSample | null> {
    const hit = this.cache.get(file)
    if (hit !== undefined) return hit
    const pending = this.inflight.get(file)
    if (pending) return pending

    const task = (async (): Promise<LoadedSample | null> => {
      const ctx = this.engine.context()
      if (!ctx) return null
      try {
        const res = await fetch(file, { cache: 'force-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await decode(ctx, await res.arrayBuffer())
        const sample: LoadedSample = { buffer, leadIn: findLeadIn(buffer) }
        this.cache.set(file, sample)
        return sample
      } catch {
        // Remembered as unavailable so we never retry in a hot path.
        this.cache.set(file, null)
        return null
      } finally {
        this.inflight.delete(file)
      }
    })()

    this.inflight.set(file, task)
    return task
  }

  /** Already-decoded buffer, or null. Never triggers a fetch. */
  peek(file: string): LoadedSample | null {
    return this.cache.get(file) ?? null
  }

  async preload(cues: readonly SfxCue[]): Promise<void> {
    const files = cues.flatMap((c) => (SFX[c] ?? []).map((a) => a.file))
    await Promise.all(files.map((f) => this.load(f)))
  }

  /**
   * Background-load the rest of the library once the app is idle, so nothing
   * ever plays silently but first paint is never blocked by audio.
   */
  warm(files: readonly string[]): void {
    if (this.warmed) return
    this.warmed = true
    const queue = files.filter((f) => !this.cache.has(f))
    const step = (): void => {
      const next = queue.splice(0, 3)
      if (!next.length) return
      void Promise.all(next.map((f) => this.load(f))).then(() => schedule())
    }
    const schedule = (): void => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
      if (ric) ric(step, { timeout: 1500 })
      else window.setTimeout(step, 220)
    }
    schedule()
  }

  /* ── variant selection ──────────────────────────────────────────────── */

  /**
   * A shuffle bag, not a counter. Plain round-robin is itself a pattern the ear
   * picks up after a few dozen creases; a reshuffled bag that never repeats
   * across its own seam gives even coverage and no detectable order.
   */
  private pick(key: string, count: number): number {
    if (count <= 1) return 0
    let bag = this.bags.get(key)
    if (!bag || bag.length === 0) {
      bag = Array.from({ length: count }, (_, i) => i)
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      const last = this.lastPick.get(key)
      if (last !== undefined && bag[bag.length - 1] === last && bag.length > 1) {
        ;[bag[bag.length - 1], bag[bag.length - 2]] = [bag[bag.length - 2], bag[bag.length - 1]]
      }
      this.bags.set(key, bag)
    }
    const idx = bag.pop() as number
    this.lastPick.set(key, idx)
    return idx
  }

  /* ── playback ───────────────────────────────────────────────────────── */

  /** Play a decoded file. Returns null when it isn't available yet. */
  playFile(file: string, spec: PlaySpec = {}): AudioBufferSourceNode | null {
    const ctx = this.engine.context()
    const bus = this.engine.bus(spec.bus ?? 'sfx')
    if (!ctx || !bus) return null

    const sample = this.peek(file)
    if (!sample) {
      // Not decoded yet — fetch it so the next call lands, and stay silent now.
      // A late sound is worse than no sound in a calm app.
      void this.load(file)
      return null
    }

    const gj = spec.gainJitter ?? DEFAULT_GAIN_JITTER
    const pj = spec.pitchJitter ?? DEFAULT_PITCH_JITTER

    const src = ctx.createBufferSource()
    src.buffer = sample.buffer

    // Explicit pitch wins; otherwise a small random detune so a hundred creases
    // in a row never sound like the same file a hundred times.
    const semis = spec.pitch ?? 0
    const jitter = pj ? 1 + (Math.random() * 2 - 1) * pj : 1
    src.playbackRate.value = Math.pow(2, semis / 12) * jitter

    // Three multiplications, in the order they mean something:
    //   the mix trim   — where this file sits in the library (./mix)
    //   the caller's volume — an artistic choice at the call site
    //   the jitter     — so a hundred identical creases are not identical
    const gain = ctx.createGain()
    const vol = spec.volume ?? 1
    const trim = spec.trim ?? fileGain(file)
    gain.gain.value = Math.max(0, trim * vol * (gj ? 1 + (Math.random() * 2 - 1) * gj : 1))

    src.connect(gain).connect(bus)
    src.onended = (): void => {
      try { src.disconnect(); gain.disconnect() } catch { /* already gone */ }
    }

    const when = ctx.currentTime + Math.max(0, spec.delay ?? 0)
    try {
      src.start(when, sample.leadIn)
    } catch {
      return null
    }
    return src
  }

  /** Play a contract cue, choosing a variant. Silent no-op if unavailable. */
  playCue(cue: SfxCue, opts: PlayOptions = {}): void {
    const variants: readonly AudioAsset[] = SFX[cue] ?? []
    if (!variants.length) return
    const asset = variants[this.pick(cue, variants.length)]
    this.playFile(asset.file, opts)
  }

  /** Every file this cue could play — used for preloading. */
  filesFor(cue: SfxCue): readonly string[] {
    return (SFX[cue] ?? []).map((a) => a.file)
  }
}
