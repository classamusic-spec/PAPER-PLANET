/* PAPER PLANET — the root game store: one Zustand store, fine-grained selectors, and every action screens dispatch. */

import { useMemo } from 'react'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand/react'
import { useShallow } from 'zustand/react/shallow'

import type {
  AudioBus,
  BiomeId,
  KamiInstance,
  MasteryTier,
  PurchaseResult,
  SaveV3,
  Settings,
  Sku,
  StoreProvider,
  StudioResult,
  StudioSession,
  Vec2,
} from '../contracts'

import {
  ENT,
  LocalStubProvider,
  SEASON_ONE,
  type JournalTier,
  type Season,
  claimableTiers,
  isAtelierMember,
  isStorefrontOpen,
  journalProgress,
  ownsWashi,
  purchasePatch,
  rewardsForTier,
  skuById,
} from './commerce'

import {
  type RewardBreakdown,
  canAfford,
  earn,
  foldReward,
  migrationNote,
  spend,
  type Price,
} from './economy'

import {
  BOND_START,
  type CollectionSummary,
  type TendKind,
  type TendOutcome,
  type UnlockState,
  claimMasteryMilestone,
  readPractice,
  recordPractice as recordPracticeIn,
  type PracticeLog,
  collectionSize,
  collectionSummary,
  decayBond,
  evaluateAllUnlocks,
  evaluateUnlock,
  masteryFor,
  masteryProgress,
  newlyUnlockedBiomes,
  rollGolden,
  tendKami,
  unlockContextFrom,
  unlockedBiomes,
} from './progression'

import {
  type DailyClaim,
  claimDailyFold,
  dailyStatus,
  localDateKey,
  openDay,
} from './daily'

import {
  FLAG,
  type FlagName,
  type LoadResult,
  type PersistStatus,
  type Persister,
  type SaveContext,
  type SaveSource,
  type SaveStorage,
  browserStorage,
  createPersister,
  defaultSave,
  dropLegacyKeys,
  exportSave,
  hasSeen as hasSeenIn,
  importSave,
  loadSave,
  makeUid,
  markSeen as markSeenIn,
  normalizeSave,
  posForUid,
  SAVE_KEY,
} from './save'

import { applySettings, browserEnv, defaultSettings, type SettingsEnv, watchSystemTheme } from './settings'
import { systemRng, clamp01, type Rng } from './rand'
import { EMPTY_CONTENT, buildContentIndex, type ContentIndex, type SpeciesLike, type WashiLike, type BiomeLike } from './types'

/* ═══════════════════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════════════════ */

/** One quiet line for the shell to surface. Never modal, never blocking. */
export interface Notice {
  id: string
  text: string
  tone: 'quiet' | 'reward' | 'warning'
}

export interface FoldOutcome {
  ok: boolean
  kami: KamiInstance | null
  reward: RewardBreakdown
  masteryFrom: MasteryTier
  masteryTo: MasteryTier
  masteryUp: boolean
  /** Gold Leaf from mastery milestones and the streak, already banked. */
  goldLeaf: number
  newBiomes: BiomeId[]
  /** Species ids that just became foldable because of this fold. */
  unlockedSpecies: string[]
  daily: DailyClaim | null
  message: string
}

export interface JournalClaim {
  tiers: JournalTier[]
  sheets: number
  goldLeaf: number
  titles: string[]
  /** Journal tiers that carry a Washi — content resolves the actual paper. */
  washiTiers: number[]
}

export interface GameState {
  /* ── persisted: this is SaveV3, flattened ── */
  version: 3
  kami: KamiInstance[]
  folds: Record<string, number>
  washi: string[]
  activeWashi: string
  sheets: number
  goldLeaf: number
  biomes: BiomeId[]
  daily: SaveV3['daily']
  journal: SaveV3['journal']
  entitlements: string[]
  settings: Settings
  stats: SaveV3['stats']
  seen: string[]

  /* ── runtime only ── */
  hydrated: boolean
  saveSource: SaveSource
  storageOk: boolean
  persistStatus: PersistStatus | null
  repairs: string[]
  content: ContentIndex
  contentReady: boolean
  season: Season
  /** Local `YYYY-MM-DD`. Everything date-shaped reads this, never `Date.now()`. */
  today: string
  lastOutcome: FoldOutcome | null
  notice: Notice | null
  purchasePending: string | null
  skus: Sku[]
}

export interface GameActions {
  /* boot */
  attachContent(input: { species?: readonly SpeciesLike[]; washi?: readonly WashiLike[]; biomes?: readonly BiomeLike[] }): void
  hydrate(): LoadResult
  refreshDay(): void
  setStoreProvider(provider: StoreProvider | null): Promise<void>

