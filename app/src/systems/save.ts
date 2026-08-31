/* PAPER PLANET — the v3 save: schema, v1/v2 migration, validation, debounced persistence, export/import. */

import type { BiomeId, KamiInstance, SaveV3, Settings, Vec2 } from '../contracts'
import { migrationGrant } from './economy'
import { clamp, clamp01, hashFloat } from './rand'
import { defaultSettings, normalizeSettings, type SettingsEnv, staticEnv } from './settings'

export const SAVE_KEY = 'paper-planet-save-v3'
export const SAVE_KEY_V2 = 'paper-planet-save-v2'
export const SAVE_KEY_V1 = 'paper-planet-collection-v1'

export const CURRENT_SEASON_ID = 'season-1'

/**
 * The paper every player starts with. `src/content` owns the real Washi catalogue,
 * so this is only a last resort: any unknown Washi id found on disk is repaired to
 * the player's active paper, and the active paper to this. Content can override it
 * at boot via `SaveContext.defaultWashiId`.
 */
export const FALLBACK_WASHI_ID = 'kozo'

/** The first biome is always open. You cannot arrive on a planet with nowhere to stand. */
export const STARTING_BIOME: BiomeId = 'meadow'

/** A migrated Kami has no recorded crease accuracy. This is the neutral value we assume. */
export const MIGRATED_QUALITY = 0.75

/** v2 stored uncapped hearts. Ten hearts is a fully bonded Kami in v3. */
export const HEARTS_TO_BOND = 10

const HOUR = 3_600_000
export const DAY_MS = 86_400_000

/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE — every access is guarded. Private mode and full disks are normal.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** `window.localStorage`, or null when it is missing or refuses to be touched. */
export function browserStorage(): SaveStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__pp_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

/** An in-memory stand-in so the game is fully playable with storage denied. */
export function memoryStorage(seed?: Record<string, string>): SaveStorage {
  const map = new Map<string, string>(Object.entries(seed ?? {}))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

function readRaw(storage: SaveStorage | null, key: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COERCION — nothing off disk is trusted. Nothing here throws.
   ═══════════════════════════════════════════════════════════════════════════ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
function int(v: unknown, fallback: number): number {
  return Math.trunc(num(v, fallback))
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}
function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
function unique<T extends string>(list: readonly T[]): T[] {
  return Array.from(new Set(list))
}
function countRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(v)) return out
  for (const [key, value] of Object.entries(v)) {
    const n = int(value, 0)
    if (n > 0) out[key] = n
  }
  return out
}

