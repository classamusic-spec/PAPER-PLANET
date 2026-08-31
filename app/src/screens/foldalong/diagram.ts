/* PAPER PLANET — Fold Along: the diagrams.

   A diagram is not a screenshot of the game. It is the model seen straight
   down, flat, in ink — the view origami has used since Yoshizawa, because it is
   the one you can copy with paper in your hands.

   We do not draw it by hand. The engine already computes the exact folded
   geometry, so we point it straight down (pitch 0 — a flat sheet projects to a
   perfect square there) and take the polygons it emits. That means a diagram
   cannot drift from the fold it describes: they are the same computation.

   Each plate shows the state BEFORE its fold, with the crease to make and the
   arrow that makes it — which is what a diagram is. One trailing plate shows
   the finished model.

   See docs/ORIGAMI.md §4.2 and §4.4. */

import type { Crease, FoldRecipe, FoldStep, PaperMaterial, Vec2 } from '../../contracts'
import { Fold3D } from '../../engine'
import { landmarkFor, principal, type Landmark } from '../../content/landmarks'

/** The Yoshizawa–Randlett arrows we draw. */
export type ArrowKind =
  /** Split-headed: fold toward you. */
  | 'valley'
  /** Hollow, hooked: fold away. */
  | 'mountain'
  /** A loop in the stem: turn the model over. */
  | 'turn'
  /** Circled: rotate on the desk. */
  | 'rotate'
  /** Hollow-stemmed: push here — a sink, a reverse. */
  | 'push'
  /** Open circle: hold, and press. */
  | 'hold'
  /** Double-headed hollow: fold it, then open it again. */
  | 'unfold'

export interface DiagramFacet {
  /** SVG `points`, in the plate's own coordinates. */
  pts: string
  /** True when the reverse of the paper faces you — the colour reference. */
  back: boolean
  depth: number
}

export interface DiagramPlate {
  /** 1-based, as printed. */
  n: number
  step: FoldStep | null
  facets: DiagramFacet[]
  /**
   * The crease to make, in notation. Absent when the step lays none.
   *
   * `under` is the colour of the paper the line runs over. A crease that has
   * not been folded yet is not an edge, but the engine has already tessellated
   * the sheet along it, so a solid facet outline sits exactly where the dashed
   * line belongs — and a solid line there says "already folded", which is the
   * opposite of what this step is asking for. Painting the paper colour back in
   * under the dashes erases that outline and leaves the notation honest.
   */
  crease: { from: Vec2; to: Vec2; direction: 'valley' | 'mountain'; under: string } | null
  /** Where the paper goes. */
  arrow: { from: Vec2; to: Vec2; kind: ArrowKind } | null
  /** Spots to tap or hold. */
  marks: Vec2[]
  landmark: Landmark | null
  /**
   * Which way the plate is seen. Straight down is the diagram default, but a
   * model folded in half stands on its edge and a top-down view of it is a
   * line. Books turn the page's viewpoint when that happens; so do we, and we
   * say so, because a reader who does not know the view has changed will fold
   * the wrong thing.
   */
  view: 'flat' | 'angled'
  /** Which side is facing you, counted over the visible area. */
  facing: 'front' | 'back' | 'both'
}

export interface DiagramSet {
  plates: DiagramPlate[]
  /** The shared viewBox — one scale for the whole sequence, as a book uses. */
  viewBox: string
}

/** The plate's internal drawing size. Arbitrary; the viewBox does the fitting. */
const CANVAS = 1000

/**
 * Straight down at the desk. At pitch 0 a flat square projects to a flat
 * square — measured, not assumed — which is the whole requirement of a diagram.
 */
const FLAT = { yaw: 0, pitch: 0, zoom: 1, roll: 0 } as const

/** The three-quarter view a book turns to when the flat one stops informing. */
const ANGLED = { yaw: 22, pitch: 34, zoom: 1, roll: 0 } as const

