/* PAPER PLANET — the shop: catalog, entitlements, the Fold Journal season, and StoreProvider (+ a real local stub). */

import type { AccentToken, PurchaseResult, SaveV3, Sku, StoreProvider, Washi } from '../contracts'
import { CURRENT_SEASON_ID, FLAG, hasSeen, memoryStorage, type SaveStorage, browserStorage } from './save'

/* ═══════════════════════════════════════════════════════════════════════════
   THE RULES THIS FILE IS BOUND BY — BRAND.md §12, not advisory.

   · Nothing here expires, counts down, or is "only today". There is no
     `expiresAt` in this module and there must never be one. `auditCatalog()`
     below fails the build's self-test if urgency copy ever creeps in.
   · Nothing here is power. Sheets buy Washi (paint). Gold Leaf buys Washi and
     content. Neither buys a fold, a skip, a retry, or an advantage.
   · No loot box is purchasable. The only randomness in the game — sparkle
     paper — is free, unpurchasable, and capped (see progression.ts).
   · A free player can fold, collect and finish forever. Gold Leaf is earned as
     well as sold; see economy.ts for the free income table.
   · Nothing may be sold before the first Kami exists. `isStorefrontOpen()`.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Entitlements ───────────────────────────────────────────────────────── */

/**
 * `SaveV3.entitlements` is a flat list of opaque keys. These are the keys.
 * A purchase writes `sku:<id>` plus everything that sku grants, so a restore
 * can rebuild the list from receipts alone.
 */
export const ENT = {
  /** An active Atelier subscription, monthly or yearly. */
  atelier: 'atelier',
  journalPremium: 'journal.premium',
  cloudSave: 'cloud-save',
  zenUnlimited: 'zen.unlimited',
  ambienceAll: 'ambience.all',
  sku: (skuId: string): string => `sku:${skuId}`,
  washiPack: (packId: string): string => `washi-pack:${packId}`,
  /** A species opened with Gold Leaf, or included in a purchase. */
  species: (speciesId: string): string => `species:${speciesId}`,
  /** The Atelier's fold of the month, e.g. `atelier-fold:2026-08`. */
  atelierFold: (monthKey: string): string => `atelier-fold:${monthKey}`,
} as const

export function hasEntitlement(entitlements: readonly string[], key: string): boolean {
  return entitlements.includes(key)
}

export function isAtelierMember(entitlements: readonly string[]): boolean {
  return hasEntitlement(entitlements, ENT.atelier)
}

/** The Atelier includes every Washi pack, present and future. */
export function ownsWashiPack(entitlements: readonly string[], packId: string): boolean {
  return isAtelierMember(entitlements) || hasEntitlement(entitlements, ENT.washiPack(packId))
}

/** `YYYY-MM` in local time — the key for the Atelier's monthly Grandmaster fold. */
export function monthKey(now: number = Date.now()): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ── The catalog ────────────────────────────────────────────────────────── */

const ATELIER_BENEFITS: string[] = [
  'Every Washi pack — the four in the shop, and every one that follows',
  'Every ambience bed: meadow, rain, night, shore, tearoom',
  'Zen Mode without limit',
  'Your planet kept safely in the cloud',
  'Twice the Sheets from every fold',
  'A Grandmaster fold each month, yours to keep',
]

function sku(
  id: string,
  kind: Sku['kind'],
  name: string,
  tagline: string,
  benefits: string[],
  price: string,
  accent: AccentToken,
  order: number,
  grants: Sku['grants'],
  period?: Sku['period'],
): Sku {
  return { id, kind, name, tagline, benefits, price, accent, order, grants, ...(period ? { period } : {}) }
}

export const SKU_ID = {
  atelierMonthly: 'atelier.monthly',
  atelierYearly: 'atelier.yearly',
  washiKyotoSpring: 'washi.kyoto-spring',
  washiDeepSea: 'washi.deep-sea',
  washiMidnightGarden: 'washi.midnight-garden',
  washiSuminagashi: 'washi.marbled-suminagashi',
  goldLeaf10: 'goldleaf.leaf',
  goldLeaf34: 'goldleaf.book',
  goldLeaf95: 'goldleaf.case',
  journalPremium: 'journal.premium',
} as const

