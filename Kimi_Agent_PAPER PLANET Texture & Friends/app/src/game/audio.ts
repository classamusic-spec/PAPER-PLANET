/* PAPER PLANET — tiny WebAudio synth. No assets, all generated. */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let bgmTimer: number | null = null

function ac(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(m: boolean) {
  muted = m
  if (m) {
    stopBgm()
    stopCrickets()
  }
}
export function isMuted() {
  return muted
}

function out(): GainNode {
  ac()
  return master!
}

function tone(
  freq: number,
  t0: number,
  dur: number,
  type: OscillatorType = 'triangle',
  vol = 0.22,
  slideTo?: number,
) {
  if (muted) return
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(out())
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

function noise(t0: number, dur: number, vol = 0.15, freq = 1800, q = 0.8, slideTo?: number) {
  if (muted) return
  const c = ac()
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(freq, t0)
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(out())
  src.start(t0)
}

const now = () => ac().currentTime

export const sfx = {
  click() {
    tone(660, now(), 0.07, 'triangle', 0.16, 880)
  },
  back() {
    tone(520, now(), 0.09, 'triangle', 0.14, 340)
  },
  whoosh(p = 1) {
    // soft low-passed paper sweep — gentler than a band-pass hiss
    const t = now()
    noise(t, 0.3, 0.05 + 0.05 * p, 700 + 900 * p, 0.5, 380)
  },
  /** velocity-driven paper friction for crease rubbing — call often, throttled outside */
  rubScratch(v: number) {
    const vol = Math.min(0.09, 0.02 + v * 0.09)
    noise(now(), 0.07, vol, 1100 + Math.random() * 900 + v * 800, 2.2)
  },
  creaseDone() {
    const t = now()
    tone(880, t, 0.12, 'sine', 0.14, 1320)
    noise(t, 0.1, 0.08, 3200, 1.4)
  },
  munch() {
    const t = now()
    noise(t, 0.09, 0.22, 480, 1.2)
    tone(180, t, 0.09, 'sine', 0.25, 110)
    noise(t + 0.14, 0.08, 0.18, 560, 1.2)
    tone(220, t + 0.14, 0.08, 'sine', 0.2, 140)
    tone(660, t + 0.3, 0.12, 'triangle', 0.12, 880)
  },
  goldFanfare() {
    const t = now()
    const notes = [659.25, 830.61, 987.77, 1318.51, 987.77, 1318.51, 1567.98]
    notes.forEach((f, i) => tone(f, t + i * 0.1, 0.26, 'triangle', 0.16))
    tone(329.63, t, 0.8, 'sine', 0.1)
    ;[2093, 2637, 3135.96].forEach((f, i) => tone(f, t + 0.5 + i * 0.09, 0.3, 'sine', 0.06))
    noise(t + 0.55, 0.5, 0.05, 6000, 0.4, 9000)
  },
  foldDone() {
    const t = now()
    noise(t, 0.12, 0.2, 2400, 0.6)
    tone(240, t, 0.12, 'sine', 0.3, 90)
    tone(1200, t + 0.02, 0.08, 'triangle', 0.1, 1800)
  },
  pop() {
    const t = now()
    tone(300, t, 0.1, 'sine', 0.35, 70)
    noise(t, 0.06, 0.12, 3000, 1)
  },
  fanfare() {
    const t = now()
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
    notes.forEach((f, i) => tone(f, t + i * 0.11, 0.22, 'triangle', 0.2))
    tone(261.63, t, 0.7, 'sine', 0.12)
    noise(t + 0.55, 0.4, 0.06, 5000, 0.4, 8000)
  },
  chirp(scale: number[]) {
    if (muted) return
    const t = now()
    scale.forEach((f, i) => tone(f, t + i * 0.13, 0.16, 'triangle', 0.18))
  },
  sparkle() {
    const t = now()
    ;[1567.98, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.06, 0.18, 'sine', 0.07))
  },
}

/* Gentle pentatonic music box loop for title / planet screens */
const MELODY = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25, 587.33, 659.25, 523.25]
let step = 0
export function startBgm() {
  if (bgmTimer !== null || muted) return
  ac()
  const tick = () => {
    if (muted) return
    const f = MELODY[step % MELODY.length]
    if (step % 2 === 0) tone(f, now(), 0.5, 'sine', 0.05)
    if (step % 8 === 0) tone(f / 2, now(), 0.9, 'sine', 0.035)
    step++
  }
  tick()
  bgmTimer = window.setInterval(tick, 480)
}
export function stopBgm() {
  if (bgmTimer !== null) {
    clearInterval(bgmTimer)
    bgmTimer = null
  }
}

/* ---- night crickets: soft high chirp pattern, looped while night mode is on ---- */
let cricketTimer: number | null = null
export function startCrickets() {
  if (cricketTimer !== null || muted) return
  ac()
  const chirp = () => {
    if (muted) return
    const t = now()
    const base = 4200 + Math.random() * 600
    for (let i = 0; i < 3; i++) tone(base + i * 120, t + i * 0.07, 0.05, 'sine', 0.022)
  }
  chirp()
  cricketTimer = window.setInterval(chirp, 1700 + Math.random() * 800)
}
export function stopCrickets() {
  if (cricketTimer !== null) {
    clearInterval(cricketTimer)
    cricketTimer = null
  }
}
