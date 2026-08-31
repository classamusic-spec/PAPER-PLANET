/* PAPER PLANET — systems self-test. Run: npx tsx src/systems/__selftest.ts */

import type { BiomeId, KamiInstance, Rarity, SaveV3, StudioResult, UnlockRule, Washi } from '../contracts'

import {
  ATELIER_SHEETS_MULT,
  FOLD_COST,
  MIN_FOLD_SHEETS,
  RARITY_BASE,
  SUGGESTED_GOLDLEAF_UNLOCK,
  SUGGESTED_WASHI_SHEETS,
  canAfford,
  canFold,
  foldReward,
  masteryGoldLeaf,
  migrationGrant,
  priceIsFree,
  qualityMultiplier,
  spend,
  streakGoldLeaf,
} from './economy'

import {
  FLAG,
  SAVE_KEY,
  SAVE_KEY_V1,
  SAVE_KEY_V2,
  type SaveStorage,
  browserStorage,
  createPersister,
  defaultSave,
  exportSave,
  hasSeen,
  importSave,
  loadSave,
  memoryStorage,
  migrateV1,
  migrateV2,
  normalizeSave,
} from './save'

import {
  BOND_DAILY_CAP,
  BOND_FLOOR,
  BOND_START,
  MASTERY_THRESHOLDS,
  SPARKLE_DAILY_CAP,
  claimMasteryMilestone,
  decayBond,
  evaluateUnlock,
  masteryFor,
  masteryProgress,
  rollGolden,
  sparkleChance,
  tendKami,
  unlockedBiomes,
} from './progression'

import { claimDailyFold, dailySpeciesFor, daysBetween, localDateKey, openDay, shiftDateKey } from './daily'

import {
  CATALOG,
  ENT,
  JOURNAL_TIER_COUNT,
  LocalStubProvider,
  SEASON_ONE,
  SKU_ID,
  auditCatalog,
  hasEntitlement,
  isAtelierMember,
  isStorefrontOpen,
  journalProgress,
  ownsWashi,
  skusOfKind,
} from './commerce'

import { applySettings, defaultSettings, normalizeSettings, resolveTheme, staticEnv, themeAttributes } from './settings'
import { createGameStore } from './store'
import type { BiomeLike, SpeciesLike, WashiLike } from './types'

/* ═══════════════════════════════════════════════════════════════════════════
   HARNESS
   ═══════════════════════════════════════════════════════════════════════════ */

const ESC = '\u001b['
const DIM = `${ESC}2m`
const BOLD = `${ESC}1m`
const GREEN = `${ESC}32m`
const RED = `${ESC}31m`
const OFF = `${ESC}0m`

let passed = 0
const failures: string[] = []

function section(name: string): void {
  console.log(`\n${BOLD}${name}${OFF}`)
}

function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed++
    console.log(`  ${GREEN}PASS${OFF}  ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`)
  } else {
    failures.push(label)
    console.log(`  ${RED}FAIL${OFF}  ${label}${detail ? `  ${detail}` : ''}`)
  }
}

function eq<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  ok(label, a === b, a === b ? String(a).slice(0, 64) : `got ${a} · want ${b}`)
}

/* ── a localStorage shim, so this runs under node ────────────────────────── */

function makeShim(): Storage {
  const map = new Map<string, string>()
  const shim = {
    get length(): number {
      return map.size
    },
    key: (i: number): string | null => Array.from(map.keys())[i] ?? null,
    getItem: (k: string): string | null => map.get(k) ?? null,
    setItem: (k: string, v: string): void => void map.set(k, String(v)),
    removeItem: (k: string): void => void map.delete(k),
    clear: (): void => map.clear(),
  }
  return shim as unknown as Storage
}

Object.defineProperty(globalThis, 'localStorage', { value: makeShim(), configurable: true, writable: true })

/* ── content fixtures. `systems/` never imports src/content, so tests inject. ── */

function species(
  id: string,
  rarity: Rarity,
  biome: BiomeId,
  reward = 0,
  unlock: UnlockRule = { type: 'free' },
): SpeciesLike {
  return { id, name: (id[0] ?? '').toUpperCase() + id.slice(1), biome, rarity, reward, unlock }
}

/** The eighteen ids the v2 game actually shipped with. */
const LEGACY_IDS = [
  'crane', 'fox', 'frog', 'butterfly', 'whale', 'rabbit', 'owl', 'cat', 'fish',
  'turtle', 'penguin', 'dino', 'ladybug', 'snail', 'octopus', 'bat', 'pumpkin', 'snowhare',
]

const RARITY_CYCLE: Rarity[] = ['common', 'common', 'uncommon', 'rare', 'common', 'uncommon', 'mythic']
const BIOME_CYCLE: BiomeId[] = ['meadow', 'shore', 'forest', 'peak', 'nightsky']

const SPECIES: SpeciesLike[] = LEGACY_IDS.map((id, i) =>
  species(id, RARITY_CYCLE[i % RARITY_CYCLE.length] ?? 'common', BIOME_CYCLE[i % BIOME_CYCLE.length] ?? 'meadow'),
)

const BIOMES: BiomeLike[] = [
  { id: 'meadow', name: 'The Meadow', ambience: 'meadow', unlockAt: 0 },
  { id: 'shore', name: 'The Shore', ambience: 'shore', unlockAt: 3 },
  { id: 'forest', name: 'The Forest', ambience: 'rain', unlockAt: 8 },
  { id: 'peak', name: 'The Peak', ambience: 'none', unlockAt: 15 },
  { id: 'nightsky', name: 'The Night Sky', ambience: 'night', unlockAt: 25 },
]

const PACK_SOURCE: Washi['source'] = { type: 'pack', sku: SKU_ID.washiKyotoSpring }
const WASHI: WashiLike[] = [
  { id: 'kozo', name: 'Kozo', rarity: 'common', source: { type: 'free' } },
  { id: 'beni-dye', name: 'Safflower', rarity: 'uncommon', source: { type: 'sheets', cost: 320 } },
  { id: 'kinpaku', name: 'Gold Leaf', rarity: 'mythic', source: { type: 'goldleaf', cost: 12 } },
  { id: 'sakura-1', name: 'First Blossom', rarity: 'rare', source: PACK_SOURCE },
  { id: 'season-6', name: 'Sixth Tier', rarity: 'rare', source: { type: 'journal', tier: 6 } },
  { id: 'season-8', name: 'Eighth Tier', rarity: 'rare', source: { type: 'journal', tier: 8 } },
]

const KNOWN_SPECIES = new Set(SPECIES.map((s) => s.id))
const KNOWN_WASHI = new Set(WASHI.map((w) => w.id))
const CTX = { knownSpecies: KNOWN_SPECIES, knownWashi: KNOWN_WASHI, defaultWashiId: 'kozo', env: staticEnv() }

const T0 = Date.UTC(2026, 7, 31, 12, 0, 0)
const DAY = 86_400_000

function studio(over: Partial<StudioResult> = {}): StudioResult {
  return { speciesId: 'crane', washiId: 'kozo', golden: false, quality: 0.8, creases: 12, seconds: 240, ...over }
}

/** Take the Daily Fold out of the picture so reward arithmetic is exact. */
const NO_DAILY: SaveV3['daily'] = { lastFold: null, streak: 0, todaySpecies: null, claimed: false }

/* ═══════════════════════════════════════════════════════════════════════════
   1 · v2 → v3
   ═══════════════════════════════════════════════════════════════════════════ */

section('1 · v2 to v3 migration (a real, messy old save)')

const V2_PAYLOAD = {
  collection: ['crane', 'fox', 'frog', 'butterfly', 'whale', 'owl', 'cat', 'turtle', 'dodo'],
  gold: ['fox', 'whale', 'dodo'],
  folds: { crane: 7, fox: 3, frog: 1, butterfly: 2, whale: 1, owl: 4, cat: 1, turtle: 12, penguin: 2 },
  hearts: { crane: 14, fox: 2, whale: 30, cat: 1 },
}

