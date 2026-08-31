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
/**
 * How far a layer's plane may lean away from the crease's own plane and still
 * count as being on this fold, as |cos| of the angle between them.
 *
 * A crease is a line on a sheet: a layer standing at ninety degrees simply does
 * not carry it and must be left alone. But recipes routinely fold to 165, not
 * 180, and those layers are still to all intents flat against each other — hold
 * them to exact coplanarity and every near-flat layer gets skipped while its
 * neighbour folds, which tears the paper just as surely. cos 20 degrees.
 */
const COPLANAR_MIN = 0.94
/** Stride of `Sheet.laxis`: ax, ay, bx, by, angle, coplanar. */
const AX = 6
/** Two facets are still one piece of paper if their shared edge agrees to this. */
export const JOIN_EPS = 1e-3
/** Shortest shared boundary that counts as a join, in model units. */
const JOIN_MIN = 0.25

/** Two moving spans this close along a shared edge are the same span. */
const SPAN_EPS = 1e-4
const SPAN_A = new Float64Array(2)
const SPAN_B = new Float64Array(2)

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

/**
 * Whether the model is still one sheet of paper.
 *
 * Area conservation is not enough: a fold can preserve every square unit and
 * still hinge two layers about different lines, which leaves every facet in
 * perfect condition and the bird in pieces. The invariant that actually matters
 * is that two facets sharing an edge on the flat sheet still share it in space.
 */
export interface SheetIntegrity {
  /** Joins between facets that no longer meet in space. 0 is the invariant. */
  severed: number
  /** Widest gap across a severed join, in model units (the sheet is 1000). */
  maxGap: number
  /** Connected pieces the paper is in. 1 is a single sheet. */
  pieces: number
  /** Facets left with essentially no area. */
  degenerate: number
  /** Facet vertices that are not finite numbers. */
  nonFinite: number
  /** Total material area — should never leave 1e6. */
  area: number
  /** Shared edges checked. */
  joins: number
}

export function emptyIntegrity(): SheetIntegrity {
  return { severed: 0, maxGap: 0, pieces: 1, degenerate: 0, nonFinite: 0, area: 0, joins: 0 }
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
  /** Stamp shared by every hinge this one crease made. 0 when nothing moved. */
  group: number
}

const POS: number[] = []
const NEG: number[] = []
const SETTLE = matCreate()
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
let creaseSeq = 0

