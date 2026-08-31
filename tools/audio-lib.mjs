// PAPER PLANET — build-time audio DSP + analysis library (Node only, never shipped).

import { MPEGDecoder } from 'mpg123-decoder'
import lamejs from '@breezystack/lamejs'

/* ───────────────────────────── codec ───────────────────────────── */

/** Decode an MP3 buffer to { sampleRate, channels: Float32Array[] }. */
export async function decodeMp3(bytes) {
  const dec = new MPEGDecoder()
  await dec.ready
  try {
    const r = dec.decode(new Uint8Array(bytes))
    if (!r.channelData.length || !r.samplesDecoded) throw new Error('decoded zero samples')
    return {
      sampleRate: r.sampleRate,
      channels: r.channelData.map((c) => c.subarray(0, r.samplesDecoded)),
    }
  } finally {
    dec.free()
  }
}

/** Encode mono Float32 PCM to an MP3 buffer. */
export function encodeMp3(pcm, sampleRate, kbps = 128) {
  const enc = new lamejs.Mp3Encoder(1, sampleRate, kbps)
  const i16 = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.round(pcm[i] * 32767)
    i16[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v
  }
  const parts = []
  const BLOCK = 1152
  for (let i = 0; i < i16.length; i += BLOCK) {
    const chunk = enc.encodeBuffer(i16.subarray(i, Math.min(i + BLOCK, i16.length)))
    if (chunk.length) parts.push(Buffer.from(chunk))
  }
  const tail = enc.flush()
  if (tail.length) parts.push(Buffer.from(tail))
  return Buffer.concat(parts)
}

/** LAME encoder delay in samples — decoded MP3 leads with this much silence. */
export const MP3_ENCODER_DELAY = 1105

/* ───────────────────────────── channels ───────────────────────────── */

export function toMono(channels) {
  if (channels.length === 1) return Float32Array.from(channels[0])
  const n = channels[0].length
  const out = new Float32Array(n)
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c]
    for (let i = 0; i < n; i++) out[i] += ch[i]
  }
  const g = 1 / channels.length
  for (let i = 0; i < n; i++) out[i] *= g
  return out
}

/** Mean |L-R| — near zero means the source is really dual-mono. */
export function stereoDivergence(channels) {
  if (channels.length < 2) return 0
  const [l, r] = channels
  let d = 0
  for (let i = 0; i < l.length; i++) d += Math.abs(l[i] - r[i])
  return d / l.length
}

/* ───────────────────────────── filters ───────────────────────────── */

export function removeDc(pcm) {
  let mean = 0
  for (let i = 0; i < pcm.length; i++) mean += pcm[i]
  mean /= pcm.length || 1
  for (let i = 0; i < pcm.length; i++) pcm[i] -= mean
  return pcm
}

function biquad(pcm, b0, b1, b2, a1, a2) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  const out = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    const x0 = pcm[i]
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    out[i] = y0
    x2 = x1; x1 = x0; y2 = y1; y1 = y0
  }
  return out
}

/** 2nd-order Butterworth high-pass. Paper has nothing below ~60Hz; rumble only eats bitrate. */
export function highpass(pcm, sampleRate, freq, q = 0.7071) {
  const w0 = (2 * Math.PI * freq) / sampleRate
  const cw = Math.cos(w0), sw = Math.sin(w0)
  const alpha = sw / (2 * q)
  const a0 = 1 + alpha
  return biquad(
    pcm,
    ((1 + cw) / 2) / a0, (-(1 + cw)) / a0, ((1 + cw) / 2) / a0,
    (-2 * cw) / a0, (1 - alpha) / a0,
  )
}

export function lowpass(pcm, sampleRate, freq, q = 0.7071) {
  const w0 = (2 * Math.PI * freq) / sampleRate
  const cw = Math.cos(w0), sw = Math.sin(w0)
  const alpha = sw / (2 * q)
  const a0 = 1 + alpha
  return biquad(
    pcm,
    ((1 - cw) / 2) / a0, (1 - cw) / a0, ((1 - cw) / 2) / a0,
    (-2 * cw) / a0, (1 - alpha) / a0,
  )
}

/* ───────────────────────────── levels ───────────────────────────── */

export const toDb = (x) => (x <= 1e-9 ? -Infinity : 20 * Math.log10(x))
export const fromDb = (db) => Math.pow(10, db / 20)

export function peakOf(pcm) {
  let p = 0
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > p) p = a }
  return p
}

export function rmsOf(pcm, from = 0, to = pcm.length) {
  let s = 0
  const n = Math.max(1, to - from)
  for (let i = from; i < to; i++) s += pcm[i] * pcm[i]
  return Math.sqrt(s / n)
}