const m2 = migrateV2(V2_PAYLOAD, { ...CTX, now: T0 })
const v3 = m2.save
const byId = new Map(v3.kami.map((k) => [k.speciesId, k]))

eq('every known collected species became a Kami', v3.kami.length, 9)
ok('"penguin" survived — it had folds but no collection entry', byId.has('penguin'))
ok('"dodo" was dropped, not crashed on', !byId.has('dodo') && m2.repairs.some((r) => r.includes('dodo')))
ok('golden carried from the gold array', byId.get('fox')?.golden === true && byId.get('whale')?.golden === true)
ok('non-golden stayed non-golden', byId.get('crane')?.golden === false)
eq('hearts 14 → bond capped at 100', byId.get('crane')?.bond, 100)
eq('hearts 2 → bond 20', byId.get('fox')?.bond, 20)
eq('hearts 1 → bond 10', byId.get('cat')?.bond, 10)
eq('a species with no hearts starts at 0 bond', byId.get('turtle')?.bond, 0)
eq('fold counts carried untouched', v3.folds.turtle, 12)
eq('a collected species with no fold count is worth one fold', v3.folds.frog, 1)
eq('mastery survives the migration', masteryFor(v3.folds.turtle ?? 0), 'master')
eq('totalFolds is the sum of the fold table', v3.stats.totalFolds, Object.values(v3.folds).reduce((a, b) => a + b, 0))
eq('migration credit', v3.sheets, migrationGrant(9).sheets)
ok('a returning player never meets the cold open', hasSeen(v3.seen, FLAG.onboarded))
ok('a returning player has the shop legitimately open', isStorefrontOpen(v3))
ok('every Kami got the default paper', v3.kami.every((k) => k.washiId === 'kozo'))
ok('quality is the neutral 0.75, not invented', v3.kami.every((k) => k.quality === 0.75))
ok('foldedAt runs oldest-first and is distinct', v3.kami.every((k, i) => i === 0 || k.foldedAt > (v3.kami[i - 1]?.foldedAt ?? 0)))
ok('uids are unique', new Set(v3.kami.map((k) => k.uid)).size === v3.kami.length)
ok('positions are on the planet', v3.kami.every((k) => k.pos[0] >= 0 && k.pos[0] <= 1 && k.pos[1] >= 0 && k.pos[1] <= 1))

const m2again = migrateV2(V2_PAYLOAD, { ...CTX, now: T0 })
eq('migration is deterministic — the planet lays out the same every time', m2again.save.kami.map((k) => k.pos), v3.kami.map((k) => k.pos))

const lostSpecies = [...new Set([...V2_PAYLOAD.collection, ...Object.keys(V2_PAYLOAD.folds), ...Object.keys(V2_PAYLOAD.hearts)])]
  .filter((id) => KNOWN_SPECIES.has(id))
  .filter((id) => !byId.has(id))
eq('nothing known was lost', lostSpecies, [])

section('2 · v1 to v3 migration (a bare string array)')

const m1 = migrateV1(['crane', 'fox', 'frog', 'dodo', 42, null], { ...CTX, now: T0 })
eq('three known species survived', m1.save.kami.length, 3)
eq('every v1 species is worth one fold', m1.save.folds, { crane: 1, fox: 1, frog: 1 })
eq('no golden in v1', m1.save.kami.filter((k) => k.golden).length, 0)
eq('bond starts at zero — v1 had no hearts', m1.save.kami.map((k) => k.bond), [0, 0, 0])
eq('v1 migration credit', m1.save.sheets, migrationGrant(3).sheets)
ok('non-strings in the array were ignored, not crashed on', m1.repairs.some((r) => r.startsWith('v1:')))

section('3 · loadSave picks the newest save it can find')

{
  const s2 = memoryStorage({ [SAVE_KEY_V2]: JSON.stringify(V2_PAYLOAD) })
  eq('v2 key alone → migrated', loadSave({ ...CTX, now: T0, storage: s2 }).source, 'v2')

  const s1 = memoryStorage({ [SAVE_KEY_V1]: JSON.stringify(['crane', 'fox']) })
  eq('v1 key alone → migrated', loadSave({ ...CTX, now: T0, storage: s1 }).source, 'v1')

  const s3 = memoryStorage({
    [SAVE_KEY]: JSON.stringify({ ...defaultSave({ ...CTX, now: T0 }), sheets: 999 }),
    [SAVE_KEY_V2]: JSON.stringify(V2_PAYLOAD),
  })
  const loaded = loadSave({ ...CTX, now: T0, storage: s3 })
  ok('v3 wins over a stale v2 key', loaded.source === 'v3' && loaded.save.sheets === 999)

  eq('an empty device starts fresh', loadSave({ ...CTX, now: T0, storage: memoryStorage() }).source, 'new')
  eq('no storage at all still returns a playable save', loadSave({ ...CTX, now: T0, storage: null }).storageOk, false)
  ok('the browser storage path is reachable', browserStorage() !== null)
}

/* ═══════════════════════════════════════════════════════════════════════════
   4 · CORRUPTION
   ═══════════════════════════════════════════════════════════════════════════ */

section('4 · corrupted and partial saves recover instead of throwing')

{
  const broken = memoryStorage({ [SAVE_KEY]: '{ this is not json' })
  eq('unparseable v3 falls through to a fresh save', loadSave({ ...CTX, now: T0, storage: broken }).source, 'new')

  const partial = normalizeSave(
    {
      version: 9,
      kami: 'not an array',
      folds: { crane: 'x', fox: 2, dodo: 4 },
      sheets: '12',
      goldLeaf: -5,
      biomes: ['meadow', 'moon'],
      entitlements: ['a', 'a', 7],
      activeWashi: 'nonexistent',
      washi: ['kozo', 'ghost-paper'],
      settings: { theme: 'purple', volumes: { music: 9, sfx: -3 }, highInk: 'yes' },
      daily: { lastFold: 'yesterday', streak: -4, todaySpecies: 'dodo' },
      journal: { tier: -1, xp: 'lots' },
      stats: { totalFolds: 'many' },
      seen: ['onboarded', 'onboarded', 12],
    },
    { ...CTX, now: T0 },
  )
  const p = partial.save
  eq('a non-array kami list becomes an empty one', p.kami, [])
  eq('unparseable fold counts are dropped, valid ones kept', p.folds, { fox: 2 })
  eq('a string in a number field falls back', p.sheets, 0)
  eq('negative currency is clamped', p.goldLeaf, 0)
  eq('an invented biome is dropped', p.biomes, ['meadow'])
  eq('entitlements are de-duped and type-filtered', p.entitlements, ['a'])
  eq('an unowned active washi is repaired', p.activeWashi, 'kozo')
  eq('an unknown owned washi is dropped', p.washi, ['kozo'])
  eq('an invalid theme falls back to auto', p.settings.theme, 'auto')
  eq('volumes are clamped to 0..1', [p.settings.volumes.music, p.settings.volumes.sfx], [1, 0])
  eq('a non-boolean setting falls back', p.settings.highInk, false)
  eq('an unreadable date is cleared', p.daily.lastFold, null)
  eq('a negative streak is clamped', p.daily.streak, 0)
  eq('a daily species that no longer exists is cleared', p.daily.todaySpecies, null)
  eq('journal fields are coerced', [p.journal.tier, p.journal.xp], [0, 0])
  eq('seen is de-duped and type-filtered', p.seen, ['onboarded'])
  ok('every repair was reported', partial.repairs.length >= 4, `${partial.repairs.length} repairs`)

  const badKami = normalizeSave(
    {
      version: 3,
      kami: [
        { uid: 'a', speciesId: 'crane', washiId: 'kozo', pos: [0.4, 0.4], bond: 500, quality: 4, golden: 1 },
        { uid: 'a', speciesId: 'fox', washiId: 'ghost', pos: 'nope', bond: -3, nickname: '   ' },
        { uid: 'c', speciesId: 'dodo' },
        { speciesId: '' },
        'garbage',
      ],
    },
    { ...CTX, now: T0 },
  )
  eq('three bad entries dropped, two repaired and kept', badKami.save.kami.length, 2)
  eq('bond is clamped to 0..100', badKami.save.kami[0]?.bond, 100)
  eq('quality is clamped to 0..1', badKami.save.kami[0]?.quality, 1)
  eq('a non-boolean golden falls back', badKami.save.kami[0]?.golden, false)
  ok('a duplicate uid is regenerated', badKami.save.kami[1]?.uid !== 'a')
  eq('an unknown washi is repaired to the default', badKami.save.kami[1]?.washiId, 'kozo')
  ok('a bad position is replaced deterministically', (badKami.save.kami[1]?.pos[0] ?? -1) >= 0)
  eq('a whitespace nickname becomes null', badKami.save.kami[1]?.nickname, null)
  ok('a Kami that exists implies a fold count', (badKami.save.folds.crane ?? 0) >= 1)
}