/**
 * Below this solidity — silhouette area over its own bounding box — the view
 * has collapsed onto the model's edge and is telling the reader nothing.
 *
 * Solidity, not size. A model folded twice is legitimately a quarter of the
 * sheet and perfectly readable; a model folded in half and stood on its edge is
 * a diagonal sliver with a large box. Measured across the corpus the two do not
 * overlap: readable shapes sit at 0.49-1.00 (a triangle is 0.51, a frog base
 * 0.50), edge-on ones at 0.15-0.32. The line goes in the gap.
 */
const EDGE_ON = 0.4

/**
 * A crease shorter than this on screen has been seen edge-on and projected to
 * a dot. A plate whose fold line is a dot is a plate with no instruction on it,
 * so it takes the turned view too.
 */
const MIN_CREASE_PX = 24

/**
 * An arrow shorter than this on screen is not an arrow.
 *
 * A step's two hint anchors are material points and a previous fold can carry
 * them onto each other, exactly as it can a crease's endpoints — 41 of the
 * corpus's 308 plates drew nothing at all. A plate with a fold line and no
 * motion does not say which way the paper goes, which is the one thing the
 * arrow is there for.
 */
const MIN_ARROW_PX = 46

/**
 * Which arrow a step asks for.
 *
 * `direction` is the direction of the crease actually being drawn. It matters
 * because for several kinds the way the paper goes is NOT in the kind's name: a
 * pinch, a petal and a pull can each be a mountain, and falling through to the
 * valley arrow drew a solid valley head over a dash-dot mountain line — a plate
 * that contradicts itself, which is worse than a plate with no arrow.
 */
function arrowFor(step: FoldStep, direction: 'valley' | 'mountain' | null): ArrowKind {
  switch (step.kind) {
    case 'flip':
      return 'turn'
    case 'rotate':
      return 'rotate'
    case 'press':
      return 'hold'
    case 'reverse':
    case 'squash':
    case 'inflate':
      return 'push'
    case 'mountain':
      return 'mountain'
    // A pre-crease is folded and opened again, so it takes the unfold arrow —
    // the line style already says which way it was folded.
    case 'crease':
      return 'unfold'
    case 'valley':
      return 'valley'
    default:
      // pinch, petal, pull: a fold, whose direction is in the crease.
      return direction === 'mountain' ? 'mountain' : 'valley'
  }
}

/**
 * Which side of the paper you are looking at.
 *
 * Counted over the top layer only, not the whole model. A flat-folded shape
 * seen from above has back-facing facets underneath every fold, so a census of
 * all of them says "both" from step three onward and tells the reader nothing.
 * What they can see is what is on top.
 */
function facingOf(facets: DiagramFacet[]): DiagramPlate['facing'] {
  if (facets.length === 0) return 'front'
  let top = -Infinity
  for (const f of facets) if (f.depth > top) top = f.depth
  // The top layer, plus anything within a hair of it — coplanar siblings.
  const band = 1e-3
  let front = 0
  let back = 0
  for (const f of facets) {
    if (f.depth < top - band) continue
    if (f.back) back++
    else front++
  }
  return front > 0 && back > 0 ? 'both' : back > front ? 'back' : 'front'
}

/**
 * The crease line, found by walking it.
 *
 * Samples the material crease across the sheet and keeps the longest stretch
 * that lands on paper without jumping or bending. Points off the model simply do not project, so
 * the line clips itself to the shape. `reach` is the model's on-screen size,
 * which sets how far apart two samples may be before they count as different
 * pieces of paper rather than one line.
 */
