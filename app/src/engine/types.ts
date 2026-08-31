// PAPER PLANET — engine internal types: facets, the fold tree, lighting and the frame plan.

import type { FoldKind, PaperMaterial, Vec2 } from '../contracts'
import type { Mat34 } from './geom'

/** The flat sheet is a 1000 x 1000 square of material space, centred on the origin. */
export const SHEET = 1000
export const HALF = SHEET / 2

/** Micro-thickness of one sheet of paper, in model units (1/2000 of the sheet). */
export const THICKNESS = 0.5

/**
 * A single planar face of the subdivision.
 *
 * `poly` lives in *model-plane* coordinates: material (u, v) mapped to
 * (u - 500, v - 500). x runs right, y runs DOWN (screen convention) and z comes
 * out of the sheet toward the viewer. Every fold-tree node shares this local
 * frame, which is what makes "rotate about the material crease line" compose
 * correctly through arbitrarily deep fold chains.
 */
export interface Facet {
  id: string
  /** Flat [x0, y0, x1, y1, ...], wound for positive signed area. */
  poly: number[]
  /** Index into Sheet.nodes. */
  node: number
  /** Stacking order right now. Higher = further up the stack. */
  layer: number
  /** Stacking order once the in-flight fold lies flat. Equal to `layer` at rest. */
  layerFlat: number
  /** Cached material area (never changes for a given polygon). */
  area: number
  /** Cached model-plane centroid. */
  cx: number
  cy: number
  /** Distance from the centroid to this facet's own hinge axis — drives fold-root AO. */
  rootDist: number
  /** Bend strips for the in-flight fold, or null. Rebuilt once per step, not per frame. */
  strips: BendStrip[] | null
  /** Fan subdivision for an in-flight inflate, or null. */
  fan: InflateFan | null
}

/** One strip of a bending flap: a slice of a facet between two lines parallel to the axis. */
export interface BendStrip {
  poly: number[]
  /** Normalised distance from the hinge for each vertex, parallel to `poly`. */
  s: Float64Array
  /** Pre-built render id — built once, never allocated in the frame loop. */
  id: string
}

/** A centre-fan subdivision used to give an inflated facet visible curvature. */
export interface InflateFan {
  /** Triangles as flat [x0,y0,x1,y1,x2,y2]. */
  tris: number[][]
  /** Bulge weight per triangle vertex, parallel to `tris`. */
  w: Float64Array[]
  /** Pre-built render ids, parallel to `tris`. */
  ids: string[]
  /** Signed amplitude scale: which way this facet balloons, and how far. */
  dir: number
}

/** A node of the fold tree. Its local frame is model-plane space (see Facet). */
export interface FoldNode {
  parent: number
  depth: number
  /** Hinge axis in the node's own local frame. */
  ax: number
  ay: number
  bx: number
  by: number
  /** Current signed rotation about the hinge, radians. */
  angle: number
  /** The angle this node settles at when its step commits. */
  rest: number
  kind: FoldKind
  /** 0..1 progressive bow of the flap hanging off this hinge. */
  bow: number
  /** True while this node belongs to the step currently in flight. */
  inFlight: boolean
  /**
   * Which crease made this hinge. One crease through N layers spawns N sibling
   * hinges that are one physical fold, and anything that later re-opens that
   * fold — a `pull` drawing a wing out — has to move all of them or the layers
   * come apart in the player's hands. 0 means "not from a crease".
   */
  group: number
  local: Mat34
  world: Mat34
  dirty: boolean
}

/** Directional key light plus hemispheric fill, in world space. */
export interface Lighting {
  /** Strength of the directional key, from --light-key. */
  key: number
  /** Strength of the hemispheric fill, from --light-fill. */
  fill: number
  /** Specular sheen band strength, from --light-sheen. */
  sheen: number
  /** Ambient-occlusion strength at fold roots, from --light-ao. */
  ao: number
  /** Unit direction *toward* the key light. */
  lx: number
  ly: number
  lz: number
  /** Constant ambient floor so nothing crushes to black. */
  ambient: number
}

export function defaultLighting(): Lighting {
  // Up-left-front, matching the warm lamp the brand describes. y is DOWN.
  const l = 1 / Math.sqrt(0.42 * 0.42 + 0.66 * 0.66 + 0.62 * 0.62)
  return {
    key: 0.82,
    fill: 0.34,
    sheen: 0.22,
    ao: 0.3,
    lx: -0.42 * l,
    ly: -0.66 * l,
    lz: 0.62 * l,
    ambient: 0.3,
  }
}

/** Resolved paper colours as linear-ish 0..1 rgb triples. */
export interface PaperColors {
  fr: number
  fg: number
  fb: number
  br: number
  bg: number
  bb: number
  foil: number
  source: PaperMaterial
}

/** How one authored step is played out over its 0..1 progress. */
export interface StepPlan {
  kind: FoldKind
  /** Nodes created (or re-targeted) by this step. */
  nodes: number[]
  /** Angle each node starts from, radians. Non-zero when a `pull` re-opens a hinge. */
  from: number[]
  /** Angle each node settles at, radians. */
  rest: number[]
  /** Sub-progress window [start, end] within the step — this is what staggers a petal. */
  win0: number[]
  win1: number[]
  /** Per-node bow multiplier; a long flap flops more than a short one. */
  bowScale: number[]
  /** Peak bow strength for this gesture. */
  bow: number
  /** Whole-model transform driven by this step. */
  model: 'none' | 'flip' | 'rotate'
  modelAngle: number
  /** Inflation target for this step, 0..1. */
  inflate: number
  /** Press flattens residual bend and compacts the layer stack. */
  press: boolean
  /** Subtree layer inversion (inside-reverse tucks the tip between the layers). */
  invertLayers: boolean
  /** Subtrees to raise to the top of the stack on commit (a `pull`). */
  raise: number[]
  hint: { from: Vec2; to: Vec2 } | null
  targets: readonly Vec2[]
  /** The step's guide axis, in material space. */
  axisFrom: Vec2 | null
  axisTo: Vec2 | null
}
