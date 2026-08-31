// PAPER PLANET — seeded geometry for paper edges. Pure, deterministic, no React.

/** How the boundary of a sheet was made. */
export type EdgeKind = 'clean' | 'cut' | 'deckle' | 'torn'

/* ── seeded randomness ─────────────────────────────────────────────────────
   Every sheet in the app is irregular, but it is the *same* irregular sheet on
   every render — otherwise the paper would crawl. One seed in, one sheet out. */

export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return Math.floor(seed) >>> 0
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — small, fast, well-distributed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A small, stable rotation for a sheet. Nothing in this app is machine-square.
 * BRAND.md §2.I: ±0.4° to ±2°.
 */
export function stableTilt(seed: string | number, max = 1.1): number {
  const r = mulberry32(hashSeed(seed) ^ 0x9e3779b9)()
  const sign = r < 0.5 ? -1 : 1
  const mag = 0.34 + Math.abs(r * 2 - 1) * (max - 0.34)
  return Math.round(sign * mag * 100) / 100
}

/* ── edge generation ──────────────────────────────────────────────────────── */

interface EdgeRecipe {
  /** peak displacement of the boundary, px */
  amp: number
  /** distance between samples along the boundary, px */
  spacing: number
  /** corner radius, px */
  radius: number
  /** round the boundary through the samples instead of connecting them straight */
  smooth: boolean
  /** chance a sample becomes a long fibre pull (torn only) */
  spike: number
}

const RECIPES: Record<Exclude<EdgeKind, 'clean'>, (r: number) => EdgeRecipe> = {
  // scissors: almost straight, but a human held them
  cut: (radius) => ({ amp: 0.7, spacing: 30, radius, smooth: false, spike: 0 }),
  // mould-made deckle: a soft, fibrous undulation
  deckle: (radius) => ({ amp: 2.9, spacing: 10, radius: Math.min(radius, 8), smooth: true, spike: 0 }),
  // torn against a ruler: angular, with the odd long fibre
  torn: () => ({ amp: 4.2, spacing: 8, radius: 2, smooth: false, spike: 0.12 }),
}

interface Sample {
  x: number
  y: number
  nx: number
  ny: number
}

/** Walk the perimeter of a rounded rect clockwise, sampling point + outward normal. */
function walkFrame(w: number, h: number, r: number, spacing: number): Sample[] {
  const out: Sample[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number): void => {
    const len = Math.hypot(x2 - x1, y2 - y1)
    const n = Math.max(1, Math.round(len / spacing))
    for (let i = 0; i < n; i++) {
      const t = i / n
      out.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, nx, ny })
    }
  }
  const arc = (cx: number, cy: number, a0: number, a1: number): void => {
    if (r <= 0.01) return
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / spacing))
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i / n)
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) })
    }
  }
  const H = Math.PI / 2
  line(r, 0, w - r, 0, 0, -1)
  arc(w - r, r, -H, 0)
  line(w, r, w, h - r, 1, 0)
  arc(w - r, h - r, 0, H)
  line(w - r, h, r, h, 0, 1)
  arc(r, h - r, H, Math.PI)
  line(0, h - r, 0, r, -1, 0)
  arc(r, r, Math.PI, Math.PI * 1.5)
  return out
}

/** A seamless 1-D noise field around a closed loop of `n` samples. */
function loopNoise(rand: () => number, n: number, smoothPasses: number): number[] {
  let v = Array.from({ length: n }, () => rand() * 2 - 1)
  for (let p = 0; p < smoothPasses; p++) {
    const next = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      next[i] = (v[(i - 1 + n) % n] + v[i] * 2 + v[(i + 1) % n]) / 4
    }
    v = next
  }
  return v
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Build the outline of one sheet as an SVG path in **pixel space**.
 * The frame is inset by the noise amplitude so the boundary never leaves the box.
 */
export function edgePath(
  width: number,
  height: number,
  seed: string | number,
  kind: Exclude<EdgeKind, 'clean'>,
  radius: number,
): string {
  const baseRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2 - 1))
  const rec = RECIPES[kind](baseRadius)
  const inset = rec.amp
  const w = Math.max(4, width - inset * 2)
  const h = Math.max(4, height - inset * 2)
  const rad = Math.max(0, Math.min(rec.radius, Math.min(w, h) / 2 - 0.5))

  const pts = walkFrame(w, h, rad, rec.spacing)
  const n = pts.length
  if (n < 4) return `M0 0 H${r2(width)} V${r2(height)} H0 Z`

  const rand = mulberry32(hashSeed(seed))
  const coarse = loopNoise(rand, n, rec.smooth ? 2 : 1)
  const fine = loopNoise(rand, n, 0)

  const p: Array<[number, number]> = new Array(n)
  for (let i = 0; i < n; i++) {
    let d = coarse[i] * 0.78 + fine[i] * (rec.smooth ? 0.22 : 0.4)
    if (rec.spike > 0 && rand() < rec.spike) d = d * 2.1 + (d < 0 ? -0.4 : 0.4)
    const off = d * rec.amp
    p[i] = [inset + pts[i].x + pts[i].nx * off, inset + pts[i].y + pts[i].ny * off]
  }

  if (!rec.smooth) {
    let d = `M${r2(p[0][0])} ${r2(p[0][1])}`
    for (let i = 1; i < n; i++) d += `L${r2(p[i][0])} ${r2(p[i][1])}`
    return d + 'Z'
  }

  // Catmull-Rom → cubic Bézier, closed, so the deckle reads as fibre not facets.
  let d = `M${r2(p[0][0])} ${r2(p[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`
  }
  return d + 'Z'
}
