/* PAPER PLANET — the fold vocabulary: material-space geometry, the classical bases, step builders. */

import type {
  CameraPose,
  Crease,
  FoldKind,
  FoldRecipe,
  FoldStep,
  GestureKind,
  Vec2,
} from '../contracts'

/* ═══════════════════════════════════════════════════════════════════════════
   MATERIAL SPACE

   Every crease lives on the flat, unfolded sheet: a 1000x1000 square with
   (0,0) top-left and y increasing downward (the SVG convention).

        TL(0,0) ───── MT ───── TR(1000,0)
           │                      │
           ML          C          MR
           │                      │
        BL(0,1000) ─── MB ───── BR(1000,1000)

   THE SIDE CONVENTION (contracts.ts §1): a point p lies on the moving
   half-plane iff  sign( (b-a) x (p-a) ) === side,  where the 2-D cross product
   is  (b-a).x*(p-a).y - (b-a).y*(p-a).x.

   `side` is never written by hand anywhere in this corpus. `crease(a, b, moves)`
   derives it from the point that is supposed to travel, so a crease cannot be
   authored with the wrong half moving. Get that one function right and every
   crease in the roster is right.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The side of the material square. */
export const SQ = 1000

/** 1000·(√2−1) = 414.214 — where a 22.5° crease from a corner meets the far edge. */
export const Q = SQ * (Math.SQRT2 - 1)
/** 500/√2 = 353.553 — where a 22.5° ridge meets the blintz square. */
export const RIDGE_LONG = 500 * Math.SQRT1_2
/** 500 − 353.553 = 146.447 — its short ordinate. */
export const RIDGE_SHORT = 500 - RIDGE_LONG
/** 500·√2 = 707.107 — the waist of a fish base. */
export const WAIST = 500 * Math.SQRT2

/** Named landmarks. Everything in the corpus is built from these. */
export const PT = {
  /* corners */
  TL: [0, 0],
  TR: [SQ, 0],
  BR: [SQ, SQ],
  BL: [0, SQ],
  /* edge midpoints — the blintz square */
  MT: [500, 0],
  MR: [SQ, 500],
  MB: [500, SQ],
  ML: [0, 500],
  C: [500, 500],
  /* quarter lines */
  QT: [500, 250],
  QB: [500, 750],
  QL: [250, 500],
  QR: [750, 500],
  /* 22.5° landmarks: a kite crease from TL meets the right edge at RQ,
     the bottom edge at BQ; the mirrors from BR are LQ and TQ. */
  RQ: [SQ, Q],
  BQ: [Q, SQ],
  LQ: [0, SQ - Q],
  TQ: [SQ - Q, 0],
  /* the two waists of a fish base (both lie on the TR–BL diagonal) */
  W1: [WAIST, SQ - WAIST],
  W2: [SQ - WAIST, WAIST],
  /* bird-base ridge feet, where the 22.5°/67.5° creases meet the blintz square */
  RIDGE_TL_A: [RIDGE_LONG, RIDGE_SHORT],
  RIDGE_TL_B: [RIDGE_SHORT, RIDGE_LONG],
  RIDGE_BR_A: [SQ - RIDGE_LONG, SQ - RIDGE_SHORT],
  RIDGE_BR_B: [SQ - RIDGE_SHORT, SQ - RIDGE_LONG],
  RIDGE_TR_A: [SQ - RIDGE_LONG, RIDGE_SHORT],
  RIDGE_TR_B: [SQ - RIDGE_SHORT, RIDGE_LONG],
  RIDGE_BL_A: [RIDGE_LONG, SQ - RIDGE_SHORT],
  RIDGE_BL_B: [RIDGE_SHORT, SQ - RIDGE_LONG],
  /* quarter grid, for the windmill */
  Q1: [250, 250],
  Q2: [750, 250],
  Q3: [750, 750],
  Q4: [250, 750],
} as const satisfies Record<string, Vec2>

/* ── vector helpers ──────────────────────────────────────────────────────── */

