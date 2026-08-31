// PAPER PLANET — generates the paper SFX library from ElevenLabs, then masters it.
//
//   export ELEVENLABS_API_KEY='...'
//   node tools/gen-sfx.mjs [--only <substring>] [--regen] [--report]
//
// Raw generations are cached in tools/.cache/raw so re-runs never re-hit the API
// and mastering can be re-tuned for free. Never writes the key anywhere.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decodeMp3, encodeMp3, toMono, removeDc, highpass, normalize, trimSilence,
  fadeEdges, loopCrossfade, seamScore, analyze, envelopeArt, bandArt, isolateTransient,
  lowpass, densify, holeRatio,
} from './audio-lib.mjs'
import { SPEC, FAMILY_TARGETS, VARIANT_INFLUENCE } from './sfx-spec.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const RAW_DIR = path.join(HERE, '.cache', 'raw')
const OUT_DIR = path.join(ROOT, 'app', 'public', 'audio')
const MANIFEST = path.join(ROOT, 'app', 'src', 'audio', 'manifest.ts')

const API = 'https://api.elevenlabs.io/v1/sound-generation'
const CONCURRENCY = 4
const MAX_ATTEMPTS = 5

const argv = process.argv.slice(2)
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null
const regen = argv.includes('--regen')
const reportOnly = argv.includes('--report')

const log = (...a) => console.log(...a)

/* ─────────────────────────── generation ─────────────────────────── */