function sampleCrease(engine: Fold3D, c: Crease, reach: number): { from: Vec2; to: Vec2 } | null {
  /* Walk the crease across the SHEET, not past it.
     An axis is an infinite line and the recipe's two endpoints are just points
     on it, so the walk has to extend past them — but only as far as the paper
     goes. project() extrapolates happily off the sheet and hands back screen
     positions for material that does not exist, which is how a fold line ends
     up drawn out over the desk. Clipping first is the whole fix. */
  const seg = clipToSquare(c.a, c.b)
  if (!seg) return null
  const dx = seg[1][0] - seg[0][0]
  const dy = seg[1][1] - seg[0][1]
  if (Math.hypot(dx, dy) < 1e-6) return null

  const N = 60
  const got: (Vec2 | null)[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    got.push(engine.project([seg[0][0] + dx * t, seg[0][1] + dy * t]))
  }

  /* Keep the longest run that is both unbroken AND straight.
     A material crease on a folded model is not a line on screen: it bends at
     every fold it crosses and can reappear on a layer somewhere else entirely.
     Joining the two samples furthest apart therefore draws a line across empty
     desk, and joining merely-adjacent ones draws a dogleg. A run that neither
     jumps nor turns is a segment lying flat on one piece of visible paper,
     which is what a fold line looks like. */
  const JUMP = reach * 0.08
  const STRAIGHT = Math.cos(6 * (Math.PI / 180))

  let best: { from: Vec2; to: Vec2 } | null = null
  let bestLen = MIN_CREASE_PX
  let start = -1
  let ux = 0
  let uy = 0

  const close = (end: number): void => {
    if (start < 0 || end <= start) return
    const a = got[start]!
    const z = got[end]!
    const len = Math.hypot(z[0] - a[0], z[1] - a[1])
    if (len > bestLen) {
      bestLen = len
      best = { from: a, to: z }
    }
  }

  for (let i = 0; i < got.length; i++) {
    const p = got[i]
    if (p === null) {
      close(i - 1)
      start = -1
      continue
    }
    if (start < 0) {
      start = i
      ux = 0
      uy = 0
      continue
    }
    const prev = got[i - 1]!
    const sx = p[0] - prev[0]
    const sy = p[1] - prev[1]
    const step = Math.hypot(sx, sy)
    if (step > JUMP) {
      close(i - 1)
      start = i
      ux = 0
      uy = 0
      continue
    }
    if (step < 1e-6) continue
    const nx = sx / step
    const ny = sy / step
    if (ux !== 0 || uy !== 0) {
      if (nx * ux + ny * uy < STRAIGHT) {
        // The line turned: this is a different facet, and a new segment.
        close(i - 1)
        start = i - 1
        ux = nx
        uy = ny
        continue
      }
    }
    ux = nx
    uy = ny
  }
  close(got.length - 1)
  return best
}

/** Which face of the paper lies under a point: the topmost facet containing it. */
function paperAt(facets: DiagramFacet[], x: number, y: number): string {
  let best: DiagramFacet | null = null
  for (const f of facets) {
    if ((best === null || f.depth >= best.depth) && contains(f.pts, x, y)) best = f
  }
  return best ? (best.back ? 'back' : 'front') : 'front'
}

/** Even–odd point-in-polygon over a screen-space ring. */
function inPoly(pts: readonly Vec2[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ay = pts[i][1]
    const by = pts[j][1]
    if (ay > y !== by > y && x < ((pts[j][0] - pts[i][0]) * (y - ay)) / (by - ay) + pts[i][0]) {
      inside = !inside
    }
  }
  return inside
}

/** Even–odd point-in-polygon over an SVG `points` string. */
function contains(pts: string, x: number, y: number): boolean {
  const nums = pts.split(' ')
  let inside = false
  for (let i = 0, j = nums.length - 1; i < nums.length; j = i++) {
    const a = nums[i].split(',')
    const b = nums[j].split(',')
    const ax = +a[0]
    const ay = +a[1]
    const bx = +b[0]
    const by = +b[1]
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
  }
  return inside
}

/**
 * Build every plate for a recipe.
 *
 * One projection for the whole set: the scale is fixed by the union of every
 * state, so the model never jumps size between plates and nothing clips. That
 * is the convention in printed diagrams, and it is also the only way a reader
 * can see the paper getting smaller as it folds.
 */
