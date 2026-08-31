// PAPER PLANET — render the real audio graph offline and measure it.
//
// The one-shots and the beds are files, so `tools/measure-assets.mjs` can read
// them straight off disk. The friction voice and the music are *synthesised* —
// there is no file to measure, only code — so this drives the actual modules
// out of the dev server through Chromium's OfflineAudioContext and reads the
// result. Everything is rendered into the same graph at the same bus gains, so
// every number below is directly comparable and includes every panning and
// upmix subtlety the real thing has.
//
//   node .mix-render.mjs [--old]     --old models the pre-pass mix

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const OLD = process.argv.includes('--old')
const METER = readFileSync('/home/user/PAPER-PLANET/tools/loudness.mjs', 'utf8')
  .replace(/^export /gm, '')

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error('  [page]', m.text()) })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
// A classic <script>, not addInitScript: the init world does not share its
// lexical top level with evaluate().
await page.addScriptTag({ content: METER })

const out = await page.evaluate(async (old) => {
  const mix = await import('/src/audio/mix.ts')
  const manifest = await import('/src/audio/manifest.ts')
  const granular = await import('/src/audio/granular.ts')
  const music = await import('/src/audio/music.ts')

  const SR = 48000
  const db = (g) => (g <= 1e-9 ? -Infinity : 20 * Math.log10(g))

  /* The mix as it is, or as it was before this pass. */
  const M = old
    ? {
        vol: { master: 0.9, sfx: 1, ambience: 0.3, music: 0.28 },
        bus: (b, v) => Math.max(0, Math.min(1, v)) * ({ ambience: 0.42, music: 0.6 }[b] ?? 1),
        file: () => 1,
        texture: (id) => Math.pow(10, (-22 - manifest.TEXTURES[id].rmsDb) / 20) * 0.5,
        friction: (n, p) => ({
          ...granular.frictionParams(n, p),
          gain: (0.12 + 0.88 * Math.min(1, n)) * (0.55 + 0.45 * p),
        }),
        musicTrim: 1,
        duck: { ambience: 0.42, music: 0.18 },
        limiter: { thresholdDb: -8, kneeDb: 8, ratio: 10, attack: 0.004, release: 0.22 },
      }
    : {
        vol: { master: 0.9, sfx: 1, ambience: 0.5, music: 0.5 },
        bus: (b, v) => mix.busGain(b, v),
        file: (f) => mix.fileGain(f),
        texture: (id) => mix.TEXTURE_GAIN[id],
        friction: (n, p) => granular.frictionParams(n, p),
        musicTrim: mix.MUSIC_TRIM,
        duck: {
          ambience: Math.pow(10, mix.FOCUS_DUCK_DB.ambience / 20),
          music: Math.pow(10, mix.FOCUS_DUCK_DB.music / 20),
        },
        limiter: mix.LIMITER,
      }

  /* ── decode everything we need once, in a scratch context ── */
  const scratch = new OfflineAudioContext(1, 1, SR)
  const buffers = {}
  const need = [
    ...Object.values(manifest.TEXTURES).map((t) => t.file),
    manifest.SFX['crease.crisp'][0].file,
    manifest.SFX['crease.soft'][0].file,
    manifest.AMBIENCE.meadow.file,
  ]
  for (const f of need) {
    const bytes = await (await fetch(f)).arrayBuffer()
    buffers[f] = await scratch.decodeAudioData(bytes)
  }

  /* ── channel-summed BS.1770 on a rendered stereo buffer ── */
  function measure(buf) {
    const chans = []
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c))
    // BS.1770 sums the per-channel mean squares with G=1.0 for L and R.
    const zs = chans.map((c) => blockPowers(c, buf.sampleRate))
    const n = Math.min(...zs.map((z) => z.length))
    const sum = new Float64Array(n)
    for (const z of zs) for (let i = 0; i < n; i++) sum[i] += z[i]
    const l = (z) => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity)
    const keepA = Array.from(sum).filter((v) => l(v) > -70)
    let li = -Infinity
    if (keepA.length) {
      const meanA = keepA.reduce((a, b) => a + b, 0) / keepA.length
      const rel = l(meanA) - 10
      const use = keepA.filter((v) => l(v) > rel)
      const arr = use.length ? use : keepA
      li = l(arr.reduce((a, b) => a + b, 0) / arr.length)
    }
    let peak = 0
    for (const c of chans) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a }
    // loudest 100 ms, channel-summed
    const zs100 = chans.map((c) => blockPowers(c, buf.sampleRate, 0.1, 0.0125))
    const n100 = Math.min(...zs100.map((z) => z.length))
    let m100 = 0
    for (let i = 0; i < n100; i++) {
      let s = 0
      for (const z of zs100) s += z[i]
      if (s > m100) m100 = s
    }
    return { li, l100: l(m100), peakDb: db(peak) }
  }

  /* ── the master chain, shared by every render ── */
  function chain(ctx, { limit = true } = {}) {
    const master = ctx.createGain()
    master.gain.value = M.bus('master', M.vol.master)
    if (limit) {
      const lim = ctx.createDynamicsCompressor()
      lim.threshold.value = M.limiter.thresholdDb
      lim.knee.value = M.limiter.kneeDb
      lim.ratio.value = M.limiter.ratio
      lim.attack.value = M.limiter.attack
      lim.release.value = M.limiter.release
      master.connect(lim).connect(ctx.destination)
    } else {
      master.connect(ctx.destination)
    }
    const busOf = (name) => {
      const g = ctx.createGain()
      g.gain.value = M.bus(name, M.vol[name])
      g.connect(master)
      return g
    }
    return { master, busOf }
  }

  /* ══════════ the friction voice, exactly as granular.ts builds it ══════════ */
  const SOURCES = ['texture.rub.slow', 'texture.rub.fast', 'texture.burnish']
  const ENV = {}
  for (const id of Object.keys(manifest.TEXTURES)) {
    const t = M.texture(id)
    const e = new Float32Array(granular.HANN.length)
    for (let i = 0; i < e.length; i++) e[i] = granular.HANN[i] * t
    ENV[id] = e
  }

  async function renderFriction(n, p, seconds, { limit = false, keep = false } = {}) {
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR)
    const { busOf } = chain(ctx, { limit })
    const sfx = busOf('sfx')
    const m = M.friction(n, p)

    const level = ctx.createGain()
    level.gain.value = m.gain
    level.connect(sfx)

    const tone = ctx.createBiquadFilter()
    tone.type = 'bandpass'
    tone.frequency.value = m.toneHz
    tone.Q.value = 0.75
    tone.connect(level)

    const grainSum = ctx.createGain()
    grainSum.connect(tone)

    const pans = [-0.42, 0, 0.42].map((v) => {
      const node = ctx.createStereoPanner()
      node.pan.value = v
      node.connect(grainSum)
      return node
    })

    // the fine-fibre layer
    const nb = ctx.createBuffer(1, SR * 2, SR)
    const nd = nb.getChannelData(0)
    let last = 0
    for (let i = 0; i < nd.length; i++) {
      last = 0.86 * last + 0.14 * (Math.random() * 2 - 1)
      nd[i] = last * 1.6
    }
    const nsrc = ctx.createBufferSource()
    nsrc.buffer = nb
    nsrc.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = m.noiseHz
    nf.Q.value = 0.6
    const ng = ctx.createGain()
    ng.gain.value = m.noiseAmt
    nsrc.connect(nf).connect(ng).connect(level)
    nsrc.start()

    let t = 0.02
    while (t < seconds - m.grainDur) {
      const r = Math.random()
      const id = r < m.burnishProb
        ? 'texture.burnish'
        : r < m.burnishProb + (1 - m.burnishProb) * m.fastProb
          ? 'texture.rub.fast'
          : 'texture.rub.slow'
      const buf = buffers[manifest.TEXTURES[id].file]
      const rate = m.grainSpeed * (1 + (Math.random() * 2 - 1) * 0.04)
      const span = Math.max(0.05, manifest.TEXTURES[id].loopEnd - m.grainDur * rate - 0.02)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = rate
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(g).connect(pans[(Math.random() * 3) | 0])
      g.gain.setValueCurveAtTime(ENV[id], t, m.grainDur)
      src.start(t, Math.random() * span)
      src.stop(t + m.grainDur + 0.02)
      t += (1 / m.grainRate) * (0.78 + Math.random() * 0.44)
    }
    const rendered = await ctx.startRendering()
    return keep ? { ...measure(rendered), buf: rendered } : measure(rendered)
  }

  /* ══════════ a one-shot down the real sampler path ══════════ */
  async function renderCue(cue, { limit = false } = {}) {
    const file = manifest.SFX[cue][0].file
    const buf = buffers[file]
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * (buf.duration + 0.2)), SR)
    const { busOf } = chain(ctx, { limit })
    const g = ctx.createGain()
    g.gain.value = M.file(file)
    g.connect(busOf('sfx'))
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(g)
    src.start(0.05)
    return measure(await ctx.startRendering())
  }

  /* ══════════ a bed down the real ambience path ══════════ */
  async function renderBed(seconds, { ducked = false, limit = false, withCrease = false } = {}) {
    const file = manifest.AMBIENCE.meadow.file
    const buf = buffers[file]
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR)
    const { master, busOf } = chain(ctx, { limit })

    const duck = ctx.createGain()
    duck.gain.value = ducked ? M.duck.ambience : 1
    duck.connect(master)
    const bus = ctx.createGain()
    bus.gain.value = M.bus('ambience', M.vol.ambience)
    bus.connect(duck)

    const gain = ctx.createGain()
    gain.gain.value = M.file(file)
    gain.connect(bus)
    for (const pan of [-0.72, 0.72]) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const pn = ctx.createStereoPanner()
      pn.pan.value = pan
      src.connect(pn).connect(gain)
      src.start(0, pan < 0 ? 0 : 3.7)
    }

    if (withCrease) {
      const cfile = manifest.SFX['crease.crisp'][0].file
      const sfx = busOf('sfx')
      for (const at of [1.0, 1.6, 2.2, 2.8]) {
        const g = ctx.createGain()
        g.gain.value = M.file(cfile)
        g.connect(sfx)
        const s = ctx.createBufferSource()
        s.buffer = buffers[cfile]
        s.connect(g)
        s.start(at)
      }
    }
    const rendered = await ctx.startRendering()
    return { ...measure(rendered), buf: rendered }
  }

  /* ══════════ the music, from music.ts itself ══════════ */
  async function renderMusic(seconds, { notes = true } = {}) {
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR)
    const { busOf } = chain(ctx, { limit: false })
    const out = ctx.createGain()
    out.gain.value = M.musicTrim
    out.connect(busOf('music'))
    music.buildDrone(ctx, out)
    if (notes) {
      // The scheduler's own spacing: 1.5-4.4 s apart, a third of them answered.
      let t = 1.2
      while (t < seconds - 3) {
        const v = 0.5 + Math.random() * 0.5
        music.pluckNote(ctx, out, t, music.noteFreq((Math.random() * 5) | 0, 1 + ((Math.random() * 2) | 0)), v)
        if (Math.random() < 0.32) music.pluckNote(ctx, out, t + 0.25, music.noteFreq((Math.random() * 5) | 0, 2), v * 0.72)
        t += 1.5 + Math.random() * 2.9
      }
    }
    return measure(await ctx.startRendering())
  }

  /* ══════════ what the limiter actually does ══════════
     Render the same material twice, with the limiter and without, and read the
     difference. That is the gain reduction, exactly, including the attack and
     release the maths on paper cannot model — and it is applied to the whole
     master bus, so whatever it takes off the crease it also takes off the bed.
  */
  /**
   * 100 ms RMS, hopping 25 ms. Deliberately long: the two renders are only
   * aligned to within a sample or two after the shift below, and on a 20 ms
   * window a crease onset landing one window early reads as 12 dB of
   * "limiting" that is nothing of the sort. Over 100 ms that error is under a
   * third of a dB, and 100 ms is also the timescale on which a bed audibly
   * ducks — which is the thing being measured.
   */
  function envelope(buf, shift = 0) {
    const c = buf.getChannelData(0)
    const win = Math.round(SR * 0.1)
    const hop = Math.round(SR * 0.025)
    const env = []
    for (let i = 0; i + win + shift < c.length; i += hop) {
      let s = 0
      for (let j = i + shift; j < i + shift + win; j++) s += c[j] * c[j]
      env.push(Math.sqrt(s / win))
    }
    return env
  }

  /**
   * Chrome's DynamicsCompressorNode carries a pre-delay, so the two renders
   * are not sample-aligned and a naive difference reads 14 dB of "limiting"
   * that is really just a shifted transient. Find the shift by correlating the
   * two around the first crease.
   */
  function bestShift(withLim, without) {
    const a = withLim.getChannelData(0)
    const b = without.getChannelData(0)
    const from = Math.round(SR * 0.95)
    const len = Math.round(SR * 0.3)
    let best = 0
    let bestScore = -Infinity
    for (let lag = 0; lag <= Math.round(SR * 0.02); lag += 1) {
      let dot = 0
      for (let i = 0; i < len; i += 4) dot += a[from + i + lag] * b[from + i]
      if (dot > bestScore) { bestScore = dot; best = lag }
    }
    return best
  }
  function reduction(withLim, without) {
    const shift = bestShift(withLim, without)
    const a = envelope(withLim, shift)
    const b = envelope(without)
    const n = Math.min(a.length, b.length)
    const raw = []
    for (let i = 0; i < n; i++) raw.push(b[i] > 1e-6 ? db(b[i]) - db(a[i]) : 0)
    // Chrome's DynamicsCompressorNode carries a 6 ms pre-delay and a fixed
    // makeup gain derived from threshold/knee/ratio, so the raw difference is
    // offset even where the compressor is doing nothing. Calibrate both out on
    // the stretch where only the bed is playing (0.2-0.9 s, before the first
    // crease at 1.0 s) — whatever is left is real gain reduction.
    // The compressor's pre-delay buffer starts full of zeros, so the first
    // ~250 ms of a render is a startup artefact, not limiting. Everything is
    // judged from 0.3 s on, which is still well before the first crease.
    const START = Math.round(0.3 / 0.025)
    const quiet = raw.slice(START, 36).sort((x, y) => x - y)
    const makeup = quiet[quiet.length >> 1]
    const gr = raw.slice(START).map((v) => v - makeup)
    const over = gr.filter((v) => v > 0.5).length
    let arg = 0
    for (let i = 0; i < gr.length; i++) if (gr[i] > gr[arg]) arg = i
    return {
      peak: Math.max(...gr), duty: (100 * over) / gr.length, makeup, shiftMs: (1000 * shift) / SR,
      peakAtSec: (arg + START) * 0.025 + 0.05,
      series: gr.filter((_, i) => i % 4 === 0).map((v) => +v.toFixed(2)),
    }
  }

  const res = {
    crease: await renderCue('crease.crisp'),
    creaseSoft: await renderCue('crease.soft'),
    friction: {},
    bed: (await renderBed(20)).li,
    bedDucked: (await renderBed(20, { ducked: true })).li,
    music: (await renderMusic(40)).li,
    droneOnly: (await renderMusic(20, { notes: false })).li,
    musicNote: (await renderMusic(6, { notes: true })).l100,
  }
  for (const [label, n, p] of [['barely', 0.13, 0.5], ['slow', 0.30, 0.5], ['steady', 0.55, 0.5], ['brisk', 0.85, 0.5], ['fast', 1.0, 0.5], ['pressed', 0.55, 1.0]]) {
    res.friction[label] = await renderFriction(n, p, 4)
  }

  /** Push an already-rendered buffer through the limiter alone. */
  async function relimit(buf) {
    const ctx = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate)
    const lim = ctx.createDynamicsCompressor()
    lim.threshold.value = M.limiter.thresholdDb
    lim.knee.value = M.limiter.kneeDb
    lim.ratio.value = M.limiter.ratio
    lim.attack.value = M.limiter.attack
    lim.release.value = M.limiter.release
    lim.connect(ctx.destination)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(lim)
    src.start()
    return await ctx.startRendering()
  }

  // The densest thing the friction voice can produce: a hard, steady rub. Every
  // grain source is in play and they overlap five deep. If the limiter touches
  // this, the bed pumps under the player's own finger.
  {
    const dry = await renderFriction(0.55, 1.0, 4, { limit: false, keep: true })
    res.pressedLimiter = reduction(await relimit(dry.buf), dry.buf)
  }

  // limiter behaviour under real material: bed + four creases
  const limited = await renderBed(4, { limit: true, withCrease: true })
  const clean = await renderBed(4, { limit: false, withCrease: true })
  res.limiter = reduction(limited.buf, clean.buf)
  res.mixPeakDb = limited.peakDb
  res.mixPeakUnlimitedDb = clean.peakDb

  delete limited.buf
  delete clean.buf
  return res
}, OLD)

