// PAPER PLANET — ITU-R BS.1770-4 loudness + true-peak, for the mix pass.
// Node only, never shipped. Sits on top of audio-lib.mjs.

/* ───────────────────────── K-weighting ─────────────────────────
   Two biquads, derived analytically so they are correct at any sample rate
   rather than only at the 48k the spec tabulates.
     stage 1 — the "head" high shelf, +4 dB above ~1.7 kHz
     stage 2 — RLB high-pass at ~38 Hz
   Sanity-checked against the spec's 48 kHz coefficients (see selfTest below).
─────────────────────────────────────────────────────────────────── */

function biquadRun(x, b0, b1, b2, a1, a2) {
  const out = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    out[i] = y0
    x2 = x1; x1 = x0; y2 = y1; y1 = y0
  }
  return out
}

export function shelfCoeffs(fs) {
  const f0 = 1681.974450955533
  const G = 3.999843853973347
  const Q = 0.7071752369554196
  const K = Math.tan((Math.PI * f0) / fs)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  const a0 = 1 + K / Q + K * K
  return {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  }
}

export function rlbCoeffs(fs) {
  const f0 = 38.13547087602444
  const Q = 0.5003270373238773
  const K = Math.tan((Math.PI * f0) / fs)
  const d = 1 + K / Q + K * K
  return { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / d, a2: (1 - K / Q + K * K) / d }
}

/** Apply both K-weighting stages. Returns Float64Array. */
export function kWeight(pcm, fs) {
  const s = shelfCoeffs(fs)
  const r = rlbCoeffs(fs)
  return biquadRun(biquadRun(pcm, s.b0, s.b1, s.b2, s.a1, s.a2), r.b0, r.b1, r.b2, r.a1, r.a2)
}

/* ───────────────────────── block loudness ───────────────────────── */

const OFFSET = -0.691

/**
 * Mean square per 400 ms block, hopping 100 ms (75% overlap) — the raw `z`
 * values everything else in BS.1770 is built from.
 *
 * Clips shorter than one block are zero-padded to exactly one block: a 130 ms
 * tick really does read quieter than a 400 ms one at the same peak, and that
 * is the perceptual answer we want, not an artefact to paper over.
 */
export function blockPowers(pcm, fs, blockSec = 0.4, hopSec = 0.1) {
  const y = kWeight(pcm, fs)
  const n = Math.max(1, Math.round(fs * blockSec))
  const hop = Math.max(1, Math.round(fs * hopSec))
  const z = []
  if (y.length <= n) {
    let s = 0
    for (let i = 0; i < y.length; i++) s += y[i] * y[i]
    z.push(s / n)
    return z
  }
  for (let start = 0; start + n <= y.length; start += hop) {
    let s = 0
    for (let i = start; i < start + n; i++) s += y[i] * y[i]
    z.push(s / n)
  }
  return z
}

const lFromZ = (z) => (z > 0 ? OFFSET + 10 * Math.log10(z) : -Infinity)

/**
 * Gated integrated loudness (LUFS). Mono in, so the channel weight is 1.0 —
 * every family is measured the same way, and the +3 LU the graph's mono→stereo
 * upmix adds is common to all of them and cancels in every comparison here.
 */
export function integratedLufs(pcm, fs) {
  const z = blockPowers(pcm, fs)
  const keepA = z.filter((v) => lFromZ(v) > -70)
  if (!keepA.length) return -Infinity
  const meanA = keepA.reduce((a, b) => a + b, 0) / keepA.length
  const rel = lFromZ(meanA) - 10
  const keepR = keepA.filter((v) => lFromZ(v) > rel)
  const use = keepR.length ? keepR : keepA
  const mean = use.reduce((a, b) => a + b, 0) / use.length
  return lFromZ(mean)
}

/** Loudest 400 ms window (LUFS-M max) — how loud a one-shot *event* feels. */
export function momentaryMaxLufs(pcm, fs) {
  const z = blockPowers(pcm, fs, 0.4, 0.025)
  let m = 0
  for (const v of z) if (v > m) m = v
  return lFromZ(m)
}

/**
 * Loudest 100 ms window, K-weighted, on the LUFS scale.
 *
 * A crease snap is 40 ms of event inside a one-second file. Measured in the
 * standard 400 ms window it reads 5–8 LU quieter than it sounds, purely
 * because the window is mostly silence — which would make a loudness-matched
 * mix turn every sharp cue *up* until it stabbed. This is the statistic to
 * normalise one-shots by; LUFS-I and LUFS-M stay for the continuous sources.
 */