/* ═══════════════════════════════════════════════════════════════════════════
   5 · PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

section('5 · debounced, throttled, quota-safe persistence')

class FakeClock {
  t = 1_000_000
  seq = 1
  timers: Array<{ id: number; at: number; fn: () => void }> = []
  now = (): number => this.t
  set = (fn: () => void, ms: number): unknown => {
    const id = this.seq++
    this.timers.push({ id, at: this.t + Math.max(0, ms), fn })
    return id
  }
  clear = (h: unknown): void => {
    this.timers = this.timers.filter((x) => x.id !== h)
  }
  advance(ms: number): void {
    this.t += ms
    const due = this.timers.filter((x) => x.at <= this.t).sort((a, b) => a.at - b.at)
    this.timers = this.timers.filter((x) => x.at > this.t)
    for (const timer of due) timer.fn()
  }
}

function readSheets(raw: string | null): number {
  if (raw === null) return -1
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed === 'object' && parsed !== null && 'sheets' in parsed) {
    const value = (parsed as { sheets: unknown }).sheets
    return typeof value === 'number' ? value : -1
  }
  return -1
}

{
  const clock = new FakeClock()
  let writes = 0
  const inner = memoryStorage()
  const counting: SaveStorage = {
    getItem: inner.getItem,
    setItem: (k, v) => {
      writes++
      inner.setItem(k, v)
    },
    removeItem: inner.removeItem,
  }
  const persister = createPersister({
    storage: counting,
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    debounceMs: 600,
    minIntervalMs: 2500,
  })
  const base = defaultSave({ ...CTX, now: T0 })
  for (let i = 0; i < 25; i++) persister.schedule({ ...base, sheets: i })
  eq('a burst of 25 mutations has written nothing yet', writes, 0)
  clock.advance(700)
  eq('the burst coalesced into a single write', writes, 1)
  eq('and the last value won', readSheets(inner.getItem(SAVE_KEY)), 24)

  persister.schedule({ ...base, sheets: 99 })
  clock.advance(700)
  eq('a write inside the throttle window is held back', writes, 1)
  clock.advance(2000)
  eq('and lands once the throttle expires', writes, 2)

  persister.schedule({ ...base, sheets: 123 })
  ok('flush() writes immediately', persister.flush() && writes === 3)
  eq('flush() with nothing pending is a no-op', persister.flush(), false)
}

{
  let attempts = 0
  const inner = memoryStorage({ [SAVE_KEY_V2]: 'x', [SAVE_KEY_V1]: 'y' })
  const full: SaveStorage = {
    getItem: inner.getItem,
    setItem: (k, v) => {
      attempts++
      if (attempts <= 1) throw new DOMException('full', 'QuotaExceededError')
      inner.setItem(k, v)
    },
    removeItem: inner.removeItem,
  }
  const clock = new FakeClock()
  const persister = createPersister({ storage: full, now: clock.now, setTimer: clock.set, clearTimer: clock.clear })
  persister.schedule(defaultSave({ ...CTX, now: T0 }))
  persister.flush()
  ok('quota is recovered by retiring the legacy keys', inner.getItem(SAVE_KEY_V2) === null && inner.getItem(SAVE_KEY) !== null)

  const hopeless: SaveStorage = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
    removeItem: () => {},
  }
  const p2 = createPersister({ storage: hopeless, now: clock.now, setTimer: clock.set, clearTimer: clock.clear })
  p2.schedule(defaultSave({ ...CTX, now: T0 }))
  p2.flush()
  const status = p2.status()
  eq('a hopeless disk reports quota rather than throwing', status?.ok === false ? status.reason : 'none', 'quota')

  const p3 = createPersister({ storage: null, now: clock.now, setTimer: clock.set, clearTimer: clock.clear })
  p3.schedule(defaultSave({ ...CTX, now: T0 }))
  const s3 = p3.status()
  eq('private browsing reports unavailable and never throws', s3?.ok === false ? s3.reason : 'none', 'unavailable')
}

section('6 · export and import')

{
  const original = migrateV2(V2_PAYLOAD, { ...CTX, now: T0 }).save
  const json = exportSave(original, T0)
  const back = importSave(json, { ...CTX, now: T0 })
  ok('an exported save re-imports', back.ok)
  if (back.ok) {
    eq('every Kami came back', back.save.kami, original.kami)
    eq('the purse came back', [back.save.sheets, back.save.goldLeaf], [original.sheets, original.goldLeaf])
    eq('the fold table came back', back.save.folds, original.folds)
    eq('the flags came back', [...back.save.seen].sort(), [...original.seen].sort())
  }
  const fromV2 = importSave(JSON.stringify(V2_PAYLOAD), { ...CTX, now: T0 })
  ok('a bare v2 file imports and migrates', fromV2.ok && fromV2.source === 'v2')
  const fromV1 = importSave(JSON.stringify(['crane', 'fox']), { ...CTX, now: T0 })
  ok('a bare v1 file imports and migrates', fromV1.ok && fromV1.source === 'v1')
  eq('a nonsense file is refused politely', importSave('hello', {}).ok, false)
  eq('the wrong JSON is refused politely', importSave('{"hello":"world"}', {}).ok, false)
}

/* ═══════════════════════════════════════════════════════════════════════════
   7 · ECONOMY
   ═══════════════════════════════════════════════════════════════════════════ */

section('7 · the reward curve')

const common = species('c', 'common', 'meadow')
const mythic = species('m', 'mythic', 'peak')
const rare = species('r', 'rare', 'forest')

function sheetsFor(s: SpeciesLike, over: Partial<StudioResult>, ctx: Parameters<typeof foldReward>[2]): number {
  return foldReward(s, { quality: over.quality ?? 0.8, golden: over.golden ?? false }, ctx).sheets
}

eq('quality 0.8 is a x1.15 multiplier', qualityMultiplier(0.8), 1.15)
eq('quality 0 still pays x0.75 — there are no fail states', qualityMultiplier(0), 0.75)
eq('quality 1.0 tops out at x1.25', qualityMultiplier(1), 1.25)

