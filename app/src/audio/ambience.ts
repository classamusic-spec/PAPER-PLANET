// PAPER PLANET — gapless ambience beds with equal-power crossfades between them.

import type { AmbienceId } from '../contracts'
import type { AudioEngine } from './engine'
import { equalPowerCurve } from './engine'
import type { Sampler } from './sampler'
import { AMBIENCE } from './manifest'
import { fileGain } from './mix'

type BedId = Exclude<AmbienceId, 'none'>

interface Bed {
  id: BedId
  gain: GainNode
  sources: AudioBufferSourceNode[]
  nodes: AudioNode[]
}

/** Second voice lags the first by this much to build a stereo image from mono. */
const WIDTH_OFFSET = 3.7
const WIDTH_PAN = 0.72

/**
 * Plays one bed at a time, crossfading on change.
 *
 * The beds ship mono — the generator produces dual-mono anyway, so stereo files
 * would have doubled the download for nothing. Width is built at playback
 * instead: the same buffer runs twice, offset by a few seconds and panned apart.
 * Two different slices of a stationary recording are genuinely decorrelated, so
 * this reads as a real stereo field rather than a widened mono one, and it
 * stays perfectly mono-compatible.
 */
export class Ambience {
  private engine: AudioEngine
  private sampler: Sampler
  private current: Bed | null = null
  private outgoing: Bed[] = []
  private wanted: AmbienceId = 'none'
  private token = 0

  constructor(engine: AudioEngine, sampler: Sampler) {
    this.engine = engine
    this.sampler = sampler
  }

  currentId(): AmbienceId {
    return this.wanted
  }

  /** Crossfade to a bed. `none` fades out whatever is playing. */
  set(id: AmbienceId, fadeSeconds = 2.5): void {
    if (id === this.wanted) return
    this.wanted = id
    const seq = ++this.token

    if (id === 'none') {
      this.fadeOutCurrent(fadeSeconds)
      return
    }

    const asset = AMBIENCE[id]
    if (!asset) {
      this.fadeOutCurrent(fadeSeconds)
      return
    }

    void this.sampler.load(asset.file).then((sample) => {
      // The player switched again while this was decoding — drop it.
      if (seq !== this.token || !sample) return
      const ctx = this.engine.context()
      const bus = this.engine.bus('ambience')
      if (!ctx || !bus) return

      this.fadeOutCurrent(fadeSeconds)

      // Beds ship 6 dB apart from each other; ./mix says what each one has to
      // be multiplied by to sit in the same room as the others.
      const level = fileGain(asset.file)

      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      gain.connect(bus)

      const nodes: AudioNode[] = []
      const sources: AudioBufferSourceNode[] = []
      const loopEnd = Math.min(asset.loopEnd, sample.buffer.duration - sample.leadIn)

      for (const pan of [-WIDTH_PAN, WIDTH_PAN]) {
        const src = ctx.createBufferSource()
        src.buffer = sample.buffer
        src.loop = true
        // The loop window starts past whatever dead air the MP3 decoder left,
        // and ends at the length the build-time crossfade made seamless.
        src.loopStart = sample.leadIn
        src.loopEnd = sample.leadIn + loopEnd

        let tail: AudioNode = src
        if (typeof ctx.createStereoPanner === 'function') {
          const p = ctx.createStereoPanner()
          p.pan.value = pan
          src.connect(p)
          nodes.push(p)
          tail = p
        }
        tail.connect(gain)

        const start = pan < 0 ? 0 : WIDTH_OFFSET % Math.max(0.5, loopEnd)
        try {
          src.start(ctx.currentTime, sample.leadIn + start)
        } catch {
          continue
        }
        sources.push(src)
      }

      if (!sources.length) {
        try { gain.disconnect() } catch { /* ignore */ }
        return
      }

      const bed: Bed = { id, gain, sources, nodes }
      this.current = bed

      const now = ctx.currentTime
      const dur = Math.max(0.05, fadeSeconds)
      try {
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.setValueCurveAtTime(equalPowerCurve(0, level), now, dur)
      } catch {
        gain.gain.value = level
      }
    })
  }

  /**
   * Play a short slice of a bed, for the Room fader in Settings to audition.
   *
   * Only used when no bed is actually running: when one *is*, the fader already
   * moves it live and layering a second copy on top would turn every nudge of
   * the slider into a gust. Fades at both ends, because a room does not start.
   */
  audition(id: BedId, seconds = 1.4): void {
    const asset = AMBIENCE[id]
    if (!asset) return
    void this.sampler.load(asset.file).then((sample) => {
      const ctx = this.engine.context()
      const bus = this.engine.bus('ambience')
      if (!ctx || !bus || !sample) return

      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      gain.connect(bus)

      const level = fileGain(asset.file)
      const span = Math.max(0.5, Math.min(asset.loopEnd, sample.buffer.duration - sample.leadIn) - seconds)
      const src = ctx.createBufferSource()
      src.buffer = sample.buffer

      const now = ctx.currentTime + 0.02
      const fade = Math.min(0.35, seconds / 3)
      try {
        src.start(now, sample.leadIn + Math.random() * span, seconds)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.setValueCurveAtTime(equalPowerCurve(0, level), now, fade)
        gain.gain.setValueCurveAtTime(equalPowerCurve(level, 0), now + seconds - fade, fade)
      } catch {
        try { src.disconnect(); gain.disconnect() } catch { /* ignore */ }
        return
      }
      src.onended = (): void => {
        try { src.disconnect(); gain.disconnect() } catch { /* already gone */ }
      }
    })
  }

  private fadeOutCurrent(fadeSeconds: number): void {
    const bed = this.current
    this.current = null
    if (!bed) return
    const ctx = this.engine.context()
    if (!ctx) { this.kill(bed); return }

    this.outgoing.push(bed)
    const now = ctx.currentTime
    const dur = Math.max(0.05, fadeSeconds)
    try {
      bed.gain.gain.cancelScheduledValues(now)
      bed.gain.gain.setValueAtTime(bed.gain.gain.value, now)
      bed.gain.gain.setValueCurveAtTime(equalPowerCurve(bed.gain.gain.value, 0), now, dur)
    } catch {
      bed.gain.gain.value = 0
    }
    window.setTimeout(() => {
      this.outgoing = this.outgoing.filter((b) => b !== bed)
      this.kill(bed)
    }, dur * 1000 + 120)
  }

  private kill(bed: Bed): void {
    for (const s of bed.sources) {
      try { s.stop() } catch { /* already stopped */ }
      try { s.disconnect() } catch { /* ignore */ }
    }
    for (const n of bed.nodes) {
      try { n.disconnect() } catch { /* ignore */ }
    }
    try { bed.gain.disconnect() } catch { /* ignore */ }
  }

  dispose(): void {
    this.token++
    if (this.current) this.kill(this.current)
    for (const b of this.outgoing) this.kill(b)
    this.current = null
    this.outgoing = []
    this.wanted = 'none'
  }
}
