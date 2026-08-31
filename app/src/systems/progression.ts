/* PAPER PLANET — mastery tiers, biome unlocks, the UnlockRule evaluator, sparkle paper, and bond. Pure. */

import type { BiomeId, KamiInstance, MasteryTier, SaveV3, UnlockRule } from '../contracts'
import { MASTERY_MULT, masteryGoldLeaf } from './economy'
import { ENT, hasEntitlement, isAtelierMember } from './commerce'
import { DAY_MS, SYS_KEY, clearFlagFamily, readFlag, readFlagNumber, writeFlag } from './save'
import { clamp, clamp01, type Rng } from './rand'
import { daysBetween } from './daily'
import type { BiomeLike, ContentIndex } from './types'

/* ═══════════════════════════════════════════════════════════════════════════
   MASTERY — 1 / 3 / 10 / 25 folds of one species.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MASTERY_ORDER: readonly MasteryTier[] = ['none', 'novice', 'adept', 'master', 'grand']

export const MASTERY_THRESHOLDS: Record<MasteryTier, number> = {
  none: 0,
  novice: 1,
  adept: 3,
  master: 10,
  grand: 25,
}

export interface MasteryUnlock {
  tier: MasteryTier
  /** The word shown on the Codex card. BRAND.md §3 — never bronze/silver/gold. */
  label: string
  /** One line, teacher's voice. */
  note: string
  foldsRequired: number
  grants: {
    /** The Kami can be given a name. */
    nickname?: boolean
    /** Which part of the CodexEntry this reveals. */
    codex?: 'habitat' | 'factAdept' | 'foldLore'
    /** The Sheets multiplier from economy.ts, restated here for the card. */
    sheetsMultiplier: number
    /** One-time Gold Leaf, claimed once per species. */
    goldLeaf: number
    /** A gold-leaf seal on the Codex card and a permanent shimmer on the Kami. */
    seal?: boolean
  }
}

export const MASTERY_UNLOCKS: Record<MasteryTier, MasteryUnlock> = {
  none: {
    tier: 'none',
    label: 'Unfolded',
    note: 'You have not folded this one yet.',
    foldsRequired: 0,
    grants: { sheetsMultiplier: MASTERY_MULT.none, goldLeaf: 0 },
  },
  novice: {
    tier: 'novice',
    label: 'Novice',
    note: 'You have made this once. It knows your hands.',
    foldsRequired: MASTERY_THRESHOLDS.novice,
    grants: { nickname: true, codex: 'habitat', sheetsMultiplier: MASTERY_MULT.novice, goldLeaf: 0 },
  },
  adept: {
    tier: 'adept',
    label: 'Adept',
    note: 'Three times. The creases fall where you expect them.',
    foldsRequired: MASTERY_THRESHOLDS.adept,
    grants: { codex: 'factAdept', sheetsMultiplier: MASTERY_MULT.adept, goldLeaf: 0 },
  },
  master: {
    tier: 'master',
    label: 'Master',
    note: 'Ten. You could fold this in the dark.',
    foldsRequired: MASTERY_THRESHOLDS.master,
    grants: { codex: 'foldLore', sheetsMultiplier: MASTERY_MULT.master, goldLeaf: masteryGoldLeaf('master') },
  },
  grand: {
    tier: 'grand',
    label: 'Grand',
    note: 'Twenty-five. This fold is yours now.',
    foldsRequired: MASTERY_THRESHOLDS.grand,
    grants: { sheetsMultiplier: MASTERY_MULT.grand, goldLeaf: masteryGoldLeaf('grand'), seal: true },
  },
}

export function masteryFor(folds: number): MasteryTier {
  const n = Math.max(0, Math.floor(folds))
  if (n >= MASTERY_THRESHOLDS.grand) return 'grand'
  if (n >= MASTERY_THRESHOLDS.master) return 'master'
  if (n >= MASTERY_THRESHOLDS.adept) return 'adept'
  if (n >= MASTERY_THRESHOLDS.novice) return 'novice'
  return 'none'
}

export function masteryRank(tier: MasteryTier): number {
  return MASTERY_ORDER.indexOf(tier)
}

export function masteryAtLeast(tier: MasteryTier, required: MasteryTier): boolean {
  return masteryRank(tier) >= masteryRank(required)
}

export interface MasteryProgress {
  tier: MasteryTier
  next: MasteryTier | null
  folds: number
  /** Folds made since entering the current tier. */
  into: number
  /** Folds needed to span the current tier. */
  span: number
  ratio: number
  foldsToNext: number
}