  /* the fold */
  rollGoldenPaper(quality?: number): boolean
  completeFold(result: StudioResult, mode?: StudioSession['mode']): FoldOutcome
  recordStudioTime(seconds: number, creases: number): void

  /* currency */
  grantSheets(amount: number): void
  grantGoldLeaf(amount: number): void
  spendPrice(price: Price): boolean

  /* washi */
  setActiveWashi(washiId: string): void
  buyWashi(washi: WashiLike): { ok: boolean; reason?: string }

  /* kami */
  renameKami(uid: string, nickname: string | null): void
  moveKami(uid: string, pos: Vec2): void
  tend(uid: string, kind: TendKind): TendOutcome | null

  /* journal */
  addJournalXp(amount: number): void
  claimJournal(): JournalClaim

  /* commerce */
  purchase(skuId: string): Promise<PurchaseResult>
  restorePurchases(): Promise<string[]>
  unlockSpeciesWithGoldLeaf(speciesId: string): { ok: boolean; reason?: string }

  /* settings */
  updateSettings(patch: Partial<Settings>): void
  setVolume(bus: AudioBus, value: number): void
  resetSettings(): void

  /* flags & notices */
  markSeen(flag: FlagName): void
  /** Record a finished Practice Sheet. Pays nothing; it only keeps the record. */
  recordPractice(score: number): PracticeLog
  dismissNotice(): void

  /* save management */
  exportSaveJson(): string
  importSaveJson(json: string): { ok: boolean; error?: string }
  resetEverything(): void
  flushSave(): boolean
  toSave(): SaveV3
}

export type GameStore = GameState & GameActions

const PERSISTED_KEYS = [
  'kami',
  'folds',
  'washi',
  'activeWashi',
  'sheets',
  'goldLeaf',
  'biomes',
  'daily',
  'journal',
  'entitlements',
  'settings',
  'stats',
  'seen',
] as const

export function toSaveV3(state: GameState): SaveV3 {
  return {
    version: 3,
    kami: state.kami,
    folds: state.folds,
    washi: state.washi,
    activeWashi: state.activeWashi,
    sheets: state.sheets,
    goldLeaf: state.goldLeaf,
    biomes: state.biomes,
    daily: state.daily,
    journal: state.journal,
    entitlements: state.entitlements,
    settings: state.settings,
    stats: state.stats,
    seen: state.seen,
  }
}