/** Pack ids, as `Washi.source = { type: 'pack', sku }` refers to them. */
export const WASHI_PACK_ID: Record<string, string> = {
  [SKU_ID.washiKyotoSpring]: 'kyoto-spring',
  [SKU_ID.washiDeepSea]: 'deep-sea',
  [SKU_ID.washiMidnightGarden]: 'midnight-garden',
  [SKU_ID.washiSuminagashi]: 'marbled-suminagashi',
}

export const CATALOG: readonly Sku[] = [
  sku(
    SKU_ID.atelierMonthly,
    'subscription',
    'The Atelier',
    'A standing invitation to the back room, where all the paper is kept.',
    ATELIER_BENEFITS,
    '$4.99',
    'kincha',
    10,
    { entitlements: [ENT.atelier, ENT.cloudSave, ENT.zenUnlimited, ENT.ambienceAll] },
    'month',
  ),
  sku(
    SKU_ID.atelierYearly,
    'subscription',
    'The Atelier, by the year',
    'The same room, at ten months for twelve.',
    ATELIER_BENEFITS,
    '$39.99',
    'kincha',
    11,
    { entitlements: [ENT.atelier, ENT.cloudSave, ENT.zenUnlimited, ENT.ambienceAll] },
    'year',
  ),

  sku(
    SKU_ID.washiKyotoSpring,
    'washi-pack',
    'Kyoto Spring',
    'Six papers the colour of a slow April.',
    ['Six Washi papers', 'Blossom, young leaf, rain-on-stone', 'Yours permanently', 'Included with The Atelier'],
    '$2.99',
    'sakura',
    20,
    { entitlements: [ENT.washiPack('kyoto-spring')] },
  ),
  sku(
    SKU_ID.washiDeepSea,
    'washi-pack',
    'Deep Sea',
    'Six papers from below the light.',
    ['Six Washi papers', 'Indigo, kelp, the pale underside of a wave', 'Yours permanently', 'Included with The Atelier'],
    '$2.99',
    'ai',
    21,
    { entitlements: [ENT.washiPack('deep-sea')] },
  ),
  sku(
    SKU_ID.washiMidnightGarden,
    'washi-pack',
    'Midnight Garden',
    'Six papers for folding after everyone is asleep.',
    ['Six Washi papers', 'Iris, moth-wing, lamplit plum', 'Yours permanently', 'Included with The Atelier'],
    '$2.99',
    'murasaki',
    22,
    { entitlements: [ENT.washiPack('midnight-garden')] },
  ),
  sku(
    SKU_ID.washiSuminagashi,
    'washi-pack',
    'Marbled Suminagashi',
    'Six papers floated by hand on water. No two sheets are alike.',
    ['Six Washi papers', 'Each sheet marbles differently every fold', 'Yours permanently', 'Included with The Atelier'],
    '$3.99',
    'ink',
    23,
    { entitlements: [ENT.washiPack('marbled-suminagashi')] },
  ),

  sku(
    SKU_ID.goldLeaf10,
    'goldleaf',
    'A Little Gold Leaf',
    'Ten leaves of gold.',
    ['10 Gold Leaf', 'Gold Leaf is also earned: one for every seven days you fold, and more for mastering a fold'],
    '$1.99',
    'gold-leaf',
    30,
    { goldLeaf: 10 },
  ),
  sku(
    SKU_ID.goldLeaf34,
    'goldleaf',
    'A Book of Gold Leaf',
    'Thirty-four leaves, bound.',
    ['34 Gold Leaf', 'Gold Leaf is also earned: one for every seven days you fold, and more for mastering a fold'],
    '$4.99',
    'gold-leaf',
    31,
    { goldLeaf: 34 },
  ),
  sku(
    SKU_ID.goldLeaf95,
    'goldleaf',
    'A Case of Gold Leaf',
    'Ninety-five leaves, in a wooden case.',
    ['95 Gold Leaf', 'Gold Leaf is also earned: one for every seven days you fold, and more for mastering a fold'],
    '$12.99',
    'gold-leaf',
    32,
    { goldLeaf: 95 },
  ),

  sku(
    SKU_ID.journalPremium,
    'journal',
    'The Fold Journal — the full track',
    'The second column of the Journal, for the whole season.',
    [
      'Every premium reward on all 20 tiers',
      'Five more Washi papers',
      'Eighteen Gold Leaf across the season',
      'The free track stays free, and stays generous',
      'Unclaimed tiers wait for you — the Journal has no deadline',
    ],
    '$6.99',
    'matcha',
    40,
    { entitlements: [ENT.journalPremium] },
  ),
]

