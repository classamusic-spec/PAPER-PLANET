// PAPER PLANET — the AudioService singleton. The only audio surface the app imports.

import type {
  AmbienceId, AudioBus, AudioService, HapticService, PlayOptions, SfxCue,
} from '../contracts'
import { AudioEngine } from './engine'
import { Sampler } from './sampler'
import { GranularFriction } from './granular'
import { Ambience } from './ambience'
import { Music } from './music'
import { haptics } from './haptics'
import { AMBIENCE, PRELOAD_CORE, SFX, TEXTURES, TOTAL_BYTES } from './manifest'

/** What the Room fader auditions when the player has chosen silence. */
const PREVIEW_BED = 'meadow'

export type { TextureId, AudioAsset, LoopAsset } from './manifest'
export { AMBIENCE, SFX, TEXTURES, TOTAL_BYTES } from './manifest'

/**
 * Implements `contracts.AudioService`.
 *
 * Every method is safe to call at any time, in any order, before unlock, before
 * assets exist, and in a browser with no WebAudio at all. Nothing here throws
 * and nothing blocks the main thread — a missing cue is silence, never an
 * exception, and the app is fully playable with `public/audio` empty.
 */
class PaperAudio implements AudioService {
  private engine = new AudioEngine()
  private sampler: Sampler
  private granular: GranularFriction
  private ambience: Ambience
  private music: Music
  private unlocking: Promise<void> | null = null
  private warmed = false

  constructor() {
    this.sampler = new Sampler(this.engine)
    this.granular = new GranularFriction(this.engine, this.sampler)
    this.ambience = new Ambience(this.engine, this.sampler)
    this.music = new Music(this.engine)
  }

  /* ── lifecycle ──────────────────────────────────────────────────────── */

  /** Call from a real user gesture. Idempotent and safe to await repeatedly. */
  async unlock(): Promise<void> {
    if (!this.unlocking) {
      this.unlocking = this.engine.unlock().then(() => {
        // Get the cues the first screen needs decoded now, then trickle the
        // rest in at idle so nothing ever plays silently and first paint is
        // never waiting on audio.
        void this.preload(PRELOAD_CORE).then(() => this.warm())
      })
    }
    await this.unlocking
    // A later unlock() after an iOS interruption should re-resume the context.
    if (!this.engine.ready()) await this.engine.unlock()
  }

  ready(): boolean {
    return this.engine.ready()
  }

  /* ── one-shots ──────────────────────────────────────────────────────── */

  play(cue: SfxCue, opts?: PlayOptions): void {
    this.sampler.playCue(cue, opts)
  }

  /* ── the friction voice ─────────────────────────────────────────────── */

  friction(velocity: number, pressure?: number): void {
    this.granular.friction(velocity, pressure)
  }

  frictionEnd(): void {
    this.granular.end()
  }

  /* ── beds & music ───────────────────────────────────────────────────── */

  setAmbience(id: AmbienceId, fadeSeconds?: number): void {
    this.ambience.set(id, fadeSeconds)
  }

  getAmbience(): AmbienceId {
    return this.ambience.currentId()
  }

  setMusic(on: boolean): void {
    this.music.set(on)
  }

  /* ── mixing ─────────────────────────────────────────────────────────── */

  setBusVolume(bus: AudioBus, volume: number): void {
    this.engine.setBusVolume(bus, volume)
  }

  getBusVolume(bus: AudioBus): number {
    return this.engine.getBusVolume(bus)
  }

  /** During a fold the paper is the star: ambience and music step back. */
  setFocusMode(on: boolean): void {
    this.engine.setFocusMode(on)
  }

  /**
   * Play one short, representative sound on a bus, so a fader can be heard
   * while it is moved rather than guessed at.
   *
   * Ambience is the odd one out: when a bed is already running the fader
   * *is* the preview — it moves the real thing, live — and adding a second
   * copy over the top would make every nudge a gust. So the slice only plays
   * when the room is set to silence and there would otherwise be nothing to
   * hear at all.
   */
  previewBus(bus: AudioBus): void {
    void this.unlock()
    switch (bus) {
      case 'ambience': {
        const live = this.ambience.currentId()
        if (live === 'none') this.ambience.audition(PREVIEW_BED)
        break
      }
      case 'music':
        this.music.previewNote()
        break
      default:
        // Master and Paper are both auditioned by the paper, because the paper
        // is what this app is. A crisp crease is the shortest honest example.
        this.sampler.playCue('crease.crisp')
    }
  }

  /* ── loading ────────────────────────────────────────────────────────── */

  async preload(cues: SfxCue[] | readonly SfxCue[]): Promise<void> {
    await Promise.all([
      this.sampler.preload(cues),
      // The friction textures are the one thing that must never arrive late —
      // they are what the Studio is for.
      cues.some((c) => c.startsWith('crease') || c.startsWith('fold'))
        ? this.granular.preload()
        : Promise.resolve(),
    ])
  }

  /** Trickle the whole library in during idle time. Safe to call repeatedly. */
  warm(): void {
    if (this.warmed) return
    this.warmed = true
    const files = [
      ...Object.values(TEXTURES).map((t) => t.file),
      ...Object.values(SFX).flatMap((v) => v.map((a) => a.file)),
      ...Object.values(AMBIENCE).map((a) => a.file),
    ]
    this.sampler.warm(files)
  }

  /* ── extras beyond the contract ─────────────────────────────────────── */

  /** Paired haptics. Same lifetime as the audio service. */
  get haptics(): HapticService {
    return haptics
  }

  /** Total shipped audio, in bytes. */
  get bytes(): number {
    return TOTAL_BYTES
  }

  /** Release everything. Only useful in tests and hot-reload. */
  dispose(): void {
    this.granular.dispose()
    this.ambience.dispose()
    this.music.dispose()
    this.engine.dispose()
    this.unlocking = null
    this.warmed = false
  }
}

/** The one instance. Import this, not the classes. */
export const audio = new PaperAudio()

/** Haptics, paired with sound per BRAND.md §8. */
export { haptics } from './haptics'

export type { PaperAudio }
