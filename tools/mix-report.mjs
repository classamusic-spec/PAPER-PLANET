// PAPER PLANET — the mix, proved.
//
// Loads the real manifest and the real mix table out of app/src/audio, applies
// the trims the app will apply, and prints where every family actually lands.
// Node only, never shipped.
//
//   node tools/mix-report.mjs            after (the mix as it stands)
//   node tools/mix-report.mjs --before   before (no trims, the old buses)

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(HERE, '..', 'app', 'src', 'audio')
const LEVELS_JSON = path.join(HERE, '.cache', 'levels.json')

const mix = await import(pathToFileURL(path.join(SRC, 'mix.ts')).href)
const manifest = await import(pathToFileURL(path.join(SRC, 'manifest.ts')).href)
const raw = JSON.parse(readFileSync(LEVELS_JSON, 'utf8'))

const BEFORE = process.argv.includes('--before')

/* ── the state of the world before this pass, for the comparison ───────── */
const OLD = {
  volumes: { master: 0.9, sfx: 1, ambience: 0.3, music: 0.28 },
  busTrim: { ambience: 0.42, music: 0.6 },
  duck: { ambience: 0.42, music: 0.18 },
  limiter: { thresholdDb: -8, kneeDb: 8, ratio: 10 },
  busGain(bus, v) { return Math.max(0, Math.min(1, v)) * (this.busTrim[bus] ?? 1) },
  fileGain() { return 1 },
}
const NEW = {
  volumes: { master: 0.9, sfx: 1, ambience: 0.5, music: 0.5 },
  duck: {
    ambience: Math.pow(10, mix.FOCUS_DUCK_DB.ambience / 20),
    music: Math.pow(10, mix.FOCUS_DUCK_DB.music / 20),
  },
  limiter: mix.LIMITER,
  busGain: (bus, v) => mix.busGain(bus, v),
  fileGain: (f) => mix.fileGain(f),
}
const M = BEFORE ? OLD : NEW

const db = (g) => (g <= 1e-9 ? -Infinity : 20 * Math.log10(g))
const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '  -')
const pad = (s, n) => String(s).padEnd(n)
const pd = (s, n) => String(s).padStart(n)
const level = (f) => raw[f.replace('/audio/', '')]

/* ═══════════════════ 1. one-shots, per family ═══════════════════ */

const FAMILIES = ['crease', 'fold', 'sheet', 'press', 'ui', 'alive', 'reward']
const cueFamily = (cue) => cue.slice(0, cue.indexOf('.'))

const rows = []
for (const family of FAMILIES) {
  const cues = Object.keys(manifest.SFX).filter((c) => cueFamily(c) === family)
  const files = []
  for (const cue of cues) {
    for (const a of manifest.SFX[cue]) {
      const m = level(a.file)
      const g = db(M.fileGain(a.file))
      files.push({ cue, file: a.file, l100: m.lufs100 + g, tp: m.truePeakDb + g, g })
    }
  }
  // spread *within a cue* is the audible defect: the same gesture, two loudnesses
  let worstCue = null
  for (const cue of cues) {
    const v = files.filter((f) => f.cue === cue).map((f) => f.l100)
    if (v.length < 2) continue
    const s = Math.max(...v) - Math.min(...v)
    if (!worstCue || s > worstCue.spread) worstCue = { cue, spread: s }
  }
  const l = files.map((f) => f.l100)
  rows.push({
    family,
    n: files.length,
    mean: l.reduce((a, b) => a + b, 0) / l.length,
    min: Math.min(...l),
    max: Math.max(...l),
    spread: Math.max(...l) - Math.min(...l),
    variantSpread: worstCue ? worstCue.spread : 0,
    worstCue: worstCue ? worstCue.cue : '-',
    maxTp: Math.max(...files.map((f) => f.tp)),
  })
}

const paper = rows.find((r) => r.family === 'crease').mean

console.log(`\n${BEFORE ? 'BEFORE' : 'AFTER'} — one-shots, at the bus (LUFS over the loudest 100 ms)\n`)
console.log(pad('FAMILY', 9), pd('N', 3), pd('MEAN', 7), pd('MIN', 7), pd('MAX', 7),
  pd('SPREAD', 7), pd('WORST-VARIANT-SPREAD', 22), pd('MAXTP', 7), pd('vs PAPER', 9))
console.log('-'.repeat(97))
for (const r of rows) {
  console.log(
    pad(r.family, 9), pd(r.n, 3), pd(f1(r.mean), 7), pd(f1(r.min), 7), pd(f1(r.max), 7),
    pd(f1(r.spread), 7), pd(`${f1(r.variantSpread)}  ${r.worstCue}`, 22),
    pd(f1(r.maxTp), 7), pd(f1(r.mean - paper), 9),
  )
}

/* ═══════════════════ 2. beds ═══════════════════ */

