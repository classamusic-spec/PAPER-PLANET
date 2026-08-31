// PAPER PLANET — THE MIX. Where every sound sits, written as targets, not guesses.

import type { AmbienceId, AudioBus, SfxCue } from '../contracts'
import { LEVELS } from './levels'
import { AMBIENCE, SFX, TEXTURES } from './manifest'
import type { TextureId } from './manifest'

/* ═══════════════════════════════════════════════════════════════════════════
   THE SHAPE OF THE MIX

   BRAND section 8: the paper is the instrument, ambience is a room tone, and
   it should be possible to not notice the music. So the paper is the anchor
   and everything else is placed relative to it, in LU:

       reward       +1.5   the loudest moment the game is allowed
       crease/fold    0    ◀── THE ANCHOR
       sheet/press   −1
       alive         −2
       ui            −7    chrome, clearly behind the material
       ambience     −19    at the default fader. A room, not a layer.
       music        −25    sparse, pitched, and therefore salient at −25

   Every number below is measured, not guessed: `levels.ts` says where each
   file actually sits and this file says where it should sit. Nothing is
   re-mastered — the shipped audio is untouched and the mix is data.
   `node tools/mix-report.mjs` prints the resulting table.
   ═══════════════════════════════════════════════════════════════════════════ */

export const dbToGain = (db: number): number => Math.pow(10, db / 20)
export const gainToDb = (g: number): number => (g <= 1e-9 ? -Infinity : 20 * Math.log10(g))

/* ── per-cue placement ──────────────────────────────────────────────────── */

export type CueFamily = 'crease' | 'fold' | 'sheet' | 'press' | 'ui' | 'alive' | 'reward'

/**
 * The paper, in LUFS measured over its loudest 100 ms.
 *
 * Set by headroom, not by taste: at this anchor the peakiest cue in the
 * library lands on the true-peak ceiling below and everything else lands
 * under it, which is what keeps the safety limiter idle. Turning this up is
 * not "louder" — it is "more limiting".
 */
export const PAPER_ANCHOR_LUFS = -22

export const FAMILY_TARGET_LUFS: Readonly<Record<CueFamily, number>> = {
  crease: PAPER_ANCHOR_LUFS,
  fold: PAPER_ANCHOR_LUFS,
  sheet: PAPER_ANCHOR_LUFS - 1,
  press: PAPER_ANCHOR_LUFS - 1,
  alive: PAPER_ANCHOR_LUFS - 2,
  ui: PAPER_ANCHOR_LUFS - 7,
  reward: PAPER_ANCHOR_LUFS + 1.5,
}

/**
 * Character within a family. The names are promises — a soft crease has to be
 * softer than a crisp one — and loudness-matching every variant would flatten
 * exactly the differences the vocabulary is made of.
 */
export const CUE_OFFSET_DB: Partial<Readonly<Record<SfxCue, number>>> = {
  'crease.soft': -2,
  // Variants 2 and 3 are genuinely peakier files than 1 and 4; the ceiling
  // below lands on them either way, so the target is set where it does not
  // then have to pull them 3 LU back out of line with their own siblings.
  'crease.crisp': -1,
  'sheet.slide': -0.5,
  'sheet.settle': -1,
  'sheet.pickup': -1.5,
  'press.release': -1,
  'ui.tap': -2,
  'ui.toggle': -2,
  'ui.close': -1.5,
  'ui.confirm': 0.5,
  'alive.breath': -2,
  'alive.nuzzle': -1,
  'reward.mastery': 1.5,
}

/**
 * True-peak ceiling for a one-shot, before any bus or master gain.
 *
 * A handful of cues are spikes: `crease.crisp` variants 2 and 3 carry 21 dB of
 * crest, so loudness-matching them alone would push their peaks to −0.4 dBTP
 * and hand the limiter a transient to chew on every crisp crease. Where the
 * ceiling bites, the cue plays a little under its loudness target — which is
 * the right answer for a click, because a click is heard by its peak.
 */
export const ONESHOT_CEILING_DBTP = -3

/** Nothing in the library needs more than this. A wider range means a mistake. */
const TRIM_MIN_DB = -14
const TRIM_MAX_DB = 10

/* ── the beds ───────────────────────────────────────────────────────────── */

/**
 * Beds are normalised on a blend of integrated and loudest-3s loudness.
 *
 * Integrated alone lets `tearoom` — 28 LU of range between its quiet stretches
 * and its swells — sit correctly on average while its swells poke through the
 * paper. Loudest-3s alone makes the calm beds too quiet to be a room at all.
 * 60/40 lands both statistics inside 2 dB across all five.
 */
export const BED_INTEGRATED_WEIGHT = 0.6

/** Beds are normalised to the paper anchor; the ambience bus does the placing. */
export const BED_TARGET_LUFS = PAPER_ANCHOR_LUFS

/* ── the friction voice ─────────────────────────────────────────────────── */

/**
 * Grain sources are matched on ungated level: a grain lands anywhere in the
 * file with equal probability, so gating out the quiet parts would describe a
 * signal the granular engine never actually plays.
 */
export const TEXTURE_TARGET_LUFS = -20

/**
 * Output trim on the whole friction voice, chosen so that a deliberate rub
 * (v ≈ 0.3) lands about 4 LU under a crease and a brisk one lands just over
 * it — measured, not guessed; `tools/mix-report.mjs` renders the voice offline
 * and prints where it actually sits.
 */
export const FRICTION_TRIM = 0.30

/* ── the music ──────────────────────────────────────────────────────────── */

/**
 * Output trim on the synthesised music, so the drone — the continuous part,
 * and therefore the part that sets the level — sits at the target. Measured
 * the same way as the friction voice.
 */
export const MUSIC_TRIM = 0.62

