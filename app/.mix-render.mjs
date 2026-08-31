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
await page.addInitScript({ content: METER })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })

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

  async function renderFriction(n, p, seconds, { limit = false } = {}) {
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
    return measure(await ctx.startRendering())
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

  /* ══════════ how much the limiter moves the bed under a crease ══════════ */
  function bedDipDb(rendered) {
    const c = rendered.getChannelData(0)
    const win = Math.round(SR * 0.05)
    const env = []
    for (let i = 0; i + win < c.length; i += win) {
      let s = 0
      for (let j = i; j < i + win; j++) s += c[j] * c[j]
      env.push(Math.sqrt(s / win))
    }
    // The bed alone runs 0..0.9 s; the creases land from 1.0 s.
    const quiet = env.slice(4, 17).sort((a, b) => a - b)
    const ref = quiet[quiet.length >> 1]
    // Look at the bed 150-450 ms after each crease, where the cue itself is
    // over but the limiter's 220 ms release still has the master pinned down.
    let worst = 0
    for (const at of [1.0, 1.6, 2.2, 2.8]) {
      const a = Math.round((at + 0.15) / 0.05)
      const b = Math.round((at + 0.45) / 0.05)
      const seg = env.slice(a, b).sort((x, y) => x - y)
      const mid = seg[seg.length >> 1]
      const dip = db(ref) - db(mid)
      if (dip > worst) worst = dip
    }
    return worst
  }

  const res = {
    crease: await renderCue('crease.crisp'),
    creaseSoft: await renderCue('crease.soft'),
    friction: {},
    bed: (await renderBed(6)).li,
    bedDucked: (await renderBed(6, { ducked: true })).li,
    music: (await renderMusic(40)).li,
    droneOnly: (await renderMusic(20, { notes: false })).li,
    musicNote: (await renderMusic(6, { notes: true })).l100,
  }
  for (const [label, n, p] of [['barely', 0.13, 0.5], ['slow', 0.30, 0.5], ['steady', 0.55, 0.5], ['brisk', 0.85, 0.5], ['fast', 1.0, 0.5], ['pressed', 0.55, 1.0]]) {
    res.friction[label] = await renderFriction(n, p, 4)
  }

  // limiter behaviour under real material
  const pumped = await renderBed(4, { limit: true, withCrease: true })
  res.bedDip = bedDipDb(pumped.buf)
  res.mixPeakDb = pumped.peakDb

  delete pumped.buf
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

console.log(`\n${OLD ? 'BEFORE' : 'AFTER'} — what the limiter does to the room when you crease\n`)
console.log(`  bed level dropped by ${f1(out.bedDip)} dB after a crease (pumping)`)
console.log(`  peak out of the whole chain: ${f1(out.mixPeakDb)} dBFS`)
console.log()

await browser.close()
