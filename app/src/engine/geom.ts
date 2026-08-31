// PAPER PLANET — engine geometry: vector/matrix math, polygon splitting, hulls, offsets, robustness guards.

/** A 3x4 row-major affine matrix. The implicit fourth row is (0, 0, 0, 1). */
export type Mat34 = Float64Array

/** Generic float epsilon. */
export const EPS = 1e-9
/** Tolerance, in material units, for "this vertex lies on the crease". Sheet is 1000 wide. */
export const ON_LINE = 1e-4
/** Polygons with less material area than this are slivers and get discarded. */
export const AREA_EPS = 4e-3

/** NaN-safe clamp: NaN resolves to `lo`, at no extra cost. */
export function clamp(x: number, lo: number, hi: number): number {
  return x > lo ? (x > hi ? hi : x) : lo
}

/** NaN-safe clamp to 0..1. NaN resolves to 0. */
export function clamp01(x: number): number {
  return x > 0 ? (x > 1 ? 1 : x) : 0
}

/** Replace NaN / Infinity with a fallback. Every value that enters the engine goes through this. */
export function finite(x: number, fallback: number): number {
  return typeof x === 'number' && x - x === 0 ? x : fallback
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Hermite smoothstep between two edges. Returns 0..1, safe when e0 === e1. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const d = e1 - e0
  if (!(Math.abs(d) > EPS)) return x < e0 ? 0 : 1
  const t = clamp01((x - e0) / d)
  return t * t * (3 - 2 * t)
}

/* ── polygons ──────────────────────────────────────────────────────────────
   Polygons are flat arrays [x0, y0, x1, y1, ...] wound so the signed area is
   positive. Splitting and fanning preserve that winding, which is what lets
   Newell's normal tell us which face of the paper we are looking at.        */

/** Twice the signed area (shoelace). Positive for the canonical winding. */
export function polyArea2(p: readonly number[], n = p.length): number {
  if (n < 6) return 0
  let s = 0
  let jx = p[n - 2]
  let jy = p[n - 1]
  for (let i = 0; i < n; i += 2) {
    const ix = p[i]
    const iy = p[i + 1]
    s += jx * iy - ix * jy
    jx = ix
    jy = iy
  }
  return s
}

export function polyArea(p: readonly number[], n = p.length): number {
  return polyArea2(p, n) * 0.5
}

/** Area-weighted centroid. Falls back to the vertex mean for degenerate polygons. */
export function polyCentroid(p: readonly number[], out: Float64Array, oi = 0): void {
  const n = p.length
  if (n < 2) {
    out[oi] = 0
    out[oi + 1] = 0
    return
  }
  let a = 0
  let cx = 0
  let cy = 0
  let jx = p[n - 2]
  let jy = p[n - 1]
  for (let i = 0; i < n; i += 2) {
    const ix = p[i]
    const iy = p[i + 1]
    const cross = jx * iy - ix * jy
    a += cross
    cx += (jx + ix) * cross
    cy += (jy + iy) * cross
    jx = ix
    jy = iy
  }
  if (Math.abs(a) > EPS) {
    const k = 1 / (3 * a)
    out[oi] = cx * k
    out[oi + 1] = cy * k
    return
  }
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i += 2) {
    sx += p[i]
    sy += p[i + 1]
  }
  const inv = 2 / n
  out[oi] = sx * inv
  out[oi + 1] = sy * inv
}

/** Reverse a polygon's winding in place. */
export function polyReverse(p: number[]): void {
  const n = p.length
  for (let i = 0, j = n - 2; i < j; i += 2, j -= 2) {
    const x = p[i]
    const y = p[i + 1]
    p[i] = p[j]
    p[i + 1] = p[j + 1]
    p[j] = x
    p[j + 1] = y
  }
}

/** Force the canonical (positive-area) winding. */
export function polyOrient(p: number[]): void {
  if (polyArea2(p) < 0) polyReverse(p)
}

/**
 * Signed perpendicular distance from (px, py) to the infinite line a→b,
 * positive on the left half-plane (cross((b-a),(p-a)) > 0). `invLen` is 1/|b-a|.
 */
export function sideDist(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
  invLen: number,
): number {
  return ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * invLen
}

/**
 * THE core primitive. Split `poly` by the infinite line a→b into the positive
 * (left) and negative (right) half-plane pieces. Results are written into the
 * caller's arrays, which are cleared first. Either may come back empty.
 *
 * Robust to: zero-length axes, vertices exactly on the line, collinear edges,
 * and slivers (dropped by area). If both halves degenerate the whole polygon is
 * emitted on the side of its centroid, so a split can never punch a hole.
 */