export function skuById(id: string, catalog: readonly Sku[] = CATALOG): Sku | null {
  return catalog.find((s) => s.id === id) ?? null
}

export function skusOfKind(kind: Sku['kind'], catalog: readonly Sku[] = CATALOG): Sku[] {
  return catalog.filter((s) => s.kind === kind).sort((a, b) => a.order - b.order)
}

/* ── The Fold Journal ───────────────────────────────────────────────────── */

export type JournalReward =
  | { kind: 'sheets'; amount: number }
  | { kind: 'goldleaf'; amount: number }
  /** A Washi that `src/content` declares with `source: { type: 'journal', tier }`. */
  | { kind: 'washi'; tier: number; note: string }
  | { kind: 'species'; speciesId: string }
  | { kind: 'entitlement'; key: string; note: string }
  | { kind: 'title'; label: string }

export interface JournalTier {
  tier: number
  /** Total XP at which this tier is reached. */
  xpAt: number
  free: JournalReward[]
  premium: JournalReward[]
}

export interface Season {
  id: string
  name: string
  note: string
  xpPerTier: number
  tiers: readonly JournalTier[]
  /**
   * Deliberately absent: an end date. A season ends when the next one begins and
   * the app never counts down to it. Unclaimed tiers are never taken away.
   */
}

export const JOURNAL_XP_PER_TIER = 120
export const JOURNAL_TIER_COUNT = 20

const FREE_GOLDLEAF_TIERS: Record<number, number> = { 4: 2, 8: 2, 12: 2, 16: 2, 20: 4 }
const PREMIUM_GOLDLEAF_TIERS: Record<number, number> = { 2: 2, 5: 2, 8: 2, 11: 2, 14: 2, 17: 2, 20: 6 }
export const FREE_WASHI_TIERS: readonly number[] = [6, 13]
export const PREMIUM_WASHI_TIERS: readonly number[] = [4, 8, 12, 16, 20]

function buildSeasonOne(): JournalTier[] {
  const tiers: JournalTier[] = []
  for (let tier = 1; tier <= JOURNAL_TIER_COUNT; tier++) {
    const free: JournalReward[] = [{ kind: 'sheets', amount: 40 + tier * 6 }]
    const premium: JournalReward[] = [{ kind: 'sheets', amount: 80 + tier * 10 }]
    if (FREE_GOLDLEAF_TIERS[tier]) free.push({ kind: 'goldleaf', amount: FREE_GOLDLEAF_TIERS[tier] })
    if (PREMIUM_GOLDLEAF_TIERS[tier]) premium.push({ kind: 'goldleaf', amount: PREMIUM_GOLDLEAF_TIERS[tier] })
    if (FREE_WASHI_TIERS.includes(tier)) free.push({ kind: 'washi', tier, note: 'A paper from the season' })
    if (PREMIUM_WASHI_TIERS.includes(tier)) premium.push({ kind: 'washi', tier, note: 'A paper from the season' })
    if (tier === 10) free.push({ kind: 'title', label: 'Patient Hands' })
    if (tier === 20) free.push({ kind: 'title', label: 'Season One' })
    if (tier === 20) premium.push({ kind: 'title', label: 'Keeper of the First Season' })
    tiers.push({ tier, xpAt: tier * JOURNAL_XP_PER_TIER, free, premium })
  }
  return tiers
}