/**
 * Loudness of the parts that actually sound — ignores the silence a generated
 * clip is padded with, so a cue with a long tail isn't turned up too far.
 */
export function activeRms(pcm, sampleRate, floorDbBelowPeak = 35) {
  const win = Math.max(1, Math.floor(sampleRate * 0.02))
  const peak = peakOf(pcm)
  if (peak <= 1e-7) return 0
  const gate = peak * fromDb(-floorDbBelowPeak)
  let sum = 0, n = 0
  for (let i = 0; i < pcm.length; i += win) {
    const r = rmsOf(pcm, i, Math.min(i + win, pcm.length))
    if (r >= gate) { sum += r * r * win; n += win }
  }
  return n ? Math.sqrt(sum / n) : rmsOf(pcm)
}

/** Soft knee limiter — keeps transients from clipping without squashing them. */
export function softLimit(pcm, ceiling = 0.89) {
  const knee = ceiling * 0.72
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i]
    const a = Math.abs(v)
    if (a > knee) {
      const over = (a - knee) / (1 - knee)
      const shaped = knee + (ceiling - knee) * Math.tanh(over * 1.7)
      pcm[i] = Math.sign(v) * Math.min(shaped, ceiling)
    }
  }
  return pcm
}

/**
 * Loudness-match to a target active-RMS so cues sit consistently against each
 * other.
 *
 * `clamp` mode backs the gain off until the natural peak just fits under the
 * ceiling instead of limiting into it. Paper cues are extremely peaky (18–22dB
 * crest); limiting them to a fixed ceiling flattens exactly the transient that
 * makes a crease sound crisp. Backing off costs a little consistency and keeps
 * every attack intact — the right trade for headphone ASMR.
 *
 * `maxGainDb` stops us amplifying a near-silent dud into pure noise.
 */
export function normalize(pcm, sampleRate, { targetRmsDb = -20, ceilingDb = -1.5, maxGainDb = 40, maxLimitDb = 4 } = {}) {
  const cur = activeRms(pcm, sampleRate)
  if (cur <= 1e-7) return { gainDb: 0, limitDb: 0, pcm }
  const ceiling = fromDb(ceilingDb)
  const peak = peakOf(pcm)

  // Gain that hits the loudness target, and the gain that would just touch the
  // ceiling. Between them sits `maxLimitDb` of allowed peak shaving.
  const rmsGain = fromDb(targetRmsDb) / cur
  const peakGain = peak > 1e-7 ? ceiling / peak : rmsGain
  let gain = Math.min(rmsGain, peakGain * fromDb(maxLimitDb), fromDb(maxGainDb))

  for (let i = 0; i < pcm.length; i++) pcm[i] *= gain
  const limitDb = Math.max(0, toDb(peakOf(pcm) / ceiling))
  if (limitDb > 0) softLimit(pcm, ceiling)
  return { gainDb: toDb(gain), limitDb, pcm }
}

/**
 * Keep only the loudest single transient. The generator often renders two or
 * three taps when we asked for one; a UI tick that double-hits feels broken.
 */
export function isolateTransient(pcm, sampleRate, { preMs = 18, postMs = 220 } = {}) {
  const win = Math.max(1, Math.floor(sampleRate * 0.005))
  let best = 0, bestI = 0
  for (let i = 0; i < pcm.length; i += win) {
    const r = rmsOf(pcm, i, Math.min(i + win, pcm.length))
    if (r > best) { best = r; bestI = i }
  }
  const start = Math.max(0, bestI - Math.floor((preMs / 1000) * sampleRate))
  const end = Math.min(pcm.length, bestI + Math.floor((postMs / 1000) * sampleRate))
  if (end - start < win * 2) return pcm
  return pcm.slice(start, end)
}

/* ───────────────────────────── edits ───────────────────────────── */

/**
 * Trim silence from both ends. Threshold is relative to the clip's own peak, so
 * it adapts to however hot the generator happened to render.
 */
export function trimSilence(pcm, sampleRate, { thresholdDb = -46, lookbackMs = 6, tailMs = 60 } = {}) {
  const peak = peakOf(pcm)
  if (peak <= 1e-7) return { pcm, start: 0, end: pcm.length }
  const gate = peak * fromDb(thresholdDb)
  const win = Math.max(1, Math.floor(sampleRate * 0.005))
  let start = 0
  for (let i = 0; i < pcm.length; i += win) {
    if (rmsOf(pcm, i, Math.min(i + win, pcm.length)) >= gate) { start = i; break }
  }
  let end = pcm.length
  for (let i = pcm.length - win; i >= 0; i -= win) {
    if (rmsOf(pcm, i, Math.min(i + win, pcm.length)) >= gate) { end = Math.min(pcm.length, i + win); break }
  }
  start = Math.max(0, start - Math.floor((lookbackMs / 1000) * sampleRate))
  end = Math.min(pcm.length, end + Math.floor((tailMs / 1000) * sampleRate))
  if (end <= start) return { pcm, start: 0, end: pcm.length }
  return { pcm: pcm.slice(start, end), start, end }
}