const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '  -')
const pad = (s, n) => String(s).padEnd(n)
const pd = (s, n) => String(s).padStart(n)

console.log(`\n${OLD ? 'BEFORE' : 'AFTER'} — rendered through the real graph (LUFS, channel-summed)\n`)
console.log(pad('SOURCE', 26), pd('LUFS-I', 9), pd('L100', 9), pd('PEAK', 9), pd('vs CREASE', 10))
console.log('-'.repeat(68))
const ref = out.crease.l100
const row = (name, m, useI) => console.log(
  pad(name, 26), pd(f1(m.li), 9), pd(f1(m.l100), 9), pd(f1(m.peakDb), 9),
  pd(f1((useI ? m.li : m.l100) - ref), 10),
)
row('crease.crisp (one-shot)', out.crease, false)
row('crease.soft  (one-shot)', out.creaseSoft, false)
for (const [k, v] of Object.entries(out.friction)) row(`friction — ${k}`, v, true)
console.log('-'.repeat(68))
console.log(pad('ambience bed (meadow)', 26), pd(f1(out.bed), 9), pd('', 9), pd('', 9), pd(f1(out.bed - ref), 10))
console.log(pad('  …ducked, in the Studio', 26), pd(f1(out.bedDucked), 9), pd('', 9), pd('', 9), pd(f1(out.bedDucked - ref), 10))
console.log(pad('music (drone + notes)', 26), pd(f1(out.music), 9), pd(f1(out.musicNote), 9), pd('', 9), pd(f1(out.music - ref), 10))
console.log(pad('  …drone alone', 26), pd(f1(out.droneOnly), 9), pd('', 9), pd('', 9), pd(f1(out.droneOnly - ref), 10))

console.log(`\n${OLD ? 'BEFORE' : 'AFTER'} — the safety limiter, on a bed plus four creases\n`)
console.log(`  peak gain reduction        ${f1(out.limiter.peak)} dB   ` +
  `(compressor pre-delay ${f1(out.limiter.shiftMs)} ms and ${f1(out.limiter.makeup)} dB of Chrome's own makeup calibrated out)`)
console.log(`  time spent over 0.5 dB GR  ${f1(out.limiter.duty)} %  (this is the room ducking under your own folding)`)
console.log(`  peak out of the chain      ${f1(out.mixPeakDb)} dBFS   (unlimited: ${f1(out.mixPeakUnlimitedDb)})`)
console.log(`  a hard steady rub, alone:  ${f1(out.pressedLimiter.peak)} dB peak GR, ` +
  `over 0.5 dB for ${f1(out.pressedLimiter.duty)} % of it`)
if (process.argv.includes('--gr')) console.log('  GR at 100ms steps:', out.limiter.series.join(' '), '| peak at', f1(out.limiter.peakAtSec), 's')
console.log()

await browser.close()