const ambBusDb = db(M.busGain('ambience', M.volumes.ambience))
const musBusDb = db(M.busGain('music', M.volumes.music))
const sfxBusDb = db(M.busGain('sfx', M.volumes.sfx))
const masterDb = db(M.busGain('master', M.volumes.master))

console.log(`\n${BEFORE ? 'BEFORE' : 'AFTER'} — ambience beds, at the bus (LUFS)\n`)
console.log(pad('BED', 10), pd('TRIM', 7), pd('LUFS-I', 8), pd('LUFS-S', 8), pd('AT BUS', 8), pd('vs PAPER', 9))
console.log('-'.repeat(56))
const bedI = []
const bedS = []
for (const id of Object.keys(manifest.AMBIENCE)) {
  const a = manifest.AMBIENCE[id]
  const m = level(a.file)
  const g = db(M.fileGain(a.file))
  const li = m.lufsI + g
  const ls = m.lufsSmax + g
  bedI.push(li); bedS.push(ls)
  console.log(pad(id, 10), pd(f1(g), 7), pd(f1(li), 8), pd(f1(ls), 8),
    pd(f1(li + ambBusDb), 8), pd(f1(li + ambBusDb - (paper + sfxBusDb)), 9))
}
const bedMeanI = bedI.reduce((a, b) => a + b, 0) / bedI.length
console.log('-'.repeat(56))
console.log(`bed-to-bed spread: ${f1(Math.max(...bedI) - Math.min(...bedI))} LU integrated, ` +
  `${f1(Math.max(...bedS) - Math.min(...bedS))} LU on the loudest 3 s`)

/* ═══════════════════ 3. the gain structure ═══════════════════ */

const paperOut = paper + sfxBusDb
const bedOut = bedMeanI + ambBusDb
const bedDucked = bedOut + db(M.duck.ambience)

console.log(`\n${BEFORE ? 'BEFORE' : 'AFTER'} — gain structure at the default faders\n`)
const line = (k, v) => console.log(pad(k, 34), pd(v, 12))
line('master fader → gain', `${M.volumes.master} → ${f1(masterDb)} dB`)
line('paper fader → gain', `${M.volumes.sfx} → ${f1(sfxBusDb)} dB`)
line('room fader → gain', `${M.volumes.ambience} → ${f1(ambBusDb)} dB`)
line('music fader → gain', `${M.volumes.music} → ${f1(musBusDb)} dB`)
console.log()
line('paper (crease) at master in', `${f1(paperOut)} LUFS`)
line('room at master in', `${f1(bedOut)} LUFS`)
line('room, ducked (Studio)', `${f1(bedDucked)} LUFS`)
console.log()
line('▶ PAPER − ROOM', `${f1(paperOut - bedOut)} LU`)
line('▶ PAPER − ROOM (ducked)', `${f1(paperOut - bedDucked)} LU`)

/* room at the fader extremes — is the slider worth having? */
if (!BEFORE) {
  console.log('\nRoom fader travel (LU under the paper)\n')
  console.log(pad('POSITION', 10), pd('BUS dB', 9), pd('vs PAPER', 9))
  for (const v of [1, 0.75, 0.5, 0.25, 0.1, 0]) {
    const g = db(M.busGain('ambience', v))
    console.log(pad(v.toFixed(2), 10), pd(f1(g), 9), pd(Number.isFinite(g) ? f1(paperOut - (bedMeanI + g)) : 'silent', 9))
  }
}

/* ═══════════════════ 4. limiter sanity ═══════════════════ */

/** WebAudio's DynamicsCompressor curve: soft knee, then the ratio. */
function gainReductionDb(inputDb, { thresholdDb: t, kneeDb: k, ratio }) {
  const over = inputDb - t
  if (over <= -k / 2) return 0
  if (over >= k / 2) return (over - over / ratio)
  const x = over + k / 2
  return (1 - 1 / ratio) * (x * x) / (2 * k)
}

console.log(`\n${BEFORE ? 'BEFORE' : 'AFTER'} — safety limiter (threshold ${M.limiter.thresholdDb}, ` +
  `knee ${M.limiter.kneeDb}, ratio ${M.limiter.ratio})\n`)
console.log(pad('WHAT LANDS ON IT', 34), pd('dBTP IN', 9), pd('GAIN RED.', 10))
console.log('-'.repeat(55))
const gj = 20 * Math.log10(1.08) // the sampler's +8% gain jitter, worst case
const cases = []
for (const r of rows) cases.push([`loudest ${r.family} cue`, r.maxTp + sfxBusDb + gj + masterDb])
const loudestOne = Math.max(...rows.map((r) => r.maxTp)) + sfxBusDb + gj + masterDb
cases.push(['two of them at once', loudestOne + 6.02])
for (const [what, dbtp] of cases) {
  const gr = gainReductionDb(dbtp, M.limiter)
  console.log(pad(what, 34), pd(f1(dbtp), 9), pd(gr > 0.05 ? `${f1(gr)} dB` : 'none', 10))
}
console.log()