export const SEASON_ONE: Season = {
  id: CURRENT_SEASON_ID,
  name: 'The First Season',
  note: 'Twenty tiers. The left column is free and stays free.',
  xpPerTier: JOURNAL_XP_PER_TIER,
  tiers: buildSeasonOne(),
}

/**
 * Let `src/content` (or the shell) attach real Washi and species ids to the
 * season's reward slots without either module importing the other.
 *   withContentRewards(SEASON_ONE, { 6: { free: [{ kind: 'washi', ... }] } })
 */
export function withContentRewards(
  season: Season,
  overrides: Record<number, { free?: JournalReward[]; premium?: JournalReward[] }>,
): Season {
  return {
    ...season,
    tiers: season.tiers.map((t) => {
      const o = overrides[t.tier]
      if (!o) return t
      return { ...t, free: o.free ?? t.free, premium: o.premium ?? t.premium }
    }),
  }
}

export interface JournalProgress {
  /** The highest tier the player's XP has reached. */
  earnedTier: number
  /** The highest tier they have taken the rewards for. */
  claimedTier: number
  xp: number
  xpIntoTier: number
  xpForNextTier: number
  ratio: number
  maxed: boolean
  hasUnclaimed: boolean
}

export function journalProgress(journal: SaveV3['journal'], season: Season = SEASON_ONE): JournalProgress {
  const per = season.xpPerTier
  const earnedTier = Math.min(season.tiers.length, Math.floor(journal.xp / per))
  const maxed = earnedTier >= season.tiers.length
  const xpIntoTier = maxed ? per : journal.xp % per
  return {
    earnedTier,
    claimedTier: Math.min(journal.tier, season.tiers.length),
    xp: journal.xp,
    xpIntoTier,
    xpForNextTier: per,
    ratio: maxed ? 1 : xpIntoTier / per,
    maxed,
    hasUnclaimed: earnedTier > Math.min(journal.tier, season.tiers.length),
  }
}

/** Everything waiting to be taken. Nothing here ever expires. */
export function claimableTiers(journal: SaveV3['journal'], season: Season = SEASON_ONE): JournalTier[] {
  const p = journalProgress(journal, season)
  return season.tiers.filter((t) => t.tier > p.claimedTier && t.tier <= p.earnedTier)
}

export function rewardsForTier(tier: JournalTier, premium: boolean): JournalReward[] {
  return premium ? [...tier.free, ...tier.premium] : [...tier.free]
}

/** A Washi granted by the Journal is owned once its tier is claimed (and paid for, if premium). */
export function journalWashiUnlocked(journal: SaveV3['journal'], tier: number): boolean {
  if (journal.tier < tier) return false
  if (PREMIUM_WASHI_TIERS.includes(tier)) return journal.premium
  return true
}

/* ── Ownership ──────────────────────────────────────────────────────────── */

/**
 * Whether a paper is the player's. This is the one place that resolves every
 * `Washi.source` variant, so `src/content` can price papers however it likes and
 * `systems/` never has to know a single Washi id.
 */
export function ownsWashi(
  source: Washi['source'],
  washiId: string,
  save: Pick<SaveV3, 'washi' | 'entitlements' | 'journal'>,
): boolean {
  if (save.washi.includes(washiId)) return true
  switch (source.type) {
    case 'free':
      return true
    case 'sheets':
    case 'goldleaf':
      return false // bought papers live in `save.washi`, checked above
    case 'pack': {
      const packId = WASHI_PACK_ID[source.sku] ?? source.sku
      return ownsWashiPack(save.entitlements, packId)
    }
    case 'journal':
      return journalWashiUnlocked(save.journal, source.tier)
    default:
      return false
  }
}

/* ── Applying a purchase ────────────────────────────────────────────────── */

export interface PurchasePatch {
  entitlements: string[]
  goldLeaf: number
  washi: string[]
  journalPremium: boolean
}