export function buildDiagrams(recipe: FoldRecipe, material: PaperMaterial): DiagramSet {
  const engine = new Fold3D()
  engine.reset(recipe, material)
  engine.setCamera(FLAT)
  engine.fit(CANVAS, CANVAS, 0.94, 0)
  engine.setShadows(false)

  const plates: DiagramPlate[] = []
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity

  const take = (n: number, step: FoldStep | null, view: 'flat' | 'angled'): void => {
    const f = engine.render()
    const facets: DiagramFacet[] = []
    for (const rf of f.facets) {
      // A null stroke marks a tessellation seam, which is not a paper edge.
      if (rf.stroke === null) continue
      let pts = ''
      for (const p of rf.points) {
        pts += `${p[0].toFixed(1)},${p[1].toFixed(1)} `
        if (p[0] < x0) x0 = p[0]
        if (p[0] > x1) x1 = p[0]
        if (p[1] < y0) y0 = p[1]
        if (p[1] > y1) y1 = p[1]
      }
      facets.push({ pts: pts.trim(), back: rf.isBack, depth: rf.depth })
    }
    facets.sort((a, b) => a.depth - b.depth)

    /* The direction of the crease we are actually drawing.
       This used to read creases[0] while the geometry came from the longest
       crease, so on a step that lays several — the classical collapses lay four
       — the dashes could be describing a different fold from the line under
       them. Both now come from the same crease. */
    const principalCrease = step ? principal(step.creases) : null
    const dir = principalCrease?.direction ?? null

    /* Where the fold line falls on the model — walked, not taken from the frame.
       `frame.axis` is the projection of the crease's two authored endpoints,
       and neither endpoint is trustworthy for a drawing. They can be carried
       onto each other by a previous fold, leaving an axis that is a dot from
       every camera (the crane's mountain does exactly this). And they are
       frequently outside the sheet altogether — a shaping crease is authored as
       a long line through the paper, so its named ends are off the page. Both
       print a fold line that is not where the fold is. Walking the crease
       across the sheet answers with paper the reader can actually see. */
    const authored = step?.creases[0]
    let axis = authored ? sampleCrease(engine, authored, modelReach()) : null
    if (
      !axis &&
      f.axis &&
      Math.hypot(f.axis.to[0] - f.axis.from[0], f.axis.to[1] - f.axis.from[1]) >= MIN_CREASE_PX
    ) {
      axis = { from: [f.axis.from[0], f.axis.from[1]], to: [f.axis.to[0], f.axis.to[1]] }
    }

    /* A pre-crease's authored hint runs ALONG the crease — it is telling a
       finger where to rub, which is a gesture instruction, not a diagram one.
       On paper you fold the sheet over that line and open it again, so the
       arrow has to cross the line, not follow it. Synthesise that. */
    let arrow = step && f.hint
      ? {
          from: [f.hint.from[0], f.hint.from[1]] as Vec2,
          to: [f.hint.to[0], f.hint.to[1]] as Vec2,
          kind: arrowFor(step, dir),
        }
      : null
    /* Rescue an arrow that projected onto a point.
       Across the crease for anything that folds — that is the motion, and it
       is the same construction a pre-crease uses. For the model moves (turn
       over, rotate, press) there is no crease to cross, so the arrow spans the
       model itself, which is what those symbols describe anyway. */
    const arrowSpan = arrow
      ? Math.hypot(arrow.to[0] - arrow.from[0], arrow.to[1] - arrow.from[1])
      : 0
    if (step && arrowSpan < MIN_ARROW_PX) {
      const kind = arrowFor(step, dir)
      if (axis) {
        const dx = axis.to[0] - axis.from[0]
        const dy = axis.to[1] - axis.from[1]
        const len = Math.hypot(dx, dy)
        if (len > 1) {
          const mx = (axis.from[0] + axis.to[0]) / 2
          const my = (axis.from[1] + axis.to[1]) / 2
          const r = Math.max(MIN_ARROW_PX * 0.6, len * 0.28)
          arrow = {
            from: [mx + (-dy / len) * r, my + (dx / len) * r],
            to: [mx - (-dy / len) * r, my - (dx / len) * r],
            kind,
          }
        }
      } else {
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (const rf of f.facets) {
          for (const p of rf.points) {
            if (p[0] < x0) x0 = p[0]
            if (p[0] > x1) x1 = p[0]
            if (p[1] < y0) y0 = p[1]
            if (p[1] > y1) y1 = p[1]
          }
        }
        if (Number.isFinite(x0) && x1 - x0 > 1) {
          const cy = (y0 + y1) / 2
          const inset = (x1 - x0) * 0.16
          arrow = { from: [x0 + inset, cy], to: [x1 - inset, cy], kind }
        }
      }
    }

    if (step && step.kind === 'crease' && axis) {
      const ax = axis
      const dx = ax.to[0] - ax.from[0]
      const dy = ax.to[1] - ax.from[1]
      const len = Math.hypot(dx, dy)
      if (len > 1) {
        const mx = (ax.from[0] + ax.to[0]) / 2
        const my = (ax.from[1] + ax.to[1]) / 2
        const r = len * 0.3
        arrow = {
          from: [mx + (-dy / len) * r, my + (dx / len) * r],
          to: [mx - (-dy / len) * r, my - (dx / len) * r],
          kind: 'unfold',
        }
      }
    }
    plates.push({
      n,
      step,
      facets,
      crease:
        step && axis && dir
          ? {
              from: axis.from,
              to: axis.to,
              direction: dir,
              under: paperAt(facets, (axis.from[0] + axis.to[0]) / 2, (axis.from[1] + axis.to[1]) / 2),
            }
          : null,
      arrow,
      marks: f.targets.map((t) => [t[0], t[1]] as Vec2),
      landmark: step ? landmarkFor(step) : null,
      facing: facingOf(facets),
      view,
    })
  }

  /**
   * How solid the silhouette is: the share of its own bounding box that is paper.
   *
   * Not the sum of the facets — a model eight layers thick sums to eight times
   * its own outline, so a stack of slivers measures larger than the flat sheet
   * it came from. What matters is the shape you can actually see, so this
   * samples the projection on a grid and counts what is covered. Coarse, but
   * it is answering a coarse question: is there still a picture here?
   */
  /** The model's on-screen size — the diagonal of what is drawn. */
  const modelReach = (): number => {
    const f = engine.render()
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const rf of f.facets) {
      for (const p of rf.points) {
        if (p[0] < x0) x0 = p[0]
        if (p[0] > x1) x1 = p[0]
        if (p[1] < y0) y0 = p[1]
        if (p[1] > y1) y1 = p[1]
      }
    }
    return Number.isFinite(x0) ? Math.hypot(x1 - x0, y1 - y0) : 1000
  }

  const solidity = (): number => {
    const f = engine.render()
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const rf of f.facets) {
      for (const p of rf.points) {
        if (p[0] < x0) x0 = p[0]
        if (p[0] > x1) x1 = p[0]
        if (p[1] < y0) y0 = p[1]
        if (p[1] > y1) y1 = p[1]
      }
    }
    if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return 0
    const N = 48
    const dx = (x1 - x0) / N
    const dy = (y1 - y0) / N
    let hit = 0
    for (let iy = 0; iy < N; iy++) {
      const py = y0 + (iy + 0.5) * dy
      for (let ix = 0; ix < N; ix++) {
        const px = x0 + (ix + 0.5) * dx
        for (const rf of f.facets) {
          if (inPoly(rf.points, px, py)) {
            hit++
            break
          }
        }
      }
    }
    return hit / (N * N)
  }

  /* seekStep rebuilds the whole model at that index, so it is the only move
     needed — and it does NOT refit, which is what keeps one scale across the
     set. It does apply the step's authored camera, though: that pose is staged
     for the game, and on a diagram it turns the square sheet into a trapezoid.
     So the flat pose goes back on after every seek. */
  /**
   * How long the step's crease comes out on screen, from where we stand —
   * counting the walked line rather than the authored endpoints, so a plate is
   * not turned for a crease we can perfectly well recover.
   */
  const creaseLength = (step: FoldStep | null): number => {
    const authored = step?.creases[0]
    if (!authored) return Infinity
    const walked = sampleCrease(engine, authored, modelReach())
    if (walked) return Math.hypot(walked.to[0] - walked.from[0], walked.to[1] - walked.from[1])
    const ax = engine.render().axis
    return ax ? Math.hypot(ax.to[0] - ax.from[0], ax.to[1] - ax.from[1]) : 0
  }

  const plate = (n: number, step: FoldStep | null): void => {
    engine.setCamera(FLAT)
    engine.setProgress(0)
    // Two ways the flat view can fail the reader: the model goes edge-on, or
    // the crease does. Either one, and the page turns its viewpoint.
    if (solidity() < EDGE_ON || creaseLength(step) < MIN_CREASE_PX) {
      engine.setCamera(ANGLED)
      take(n, step, 'angled')
    } else {
      take(n, step, 'flat')
    }
  }

  for (let i = 0; i < recipe.steps.length; i++) {
    engine.seekStep(i)
    plate(i + 1, recipe.steps[i])
  }
  // The last plate: what you have made. Always staged — a finished model is a
  // thing you look at, not a construction you read.
  engine.seekStep(recipe.steps.length)
  engine.setCamera(ANGLED)
  take(recipe.steps.length + 1, null, 'angled')

  if (!Number.isFinite(x0)) {
    x0 = 0
    y0 = 0
    x1 = CANVAS
    y1 = CANVAS
  }
  // A little air, and a square box so every plate sits the same on the page.
  const pad = Math.max(x1 - x0, y1 - y0) * 0.07
  const side = Math.max(x1 - x0, y1 - y0) + pad * 2
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return {
    plates,
    viewBox: `${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`,
  }
}

