/* PAPER PLANET — Sheets & Gold Leaf: earning, spending, and the reward curve. Pure functions only. */

import type { MasteryTier, Rarity, StudioResult } from '../contracts'
import { clamp, clamp01 } from './rand'
import type { SpeciesLike } from './types'

/* ═══════════════════════════════════════════════════════════════════════════
   THE CURVE

   sheets = round( base(rarity) × quality × firstTime × mastery × golden × atelier )

   ┌── base, by rarity ──────────┬───────┬──────────────┬────────────────────┐
   │ rarity                      │ base  │ first fold*  │ repeat fold*       │
   ├─────────────────────────────┼───────┼──────────────┼────────────────────┤
   │ common                      │   12  │      41      │        14          │
   │ uncommon                    │   20  │      69      │        23          │
   │ rare                        │   34  │     117      │        39          │
   │ mythic                      │   55  │     190      │        63          │
   └─────────────────────────────┴───────┴──────────────┴────────────────────┘
   * a typical fold: quality 0.80 (×1.15), no mastery bonus, not golden, no Atelier.
     In play the store passes the tier attained *after* the fold, so a real first
     fold also carries Novice (×1.05): a common's first fold pays 43, not 41.

   ┌── multipliers ──────────────────────────────────────────────────────────┐
   │ quality    0.75 + 0.50·q          0.75 … 1.25   a poor fold still pays  │
   │ firstTime  species.reward / base, else ×3       clamped to [1, 6]       │
   │ mastery    none 1.00 · novice 1.05 · adept 1.12 · master 1.20 · grand 1.30│
   │ golden     ×1.25                                the sparkle-paper variant│
   │ atelier    ×2.00                                the subscription        │
   │ floor      never below 5 Sheets                 no fold is worthless    │
   │ daily      +25 Sheets, flat, once a day         the Daily Fold          │
   └─────────────────────────────────────────────────────────────────────────┘

   WHY IT IS BALANCED
   · A ~12-minute session is about five folds, mixed first/repeat, q≈0.8 →
     roughly 140–190 Sheets. That is one common Washi per sitting, or a rare
     one every third sitting. Generous, but a Washi is still a small ritual.
   · Sweeping all 40 species once (first folds only) yields ≈ 2,400 Sheets —
     four or five papers earned purely by playing the game through.
   · Suggested Washi prices below sit at 4–20 folds each. Nothing is a grind
     wall; nothing is free-by-accident either.
   · The Atelier doubles Sheets. It buys *time*, never power: Sheets only ever
     purchase Washi, which are paint. See BRAND.md §12.
   · The quality multiplier floors at 0.75, so a shaky fold is worth less but is
     never a failure. There are no fail states in this app.

   THE ONE HARD RULE
   · Folding costs nothing. `FOLD_COST` is empty and `canFold()` is a constant
     `true`. No spend, purchase, or refusal can ever stop a player folding.
   ═══════════════════════════════════════════════════════════════════════════ */

export const RARITY_BASE: Record<Rarity, number> = {
  common: 12,
  uncommon: 20,
  rare: 34,
  mythic: 55,
}

export const MASTERY_MULT: Record<MasteryTier, number> = {
  none: 1.0,
  novice: 1.05,
  adept: 1.12,
  master: 1.2,
  grand: 1.3,
}

export const FIRST_FOLD_MULT = 3
export const GOLDEN_MULT = 1.25
export const ATELIER_SHEETS_MULT = 2
export const MIN_FOLD_SHEETS = 5
export const DAILY_FOLD_BONUS = 25
export const QUALITY_FLOOR_MULT = 0.75
export const QUALITY_RANGE_MULT = 0.5

/** Journal XP. Deliberately not proportional to Sheets — the Journal is a ritual, not a grind. */
export const XP_PER_FOLD = 10
export const XP_FIRST_FOLD_BONUS = 15
export const XP_DAILY_FOLD_BONUS = 25

/**
 * Guidance for `src/content` (Agent E), exported so Washi prices land on the same
 * curve as the rewards above. Content is free to deviate; these are the numbers
 * the balance notes assume.
 */
export const SUGGESTED_WASHI_SHEETS: Record<Rarity, number> = {
  common: 180,
  uncommon: 320,
  rare: 560,
  mythic: 900,
}

/** Suggested Gold Leaf price for an `{ type: 'goldleaf' }` species unlock. */
export const SUGGESTED_GOLDLEAF_UNLOCK: Record<Rarity, number> = {
  common: 6,
  uncommon: 8,
  rare: 12,
  mythic: 18,
}