/** Pure. What a SKU does to a save, expressed as a patch the store folds in. */
export function purchasePatch(save: Pick<SaveV3, 'entitlements' | 'goldLeaf' | 'washi' | 'journal'>, s: Sku): PurchasePatch {
  const entitlements = new Set(save.entitlements)
  // A consumable leaves no ownership marker — you spent it, you do not own it.
  if (!isConsumable(s.kind)) entitlements.add(ENT.sku(s.id))
  for (const key of s.grants.entitlements ?? []) entitlements.add(key)
  const washi = new Set(save.washi)
  for (const id of s.grants.washi ?? []) washi.add(id)
  return {
    entitlements: Array.from(entitlements),
    goldLeaf: save.goldLeaf + (s.grants.goldLeaf ?? 0),
    washi: Array.from(washi),
    journalPremium: save.journal.premium || (s.grants.entitlements ?? []).includes(ENT.journalPremium),
  }
}

/* ── The paywall gate ───────────────────────────────────────────────────── */

/**
 * BRAND.md §12: no paywall before the first Kami. The shop tab, the Codex Washi
 * card, and the Settings line all ask this first, and the answer is load-bearing.
 */
export function isStorefrontOpen(save: Pick<SaveV3, 'kami' | 'seen'>): boolean {
  return save.kami.length > 0 || hasSeen(save.seen, FLAG.firstFold)
}

/* ── The provider seam ──────────────────────────────────────────────────── */

/**
 *                       ══ WHERE THE REAL STORE DROPS IN ══
 *
 * `StoreProvider` (contracts.ts §5) is the entire surface the shop UI touches.
 * `LocalStubProvider` below is a complete, working implementation against
 * localStorage — purchase, restore, cancel, receipts — so the app is playable
 * end-to-end today with real flows, not mocked buttons.
 *
 * To ship on a real store, write one more class implementing the same four
 * methods and hand it to `useGame.getState().setStoreProvider(...)`. Nothing
 * else in the app changes.
 *
 *   RevenueCat   init()      → Purchases.configure({ apiKey }); getOfferings()
 *                listSkus()  → merge localized prices onto CATALOG (see
 *                              `withLocalizedPrices` below — that is the join)
 *                purchase()  → Purchases.purchasePackage()
 *                restore()   → Purchases.restorePurchases() → entitlements
 *
 *   StoreKit 2   init()      → Product.products(for: CATALOG ids)
 *                purchase()  → product.purchase() → verify Transaction
 *                restore()   → Transaction.currentEntitlements
 *                             (subscription expiry arrives here; it is a billing
 *                              fact and is never surfaced as a countdown — see
 *                              the note on `Receipt.renews` below)
 *
 *   Play Billing init()      → BillingClient.queryProductDetailsAsync
 *                purchase()  → launchBillingFlow → PurchasesUpdatedListener
 *                restore()   → queryPurchasesAsync(SUBS | INAPP)
 *
 * The only rule a real provider must keep: entitlements are the source of truth,
 * and losing one must never take away a Kami, a Washi, or a fold already made.
 */

/** Merge live, localized store prices onto the catalog. The join a real provider needs. */
export function withLocalizedPrices(catalog: readonly Sku[], prices: Readonly<Record<string, string>>): Sku[] {
  return catalog.map((s) => (prices[s.id] ? { ...s, price: prices[s.id] } : s))
}

export interface Receipt {
  skuId: string
  purchasedAt: number
  /** Subscriptions only. */
  period?: 'month' | 'year'
  /**
   * Whether the entitlement is live. A real store sets this from its own renewal
   * record; the stub keeps it true until the player cancels. There is no timer,
   * and no screen in this app ever counts down to a renewal.
   */
  renews: boolean
}

export const RECEIPTS_KEY = 'paper-planet-receipts-v1'

export type SimulatedOutcome = 'ok' | 'cancelled' | 'unavailable' | 'failed'

export interface LocalStubOptions {
  storage?: SaveStorage | null
  catalog?: readonly Sku[]
  /** Purchase latency, so the shop's pending state is real. 0 in tests. */
  latencyMs?: number
  now?: () => number
  /** Drive the failure paths from a dev menu without faking anything in the UI. */
  outcome?: SimulatedOutcome
  onReceipts?: (receipts: Receipt[]) => void
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    if (typeof setTimeout === 'function') setTimeout(resolve, ms)
    else resolve()
  })
}