eq('common, first fold, q0.8   → 41', sheetsFor(common, {}, { foldCount: 1, mastery: 'none', mode: 'normal', atelier: false }), 41)
eq('common, repeat, q0.8       → 14', sheetsFor(common, {}, { foldCount: 2, mastery: 'none', mode: 'normal', atelier: false }), 14)
eq('uncommon, first fold, q0.8 → 69', sheetsFor(species('u', 'uncommon', 'shore'), {}, { foldCount: 1, mastery: 'none', mode: 'normal', atelier: false }), 69)
eq('rare, first fold, q0.8     → 117', sheetsFor(rare, {}, { foldCount: 1, mastery: 'none', mode: 'normal', atelier: false }), 117)
eq('mythic, first fold, q1.0   → 206', sheetsFor(mythic, { quality: 1 }, { foldCount: 1, mastery: 'none', mode: 'normal', atelier: false }), 206)
eq('rare repeat, Grand, golden, Atelier → 127', sheetsFor(rare, { golden: true }, { foldCount: 12, mastery: 'grand', mode: 'normal', atelier: true }), 127)
eq('a shaky fold still pays (common, q0)', sheetsFor(common, { quality: 0 }, { foldCount: 2, mastery: 'none', mode: 'normal', atelier: false }), 9)
eq('the Daily Fold adds a flat 25', sheetsFor(common, {}, { foldCount: 2, mastery: 'none', mode: 'daily', atelier: false }) - sheetsFor(common, {}, { foldCount: 2, mastery: 'none', mode: 'normal', atelier: false }), 25)
eq('Zen awards nothing, by contract', sheetsFor(mythic, { quality: 1 }, { foldCount: 1, mastery: 'none', mode: 'zen', atelier: true }), 0)

{
  const plain = sheetsFor(rare, {}, { foldCount: 3, mastery: 'adept', mode: 'normal', atelier: false })
  const member = sheetsFor(rare, {}, { foldCount: 3, mastery: 'adept', mode: 'normal', atelier: true })
  eq(`the Atelier is exactly x${ATELIER_SHEETS_MULT}`, member, plain * ATELIER_SHEETS_MULT)
}

{
  const authored = species('a', 'common', 'meadow', 60)
  eq('an authored Species.reward is paid to the number', sheetsFor(authored, { quality: 0.5 }, { foldCount: 1, mastery: 'none', mode: 'normal', atelier: false }), 60)
  const silly = species('s', 'common', 'meadow', 5000)
  ok('an absurd authored reward is clamped', sheetsFor(silly, { quality: 0.5 }, { foldCount: 1, mastery: 'none', mode: 'normal', atelier: false }) <= RARITY_BASE.common * 6)
}

ok(
  'no fold is ever worth less than the floor',
  [0, 0.3, 1].every((q) => sheetsFor(common, { quality: q }, { foldCount: 5, mastery: 'none', mode: 'normal', atelier: false }) >= MIN_FOLD_SHEETS),
)

section('8 · folding is free, and a free player can finish')

ok('canFold() is unconditionally true', canFold() === true)
ok('FOLD_COST is empty', priceIsFree(FOLD_COST))
ok('an empty purse can still fold', canAfford({ sheets: 0, goldLeaf: 0 }, FOLD_COST))
eq('spending more than you have is refused, not overdrawn', spend({ sheets: 10, goldLeaf: 0 }, { sheets: 40 }).ok, false)
eq('a legitimate spend leaves the right change', spend({ sheets: 400, goldLeaf: 3 }, { sheets: 320 }), {
  ok: true,
  wallet: { sheets: 80, goldLeaf: 3 },
  spent: { sheets: 320, goldLeaf: 0 },
})