/** Short fades so a trimmed edge can never click. */
export function fadeEdges(pcm, sampleRate, inMs = 2.5, outMs = 25) {
  const nIn = Math.min(pcm.length >> 1, Math.floor((inMs / 1000) * sampleRate))
  const nOut = Math.min(pcm.length >> 1, Math.floor((outMs / 1000) * sampleRate))
  for (let i = 0; i < nIn; i++) pcm[i] *= i / nIn
  for (let i = 0; i < nOut; i++) pcm[pcm.length - 1 - i] *= i / nOut
  return pcm
}

/**
 * Fold the tail back over the head with an equal-power crossfade so the result
 * loops with no seam. Output length = input length − crossfade.
 */
export function loopCrossfade(pcm, sampleRate, xfadeSec = 2.0) {
  const X = Math.min(Math.floor(pcm.length / 3), Math.floor(xfadeSec * sampleRate))
  if (X < 64) return Float32Array.from(pcm)
  const L = pcm.length - X
  const out = new Float32Array(L)
  for (let i = 0; i < X; i++) {
    const t = i / X
    const fin = Math.sin((t * Math.PI) / 2)
    const fout = Math.cos((t * Math.PI) / 2)
    out[i] = pcm[i] * fin + pcm[i + L] * fout
  }
  for (let i = X; i < L; i++) out[i] = pcm[i]
  return out
}

/** Seam continuity check: energy right at the wrap versus the local average. */
export function seamScore(pcm, sampleRate) {
  const w = Math.max(4, Math.floor(sampleRate * 0.002))
  let jump = 0
  for (let i = 0; i < w; i++) {
    jump += Math.abs(pcm[pcm.length - w + i] - pcm[i])
  }
  jump /= w
  const local = (rmsOf(pcm, 0, w * 8) + rmsOf(pcm, pcm.length - w * 8, pcm.length)) / 2
  return local > 1e-7 ? jump / local : 0
}

/* ───────────────────────────── spectrum ───────────────────────────── */

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr; im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

const BANDS = [
  [0, 125], [125, 250], [250, 500], [500, 1000],
  [1000, 2000], [2000, 4000], [4000, 8000], [8000, 16000], [16000, 22050],
]
export const BAND_LABELS = ['<125', '125-250', '250-500', '.5-1k', '1-2k', '2-4k', '4-8k', '8-16k', '16k+']

/** Average magnitude spectrum over Hann frames → centroid, flatness, band split. */
export function spectrum(pcm, sampleRate, N = 2048) {
  if (pcm.length < N) return null
  const hop = N
  const mag = new Float64Array(N / 2)
  let frames = 0
  const hann = new Float64Array(N)
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  for (let off = 0; off + N <= pcm.length; off += hop) {
    const re = new Float64Array(N), im = new Float64Array(N)
    for (let i = 0; i < N; i++) re[i] = pcm[off + i] * hann[i]
    fft(re, im)
    for (let k = 0; k < N / 2; k++) mag[k] += Math.hypot(re[k], im[k])
    frames++
  }
  if (!frames) return null
  for (let k = 0; k < mag.length; k++) mag[k] /= frames

  const binHz = sampleRate / N
  let num = 0, den = 0, logSum = 0, linSum = 0
  const bands = new Float64Array(BANDS.length)
  for (let k = 1; k < mag.length; k++) {
    const f = k * binHz
    const m = mag[k]
    num += f * m
    den += m
    logSum += Math.log(m + 1e-12)
    linSum += m
    for (let b = 0; b < BANDS.length; b++) {
      if (f >= BANDS[b][0] && f < BANDS[b][1]) { bands[b] += m * m; break }
    }
  }
  const nb = mag.length - 1
  const flatness = Math.exp(logSum / nb) / (linSum / nb + 1e-12)
  const total = bands.reduce((a, b) => a + b, 0) || 1
  return {
    centroid: den > 0 ? num / den : 0,
    flatness,
    bands: Array.from(bands, (b) => b / total),
  }
}

/* ───────────────────────────── analysis ───────────────────────────── */