export function masteryProgress(folds: number): MasteryProgress {
  const n = Math.max(0, Math.floor(folds))
  const tier = masteryFor(n)
  const rank = masteryRank(tier)
  const next = rank < MASTERY_ORDER.length - 1 ? MASTERY_ORDER[rank + 1] ?? null : null
  const from = MASTERY_THRESHOLDS[tier]
  if (!next) return { tier, next: null, folds: n, into: n - from, span: n - from || 1, ratio: 1, foldsToNext: 0 }
  const to = MASTERY_THRESHOLDS[next]
  const span = Math.max(1, to - from)
  const into = clamp(n - from, 0, span)
  return { tier, next, folds: n, into, span, ratio: into / span, foldsToNext: Math.max(0, to - n) }
}

/**
 * Master and Grand each pay Gold Leaf once per species, ever. The claim marker
 * lives in the save, so it survives export/import and cannot be re-farmed.
 */
export function claimMasteryMilestone(
  seen: readonly string[],
  speciesId: string,
  tier: MasteryTier,
): { goldLeaf: number; seen: string[]; claimed: boolean } {
  const amount = MASTERY_UNLOCKS[tier].grants.goldLeaf
  if (amount <= 0) return { goldLeaf: 0, seen: [...seen], claimed: false }
  const key = `${SYS_KEY.masteryPaid}/${tier}/${speciesId}`
  if (readFlag(seen, key) !== null) return { goldLeaf: 0, seen: [...seen], claimed: false }
  return { goldLeaf: amount, seen: writeFlag(seen, key, 1), claimed: true }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BIOMES — opened by the size of the collection, counted as distinct folds.
   Counting instances instead would let one species farm the whole planet open.
   ═══════════════════════════════════════════════════════════════════════════ */

export function collectionSize(folds: Readonly<Record<string, number>>): number {
  return Object.values(folds).filter((n) => n > 0).length
}

export function unlockedBiomes(
  biomes: readonly BiomeLike[],
  size: number,
  current: readonly BiomeId[] = [],
): BiomeId[] {
  const out = new Set<BiomeId>(current)
  for (const b of biomes) if (size >= b.unlockAt) out.add(b.id)
  // The first biome is never closed, even before any content has loaded.
  if (out.size === 0) out.add('meadow')
  return Array.from(out)
}

export function newlyUnlockedBiomes(
  biomes: readonly BiomeLike[],
  size: number,
  current: readonly BiomeId[],
): BiomeId[] {
  const before = new Set(current)
  return unlockedBiomes(biomes, size, current).filter((id) => !before.has(id))
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE UNLOCK EVALUATOR — every `UnlockRule` variant, with copy for the locked
   card. Locked never means told off; it means "not yet, and here is how far".
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UnlockContext {
  collectionSize: number
  folds: Readonly<Record<string, number>>
  biomes: readonly BiomeId[]
  entitlements: readonly string[]
  goldLeaf: number
  /** Resolve a species or biome id to its display name. Content stays injected. */
  nameFor?: (id: string) => string
}

export interface UnlockState {
  unlocked: boolean
  reason: string
  progress: { have: number; need: number } | null
  /** Present when the rule is a Gold Leaf unlock that has not been taken yet. */
  cost: { goldLeaf: number } | null
  affordable: boolean
}

const OPEN: UnlockState = { unlocked: true, reason: 'Ready to fold.', progress: null, cost: null, affordable: true }

export function unlockContextFrom(
  save: Pick<SaveV3, 'folds' | 'biomes' | 'entitlements' | 'goldLeaf'>,
  nameFor?: (id: string) => string,
): UnlockContext {
  const ctx: UnlockContext = {
    collectionSize: collectionSize(save.folds),
    folds: save.folds,
    biomes: save.biomes,
    entitlements: save.entitlements,
    goldLeaf: save.goldLeaf,
  }
  return nameFor ? { ...ctx, nameFor } : ctx
}

export function evaluateUnlock(subjectId: string, rule: UnlockRule, ctx: UnlockContext): UnlockState {
  const name = (id: string): string => ctx.nameFor?.(id) ?? id

  switch (rule.type) {
    case 'free':
      return OPEN

    case 'collection': {
      const have = ctx.collectionSize
      const need = rule.count
      if (have >= need) return OPEN
      const left = need - have
      return {
        unlocked: false,
        reason: left === 1 ? 'One more Kami on your planet.' : `${left} more Kami on your planet.`,
        progress: { have, need },
        cost: null,
        affordable: false,
      }
    }

    case 'species': {
      const folds = ctx.folds[rule.id] ?? 0
      const tier = masteryFor(folds)
      if (masteryAtLeast(tier, rule.mastery)) return OPEN
      const need = MASTERY_THRESHOLDS[rule.mastery]
      return {
        unlocked: false,
        reason: `Fold the ${name(rule.id)} to ${MASTERY_UNLOCKS[rule.mastery].label}.`,
        progress: { have: folds, need },
        cost: null,
        affordable: false,
      }
    }

    case 'biome': {
      if (ctx.biomes.includes(rule.id)) return OPEN
      return {
        unlocked: false,
        reason: `Waiting in the ${name(rule.id)}.`,
        progress: null,
        cost: null,
        affordable: false,
      }
    }

    case 'purchase': {
      // The Atelier includes everything gated behind an Atelier sku.
      if (rule.sku.startsWith('atelier.') && isAtelierMember(ctx.entitlements)) return OPEN
      if (hasEntitlement(ctx.entitlements, ENT.sku(rule.sku))) return OPEN
      if (hasEntitlement(ctx.entitlements, ENT.species(subjectId))) return OPEN
      return { unlocked: false, reason: 'In the shop.', progress: null, cost: null, affordable: false }
    }

    case 'goldleaf': {
      if (hasEntitlement(ctx.entitlements, ENT.species(subjectId))) return OPEN
      const cost = Math.max(0, Math.round(rule.cost))
      return {
        unlocked: false,
        reason: cost === 1 ? 'One Gold Leaf opens this fold.' : `${cost} Gold Leaf opens this fold.`,
        progress: { have: ctx.goldLeaf, need: cost },
        cost: { goldLeaf: cost },
        affordable: ctx.goldLeaf >= cost,
      }
    }

    default:
      return OPEN
  }
}

/** Every species' lock state in one pass — what the Select screen renders from. */
export function evaluateAllUnlocks(content: ContentIndex, ctx: UnlockContext): Map<string, UnlockState> {
  const out = new Map<string, UnlockState>()
  for (const s of content.species) out.set(s.id, evaluateUnlock(s.id, s.unlock, ctx))
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPARKLE PAPER

   The old `rollSparkle` guaranteed a golden every third fold of the same
   species. That is a vending machine: pick your cheapest fold, repeat, harvest.

   The replacement keeps the feeling and removes the exploit:
     · the pity counter is GLOBAL, not per species — repeating one fold gains
       nothing over folding twenty different ones
     · nothing is ever guaranteed; pity raises the odds, it never forces a hit
     · folding well helps a little, so the incentive points at care, not volume
     · two a day, and the counter is not spent when the cap blocks a hit, so a
       capped day costs you nothing tomorrow

   base 8% · +6 points at perfect quality · +3.5 points per fold since the last
   golden · capped at 75% · two per local day.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SPARKLE_BASE = 0.08
export const SPARKLE_QUALITY_BONUS = 0.06
export const SPARKLE_PITY_STEP = 0.035
export const SPARKLE_MAX_CHANCE = 0.75
export const SPARKLE_DAILY_CAP = 2

export interface SparkleInput {
  seen: readonly string[]
  /** Local `YYYY-MM-DD`, from daily.ts. */
  dateKey: string
  quality: number
  rng: Rng
}

export interface SparkleOutcome {
  golden: boolean
  /** The odds this roll actually used, for the "your paper shimmered" copy. */
  chance: number
  pity: number
  cappedToday: boolean
  seen: string[]
}

export function sparkleChance(pity: number, quality: number): number {
  return Math.min(SPARKLE_MAX_CHANCE, SPARKLE_BASE + SPARKLE_QUALITY_BONUS * clamp01(quality) + SPARKLE_PITY_STEP * Math.max(0, pity))
}

export function rollGolden(input: SparkleInput): SparkleOutcome {
  let seen = [...input.seen]
  if (readFlag(seen, SYS_KEY.sparkleDay) !== input.dateKey) {
    seen = writeFlag(seen, SYS_KEY.sparkleDay, input.dateKey)
    seen = writeFlag(seen, SYS_KEY.sparkleToday, 0)
  }
  const pity = Math.max(0, readFlagNumber(seen, SYS_KEY.sparklePity, 0))
  const today = Math.max(0, readFlagNumber(seen, SYS_KEY.sparkleToday, 0))
  const chance = sparkleChance(pity, input.quality)

  if (today >= SPARKLE_DAILY_CAP) {
    // The cap withholds the paper, never the progress toward it.
    return { golden: false, chance, pity, cappedToday: true, seen }
  }

  const golden = input.rng() < chance
  if (golden) {
    seen = writeFlag(seen, SYS_KEY.sparklePity, 0)
    seen = writeFlag(seen, SYS_KEY.sparkleToday, today + 1)
    return { golden: true, chance, pity: 0, cappedToday: false, seen }
  }
  seen = writeFlag(seen, SYS_KEY.sparklePity, pity + 1)
  return { golden: false, chance, pity: pity + 1, cappedToday: false, seen }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOND

   v2 let you press "feed" as fast as your thumb allowed, forever. Affection you
   can mash out of a button is not affection.

   Bond rises 6 a feed, 2 a pet, at most 20 per Kami per local day — so a Kami
   goes from newly folded to fully bonded over about three days of visiting it.
   There is no reward attached to bond beyond how the creature behaves, which is
   the point: it is a relationship, not a resource.

   Decay is gentle and forgiving: three days of grace, then 2 a day, and it never
   falls below 35. Come back after a year and everyone still knows you.
   ═══════════════════════════════════════════════════════════════════════════ */

export const BOND_MAX = 100
export const BOND_START = 50
export const BOND_FLOOR = 35
export const BOND_FEED = 6
export const BOND_PET = 2
export const BOND_DAILY_CAP = 20
export const BOND_DECAY_GRACE_DAYS = 3
export const BOND_DECAY_PER_DAY = 2

export type TendKind = 'feed' | 'pet'

export interface TendInput {
  kami: Pick<KamiInstance, 'uid' | 'bond'>
  seen: readonly string[]
  dateKey: string
  kind: TendKind
}

export interface TendOutcome {
  bond: number
  gained: number
  /** True when today's allowance for this Kami is used up. */
  capped: boolean
  givenToday: number
  remainingToday: number
  seen: string[]
  /** One line for the toast. Never a scold. */
  note: string
}

function bondDayRollover(seen: readonly string[], dateKey: string): string[] {
  if (readFlag(seen, SYS_KEY.bondDay) === dateKey) return [...seen]
  return writeFlag(clearFlagFamily(seen, `${SYS_KEY.bondFed}/`), SYS_KEY.bondDay, dateKey)
}

export function tendKami(input: TendInput): TendOutcome {
  let seen = bondDayRollover(input.seen, input.dateKey)
  const key = `${SYS_KEY.bondFed}/${input.kami.uid}`
  const givenToday = Math.max(0, readFlagNumber(seen, key, 0))
  const wanted = input.kind === 'feed' ? BOND_FEED : BOND_PET
  const allowance = Math.max(0, BOND_DAILY_CAP - givenToday)
  const headroom = Math.max(0, BOND_MAX - input.kami.bond)
  const gained = Math.min(wanted, allowance, headroom)
  const bond = clamp(input.kami.bond + gained, 0, BOND_MAX)

  if (gained > 0) seen = writeFlag(seen, key, givenToday + gained)

  const remainingToday = Math.max(0, BOND_DAILY_CAP - (givenToday + gained))
  const note =
    headroom === 0
      ? 'It could not be happier.'
      : gained === 0
        ? 'It has had plenty today. Come back tomorrow.'
        : input.kind === 'feed'
          ? 'It eats, and settles.'
          : 'It leans into your hand.'

  return { bond, gained, capped: allowance === 0 && headroom > 0, givenToday: givenToday + gained, remainingToday, seen, note }
}

export interface DecayResult {
  kami: KamiInstance[]
  seen: string[]
  daysAway: number
  /** How much every Kami above the floor drifted down. */
  lost: number
}

/**
 * Applied once at hydration. Reads its own checkpoint, so a clock moved backwards
 * cannot manufacture decay and a clock moved forwards cannot double-apply it.
 */
export function decayBond(kami: readonly KamiInstance[], seen: readonly string[], now: number): DecayResult {
  const checkpoint = readFlagNumber(seen, SYS_KEY.bondCheckedAt, 0)
  const nextSeen = writeFlag(seen, SYS_KEY.bondCheckedAt, Math.floor(now))
  if (checkpoint <= 0 || now < checkpoint) {
    return { kami: [...kami], seen: nextSeen, daysAway: 0, lost: 0 }
  }
  const daysAway = Math.floor((now - checkpoint) / DAY_MS)
  const lost = Math.max(0, daysAway - BOND_DECAY_GRACE_DAYS) * BOND_DECAY_PER_DAY
  if (lost <= 0) return { kami: [...kami], seen: nextSeen, daysAway, lost: 0 }
  return {
    kami: kami.map((k) => (k.bond > BOND_FLOOR ? { ...k, bond: Math.max(BOND_FLOOR, k.bond - lost) } : k)),
    seen: nextSeen,
    daysAway,
    lost,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COLLECTION SUMMARY — what the Codex header reads.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CollectionSummary {
  collected: number
  total: number
  ratio: number
  kami: number
  golden: number
  mastered: number
  grand: number
  byBiome: Record<string, { collected: number; total: number }>
}

export function collectionSummary(
  content: ContentIndex,
  save: Pick<SaveV3, 'kami' | 'folds'>,
): CollectionSummary {
  const byBiome: Record<string, { collected: number; total: number }> = {}
  let collected = 0
  let mastered = 0
  let grand = 0
  for (const s of content.species) {
    const bucket = (byBiome[s.biome] ??= { collected: 0, total: 0 })
    bucket.total++
    const folds = save.folds[s.id] ?? 0
    if (folds > 0) {
      collected++
      bucket.collected++
      const tier = masteryFor(folds)
      if (tier === 'master' || tier === 'grand') mastered++
      if (tier === 'grand') grand++
    }
  }
  const total = content.species.length
  return {
    collected,
    total,
    ratio: total > 0 ? collected / total : 0,
    kami: save.kami.length,
    golden: save.kami.filter((k) => k.golden).length,
    mastered,
    grand,
    byBiome,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRACTICE SHEET

   A separate ledger from folding, because it answers a different question:
   folding asks what you have made, practice asks whether your hands are
   getting steadier. It pays nothing — the reward for practising is being
   better at the thing, and BRAND section 12 keeps it that way.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Which practice a record belongs to.
 *
 * Folding accuracy and reading notation are different skills and deserve
 * separate records — being able to place a corner does not mean you can read a
 * dash-dot line, and merging them would let one hide the other.
 */
export type PracticeKind = 'folds' | 'notation'

/**
 * `folds` keeps the unsuffixed keys it has always used, so a save written
 * before this split keeps its record instead of silently resetting to zero.
 */
function practiceKeys(kind: PracticeKind): { best: string; day: string; streak: string } {
  const suffix = kind === 'folds' ? '' : `/${kind}`
  return {
    best: SYS_KEY.drillBest + suffix,
    day: SYS_KEY.drillDay + suffix,
    streak: SYS_KEY.drillStreak + suffix,
  }
}

export interface PracticeLog {
  /** Best sheet average ever, 0..1. */
  best: number
  /** Days in a row with a sheet finished. */
  streak: number
  /** The last day a sheet was finished, or null. */
  lastDay: string | null
  /** True once today's sheet is done. */
  doneToday: boolean
}

export function readPractice(
  seen: readonly string[],
  dateKey: string,
  kind: PracticeKind = 'folds',
): PracticeLog {
  const key = practiceKeys(kind)
  const lastDay = readFlag(seen, key.day)
  return {
    best: clamp01(readFlagNumber(seen, key.best, 0)),
    streak: Math.max(0, Math.round(readFlagNumber(seen, key.streak, 0))),
    lastDay,
    doneToday: lastDay === dateKey,
  }
}

/**
 * Record a finished sheet.
 *
 * A second sheet on the same day still updates your best — practising more is
 * never punished — but it does not advance the streak twice. And a missed day
 * restarts the streak at one rather than zeroing it, which is the same promise
 * the Daily Fold makes: coming back is always worth something.
 */
export function recordPractice(
  seen: readonly string[],
  dateKey: string,
  score: number,
  kind: PracticeKind = 'folds',
): { seen: string[]; log: PracticeLog } {
  const key = practiceKeys(kind)
  const before = readPractice(seen, dateKey, kind)
  const clean = clamp01(Number.isFinite(score) ? score : 0)

  let next = seen as string[]
  const best = Math.max(before.best, clean)
  if (best !== before.best) next = writeFlag(next, key.best, best.toFixed(4))

  let streak = before.streak
  if (!before.doneToday) {
    const gap = before.lastDay ? daysBetween(before.lastDay, dateKey) : Infinity
    streak = gap === 1 ? before.streak + 1 : 1
    next = writeFlag(next, key.day, dateKey)
    next = writeFlag(next, key.streak, streak)
  }

  return { seen: next, log: { best, streak, lastDay: dateKey, doneToday: true } }
}