{
  const catalogue: SpeciesLike[] = Array.from({ length: 40 }, (_, i) =>
    species(`s${i}`, (['common', 'common', 'common', 'uncommon', 'uncommon', 'rare', 'mythic'] as Rarity[])[i % 7] ?? 'common', 'meadow'),
  )
  let sheets = 0
  let masteryLeaf = 0
  for (const s of catalogue) {
    for (let n = 1; n <= MASTERY_THRESHOLDS.master; n++) {
      const tier = masteryFor(n)
      sheets += foldReward(s, { quality: 0.8, golden: false }, { foldCount: n, mastery: tier, mode: 'normal', atelier: false }).sheets
      if (tier !== masteryFor(n - 1)) masteryLeaf += masteryGoldLeaf(tier)
    }
  }
  const yearOfStreaks = Array.from({ length: 365 }, (_, i) => streakGoldLeaf(i + 1)).reduce((a, b) => a + b, 0)
  const journalFree = 12 * 4
  const freeGoldLeaf = masteryLeaf + yearOfStreaks + journalFree

  const washiCost =
    10 * SUGGESTED_WASHI_SHEETS.common +
    8 * SUGGESTED_WASHI_SHEETS.uncommon +
    4 * SUGGESTED_WASHI_SHEETS.rare +
    2 * SUGGESTED_WASHI_SHEETS.mythic
  const goldLeafCost = 4 * SUGGESTED_GOLDLEAF_UNLOCK.mythic

  ok('a free player out-earns the whole Washi catalogue', sheets >= washiCost, `${sheets} Sheets earned vs ${washiCost} needed`)
  ok('a free player out-earns every Gold-Leaf fold', freeGoldLeaf >= goldLeafCost, `${freeGoldLeaf} Gold Leaf a year vs ${goldLeafCost} needed`)
  ok('the curve does not trivialise a Washi', sheets / washiCost < 3, `400 folds earns ${(sheets / washiCost).toFixed(2)}x the catalogue`)

  const oneSession = [1, 2, 1, 2, 3]
    .map((n, i) => foldReward(catalogue[i] ?? common, { quality: 0.8, golden: false }, { foldCount: n, mastery: masteryFor(n), mode: 'normal', atelier: false }).sheets)
    .reduce((a, b) => a + b, 0)
  ok(
    'a five-fold session buys roughly one paper',
    oneSession >= SUGGESTED_WASHI_SHEETS.common * 0.5 && oneSession <= SUGGESTED_WASHI_SHEETS.rare,
    `${oneSession} Sheets a session; a common paper is ${SUGGESTED_WASHI_SHEETS.common}`,
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   9 · PROGRESSION
   ═══════════════════════════════════════════════════════════════════════════ */

section('9 · mastery boundaries')

eq('0 folds    → none', masteryFor(0), 'none')
eq('1 fold     → novice', masteryFor(1), 'novice')
eq('2 folds    → novice', masteryFor(2), 'novice')
eq('3 folds    → adept', masteryFor(3), 'adept')
eq('9 folds    → adept', masteryFor(9), 'adept')
eq('10 folds   → master', masteryFor(10), 'master')
eq('24 folds   → master', masteryFor(24), 'master')
eq('25 folds   → grand', masteryFor(25), 'grand')
eq('1000 folds → grand', masteryFor(1000), 'grand')
eq('the thresholds are 1 / 3 / 10 / 25', [MASTERY_THRESHOLDS.novice, MASTERY_THRESHOLDS.adept, MASTERY_THRESHOLDS.master, MASTERY_THRESHOLDS.grand], [1, 3, 10, 25])

{
  const p = masteryProgress(2)
  eq('progress inside a tier', [p.tier, p.next, p.into, p.span, p.foldsToNext], ['novice', 'adept', 1, 2, 1])
  eq('Grand is the end of the road', masteryProgress(40).next, null)
}

{
  const first = claimMasteryMilestone([], 'crane', 'master')
  const second = claimMasteryMilestone(first.seen, 'crane', 'master')
  eq('mastering a fold pays once, ever', [first.goldLeaf, second.goldLeaf], [1, 0])
  eq('Grand pays two', claimMasteryMilestone([], 'crane', 'grand').goldLeaf, 2)
  eq('Novice pays none', claimMasteryMilestone([], 'crane', 'novice').goldLeaf, 0)
  eq('a different species has its own milestone', claimMasteryMilestone(first.seen, 'fox', 'master').goldLeaf, 1)
}

section('10 · biomes and the unlock evaluator')

eq('an empty collection opens only the Meadow', unlockedBiomes(BIOMES, 0, []), ['meadow'])
eq('nine folds opens three biomes', unlockedBiomes(BIOMES, 9, []), ['meadow', 'shore', 'forest'])
eq('the whole catalogue opens everything', unlockedBiomes(BIOMES, 40, []).length, 5)
ok('a biome once open never closes', unlockedBiomes(BIOMES, 0, ['peak']).includes('peak'))

{
  const ctx = {
    collectionSize: 3,
    folds: { crane: 9, fox: 25 },
    biomes: ['meadow', 'shore'] as BiomeId[],
    entitlements: [ENT.atelier, ENT.species('locked-fold')],
    goldLeaf: 14,
    nameFor: (id: string) => id,
  }
  eq('free is always open', evaluateUnlock('x', { type: 'free' }, ctx).unlocked, true)
  eq('collection: 3 of 5 is locked, with progress', evaluateUnlock('x', { type: 'collection', count: 5 }, ctx).progress, { have: 3, need: 5 })
  eq('collection: 3 of 3 is open', evaluateUnlock('x', { type: 'collection', count: 3 }, ctx).unlocked, true)
  eq('species mastery: 9 folds is not Master', evaluateUnlock('x', { type: 'species', id: 'crane', mastery: 'master' }, ctx).unlocked, false)
  eq('species mastery: 9 folds is Adept', evaluateUnlock('x', { type: 'species', id: 'crane', mastery: 'adept' }, ctx).unlocked, true)
  eq('species mastery: 25 folds is Grand', evaluateUnlock('x', { type: 'species', id: 'fox', mastery: 'grand' }, ctx).unlocked, true)
  eq('biome: an unopened biome locks', evaluateUnlock('x', { type: 'biome', id: 'peak' }, ctx).unlocked, false)
  eq('biome: an opened biome unlocks', evaluateUnlock('x', { type: 'biome', id: 'shore' }, ctx).unlocked, true)
  eq('purchase: the Atelier covers its own folds', evaluateUnlock('x', { type: 'purchase', sku: 'atelier.monthly' }, ctx).unlocked, true)
  eq('purchase: an unowned sku locks', evaluateUnlock('x', { type: 'purchase', sku: SKU_ID.journalPremium }, ctx).unlocked, false)
  eq('goldleaf: an opened fold stays open', evaluateUnlock('locked-fold', { type: 'goldleaf', cost: 12 }, ctx).unlocked, true)
  const gl = evaluateUnlock('other-fold', { type: 'goldleaf', cost: 12 }, ctx)
  eq('goldleaf: locked but affordable', [gl.unlocked, gl.affordable, gl.cost], [false, true, { goldLeaf: 12 }])
  eq('goldleaf: locked and out of reach', evaluateUnlock('other-fold', { type: 'goldleaf', cost: 40 }, ctx).affordable, false)
  ok('a locked card never scolds', !/fail|lost|too bad|sorry|denied/i.test(gl.reason), gl.reason)
}

section('11 · sparkle paper is generous, surprising, and unfarmable')

{
  // The v2 rule was: every third fold of the same species is a guaranteed golden.
  let seen: string[] = []
  let goldens = 0
  for (let i = 0; i < 40; i++) {
    const roll = rollGolden({ seen, dateKey: '2026-08-31', quality: 0.8, rng: () => 0.999 })
    seen = roll.seen
    if (roll.golden) goldens++
  }
  eq('40 identical folds never force a golden', goldens, 0)
  ok('but the odds climbed the whole way', sparkleChance(40, 0.8) > sparkleChance(0, 0.8), `${(sparkleChance(0, 0.8) * 100).toFixed(0)}% → ${(sparkleChance(40, 0.8) * 100).toFixed(0)}%`)
  eq('and the odds are capped', sparkleChance(1000, 1), 0.75)
  ok('folding well helps a little', sparkleChance(0, 1) > sparkleChance(0, 0))
  ok('the roll takes no species at all — there is nothing to farm', rollGolden({ seen: [], dateKey: 'd', quality: 0.5, rng: () => 1 }).pity === 1)
}

{
  let seen: string[] = []
  let goldens = 0
  for (let i = 0; i < 6; i++) {
    const roll = rollGolden({ seen, dateKey: '2026-08-31', quality: 1, rng: () => 0 })
    seen = roll.seen
    if (roll.golden) goldens++
  }
  eq(`the daily cap holds at ${SPARKLE_DAILY_CAP}`, goldens, SPARKLE_DAILY_CAP)
  const capped = rollGolden({ seen, dateKey: '2026-08-31', quality: 1, rng: () => 0 })
  ok('a capped day costs you no progress', capped.cappedToday && capped.pity === 0)
  ok('tomorrow the cap has reset', rollGolden({ seen: capped.seen, dateKey: '2026-09-01', quality: 1, rng: () => 0 }).golden)
}

section('12 · bond has a daily ceiling and a forgiving floor')

{
  let seen: string[] = []
  let bond = BOND_START
  const gains: number[] = []
  for (let i = 0; i < 5; i++) {
    const out = tendKami({ kami: { uid: 'k1', bond }, seen, dateKey: '2026-08-31', kind: 'feed' })
    seen = out.seen
    bond = out.bond
    gains.push(out.gained)
  }
  eq('feeding gives 6, 6, 6, 2, then nothing', gains, [6, 6, 6, 2, 0])
  eq(`the daily ceiling is ${BOND_DAILY_CAP}`, bond - BOND_START, BOND_DAILY_CAP)
  eq('tomorrow the allowance returns', tendKami({ kami: { uid: 'k1', bond }, seen, dateKey: '2026-09-01', kind: 'feed' }).gained, 6)
  const refused = tendKami({ kami: { uid: 'k1', bond }, seen, dateKey: '2026-08-31', kind: 'pet' })
  ok('and the refusal is never a scold', !/can.?t|cannot|denied|error|too many|failed/i.test(refused.note), refused.note)
  eq('the ceiling is per Kami, not per planet', tendKami({ kami: { uid: 'k2', bond: 10 }, seen, dateKey: '2026-08-31', kind: 'feed' }).gained, 6)
  eq('petting is worth less than feeding', tendKami({ kami: { uid: 'k3', bond: 10 }, seen, dateKey: '2026-08-31', kind: 'pet' }).gained, 2)
}

{
  const kami = (uid: string, bond: number): KamiInstance => ({
    uid, speciesId: 'crane', washiId: 'kozo', nickname: null, foldedAt: 0, pos: [0.5, 0.5], bond, golden: false, quality: 1,
  })
  const start = [kami('a', 100), kami('b', 40), kami('c', 20)]
  const seeded = decayBond(start, [], T0).seen
  eq('the first visit sets a checkpoint and costs nothing', decayBond(start, [], T0).lost, 0)
  eq('two days away costs nothing — there is a grace', decayBond(start, seeded, T0 + 2 * DAY).lost, 0)
  const away = decayBond(start, seeded, T0 + 10 * DAY)
  eq('ten days away drifts 14', away.lost, 14)
  eq('a beloved Kami settles, it does not forget you', away.kami[0]?.bond, 86)
  eq(`nothing falls below ${BOND_FLOOR}`, away.kami[1]?.bond, BOND_FLOOR)
  eq('a Kami already below the floor is left alone', away.kami[2]?.bond, 20)
  const year = decayBond(start, seeded, T0 + 365 * DAY)
  ok('a year away still leaves everyone at or above the floor they started from', year.kami.every((k, i) => k.bond >= Math.min(BOND_FLOOR, start[i]?.bond ?? 0)))
  eq('a clock moved backwards cannot manufacture decay', decayBond(start, seeded, T0 - 30 * DAY).lost, 0)
}

/* ═══════════════════════════════════════════════════════════════════════════
   13 · THE DAILY FOLD
   ═══════════════════════════════════════════════════════════════════════════ */

section('13 · the Daily Fold is the same for everyone, every day')

const POOL = [...SPECIES.map((s) => s.id)].sort()

{
  const a = dailySpeciesFor('2026-08-31', POOL)
  const b = dailySpeciesFor('2026-08-31', POOL)
  const c = dailySpeciesFor('2026-08-31', [...POOL].reverse().sort())
  eq('the same date gives the same fold, every call', a, b)
  eq('and the same fold for an equal but differently-ordered pool', a, c)
  ok('it is a real species', a !== null && POOL.includes(a), String(a))
  eq('a fixed date is a fixed answer', dailySpeciesFor('2026-01-01', POOL), dailySpeciesFor('2026-01-01', POOL))
  eq('an empty pool returns null instead of throwing', dailySpeciesFor('2026-08-31', []), null)
  eq('a one-species pool always picks it', dailySpeciesFor('2026-08-31', ['crane']), 'crane')

  let repeats = 0
  const picked = new Set<string>()
  for (let i = 0; i < 365; i++) {
    const key = shiftDateKey('2026-01-01', i)
    const today = dailySpeciesFor(key, POOL)
    if (today !== null) picked.add(today)
    if (today === dailySpeciesFor(shiftDateKey(key, -1), POOL)) repeats++
  }
  eq('a year never repeats yesterday', repeats, 0)
  ok('a year draws widely on the catalogue', picked.size >= POOL.length - 2, `${picked.size} of ${POOL.length} folds`)
}

section('14 · dates, timezones and clock changes')

eq('a local date key is YYYY-MM-DD', localDateKey(new Date(2026, 7, 31, 23, 30)), '2026-08-31')
eq('one minute before local midnight, still today', localDateKey(new Date(2026, 7, 31, 23, 59)), '2026-08-31')
eq('two minutes later, tomorrow', localDateKey(new Date(2026, 8, 1, 0, 1)), '2026-09-01')
eq('spring forward is still one day', daysBetween('2026-03-07', '2026-03-08'), 1)
eq('fall back is still one day', daysBetween('2026-10-24', '2026-10-25'), 1)
eq('across a year boundary', daysBetween('2025-12-31', '2026-01-01'), 1)
eq('across a leap day', daysBetween('2028-02-28', '2028-03-01'), 2)
eq('backwards is negative', daysBetween('2026-08-31', '2026-08-29'), -2)
eq('shifting across a month end', shiftDateKey('2026-02-28', 1), '2026-03-01')
eq('an unparseable key is inert, not a throw', daysBetween('nonsense', '2026-01-01'), 0)

section('15 · the streak forgives')

{
  let daily: SaveV3['daily'] = { lastFold: null, streak: 0, todaySpecies: null, claimed: false }
  let seen: string[] = []
  const day = (n: number): string => shiftDateKey('2026-06-01', n)
  const step = (n: number): ReturnType<typeof claimDailyFold> => {
    const claim = claimDailyFold(daily, seen, day(n))
    daily = claim.daily
    seen = claim.seen
    return claim
  }

  eq('day 1 starts the streak', step(0).streak, 1)
  eq('day 2 continues it', step(1).streak, 2)
  eq('day 3 continues it', step(2).streak, 3)
  const repeat = claimDailyFold(daily, seen, day(2))
  eq('claiming twice in one day is idempotent', [repeat.streak, repeat.streakGained, repeat.goldLeaf], [3, 0, 0])

  const graced = step(4)
  eq('one missed day is forgiven', [graced.event, graced.streak], ['grace', 4])
  ok('and it says so kindly', /kept your place/i.test(graced.message), graced.message)

  const secondSkip = step(6)
  eq('a second miss inside the week is not forgiven', [secondSkip.event, secondSkip.streak], ['welcome-back', 1])
  ok('but it never says what you lost', /welcome back/i.test(secondSkip.message) && !/lost|broke|failed|streak ended/i.test(secondSkip.message), secondSkip.message)

  for (let n = 7; n <= 11; n++) step(n)
  const seventh = step(12)
  eq('seven days pays a leaf of gold', [seventh.streak, seventh.goldLeaf], [7, 1])
  ok('and says something warm', /leaf of gold/i.test(seventh.message), seventh.message)

  const longGap = claimDailyFold(daily, seen, day(60))
  eq('a long absence resets gently to day one', [longGap.event, longGap.streak], ['welcome-back', 1])
  ok('with no mention of the days behind it', !/\d+ days ago|you lost/i.test(longGap.message), longGap.message)

  const rested = claimDailyFold({ lastFold: day(0), streak: 5, todaySpecies: null, claimed: true }, ['sys/grace-used-on=2026-05-01'], day(2))
  eq('grace returns after a week', [rested.event, rested.streak], ['grace', 6])
}

{
  const future: SaveV3['daily'] = { lastFold: '2027-01-01', streak: 12, todaySpecies: null, claimed: true }
  const opened = openDay(future, '2026-08-31', POOL)
  eq('a forward-dated save is clamped to today, not locked out', opened.daily.lastFold, '2026-08-31')
  eq('and the streak is kept', opened.daily.streak, 12)
  ok('and the repair is reported', opened.repairs.some((r) => r.includes('ahead of today')))

  const stale: SaveV3['daily'] = { lastFold: '2026-08-20', streak: 9, todaySpecies: 'crane', claimed: true }
  const rolled = openDay(stale, '2026-08-31', POOL)
  eq('yesterday’s claim is cleared at rollover', rolled.daily.claimed, false)
  eq('a new fold is drawn', rolled.daily.todaySpecies, dailySpeciesFor('2026-08-31', POOL))
  ok('and the greeting is a welcome', /welcome back/i.test(rolled.message ?? ''), String(rolled.message))

  const garbage: SaveV3['daily'] = { lastFold: 'whenever', streak: 3, todaySpecies: null, claimed: true }
  eq('an unreadable date is cleared, not crashed on', openDay(garbage, '2026-08-31', POOL).daily.lastFold, null)
}

/* ═══════════════════════════════════════════════════════════════════════════
   16 · COMMERCE
   ═══════════════════════════════════════════════════════════════════════════ */

section('16 · the catalog keeps BRAND.md §12')

eq('the ethics audit is clean', auditCatalog(CATALOG), [])
eq('the Atelier ships monthly and yearly', skusOfKind('subscription').map((s) => s.period), ['month', 'year'])
eq('four Washi packs', skusOfKind('washi-pack').map((s) => s.name), ['Kyoto Spring', 'Deep Sea', 'Midnight Garden', 'Marbled Suminagashi'])
eq('three Gold Leaf bundles', skusOfKind('goldleaf').length, 3)
eq('one Fold Journal track', skusOfKind('journal').length, 1)
ok('no sku carries an expiry', CATALOG.every((s) => !('expiresAt' in (s as unknown as Record<string, unknown>))))
ok('Gold Leaf bundles say out loud that Gold Leaf is earnable', skusOfKind('goldleaf').every((s) => s.benefits.some((b) => /also earned/i.test(b))))
ok('the Atelier promises exactly its six things', (skusOfKind('subscription')[0]?.benefits.length ?? 0) === 6)
eq('the season has twenty tiers and no end date', [SEASON_ONE.tiers.length, 'endsAt' in SEASON_ONE], [JOURNAL_TIER_COUNT, false])
ok('every tier gives something on the free track', SEASON_ONE.tiers.every((t) => t.free.length > 0))
ok('and something more on the premium track', SEASON_ONE.tiers.every((t) => t.premium.length > 0))

section('17 · purchase to entitlement to benefit, end to end')

{
  const storage = memoryStorage()
  const receipts = memoryStorage()
  const clock = T0
  const store = createGameStore({
    storage,
    now: () => clock,
    rng: () => 0.5,
    env: staticEnv(),
    applyToDocument: false,
    persistDebounceMs: 0,
    persistMinIntervalMs: 0,
  })
  const provider = new LocalStubProvider({ storage: receipts, latencyMs: 0, now: () => clock })

  store.getState().attachContent({ species: SPECIES, washi: WASHI, biomes: BIOMES })
  store.getState().hydrate()
  store.setState({ daily: NO_DAILY })
  await store.getState().setStoreProvider(provider)

  eq('the shop lists the whole catalog', store.getState().skus.length, CATALOG.length)

  ok('nothing is for sale before the first Kami', !isStorefrontOpen(store.getState()))
  const tooEarly = await store.getState().purchase(SKU_ID.atelierMonthly)
  eq('a purchase attempted before the first fold is refused', tooEarly.ok, false)
  eq('and no entitlement is granted', store.getState().entitlements, [])

  const first = store.getState().completeFold(studio({ speciesId: 'crane', quality: 0.8 }))
  ok('the first fold succeeds', first.ok && first.kami !== null)
  eq('and pays the first-fold reward (12 x 1.15 x 3 x 1.05 Novice)', store.getState().sheets, 43)
  ok('and the shop is now legitimately open', isStorefrontOpen(store.getState()))

  // Two more folds so the measured pair sits at the same mastery tier (Adept),
  // and the only difference between them really is the Atelier.
  store.getState().completeFold(studio({ speciesId: 'crane', quality: 0.8 }))
  store.getState().completeFold(studio({ speciesId: 'crane', quality: 0.8 }))
  const beforePlain = store.getState().sheets
  const plainFold = store.getState().completeFold(studio({ speciesId: 'crane', quality: 0.8 }))
  const plainSheets = store.getState().sheets - beforePlain

  const bought = await store.getState().purchase(SKU_ID.atelierMonthly)
  ok('the Atelier purchase goes through', bought.ok)
  ok('the entitlement lands', isAtelierMember(store.getState().entitlements))
  ok('and the sku receipt is recorded', hasEntitlement(store.getState().entitlements, ENT.sku(SKU_ID.atelierMonthly)))

  const beforeMember = store.getState().sheets
  store.getState().completeFold(studio({ speciesId: 'crane', quality: 0.8 }))
  const memberSheets = store.getState().sheets - beforeMember
  ok('the benefit is applied: the same fold now pays double', Math.abs(memberSheets - plainSheets * 2) <= 1, `${plainSheets} Sheets → ${memberSheets} Sheets, both at Adept`)
  ok('and the plain fold really was un-doubled', plainFold.reward.atelier === 1 && plainSheets > 0)

  const glBefore = store.getState().goldLeaf
  await store.getState().purchase(SKU_ID.goldLeaf34)
  eq('a Gold Leaf bundle credits the purse', store.getState().goldLeaf - glBefore, 34)
  await store.getState().purchase(SKU_ID.goldLeaf34)
  eq('Gold Leaf is consumable — it credits every time', store.getState().goldLeaf - glBefore, 68)

  const entsBefore = store.getState().entitlements.length
  await store.getState().purchase(SKU_ID.atelierMonthly)
  eq('a non-consumable bought twice grants nothing twice', store.getState().entitlements.length, entsBefore)

  const packWashi = WASHI.find((w) => w.source.type === 'pack')
  ok('a pack paper is not owned without the pack', packWashi !== undefined && !ownsWashi(packWashi.source, packWashi.id, { ...store.getState(), entitlements: [] }))
  ok('but the Atelier already includes it', packWashi !== undefined && ownsWashi(packWashi.source, packWashi.id, store.getState()))

  await store.getState().purchase(SKU_ID.journalPremium)
  ok('the Journal premium track is unlocked', store.getState().journal.premium)
  const seasonWashi = WASHI.find((w) => w.id === 'season-8')
  ok('a premium season paper stays locked until the tier is claimed', seasonWashi !== undefined && !ownsWashi(seasonWashi.source, seasonWashi.id, store.getState()))
  store.setState({ journal: { ...store.getState().journal, xp: 120 * 8, tier: 0 } })
  const claim = store.getState().claimJournal()
  eq('claiming the Journal takes eight tiers at once', claim.tiers.length, 8)
  ok('and pays both columns', claim.sheets > 0 && claim.goldLeaf > 0, `${claim.sheets} Sheets, ${claim.goldLeaf} Gold Leaf`)
  ok('now the season paper is yours', seasonWashi !== undefined && ownsWashi(seasonWashi.source, seasonWashi.id, store.getState()))
  eq('and nothing is left unclaimed', journalProgress(store.getState().journal, SEASON_ONE).hasUnclaimed, false)

  const fresh = new LocalStubProvider({ storage: receipts, latencyMs: 0, now: () => clock })
  await fresh.init()
  const restored = await fresh.restore()
  ok('a restore on a new device rebuilds entitlements from receipts', restored.includes(ENT.atelier) && restored.includes(ENT.journalPremium))
  ok('consumables are not restored — that would mint currency', !restored.some((e) => e.includes('goldleaf')))

  fresh.cancelSubscription(SKU_ID.atelierMonthly)
  ok('cancelling drops the subscription entitlement', !fresh.entitlements().includes(ENT.atelier))
  ok('but everything bought outright stays yours', fresh.entitlements().includes(ENT.journalPremium))

  const cancelling = new LocalStubProvider({ storage: memoryStorage(), latencyMs: 0, outcome: 'cancelled' })
  await cancelling.init()
  const cancelled = await cancelling.purchase(SKU_ID.washiDeepSea)
  eq('a cancelled purchase reports cancelled', cancelled.ok === false ? cancelled.reason : 'ok', 'cancelled')
  eq('and grants nothing', cancelling.entitlements(), [])
  const unknown = await cancelling.purchase('nope.not.a.sku')
  eq('an unknown sku is unavailable, not a crash', unknown.ok === false ? unknown.reason : 'ok', 'unavailable')

  const glStore = createGameStore({ storage: memoryStorage(), now: () => clock, rng: () => 0.5, env: staticEnv(), applyToDocument: false })
  glStore.getState().attachContent({
    species: [...SPECIES, species('kirin', 'mythic', 'nightsky', 0, { type: 'goldleaf', cost: 18 })],
    washi: WASHI,
    biomes: BIOMES,
  })
  glStore.getState().hydrate()
  eq('a Gold-Leaf fold is refused without the leaf', glStore.getState().unlockSpeciesWithGoldLeaf('kirin').ok, false)
  glStore.getState().grantGoldLeaf(18)
  eq('and opens with it', glStore.getState().unlockSpeciesWithGoldLeaf('kirin').ok, true)
  eq('the leaf was actually spent', glStore.getState().goldLeaf, 0)
  ok('and the fold is now foldable', hasEntitlement(glStore.getState().entitlements, ENT.species('kirin')))
}

/* ═══════════════════════════════════════════════════════════════════════════
   18 · THE STORE
   ═══════════════════════════════════════════════════════════════════════════ */

section('18 · the store, end to end')

{
  const storage = memoryStorage()
  let clock = T0
  const mk = (): ReturnType<typeof createGameStore> => {
    const s = createGameStore({
      storage,
      now: () => clock,
      rng: () => 0.5,
      env: staticEnv(),
      applyToDocument: false,
      persistDebounceMs: 0,
      persistMinIntervalMs: 0,
    })
    s.getState().attachContent({ species: SPECIES, washi: WASHI, biomes: BIOMES })
    s.getState().hydrate()
    return s
  }

  const s1 = mk()
  eq('a fresh planet has one biome and no Kami', [s1.getState().biomes, s1.getState().kami.length], [['meadow'], 0])
  eq('and the default paper', s1.getState().activeWashi, 'kozo')
  eq('and a Daily Fold already drawn for today', s1.getState().daily.todaySpecies, dailySpeciesFor(localDateKey(T0), POOL))

  // Folding today's Kami is the Daily Fold, whichever door you came in by.
  const todayId = s1.getState().daily.todaySpecies ?? 'crane'
  const dailyFold = s1.getState().completeFold(studio({ speciesId: todayId }))
  ok('folding today’s Kami claims the Daily Fold', dailyFold.daily !== null && dailyFold.daily.streak === 1)
  eq('and the streak is recorded', s1.getState().daily.streak, 1)
  eq('and today is marked done', s1.getState().daily.lastFold, localDateKey(T0))

  s1.setState({ daily: NO_DAILY })
  for (const id of ['crane', 'fox', 'frog'].filter((id) => id !== todayId).slice(0, 3)) {
    s1.getState().completeFold(studio({ speciesId: id }))
  }
  ok('three or four folds opens the Shore', s1.getState().biomes.includes('shore'), JSON.stringify(s1.getState().biomes))
  ok('the first-fold flag is set', hasSeen(s1.getState().seen, FLAG.firstFold))

  const kamiCount = s1.getState().kami.length
  const zenBefore = s1.getState().sheets
  const zen = s1.getState().completeFold(studio({ speciesId: 'crane', seconds: 900, creases: 40 }), 'zen')
  eq('Zen awards nothing', s1.getState().sheets, zenBefore)
  eq('and adds no Kami', s1.getState().kami.length, kamiCount)
  ok('but it counts as time at the desk', s1.getState().stats.studioSeconds >= 900 && zen.ok)

  const bad = s1.getState().completeFold(studio({ speciesId: 'dodo' }))
  eq('a fold of a species that does not exist fails quietly', bad.ok, false)
  eq('and changes nothing', s1.getState().kami.length, kamiCount)

  ok('flushing writes the save', s1.getState().flushSave())

  clock += 5000
  const s2 = mk()
  eq('a new session reads the same planet back', s2.getState().kami.length, kamiCount)
  eq('with the same purse', s2.getState().sheets, s1.getState().sheets)
  eq('and the same biomes', s2.getState().biomes, s1.getState().biomes)
  eq('and it came from v3, not a migration', s2.getState().saveSource, 'v3')

  const uid = s2.getState().kami[0]?.uid ?? ''
  s2.getState().renameKami(uid, '  Tsuru  ')
  eq('a nickname is trimmed', s2.getState().kami[0]?.nickname, 'Tsuru')
  s2.getState().renameKami(uid, '   ')
  eq('and cleared when emptied', s2.getState().kami[0]?.nickname, null)
  s2.getState().moveKami(uid, [4, -1])
  eq('a position is clamped to the planet', s2.getState().kami[0]?.pos, [1, 0])

  eq('tending raises bond', s2.getState().tend(uid, 'feed')?.gained, 6)
  eq('and it persists in state', s2.getState().kami[0]?.bond, BOND_START + 6)
  eq('tending a Kami that is not there is null, not a throw', s2.getState().tend('nope', 'pet'), null)

  s2.getState().grantSheets(400)
  const paper = WASHI.find((w) => w.id === 'beni-dye')
  ok('a Sheets paper can be bought', paper !== undefined && s2.getState().buyWashi(paper).ok)
  eq('and becomes the active paper', s2.getState().activeWashi, 'beni-dye')
  ok('buying it twice is refused', paper !== undefined && !s2.getState().buyWashi(paper).ok)
  const goldPaper = WASHI.find((w) => w.id === 'kinpaku')
  ok('an unaffordable paper is refused kindly', goldPaper !== undefined && /fold a few more/i.test(s2.getState().buyWashi(goldPaper).reason ?? ''))

  const sheetsBefore = s2.getState().sheets
  const exported = s2.getState().exportSaveJson()
  s2.getState().resetEverything()
  eq('a reset really resets', s2.getState().kami.length, 0)
  eq('and the import brings it all back', s2.getState().importSaveJson(exported).ok, true)
  eq('every Kami', s2.getState().kami.length, kamiCount)
  eq('every Sheet', s2.getState().sheets, sheetsBefore)
  eq('a bad import is refused without damage', s2.getState().importSaveJson('nonsense').ok, false)
  eq('and the planet is untouched', s2.getState().kami.length, kamiCount)

  const kamiRef = s2.getState().kami
  const settingsRef = s2.getState().settings
  s2.getState().grantSheets(10)
  ok('a currency tick leaves the kami array identical by reference', s2.getState().kami === kamiRef)
  ok('and the settings object identical by reference', s2.getState().settings === settingsRef)
  s2.getState().updateSettings({ highInk: true })
  ok('a settings change leaves the kami array identical by reference', s2.getState().kami === kamiRef)
  ok('and actually changed the setting', s2.getState().settings.highInk)
}

section('19 · migrating a real v2 device through the store')

{
  const storage = memoryStorage({ [SAVE_KEY_V2]: JSON.stringify(V2_PAYLOAD) })
  const store = createGameStore({
    storage,
    now: () => T0,
    rng: () => 0.5,
    env: staticEnv(),
    applyToDocument: false,
    persistDebounceMs: 0,
    persistMinIntervalMs: 0,
  })
  store.getState().attachContent({ species: SPECIES, washi: WASHI, biomes: BIOMES })
  const result = store.getState().hydrate()
  eq('the store migrated it', result.source, 'v2')
  eq('nine Kami arrived', store.getState().kami.length, 9)
  eq('biomes were recomputed from the collection', store.getState().biomes, ['meadow', 'shore', 'forest'])
  ok('the v3 save was written through', storage.getItem(SAVE_KEY) !== null)
  ok('and the old keys were retired', storage.getItem(SAVE_KEY_V2) === null)
  ok('a welcome-back line was offered', /everything you folded/i.test(store.getState().notice?.text ?? ''), store.getState().notice?.text ?? '')
  ok('the shop is open for a returning player', isStorefrontOpen(store.getState()))
  ok('and a Daily Fold was drawn', store.getState().daily.todaySpecies !== null)
}

/* ═══════════════════════════════════════════════════════════════════════════
   20 · SETTINGS
   ═══════════════════════════════════════════════════════════════════════════ */

section('20 · settings')

{
  const d = defaultSettings(staticEnv())
  eq('theme follows the system by default', d.theme, 'auto')
  eq('every bus has a volume', Object.keys(d.volumes).sort(), ['ambience', 'master', 'music', 'sfx'])
  eq('guides are on for a new player', d.guides, true)
  eq('reduced motion defaults from the OS', defaultSettings(staticEnv({ reducedMotion: true })).reducedMotion, true)

  eq('auto resolves to day on a light system', resolveTheme('auto', staticEnv({ dark: false })), 'day')
  eq('auto resolves to night on a dark system', resolveTheme('auto', staticEnv({ dark: true })), 'night')
  eq('an explicit choice wins over the system', resolveTheme('day', staticEnv({ dark: true })), 'day')

  eq('the document attributes are what tokens.css reads', themeAttributes({ ...d, highInk: true, leftHanded: true, assistMode: true }, staticEnv({ dark: true })), {
    'data-theme': 'night',
    'data-high-ink': 'true',
    'data-reduced-motion': 'false',
    'data-assist': 'true',
    'data-hand': 'left',
  })

  const written = new Map<string, string>()
  const fakeDoc = {
    documentElement: {
      setAttribute: (k: string, v: string): void => void written.set(k, v),
      style: { setProperty: (k: string, v: string): void => void written.set(k, v) },
    },
  } as unknown as Document
  applySettings({ ...d, theme: 'night' }, staticEnv(), fakeDoc)
  eq('applySettings paints the root element', [written.get('data-theme'), written.get('color-scheme')], ['night', 'dark'])
  applySettings(d, staticEnv(), undefined)
  ok('applySettings with no document is a safe no-op', true)

  eq('normalizeSettings is total', normalizeSettings(null, staticEnv()).theme, 'auto')
  eq('and rejects nonsense', normalizeSettings({ volumes: 'loud', theme: 7 }, staticEnv()).volumes.master, 0.9)
  eq('an OS motion preference overrides the toggle being off', defaultSettings(staticEnv({ reducedMotion: true })).reducedMotion, true)
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESULT
   ═══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'-'.repeat(72)}`)
if (failures.length === 0) {
  console.log(`${GREEN}${BOLD}ALL ${passed} CHECKS PASSED${OFF} — systems/ is sound.`)
} else {
  console.log(`${RED}${BOLD}${failures.length} FAILED${OFF} of ${passed + failures.length}:`)
  for (const f of failures) console.log(`  - ${f}`)
  const proc = (globalThis as { process?: { exitCode?: number } }).process
  if (proc) proc.exitCode = 1
}
console.log('')