/* ── buses ──────────────────────────────────────────────────────────────── */

/**
 * Where a bus sits with its fader all the way up.
 *
 * This is what stops "loud" from ever being on the table. Ambience at full
 * travel is 11 LU under the paper: audible, unmistakably a room, and still
 * behind the material. The player cannot turn the room into a layer, because
 * BRAND section 8 does not have a setting for that.
 */
export const BUS_CEILING_DB: Readonly<Record<AudioBus, number>> = {
  master: 0,
  sfx: 0,
  ambience: -11,
  music: -15,
}

/**
 * Fader law. `gain = ceiling · position^taper`.
 *
 * A linear fader spends half its travel in the top 6 dB, where nothing much
 * changes, and crams everything audible into the bottom eighth. These exponents
 * spread the range a player actually cares about across the whole rail: the
 * ambience fader now covers 26 dB between a whisper and a room, and its default
 * sits at the middle of the travel with somewhere to go in both directions.
 */
export const BUS_TAPER: Readonly<Record<AudioBus, number>> = {
  master: 1.6,
  sfx: 1.6,
  ambience: 1.33,
  music: 1.33,
}

/** Fader position (0..1) → linear gain for a bus. */
export function busGain(bus: AudioBus, position: number): number {
  const p = Math.max(0, Math.min(1, position))
  if (p <= 0) return 0
  return dbToGain(BUS_CEILING_DB[bus]) * Math.pow(p, BUS_TAPER[bus])
}

/**
 * How far the beds step back while the Studio is open.
 *
 * −4 LU, not the −7.5 it was: with the mix given real headroom the room no
 * longer has to be shoved out of the way to hear the paper, and a room that
 * vanishes when you start folding is a room you notice leaving. Music goes
 * further because a pitched note competes for attention in a way a room tone
 * does not.
 */
export const FOCUS_DUCK_DB: Readonly<Record<'ambience' | 'music', number>> = {
  ambience: -4,
  music: -9,
}

/** Into focus briskly, out of it gently — coming back to the room is not an event. */
export const FOCUS_RAMP_IN = 0.7
export const FOCUS_RAMP_OUT = 1.4

/* ── the safety limiter ─────────────────────────────────────────────────── */

/**
 * A safety net, and nothing else.
 *
 * At −8/knee 8 it started working at −12 dBFS, which every single paper cue
 * cleared by 10 dB — so it was applying about 5 dB of gain reduction on every
 * crease, to the whole master bus, with a 220 ms release. The beds ducked and
 * swelled under the player's own folding. That pumping is a large part of why
 * the room "felt loud": it was not loud, it was moving. With the mix trimmed
 * to a −3 dBTP ceiling nothing reaches this any more except a genuine pile-up.
 */
export const LIMITER = {
  thresholdDb: -3,
  kneeDb: 4,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
} as const

/* ═══════════════════════════════════════════════════════════════════════════
   RESOLUTION — targets + measurements → one gain per file
   ═══════════════════════════════════════════════════════════════════════════ */

const clampTrim = (db: number): number => Math.max(TRIM_MIN_DB, Math.min(TRIM_MAX_DB, db))

export function cueFamily(cue: SfxCue): CueFamily {
  return cue.slice(0, cue.indexOf('.')) as CueFamily
}

/** Where this cue is meant to sit, in LUFS over its loudest 100 ms. */
export function cueTargetLufs(cue: SfxCue): number {
  return FAMILY_TARGET_LUFS[cueFamily(cue)] + (CUE_OFFSET_DB[cue] ?? 0)
}

/** Trim for one one-shot file, in dB: loudness target, then the peak ceiling. */
export function oneShotTrimDb(cue: SfxCue, file: string): number {
  const m = LEVELS[file]
  if (!m) return 0
  const loudness = clampTrim(cueTargetLufs(cue) - m.l100)
  const peakRoom = ONESHOT_CEILING_DBTP - m.tp
  return Math.min(loudness, peakRoom)
}

/** Trim for one bed file, in dB. */
export function bedTrimDb(file: string): number {
  const m = LEVELS[file]
  if (!m) return 0
  const level = BED_INTEGRATED_WEIGHT * m.li + (1 - BED_INTEGRATED_WEIGHT) * m.ls
  return clampTrim(BED_TARGET_LUFS - level)
}

/** Trim for one granular source, in dB. */
export function textureTrimDb(id: TextureId): number {
  const m = LEVELS[TEXTURES[id].file]
  if (!m) return 0
  return clampTrim(TEXTURE_TARGET_LUFS - m.lu)
}

/**
 * Every playable file → its linear trim.
 *
 * Built once at module load from the manifest, so `Sampler.playFile` costs one
 * map lookup and no caller can forget to apply the mix.
 */
export const FILE_GAIN: Readonly<Record<string, number>> = (() => {
  const out: Record<string, number> = {}
  for (const cue of Object.keys(SFX) as SfxCue[]) {
    for (const asset of SFX[cue]) out[asset.file] = dbToGain(oneShotTrimDb(cue, asset.file))
  }
  for (const id of Object.keys(AMBIENCE) as Exclude<AmbienceId, 'none'>[]) {
    out[AMBIENCE[id].file] = dbToGain(bedTrimDb(AMBIENCE[id].file))
  }
  return out
})()

/** Linear trim for a file, or 1 for anything the mix does not place. */
export function fileGain(file: string): number {
  return FILE_GAIN[file] ?? 1
}

/** Linear trim for a granular source. */
export const TEXTURE_GAIN: Readonly<Record<TextureId, number>> = (() => {
  const out = {} as Record<TextureId, number>
  for (const id of Object.keys(TEXTURES) as TextureId[]) out[id] = dbToGain(textureTrimDb(id))
  return out
})()
