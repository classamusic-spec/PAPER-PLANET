// PAPER PLANET — the Sheet: a planar subdivision of facets plus the fold tree that moves them.

import type { Crease, FoldKind } from '../contracts'
import type { Facet, FoldNode } from './types'
import { HALF, SHEET } from './types'
import type { Mat34 } from './geom'
import {
  AREA_EPS, DEG, EPS, ON_LINE, clamp, finite, matCopy, matCreate, matIdentity, matMul,
  matRotAboutLine, polyArea, polyCentroid, polyOrient, pointInPolygon, sideDist, splitPolygon,
} from './geom'

/** Folds at or beyond this angle lie flat, so the moved stack restacks. */
const FLAT_ANGLE = 140 * DEG
/** Facets smaller than this stop being subdivided — sliver control. */
const MIN_SPLIT_AREA = 6
/** Hard ceiling so a pathological recipe cannot melt a phone. */
export const MAX_FACETS = 640

export interface CreaseOptions {
  /** Signed rotation in radians. */
  angle: number
  kind: FoldKind
  /** Restrict the crease to this node's subtree. -1 folds through every layer. */
  scope: number
  /**
   * Skip this node's subtree entirely. The second half of a reverse fold uses it
   * to say "the other layer" — everything the first half did not already move.
   * Omit, or pass -1, to exclude nothing.
   */
  exclude?: number
  /**
   * True when the moving half travels over the top of the stack (a valley),
   * false when it swings underneath (a mountain). Derived from
   * `crease.direction`, not from the signed angle, because the angle's sign
   * also carries which half-plane is moving.
   */
  foldUp: boolean
  /** Inside-reverse: tuck the moved group between the layers it came from. */
  invertLayers: boolean
  /** Force the moved stack above (+1) or below (-1); 0 = derive from the fold direction. */
  stackBias: number
}

export interface CreaseResult {
  /** Newly created hinge nodes. */
  nodes: number[]
  /** Facet indices that ended up on the moving side. */
  moved: number[]
  /** Largest perpendicular reach of the moved flap, model units. */
  extent: number
  /** Axis in model-plane coordinates. */
  ax: number
  ay: number
  bx: number
  by: number
}

const POS: number[] = []
const NEG: number[] = []
const C2 = new Float64Array(2)
const AXIS = new Float64Array(4)

/**
 * Convert a material-space crease into a model-plane axis oriented so the moving
 * half-plane is on the left of a->b. Exported because callers need the same
 * orientation when they reason about world-space hinge directions.
 */
export function orientAxis(crease: Crease, out: Float64Array): void {
  const ax = finite(crease.a[0], 0) - HALF
  const ay = finite(crease.a[1], 0) - HALF
  const bx = finite(crease.b[0], 0) - HALF
  const by = finite(crease.b[1], 0) - HALF
  if (crease.side >= 0) {
    out[0] = ax; out[1] = ay; out[2] = bx; out[3] = by
  } else {
    out[0] = bx; out[1] = by; out[2] = ax; out[3] = ay
  }
}

let facetSeq = 0

/**
 * The paper.
 *
 * Every node's local frame is model-plane space — the flat sheet — which is the
 * trick that makes this composable: applying a crease means rotating about the
 * *same* material line in each affected layer's own frame, so folding through
 * eight layers is eight sibling hinges, not eight special cases.
 */
export class Sheet {
  facets: Facet[] = []
  nodes: FoldNode[] = []
  /** Baked whole-model transform (committed flips and rotations). */
  model: Mat34 = matCreate()
  /** In-flight whole-model transform, about the model centroid. */
  pending: Mat34 = matCreate()
  /** 1 normally; a press compacts the stack. */
  layerScale = 1
  /** 0..1 balloon amount. */
  inflate = 0
  /** Breathing amplitude and phase; only meaningful once the model is complete. */
  breathAmp = 0
  breathPhase = 0
  /** Bumped whenever geometry (not camera) changes, so caches know to rebuild. */
  geomVersion = 0

  private worldDirty = true
  private rootWorld: Mat34 = matCreate()

  constructor() {
    this.reset()
  }

  /** Back to one flat square of paper with a single root node. */
  reset(): void {
    facetSeq = 0
    this.nodes.length = 0
    this.facets.length = 0
    this.nodes.push(makeNode(-1, 0, 0, 0, 1, 0, 'crease'))
    this.facets.push(makeFacet([-HALF, -HALF, HALF, -HALF, HALF, HALF, -HALF, HALF], 0, 0))
    matIdentity(this.model)
    matIdentity(this.pending)
    this.layerScale = 1
    this.inflate = 0
    this.breathAmp = 0
    this.breathPhase = 0
    this.worldDirty = true
    this.geomVersion++
    this.refreshFacetMeta()
  }