export function splitPolygon(
  poly: readonly number[],
  ax: number, ay: number, bx: number, by: number,
  outPos: number[], outNeg: number[],
): void {
  outPos.length = 0
  outNeg.length = 0
  const n = poly.length
  if (n < 6) return

  const dx = bx - ax
  const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (!(len > EPS)) {
    // Degenerate axis: nothing is split, everything stays put.
    for (let i = 0; i < n; i++) outPos.push(poly[i])
    return
  }
  const invLen = 1 / len

  let jx = poly[n - 2]
  let jy = poly[n - 1]
  let dj = sideDist(jx, jy, ax, ay, bx, by, invLen)
  let anyPos = false
  let anyNeg = false

  for (let i = 0; i < n; i += 2) {
    const ix = poly[i]
    const iy = poly[i + 1]
    const di = sideDist(ix, iy, ax, ay, bx, by, invLen)

    // Edge j→i crosses the line: emit the intersection to both sides first.
    if ((dj > ON_LINE && di < -ON_LINE) || (dj < -ON_LINE && di > ON_LINE)) {
      const denom = dj - di
      const t = Math.abs(denom) > EPS ? clamp01(dj / denom) : 0.5
      const cx = jx + (ix - jx) * t
      const cy = jy + (iy - jy) * t
      outPos.push(cx, cy)
      outNeg.push(cx, cy)
    }

    if (di >= -ON_LINE) {
      outPos.push(ix, iy)
      if (di > ON_LINE) anyPos = true
    }
    if (di <= ON_LINE) {
      outNeg.push(ix, iy)
      if (di < -ON_LINE) anyNeg = true
    }

    jx = ix
    jy = iy
    dj = di
  }

  const okPos = anyPos && outPos.length >= 6 && Math.abs(polyArea(outPos)) >= AREA_EPS
  const okNeg = anyNeg && outNeg.length >= 6 && Math.abs(polyArea(outNeg)) >= AREA_EPS

  if (okPos && okNeg) return
  if (okPos && !okNeg) {
    outPos.length = 0
    outNeg.length = 0
    for (let i = 0; i < n; i++) outPos.push(poly[i])
    return
  }
  if (okNeg && !okPos) {
    outPos.length = 0
    outNeg.length = 0
    for (let i = 0; i < n; i++) outNeg.push(poly[i])
    return
  }

  // Both halves degenerate (the polygon is a sliver hugging the axis).
  // Keep it whole on the side its centroid falls, so no hole appears.
  CEN[0] = 0
  CEN[1] = 0
  polyCentroid(poly, CEN, 0)
  const dc = sideDist(CEN[0], CEN[1], ax, ay, bx, by, invLen)
  const dst = dc >= 0 ? outPos : outNeg
  outPos.length = 0
  outNeg.length = 0
  for (let i = 0; i < n; i++) dst.push(poly[i])
}

const CEN = new Float64Array(2)

/** Even-odd ray cast. Points exactly on an edge may resolve either way. */
export function pointInPolygon(poly: readonly number[], x: number, y: number): boolean {
  const n = poly.length
  if (n < 6) return false
  let inside = false
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const yi = poly[i + 1]
    const yj = poly[j + 1]
    if (yi > y !== yj > y) {
      const xi = poly[i]
      const xj = poly[j]
      const denom = yj - yi
      if (Math.abs(denom) > EPS && x < xi + ((y - yi) / denom) * (xj - xi)) inside = !inside
    }
  }
  return inside
}

/**
 * Monotone-chain convex hull over a flat point array. Writes the hull, CCW in a
 * y-down frame, into `out`. `scratch` is an Int32Array index buffer that is
 * grown by the caller; pass one to keep this allocation-free.
 */
export function convexHull(pts: readonly number[], count: number, out: number[]): void {
  out.length = 0
  if (count <= 0) return
  if (count <= 2) {
    for (let i = 0; i < count * 2; i++) out.push(pts[i])
    return
  }
  const idx: number[] = []
  for (let i = 0; i < count; i++) idx.push(i)
  idx.sort((a, b) => {
    const d = pts[a * 2] - pts[b * 2]
    return d !== 0 ? d : pts[a * 2 + 1] - pts[b * 2 + 1]
  })

  const hull: number[] = []
  // lower
  for (let k = 0; k < count; k++) {
    const i = idx[k]
    while (hull.length >= 2 && hullCross(pts, hull[hull.length - 2], hull[hull.length - 1], i) <= 0) hull.pop()
    hull.push(i)
  }
  // upper
  const lower = hull.length + 1
  for (let k = count - 2; k >= 0; k--) {
    const i = idx[k]
    while (hull.length >= lower && hullCross(pts, hull[hull.length - 2], hull[hull.length - 1], i) <= 0) hull.pop()
    hull.push(i)
  }
  hull.pop()
  for (let k = 0; k < hull.length; k++) {
    const i = hull[k]
    out.push(pts[i * 2], pts[i * 2 + 1])
  }
  if (out.length < 6) {
    out.length = 0
    for (let i = 0; i < count * 2; i++) out.push(pts[i])
  }
}