/** Non-consumables are owned once; Gold Leaf is consumable and grants every time. */
export function isConsumable(kind: Sku['kind']): boolean {
  return kind === 'goldleaf'
}

/** A fully working local store. Not a mock — the app ships playable on this. */
export class LocalStubProvider implements StoreProvider {
  private storage: SaveStorage | null
  private catalog: readonly Sku[]
  private latencyMs: number
  private now: () => number
  private outcome: SimulatedOutcome
  private onReceipts: ((receipts: Receipt[]) => void) | undefined
  private receipts: Receipt[] = []
  private ready = false

  constructor(options: LocalStubOptions = {}) {
    this.storage = options.storage === undefined ? browserStorage() ?? memoryStorage() : options.storage
    this.catalog = options.catalog ?? CATALOG
    this.latencyMs = options.latencyMs ?? 260
    this.now = options.now ?? (() => Date.now())
    this.outcome = options.outcome ?? 'ok'
    this.onReceipts = options.onReceipts
  }

  async init(): Promise<void> {
    this.receipts = this.readReceipts()
    this.ready = true
    await sleep(0)
  }

  listSkus(): Sku[] {
    return [...this.catalog].sort((a, b) => a.order - b.order)
  }

  isAvailable(): boolean {
    return this.storage !== null
  }

  /** Dev affordance: exercise cancel and failure paths for real in the shop. */
  setSimulatedOutcome(outcome: SimulatedOutcome): void {
    this.outcome = outcome
  }

  async purchase(skuId: string): Promise<PurchaseResult> {
    if (!this.ready) await this.init()
    await sleep(this.latencyMs)
    const s = skuById(skuId, this.catalog)
    if (!s) return { ok: false, reason: 'unavailable', message: 'That item is not in the shop.' }
    if (!this.isAvailable()) return { ok: false, reason: 'unavailable', message: 'The shop is not reachable right now.' }
    if (this.outcome === 'cancelled') return { ok: false, reason: 'cancelled' }
    if (this.outcome === 'unavailable') return { ok: false, reason: 'unavailable', message: 'The shop is not reachable right now.' }
    if (this.outcome === 'failed') return { ok: false, reason: 'failed', message: 'The purchase did not go through. Nothing was charged.' }

    const existing = this.receipts.find((r) => r.skuId === skuId)
    if (existing && !isConsumable(s.kind)) {
      // Already owned. A real store returns the same success; we do not double-grant.
      existing.renews = true
      this.writeReceipts()
      return { ok: true, sku: skuId }
    }
    const receipt: Receipt = { skuId, purchasedAt: this.now(), renews: true }
    if (s.period) receipt.period = s.period
    this.receipts.push(receipt)
    this.writeReceipts()
    return { ok: true, sku: skuId }
  }

  async restore(): Promise<string[]> {
    if (!this.ready) await this.init()
    await sleep(this.latencyMs)
    return this.entitlements()
  }

  /** The "manage" affordance. Cancelling keeps everything already earned. */
  cancelSubscription(skuId: string): void {
    const receipt = this.receipts.find((r) => r.skuId === skuId)
    if (!receipt) return
    receipt.renews = false
    this.writeReceipts()
  }

  /** Entitlement keys implied by the receipts on file. Consumables grant none. */
  entitlements(): string[] {
    const out = new Set<string>()
    for (const r of this.receipts) {
      const s = skuById(r.skuId, this.catalog)
      if (!s) continue
      if (isConsumable(s.kind)) continue
      if (s.kind === 'subscription' && !r.renews) continue
      out.add(ENT.sku(s.id))
      for (const key of s.grants.entitlements ?? []) out.add(key)
    }
    return Array.from(out)
  }

  getReceipts(): readonly Receipt[] {
    return this.receipts
  }

  /** Wipe local receipts. Used by "reset everything" in Settings. */
  clear(): void {
    this.receipts = []
    this.writeReceipts()
  }