const BIOME_IDS: readonly BiomeId[] = ['meadow', 'shore', 'forest', 'peak', 'nightsky']
function biomeList(v: unknown): BiomeId[] {
  return unique(strList(v)).filter((x): x is BiomeId => (BIOME_IDS as readonly string[]).includes(x))
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLAGS — `seen` is the save's flag bag. Plain tokens are booleans; tokens of
   the form `sys/<key>=<value>` are small counters the systems need to persist
   (sparkle pity, bond bookkeeping, the streak grace day). Keeping them in the
   save means they export, import, and survive with everything else.
   ═══════════════════════════════════════════════════════════════════════════ */

export const FLAG = {
  /** The cold open has been watched. */
  onboarded: 'onboarded',
  /** The first Kami exists. Nothing may be sold before this is set — BRAND.md §12. */
  firstFold: 'first-fold',
  planetIntro: 'planet-intro',
  codexIntro: 'codex-intro',
  studioIntro: 'studio-intro',
  /** The one contextual Washi card on the Codex, dismissible forever. */
  codexWashiCard: 'codex-washi-card',
  migrated: 'migrated',
} as const

export type FlagName = (typeof FLAG)[keyof typeof FLAG] | (string & {})

const SYS = 'sys/'
export const SYS_KEY = {
  sparklePity: 'sparkle-pity',
  sparkleDay: 'sparkle-day',
  sparkleToday: 'sparkle-today',
  bondDay: 'bond-day',
  /** `sys/bond-fed/<uid>` — today's bond given to one Kami. Pruned on rollover. */
  bondFed: 'bond-fed',
  bondCheckedAt: 'bond-checked-at',
  graceUsedOn: 'grace-used-on',
  /** `sys/mastery-paid/<tier>/<speciesId>` — a one-time Gold Leaf milestone. */
  masteryPaid: 'mastery-paid',
  /** The Practice Sheet: best sheet ever, last day practised, days in a row. */
  drillBest: 'drill-best',
  drillDay: 'drill-day',
  drillStreak: 'drill-streak',
} as const

export function hasSeen(seen: readonly string[], flag: FlagName): boolean {
  return seen.includes(flag)
}

export function markSeen(seen: readonly string[], flag: FlagName): string[] {
  return seen.includes(flag) ? [...seen] : [...seen, flag]
}

export function unmarkSeen(seen: readonly string[], flag: FlagName): string[] {
  return seen.filter((f) => f !== flag)
}

export function readFlag(seen: readonly string[], key: string): string | null {
  const prefix = `${SYS}${key}=`
  for (const token of seen) if (token.startsWith(prefix)) return token.slice(prefix.length)
  return null
}

export function readFlagNumber(seen: readonly string[], key: string, fallback = 0): number {
  const raw = readFlag(seen, key)
  if (raw === null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function writeFlag(seen: readonly string[], key: string, value: string | number): string[] {
  const prefix = `${SYS}${key}=`
  const kept = seen.filter((t) => !t.startsWith(prefix))
  kept.push(`${prefix}${value}`)
  return kept
}

export function clearFlag(seen: readonly string[], key: string): string[] {
  const prefix = `${SYS}${key}=`
  return seen.filter((t) => !t.startsWith(prefix))
}

/** Drop a whole family of counters, e.g. every `sys/bond-fed/*` at date rollover. */
export function clearFlagFamily(seen: readonly string[], keyPrefix: string): string[] {
  const prefix = `${SYS}${keyPrefix}`
  return seen.filter((t) => !t.startsWith(prefix))
}

/* ═══════════════════════════════════════════════════════════════════════════
   IDS & PLACEMENT
   ═══════════════════════════════════════════════════════════════════════════ */

let uidCounter = 0

export function makeUid(now: number, rng: () => number): string {
  uidCounter = (uidCounter + 1) % 46656
  const t = Math.floor(now).toString(36)
  const r = Math.floor(rng() * 46656)
    .toString(36)
    .padStart(3, '0')
  const c = uidCounter.toString(36).padStart(3, '0')
  return `k${t}${r}${c}`
}

/**
 * Where a Kami stands. Derived from its uid so the planet looks the same every
 * time you open it — a world that reshuffles itself is not a world.
 */
export function posForUid(uid: string): Vec2 {
  return [0.1 + 0.8 * hashFloat(`${uid}:x`), 0.16 + 0.68 * hashFloat(`${uid}:y`)]
}

function normalizePos(v: unknown, uid: string): Vec2 {
  if (Array.isArray(v) && v.length >= 2) {
    const x = num(v[0], Number.NaN)
    const y = num(v[1], Number.NaN)
    if (Number.isFinite(x) && Number.isFinite(y)) return [clamp01(x), clamp01(y)]
  }
  return posForUid(uid)
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE DEFAULT SAVE
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SaveContext {
  /** Species ids that exist. When given, unknown ids are dropped, not crashed on. */
  knownSpecies?: ReadonlySet<string> | null
  /** Washi ids that exist. Unknown ids are repaired to the default paper. */
  knownWashi?: ReadonlySet<string> | null
  defaultWashiId?: string
  now?: number
  env?: SettingsEnv
}

export function defaultSave(ctx: SaveContext = {}): SaveV3 {
  const now = ctx.now ?? Date.now()
  const washiId = ctx.defaultWashiId ?? FALLBACK_WASHI_ID
  return {
    version: 3,
    kami: [],
    folds: {},
    washi: [washiId],
    activeWashi: washiId,
    sheets: 0,
    goldLeaf: 0,
    biomes: [STARTING_BIOME],
    daily: { lastFold: null, streak: 0, todaySpecies: null, claimed: false },
    journal: { season: CURRENT_SEASON_ID, tier: 0, xp: 0, premium: false },
    entitlements: [],
    settings: defaultSettings(ctx.env),
    stats: { totalFolds: 0, totalCreases: 0, studioSeconds: 0, firstOpenAt: now },
    seen: [],
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDATION — the old `getAnimal` used a non-null assertion and threw on an id
   it did not recognise. Nothing here throws. Unknown content is dropped and
   reported; a partial or corrupted save is rebuilt around whatever survived.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NormalizeResult {
  save: SaveV3
  /** Human-readable notes on everything that had to be repaired. */
  repairs: string[]
}

function normalizeKami(
  input: unknown,
  index: number,
  ctx: SaveContext,
  fallbackWashi: string,
  repairs: string[],
  now: number,
): KamiInstance | null {
  if (!isRecord(input)) {
    repairs.push(`kami[${index}]: not an object — dropped`)
    return null
  }
  const speciesId = str(input.speciesId, '')
  if (!speciesId) {
    repairs.push(`kami[${index}]: no species — dropped`)
    return null
  }
  if (ctx.knownSpecies && !ctx.knownSpecies.has(speciesId)) {
    repairs.push(`kami[${index}]: unknown species "${speciesId}" — dropped`)
    return null
  }
  const uid = str(input.uid, '') || `k-recovered-${speciesId}-${index}`
  let washiId = str(input.washiId, fallbackWashi)
  if (ctx.knownWashi && !ctx.knownWashi.has(washiId)) {
    repairs.push(`kami[${index}]: unknown washi "${washiId}" — using ${fallbackWashi}`)
    washiId = fallbackWashi
  }
  const nickname = typeof input.nickname === 'string' && input.nickname.trim() ? input.nickname.slice(0, 24) : null
  const foldedAt = int(input.foldedAt, now)
  return {
    uid,
    speciesId,
    washiId,
    nickname,
    foldedAt: foldedAt > 0 ? foldedAt : now,
    pos: normalizePos(input.pos, uid),
    bond: clamp(Math.round(num(input.bond, 50)), 0, 100),
    golden: bool(input.golden, false),
    quality: clamp01(num(input.quality, MIGRATED_QUALITY)),
  }
}

/** Take anything at all and produce a valid SaveV3, plus a list of what was fixed. */
export function normalizeSave(input: unknown, ctx: SaveContext = {}): NormalizeResult {
  const now = ctx.now ?? Date.now()
  const repairs: string[] = []
  const base = defaultSave(ctx)
  if (!isRecord(input)) {
    return { save: base, repairs: input === null || input === undefined ? [] : ['save was not an object — started fresh'] }
  }

  const fallbackWashi = ctx.defaultWashiId ?? FALLBACK_WASHI_ID

  // ── washi ─────────────────────────────────────────────────────────────────
  let washi = unique([fallbackWashi, ...strList(input.washi)])
  if (ctx.knownWashi) {
    const before = washi.length
    washi = washi.filter((id) => id === fallbackWashi || ctx.knownWashi?.has(id))
    if (washi.length !== before) repairs.push(`dropped ${before - washi.length} unknown washi`)
  }
  let activeWashi = str(input.activeWashi, fallbackWashi)
  if (!washi.includes(activeWashi)) {
    if (activeWashi) repairs.push(`active washi "${activeWashi}" not owned — using ${fallbackWashi}`)
    activeWashi = fallbackWashi
  }

  // ── kami ──────────────────────────────────────────────────────────────────
  const rawKami = Array.isArray(input.kami) ? input.kami : []
  const seenUids = new Set<string>()
  const kami: KamiInstance[] = []
  rawKami.forEach((entry, i) => {
    const k = normalizeKami(entry, i, ctx, fallbackWashi, repairs, now)
    if (!k) return
    if (seenUids.has(k.uid)) {
      repairs.push(`kami[${i}]: duplicate uid "${k.uid}" — regenerated`)
      k.uid = `${k.uid}-${i}`
    }
    seenUids.add(k.uid)
    kami.push(k)
  })

  // ── folds ─────────────────────────────────────────────────────────────────
  let folds = countRecord(input.folds)
  if (ctx.knownSpecies) {
    const kept: Record<string, number> = {}
    for (const [id, n] of Object.entries(folds)) {
      if (ctx.knownSpecies.has(id)) kept[id] = n
      else repairs.push(`fold count for unknown species "${id}" — dropped`)
    }
    folds = kept
  }
  // A Kami that exists must be worth at least one fold.
  for (const k of kami) if ((folds[k.speciesId] ?? 0) < 1) folds[k.speciesId] = 1

  // ── daily ─────────────────────────────────────────────────────────────────
  const rawDaily = isRecord(input.daily) ? input.daily : {}
  let todaySpecies = typeof rawDaily.todaySpecies === 'string' ? rawDaily.todaySpecies : null
  if (todaySpecies && ctx.knownSpecies && !ctx.knownSpecies.has(todaySpecies)) {
    repairs.push(`daily species "${todaySpecies}" no longer exists — will be re-drawn`)
    todaySpecies = null
  }
  const daily: SaveV3['daily'] = {
    lastFold: typeof rawDaily.lastFold === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDaily.lastFold) ? rawDaily.lastFold : null,
    streak: Math.max(0, int(rawDaily.streak, 0)),
    todaySpecies,
    claimed: bool(rawDaily.claimed, false),
  }

  // ── journal ───────────────────────────────────────────────────────────────
  const rawJournal = isRecord(input.journal) ? input.journal : {}
  const journal: SaveV3['journal'] = {
    season: str(rawJournal.season, CURRENT_SEASON_ID),
    tier: Math.max(0, int(rawJournal.tier, 0)),
    xp: Math.max(0, int(rawJournal.xp, 0)),
    premium: bool(rawJournal.premium, false),
  }

  // ── stats ─────────────────────────────────────────────────────────────────
  const rawStats = isRecord(input.stats) ? input.stats : {}
  const totalFromFolds = Object.values(folds).reduce((a, b) => a + b, 0)
  const stats: SaveV3['stats'] = {
    totalFolds: Math.max(int(rawStats.totalFolds, 0), totalFromFolds),
    totalCreases: Math.max(0, int(rawStats.totalCreases, 0)),
    studioSeconds: Math.max(0, Math.round(num(rawStats.studioSeconds, 0))),
    firstOpenAt: int(rawStats.firstOpenAt, now) > 0 ? int(rawStats.firstOpenAt, now) : now,
  }

  // ── biomes ────────────────────────────────────────────────────────────────
  const biomes = unique([STARTING_BIOME, ...biomeList(input.biomes)])

  // ── settings ──────────────────────────────────────────────────────────────
  const settings: Settings = normalizeSettings(input.settings, ctx.env)

  const version = input.version
  if (version !== 3 && version !== undefined) repairs.push(`save claimed version ${String(version)} — read as v3`)

  return {
    save: {
      version: 3,
      kami,
      folds,
      washi,
      activeWashi,
      sheets: Math.max(0, int(input.sheets, 0)),
      goldLeaf: Math.max(0, int(input.goldLeaf, 0)),
      biomes,
      daily,
      journal,
      entitlements: unique(strList(input.entitlements)),
      settings,
      stats,
      seen: unique(strList(input.seen)),
    },
    repairs,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MIGRATION
   ═══════════════════════════════════════════════════════════════════════════ */

/** The v2 shape, exactly as `src/game/store.ts` wrote it. */
export interface SaveV2Shape {
  collection: string[]
  gold: string[]
  folds: Record<string, number>
  hearts: Record<string, number>
}

export function readV2Shape(input: unknown): SaveV2Shape | null {
  if (!isRecord(input)) return null
  const collection = strList(input.collection)
  const gold = strList(input.gold)
  const folds = countRecord(input.folds)
  const hearts = countRecord(input.hearts)
  if (collection.length === 0 && gold.length === 0 && Object.keys(folds).length === 0 && Object.keys(hearts).length === 0) {
    // An empty v2 save is still a v2 save if the object had the right keys.
    if (!('collection' in input) && !('folds' in input)) return null
  }
  return { collection: unique(collection), gold: unique(gold), folds, hearts }
}

/**
 * v2 → v3. Every collected species becomes a Kami:
 *   uid       synthesised, stable per species+slot
 *   washiId   the default paper (v2 had no Washi)
 *   foldedAt  spread backwards an hour apart, oldest first, so the Codex orders
 *             the way the player collected them
 *   pos       derived from the uid, so the planet is laid out the same every load
 *   golden    carried from the `gold` array
 *   bond      hearts × 10, capped at 100 — v2 hearts were uncapped
 *   quality   0.75, the neutral value; v2 never measured a crease
 * Fold counts, and therefore mastery, carry across untouched.
 */
export function migrateV2(input: unknown, ctx: SaveContext = {}): NormalizeResult {
  const v2 = readV2Shape(input)
  const now = ctx.now ?? Date.now()
  if (!v2) return { save: defaultSave(ctx), repairs: ['no v2 save found'] }

  const repairs: string[] = []
  const washiId = ctx.defaultWashiId ?? FALLBACK_WASHI_ID

  // Anything with a fold count or a heart but no collection entry was still folded.
  const collected = unique([...v2.collection, ...Object.keys(v2.folds), ...Object.keys(v2.hearts)])
  const known = collected.filter((id) => {
    if (ctx.knownSpecies && !ctx.knownSpecies.has(id)) {
      repairs.push(`v2: species "${id}" no longer exists — dropped`)
      return false
    }
    return true
  })

  const total = known.length
  const kami: KamiInstance[] = known.map((speciesId, i) => {
    const uid = `k-v2-${speciesId}`
    return {
      uid,
      speciesId,
      washiId,
      nickname: null,
      foldedAt: now - (total - i) * HOUR,
      pos: posForUid(uid),
      bond: clamp(Math.round((v2.hearts[speciesId] ?? 0) * HEARTS_TO_BOND), 0, 100),
      golden: v2.gold.includes(speciesId),
      quality: MIGRATED_QUALITY,
    }
  })

  const folds: Record<string, number> = {}
  for (const id of known) folds[id] = Math.max(1, v2.folds[id] ?? 1)
  const totalFolds = Object.values(folds).reduce((a, b) => a + b, 0)

  const grant = migrationGrant(total)
  const base = defaultSave({ ...ctx, now })

  const save: SaveV3 = {
    ...base,
    kami,
    folds,
    washi: [washiId],
    activeWashi: washiId,
    sheets: grant.sheets,
    goldLeaf: grant.goldLeaf,
    stats: {
      totalFolds,
      totalCreases: 0,
      studioSeconds: 0,
      firstOpenAt: now - Math.max(1, total) * DAY_MS,
    },
    // A returning player has already folded. They must never meet the cold open,
    // and — BRAND.md §12 — the shop was already legitimately open to them.
    seen: total > 0 ? [FLAG.onboarded, FLAG.firstFold, FLAG.migrated] : [FLAG.migrated],
  }

  repairs.push(`v2: brought ${total} Kami across, ${totalFolds} folds, ${grant.sheets} Sheets credited`)
  return { save, repairs }
}

/** v1 → v3. v1 was a bare array of species ids under `paper-planet-collection-v1`. */
export function migrateV1(input: unknown, ctx: SaveContext = {}): NormalizeResult {
  if (!Array.isArray(input)) return { save: defaultSave(ctx), repairs: ['no v1 save found'] }
  const collection = unique(input.filter((x): x is string => typeof x === 'string'))
  const result = migrateV2({ collection, gold: [], folds: {}, hearts: {} }, ctx)
  return { save: result.save, repairs: result.repairs.map((r) => r.replace(/^v2:/, 'v1:')) }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING
   ═══════════════════════════════════════════════════════════════════════════ */

export type SaveSource = 'v3' | 'v2' | 'v1' | 'new'

export interface LoadResult {
  save: SaveV3
  source: SaveSource
  repairs: string[]
  /** False when storage refused us — the session still plays, it just won't persist. */
  storageOk: boolean
}

export function loadSave(ctx: SaveContext & { storage?: SaveStorage | null } = {}): LoadResult {
  const storage = ctx.storage === undefined ? browserStorage() : ctx.storage
  const storageOk = storage !== null

  const v3raw = parseJson(readRaw(storage, SAVE_KEY))
  if (isRecord(v3raw)) {
    const { save, repairs } = normalizeSave(v3raw, ctx)
    return { save, source: 'v3', repairs, storageOk }
  }

  const v2raw = parseJson(readRaw(storage, SAVE_KEY_V2))
  if (isRecord(v2raw)) {
    const migrated = migrateV2(v2raw, ctx)
    const { save, repairs } = normalizeSave(migrated.save, ctx)
    return { save, source: 'v2', repairs: [...migrated.repairs, ...repairs], storageOk }
  }

  const v1raw = parseJson(readRaw(storage, SAVE_KEY_V1))
  if (Array.isArray(v1raw)) {
    const migrated = migrateV1(v1raw, ctx)
    const { save, repairs } = normalizeSave(migrated.save, ctx)
    return { save, source: 'v1', repairs: [...migrated.repairs, ...repairs], storageOk }
  }

  return { save: defaultSave(ctx), source: 'new', repairs: [], storageOk }
}

/** After a successful v3 write, the old keys are dead weight. Removing them also buys quota. */
export function dropLegacyKeys(storage: SaveStorage | null): void {
  if (!storage) return
  for (const key of [SAVE_KEY_V2, SAVE_KEY_V1]) {
    try {
      storage.removeItem(key)
    } catch {
      /* nothing to do — the key simply stays */
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERSISTENCE — the old store did a synchronous stringify + setItem on every
   mutation, including every heart. This coalesces: debounce a burst, throttle
   the steady state, always flush before the page goes away.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PersistStatus =
  | { ok: true; savedAt: number; bytes: number }
  | { ok: false; reason: 'unavailable' | 'quota' | 'failed'; message: string }

export interface PersisterOptions {
  storage?: SaveStorage | null
  key?: string
  /** Wait this long after the last change before writing. */
  debounceMs?: number
  /** Never write more often than this. */
  minIntervalMs?: number
  onStatus?: (status: PersistStatus) => void
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface Persister {
  /** Queue a write. Cheap — the stringify happens once, at write time. */
  schedule(save: SaveV3): void
  /** Write right now if anything is pending. Returns whether a write happened. */
  flush(): boolean
  /** Cancel pending work and detach lifecycle listeners. Flushes first. */
  dispose(): void
  status(): PersistStatus | null
}

export const DEFAULT_DEBOUNCE_MS = 600
export const DEFAULT_MIN_INTERVAL_MS = 2500

function isQuotaError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22
  }
  const name = isRecord(err) ? String(err.name ?? '') : ''
  return /quota/i.test(name) || /quota/i.test(String(err))
}

export function createPersister(options: PersisterOptions = {}): Persister {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const key = options.key ?? SAVE_KEY
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
  const now = options.now ?? (() => Date.now())
  const setTimer =
    options.setTimer ?? ((fn: () => void, ms: number) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null))
  const clearTimer =
    options.clearTimer ?? ((handle: unknown) => {
      if (handle !== null && typeof clearTimeout === 'function') clearTimeout(handle as ReturnType<typeof setTimeout>)
    })

  let pending: SaveV3 | null = null
  let timer: unknown = null
  let lastWriteAt = 0
  let last: PersistStatus | null = null
  let disabled = false

  const report = (status: PersistStatus): void => {
    last = status
    try {
      options.onStatus?.(status)
    } catch {
      /* a listener that throws must not take the save down with it */
    }
  }

  if (!storage) report({ ok: false, reason: 'unavailable', message: 'Storage is unavailable. This session will not be kept.' })

  const write = (): boolean => {
    const save = pending
    pending = null
    if (!save) return false
    if (!storage || disabled) return false
    let body: string
    try {
      body = JSON.stringify(save)
    } catch (err) {
      report({ ok: false, reason: 'failed', message: `Could not serialise the save: ${String(err)}` })
      return false
    }
    try {
      storage.setItem(key, body)
      lastWriteAt = now()
      report({ ok: true, savedAt: lastWriteAt, bytes: body.length })
      return true
    } catch (err) {
      if (isQuotaError(err)) {
        // Reclaim what we can — the legacy keys are pure duplication once v3 exists.
        dropLegacyKeys(storage)
        try {
          storage.setItem(key, body)
          lastWriteAt = now()
          report({ ok: true, savedAt: lastWriteAt, bytes: body.length })
          return true
        } catch {
          disabled = true
          report({ ok: false, reason: 'quota', message: 'There is no room left to keep your planet. Export your save to be safe.' })
          return false
        }
      }
      report({ ok: false, reason: 'failed', message: `Could not keep your planet: ${String(err)}` })
      return false
    }
  }

  const arm = (): void => {
    if (timer !== null) return
    const sinceLast = now() - lastWriteAt
    const wait = Math.max(debounceMs, minIntervalMs - sinceLast)
    timer = setTimer(() => {
      timer = null
      write()
    }, wait)
  }

  const flush = (): boolean => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
    return write()
  }

  // Never lose the last few seconds of a session to a backgrounded tab.
  const detachers: Array<() => void> = []
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onHide = (): void => {
      flush()
    }
    const onVisibility = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush()
    }
    try {
      window.addEventListener('pagehide', onHide)
      window.addEventListener('beforeunload', onHide)
      document.addEventListener('visibilitychange', onVisibility)
      detachers.push(() => window.removeEventListener('pagehide', onHide))
      detachers.push(() => window.removeEventListener('beforeunload', onHide))
      detachers.push(() => document.removeEventListener('visibilitychange', onVisibility))
    } catch {
      /* no lifecycle events available — the debounce still covers us */
    }
  }

  return {
    schedule(save) {
      if (!storage || disabled) return
      pending = save
      // A burst of changes coalesces; a steady stream still writes on the throttle.
      if (timer === null) arm()
    },
    flush,
    dispose() {
      flush()
      for (const off of detachers) off()
      detachers.length = 0
    },
    status: () => last,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT / IMPORT — your things are yours. A premium app lets you take them.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SaveEnvelope {
  app: 'paper-planet'
  kind: 'save'
  version: 3
  exportedAt: number
  save: SaveV3
}

export function exportSave(save: SaveV3, now = Date.now()): string {
  const envelope: SaveEnvelope = { app: 'paper-planet', kind: 'save', version: 3, exportedAt: now, save }
  return JSON.stringify(envelope, null, 2)
}

/** A filename a person can recognise a year later. */
export function exportFilename(now = Date.now()): string {
  const d = new Date(now)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `paper-planet-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

export type ImportResult =
  | { ok: true; save: SaveV3; source: SaveSource; repairs: string[] }
  | { ok: false; error: string }

/** Accepts an exported envelope, a bare v3, a bare v2, or a bare v1 array. */
export function importSave(json: string, ctx: SaveContext = {}): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch {
    return { ok: false, error: "That file isn't readable as a save." }
  }

  if (isRecord(parsed) && parsed.app === 'paper-planet' && isRecord(parsed.save)) {
    const { save, repairs } = normalizeSave(parsed.save, ctx)
    return { ok: true, save, source: 'v3', repairs }
  }
  if (Array.isArray(parsed)) {
    const migrated = migrateV1(parsed, ctx)
    const { save, repairs } = normalizeSave(migrated.save, ctx)
    return { ok: true, save, source: 'v1', repairs: [...migrated.repairs, ...repairs] }
  }
  if (isRecord(parsed)) {
    if (parsed.version === 3 || 'kami' in parsed) {
      const { save, repairs } = normalizeSave(parsed, ctx)
      return { ok: true, save, source: 'v3', repairs }
    }
    if ('collection' in parsed || 'hearts' in parsed) {
      const migrated = migrateV2(parsed, ctx)
      const { save, repairs } = normalizeSave(migrated.save, ctx)
      return { ok: true, save, source: 'v2', repairs: [...migrated.repairs, ...repairs] }
    }
  }
  return { ok: false, error: "That file doesn't look like a Paper Planet save." }
}

/** Used by the self-test and by `importSave` callers that want a clean context. */
export function testContext(overrides: SaveContext = {}): SaveContext {
  return { now: 0, env: staticEnv(), ...overrides }
}