function hullCross(p: readonly number[], a: number, b: number, c: number): number {
  return (
    (p[b * 2] - p[a * 2]) * (p[c * 2 + 1] - p[a * 2 + 1]) -
    (p[b * 2 + 1] - p[a * 2 + 1]) * (p[c * 2] - p[a * 2])
  )
}

/**
 * Offset a simple polygon by `delta` (positive = outward for the canonical
 * winding). Adjacent offset edges are intersected; near-parallel joins fall
 * back to the mitre-free offset point. Collapsing results fall back to a scale
 * about the centroid, so this never returns garbage.
 */
export function offsetPolygon(poly: readonly number[], delta: number, out: number[]): void {
  out.length = 0
  const n = poly.length
  if (n < 6) {
    for (let i = 0; i < n; i++) out.push(poly[i])
    return
  }
  if (Math.abs(delta) < EPS) {
    for (let i = 0; i < n; i++) out.push(poly[i])
    return
  }
  const sign = polyArea2(poly) >= 0 ? 1 : -1
  const d = delta * sign

  for (let i = 0; i < n; i += 2) {
    const hp = (i - 2 + n) % n
    const nx0 = poly[i] - poly[hp]
    const ny0 = poly[i + 1] - poly[hp + 1]
    const nn = (i + 2) % n
    const nx1 = poly[nn] - poly[i]
    const ny1 = poly[nn + 1] - poly[i + 1]

    const l0 = Math.sqrt(nx0 * nx0 + ny0 * ny0)
    const l1 = Math.sqrt(nx1 * nx1 + ny1 * ny1)
    if (!(l0 > EPS) || !(l1 > EPS)) {
      out.push(poly[i], poly[i + 1])
      continue
    }
    // Outward normal of each edge in a y-down CCW frame.
    const a0x = ny0 / l0
    const a0y = -nx0 / l0
    const a1x = ny1 / l1
    const a1y = -nx1 / l1

    let bx = a0x + a1x
    let by = a0y + a1y
    const bl = Math.sqrt(bx * bx + by * by)
    if (!(bl > 1e-4)) {
      out.push(poly[i] + a1x * d, poly[i + 1] + a1y * d)
      continue
    }
    bx /= bl
    by /= bl
    // Mitre length, clamped so spikes cannot explode.
    const cosHalf = clamp(bx * a1x + by * a1y, 0.2, 1)
    const m = clamp(d / cosHalf, -Math.abs(d) * 4, Math.abs(d) * 4)
    out.push(poly[i] + bx * m, poly[i + 1] + by * m)
  }

  const before = polyArea2(poly)
  const after = polyArea2(out)
  if (!(Math.abs(after) > EPS) || after * before < 0) {
    // The offset turned the polygon inside out. Fall back to a centroid scale.
    out.length = 0
    polyCentroid(poly, CEN, 0)
    const r = Math.sqrt(Math.abs(before) * 0.5) || 1
    const k = clamp(1 + delta / r, 0.05, 4)
    for (let i = 0; i < n; i += 2) {
      out.push(CEN[0] + (poly[i] - CEN[0]) * k, CEN[1] + (poly[i + 1] - CEN[1]) * k)
    }
  }
}

/* ── 3D vectors ─────────────────────────────────────────────────────────── */

/** Normalise (x,y,z) into out[oi..oi+2]. Returns the original length. */
export function normalize3(x: number, y: number, z: number, out: Float64Array, oi = 0): number {
  const l = Math.sqrt(x * x + y * y + z * z)
  if (!(l > EPS)) {
    out[oi] = 0
    out[oi + 1] = 0
    out[oi + 2] = 1
    return 0
  }
  const k = 1 / l
  out[oi] = x * k
  out[oi + 1] = y * k
  out[oi + 2] = z * k
  return l
}

/**
 * Newell's normal of a world-space polygon held in a flat xyz buffer.
 * Robust for non-planar (bent) polygons, which is exactly why we use it.
 */
export function newellNormal(
  buf: Float64Array, start: number, vcount: number, out: Float64Array, oi = 0,
): void {
  let nx = 0
  let ny = 0
  let nz = 0
  let j = start + (vcount - 1) * 3
  for (let k = 0; k < vcount; k++) {
    const i = start + k * 3
    const ix = buf[i]
    const iy = buf[i + 1]
    const iz = buf[i + 2]
    const jx = buf[j]
    const jy = buf[j + 1]
    const jz = buf[j + 2]
    nx += (jy - iy) * (jz + iz)
    ny += (jz - iz) * (jx + ix)
    nz += (jx - ix) * (jy + iy)
    j = i
  }
  normalize3(nx, ny, nz, out, oi)
}

