// PAPER PLANET — verifies the shipped audio library against the shipped manifest.
//
//   node tools/verify-audio.mjs
//
// Parses app/src/audio/manifest.ts (the real artifact the app imports, not a
// sidecar), then decodes every file it names and checks it is actually a usable
// sound: present, the right length, audible, not clipped, not silence, not
// noise-garbage, and — for loops — free of holes and seams. Exits non-zero on
// any failure so it can gate a build.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeMp3, toMono, analyze, seamScore, holeRatio, envelopeArt, bandArt } from './audio-lib.mjs'
import { CONTRACT_CUES, AMBIENCE_IDS } from './sfx-spec.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const MANIFEST = path.join(ROOT, 'app', 'src', 'audio', 'manifest.ts')
const PUBLIC = path.join(ROOT, 'app', 'public')
const AUDIO_DIR = path.join(PUBLIC, 'audio')
const BUDGET_BYTES = 8 * 1024 * 1024

const TEXTURE_IDS = ['texture.rub.slow', 'texture.rub.fast', 'texture.burnish', 'texture.press.hold']

/* ─────────────────────────── manifest parsing ─────────────────────────── */

const ENTRY = /\{\s*file:\s*'([^']+)',\s*bytes:\s*(\d+),\s*duration:\s*([\d.]+),\s*peakDb:\s*(-?[\d.]+),\s*rmsDb:\s*(-?[\d.]+)(?:,\s*loopEnd:\s*([\d.]+))?\s*\}/

function parseSection(src, name) {
  const start = src.indexOf(`export const ${name}`)
  if (start < 0) return null
  const open = src.indexOf('{', start)
  let depth = 0, end = open
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const body = src.slice(open + 1, end)

  const out = new Map()
  let key = null
  for (const line of body.split('\n')) {
    const k = line.match(/^\s*'([^']+)'\s*:/)
    if (k) { key = k[1]; if (!out.has(key)) out.set(key, []) }
    const m = line.match(ENTRY)
    if (m && key) {
      out.get(key).push({
        file: m[1], bytes: +m[2], duration: +m[3], peakDb: +m[4], rmsDb: +m[5],
        loopEnd: m[6] === undefined ? null : +m[6],
      })
    }
  }
  return out
}

/* ─────────────────────────── checks ─────────────────────────── */

let failures = 0
let warnings = 0
const seen = new Set()

const fail = (what, why) => { failures++; console.log(`  FAIL  ${what.padEnd(26)} ${why}`) }
const warn = (what, why) => { warnings++; console.log(`  WARN  ${what.padEnd(26)} ${why}`) }

