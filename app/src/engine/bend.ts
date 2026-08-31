// PAPER PLANET — progressive bending: a flap in flight bows like real paper, then flattens.

import type { BendStrip, Facet, InflateFan } from './types'
import {
  AREA_EPS, EPS, clamp, clamp01, polyArea, polyCentroid, sideDist, splitPolygon,
} from './geom'

/**
 * Peak bow over the life of a fold.
 *
 * Paper does not hinge. Lift a flap and it takes up a smooth curve concentrated
 * near the crease; as the fold completes the curve is squeezed out and the flap
 * arrives flat. So the bow is zero at both ends and peaks a little before the
 * middle, where the flap is most unsupported.
 */
export function bowAmount(t: number, strength: number): number {
  const u = clamp01(t)
  if (u <= 0 || u >= 1) return 0
  return clamp01(strength * Math.sin(Math.PI * Math.pow(u, 0.82)))
}

/**
 * Exponent of the cumulative rotation profile P(s) = s^p, where s is the
 * normalised distance from the hinge and P(1) = 1 (the free edge always
 * reaches the full fold angle).
 *
 *   p -> 0    every degree happens at the crease: a rigid hinge.
 *   p  = 1    curvature spread evenly: a circular arc.
 *
 * Curvature is dP/ds = p·s^(p-1) — large at the crease, tapering outward, which
 * is exactly the shape a sheet of paper takes.
 */
export function bendExponent(bow: number): number {
  return 0.05 + clamp01(bow) * 0.95
}

/** 6..10 strips, fewer when many facets are in flight. Spec range, budget aware. */
export function stripCount(movingFacets: number): number {
  if (movingFacets <= 4) return 10
  if (movingFacets <= 10) return 8
  if (movingFacets <= 24) return 7
  return 6
}

/** Bow strength per gesture. A pinch is tight and stiff; a big valley flops. */
export function bowStrengthFor(kind: string): number {
  switch (kind) {
    case 'pinch': return 0.34
    case 'crease': return 0.12
    case 'reverse': return 0.52
    case 'squash': return 0.62
    case 'petal': return 0.66
    case 'pull': return 0.86
    case 'inflate': return 0.4
    default: return 0.78
  }
}

const NEAR: number[] = []
const FAR: number[] = []
const REST: number[] = []
const C2 = new Float64Array(2)

/**
 * Slice a facet into strips parallel to the hinge.
 *
 * Strip boundaries are packed toward the crease (a power curve), because that is
 * where the curvature lives — spending polygons where the eye can see the bend.
 * Called once when a step begins, never per frame.
 */
export function buildStrips(
  poly: readonly number[],
  ax: number, ay: number, bx: number, by: number,
  maxDist: number,
  count: number,
  idBase: string,
): BendStrip[] | null {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (!(len > EPS) || !(maxDist > EPS) || count < 2) return null
  const invLen = 1 / len
  // Unit left normal: moving toward it increases the signed distance.
  const nx = -dy * invLen
  const ny = dx * invLen

  const out: BendStrip[] = []
  REST.length = 0
  for (let i = 0; i < poly.length; i++) REST.push(poly[i])

  for (let k = 1; k < count; k++) {
    if (REST.length < 6) break
    const d = maxDist * Math.pow(k / count, 1.25)
    const sax = ax + nx * d
    const say = ay + ny * d
    const sbx = bx + nx * d
    const sby = by + ny * d
    splitPolygon(REST, sax, say, sbx, sby, FAR, NEAR)
    if (NEAR.length >= 6 && Math.abs(polyArea(NEAR)) >= AREA_EPS) {
      out.push(makeStrip(NEAR, ax, ay, bx, by, invLen, maxDist, idBase + ':s' + out.length))
    }
    REST.length = 0
    for (let i = 0; i < FAR.length; i++) REST.push(FAR[i])
    if (REST.length < 6) break
  }
  if (REST.length >= 6 && Math.abs(polyArea(REST)) >= AREA_EPS) {
    out.push(makeStrip(REST, ax, ay, bx, by, invLen, maxDist, idBase + ':s' + out.length))
  }
  return out.length > 1 ? out : null
}