/**
 * The paper.
 *
 * Every node's local frame is model-plane space — the flat sheet — which is the
 * trick that makes this composable: applying a crease means rotating about one
 * line in SPACE, written into each affected layer's own frame, so folding
 * through eight layers is eight sibling hinges, not eight special cases.
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
  /** Scratch: the crease being applied, pulled back into every node's own frame. */
  private laxis = new Float64Array(64 * AX)
  /** Scratch: world matrices as they will be once the step in flight settles. */
  private swld = new Float64Array(64 * 12)
  /** Shared-edge index: facet pairs and the midpoint of the edge they share. */
  private joinA = new Int32Array(256)
  private joinB = new Int32Array(256)
  private joinM = new Float64Array(1024)
  private joinN = 0
  private joinVersion = -1
  private dsu = new Int32Array(64)

  constructor() {
    this.reset()
  }

  /** Back to one flat square of paper with a single root node. */
  reset(): void {
    facetSeq = 0
    creaseSeq = 0
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
   * World matrices as they will stand once the step in flight has settled.
   *
   * A crease laid during a step is a line in the space the paper is folding
   * INTO, not the space it is leaving. That distinction is what makes a
   * multi-crease step — a collapse, a squash, a petal — come out right: the
   * creases of one gesture happen together, so the second crease has to be
   * expressed in the frame the first one is already carrying the paper to.
   * Conjugating by the parent's settled turn is precisely what converts the
   * engine's "parent then child" chain into the "cross this crease, then that
   * one" order a folded sheet actually obeys. Without it two faces either side
   * of an earlier crease compose their turns in opposite orders and rip apart.
   */
  private buildSettleWorld(): void {
    this.updateWorld()
    const nodes = this.nodes
    const need = nodes.length * 12
    if (this.swld.length < need) this.swld = new Float64Array(need * 2)
    const S = this.swld
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const o = i * 12
      if (n.parent < 0) {
        for (let k = 0; k < 12; k++) S[o + k] = this.rootWorld[k]
        continue
      }
      matRotAboutLine(SETTLE, n.ax, n.ay, n.bx, n.by, n.inFlight ? n.rest : n.angle)
      const p = n.parent * 12
      for (let r = 0; r < 3; r++) {
        const r4 = r * 4
        const a0 = S[p + r4]
        const a1 = S[p + r4 + 1]
        const a2 = S[p + r4 + 2]
        const a3 = S[p + r4 + 3]
        S[o + r4] = a0 * SETTLE[0] + a1 * SETTLE[4] + a2 * SETTLE[8]
        S[o + r4 + 1] = a0 * SETTLE[1] + a1 * SETTLE[5] + a2 * SETTLE[9]
        S[o + r4 + 2] = a0 * SETTLE[2] + a1 * SETTLE[6] + a2 * SETTLE[10]
        S[o + r4 + 3] = a0 * SETTLE[3] + a1 * SETTLE[7] + a2 * SETTLE[11] + a3
      }
    }
  }

  /**
   * Pull one crease back into every node's own frame.
   *
   * THE INVARIANT THIS EXISTS TO KEEP. A crease is a line in *space*, not a line
   * in material coordinates. Folding a stack turns every sheet in it about one
   * physical line. But a layer that has already been folded carries a mirrored
   * copy of the material plane — fold the kite's flap across the 22.5° crease
   * and its local +x now points down the spine — so re-using the authored
   * material line inside that layer hinges it about a *different* line in the
   * world, and the flap rips away from the sheet it is joined to. That is
   * exactly the failure a player sees as "the crane went crazy at the end".
   *
   * So: take the authored line where it sits in the root (unfolded) frame, and
   * express that same world line in each node's own coordinates. Node world
   * matrices are rigid, so the pullback is the transpose — exact and cheap.
   *
   * Two details carry the correctness:
   *  - a layer whose plane is not the crease's plane is not on this crease at
   *    all. It is marked non-coplanar and left where the caller's material axis
   *    puts it, rather than being torn about a line it does not lie on.
   *  - flipping the axis end for end flips the rotation, so when a layer's
   *    moving half lands on the right the angle is negated with it and the
   *    world turn comes out identical. That is what makes the two halves of a
   *    reverse fold agree in space without guessing signs.
   */
  private buildLocalAxes(ax: number, ay: number, bx: number, by: number, angle: number): void {
    const nodes = this.nodes
    this.buildSettleWorld()
    const S = this.swld
    const need = nodes.length * AX
    if (this.laxis.length < need) this.laxis = new Float64Array(need * 2)
    const L = this.laxis
    const w0 = S

    // The authored line, where it lies in space on the unfolded reference sheet.
    // Node 0 occupies the first twelve slots of the settle-world table.
    const awx = w0[0] * ax + w0[1] * ay + w0[3]
    const awy = w0[4] * ax + w0[5] * ay + w0[7]
    const awz = w0[8] * ax + w0[9] * ay + w0[11]
    const bwx = w0[0] * bx + w0[1] * by + w0[3]
    const bwy = w0[4] * bx + w0[5] * by + w0[7]
    const bwz = w0[8] * bx + w0[9] * by + w0[11]
    // ...and which way the moving half lies, as a direction in space.
    const mx = -(by - ay)
    const my = bx - ax
    const nwx = w0[0] * mx + w0[1] * my
    const nwy = w0[4] * mx + w0[5] * my
    const nwz = w0[8] * mx + w0[9] * my

    for (let i = 0; i < nodes.length; i++) {
      const b0 = i * 12
      const o = i * AX
      const dax = awx - S[b0 + 3]
      const day = awy - S[b0 + 7]
      const daz = awz - S[b0 + 11]
      const lax = S[b0] * dax + S[b0 + 4] * day + S[b0 + 8] * daz
      const lay = S[b0 + 1] * dax + S[b0 + 5] * day + S[b0 + 9] * daz
      const dbx = bwx - S[b0 + 3]
      const dby = bwy - S[b0 + 7]
      const dbz = bwz - S[b0 + 11]
      const lbx = S[b0] * dbx + S[b0 + 4] * dby + S[b0 + 8] * dbz
      const lby = S[b0 + 1] * dbx + S[b0 + 5] * dby + S[b0 + 9] * dbz

      // How square is this layer to the crease's plane? Sheet normals are the
      // third column of each frame; either facing counts, a layer folded flat
      // against another is the same plane seen from the back.
      const face = Math.abs(
        (S[b0 + 2] * S[2] + S[b0 + 6] * S[6] + S[b0 + 10] * S[10]),
      )
      if (!(face >= COPLANAR_MIN)) {
        // Standing away from the crease's plane: this layer is not on this fold.
        L[o] = ax; L[o + 1] = ay; L[o + 2] = bx; L[o + 3] = by
        L[o + 4] = angle
        L[o + 5] = 0
        continue
      }
      // Near enough flat: drop the out-of-plane part, which is the orthogonal
      // projection of the crease onto the paper this layer actually is.

      const lnx = S[b0] * nwx + S[b0 + 4] * nwy + S[b0 + 8] * nwz
      const lny = S[b0 + 1] * nwx + S[b0 + 5] * nwy + S[b0 + 9] * nwz
      // Is the moving half still the left of a->b once pulled back?
      const left = -(lby - lay) * lnx + (lbx - lax) * lny
      if (left >= 0) {
        L[o] = lax; L[o + 1] = lay; L[o + 2] = lbx; L[o + 3] = lby
        L[o + 4] = angle
      } else {
        L[o] = lbx; L[o + 1] = lby; L[o + 2] = lax; L[o + 3] = lay
        L[o + 4] = -angle
      }
      L[o + 5] = 1
    }
  }

  /**
   * Apply one crease. Every facet straddling the axis is split; the half on
   * `crease.side` is re-parented into a fresh hinge under whichever node
   * currently owns it, so a fold through N layers spawns N sibling hinges —
   * each carrying that one crease as it falls in ITS OWN layer, so all of them
   * turn about the same line in space. See buildLocalAxes: the same material
   * line in every layer is only the same crease while the sheet is flat, and
   * using it after that is what tears the paper.
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
    out.group = 0
    out.ax = ax
    out.ay = ay
    out.bx = bx
    out.by = by

    const dx = bx - ax
    const dy = by - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    if (!(len > 1e-3)) return false
    const invLen = 1 / len

    // Every layer folds about the SAME LINE IN SPACE, which is a different line
    // in each layer's own material coordinates. See buildLocalAxes.
    this.buildLocalAxes(ax, ay, bx, by, opts.angle)
    const L = this.laxis

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
      const o = f.node * AX
      if (L[o + 5] === 0) {
        // This layer's plane is not the crease's plane, so the crease is not on
        // it. Folding it anyway about a line it does not carry is exactly how
        // paper tears; leave it where it is.
        kept.push(f)
        continue
      }
      const fax = L[o]
      const fay = L[o + 1]
      const fbx = L[o + 2]
      const fby = L[o + 3]
      if (f.area < MIN_SPLIT_AREA || kept.length > MAX_FACETS) {
        // Too small to be worth another cut: send it whole to the side it sits on.
        const moves = sideDist(f.cx, f.cy, fax, fay, fbx, fby, invLen) > 0
        kept.push(f)
        if (moves) pushGroup(movingByNode, f.node, kept.length - 1)
        continue
      }

      splitPolygon(f.poly, fax, fay, fbx, fby, POS, NEG)
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

    // One new hinge per owning node — folding through the stack. Each carries
    // its parent's pullback of the crease, so all of them turn about one line
    // in space and the stack stays a single sheet of paper. They also share a
    // group stamp: they are one fold, and must be re-opened as one.
    this.facets = kept
    const group = ++creaseSeq
    out.group = group
    movingByNode.forEach((idxs, parent) => {
      const o = parent * AX
      const nodeId = this.nodes.length
      this.nodes.push(makeNode(
        parent, this.nodes[parent].depth + 1,
        L[o], L[o + 1], L[o + 2], L[o + 3], opts.kind, group,
      ))
      const nd = this.nodes[nodeId]
      nd.rest = L[o + 4]
      nd.inFlight = true
      for (let k = 0; k < idxs.length; k++) {
        kept[idxs[k]].node = nodeId
        out.moved.push(idxs[k])
      }
      out.nodes.push(nodeId)
    })

    let extent = 0
    for (let i = 0; i < out.moved.length; i++) {
      const fm = kept[out.moved[i]]
      const nd = this.nodes[fm.node]
      const p = fm.poly
      for (let k = 0; k < p.length; k += 2) {
        const d = Math.abs(sideDist(p[k], p[k + 1], nd.ax, nd.ay, nd.bx, nd.by, invLen))
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
    // Ask the question the fold will actually ask: the line in each layer's frame.
    this.buildLocalAxes(ax, ay, bx, by, 0)
    const L = this.laxis
    const facets = this.facets
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i]
      if (!this.isInSubtree(f.node, scope)) continue
      if (f.area < MIN_SPLIT_AREA) continue
      const o = f.node * AX
      let pos = false
      let neg = false
      const p = f.poly
      for (let k = 0; k < p.length; k += 2) {
        const d = sideDist(p[k], p[k + 1], L[o], L[o + 1], L[o + 2], L[o + 3], invLen)
        if (d > ON_LINE) pos = true
        else if (d < -ON_LINE) neg = true
        if (pos && neg) return true
      }
    }
    return false
  }

  /* ── integrity: is this still one sheet of paper? ─────────────────────── */

  /**
   * Index every shared edge in the flat sheet.
   *
   * The facets tile the original square exactly once, so two of them sharing a
   * boundary segment ARE joined — that segment is a fold or an un-cut line of
   * paper, never a gap. Segments are bucketed by the line they lie on, so
   * finding the overlaps is near linear rather than every-pair; a T-junction
   * (a vertex of one facet part-way along another's edge) is picked up because
   * the test is interval overlap, not endpoint equality.
   */
  private buildJoins(): void {
    if (this.joinVersion === this.geomVersion) return
    this.joinVersion = this.geomVersion
    const facets = this.facets
    const buckets = new Map<number, number[]>()
    const sf: number[] = []
    const sx: number[] = []
    const sy: number[] = []
    const su: number[] = []
    const sv: number[] = []
    const sl: number[] = []
    for (let i = 0; i < facets.length; i++) {
      const p = facets[i].poly
      const n = p.length
      for (let k = 0; k < n; k += 2) {
        const x0 = p[k]
        const y0 = p[k + 1]
        const x1 = p[(k + 2) % n]
        const y1 = p[(k + 3) % n]
        let dx = x1 - x0
        let dy = y1 - y0
        const len = Math.sqrt(dx * dx + dy * dy)
        if (!(len > JOIN_MIN)) continue
        dx /= len
        dy /= len
        // Canonical (unsigned) line: normal with a fixed sign, plus its offset.
        let nx = -dy
        let ny = dx
        if (nx < -EPS || (Math.abs(nx) <= EPS && ny < 0)) {
          nx = -nx
          ny = -ny
        }
        const key = (Math.round(nx * 2048) * 4093 + Math.round(ny * 2048)) * 8191 +
          Math.round((nx * x0 + ny * y0) * 32)
        const idx = sf.length
        sf.push(i); sx.push(x0); sy.push(y0); su.push(dx); sv.push(dy); sl.push(len)
        const arr = buckets.get(key)
        if (arr) arr.push(idx)
        else buckets.set(key, [idx])
      }
    }

    let n = 0
    const push = (a: number, b: number, x0: number, y0: number, x1: number, y1: number): void => {
      if (n >= this.joinA.length) {
        const a2 = new Int32Array(this.joinA.length * 2)
        a2.set(this.joinA)
        this.joinA = a2
        const b2 = new Int32Array(this.joinB.length * 2)
        b2.set(this.joinB)
        this.joinB = b2
        const m2 = new Float64Array(this.joinM.length * 2)
        m2.set(this.joinM)
        this.joinM = m2
      }
      this.joinA[n] = a
      this.joinB[n] = b
      this.joinM[n * 4] = x0
      this.joinM[n * 4 + 1] = y0
      this.joinM[n * 4 + 2] = x1
      this.joinM[n * 4 + 3] = y1
      n++
    }
    buckets.forEach((list) => {
      for (let a = 0; a < list.length; a++) {
        const ia = list[a]
        for (let b = a + 1; b < list.length; b++) {
          const ib = list[b]
          if (sf[ia] === sf[ib]) continue
          const ux = su[ia]
          const uy = sv[ia]
          const t0 = (sx[ib] - sx[ia]) * ux + (sy[ib] - sy[ia]) * uy
          const t1 = t0 + su[ib] * ux * sl[ib] + sv[ib] * uy * sl[ib]
          const lo = Math.max(0, Math.min(t0, t1))
          const hi = Math.min(sl[ia], Math.max(t0, t1))
          if (hi - lo < JOIN_MIN) continue
          push(
            sf[ia], sf[ib],
            sx[ia] + ux * lo, sy[ia] + uy * lo,
            sx[ia] + ux * hi, sy[ia] + uy * hi,
          )
        }
      }
    })
    this.joinN = n
  }

  /**
   * Measure the invariant: every shared edge still shared, in space.
   *
   * Cheap enough for a debug overlay and for the self-test; not something to
   * call inside the frame loop.
   */
  integrity(out: SheetIntegrity = emptyIntegrity()): SheetIntegrity {
    this.updateWorld()
    this.buildJoins()
    const facets = this.facets
    const nf = facets.length
    if (this.dsu.length < nf) this.dsu = new Int32Array(nf * 2)
    const dsu = this.dsu
    for (let i = 0; i < nf; i++) dsu[i] = i
    const find = (a: number): number => {
      let r = a
      while (dsu[r] !== r) r = dsu[r]
      while (dsu[a] !== r) {
        const nx = dsu[a]
        dsu[a] = r
        a = nx
      }
      return r
    }

    let severed = 0
    let maxGap = 0
    for (let k = 0; k < this.joinN; k++) {
      const a = this.joinA[k]
      const b = this.joinB[k]
      const ma = this.nodes[facets[a].node].world
      const mb = this.nodes[facets[b].node].world
      // Both ends of the shared edge: a hinge can pin one end and swing the other.
      let gap = 0
      for (let e = 0; e < 2; e++) {
        const x = this.joinM[k * 4 + e * 2]
        const y = this.joinM[k * 4 + e * 2 + 1]
        const dx = (ma[0] * x + ma[1] * y + ma[3]) - (mb[0] * x + mb[1] * y + mb[3])
        const dy = (ma[4] * x + ma[5] * y + ma[7]) - (mb[4] * x + mb[5] * y + mb[7])
        const dz = (ma[8] * x + ma[9] * y + ma[11]) - (mb[8] * x + mb[9] * y + mb[11])
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d > gap) gap = d
      }
      if (gap > JOIN_EPS) {
        severed++
        if (gap > maxGap) maxGap = gap
      } else {
        const ra = find(a)
        const rb = find(b)
        if (ra !== rb) dsu[ra] = rb
      }
    }

    let pieces = 0
    let degenerate = 0
    let nonFinite = 0
    let area = 0
    for (let i = 0; i < nf; i++) {
      if (find(i) === i) pieces++
      const f = facets[i]
      area += Math.abs(f.area)
      if (!(f.area > AREA_EPS)) degenerate++
      for (let k = 0; k < f.poly.length; k++) {
        const v = f.poly[k]
        if (!(v - v === 0)) nonFinite++
      }
    }
    out.severed = severed
    out.maxGap = maxGap
    out.pieces = nf === 0 ? 0 : pieces
    out.degenerate = degenerate
    out.nonFinite = nonFinite
    out.area = area
    out.joins = this.joinN
    return out
  }

  /**
   * The narrowest scope at or above `scope` that this crease can fold without
   * severing a join.
   *
   * Scoping a move too narrowly is the other way to tear paper: fold one layer
   * of a two-layer wing and the crease runs straight through the fold that
   * holds them together. Widening is always safe for the join — both sides then
   * turn as one — so walk outward until nothing is severed, and only then give
   * up and return the least bad option. Nothing here mutates the sheet; it is a
   * question asked before the cut, not a repair after it.
   */
  safeScope(crease: Crease, scope: number, exclude: number): number {
    orientAxis(crease, AXIS)
    const dx = AXIS[2] - AXIS[0]
    const dy = AXIS[3] - AXIS[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (!(len > 1e-3)) return scope
    this.buildLocalAxes(AXIS[0], AXIS[1], AXIS[2], AXIS[3], 0)
    this.buildJoins()
    const invLen = 1 / len


    let best = scope
    let bestCut = Infinity
    let n = scope
    let guard = 0
    for (;;) {
      const cut = this.severedBy(n, exclude, invLen)
      if (cut === 0) return n
      if (cut < bestCut) {
        bestCut = cut
        best = n
      }
      if (n < 0 || guard++ > 256) break
      n = n === 0 ? -1 : Math.max(0, this.nodes[n].parent)
    }
    return best
  }

  /**
   * How many joins a crease at this scope would sever. Pure.
   *
   * A shared edge is not one point: a crease can cross it, so each side of the
   * join travels along part of the edge and stays put along the rest. What has
   * to match is the whole *interval* that moves — sampling the middle alone
   * happily reports a clean fold while the far end of the edge is being torn.
   */
  private severedBy(scope: number, exclude: number, invLen: number): number {
    const facets = this.facets
    let cut = 0
    for (let k = 0; k < this.joinN; k++) {
      const a = facets[this.joinA[k]]
      const b = facets[this.joinB[k]]
      if (a.node === b.node) continue
      const o = k * 4
      const x0 = this.joinM[o]
      const y0 = this.joinM[o + 1]
      const x1 = this.joinM[o + 2]
      const y1 = this.joinM[o + 3]
      this.movingSpan(a, x0, y0, x1, y1, scope, exclude, invLen, SPAN_A)
      this.movingSpan(b, x0, y0, x1, y1, scope, exclude, invLen, SPAN_B)
      if (Math.abs(SPAN_A[0] - SPAN_B[0]) > SPAN_EPS || Math.abs(SPAN_A[1] - SPAN_B[1]) > SPAN_EPS) cut++
    }
    return cut
  }

  /** The fraction of this shared edge that travels with the fold, as [t0, t1]. */
  private movingSpan(
    f: Facet, x0: number, y0: number, x1: number, y1: number,
    scope: number, exclude: number, invLen: number, out: Float64Array,
  ): void {
    out[0] = 0
    out[1] = 0
    if (!this.isInSubtree(f.node, scope)) return
    if (exclude >= 0 && this.isInSubtree(f.node, exclude)) return
    const o = f.node * AX
    if (this.laxis[o + 5] === 0) return
    const ax = this.laxis[o]
    const ay = this.laxis[o + 1]
    const bx = this.laxis[o + 2]
    const by = this.laxis[o + 3]
    const d0 = sideDist(x0, y0, ax, ay, bx, by, invLen)
    const d1 = sideDist(x1, y1, ax, ay, bx, by, invLen)
    const m0 = d0 > ON_LINE
    const m1 = d1 > ON_LINE
    if (m0 && m1) {
      out[1] = 1
      return
    }
    if (!m0 && !m1) return
    const t = clamp(d0 / (d0 - d1), 0, 1)
    if (m0) out[1] = t
    else {
      out[0] = t
      out[1] = 1
    }
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
  group = 0,
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
    group,
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