/** Which side up, said the way a diagram says it: by colour, never by direction. */
export function facingNote(facing: DiagramPlate['facing']): string {
  switch (facing) {
    case 'front':
      return 'Coloured side up.'
    case 'back':
      return 'White side up.'
    default:
      return 'Both sides showing.'
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CREASE PATTERN

   Every crease the recipe lays, on the flat sheet. Unfold a finished model and
   this is what you get — the picture a folder uses to see the whole design at
   once, and the thing that makes the printable page worth keeping.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CreaseLine {
  a: Vec2
  b: Vec2
  direction: 'valley' | 'mountain'
}

/** The sheet is 1000 square in material space. */
export const CP_SIDE = 1000

/** Deduplicated: the same line laid twice is one crease. */
export function buildCreasePattern(recipe: FoldRecipe): CreaseLine[] {
  const out: CreaseLine[] = []
  const seen = new Set<string>()
  for (const step of recipe.steps) {
    for (const c of step.creases) {
      // Clip the infinite axis to the sheet, so the picture is the sheet.
      const seg = clipToSquare(c.a, c.b)
      if (!seg) continue
      const key =
        [seg[0][0], seg[0][1], seg[1][0], seg[1][1]]
          .map((n) => Math.round(n * 4) / 4)
          .join(',') + c.direction
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ a: seg[0], b: seg[1], direction: c.direction })
    }
  }
  return out
}

/** Where the infinite line a→b crosses the sheet, or null if it misses it. */
function clipToSquare(a: Vec2, b: Vec2): [Vec2, Vec2] | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null
  // Liang–Barsky against 0..CP_SIDE, on the infinite line.
  let t0 = -Infinity
  let t1 = Infinity
  const edges: [number, number][] = [
    [-dx, a[0]],
    [dx, CP_SIDE - a[0]],
    [-dy, a[1]],
    [dy, CP_SIDE - a[1]],
  ]
  for (const [p, q] of edges) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 - t0 < 1e-6) return null
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ]
}
