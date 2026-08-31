/**
 * PAPER PLANET — cross-module contracts.
 *
 * ███ FROZEN ███  Every module implements against this file. Do not edit it.
 * If something here is genuinely wrong, implement around it and report it.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   1. GEOMETRY & THE FOLD ENGINE                                    [engine/]
   ═══════════════════════════════════════════════════════════════════════════ */

export type Vec2 = readonly [number, number]
export type Vec3 = readonly [number, number, number]

/** A crease line in *material space* (the flat unfolded sheet, 0..1000 square). */
export interface Crease {
  /** Two points defining the infinite fold axis. */
  a: Vec2
  b: Vec2
  /**
   * Which side of the axis moves. `1` = the left half-plane (by a→b normal),
   * `-1` = the right. Determined by cross product sign.
   */
  side: 1 | -1
  /** Valley folds toward the viewer (+), mountain away (−). */
  direction: 'valley' | 'mountain'
  /** Final rotation in degrees. 180 = flat fold. 90 = a standing flap. */
  angle: number
}

/**
 * The complete gesture vocabulary. Each maps to a distinct input, sound, and
 * visual affordance. This is the heart of "expand the folding mechanics".
 */
export type FoldKind =
  | 'valley'    // drag across the axis, toward you
  | 'mountain'  // drag across the axis, away from you
  | 'crease'    // rub back and forth along a line to burnish it
  | 'pinch'     // two-finger pinch: bring two points together
  | 'squash'    // pinch open then press flat
  | 'petal'     // lift a point and flatten the sides (bird base move)
  | 'reverse'   // inside/outside reverse fold: tap the spot, then drag
  | 'pull'      // drag a hidden flap out (wings, neck, tail)
  | 'flip'      // two-finger swipe: turn the whole model over
  | 'rotate'    // two-finger twist: turn the model on the desk
  | 'press'     // long-press: flatten everything, the satisfying finish
  | 'inflate'   // pinch-out / blow: open a 3D form (the balloon, the frog)

/** How the player performs a step. Drives the gesture recogniser + the hint UI. */
export type GestureKind =
  | 'drag'        // one finger, directional
  | 'rub'         // one finger, back and forth along an axis
  | 'pinch-in'    // two fingers together
  | 'pinch-out'   // two fingers apart
  | 'twist'       // two fingers rotating
  | 'swipe'       // one or two fingers, fast, directional
  | 'tap'         // discrete taps on marked targets
  | 'hold'        // press and hold

/** One authored step of a fold recipe. */
export interface FoldStep {
  id: string
  kind: FoldKind
  gesture: GestureKind
  /** Creases applied to the sheet when this step completes. */
  creases: Crease[]
  /** Where the hint gesture starts and ends, in material space. */
  hint: { from: Vec2; to: Vec2 }
  /** Extra tap targets in material space (for `reverse`, `tap`). */
  targets?: Vec2[]
  /** Teacher voice. One short sentence. See BRAND.md §3. */
  instruction: string
  /** Optional second line, smaller — the "why". */
  detail?: string
  /** Camera nudge when this step begins, so the player sees what matters. */
  camera?: Partial<CameraPose>
  /** Difficulty weight for pacing. 1 = trivial, 3 = demanding. */
  effort?: 1 | 2 | 3
}

/** A complete origami recipe. */
export interface FoldRecipe {
  /** Named base this derives from, for the Codex. */
  base?: 'kite' | 'fish' | 'bird' | 'frog' | 'waterbomb' | 'windmill' | 'none'
  steps: FoldStep[]
}

export interface CameraPose {
  /** Orbit around the vertical axis, degrees. 0 = straight on. */
  yaw: number
  /** Tilt, degrees. 0 = looking level, 60 = looking down at the desk. */
  pitch: number
  /** Distance multiplier. 1 = the framed default. */
  zoom: number
  /** In-plane rotation of the desk, degrees. */
  roll: number
}

/** A drawable facet the renderer emits — already projected and shaded. */
export interface RenderFacet {
  id: string
  /** Screen-space polygon, ready for an SVG `points`/path. */
  points: Vec2[]
  /** Final resolved fill colour. */
  fill: string
  /** Edge stroke colour, or null for no stroke. */
  stroke: string | null
  strokeWidth: number
  /** 0..1 — how much specular sheen to overlay. */
  sheen: number
  /** Painter's-algorithm sort key. Higher draws later (on top). */
  depth: number
  /** True when the reverse (white) side of the paper faces the camera. */
  isBack: boolean
  /** Ambient-occlusion strength at the fold root, 0..1. */
  occlusion: number
}