function assetName(spec, variant) {
  const base = spec.id.replace(/\./g, '-')
  return spec.variants > 1 ? `${base}-${variant + 1}` : base
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function generate(spec, variant, rawPath) {
  const influence = VARIANT_INFLUENCE[variant % VARIANT_INFLUENCE.length]
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in the environment')

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 180_000)
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spec.variantHints?.[variant] ? `${spec.prompt}, ${spec.variantHints[variant]}` : spec.prompt,
          duration_seconds: spec.duration,
          prompt_influence: influence,
        }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer))

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${body.slice(0, 180)}`)
      }
      const bytes = Buffer.from(await res.arrayBuffer())
      // Guard against a JSON error body served with a 200.
      const isMp3 = bytes.length > 2048 && (bytes[0] === 0xff || bytes.subarray(0, 3).toString() === 'ID3')
      if (!isMp3) throw new Error(`not an mp3 (${bytes.length} bytes: ${bytes.subarray(0, 60).toString()})`)
      fs.writeFileSync(rawPath, bytes)
      return bytes.length
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err
      const backoff = Math.round(900 * Math.pow(2, attempt - 1) + Math.random() * 500)
      log(`      retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoff}ms — ${String(err.message).slice(0, 90)}`)
      await sleep(backoff)
    }
  }
  throw new Error('unreachable')
}

async function pool(items, limit, worker) {
  let idx = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      await worker(items[i], i)
    }
  })
  await Promise.all(runners)
}

/* ─────────────────────────── mastering ─────────────────────────── */

/**
 * Raw generation → shippable cue. One-shots get trimmed tight so playback has no
 * latency; textures and beds get folded into a seamless loop.
 */
async function master(spec, rawBytes) {
  const decoded = await decodeMp3(rawBytes)
  const sr = decoded.sampleRate
  let pcm = toMono(decoded.channels)
  removeDc(pcm)

  // Paper has essentially nothing below ~100Hz and a nature bed nothing below
  // ~80Hz; what the generator puts there is mic rumble that muddies headphone
  // listening and eats bitrate. Two passes for a steeper slope.
  const hpF = spec.kind === 'ambience' ? 90 : 100
  pcm = highpass(highpass(pcm, sr, hpF), sr, hpF)

  // Distance rolls off highs; the generator does not know that, and a bed with
  // its energy up at 10kHz reads as hiss rather than as a place. Pull the top
  // back so the beds sit behind the paper instead of competing with it.
  const lpF = spec.lowpass ?? (spec.kind === 'ambience' ? 9500 : 0)
  if (lpF) pcm = lowpass(pcm, sr, lpF)

  let loopStart = 0
  let loopEnd = 0

  if (spec.kind === 'oneshot') {
    // Cues that must read as one discrete event get cut down to their single
    // loudest transient before trimming.
    if (spec.isolate) pcm = isolateTransient(pcm, sr, spec.isolate)
    pcm = trimSilence(pcm, sr, spec.isolate
      ? { thresholdDb: -58, lookbackMs: 4, tailMs: 40 }
      : { thresholdDb: -46, lookbackMs: 6, tailMs: 70 }).pcm
    fadeEdges(pcm, sr, 2.5, 28)
  } else {
    // Trim leniently — a bed's quiet passages are content, not silence.
    pcm = trimSilence(pcm, sr, { thresholdDb: -60, lookbackMs: 0, tailMs: 0 }).pcm
    const xfade = spec.kind === 'ambience' ? 2.5 : 1.2
    pcm = loopCrossfade(pcm, sr, xfade)
    // A bed that drops out mid-loop reads as a glitch, and a granular source
    // with a hole in it stutters. Thicken only when there is actually a hole,
    // and check again — one overlap-add fills roughly half of what it finds.
    for (let i = 0; i < 2 && holeRatio(pcm, sr) > 0.03; i++) pcm = densify(pcm)
    loopStart = 0
    loopEnd = pcm.length / sr
  }

  const target = FAMILY_TARGETS[spec.family]
  // Beds are stationary, so a touch of limiting is inaudible and keeps the
  // crossfade sum in check. One-shots and textures back off instead (see
  // audio-lib normalize) so their attacks survive intact.
  const isBed = spec.kind === 'ambience'
  const { gainDb, limitDb } = normalize(pcm, sr, {
    targetRmsDb: target,
    ceilingDb: isBed ? -6 : -1.5,
    maxGainDb: isBed ? 60 : 46,
    // Beds are stationary so limiting is free. One-shots allow at most 4dB of
    // peak shaving — enough to keep round-robin variants level-matched, little
    // enough that the attack that makes paper sound crisp survives intact.
    maxLimitDb: isBed ? 12 : 4,
  })

  const kbps = spec.kind === 'ambience' ? 112 : 128
  const mp3 = encodeMp3(pcm, sr, kbps)

  // Re-decode so the manifest reports the file as the browser will hear it.
  let shipped = pcm
  try {
    const back = await decodeMp3(mp3)
    shipped = toMono(back.channels)
  } catch { /* fall back to the pre-encode PCM */ }

  return { pcm, shipped, sr, mp3, gainDb, limitDb, loopStart, loopEnd }
}

/* ─────────────────────────── main ─────────────────────────── */

fs.mkdirSync(RAW_DIR, { recursive: true })
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })

const jobs = []
for (const spec of SPEC) {
  if (only && !spec.id.includes(only)) continue
  for (let v = 0; v < spec.variants; v++) {
    const name = assetName(spec, v)
    jobs.push({ spec, variant: v, name, rawPath: path.join(RAW_DIR, `${name}.mp3`) })
  }
}

log(`PAPER PLANET · sfx pipeline`)
log(`  ${SPEC.length} cues → ${jobs.length} files${only ? `  (filter: ${only})` : ''}`)

if (!reportOnly) {
  const todo = jobs.filter((j) => regen || !fs.existsSync(j.rawPath))
  log(`  ${jobs.length - todo.length} cached · ${todo.length} to generate\n`)

  let done = 0
  const failures = []
  await pool(todo, CONCURRENCY, async (job) => {
    try {
      const bytes = await generate(job.spec, job.variant, job.rawPath)
      done++
      log(`  [${String(done).padStart(2)}/${todo.length}] ${job.name.padEnd(24)} ${(bytes / 1024).toFixed(0)}kB raw`)
    } catch (err) {
      done++
      failures.push({ name: job.name, err: String(err.message) })
      log(`  [${String(done).padStart(2)}/${todo.length}] ${job.name.padEnd(24)} FAILED — ${String(err.message).slice(0, 100)}`)
    }
  })
  if (failures.length) log(`\n  ${failures.length} generation(s) failed; re-run to resume.`)
}

/* ── master + analyse everything we have ── */
log(`\n  mastering…\n`)
const entries = new Map()
const rows = []
let totalBytes = 0

for (const job of jobs) {
  if (!fs.existsSync(job.rawPath)) { log(`  ${job.name.padEnd(24)} MISSING RAW — skipped`); continue }
  const raw = fs.readFileSync(job.rawPath)
  let out
  try {
    out = await master(job.spec, raw)
  } catch (err) {
    log(`  ${job.name.padEnd(24)} MASTER FAILED — ${String(err.message).slice(0, 90)}`)
    continue
  }
  const file = `${job.name}.mp3`
  fs.writeFileSync(path.join(OUT_DIR, file), out.mp3)
  totalBytes += out.mp3.length

  const a = analyze(out.shipped, out.sr)
  const seam = job.spec.kind === 'oneshot' ? 0 : seamScore(out.pcm, out.sr)
  const hole = job.spec.kind === 'oneshot' ? 0 : holeRatio(out.shipped, out.sr)
  rows.push({ job, file, bytes: out.mp3.length, a, seam, hole, gainDb: out.gainDb })

  const list = entries.get(job.spec.id) ?? []
  list.push({
    file: `/audio/${file}`,
    bytes: out.mp3.length,
    duration: +a.duration.toFixed(3),
    peakDb: +a.peakDb.toFixed(1),
    rmsDb: +a.activeRmsDb.toFixed(1),
    loopStart: +out.loopStart.toFixed(3),
    loopEnd: +out.loopEnd.toFixed(3),
  })
  entries.set(job.spec.id, list)
}

/* ── the report: this is how we "listen" ── */
log(`  ${'cue'.padEnd(24)} ${'dur'.padStart(6)} ${'pk'.padStart(6)} ${'rms'.padStart(6)} ${'cen'.padStart(6)} ${'flat'.padStart(5)} ${'kB'.padStart(5)}  bands      envelope`)
log(`  ${'-'.repeat(24)} ${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(5)} ${'-'.repeat(5)}  ${'-'.repeat(9)}  ${'-'.repeat(40)}`)
for (const r of rows) {
  log(
    `  ${r.file.replace('.mp3', '').padEnd(24)}` +
    ` ${r.a.duration.toFixed(2).padStart(6)}` +
    ` ${r.a.peakDb.toFixed(1).padStart(6)}` +
    ` ${r.a.activeRmsDb.toFixed(1).padStart(6)}` +
    ` ${Math.round(r.a.centroid).toString().padStart(6)}` +
    ` ${r.a.flatness.toFixed(3).padStart(5)}` +
    ` ${(r.bytes / 1024).toFixed(0).padStart(5)}` +
    `  ${bandArt(r.a.bands)}  ${envelopeArt(r.a.env, 40)}`,
  )
}

log(`\n  total ${(totalBytes / 1024 / 1024).toFixed(2)} MB across ${rows.length} files`)

/* ─────────────────────────── manifest ─────────────────────────── */

if (!only) {
  const oneshots = SPEC.filter((s) => s.kind === 'oneshot')
  const textures = SPEC.filter((s) => s.kind === 'texture')
  const ambiences = SPEC.filter((s) => s.kind === 'ambience')

  const fmt = (id) => {
    const list = entries.get(id) ?? []
    return list.map((e) =>
      `    { file: '${e.file}', bytes: ${e.bytes}, duration: ${e.duration}, peakDb: ${e.peakDb}, rmsDb: ${e.rmsDb} },`
    ).join('\n')
  }
  const fmtLoop = (id) => {
    const e = (entries.get(id) ?? [])[0]
    if (!e) return null
    return `  { file: '${e.file}', bytes: ${e.bytes}, duration: ${e.duration}, peakDb: ${e.peakDb}, rmsDb: ${e.rmsDb}, loopEnd: ${e.loopEnd} }`
  }

  const src = `// PAPER PLANET — GENERATED by tools/gen-sfx.mjs. Do not edit by hand.