export function shortWindowLufs(pcm, fs, windowSec = 0.1) {
  const z = blockPowers(pcm, fs, windowSec, windowSec / 8)
  let m = 0
  for (const v of z) if (v > m) m = v
  return lFromZ(m)
}

/**
 * Ungated K-weighted level of the whole file — the right statistic for a
 * granular source, where a grain is equally likely to land anywhere in it and
 * gating out the quiet parts would describe a signal nobody hears.
 */
export function ungatedLufs(pcm, fs) {
  const y = kWeight(pcm, fs)
  let s = 0
  for (let i = 0; i < y.length; i++) s += y[i] * y[i]
  return lFromZ(s / Math.max(1, y.length))
}

/** Loudest 3 s window (LUFS-S max) — the peak of a bed's slow swell. */
export function shortTermMaxLufs(pcm, fs) {
  const z = blockPowers(pcm, fs, 3.0, 0.5)
  let m = 0
  for (const v of z) if (v > m) m = v
  return lFromZ(m)
}

/** Loudness range proxy: spread between the 10th and 95th percentile block. */
export function loudnessRange(pcm, fs) {
  const l = blockPowers(pcm, fs).map(lFromZ).filter((v) => v > -70).sort((a, b) => a - b)
  if (l.length < 4) return 0
  const at = (p) => l[Math.min(l.length - 1, Math.floor(p * (l.length - 1)))]
  return at(0.95) - at(0.1)
}

/* ───────────────────────── true peak ───────────────────────── */

const SINC_TAPS = 32
const PHASES = 4

/** Windowed-sinc polyphase kernels for 4x upsampling. */
const KERNELS = (() => {
  const ks = []
  for (let p = 0; p < PHASES; p++) {
    const k = new Float64Array(SINC_TAPS)
    const frac = p / PHASES
    for (let i = 0; i < SINC_TAPS; i++) {
      const t = i - SINC_TAPS / 2 + 1 - frac
      const s = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)
      // Blackman window over the tap span
      const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (SINC_TAPS - 1)) +
        0.08 * Math.cos((4 * Math.PI * i) / (SINC_TAPS - 1))
      k[i] = s * w
    }
    ks.push(k)
  }
  return ks
})()

/**
 * 4x-oversampled true peak, in dBTP.
 *
 * Only the neighbourhood of samples already within 4 dB of the sample peak is
 * reconstructed — an inter-sample peak cannot hide anywhere else, and it turns
 * a 20-second bed from a minute of work into milliseconds.
 */
export function truePeakDb(pcm) {
  let peak = 0
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a }
  if (peak <= 1e-9) return -Infinity
  const gate = peak * 0.63 // −4 dB
  let tp = peak
  const half = SINC_TAPS / 2
  for (let i = 0; i < pcm.length; i++) {
    if (Math.abs(pcm[i]) < gate) continue
    for (let p = 1; p < PHASES; p++) {
      const k = KERNELS[p]
      let acc = 0
      for (let j = 0; j < SINC_TAPS; j++) {
        const idx = i - half + 1 + j
        if (idx >= 0 && idx < pcm.length) acc += pcm[idx] * k[j]
      }
      const a = Math.abs(acc)
      if (a > tp) tp = a
    }
  }
  return 20 * Math.log10(tp)
}

/* ───────────────────────── self test ───────────────────────── */

/**
 * The spec tabulates both filters at 48 kHz. If the analytic derivation above
 * reproduces those numbers, it is right at 44.1 kHz too.
 */
export function selfTest() {
  const s = shelfCoeffs(48000)
  const r = rlbCoeffs(48000)
  const want = {
    b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285,
    a1: -1.69065929318241, a2: 0.73248077421585,
    ra1: -1.99004745483398, ra2: 0.99007225036621,
  }
  const err = Math.max(
    Math.abs(s.b0 - want.b0), Math.abs(s.b1 - want.b1), Math.abs(s.b2 - want.b2),
    Math.abs(s.a1 - want.a1), Math.abs(s.a2 - want.a2),
    Math.abs(r.a1 - want.ra1), Math.abs(r.a2 - want.ra2),
  )
  // A −20 dBFS 1 kHz sine must read −20 LUFS (K-weighting is unity at 1 kHz
  // to within a few hundredths of a dB, and the −0.691 offset is calibrated
  // to make exactly this true).
  const fs = 48000
  const n = fs * 3
  const sine = new Float32Array(n)
  for (let i = 0; i < n; i++) sine[i] = Math.SQRT2 * 0.1 * Math.sin((2 * Math.PI * 1000 * i) / fs)
  const lufs = integratedLufs(sine, fs)
  return { coeffErr: err, sineLufs: lufs, sineErr: Math.abs(lufs + 20) }
}