function makeStrip(
  src: readonly number[],
  ax: number, ay: number, bx: number, by: number,
  invLen: number, maxDist: number, id: string,
): BendStrip {
  const n = src.length
  const poly = new Array<number>(n)
  const s = new Float64Array(n >> 1)
  const invMax = 1 / maxDist
  for (let i = 0, v = 0; i < n; i += 2, v++) {
    poly[i] = src[i]
    poly[i + 1] = src[i + 1]
    s[v] = clamp01(sideDist(src[i], src[i + 1], ax, ay, bx, by, invLen) * invMax)
  }
  return { poly, s, id }
}

/** Largest perpendicular distance from the hinge across a set of facets. */
export function flapExtent(
  facets: readonly Facet[], which: readonly number[],
  ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (!(len > EPS)) return 0
  const invLen = 1 / len
  let max = 0
  for (let i = 0; i < which.length; i++) {
    const p = facets[which[i]].poly
    for (let k = 0; k < p.length; k += 2) {
      const d = sideDist(p[k], p[k + 1], ax, ay, bx, by, invLen)
      if (d > max) max = d
    }
  }
  return max
}

/**
 * Warp one vertex of a bending flap.
 *
 * The vertex is rotated about the hinge by theta·s^p — a per-vertex angle, so a
 * strip whose two long edges sit at different distances becomes a planar quad
 * tilted a little more than the strip before it. Chain eight of those and the
 * flap reads as a curve while every face stays flat and crisp.
 */
export function bendVertex(
  x: number, y: number, z: number,
  s: number,
  ax: number, ay: number, ux: number, uy: number,
  theta: number, exponent: number,
  out: Float64Array, oi: number,
): void {
  const phi = theta * Math.pow(clamp01(s), exponent)
  const c = Math.cos(phi)
  const sn = Math.sin(phi)
  const nx = -uy
  const ny = ux
  const rx = x - ax
  const ry = y - ay
  const along = rx * ux + ry * uy
  const perp = rx * nx + ry * ny
  const perp2 = perp * c - z * sn
  const z2 = perp * sn + z * c
  out[oi] = ax + along * ux + perp2 * nx
  out[oi + 1] = ay + along * uy + perp2 * ny
  out[oi + 2] = z2
}

/* ── inflate ───────────────────────────────────────────────────────────────
   Pushing a closed pouch into a volume. Displacing a flat polygon's vertices
   leaves it flat, so an inflating facet is fanned around its centroid and the
   centroid is pushed out hardest — a shallow, faceted dome that keeps the
   low-poly paper look while reading unmistakably as 3D.                      */

/** Build the fan once per step. `dir` is which way this facet balloons. */
export function buildFan(
  poly: readonly number[], dir: number, edgeFalloff: number, idBase: string,
): InflateFan | null {
  const n = poly.length
  if (n < 6) return null
  polyCentroid(poly, C2, 0)
  const cx = C2[0]
  const cy = C2[1]
  // Rough facet radius, used to normalise the vertex-to-centroid falloff.
  let r = 0
  for (let i = 0; i < n; i += 2) {
    const d = Math.hypot(poly[i] - cx, poly[i + 1] - cy)
    if (d > r) r = d
  }
  if (!(r > EPS)) return null

  const tris: number[][] = []
  const w: Float64Array[] = []
  const ids: string[] = []
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n
    const tri = [poly[i], poly[i + 1], poly[j], poly[j + 1], cx, cy]
    if (Math.abs(polyArea(tri)) < AREA_EPS) continue
    const ww = new Float64Array(3)
    ww[0] = vertexBulge(poly[i], poly[i + 1], cx, cy, r, edgeFalloff)
    ww[1] = vertexBulge(poly[j], poly[j + 1], cx, cy, r, edgeFalloff)
    ww[2] = 1
    ids.push(idBase + ':t' + tris.length)
    tris.push(tri)
    w.push(ww)
  }
  return tris.length ? { tris, w, ids, dir } : null
}

function vertexBulge(x: number, y: number, cx: number, cy: number, r: number, edgeFalloff: number): number {
  const d = clamp01(Math.hypot(x - cx, y - cy) / r)
  // Cosine dome: 1 at the centre, `edgeFalloff` at the rim. Seams stay stitched
  // because neighbouring facets share rim vertices and so share the rim value.
  return edgeFalloff + (1 - edgeFalloff) * (1 - d * d)
}

/** Clamp helper re-exported so callers do not need two imports. */
export const clampBend = clamp