/** Everything needed to judge a clip without hearing it. */
export function analyze(pcm, sampleRate) {
  const dur = pcm.length / sampleRate
  const peak = peakOf(pcm)
  const rms = rmsOf(pcm)
  const act = activeRms(pcm, sampleRate)

  const win = Math.max(1, Math.floor(sampleRate * 0.02))
  let quiet = 0, total = 0
  const env = []
  for (let i = 0; i < pcm.length; i += win) {
    const r = rmsOf(pcm, i, Math.min(i + win, pcm.length))
    env.push(r)
    if (r < 1e-4) quiet++
    total++
  }

  // longest internal silent run — a granular source must have none
  let run = 0, maxRun = 0
  for (const r of env) { if (r < 1e-4) { run++; if (run > maxRun) maxRun = run } else run = 0 }

  let lead = 0
  while (lead < env.length && env[lead] < peak * 0.02) lead++
  let tail = 0
  while (tail < env.length && env[env.length - 1 - tail] < peak * 0.02) tail++

  let zc = 0
  for (let i = 1; i < pcm.length; i++) if ((pcm[i - 1] < 0) !== (pcm[i] < 0)) zc++

  const spec = spectrum(pcm, sampleRate)
  return {
    duration: dur,
    sampleRate,
    peak, peakDb: toDb(peak),
    rms, rmsDb: toDb(rms),
    activeRmsDb: toDb(act),
    crest: act > 0 ? peak / act : 0,
    silenceRatio: total ? quiet / total : 1,
    longestSilenceSec: (maxRun * win) / sampleRate,
    leadSilenceSec: (lead * win) / sampleRate,
    tailSilenceSec: (tail * win) / sampleRate,
    zcr: zc / (pcm.length / sampleRate),
    centroid: spec?.centroid ?? 0,
    flatness: spec?.flatness ?? 0,
    bands: spec?.bands ?? [],
    env,
  }
}

/** Compact ASCII envelope — the fastest way to see a clip's shape. */
export function envelopeArt(env, width = 56) {
  if (!env.length) return ''
  const peak = Math.max(...env, 1e-9)
  const chars = ' .:-=+*#%@'
  let s = ''
  for (let i = 0; i < width; i++) {
    const a = Math.floor((i * env.length) / width)
    const b = Math.max(a + 1, Math.floor(((i + 1) * env.length) / width))
    let m = 0
    for (let j = a; j < b && j < env.length; j++) m = Math.max(m, env[j])
    const db = toDb(m / peak)
    const t = Math.max(0, Math.min(1, (db + 48) / 48))
    s += chars[Math.min(chars.length - 1, Math.round(t * (chars.length - 1)))]
  }
  return s
}

/** Compact band bar-graph, one char per octave band. */
export function bandArt(bands) {
  if (!bands.length) return ''
  const chars = '.:-=+*#%@'
  return bands.map((b) => chars[Math.min(chars.length - 1, Math.round(Math.sqrt(b) * (chars.length - 1)))]).join('')
}

/**
 * Fill dropouts in a bed by overlap-adding it with a half-length-shifted copy of
 * itself. Both copies share the loop period, so the result still wraps exactly.
 * Costs a little eventfulness, buys a bed that never falls silent mid-loop.
 */
export function densify(pcm) {
  const L = pcm.length
  const half = L >> 1
  const out = new Float32Array(L)
  const g = Math.SQRT1_2
  for (let i = 0; i < L; i++) out[i] = (pcm[i] + pcm[(i + half) % L]) * g
  return out
}

/**
 * Fraction of the clip that sits in a real dropout.
 *
 * Measured against the MEDIAN window level, not the peak. A bed whose peak is a
 * sharp event — a wind chime, a bird — makes every quiet moment look like a hole
 * under a peak-relative gate, which is how the tea room bed first failed. The
 * median tracks the actual bed level, so this asks the question that matters:
 * does the sound ever drop out of audibility relative to itself?
 */
export function holeRatio(pcm, sampleRate, thresholdDb = -22) {
  const win = Math.max(1, Math.floor(sampleRate * 0.02))
  const levels = []
  for (let i = 0; i < pcm.length; i += win) {
    levels.push(rmsOf(pcm, i, Math.min(i + win, pcm.length)))
  }
  if (!levels.length) return 1
  const sorted = Float64Array.from(levels).sort()
  const median = sorted[sorted.length >> 1]
  if (median <= 1e-7) return 1
  const gate = median * fromDb(thresholdDb)
  let quiet = 0
  for (const l of levels) if (l < gate) quiet++
  return quiet / levels.length
}