  markDirty(): void {
    this.worldDirty = true
    this.geomVersion++
  }

  /* ── the fold tree ─────────────────────────────────────────────────────── */

  isInSubtree(node: number, root: number): boolean {
    if (root < 0) return true
    let n = node
    let guard = 0
    while (n >= 0 && guard++ < 256) {
      if (n === root) return true
      n = this.nodes[n].parent
    }
    return false
  }

  /** Rebuild every node's world matrix. Node counts are tiny; this is ~1us. */
  updateWorld(): void {
    if (!this.worldDirty) return
    this.worldDirty = false
    const nodes = this.nodes
    matMul(this.pending, this.model, this.rootWorld)
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (n.parent < 0) {
        matCopy(this.rootWorld, n.world)
        matIdentity(n.local)
        continue
      }
      matRotAboutLine(n.local, n.ax, n.ay, n.bx, n.by, n.angle)
      matMul(nodes[n.parent].world, n.local, n.world)
    }
  }

  /** World transform a bending facet hangs from: its hinge's *parent* frame. */
  flightParentWorld(node: number): Mat34 {
    const p = this.nodes[node].parent
    return this.nodes[p < 0 ? 0 : p].world
  }

  setNodeAngle(node: number, angle: number): void {
    const n = this.nodes[node]
    const a = finite(angle, 0)
    if (n.angle !== a) {
      n.angle = a
      this.worldDirty = true
      this.geomVersion++
    }
  }

  /* ── creasing ──────────────────────────────────────────────────────────── */

  /**
   * Apply one crease. Every facet straddling the axis is split; the half on
   * `crease.side` is re-parented into a fresh hinge under whichever node
   * currently owns it, so a fold through N layers spawns N sibling hinges that
   * all turn about the same material line.
   */
  applyCrease(crease: Crease, opts: CreaseOptions, out: CreaseResult): boolean {
    // Orient the axis so the moving half is always the positive (left) side.
    // Every downstream stage — strip distances, bend parameters, AO — then works
    // in one convention instead of carrying `side` around.
    orientAxis(crease, AXIS)
    const ax = AXIS[0]
    const ay = AXIS[1]
    const bx = AXIS[2]
    const by = AXIS[3]
    out.nodes.length = 0
    out.moved.length = 0
    out.extent = 0
    out.ax = ax
    out.ay = ay
    out.bx = bx
    out.by = by

    const dx = bx - ax
    const dy = by - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    if (!(len > 1e-3)) return false
    const invLen = 1 / len

    const exclude = opts.exclude ?? -1
    const facets = this.facets
    const kept: Facet[] = []
    const movingByNode = new Map<number, number[]>()

    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      if (!this.isInSubtree(f.node, opts.scope)) {
        kept.push(f)
        continue
      }
      if (exclude >= 0 && this.isInSubtree(f.node, exclude)) {
        kept.push(f)
        continue
      }
      if (f.area < MIN_SPLIT_AREA || kept.length > MAX_FACETS) {
        // Too small to be worth another cut: send it whole to the side it sits on.
        const moves = sideDist(f.cx, f.cy, ax, ay, bx, by, invLen) > 0
        kept.push(f)
        if (moves) pushGroup(movingByNode, f.node, kept.length - 1)
        continue
      }

      splitPolygon(f.poly, ax, ay, bx, by, POS, NEG)
      const movePoly = POS
      const stayPoly = NEG

      if (stayPoly.length >= 6) {
        const g = movePoly.length >= 6 ? makeFacet(stayPoly.slice(), f.node, f.layer) : reuse(f, stayPoly)
        kept.push(g)
      }
      if (movePoly.length >= 6) {
        const g = stayPoly.length >= 6 ? makeFacet(movePoly.slice(), f.node, f.layer) : reuse(f, movePoly)
        kept.push(g)
        pushGroup(movingByNode, f.node, kept.length - 1)
      }
    }

    if (movingByNode.size === 0) {
      this.facets = kept
      this.refreshFacetMeta()
      this.markDirty()
      return false
    }

    // One new hinge per owning node — folding through the stack.
    this.facets = kept
    movingByNode.forEach((idxs, parent) => {
      const nodeId = this.nodes.length
      this.nodes.push(makeNode(parent, this.nodes[parent].depth + 1, ax, ay, bx, by, opts.kind))
      const nd = this.nodes[nodeId]
      nd.rest = opts.angle
      nd.inFlight = true
      for (let k = 0; k < idxs.length; k++) {
        kept[idxs[k]].node = nodeId
        out.moved.push(idxs[k])
      }
      out.nodes.push(nodeId)
    })

    let extent = 0
    for (let i = 0; i < out.moved.length; i++) {
      const p = kept[out.moved[i]].poly
      for (let k = 0; k < p.length; k += 2) {
        const d = Math.abs(sideDist(p[k], p[k + 1], ax, ay, bx, by, invLen))
        if (d > extent) extent = d
      }
    }
    out.extent = extent

    this.restack(out.moved, opts)
    this.refreshFacetMeta()
    this.markDirty()
    return true
  }

  /**
   * Where the moved stack lands.
   *
   * A flat fold puts the moving half on top of (valley) or under (mountain) the
   * half it lands on, with its internal order reversed — the sheet that
   * travelled furthest ends up buried. A standing flap keeps its order because
   * nothing has stacked yet.
   */
  private restack(moved: readonly number[], opts: CreaseOptions): void {
    const facets = this.facets
    for (let i = 0; i < facets.length; i++) facets[i].layerFlat = facets[i].layer
    const flat = Math.abs(opts.angle) >= FLAT_ANGLE
    if (!flat && opts.stackBias === 0) {
      this.renormalizeLayers()
      return
    }

    const isMoved = new Uint8Array(facets.length)
    for (let i = 0; i < moved.length; i++) isMoved[moved[i]] = 1

    let maxStat = -Infinity
    let minStat = Infinity
    let maxMoved = -Infinity
    let minMoved = Infinity
    for (let i = 0; i < facets.length; i++) {
      const inScope = this.isInSubtree(facets[i].node, opts.scope)
      const l = facets[i].layer
      if (isMoved[i]) {
        if (l > maxMoved) maxMoved = l
        if (l < minMoved) minMoved = l
      } else if (inScope || opts.scope < 0) {
        if (l > maxStat) maxStat = l
        if (l < minStat) minStat = l
      }
    }
    if (maxStat === -Infinity) {
      maxStat = maxMoved
      minStat = minMoved
    }
    if (maxMoved === -Infinity) {
      this.renormalizeLayers()
      return
    }

    // A valley carries the flap over the top of the stack; a mountain under it.
    const goesUp = opts.stackBias !== 0 ? opts.stackBias > 0 : opts.foldUp

    for (let i = 0; i < moved.length; i++) {
      const f = facets[moved[i]]
      f.layerFlat = goesUp
        ? maxStat + 1 + (maxMoved - f.layer)
        : minStat - 1 - (f.layer - minMoved)
    }

    if (opts.invertLayers) {
      // Inside reverse: the moved sheets sink between the layers they came from.
      const mid = (maxStat + minStat) * 0.5
      for (let i = 0; i < moved.length; i++) {
        const f = facets[moved[i]]
        f.layerFlat = mid + (maxMoved - f.layer) * 0.01 - 0.005
      }
    }
    this.renormalizeLayers()
  }

  /** Collapse layer values to a dense 0..n-1 ordering, preserving ties. */
  private renormalizeLayers(): void {
    const facets = this.facets
    const n = facets.length
    if (n === 0) return
    const order: number[] = []
    for (let i = 0; i < n; i++) order.push(i)

    order.sort((a, b) => facets[a].layerFlat - facets[b].layerFlat)
    let rank = 0
    let prev = NaN
    for (let k = 0; k < n; k++) {
      const f = facets[order[k]]
      if (k > 0 && f.layerFlat !== prev) rank++
      prev = f.layerFlat
      f.layerFlat = rank
    }

    order.sort((a, b) => facets[a].layer - facets[b].layer)
    rank = 0
    prev = NaN
    for (let k = 0; k < n; k++) {
      const f = facets[order[k]]
      if (k > 0 && f.layer !== prev) rank++
      prev = f.layer
      f.layer = rank
    }
  }

  /** Commit the in-flight step: the flat stacking becomes the real stacking. */
  commitLayers(): void {
    const facets = this.facets
    for (let i = 0; i < facets.length; i++) facets[i].layer = facets[i].layerFlat
    this.markDirty()
  }

  /** Raise a subtree to the top of the stack — what a `pull` does to a hidden flap. */
  raiseSubtree(root: number): void {
    if (root < 0) return
    const facets = this.facets
    let top = 0
    for (let i = 0; i < facets.length; i++) if (facets[i].layer > top) top = facets[i].layer
    for (let i = 0; i < facets.length; i++) {
      if (this.isInSubtree(facets[i].node, root)) {
        facets[i].layer += top + 1
        facets[i].layerFlat = facets[i].layer
      }
    }
    this.renormalizeLayers()
    for (let i = 0; i < facets.length; i++) facets[i].layer = facets[i].layerFlat
    this.markDirty()
  }

  /* ── queries ───────────────────────────────────────────────────────────── */

  /** Index of the topmost facet covering a material-space point, or -1. */
  facetAtMaterial(u: number, v: number): number {
    const x = finite(u, HALF) - HALF
    const y = finite(v, HALF) - HALF
    const facets = this.facets
    let best = -1
    let bestLayer = -Infinity
    for (let i = 0; i < facets.length; i++) {
      if (pointInPolygon(facets[i].poly, x, y) && facets[i].layer > bestLayer) {
        bestLayer = facets[i].layer
        best = i
      }
    }
    if (best >= 0) return best
    // Nothing contains it — fall back to the nearest centroid so callers always
    // get a usable frame of reference.
    let bd = Infinity
    for (let i = 0; i < facets.length; i++) {
      const d = (facets[i].cx - x) ** 2 + (facets[i].cy - y) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best
  }

  /**
   * Does this axis actually cut a facet inside `scope`? Used to widen a scoped
   * move (reverse, squash, petal) outward until it finds the flap the crease
   * really acts on, instead of silently doing nothing.
   */
  creaseCrosses(scope: number, ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    if (!(len > EPS)) return false
    const invLen = 1 / len
    const facets = this.facets
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      if (!this.isInSubtree(f.node, scope)) continue
      if (f.area < MIN_SPLIT_AREA) continue
      let pos = false
      let neg = false
      const p = f.poly
      for (let k = 0; k < p.length; k += 2) {
        const d = sideDist(p[k], p[k + 1], ax, ay, bx, by, invLen)
        if (d > ON_LINE) pos = true
        else if (d < -ON_LINE) neg = true
        if (pos && neg) return true
      }
    }
    return false
  }

  /** Total material area. Conserved across every fold — the engine's invariant. */
  totalArea(): number {
    let a = 0
    for (let i = 0; i < this.facets.length; i++) a += Math.abs(this.facets[i].area)
    return a
  }

  maxLayer(): number {
    let m = 0
    for (let i = 0; i < this.facets.length; i++) if (this.facets[i].layer > m) m = this.facets[i].layer
    return m
  }

  /** Recompute cached per-facet metadata after any structural change. */
  refreshFacetMeta(): void {
    const facets = this.facets
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      polyOrient(f.poly)
      f.area = Math.abs(polyArea(f.poly))
      polyCentroid(f.poly, C2, 0)
      f.cx = C2[0]
      f.cy = C2[1]
      const n = this.nodes[f.node]
      const dx = n.bx - n.ax
      const dy = n.by - n.ay
      const l = Math.sqrt(dx * dx + dy * dy)
      f.rootDist = l > EPS ? Math.abs(sideDist(f.cx, f.cy, n.ax, n.ay, n.bx, n.by, 1 / l)) : SHEET
    }
  }

  /**
   * Points for a yaw-invariant camera fit.
   *
   * Framing to a bounding sphere is stable but wastes almost half the viewport.
   * Instead, every vertex contributes four proxies on the circle it would sweep
   * if the camera orbited: the fit is then exact for the current pose and still
   * correct at any yaw, which is the only orbit the player drives continuously.
   */
  fitProxies(centre: Float64Array, out: Float64Array, cap: number, sweepRad: number): number {
    const r = this.measure(centre)
    const cx = centre[0]
    const cz = centre[2]
    const facets = this.facets
    // A full sweep is bounded exactly by the four cardinal points on the circle:
    // screen x and y each depend linearly on one of the swept axes. A partial
    // sweep samples the arc the player can actually reach.
    const full = sweepRad >= Math.PI * 0.5
    const per = full ? 4 : 5
    const step = full ? 0 : sweepRad * 0.5
    let n = 0
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      const m = this.nodes[f.node].world
      for (let k = 0; k < f.poly.length; k += 2) {
        if ((n + per) * 3 > cap) return n || 1
        const x = f.poly[k]
        const y = f.poly[k + 1]
        const wx = m[0] * x + m[1] * y + m[3]
        const wy = m[4] * x + m[5] * y + m[7]
        const wz = m[8] * x + m[9] * y + m[11]
        const dx = wx - cx
        const dz = wz - cz
        if (full) {
          const rh = Math.sqrt(dx * dx + dz * dz)
          out[n * 3] = cx + rh; out[n * 3 + 1] = wy; out[n * 3 + 2] = cz; n++
          out[n * 3] = cx - rh; out[n * 3 + 1] = wy; out[n * 3 + 2] = cz; n++
          out[n * 3] = cx; out[n * 3 + 1] = wy; out[n * 3 + 2] = cz + rh; n++
          out[n * 3] = cx; out[n * 3 + 1] = wy; out[n * 3 + 2] = cz - rh; n++
        } else {
          for (let q = -2; q <= 2; q++) {
            const a = q * step
            const c = Math.cos(a)
            const sn = Math.sin(a)
            out[n * 3] = cx + dx * c - dz * sn
            out[n * 3 + 1] = wy
            out[n * 3 + 2] = cz + dx * sn + dz * c
            n++
          }
        }
      }
    }
    if (n === 0) {
      out[0] = centre[0] + r; out[1] = centre[1]; out[2] = centre[2]
      n = 1
    }
    return n
  }

  /** World-space centroid and bounding radius, for camera fit and breathing. */
  measure(out: Float64Array): number {
    this.updateWorld()
    const facets = this.facets
    let n = 0
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      const m = this.nodes[f.node].world
      for (let k = 0; k < f.poly.length; k += 2) {
        const x = f.poly[k]
        const y = f.poly[k + 1]
        sx += m[0] * x + m[1] * y + m[3]
        sy += m[4] * x + m[5] * y + m[7]
        sz += m[8] * x + m[9] * y + m[11]
        n++
      }
    }
    if (n === 0) {
      out[0] = 0
      out[1] = 0
      out[2] = 0
      return HALF
    }
    const cx = sx / n
    const cy = sy / n
    const cz = sz / n
    let r2 = 0
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      const m = this.nodes[f.node].world
      for (let k = 0; k < f.poly.length; k += 2) {
        const x = f.poly[k]
        const y = f.poly[k + 1]
        const px = m[0] * x + m[1] * y + m[3] - cx
        const py = m[4] * x + m[5] * y + m[7] - cy
        const pz = m[8] * x + m[9] * y + m[11] - cz
        const d = px * px + py * py + pz * pz
        if (d > r2) r2 = d
      }
    }
    out[0] = cx
    out[1] = cy
    out[2] = cz
    return Math.max(Math.sqrt(r2), 1)
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function pushGroup(map: Map<number, number[]>, key: number, value: number): void {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

function reuse(f: Facet, poly: readonly number[]): Facet {
  f.poly.length = 0
  for (let i = 0; i < poly.length; i++) f.poly.push(poly[i])
  f.strips = null
  f.fan = null
  return f
}

export function makeFacet(poly: number[], node: number, layer: number): Facet {
  polyOrient(poly)
  const area = Math.abs(polyArea(poly))
  polyCentroid(poly, C2, 0)
  return {
    id: 'f' + facetSeq++,
    poly,
    node,
    layer,
    layerFlat: layer,
    area,
    cx: C2[0],
    cy: C2[1],
    rootDist: SHEET,
    strips: null,
    fan: null,
  }
}

export function makeNode(
  parent: number, depth: number,
  ax: number, ay: number, bx: number, by: number,
  kind: FoldKind,
): FoldNode {
  return {
    parent,
    depth,
    ax, ay, bx, by,
    angle: 0,
    rest: 0,
    kind,
    bow: 0,
    inFlight: false,
    local: matCreate(),
    world: matCreate(),
    dirty: true,
  }
}

/** Discard slivers that survived a chain of splits. */
export function pruneSlivers(sheet: Sheet): number {
  const keep: Facet[] = []
  let dropped = 0
  for (let i = 0; i < sheet.facets.length; i++) {
    if (sheet.facets[i].area >= AREA_EPS) keep.push(sheet.facets[i])
    else dropped++
  }
  if (dropped) {
    sheet.facets = keep
    sheet.refreshFacetMeta()
    sheet.markDirty()
  }
  return dropped
}

export { clamp }