export interface RenderFrame {
  facets: RenderFacet[]
  /** Contact shadow polygon on the desk, screen space. */
  shadow: Vec2[]
  /** Screen-space positions of the current step's hint anchors. */
  hint: { from: Vec2; to: Vec2 } | null
  /** Screen-space tap targets for the current step. */
  targets: Vec2[]
  /** The active crease axis in screen space, for drawing the guide. */
  axis: { from: Vec2; to: Vec2 } | null
  /** Bounding box of everything drawn, for auto-fit. */
  bounds: { x: number; y: number; w: number; h: number }
}

export interface PaperMaterial {
  /** Front (dyed) side. */
  front: string
  /** Reverse side — usually near-white. */
  back: string
  /** Optional SVG pattern id painted over the front (washi). */
  patternId?: string
  /** 0..1 how metallic/shimmery. Gold leaf = 1. */
  foil?: number
}

/** The public engine surface. Implemented by `engine/index.ts`. */
export interface FoldEngine {
  /** Reset to a flat square with the given material. */
  reset(recipe: FoldRecipe, material: PaperMaterial): void
  /** Advance to a step index, applying all prior creases instantly. */
  seekStep(index: number): void
  /**
   * Drive the current step. `t` is 0..1 completion of the in-flight gesture.
   * The engine handles progressive bending, not just a rigid hinge.
   */
  setProgress(t: number): void
  /** Commit the current step's creases permanently and move on. */
  commitStep(): void
  /** Camera control. */
  setCamera(pose: Partial<CameraPose>): void
  getCamera(): CameraPose
  /** Frame the model in a viewport of the given pixel size. */
  fit(width: number, height: number): void
  /** Produce a frame for the current state. Pure — safe to call in rAF. */
  render(): RenderFrame
  /** Idle life: a gentle breathing deformation once the model is complete. */
  setBreath(phase: number): void
  /** True once every step has been committed. */
  isComplete(): boolean
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. AUDIO                                                          [audio/]
   ═══════════════════════════════════════════════════════════════════════════ */

export type SfxCue =
  | 'crease.soft' | 'crease.crisp' | 'crease.set'
  | 'fold.valley' | 'fold.mountain' | 'fold.reverse' | 'fold.petal' | 'fold.squash'
  | 'sheet.slide' | 'sheet.flip' | 'sheet.lift' | 'sheet.settle' | 'sheet.pickup'
  | 'press.flatten' | 'press.release'
  | 'ui.tap' | 'ui.back' | 'ui.confirm' | 'ui.open' | 'ui.close' | 'ui.toggle'
  | 'alive.breath' | 'alive.happy' | 'alive.nuzzle'
  | 'reward.sheets' | 'reward.goldleaf' | 'reward.mastery' | 'reward.unlock'

export type AmbienceId = 'meadow' | 'rain' | 'night' | 'shore' | 'tearoom' | 'none'

export type AudioBus = 'sfx' | 'ambience' | 'music' | 'master'

export interface PlayOptions {
  /** 0..1, multiplied into the bus gain. */
  volume?: number
  /** Semitone-ish detune, ±. Randomised slightly if omitted. */
  pitch?: number
  /** Delay before playing, seconds. */
  delay?: number
}

export interface AudioService {
  /** Must be called from a user gesture before anything will sound. */
  unlock(): Promise<void>
  ready(): boolean
  /** Fire a one-shot. Safe to call before assets load (it no-ops). */
  play(cue: SfxCue, opts?: PlayOptions): void
  /**
   * The ASMR core: a continuous friction voice driven by gesture velocity.
   * Call every pointermove. `velocity` in px/ms, `pressure` 0..1.
   * The engine handles its own throttling, grain scheduling, and fade-out.
   */
  friction(velocity: number, pressure?: number): void
  /** Stop the friction voice with a natural tail. */
  frictionEnd(): void
  /** Crossfade to an ambience bed. */
  setAmbience(id: AmbienceId, fadeSeconds?: number): void
  /** Sparse generative music. */
  setMusic(on: boolean): void
  setBusVolume(bus: AudioBus, volume: number): void
  getBusVolume(bus: AudioBus): number
  /** Duck everything but the paper — used during a fold for focus. */
  setFocusMode(on: boolean): void
  /** Preload a set of cues. Resolves when they're decodable. */
  preload(cues: SfxCue[]): Promise<void>
}

export interface HapticService {
  /** Named pattern from BRAND.md §8. */
  fire(pattern: HapticPattern): void
  /** Continuous light ticks during a rub. Self-throttling. */
  tick(intensity: number): void
  setEnabled(on: boolean): void
}

export type HapticPattern =
  | 'tick' | 'creaseSet' | 'foldComplete' | 'flip'
  | 'press' | 'alive' | 'reward' | 'error'

/* ═══════════════════════════════════════════════════════════════════════════
   3. CONTENT                                                      [content/]
   ═══════════════════════════════════════════════════════════════════════════ */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic'
export type BiomeId = 'meadow' | 'shore' | 'forest' | 'peak' | 'nightsky'
export type IdleKind = 'bob' | 'hop' | 'sway' | 'fly' | 'flutter' | 'walk' | 'swim' | 'stand' | 'burrow'

/** A polygon of a creature's flat art, in a 0..200 square. */
export interface ArtPoly {
  /** SVG points string, or… */
  pts?: string
  /** …a circle [cx, cy, r], or… */
  circle?: [number, number, number]
  /** …a line [x1, y1, x2, y2]. */
  line?: [number, number, number, number]
  fill: string
  noStroke?: boolean
  /** Which paper layer this sits on — drives the depth shading on reveal. */
  layer?: 0 | 1 | 2
  /** Marks this poly as an eye, so it can blink. */
  eye?: boolean
}

export interface CodexEntry {
  /** One true, delightful fact. Not a joke. */
  fact: string
  /** Where it lives. */
  habitat: string
  /** Unlocked at Adept mastery — a second, deeper fact. */
  factAdept?: string
  /** Unlocked at Master — the origami history of this fold. */
  foldLore?: string
}

export interface Species {
  id: string
  name: string
  /** Latin-ish flavour name, shown small in the Codex. */
  binomial: string
  biome: BiomeId
  rarity: Rarity
  /** Default material if the player hasn't chosen a Washi. */
  material: PaperMaterial
  /** Flat art, drawn in a 0..200 viewBox. */
  art: ArtPoly[]
  /** Pentatonic chirp, as frequency multipliers of the species' root. */
  chirp: number[]
  idle: IdleKind
  recipe: FoldRecipe
  codex: CodexEntry
  /** Sheets awarded for a first fold. */
  reward: number
  /** Unlock requirement. */
  unlock: UnlockRule
  seasonal?: 'spring' | 'summer' | 'autumn' | 'winter'
}

export type UnlockRule =
  | { type: 'free' }
  | { type: 'collection'; count: number }
  | { type: 'species'; id: string; mastery: MasteryTier }
  | { type: 'biome'; id: BiomeId }
  | { type: 'purchase'; sku: string }
  | { type: 'goldleaf'; cost: number }

export type MasteryTier = 'none' | 'novice' | 'adept' | 'master' | 'grand'

export interface Washi {
  id: string
  name: string
  /** Poetic one-liner. */
  note: string
  material: PaperMaterial
  /** SVG <defs> markup string for the pattern, if any. */
  patternDefs?: string
  rarity: Rarity
  /** How you get it. */
  source: { type: 'free' } | { type: 'sheets'; cost: number } | { type: 'goldleaf'; cost: number } | { type: 'pack'; sku: string } | { type: 'journal'; tier: number }
}

export interface Biome {
  id: BiomeId
  name: string
  note: string
  ambience: AmbienceId
  /** Unlocked when the player has this many Kami. */
  unlockAt: number
  /** Palette tokens the Planet screen tints scenery with. */
  palette: { sky: string; ground: string; far: string; accent: string }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. SAVE & GAME STATE                                            [systems/]
   ═══════════════════════════════════════════════════════════════════════════ */

export interface KamiInstance {
  /** Unique per folded creature — you can own several of one species. */
  uid: string
  speciesId: string
  /** Which Washi it was folded from. */
  washiId: string
  /** Player-given name, or null for the species name. */
  nickname: string | null
  /** ms epoch. */
  foldedAt: number
  /** Position on the planet, normalised 0..1. */
  pos: Vec2
  /** Affection 0..100. Rises when fed/petted, decays very slowly. */
  bond: number
  /** True for a golden (sparkle-paper) variant. */
  golden: boolean
  /** How well it was folded, 0..1 — crease accuracy across the session. */
  quality: number
}

export interface SaveV3 {
  version: 3
  /** Every creature the player has folded. */
  kami: KamiInstance[]
  /** speciesId -> times folded. */
  folds: Record<string, number>
  /** Owned washi ids. */
  washi: string[]
  /** Currently selected washi id. */
  activeWashi: string
  sheets: number
  goldLeaf: number
  /** Unlocked biome ids. */
  biomes: BiomeId[]
  daily: {
    /** ISO date string, local. */
    lastFold: string | null
    streak: number
    /** Species id chosen for today. */
    todaySpecies: string | null
    claimed: boolean
  }
  journal: { season: string; tier: number; xp: number; premium: boolean }
  entitlements: string[]
  settings: Settings
  stats: {
    totalFolds: number
    totalCreases: number
    /** Seconds spent in the Studio. */
    studioSeconds: number
    firstOpenAt: number
  }
  /** Onboarding / tutorial flags the player has seen. */
  seen: string[]
}

export interface Settings {
  theme: 'day' | 'night' | 'auto'
  reducedMotion: boolean
  highInk: boolean
  /** Tap-to-fold instead of drag, for accessibility. */
  assistMode: boolean
  haptics: boolean
  volumes: Record<AudioBus, number>
  ambience: AmbienceId
  music: boolean
  /** Show the fold guide lines. Off = expert mode. */
  guides: boolean
  leftHanded: boolean
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. COMMERCE                                                     [systems/]
   ═══════════════════════════════════════════════════════════════════════════ */

export type SkuKind = 'subscription' | 'washi-pack' | 'goldleaf' | 'journal' | 'species'

export interface Sku {
  id: string
  kind: SkuKind
  name: string
  /** One-line value proposition. Honest. No urgency. */
  tagline: string
  /** Full benefit list for the detail card. */
  benefits: string[]
  /** Display price. The real price comes from the store at runtime. */
  price: string
  /** For subscriptions: the billing period. */
  period?: 'month' | 'year'
  /** What the purchase grants. */
  grants: { entitlements?: string[]; goldLeaf?: number; washi?: string[] }
  /** Marketing accent token, e.g. 'kincha'. */
  accent: string
  /** Ordering weight in the shop. */
  order: number
}

export type PurchaseResult =
  | { ok: true; sku: string }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'failed'; message?: string }

/**
 * The seam to a real IAP backend. `LocalStubProvider` implements this against
 * localStorage so the app is fully playable; swap in RevenueCat / StoreKit /
 * Play Billing behind the same interface with no UI changes.
 */
export interface StoreProvider {
  /** Fetch localized products. Falls back to catalog prices. */
  init(): Promise<void>
  listSkus(): Sku[]
  purchase(skuId: string): Promise<PurchaseResult>
  restore(): Promise<string[]>
  isAvailable(): boolean
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. NAVIGATION                                                      [shell/]
   ═══════════════════════════════════════════════════════════════════════════ */

export type ScreenId =
  | 'title'
  | 'planet'
  | 'select'
  | 'studio'
  | 'codex'
  | 'shop'
  | 'settings'
  | 'zen'
  /** Fold Along: the diagrams, for folding on real paper. */
  | 'foldalong'

/** Everything the Studio needs to run a session. */
export interface StudioSession {
  species: Species
  washi: Washi
  golden: boolean
  /** Zen sessions award nothing and never end. */
  mode: 'normal' | 'zen' | 'daily'
}

/** What the Studio hands back when a fold completes. */
export interface StudioResult {
  speciesId: string
  washiId: string
  golden: boolean
  /** Mean crease accuracy 0..1 across the session. */
  quality: number
  creases: number
  seconds: number
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. SHARED UI PROP SHAPES                                              [ui/]
   ═══════════════════════════════════════════════════════════════════════════ */

export type Elevation = 0 | 1 | 2 | 3 | 4
export type AccentToken = 'beni' | 'kincha' | 'matcha' | 'ai' | 'murasaki' | 'sakura' | 'gold-leaf' | 'ink'