/* ── Wallet ─────────────────────────────────────────────────────────────── */

export interface Wallet {
  sheets: number
  goldLeaf: number
}

export interface Price {
  sheets?: number
  goldLeaf?: number
}

/** Folding is free. Always. This constant exists so the rule is greppable. */
export const FOLD_COST: Price = {}

/** There is no state of the world in which a player may not fold. */
export function canFold(): true {
  return true
}

export function priceIsFree(price: Price): boolean {
  return (price.sheets ?? 0) <= 0 && (price.goldLeaf ?? 0) <= 0
}

export function canAfford(wallet: Wallet, price: Price): boolean {
  return wallet.sheets >= (price.sheets ?? 0) && wallet.goldLeaf >= (price.goldLeaf ?? 0)
}

export type SpendResult =
  | { ok: true; wallet: Wallet; spent: Price }
  | { ok: false; reason: 'insufficient'; short: Price }

/** Pure. Never mutates. Refuses rather than going negative. */
export function spend(wallet: Wallet, price: Price): SpendResult {
  const sheets = Math.max(0, Math.round(price.sheets ?? 0))
  const goldLeaf = Math.max(0, Math.round(price.goldLeaf ?? 0))
  if (wallet.sheets < sheets || wallet.goldLeaf < goldLeaf) {
    return {
      ok: false,
      reason: 'insufficient',
      short: {
        sheets: Math.max(0, sheets - wallet.sheets),
        goldLeaf: Math.max(0, goldLeaf - wallet.goldLeaf),
      },
    }
  }
  return {
    ok: true,
    wallet: { sheets: wallet.sheets - sheets, goldLeaf: wallet.goldLeaf - goldLeaf },
    spent: { sheets, goldLeaf },
  }
}

export function earn(wallet: Wallet, gain: Price): Wallet {
  return {
    sheets: Math.max(0, wallet.sheets + Math.round(gain.sheets ?? 0)),
    goldLeaf: Math.max(0, wallet.goldLeaf + Math.round(gain.goldLeaf ?? 0)),
  }
}

/* ── The reward for a completed fold ────────────────────────────────────── */

export type RewardKind = 'sheets' | 'goldleaf' | 'xp'

/** One line on the results slip. Copy is in the teacher's voice — see BRAND.md §3. */
export interface RewardLine {
  label: string
  amount: number
  kind: RewardKind
}

export interface RewardBreakdown {
  /** The rarity base before any multiplier. */
  base: number
  quality: number
  firstTime: number
  mastery: number
  golden: number
  atelier: number
  /** Flat additions applied after the multiplicative chain. */
  flat: number
  sheets: number
  goldLeaf: number
  journalXp: number
  lines: RewardLine[]
}

export interface RewardContext {
  /** Times this species has been folded *including* the fold being scored. */
  foldCount: number
  /** Mastery attained after this fold — reaching a tier pays at the new rate. */
  mastery: MasteryTier
  /** Zen awards nothing, by contract. Daily adds the flat bonus. */
  mode: 'normal' | 'zen' | 'daily'
  atelier: boolean
}

export function qualityMultiplier(quality: number): number {
  return QUALITY_FLOOR_MULT + QUALITY_RANGE_MULT * clamp01(quality)
}

/**
 * `Species.reward` is, by contract, "Sheets awarded for a first fold". We honour
 * it exactly by expressing it as the first-time multiplier, so an authored reward
 * and the rarity curve are the same number seen two ways.
 */
export function firstTimeMultiplier(species: SpeciesLike, isFirstFold: boolean): number {
  if (!isFirstFold) return 1
  const base = RARITY_BASE[species.rarity]
  if (species.reward > 0 && base > 0) return clamp(species.reward / base, 1, 6)
  return FIRST_FOLD_MULT
}