/** 2-D cross product of (b−a) and (p−a). Sign says which half-plane p is in. */
export function cross(a: Vec2, b: Vec2, p: Vec2): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
}

/** Mirror a point across the infinite line a→b. */
export function reflect(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  const px = a[0] + t * dx
  const py = a[1] + t * dy
  return [2 * px - p[0], 2 * py - p[1]]
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Move a point along the direction a→b (unit-normalised) by `d`. */
export function along(p: Vec2, a: Vec2, b: Vec2, d: number): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  return [p[0] + (dx / len) * d, p[1] + (dy / len) * d]
}

/** The line through `p` perpendicular to a→b, returned as two far-apart points. */
export function perpAt(p: Vec2, a: Vec2, b: Vec2, reach = 700): [Vec2, Vec2] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  return [
    [p[0] - nx * reach, p[1] - ny * reach],
    [p[0] + nx * reach, p[1] + ny * reach],
  ]
}

/* ── the crease constructor ──────────────────────────────────────────────── */

/**
 * Build a crease from its axis plus **the point that must travel**.
 * The `side` sign is derived, never guessed. Throws if `moves` sits on the axis,
 * which would make "which half moves" meaningless.
 */
export function crease(
  a: Vec2,
  b: Vec2,
  moves: Vec2,
  direction: 'valley' | 'mountain',
  angle: number,
): Crease {
  if (a[0] === b[0] && a[1] === b[1]) {
    throw new Error(`crease: axis endpoints coincide at [${a.join(',')}]`)
  }
  const s = cross(a, b, moves)
  if (s === 0) {
    throw new Error(`crease: moving point [${moves.join(',')}] lies on axis [${a.join(',')}]→[${b.join(',')}]`)
  }
  return { a, b, side: s > 0 ? 1 : -1, direction, angle }
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEPS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Which gestures may drive which fold kinds. Enforced by `__selftest.ts`. */
export const GESTURE_FOR: Record<FoldKind, readonly GestureKind[]> = {
  valley: ['drag', 'swipe'],
  mountain: ['drag', 'swipe'],
  crease: ['rub'],
  pinch: ['pinch-in', 'pinch-out'],
  squash: ['pinch-out', 'drag'],
  petal: ['drag', 'pinch-out'],
  reverse: ['tap', 'drag'],
  pull: ['drag', 'pinch-out'],
  flip: ['swipe'],
  rotate: ['twist'],
  press: ['hold'],
  inflate: ['pinch-out', 'hold'],
}

/** Kinds that legitimately create no new crease — they move the model, not the paper. */
export const CREASELESS: readonly FoldKind[] = ['flip', 'rotate', 'press', 'pull', 'inflate']

/** Kinds a beginner should not meet until they have folded a few simple things. */
export const ADVANCED_KINDS: readonly FoldKind[] = ['reverse', 'petal', 'squash', 'inflate']

export const CAM = {
  desk: { yaw: 0, pitch: 42, zoom: 1, roll: 0 },
  close: { pitch: 34, zoom: 1.28 },
  wide: { pitch: 48, zoom: 0.92 },
  side: { yaw: 26, pitch: 30, zoom: 1.1 },
  detail: { yaw: -18, pitch: 24, zoom: 1.45 },
  low: { pitch: 16, zoom: 1.12 },
} as const satisfies Record<string, Partial<CameraPose>>

export interface StepOpts {
  instruction: string
  detail?: string
  camera?: Partial<CameraPose>
  effort?: 1 | 2 | 3
  hint?: { from: Vec2; to: Vec2 }
  targets?: Vec2[]
}

function build(
  id: string,
  kind: FoldKind,
  gesture: GestureKind,
  creases: Crease[],
  hint: { from: Vec2; to: Vec2 },
  o: StepOpts,
): FoldStep {
  const step: FoldStep = {
    id,
    kind,
    gesture,
    creases,
    hint: o.hint ?? hint,
    instruction: o.instruction,
  }
  if (o.detail !== undefined) step.detail = o.detail
  if (o.camera !== undefined) step.camera = o.camera
  if (o.effort !== undefined) step.effort = o.effort
  if (o.targets !== undefined) step.targets = o.targets
  return step
}

/** A valley fold: the half containing `moves` comes toward you. */
export function valley(id: string, a: Vec2, b: Vec2, moves: Vec2, angle: number, o: StepOpts): FoldStep {
  const c = crease(a, b, moves, 'valley', angle)
  return build(id, 'valley', 'drag', [c], { from: moves, to: reflect(moves, a, b) }, { effort: 2, ...o })
}

/** A mountain fold: the half containing `moves` goes away from you. */
export function mountain(id: string, a: Vec2, b: Vec2, moves: Vec2, angle: number, o: StepOpts): FoldStep {
  const c = crease(a, b, moves, 'mountain', angle)
  return build(id, 'mountain', 'drag', [c], { from: moves, to: reflect(moves, a, b) }, { effort: 2, ...o })
}

/** A pre-crease: rub a line in and let the paper open again. Nothing moves (angle 0). */
export function burnish(
  id: string,
  lines: readonly (readonly [Vec2, Vec2, Vec2])[],
  direction: 'valley' | 'mountain',
  o: StepOpts,
): FoldStep {
  const creases = lines.map(([a, b, moves]) => crease(a, b, moves, direction, 0))
  const first = lines[0]
  return build(
    id,
    'crease',
    'rub',
    creases,
    { from: lerp(first[0], first[1], 0.22), to: lerp(first[0], first[1], 0.78) },
    { effort: 1, ...o },
  )
}

/** Bring two points together — a collapse, a cupboard fold, a body pinch. */
export function pinch(id: string, creases: Crease[], from: Vec2, to: Vec2, o: StepOpts): FoldStep {
  return build(id, 'pinch', 'pinch-in', creases, { from, to }, { effort: 3, ...o })
}

/** Open a flap and press it flat. */
export function squash(id: string, creases: Crease[], at: Vec2, open: Vec2, o: StepOpts): FoldStep {
  return build(id, 'squash', 'pinch-out', creases, { from: at, to: open }, { effort: 3, targets: [at], ...o })
}

/** Lift a point and flatten the sides — the move that makes a bird base. */
export function petal(id: string, creases: Crease[], from: Vec2, to: Vec2, o: StepOpts): FoldStep {
  return build(id, 'petal', 'drag', creases, { from, to }, { effort: 3, ...o })
}

/**
 * An inside (mountain) or outside (valley) reverse fold: tap the spot, then push
 * the point through. `moves` is the tip that travels.
 */
export function reverse(
  id: string,
  a: Vec2,
  b: Vec2,
  moves: Vec2,
  direction: 'valley' | 'mountain',
  o: StepOpts,
): FoldStep {
  const c = crease(a, b, moves, direction, 180)
  return build(id, 'reverse', 'tap', [c], { from: moves, to: reflect(moves, a, b) }, {
    effort: 3,
    targets: [moves],
    ...o,
  })
}

/** Draw a hidden flap out — a wing, a neck, a fin. Creases may be empty. */
export function pull(id: string, creases: Crease[], from: Vec2, to: Vec2, o: StepOpts): FoldStep {
  return build(id, 'pull', 'drag', creases, { from, to }, { effort: 2, ...o })
}

/** Turn the whole model over. */
export function flip(id: string, o: StepOpts): FoldStep {
  return build(id, 'flip', 'swipe', [], { from: [140, 500], to: [860, 500] }, { effort: 1, ...o })
}

/** Turn the model on the desk. */
export function rotate(id: string, degrees: number, o: StepOpts): FoldStep {
  return build(id, 'rotate', 'twist', [], { from: [780, 300], to: [700, 160] }, {
    effort: 1,
    camera: { roll: degrees },
    ...o,
  })
}

/** Flatten everything. The satisfying finish. */
export function press(id: string, o: StepOpts): FoldStep {
  return build(id, 'press', 'hold', [], { from: [410, 410], to: [590, 590] }, { effort: 1, ...o })
}

/** Open a closed form into three dimensions. */
export function inflate(id: string, o: StepOpts): FoldStep {
  return build(id, 'inflate', 'pinch-out', [], { from: [420, 500], to: [580, 500] }, { effort: 3, ...o })
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CLASSICAL BASES

   Each base is a real crease pattern on the landmark grid above, exported both
   as a bare `Crease[]` (the pattern) and as an authored `FoldStep[]` (the
   lesson). Where a classical move lays several creases at once — a collapse, a
   squash, a petal — they travel together in one step, because that is how a
   hand performs the move: one gesture.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface BaseOpts {
  /** Namespace for step ids, so two bases can appear in one recipe. */
  prefix?: string
  /** Replaces the last base step's `detail` line, to point at the species. */
  detail?: string
}

const px = (o: BaseOpts | undefined, id: string): string => `${o?.prefix ?? 'base'}.${id}`

/* ── SIMPLE: one diagonal. Where every beginner starts. ─────────────────── */

export const SIMPLE_CP: Crease[] = [
  crease(PT.TL, PT.BR, PT.TR, 'valley', 0),
  crease(PT.TL, PT.BR, PT.TR, 'valley', 180),
]

export function simpleBase(o?: BaseOpts): FoldStep[] {
  return [
    burnish(px(o, 'spine'), [[PT.TL, PT.BR, PT.TR]], 'valley', {
      instruction: 'Rub a line from this corner to that one.',
      detail: 'Only a whisper of a crease. It is a guide, not a fold.',
      camera: CAM.desk,
    }),
    valley(px(o, 'half'), PT.TL, PT.BR, PT.TR, 180, {
      instruction: 'Bring the top corner down to meet the bottom.',
      detail: o?.detail ?? 'Line the edges up before you press. The corners tell you when it is true.',
    }),
  ]
}

/* ── KITE: two edges folded to one diagonal. ────────────────────────────── */

export const KITE_CP: Crease[] = [
  crease(PT.TL, PT.BR, PT.TR, 'valley', 0),
  crease(PT.TL, PT.RQ, PT.TR, 'valley', 180),
  crease(PT.TL, PT.BQ, PT.BL, 'valley', 180),
]

export function kiteBase(o?: BaseOpts): FoldStep[] {
  return [
    burnish(px(o, 'spine'), [[PT.TL, PT.BR, PT.TR]], 'valley', {
      instruction: 'Rub a line corner to corner, then let it open.',
      detail: 'This line is the middle of everything that follows.',
      camera: CAM.desk,
    }),
    valley(px(o, 'kite-a'), PT.TL, PT.RQ, PT.TR, 180, {
      instruction: 'Fold the top edge in to the middle line.',
      detail: 'Let the edge land on the crease, not past it.',
    }),
    valley(px(o, 'kite-b'), PT.TL, PT.BQ, PT.BL, 180, {
      instruction: 'Now the other edge, to match.',
      detail: o?.detail ?? 'A kite. Two edges, one line, and it already has a nose.',
      camera: CAM.close,
    }),
  ]
}

/* ── FISH: the kite, then the other two edges, then the fins swing down. ── */

export const FISH_CP: Crease[] = [
  ...KITE_CP,
  crease(PT.BR, PT.LQ, PT.BL, 'valley', 180),
  crease(PT.BR, PT.TQ, PT.TR, 'valley', 180),
  crease([500, PT.W1[1]], [SQ, PT.W1[1]], PT.TR, 'valley', 180),
  crease([PT.W2[0], 500], [PT.W2[0], SQ], PT.BL, 'valley', 180),
]

export function fishBase(o?: BaseOpts): FoldStep[] {
  return [
    ...kiteBase({ prefix: o?.prefix, detail: 'Halfway to a fish already.' }),
    valley(px(o, 'fish-a'), PT.BR, PT.LQ, PT.BL, 180, {
      instruction: 'Fold the lower edge in to the same line.',
      detail: 'The paper is getting thicker. Slow down; press with the flat of your thumb.',
    }),
    valley(px(o, 'fish-b'), PT.BR, PT.TQ, PT.TR, 180, {
      instruction: 'And the last edge in.',
      detail: 'Two small ears will push out at the waist. Let them.',
      camera: CAM.close,
    }),
    pull(
      px(o, 'fins'),
      [
        crease([500, PT.W1[1]], [SQ, PT.W1[1]], PT.TR, 'valley', 180),
        crease([PT.W2[0], 500], [PT.W2[0], SQ], PT.BL, 'valley', 180),
      ],
      PT.W1,
      [PT.W1[0] - 60, PT.W1[1] + 200],
      {
        instruction: 'Swing both ears down toward the point.',
        detail: o?.detail ?? 'Those are the fins. The fish base is four hundred years old and still the tidiest way to get them.',
        effort: 3,
        camera: CAM.close,
      },
    ),
  ]
}

/* ── PRELIMINARY: midlines valley, diagonals mountain, collapse. ─────────── */

export const PRELIMINARY_CP: Crease[] = [
  crease(PT.MT, PT.MB, PT.TL, 'valley', 180),
  crease(PT.ML, PT.MR, PT.TL, 'valley', 180),
  crease(PT.TL, PT.BR, PT.TR, 'mountain', 180),
  crease(PT.TR, PT.BL, PT.TL, 'mountain', 180),
]

export function preliminaryBase(o?: BaseOpts): FoldStep[] {
  return [
    burnish(px(o, 'books'), [
      [PT.ML, PT.MR, PT.TL],
      [PT.MT, PT.MB, PT.TL],
    ], 'valley', {
      instruction: 'Rub a cross into the middle — across, then down.',
      detail: 'Edge to edge both ways. Open it each time.',
      camera: CAM.desk,
    }),
    burnish(px(o, 'diagonals'), [
      [PT.TL, PT.BR, PT.TR],
      [PT.TR, PT.BL, PT.TL],
    ], 'mountain', {
      instruction: 'Now corner to corner, both ways.',
      detail: 'These two go the other way — away from you. Turn the sheet over if it helps.',
    }),
    pinch(px(o, 'collapse'), PRELIMINARY_CP, PT.ML, PT.MR, {
      instruction: 'Push the two sides gently together.',
      detail: o?.detail ?? 'It wants to fall into a small square. Let it — do not force it.',
      camera: CAM.close,
    }),
  ]
}

/* ── WATERBOMB: the preliminary base, inside out. ────────────────────────── */

export const WATERBOMB_CP: Crease[] = [
  crease(PT.TL, PT.BR, PT.TR, 'valley', 180),
  crease(PT.TR, PT.BL, PT.TL, 'valley', 180),
  crease(PT.MT, PT.MB, PT.TL, 'mountain', 180),
  crease(PT.ML, PT.MR, PT.TL, 'mountain', 180),
]

export function waterbombBase(o?: BaseOpts): FoldStep[] {
  return [
    burnish(px(o, 'diagonals'), [
      [PT.TL, PT.BR, PT.TR],
      [PT.TR, PT.BL, PT.TL],
    ], 'valley', {
      instruction: 'Rub both diagonals in, corner to corner.',
      detail: 'Open the sheet flat again after each one.',
      camera: CAM.desk,
    }),
    burnish(px(o, 'books'), [
      [PT.ML, PT.MR, PT.TL],
      [PT.MT, PT.MB, PT.TL],
    ], 'mountain', {
      instruction: 'Now across and down — these go away from you.',
      detail: 'Four lines, two of each kind. The paper already knows what to do.',
    }),
    pinch(px(o, 'collapse'), WATERBOMB_CP, PT.ML, PT.MR, {
      instruction: 'Press the two sides in and let it fall into a triangle.',
      detail: o?.detail ?? 'The waterbomb base. Everything that holds air starts here.',
      camera: CAM.close,
    }),
  ]
}

/* ── BIRD: the preliminary base, then a petal fold front and back. ───────── */

const PETAL_TL: Crease[] = [
  crease(PT.TL, PT.RIDGE_TL_A, PT.MT, 'valley', 180),
  crease(PT.TL, PT.RIDGE_TL_B, PT.ML, 'valley', 180),
  crease(PT.MT, PT.ML, PT.TL, 'valley', 180),
]

const PETAL_BR: Crease[] = [
  crease(PT.BR, PT.RIDGE_BR_A, PT.MB, 'valley', 180),
  crease(PT.BR, PT.RIDGE_BR_B, PT.MR, 'valley', 180),
  crease(PT.MB, PT.MR, PT.BR, 'valley', 180),
]

export const BIRD_CP: Crease[] = [...PRELIMINARY_CP, ...PETAL_TL, ...PETAL_BR]

export function birdBase(o?: BaseOpts): FoldStep[] {
  return [
    ...preliminaryBase({ prefix: o?.prefix }),
    petal(px(o, 'petal-front'), PETAL_TL, PT.TL, [340, 340], {
      instruction: 'Lift the near point up and let the sides fold in behind it.',
      detail: 'The petal fold. It looks impossible until it happens, and then it is obvious.',
      camera: CAM.close,
    }),
    flip(px(o, 'turn'), {
      instruction: 'Turn the whole thing over.',
      detail: 'Two fingers, flat, and let it land.',
    }),
    petal(px(o, 'petal-back'), PETAL_BR, PT.BR, [660, 660], {
      instruction: 'The same lift on this side.',
      detail: o?.detail ?? 'A bird base. Four points: two wings, a neck, a tail.',
      camera: CAM.close,
    }),
  ]
}

/* ── FROG: the preliminary base, squashed and petalled on both faces. ─────
   The classical frog base squashes and petals all four flaps for eight points.
   Ours works the front and back pairs together — one gesture per pair — which
   is how it is taught by hand, and gives the four points the roster needs. ── */

const SQUASH_FRONT: Crease[] = [
  crease(PT.TL, PT.RIDGE_TL_A, PT.MT, 'valley', 180),
  crease(PT.TL, PT.RIDGE_TL_B, PT.ML, 'valley', 180),
]

const SQUASH_BACK: Crease[] = [
  crease(PT.BR, PT.RIDGE_BR_A, PT.MB, 'valley', 180),
  crease(PT.BR, PT.RIDGE_BR_B, PT.MR, 'valley', 180),
]

const PETAL_TR: Crease[] = [
  crease(PT.TR, PT.RIDGE_TR_A, PT.MT, 'valley', 180),
  crease(PT.TR, PT.RIDGE_TR_B, PT.MR, 'valley', 180),
  crease(PT.MT, PT.MR, PT.TR, 'valley', 180),
]

const PETAL_BL: Crease[] = [
  crease(PT.BL, PT.RIDGE_BL_A, PT.MB, 'valley', 180),
  crease(PT.BL, PT.RIDGE_BL_B, PT.ML, 'valley', 180),
  crease(PT.MB, PT.ML, PT.BL, 'valley', 180),
]

export const FROG_CP: Crease[] = [...PRELIMINARY_CP, ...PETAL_TL, ...PETAL_BR, ...PETAL_TR, ...PETAL_BL]

export function frogBase(o?: BaseOpts): FoldStep[] {
  return [
    ...preliminaryBase({ prefix: o?.prefix }),
    squash(px(o, 'squash-front'), SQUASH_FRONT, PT.TL, [PT.RIDGE_TL_A[0], PT.RIDGE_TL_B[1]], {
      instruction: 'Open the near flap and press it flat into a diamond.',
      detail: 'Put a fingertip inside first. It opens far more easily than it looks.',
      camera: CAM.close,
    }),
    petal(px(o, 'petal-front'), PETAL_TR, PT.TR, [520, 200], {
      instruction: 'Petal-fold the diamond: lift the point, sides in.',
      detail: 'Two edges to the middle, and the point comes up on its own.',
    }),
    flip(px(o, 'turn'), {
      instruction: 'Turn it over, carefully.',
      detail: 'There is a lot of paper in there now. Support it as it goes.',
    }),
    squash(px(o, 'squash-back'), SQUASH_BACK, PT.BR, [PT.RIDGE_BR_A[0], PT.RIDGE_BR_B[1]], {
      instruction: 'Open and flatten this flap the same way.',
      camera: CAM.close,
    }),
    petal(px(o, 'petal-back'), PETAL_BL, PT.BL, [480, 800], {
      instruction: 'And petal-fold it to match.',
      detail: o?.detail ?? 'The frog base. The hardest of the classical five, and the most generous.',
    }),
  ]
}

/* ── WINDMILL: quarters, then all four edges in, then the vanes pulled out. ─ */

export const WINDMILL_CP: Crease[] = [
  crease([0, 250], [SQ, 250], PT.TL, 'valley', 180),
  crease([0, 750], [SQ, 750], PT.BL, 'valley', 180),
  crease([250, 0], [250, SQ], PT.TL, 'valley', 180),
  crease([750, 0], [750, SQ], PT.TR, 'valley', 180),
  crease(PT.TL, PT.Q1, [250, 0], 'valley', 180),
  crease(PT.TR, PT.Q2, [SQ, 250], 'valley', 180),
  crease(PT.BR, PT.Q3, [750, SQ], 'valley', 180),
  crease(PT.BL, PT.Q4, [0, 750], 'valley', 180),
]

export function windmillBase(o?: BaseOpts): FoldStep[] {
  return [
    burnish(px(o, 'quarters-h'), [
      [[0, 250], [SQ, 250], PT.TL],
      [[0, 750], [SQ, 750], PT.BL],
    ], 'valley', {
      instruction: 'Bring the top edge to the middle and rub. Then the bottom.',
      detail: 'Open each one. You are drawing quarters.',
      camera: CAM.desk,
    }),
    burnish(px(o, 'quarters-v'), [
      [[250, 0], [250, SQ], PT.TL],
      [[750, 0], [750, SQ], PT.TR],
    ], 'valley', {
      instruction: 'The same both sides, left and right.',
      detail: 'Sixteen little squares. Every windmill in the world starts here.',
    }),
    pinch(px(o, 'cupboard-h'), [
      crease([0, 250], [SQ, 250], PT.TL, 'valley', 180),
      crease([0, 750], [SQ, 750], PT.BL, 'valley', 180),
    ], PT.MT, PT.C, {
      instruction: 'Fold the top and bottom edges in to meet in the middle.',
      detail: 'Both at once, like closing a cupboard.',
    }),
    pinch(px(o, 'cupboard-v'), [
      crease([250, 0], [250, SQ], PT.TL, 'valley', 180),
      crease([750, 0], [750, SQ], PT.TR, 'valley', 180),
    ], PT.ML, PT.C, {
      instruction: 'Now the sides in as well.',
      detail: 'A small square, four layers thick, with the corners hiding inside.',
      camera: CAM.close,
    }),
    pull(px(o, 'vanes'), [
      crease(PT.TL, PT.Q1, [250, 0], 'valley', 180),
      crease(PT.TR, PT.Q2, [SQ, 250], 'valley', 180),
      crease(PT.BR, PT.Q3, [750, SQ], 'valley', 180),
      crease(PT.BL, PT.Q4, [0, 750], 'valley', 180),
    ], PT.Q1, PT.TL, {
      instruction: 'Draw each corner out and let it lie down.',
      detail: o?.detail ?? 'Four vanes, all turning the same way. This is the windmill base.',
      effort: 3,
      camera: CAM.close,
    }),
  ]
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIERS
   ═══════════════════════════════════════════════════════════════════════════ */

export type FoldTier = 'simple' | 'classic' | 'master' | 'grand'

/** Inclusive step-count band for each tier. A recipe must land inside its band. */
export const TIER_STEPS: Record<FoldTier, readonly [number, number]> = {
  simple: [4, 5],
  classic: [7, 8],
  master: [10, 12],
  grand: [14, 20],
}

export const TIER_LABEL: Record<FoldTier, string> = {
  simple: 'Simple',
  classic: 'Classic',
  master: 'Master',
  grand: 'Grand',
}

export const TIER_ORDER: readonly FoldTier[] = ['simple', 'classic', 'master', 'grand']

/** Sheets awarded for a first fold, before the rarity bonus. */
export const TIER_REWARD: Record<FoldTier, number> = {
  simple: 12,
  classic: 20,
  master: 34,
  grand: 55,
}

/** The tier a recipe actually is, read from its step count. */
export function tierOf(recipe: FoldRecipe): FoldTier | null {
  const n = recipe.steps.length
  for (const tier of TIER_ORDER) {
    const [lo, hi] = TIER_STEPS[tier]
    if (n >= lo && n <= hi) return tier
  }
  return null
}

/** Total authored effort of a recipe — used by the Studio for pacing. */
export function effortOf(recipe: FoldRecipe): number {
  return recipe.steps.reduce((sum, s) => sum + (s.effort ?? 1), 0)
}

/** Every distinct fold kind a recipe teaches, in first-appearance order. */
export function kindsOf(recipe: FoldRecipe): FoldKind[] {
  const seen: FoldKind[] = []
  for (const s of recipe.steps) if (!seen.includes(s.kind)) seen.push(s.kind)
  return seen
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPECIES-STEP HELPERS
   Shortcuts for the moves that distinguish one creature from another, built so
   that the geometry cannot come out wrong: you name the spine and how far along
   it the fold sits, and the axis is derived.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The axis that crosses a spine at fraction `t`, tilted `tiltDeg` off square.
 * Returned as two points far enough apart to define the infinite line.
 */
export function crossAxis(
  spineA: Vec2,
  spineB: Vec2,
  t: number,
  tiltDeg = 0,
  reach = 420,
): [Vec2, Vec2] {
  const p = lerp(spineA, spineB, t)
  const base =
    Math.atan2(spineB[1] - spineA[1], spineB[0] - spineA[0]) +
    Math.PI / 2 +
    (tiltDeg * Math.PI) / 180
  const ux = Math.cos(base)
  const uy = Math.sin(base)
  return [
    [p[0] - ux * reach, p[1] - uy * reach],
    [p[0] + ux * reach, p[1] + uy * reach],
  ]
}

/**
 * A reverse fold across a spine: neck, tail, head, foot. `t` is how far along
 * the spine the crease sits, `moves` is the tip that turns around.
 * `mountain` = inside reverse (the point sinks between the layers),
 * `valley`   = outside reverse (the point wraps around them).
 */
export function reverseAt(
  id: string,
  spineA: Vec2,
  spineB: Vec2,
  t: number,
  tiltDeg: number,
  moves: Vec2,
  direction: 'valley' | 'mountain',
  o: StepOpts,
): FoldStep {
  const [a, b] = crossAxis(spineA, spineB, t, tiltDeg)
  return reverse(id, a, b, moves, direction, o)
}

/** A valley fold across a spine at fraction `t` — a pleat, a flap, a fold-back. */
export function crossFold(
  id: string,
  spineA: Vec2,
  spineB: Vec2,
  t: number,
  tiltDeg: number,
  moves: Vec2,
  direction: 'valley' | 'mountain',
  angle: number,
  o: StepOpts,
): FoldStep {
  const [a, b] = crossAxis(spineA, spineB, t, tiltDeg)
  return direction === 'valley'
    ? valley(id, a, b, moves, angle, o)
    : mountain(id, a, b, moves, angle, o)
}

/** All four corners to the centre. */
export const BLINTZ_CP: Crease[] = [
  crease(PT.MT, PT.ML, PT.TL, 'valley', 180),
  crease(PT.MT, PT.MR, PT.TR, 'valley', 180),
  crease(PT.MR, PT.MB, PT.BR, 'valley', 180),
  crease(PT.MB, PT.ML, PT.BL, 'valley', 180),
]

/** The blintz: every corner in to the middle. Named after a folded pastry. */
export function blintz(id: string, o: StepOpts): FoldStep {
  return pinch(id, BLINTZ_CP, PT.TL, PT.C, o)
}