//
// Every asset is close-mic'd paper generated with ElevenLabs, then mastered:
// DC-removed, high-passed, silence-trimmed, loudness-matched per family and
// peak-limited. Loops are tail-over-head crossfaded so they wrap seamlessly.

import type { SfxCue, AmbienceId } from '../contracts'

/** One playable file. \`duration\` is the mastered length in seconds. */
export interface AudioAsset {
  readonly file: string
  readonly bytes: number
  readonly duration: number
  readonly peakDb: number
  readonly rmsDb: number
}

/** A continuous source built to wrap; \`loopEnd\` is its seamless length. */
export interface LoopAsset extends AudioAsset {
  readonly loopEnd: number
}

/** Continuous sources the granular friction voice and press-hold layer play. */
export type TextureId = ${textures.map((t) => `'${t.id}'`).join(' | ')}

/** Round-robin variants per cue. Index 0 is always present. */
export const SFX: Readonly<Record<SfxCue, readonly AudioAsset[]>> = {
${oneshots.map((s) => `  '${s.id}': [\n${fmt(s.id)}\n  ],`).join('\n')}
}

export const TEXTURES: Readonly<Record<TextureId, LoopAsset>> = {
${textures.map((s) => `  '${s.id}':\n  ${fmtLoop(s.id)},`).join('\n')}
}

export const AMBIENCE: Readonly<Record<Exclude<AmbienceId, 'none'>, LoopAsset>> = {
${ambiences.map((s) => `  '${s.id.replace('amb.', '')}':\n  ${fmtLoop(s.id)},`).join('\n')}
}

/** Cues worth having decoded before the player's first gesture. */
export const PRELOAD_CORE: readonly SfxCue[] = [
  'ui.tap', 'ui.confirm', 'ui.back', 'crease.soft', 'crease.crisp', 'crease.set',
  'fold.valley', 'fold.mountain', 'sheet.slide', 'sheet.settle',
]

export const TOTAL_BYTES = ${totalBytes}
`
  fs.writeFileSync(MANIFEST, src)
  log(`  manifest → ${path.relative(ROOT, MANIFEST)}`)
}