async function checkEntry(label, entry, kind) {
  const rel = entry.file.replace(/^\//, '')
  const abs = path.join(PUBLIC, rel)
  seen.add(path.resolve(abs))

  if (!fs.existsSync(abs)) { fail(label, `missing file ${entry.file}`); return null }
  const bytes = fs.statSync(abs).size
  if (bytes !== entry.bytes) fail(label, `size ${bytes} != manifest ${entry.bytes}`)
  if (bytes < 1500) { fail(label, `implausibly small (${bytes} bytes)`); return null }

  let pcm, sr
  try {
    const dec = await decodeMp3(fs.readFileSync(abs))
    sr = dec.sampleRate
    pcm = toMono(dec.channels)
  } catch (err) {
    fail(label, `will not decode — ${String(err.message).slice(0, 70)}`)
    return null
  }

  const a = analyze(pcm, sr)

  // Duration. A decoded MP3 runs up to ~51ms long: encoder delay plus the
  // padding that fills the final frame.
  const delta = a.duration - entry.duration
  if (delta < -0.025 || delta > 0.085) {
    fail(label, `duration ${a.duration.toFixed(3)}s vs manifest ${entry.duration}s (${delta >= 0 ? '+' : ''}${delta.toFixed(3)})`)
  }

  // Audible, and not clipped.
  if (a.peakDb < -40) { fail(label, `effectively silent (peak ${a.peakDb.toFixed(1)} dBFS)`); return a }
  if (a.peak >= 0.999) fail(label, `clipped (peak ${a.peakDb.toFixed(2)} dBFS)`)
  if (Math.abs(a.peakDb - entry.peakDb) > 2.5) {
    warn(label, `peak ${a.peakDb.toFixed(1)} vs manifest ${entry.peakDb}`)
  }
  if (Math.abs(a.activeRmsDb - entry.rmsDb) > 2.0) {
    warn(label, `rms ${a.activeRmsDb.toFixed(1)} vs manifest ${entry.rmsDb}`)
  }

  // Not garbage. White noise sits near flatness 1.0 and has no spectral shape;
  // real paper is structured noise well under that.
  if (a.flatness > 0.6) fail(label, `spectrally flat (${a.flatness.toFixed(3)}) — probably noise`)
  if (a.centroid < 150 || a.centroid > 13000) {
    warn(label, `centroid ${Math.round(a.centroid)}Hz is outside the plausible band`)
  }
  if (a.silenceRatio > 0.85) fail(label, `${(a.silenceRatio * 100).toFixed(0)}% silence`)

  if (kind === 'oneshot') {
    if (a.duration > 4) warn(label, `${a.duration.toFixed(2)}s is long for a one-shot`)
    if (a.duration < 0.06) fail(label, `${a.duration.toFixed(3)}s is too short to hear`)
  } else {
    if (entry.loopEnd === null) { fail(label, 'loop asset has no loopEnd'); return a }
    if (entry.loopEnd > a.duration + 0.001) {
      fail(label, `loopEnd ${entry.loopEnd}s exceeds the file (${a.duration.toFixed(3)}s)`)
    }
    const hole = holeRatio(pcm, sr)
    if (hole > 0.12) fail(label, `${(hole * 100).toFixed(0)}% of the loop is a dropout`)
    const seam = seamScore(pcm, sr)
    if (seam > 2.5) fail(label, `loop seam discontinuity ${seam.toFixed(2)}`)
    if (kind === 'texture' && a.longestSilenceSec > 0.25) {
      fail(label, `${a.longestSilenceSec.toFixed(2)}s gap — a granular source must be continuous`)
    }
  }

  return a
}

/* ─────────────────────────── run ─────────────────────────── */

console.log('PAPER PLANET · audio verification\n')

if (!fs.existsSync(MANIFEST)) {
  console.log('  FAIL  manifest missing — run tools/gen-sfx.mjs')
  process.exit(1)
}
const src = fs.readFileSync(MANIFEST, 'utf8')
const sfx = parseSection(src, 'SFX')
const textures = parseSection(src, 'TEXTURES')
const ambience = parseSection(src, 'AMBIENCE')

if (!sfx || !textures || !ambience) {
  console.log('  FAIL  manifest is not parseable')
  process.exit(1)
}

/* 1. every frozen-contract cue is covered */
console.log(`─ contract coverage`)
for (const cue of CONTRACT_CUES) {
  const list = sfx.get(cue)
  if (!list || !list.length) fail(cue, 'no asset in the manifest')
}
for (const key of sfx.keys()) {
  if (!CONTRACT_CUES.includes(key)) fail(key, 'manifest cue is not in contracts.SfxCue')
}
for (const id of AMBIENCE_IDS) {
  if (!ambience.get(id)?.length) fail(`amb.${id}`, 'no bed in the manifest')
}
for (const id of TEXTURE_IDS) {
  if (!textures.get(id)?.length) fail(id, 'no texture in the manifest')
}
console.log(`  ${CONTRACT_CUES.length}/28 SfxCue · ${ambience.size}/5 AmbienceId · ${textures.size}/4 textures`)

/* 2. round-robin depth on the high-frequency cues */
console.log(`\n─ round-robin depth`)
const HOT = ['crease.soft', 'crease.crisp', 'ui.tap', 'sheet.slide']
for (const cue of HOT) {
  const n = sfx.get(cue)?.length ?? 0
  if (n < 2) fail(cue, `only ${n} variant — repetition will be audible`)
  else console.log(`  ok    ${cue.padEnd(26)} ${n} variants`)
}

/* 3. decode and inspect every file */
console.log(`\n─ per-file inspection`)
console.log(`  ${'asset'.padEnd(26)} ${'dur'.padStart(6)} ${'peak'.padStart(6)} ${'rms'.padStart(6)} ${'cen'.padStart(6)} ${'flat'.padStart(5)}  bands      envelope`)

let totalBytes = 0
let count = 0
const groups = [
  ['oneshot', sfx],
  ['texture', textures],
  ['ambience', ambience],
]
for (const [kind, map] of groups) {
  for (const [key, list] of map) {
    for (const entry of list) {
      const label = path.basename(entry.file, '.mp3')
      const a = await checkEntry(label, entry, kind)
      totalBytes += entry.bytes
      count++
      if (a) {
        console.log(
          `  ${label.padEnd(26)}` +
          ` ${a.duration.toFixed(2).padStart(6)}` +
          ` ${a.peakDb.toFixed(1).padStart(6)}` +
          ` ${a.activeRmsDb.toFixed(1).padStart(6)}` +
          ` ${Math.round(a.centroid).toString().padStart(6)}` +
          ` ${a.flatness.toFixed(3).padStart(5)}` +
          `  ${bandArt(a.bands)}  ${envelopeArt(a.env, 34)}`,
        )
      }
      void key
    }
  }
}

/* 4. nothing shipped that nothing references */
console.log(`\n─ orphans & budget`)
if (fs.existsSync(AUDIO_DIR)) {
  for (const f of fs.readdirSync(AUDIO_DIR)) {
    const abs = path.resolve(AUDIO_DIR, f)
    if (!seen.has(abs)) warn(f, 'shipped but not referenced by the manifest')
  }
}
const onDisk = fs.existsSync(AUDIO_DIR)
  ? fs.readdirSync(AUDIO_DIR).reduce((s, f) => s + fs.statSync(path.join(AUDIO_DIR, f)).size, 0)
  : 0
console.log(`  ${count} files · ${(totalBytes / 1024 / 1024).toFixed(2)} MB referenced · ${(onDisk / 1024 / 1024).toFixed(2)} MB on disk`)
if (onDisk > BUDGET_BYTES) fail('budget', `${(onDisk / 1024 / 1024).toFixed(2)} MB exceeds the 8 MB budget`)
else console.log(`  ok    budget                     ${(onDisk / 1024 / 1024).toFixed(2)} / 8.00 MB (${((onDisk / BUDGET_BYTES) * 100).toFixed(0)}%)`)

/* 5. summary */
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${count} files checked, ${failures} failure(s), ${warnings} warning(s)`)
process.exit(failures === 0 ? 0 : 1)