  private readReceipts(): Receipt[] {
    if (!this.storage) return []
    try {
      const raw = this.storage.getItem(RECEIPTS_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.flatMap((entry): Receipt[] => {
        if (typeof entry !== 'object' || entry === null) return []
        const r = entry as Record<string, unknown>
        if (typeof r.skuId !== 'string') return []
        const receipt: Receipt = {
          skuId: r.skuId,
          purchasedAt: typeof r.purchasedAt === 'number' && Number.isFinite(r.purchasedAt) ? r.purchasedAt : 0,
          renews: typeof r.renews === 'boolean' ? r.renews : true,
        }
        if (r.period === 'month' || r.period === 'year') receipt.period = r.period
        return [receipt]
      })
    } catch {
      return []
    }
  }

  private writeReceipts(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(RECEIPTS_KEY, JSON.stringify(this.receipts))
    } catch {
      /* purchases still apply this session; a restore will rebuild them */
    }
    try {
      this.onReceipts?.(this.receipts)
    } catch {
      /* a listener must not break a purchase */
    }
  }
}

/* ── Ethics audit ───────────────────────────────────────────────────────── */

const URGENCY_PATTERNS: readonly RegExp[] = [
  /\bexpires?\b/i,
  /\bexpiring\b/i,
  /\blimited[- ]time\b/i,
  /\bhurry\b/i,
  /\bact now\b/i,
  /\blast chance\b/i,
  /\bonly today\b/i,
  /\bends? (in|soon)\b/i,
  /\bdon'?t miss\b/i,
  /\bwhile (stocks|supplies)\b/i,
  /\b\d+% off\b/i,
  /\bwas \$/i,
  /\bloot ?box\b/i,
  /\bmystery box\b/i,
  /\bgacha\b/i,
]

const POWER_PATTERNS: readonly RegExp[] = [
  /\bskip\b/i,
  /\binstant(ly)? (finish|complete|unlock all)\b/i,
  /\bauto[- ]?fold\b/i,
  /\bextra (lives|energy|attempts)\b/i,
  /\benergy\b/i,
  /\brefill\b/i,
  /\bboost your\b/i,
]

/**
 * Fails loudly if the shop ever drifts from BRAND.md §12. Run by the self-test;
 * safe to call from a dev overlay too. An empty array means the shop is clean.
 */
export function auditCatalog(catalog: readonly Sku[] = CATALOG): string[] {
  const problems: string[] = []
  const allowedKinds: readonly Sku['kind'][] = ['subscription', 'washi-pack', 'goldleaf', 'journal', 'species']
  const seenIds = new Set<string>()

  for (const s of catalog) {
    const copy = [s.name, s.tagline, ...s.benefits].join(' · ')
    for (const re of URGENCY_PATTERNS) {
      if (re.test(copy)) problems.push(`${s.id}: urgency or scarcity copy matches ${re}`)
    }
    for (const re of POWER_PATTERNS) {
      if (re.test(copy)) problems.push(`${s.id}: sells power — copy matches ${re}`)
    }
    if (!allowedKinds.includes(s.kind)) problems.push(`${s.id}: unknown kind "${s.kind}"`)
    if (!s.price.trim()) problems.push(`${s.id}: no display price`)
    if (seenIds.has(s.id)) problems.push(`${s.id}: duplicate sku id`)
    seenIds.add(s.id)
    if (s.kind === 'subscription' && !s.period) problems.push(`${s.id}: a subscription must declare a period`)
    const grantKeys = Object.keys(s.grants)
    for (const key of grantKeys) {
      if (key !== 'entitlements' && key !== 'goldLeaf' && key !== 'washi') {
        problems.push(`${s.id}: grants "${key}", which is outside cosmetic / convenience / content`)
      }
    }
    if ((s.grants.goldLeaf ?? 0) < 0) problems.push(`${s.id}: negative Gold Leaf`)
    // Structural: contracts.Sku has no expiry field, and none may be smuggled in.
    if ('expiresAt' in (s as unknown as Record<string, unknown>)) problems.push(`${s.id}: carries an expiry`)
  }
  return problems
}