/* ── 3x4 affine matrices ────────────────────────────────────────────────── */

export function matCreate(): Mat34 {
  const m = new Float64Array(12)
  m[0] = 1
  m[5] = 1
  m[10] = 1
  return m
}

export function matIdentity(m: Mat34): void {
  m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0
  m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0
}

export function matCopy(src: Mat34, dst: Mat34): void {
  for (let i = 0; i < 12; i++) dst[i] = src[i]
}

const MUL_TMP = new Float64Array(12)

/** out = a · b. Safe when `out` aliases `a` or `b`. */
export function matMul(a: Mat34, b: Mat34, out: Mat34): void {
  const t = MUL_TMP
  for (let r = 0; r < 3; r++) {
    const r4 = r * 4
    const a0 = a[r4]
    const a1 = a[r4 + 1]
    const a2 = a[r4 + 2]
    const a3 = a[r4 + 3]
    t[r4] = a0 * b[0] + a1 * b[4] + a2 * b[8]
    t[r4 + 1] = a0 * b[1] + a1 * b[5] + a2 * b[9]
    t[r4 + 2] = a0 * b[2] + a1 * b[6] + a2 * b[10]
    t[r4 + 3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3
  }
  for (let i = 0; i < 12; i++) out[i] = t[i]
}

/** Transform the point (x,y,z) by m into out[oi..oi+2]. */
export function matApply(
  m: Mat34, x: number, y: number, z: number, out: Float64Array, oi: number,
): void {
  out[oi] = m[0] * x + m[1] * y + m[2] * z + m[3]
  out[oi + 1] = m[4] * x + m[5] * y + m[6] * z + m[7]
  out[oi + 2] = m[8] * x + m[9] * y + m[10] * z + m[11]
}

/** Transform the direction (x,y,z) by m's rotation part into out[oi..oi+2]. */
export function matApplyDir(
  m: Mat34, x: number, y: number, z: number, out: Float64Array, oi: number,
): void {
  out[oi] = m[0] * x + m[1] * y + m[2] * z
  out[oi + 1] = m[4] * x + m[5] * y + m[6] * z
  out[oi + 2] = m[8] * x + m[9] * y + m[10] * z
}

/** Rodrigues rotation about a unit axis, written into the rotation block of m. */
export function matSetRotAxis(m: Mat34, ux: number, uy: number, uz: number, angle: number): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  m[0] = c + ux * ux * t
  m[1] = ux * uy * t - uz * s
  m[2] = ux * uz * t + uy * s
  m[4] = uy * ux * t + uz * s
  m[5] = c + uy * uy * t
  m[6] = uy * uz * t - ux * s
  m[8] = uz * ux * t - uy * s
  m[9] = uz * uy * t + ux * s
  m[10] = c + uz * uz * t
  m[3] = 0
  m[7] = 0
  m[11] = 0
}

/**
 * Rotation by `angle` about the line a→b lying in the z = 0 plane.
 * This is the hinge every crease uses. Degenerate axes yield the identity.
 */
export function matRotAboutLine(
  m: Mat34,
  ax: number, ay: number, bx: number, by: number,
  angle: number,
): void {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (!(len > EPS) || !(angle - angle === 0)) {
    matIdentity(m)
    return
  }
  matSetRotAxis(m, dx / len, dy / len, 0, angle)
  // translation = a - R·a  (a = (ax, ay, 0))
  m[3] = ax - (m[0] * ax + m[1] * ay)
  m[7] = ay - (m[4] * ax + m[5] * ay)
  m[11] = 0 - (m[8] * ax + m[9] * ay)
}

/** Rotation by `angle` about the world axis `axis` (0=x, 1=y, 2=z) through point p. */
export function matRotAboutPoint(
  m: Mat34, axis: 0 | 1 | 2, angle: number, px: number, py: number, pz: number,
): void {
  const a = finite(angle, 0)
  matSetRotAxis(m, axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0, a)
  m[3] = px - (m[0] * px + m[1] * py + m[2] * pz)
  m[7] = py - (m[4] * px + m[5] * py + m[6] * pz)
  m[11] = pz - (m[8] * px + m[9] * py + m[10] * pz)
}

/** Uniform scale about a point — the breathing deformer. */
export function matScaleAboutPoint(
  m: Mat34, k: number, px: number, py: number, pz: number,
): void {
  matIdentity(m)
  m[0] = k
  m[5] = k
  m[10] = k
  m[3] = px * (1 - k)
  m[7] = py * (1 - k)
  m[11] = pz * (1 - k)
}

export const DEG = Math.PI / 180