/** The whole curve, in one pure function. */
export function foldReward(
  species: SpeciesLike,
  result: Pick<StudioResult, 'quality' | 'golden'>,
  ctx: RewardContext,
): RewardBreakdown {
  const empty: RewardBreakdown = {
    base: 0,
    quality: 1,
    firstTime: 1,
    mastery: 1,
    golden: 1,
    atelier: 1,
    flat: 0,
    sheets: 0,
    goldLeaf: 0,
    journalXp: 0,
    lines: [],
  }

  // Zen Mode awards nothing, and that is the point of it.
  if (ctx.mode === 'zen') return empty

  const isFirstFold = ctx.foldCount <= 1
  const base = RARITY_BASE[species.rarity]
  const quality = qualityMultiplier(result.quality)
  const firstTime = firstTimeMultiplier(species, isFirstFold)
  const mastery = MASTERY_MULT[ctx.mastery]
  const golden = result.golden ? GOLDEN_MULT : 1
  const atelier = ctx.atelier ? ATELIER_SHEETS_MULT : 1
  const flat = ctx.mode === 'daily' ? DAILY_FOLD_BONUS : 0

  const chain = base * quality * firstTime * mastery * golden * atelier
  const sheets = Math.max(MIN_FOLD_SHEETS, Math.round(chain) + flat)

  const journalXp =
    XP_PER_FOLD + (isFirstFold ? XP_FIRST_FOLD_BONUS : 0) + (ctx.mode === 'daily' ? XP_DAILY_FOLD_BONUS : 0)

  const lines: RewardLine[] = []
  const foldedLine = Math.max(MIN_FOLD_SHEETS, Math.round(base * quality * mastery * golden * atelier))
  lines.push({ label: isFirstFold ? 'A new fold' : 'Folded', amount: foldedLine, kind: 'sheets' })
  if (isFirstFold) {
    lines.push({ label: 'First of its kind', amount: Math.max(0, Math.round(chain) - foldedLine), kind: 'sheets' })
  }
  if (flat > 0) lines.push({ label: "Today's fold", amount: flat, kind: 'sheets' })
  if (result.golden) lines.push({ label: 'Sparkle paper', amount: 0, kind: 'sheets' })
  lines.push({ label: 'Journal', amount: journalXp, kind: 'xp' })

  return {
    base,
    quality,
    firstTime,
    mastery,
    golden,
    atelier,
    flat,
    sheets,
    goldLeaf: 0,
    journalXp,
    lines: lines.filter((l) => l.amount > 0 || l.label === 'Sparkle paper'),
  }
}

/* ── Free Gold Leaf ─────────────────────────────────────────────────────── */

/**
 * Gold Leaf is premium, and it is also *earned*. Every source here is free:
 *   · a seven-day streak            +1   (≈ 52 a year, kept forgivingly)
 *   · mastering a fold (10 folds)   +1   once per species
 *   · a Grand fold (25 folds)       +2   once per species
 *   · the Fold Journal free track   +12  a season
 * Forty species carried to Grand is 120 Gold Leaf — comfortably more than the
 * whole catalogue of Gold-Leaf species unlocks costs. A player who never spends
 * a penny finishes the game. That is the promise in BRAND.md §12.
 */
export const GOLD_LEAF_PER_STREAK_WEEK = 1
export const STREAK_WEEK = 7
export const GOLD_LEAF_MASTER = 1
export const GOLD_LEAF_GRAND = 2

export function streakGoldLeaf(streak: number): number {
  return streak > 0 && streak % STREAK_WEEK === 0 ? GOLD_LEAF_PER_STREAK_WEEK : 0
}

export function masteryGoldLeaf(tier: MasteryTier): number {
  if (tier === 'master') return GOLD_LEAF_MASTER
  if (tier === 'grand') return GOLD_LEAF_GRAND
  return 0
}

/* ── Migration credit ───────────────────────────────────────────────────── */

/**
 * v1 and v2 saves predate Sheets entirely. Rather than land a returning player in
 * an empty purse, we credit the folds they already made at roughly the common
 * first-fold rate, capped so it can never out-earn actually playing.
 */
export const MIGRATION_SHEETS_PER_KAMI = 40
export const MIGRATION_SHEETS_CAP = 600
export const MIGRATION_GOLDLEAF_PER_4 = 1
export const MIGRATION_GOLDLEAF_CAP = 5

export function migrationGrant(collected: number): Wallet {
  const n = Math.max(0, Math.floor(collected))
  return {
    sheets: Math.min(MIGRATION_SHEETS_CAP, n * MIGRATION_SHEETS_PER_KAMI),
    goldLeaf: Math.min(MIGRATION_GOLDLEAF_CAP, Math.floor(n / 4) * MIGRATION_GOLDLEAF_PER_4),
  }
}

/** A readable line for the "welcome back" slip after a migration. */
export function migrationNote(grant: Wallet): string {
  if (grant.sheets <= 0) return 'Everything you folded is here.'
  return `Everything you folded is here, with ${grant.sheets} Sheets for the work you already did.`
}