function spreadSave(save: SaveV3): Pick<GameState, (typeof PERSISTED_KEYS)[number] | 'version'> {
  return {
    version: 3,
    kami: save.kami,
    folds: save.folds,
    washi: save.washi,
    activeWashi: save.activeWashi,
    sheets: save.sheets,
    goldLeaf: save.goldLeaf,
    biomes: save.biomes,
    daily: save.daily,
    journal: save.journal,
    entitlements: save.entitlements,
    settings: save.settings,
    stats: save.stats,
    seen: save.seen,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE STORE FACTORY
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GameStoreOptions {
  storage?: SaveStorage | null
  now?: () => number
  rng?: Rng
  env?: SettingsEnv
  provider?: StoreProvider | null
  /** Off in tests that only want the pure reducers. */
  persist?: boolean
  season?: Season
  /** Paint `data-theme` etc. onto `<html>`. Off under node. */
  applyToDocument?: boolean
  doc?: Document
  persistDebounceMs?: number
  persistMinIntervalMs?: number
}

export function createGameStore(options: GameStoreOptions = {}): StoreApi<GameStore> {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const now = options.now ?? (() => Date.now())
  const rng = options.rng ?? systemRng
  const env = options.env ?? browserEnv
  const season = options.season ?? SEASON_ONE
  const applyToDoc = options.applyToDocument ?? typeof document !== 'undefined'
  const doc = options.doc

  let provider: StoreProvider | null = options.provider === undefined ? null : options.provider
  let persister: Persister | null = null

  const paint = (settings: Settings): void => {
    if (applyToDoc) applySettings(settings, env, doc)
  }

  const saveContext = (content: ContentIndex): SaveContext => ({
    knownSpecies: content.species.length > 0 ? new Set(content.speciesIds) : null,
    knownWashi: content.washiIds.size > 0 ? content.washiIds : null,
    // The starter paper is the first one content gives away for nothing.
    defaultWashiId: (content.washi.find((w) => w.source.type === 'free') ?? content.washi[0])?.id,
    now: now(),
    env,
  })

  const store = createStore<GameStore>()((set, get) => {
    const base = defaultSave({ now: now(), env })

    return {
      ...spreadSave(base),

      hydrated: false,
      saveSource: 'new',
      storageOk: storage !== null,
      persistStatus: null,
      repairs: [],
      content: EMPTY_CONTENT,
      contentReady: false,
      season,
      today: localDateKey(now()),
      lastOutcome: null,
      notice: null,
      purchasePending: null,
      skus: [],

      /* ── boot ────────────────────────────────────────────────────────── */

      attachContent(input) {
        const content = buildContentIndex(input)
        // Re-validate whatever is already loaded against the real catalogue, so a
        // species removed between releases is dropped rather than crashed on.
        const { save, repairs } = normalizeSave(toSaveV3(get()), saveContext(content))
        const today = localDateKey(now())
        const day = openDay(save.daily, today, content.speciesIds)
        const biomes = unlockedBiomes(content.biomes, collectionSize(save.folds), save.biomes)
        set({
          ...spreadSave({ ...save, daily: day.daily, biomes }),
          content,
          contentReady: content.species.length > 0,
          today,
          repairs: [...get().repairs, ...repairs, ...day.repairs],
        })
      },

      hydrate() {
        const content = get().content
        const result = loadSave({ ...saveContext(content), storage })
        const nowMs = now()

        // Everyone drifts a little while you are away, and never below the floor.
        const decay = decayBond(result.save.kami, result.save.seen, nowMs)
        const today = localDateKey(nowMs)
        const day = openDay({ ...result.save.daily }, today, content.speciesIds)
        const biomes = unlockedBiomes(content.biomes, collectionSize(result.save.folds), result.save.biomes)

        const save: SaveV3 = {
          ...result.save,
          kami: decay.kami,
          seen: decay.seen,
          daily: day.daily,
          biomes,
        }

        paint(save.settings)

        let notice: Notice | null = null
        if (result.source === 'v2' || result.source === 'v1') {
          notice = {
            id: `migrated:${result.source}`,
            text: migrationNote({ sheets: save.sheets, goldLeaf: save.goldLeaf }),
            tone: 'quiet',
          }
        } else if (day.message) {
          notice = { id: `day:${today}`, text: day.message, tone: 'quiet' }
        }
        if (!result.storageOk) {
          notice = {
            id: 'storage',
            text: 'This device will not keep a save right now. You can still fold; export when you are done.',
            tone: 'warning',
          }
        }

        set({
          ...spreadSave(save),
          hydrated: true,
          saveSource: result.source,
          storageOk: result.storageOk,
          repairs: [...result.repairs, ...day.repairs],
          today,
          notice,
        })

        // Write the migrated save through immediately, then retire the old keys.
        if (result.source === 'v1' || result.source === 'v2') {
          persister?.schedule(toSaveV3(get()))
          if (persister?.flush()) dropLegacyKeys(storage)
        }
        return { ...result, save }
      },

      refreshDay() {
        const state = get()
        const today = localDateKey(now())
        if (today === state.today && state.daily.todaySpecies !== null) return
        const day = openDay(state.daily, today, state.content.speciesIds)
        set({
          today,
          daily: day.daily,
          notice: day.message ? { id: `day:${today}`, text: day.message, tone: 'quiet' } : state.notice,
        })
      },

      async setStoreProvider(next) {
        provider = next
        if (!next) {
          set({ skus: [] })
          return
        }
        await next.init()
        set({ skus: next.listSkus() })
        // Entitlements are the store's to know; fold in anything already owned.
        try {
          const restored = await next.restore()
          if (restored.length > 0) {
            const merged = Array.from(new Set([...get().entitlements, ...restored]))
            set({ entitlements: merged, journal: { ...get().journal, premium: merged.includes(ENT.journalPremium) } })
          }
        } catch {
          /* a store that cannot be reached is not an error the player must see */
        }
      },

      /* ── the fold ────────────────────────────────────────────────────── */

      rollGoldenPaper(quality = 0.5) {
        const state = get()
        const outcome = rollGolden({ seen: state.seen, dateKey: state.today, quality, rng })
        set({ seen: outcome.seen })
        return outcome.golden
      },

      completeFold(result, mode = 'normal') {
        const state = get()
        const nowMs = now()

        const emptyReward: RewardBreakdown = {
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

        // Zen never ends and never pays. It still counts as time at the desk.
        if (mode === 'zen') {
          set({
            stats: {
              ...state.stats,
              totalCreases: state.stats.totalCreases + Math.max(0, Math.round(result.creases)),
              studioSeconds: state.stats.studioSeconds + Math.max(0, Math.round(result.seconds)),
            },
          })
          const outcome: FoldOutcome = {
            ok: true,
            kami: null,
            reward: emptyReward,
            masteryFrom: 'none',
            masteryTo: 'none',
            masteryUp: false,
            goldLeaf: 0,
            newBiomes: [],
            unlockedSpecies: [],
            daily: null,
            message: 'A quiet hour, and nothing to show for it. That was the point.',
          }
          set({ lastOutcome: outcome })
          return outcome
        }

        const species = state.content.speciesById.get(result.speciesId)
        if (!species) {
          const outcome: FoldOutcome = {
            ok: false,
            kami: null,
            reward: emptyReward,
            masteryFrom: 'none',
            masteryTo: 'none',
            masteryUp: false,
            goldLeaf: 0,
            newBiomes: [],
            unlockedSpecies: [],
            daily: null,
            message: 'That fold is not in the book.',
          }
          set({ lastOutcome: outcome })
          return outcome
        }

        const before = state.folds[species.id] ?? 0
        const after = before + 1
        const masteryFrom = masteryFor(before)
        const masteryTo = masteryFor(after)
        const atelier = isAtelierMember(state.entitlements)

        const washiId =
          state.content.washiIds.size > 0 && !state.content.washiIds.has(result.washiId)
            ? state.activeWashi
            : result.washiId

        const reward = foldReward(species, result, { foldCount: after, mastery: masteryTo, mode, atelier })

        const uid = makeUid(nowMs, rng)
        const kami: KamiInstance = {
          uid,
          speciesId: species.id,
          washiId,
          nickname: null,
          foldedAt: nowMs,
          pos: posForUid(uid),
          bond: BOND_START,
          golden: result.golden,
          quality: clamp01(result.quality),
        }

        const folds = { ...state.folds, [species.id]: after }
        let seen = state.seen
        let goldLeaf = state.goldLeaf
        let sheets = state.sheets + reward.sheets

        // Mastery milestones pay Gold Leaf once per species, ever.
        if (masteryTo !== masteryFrom) {
          const milestone = claimMasteryMilestone(seen, species.id, masteryTo)
          goldLeaf += milestone.goldLeaf
          seen = milestone.seen
        }
        if (before === 0) seen = markSeenIn(seen, FLAG.firstFold)

        // Folding today's Kami is the Daily Fold, whichever door you came in by.
        let dailyClaim: DailyClaim | null = null
        let daily = state.daily
        if (state.daily.todaySpecies === species.id && state.daily.lastFold !== state.today) {
          dailyClaim = claimDailyFold(state.daily, seen, state.today)
          daily = dailyClaim.daily
          seen = dailyClaim.seen
          goldLeaf += dailyClaim.goldLeaf
        }

        const journalXp = state.journal.xp + reward.journalXp
        const journal = { ...state.journal, xp: journalXp }

        const unlocksBefore = evaluateAllUnlocks(state.content, unlockContextFrom(state))
        const nextBiomes = unlockedBiomes(state.content.biomes, collectionSize(folds), state.biomes)
        const newBiomes = newlyUnlockedBiomes(state.content.biomes, collectionSize(folds), state.biomes)

        const nextCore = {
          kami: [...state.kami, kami],
          folds,
          sheets,
          goldLeaf,
          biomes: nextBiomes,
          entitlements: state.entitlements,
          seen,
          daily,
          journal,
          stats: {
            ...state.stats,
            totalFolds: state.stats.totalFolds + 1,
            totalCreases: state.stats.totalCreases + Math.max(0, Math.round(result.creases)),
            studioSeconds: state.stats.studioSeconds + Math.max(0, Math.round(result.seconds)),
          },
        }

        const unlocksAfter = evaluateAllUnlocks(state.content, unlockContextFrom({ ...state, ...nextCore }))
        const unlockedSpecies: string[] = []
        for (const [id, next] of unlocksAfter) {
          if (next.unlocked && unlocksBefore.get(id)?.unlocked === false) unlockedSpecies.push(id)
        }

        const message = ((): string => {
          if (dailyClaim) return dailyClaim.message
          if (masteryTo !== masteryFrom && masteryTo !== 'novice') return `${species.name}. ${masteryUpNote(masteryTo)}`
          if (before === 0) return `A ${species.name}. It is yours.`
          return `Another ${species.name}. This one is a little better.`
        })()

        const outcome: FoldOutcome = {
          ok: true,
          kami,
          reward: { ...reward, goldLeaf: goldLeaf - state.goldLeaf },
          masteryFrom,
          masteryTo,
          masteryUp: masteryTo !== masteryFrom,
          goldLeaf: goldLeaf - state.goldLeaf,
          newBiomes,
          unlockedSpecies,
          daily: dailyClaim,
          message,
        }

        set({ ...nextCore, lastOutcome: outcome })
        return outcome
      },

      recordStudioTime(seconds, creases) {
        const state = get()
        set({
          stats: {
            ...state.stats,
            totalCreases: state.stats.totalCreases + Math.max(0, Math.round(creases)),
            studioSeconds: state.stats.studioSeconds + Math.max(0, Math.round(seconds)),
          },
        })
      },

      /* ── currency ────────────────────────────────────────────────────── */

      grantSheets(amount) {
        const w = earn({ sheets: get().sheets, goldLeaf: get().goldLeaf }, { sheets: amount })
        set({ sheets: w.sheets, goldLeaf: w.goldLeaf })
      },

      grantGoldLeaf(amount) {
        const w = earn({ sheets: get().sheets, goldLeaf: get().goldLeaf }, { goldLeaf: amount })
        set({ sheets: w.sheets, goldLeaf: w.goldLeaf })
      },

      spendPrice(price) {
        const state = get()
        const result = spend({ sheets: state.sheets, goldLeaf: state.goldLeaf }, price)
        if (!result.ok) return false
        set({ sheets: result.wallet.sheets, goldLeaf: result.wallet.goldLeaf })
        return true
      },

      /* ── washi ───────────────────────────────────────────────────────── */

      setActiveWashi(washiId) {
        const state = get()
        const known = state.content.washiById.get(washiId)
        if (state.content.washiIds.size > 0 && !known) return
        if (known && !ownsWashi(known.source, washiId, state)) return
        set({ activeWashi: washiId })
      },

      buyWashi(washi) {
        const state = get()
        if (ownsWashi(washi.source, washi.id, state)) return { ok: false, reason: 'You already have this paper.' }
        if (washi.source.type !== 'sheets' && washi.source.type !== 'goldleaf') {
          return { ok: false, reason: 'This paper comes another way.' }
        }
        const price: Price =
          washi.source.type === 'sheets' ? { sheets: washi.source.cost } : { goldLeaf: washi.source.cost }
        if (!canAfford({ sheets: state.sheets, goldLeaf: state.goldLeaf }, price)) {
          return { ok: false, reason: 'Not enough yet. Fold a few more.' }
        }
        const result = spend({ sheets: state.sheets, goldLeaf: state.goldLeaf }, price)
        if (!result.ok) return { ok: false, reason: 'Not enough yet. Fold a few more.' }
        set({
          sheets: result.wallet.sheets,
          goldLeaf: result.wallet.goldLeaf,
          washi: Array.from(new Set([...state.washi, washi.id])),
          activeWashi: washi.id,
        })
        return { ok: true }
      },

      /* ── kami ────────────────────────────────────────────────────────── */

      renameKami(uid, nickname) {
        const trimmed = nickname?.trim().slice(0, 24) ?? ''
        set({
          kami: get().kami.map((k) => (k.uid === uid ? { ...k, nickname: trimmed.length > 0 ? trimmed : null } : k)),
        })
      },

      moveKami(uid, pos) {
        const next: Vec2 = [clamp01(pos[0]), clamp01(pos[1])]
        set({ kami: get().kami.map((k) => (k.uid === uid ? { ...k, pos: next } : k)) })
      },

      tend(uid, kind) {
        const state = get()
        const kami = state.kami.find((k) => k.uid === uid)
        if (!kami) return null
        const outcome = tendKami({ kami, seen: state.seen, dateKey: state.today, kind })
        set({
          kami: state.kami.map((k) => (k.uid === uid ? { ...k, bond: outcome.bond } : k)),
          seen: outcome.seen,
        })
        return outcome
      },

      /* ── journal ─────────────────────────────────────────────────────── */

      addJournalXp(amount) {
        const state = get()
        set({ journal: { ...state.journal, xp: Math.max(0, state.journal.xp + Math.round(amount)) } })
      },

      claimJournal() {
        const state = get()
        const tiers = claimableTiers(state.journal, state.season)
        const claim: JournalClaim = { tiers, sheets: 0, goldLeaf: 0, titles: [], washiTiers: [] }
        if (tiers.length === 0) return claim

        const entitlements = new Set(state.entitlements)
        for (const tier of tiers) {
          for (const reward of rewardsForTier(tier, state.journal.premium)) {
            switch (reward.kind) {
              case 'sheets':
                claim.sheets += reward.amount
                break
              case 'goldleaf':
                claim.goldLeaf += reward.amount
                break
              case 'washi':
                claim.washiTiers.push(reward.tier)
                break
              case 'species':
                entitlements.add(ENT.species(reward.speciesId))
                break
              case 'entitlement':
                entitlements.add(reward.key)
                break
              case 'title':
                claim.titles.push(reward.label)
                break
            }
          }
        }
        const highest = tiers[tiers.length - 1]?.tier ?? state.journal.tier
        set({
          sheets: state.sheets + claim.sheets,
          goldLeaf: state.goldLeaf + claim.goldLeaf,
          entitlements: Array.from(entitlements),
          journal: { ...state.journal, tier: highest },
        })
        return claim
      },

      /* ── commerce ────────────────────────────────────────────────────── */

      async purchase(skuId) {
        const state = get()
        if (!provider) return { ok: false, reason: 'unavailable', message: 'The shop is not open right now.' }
        // BRAND.md §12: nothing may be sold before the first Kami exists.
        if (!isStorefrontOpen(state)) {
          return { ok: false, reason: 'unavailable', message: 'Fold your first Kami first.' }
        }
        set({ purchasePending: skuId })
        try {
          const result = await provider.purchase(skuId)
          if (result.ok) {
            const sku = skuById(skuId, provider.listSkus())
            if (sku) {
              const current = get()
              const patch = purchasePatch(current, sku)
              set({
                entitlements: patch.entitlements,
                goldLeaf: patch.goldLeaf,
                washi: patch.washi,
                journal: { ...current.journal, premium: patch.journalPremium },
                notice: { id: `bought:${skuId}`, text: `${sku.name} is yours.`, tone: 'reward' },
              })
            }
          }
          return result
        } finally {
          set({ purchasePending: null })
        }
      },

      async restorePurchases() {
        if (!provider) return []
        const restored = await provider.restore()
        if (restored.length === 0) return []
        const state = get()
        const merged = Array.from(new Set([...state.entitlements, ...restored]))
        set({
          entitlements: merged,
          journal: { ...state.journal, premium: merged.includes(ENT.journalPremium) },
        })
        return restored
      },

      unlockSpeciesWithGoldLeaf(speciesId) {
        const state = get()
        const species = state.content.speciesById.get(speciesId)
        if (!species) return { ok: false, reason: 'That fold is not in the book.' }
        if (species.unlock.type !== 'goldleaf') return { ok: false, reason: 'This fold opens another way.' }
        const status = evaluateUnlock(speciesId, species.unlock, unlockContextFrom(state))
        if (status.unlocked) return { ok: false, reason: 'Already yours.' }
        const cost = status.cost?.goldLeaf ?? species.unlock.cost
        const result = spend({ sheets: state.sheets, goldLeaf: state.goldLeaf }, { goldLeaf: cost })
        if (!result.ok) return { ok: false, reason: 'Not enough Gold Leaf yet.' }
        set({
          sheets: result.wallet.sheets,
          goldLeaf: result.wallet.goldLeaf,
          entitlements: Array.from(new Set([...state.entitlements, ENT.species(speciesId)])),
        })
        return { ok: true }
      },

      /* ── settings ────────────────────────────────────────────────────── */

      updateSettings(patch) {
        const next: Settings = { ...get().settings, ...patch, volumes: { ...get().settings.volumes, ...patch.volumes } }
        paint(next)
        set({ settings: next })
      },

      setVolume(bus, value) {
        const settings = get().settings
        set({ settings: { ...settings, volumes: { ...settings.volumes, [bus]: clamp01(value) } } })
      },

      resetSettings() {
        const next = defaultSettings(env)
        paint(next)
        set({ settings: next })
      },

      /* ── flags & notices ─────────────────────────────────────────────── */

      markSeen(flag) {
        set({ seen: markSeenIn(get().seen, flag) })
      },

      recordPractice(score) {
        const state = get()
        const out = recordPracticeIn(state.seen, state.today, score)
        set({ seen: out.seen })
        return out.log
      },

      dismissNotice() {
        set({ notice: null })
      },

      /* ── save management ─────────────────────────────────────────────── */

      toSave() {
        return toSaveV3(get())
      },

      exportSaveJson() {
        return exportSave(toSaveV3(get()), now())
      },

      importSaveJson(json) {
        const state = get()
        const result = importSave(json, saveContext(state.content))
        if (!result.ok) return { ok: false, error: result.error }
        const today = localDateKey(now())
        const day = openDay(result.save.daily, today, state.content.speciesIds)
        const biomes = unlockedBiomes(state.content.biomes, collectionSize(result.save.folds), result.save.biomes)
        paint(result.save.settings)
        set({
          ...spreadSave({ ...result.save, daily: day.daily, biomes }),
          today,
          repairs: [...result.repairs, ...day.repairs],
          saveSource: result.source,
          notice: { id: 'imported', text: 'Your planet is back.', tone: 'quiet' },
        })
        persister?.schedule(toSaveV3(get()))
        persister?.flush()
        return { ok: true }
      },

      resetEverything() {
        const state = get()
        const fresh = defaultSave({ ...saveContext(state.content), now: now() })
        paint(fresh.settings)
        set({
          ...spreadSave(fresh),
          today: localDateKey(now()),
          lastOutcome: null,
          repairs: [],
          saveSource: 'new',
          notice: { id: 'reset', text: 'A clean sheet.', tone: 'quiet' },
        })
        persister?.schedule(toSaveV3(get()))
        persister?.flush()
      },

      flushSave() {
        return persister?.flush() ?? false
      },
    }
  })

  /* ── persistence wiring ─────────────────────────────────────────────── */

  if (options.persist !== false) {
    persister = createPersister({
      storage,
      key: SAVE_KEY,
      now,
      ...(options.persistDebounceMs !== undefined ? { debounceMs: options.persistDebounceMs } : {}),
      ...(options.persistMinIntervalMs !== undefined ? { minIntervalMs: options.persistMinIntervalMs } : {}),
      onStatus: (status) => store.setState({ persistStatus: status }),
    })

    store.subscribe((state, prev) => {
      for (const key of PERSISTED_KEYS) {
        if (state[key] !== prev[key]) {
          persister?.schedule(toSaveV3(state))
          return
        }
      }
    })
  }

  return store
}

function masteryUpNote(tier: MasteryTier): string {
  switch (tier) {
    case 'adept':
      return 'The creases fall where you expect them now.'
    case 'master':
      return 'You could fold this in the dark.'
    case 'grand':
      return 'This fold is yours.'
    default:
      return 'It knows your hands.'
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE APP'S STORE — one instance, created lazily so importing this module has
   no side effects under node or during SSR.
   ═══════════════════════════════════════════════════════════════════════════ */

let singleton: StoreApi<GameStore> | null = null

export function gameStore(): StoreApi<GameStore> {
  singleton ??= createGameStore()
  return singleton
}

/** Replace the app store — used by the shell to inject a provider or a fake clock. */
export function setGameStore(store: StoreApi<GameStore>): void {
  singleton = store
}

/**
 * The one hook. Always pass a selector that returns the narrowest thing you need:
 *   const sheets = useGame((s) => s.sheets)
 * A currency tick then re-renders the currency pill and nothing else.
 */
export function useGame<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore(), selector)
}

/* ── Ready-made selectors. Prefer these over reaching into the state shape. ── */

export const useSheets = (): number => useGame((s) => s.sheets)
export const useGoldLeaf = (): number => useGame((s) => s.goldLeaf)
export const useKamiList = (): KamiInstance[] => useGame((s) => s.kami)
export const useKamiCount = (): number => useGame((s) => s.kami.length)
export const useSettings = (): Settings => useGame((s) => s.settings)
export const useToday = (): string => useGame((s) => s.today)
export const useHydrated = (): boolean => useGame((s) => s.hydrated)
export const useNotice = (): Notice | null => useGame((s) => s.notice)
export const useActiveWashi = (): string => useGame((s) => s.activeWashi)
export const useEntitlements = (): string[] => useGame((s) => s.entitlements)
export const useSkus = (): Sku[] => useGame((s) => s.skus)
export const usePurchasePending = (): string | null => useGame((s) => s.purchasePending)
export const useLastOutcome = (): FoldOutcome | null => useGame((s) => s.lastOutcome)
export const useBiomes = (): BiomeId[] => useGame((s) => s.biomes)
export const useContent = (): ContentIndex => useGame((s) => s.content)

export const useWallet = (): { sheets: number; goldLeaf: number } =>
  useGame(useShallow((s) => ({ sheets: s.sheets, goldLeaf: s.goldLeaf })))

export const useAtelier = (): boolean => useGame((s) => isAtelierMember(s.entitlements))
export const useStorefrontOpen = (): boolean => useGame((s) => isStorefrontOpen(s))
export const useHasSeen = (flag: FlagName): boolean => useGame((s) => hasSeenIn(s.seen, flag))

/**
 * The Practice Sheet's record: best ever, days in a row, done today.
 *
 * Derived outside the selector. `readPractice` builds a fresh object, and a
 * selector that returns a new object every call never compares equal — the
 * store re-renders, re-derives, and re-renders again until React gives up.
 */
export const usePractice = (): PracticeLog => {
  const seen = useGame((s) => s.seen)
  const today = useGame((s) => s.today)
  return useMemo(() => readPractice(seen, today), [seen, today])
}
export const useFoldCount = (speciesId: string): number => useGame((s) => s.folds[speciesId] ?? 0)
export const useMastery = (speciesId: string): MasteryTier => useGame((s) => masteryFor(s.folds[speciesId] ?? 0))
export const useMasteryProgress = (speciesId: string) => useGame(useShallow((s) => masteryProgress(s.folds[speciesId] ?? 0)))
export const useKami = (uid: string): KamiInstance | undefined => useGame((s) => s.kami.find((k) => k.uid === uid))
export const useKamiOfSpecies = (speciesId: string): KamiInstance[] =>
  useGame(useShallow((s) => s.kami.filter((k) => k.speciesId === speciesId)))

export const useDaily = () => useGame(useShallow((s) => dailyStatus(s.daily, s.today)))
export const useJournal = () => useGame(useShallow((s) => journalProgress(s.journal, s.season)))
/**
 * These two return objects with nested objects inside them, which a shallow
 * compare cannot see through — so they select the raw inputs (all stable
 * references) and derive with `useMemo`. The result is a stable object across
 * renders that did not touch the collection.
 */
export const useCollection = (): CollectionSummary => {
  const content = useGame((s) => s.content)
  const kami = useGame((s) => s.kami)
  const folds = useGame((s) => s.folds)
  return useMemo(() => collectionSummary(content, { kami, folds }), [content, kami, folds])
}

export const useUnlock = (speciesId: string): UnlockState | null => {
  const content = useGame((s) => s.content)
  const folds = useGame((s) => s.folds)
  const biomes = useGame((s) => s.biomes)
  const entitlements = useGame((s) => s.entitlements)
  const goldLeaf = useGame((s) => s.goldLeaf)
  return useMemo(() => {
    const species = content.speciesById.get(speciesId)
    if (!species) return null
    const nameFor = (id: string): string => content.speciesById.get(id)?.name ?? content.biomeById.get(id as BiomeId)?.name ?? id
    return evaluateUnlock(speciesId, species.unlock, unlockContextFrom({ folds, biomes, entitlements, goldLeaf }, nameFor))
  }, [content, speciesId, folds, biomes, entitlements, goldLeaf])
}
export const useOwnsWashi = (washi: WashiLike): boolean => useGame((s) => ownsWashi(washi.source, washi.id, s))

/**
 * Every action, as a plain stable object. Actions never change identity, so this
 * causes no re-renders and needs no hook:
 *   import { actions } from '@/systems'
 *   actions.completeFold(result)
 */
export const actions: GameActions = {
  attachContent: (input) => gameStore().getState().attachContent(input),
  hydrate: () => gameStore().getState().hydrate(),
  refreshDay: () => gameStore().getState().refreshDay(),
  setStoreProvider: (p) => gameStore().getState().setStoreProvider(p),
  rollGoldenPaper: (q) => gameStore().getState().rollGoldenPaper(q),
  completeFold: (r, m) => gameStore().getState().completeFold(r, m),
  recordStudioTime: (s, c) => gameStore().getState().recordStudioTime(s, c),
  grantSheets: (n) => gameStore().getState().grantSheets(n),
  grantGoldLeaf: (n) => gameStore().getState().grantGoldLeaf(n),
  spendPrice: (p) => gameStore().getState().spendPrice(p),
  setActiveWashi: (id) => gameStore().getState().setActiveWashi(id),
  buyWashi: (w) => gameStore().getState().buyWashi(w),
  renameKami: (uid, n) => gameStore().getState().renameKami(uid, n),
  moveKami: (uid, p) => gameStore().getState().moveKami(uid, p),
  tend: (uid, k) => gameStore().getState().tend(uid, k),
  addJournalXp: (n) => gameStore().getState().addJournalXp(n),
  claimJournal: () => gameStore().getState().claimJournal(),
  purchase: (id) => gameStore().getState().purchase(id),
  restorePurchases: () => gameStore().getState().restorePurchases(),
  unlockSpeciesWithGoldLeaf: (id) => gameStore().getState().unlockSpeciesWithGoldLeaf(id),
  updateSettings: (p) => gameStore().getState().updateSettings(p),
  setVolume: (b, v) => gameStore().getState().setVolume(b, v),
  resetSettings: () => gameStore().getState().resetSettings(),
  markSeen: (f) => gameStore().getState().markSeen(f),
  recordPractice: (s) => gameStore().getState().recordPractice(s),
  dismissNotice: () => gameStore().getState().dismissNotice(),
  exportSaveJson: () => gameStore().getState().exportSaveJson(),
  importSaveJson: (j) => gameStore().getState().importSaveJson(j),
  resetEverything: () => gameStore().getState().resetEverything(),
  flushSave: () => gameStore().getState().flushSave(),
  toSave: () => gameStore().getState().toSave(),
}

/**
 * Boot, in the order the shell should call it. Content first so the save can be
 * validated against it, then hydrate, then the store provider.
 */
export async function bootGame(input: {
  species?: readonly SpeciesLike[]
  washi?: readonly WashiLike[]
  biomes?: readonly BiomeLike[]
  provider?: StoreProvider
}): Promise<() => void> {
  const store = gameStore()
  store.getState().attachContent(input)
  store.getState().hydrate()
  await store.getState().setStoreProvider(input.provider ?? new LocalStubProvider())
  // Keeps `theme: 'auto'` honest while the app is open. Call the result to detach.
  return watchSystemTheme(() => store.getState().settings)
}
