/* PAPER PLANET — The Daily Fold: one species a day for everyone, and a streak that never punishes. */

import type { SaveV3 } from '../contracts'
import { streakGoldLeaf } from './economy'
import { SYS_KEY, readFlag, writeFlag } from './save'
import { hash32 } from './rand'

/* ═══════════════════════════════════════════════════════════════════════════
   DATES

   Everything is a local `YYYY-MM-DD` string, and every comparison is done on
   those strings — never on timestamps. That is what makes this correct across
   timezones and DST: the day rolls over at the player's own midnight, an hour
   gained or lost in March changes nothing, and a device whose clock jumps
   cannot manufacture or destroy a day.
   ═══════════════════════════════════════════════════════════════════════════ */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function localDateKey(when: number | Date = Date.now()): string {
  const d = when instanceof Date ? when : new Date(when)
  if (Number.isNaN(d.getTime())) return localDateKey(Date.now())
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY.test(value)
}

/** Midday UTC on that calendar date — a stable anchor for whole-day arithmetic. */
function anchor(key: string): number {
  const [y, m, d] = key.split('-').map((part) => Number(part))
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  if (!isDateKey(from) || !isDateKey(to)) return 0
  return Math.round((anchor(to) - anchor(from)) / 86_400_000)
}

export function shiftDateKey(key: string, days: number): string {
  if (!isDateKey(key)) return key
  const d = new Date(anchor(key) + days * 86_400_000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELECTION

   Seeded by the date alone, so every player in the world folds the same Kami
   today with no server, no fetch, and no clock skew. The pool must be sorted —
   `ContentIndex.speciesIds` already is.
   ═══════════════════════════════════════════════════════════════════════════ */

function rawIndex(dateKey: string, n: number): number {
  return hash32(`paper-planet/daily/${dateKey}`) % n
}

/**
 * Today's fold. Deterministic for a given date and pool, and never the same as
 * yesterday's while there is more than one species to choose from.
 */
export function dailySpeciesFor(dateKey: string, pool: readonly string[]): string | null {
  const n = pool.length
  if (n === 0) return null
  if (n === 1) return pool[0] ?? null
  let i = rawIndex(dateKey, n)
  if (i === rawIndex(shiftDateKey(dateKey, -1), n)) {
    const step = 1 + (hash32(`paper-planet/daily-alt/${dateKey}`) % (n - 1))
    i = (i + step) % n
  }
  return pool[i] ?? null
}

/**
 * The Daily Fold is open to everyone, whatever they have unlocked. Today's Kami
 * can always be folded — content, freely given, once a day. It does not grant a
 * permanent unlock; tomorrow it is a different fold.
 */
export function isDailySpecies(speciesId: string, daily: Pick<SaveV3['daily'], 'todaySpecies'>): boolean {
  return daily.todaySpecies !== null && daily.todaySpecies === speciesId
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE STREAK — forgiving by design (BRAND.md §2, Pillar II).

     · a missed day is forgiven once a week; the streak simply continues
     · a longer gap resets to day one and says "welcome back" — never a number
       you lost, never a red mark, never an offer to buy the days back
     · nothing anywhere counts down toward losing it; there is no "at risk"
       state in this module, on purpose
     · the reward is one Gold Leaf every seventh day
   ═══════════════════════════════════════════════════════════════════════════ */

export const GRACE_WINDOW_DAYS = 7

export type DailyEvent = 'first' | 'same-day' | 'continued' | 'grace' | 'welcome-back'

export interface DayOpen {
  daily: SaveV3['daily']
  /** True when the calendar date moved since the save was written. */
  rolledOver: boolean
  /** Days since the last fold, or null if they have never folded. */
  daysAway: number | null
  /** A quiet line for the Planet header, or null when there is nothing to say. */
  message: string | null
  repairs: string[]
}

/**
 * Called at hydration and whenever the app notices the date has changed.
 * Draws today's fold and clears yesterday's claim. It never touches the streak —
 * the streak only moves when a fold is actually finished.
 */
export function openDay(
  daily: SaveV3['daily'],
  dateKey: string,
  pool: readonly string[],
): DayOpen {
  const repairs: string[] = []
  let lastFold = isDateKey(daily.lastFold) ? daily.lastFold : null
  if (daily.lastFold !== null && lastFold === null) repairs.push('daily: unreadable last-fold date — cleared')

  // A save written on a device whose clock was ahead. Clamp it forward-dated day
  // to today rather than locking the player out of the ritual until it catches up.
  if (lastFold !== null && daysBetween(lastFold, dateKey) < 0) {
    repairs.push(`daily: last fold dated ${lastFold}, ahead of today — treated as today`)
    lastFold = dateKey
  }

  const daysAway = lastFold === null ? null : daysBetween(lastFold, dateKey)
  const rolledOver = daily.todaySpecies === null || lastFold !== daily.lastFold || daysAway !== 0
  const todaySpecies = dailySpeciesFor(dateKey, pool) ?? daily.todaySpecies
  const claimed = daysAway === 0

  let message: string | null = null
  if (daysAway !== null && daysAway >= 3) message = 'Welcome back. The paper kept.'
  else if (daysAway !== null && daysAway > 0 && daily.streak > 0) message = `${daily.streak} days so far.`

  return {
    daily: { lastFold, streak: Math.max(0, Math.floor(daily.streak)), todaySpecies, claimed },
    rolledOver,
    daysAway,
    message,
    repairs,
  }
}

export interface DailyClaim {
  daily: SaveV3['daily']
  seen: string[]
  event: DailyEvent
  streak: number
  /** How much the streak moved. 0 when the fold was already claimed today. */
  streakGained: number
  goldLeaf: number
  /** One line, warm and short. Never a scold, never a countdown. */
  message: string
  graceUsed: boolean
}

function graceAvailable(seen: readonly string[], dateKey: string): boolean {
  const last = readFlag(seen, SYS_KEY.graceUsedOn)
  if (last === null || !isDateKey(last)) return true
  return daysBetween(last, dateKey) >= GRACE_WINDOW_DAYS
}

/**
 * Record today's Daily Fold. Idempotent: claiming twice on the same day changes
 * nothing and awards nothing, so a double-tap or a re-hydration cannot inflate
 * a streak, and a re-render cannot mint Gold Leaf.
 */
export function claimDailyFold(
  daily: SaveV3['daily'],
  seen: readonly string[],
  dateKey: string,
): DailyClaim {
  const lastFold = isDateKey(daily.lastFold) ? daily.lastFold : null
  const streakBefore = Math.max(0, Math.floor(daily.streak))

  if (lastFold !== null && daysBetween(lastFold, dateKey) <= 0) {
    return {
      daily: { ...daily, lastFold: dateKey, claimed: true, streak: streakBefore },
      seen: [...seen],
      event: 'same-day',
      streak: streakBefore,
      streakGained: 0,
      goldLeaf: 0,
      message: "Today's fold is already made.",
      graceUsed: false,
    }
  }

  const gap = lastFold === null ? null : daysBetween(lastFold, dateKey)
  let nextSeen = [...seen]
  let event: DailyEvent
  let streak: number
  let graceUsed = false

  if (gap === null) {
    event = 'first'
    streak = 1
  } else if (gap === 1) {
    event = 'continued'
    streak = streakBefore + 1
  } else if (gap === 2 && graceAvailable(seen, dateKey)) {
    event = 'grace'
    streak = streakBefore + 1
    graceUsed = true
    nextSeen = writeFlag(nextSeen, SYS_KEY.graceUsedOn, dateKey)
  } else {
    event = 'welcome-back'
    streak = 1
  }

  const goldLeaf = streakGoldLeaf(streak)
  const message = ((): string => {
    if (event === 'first') return 'The first day. Come back tomorrow and it becomes a habit.'
    if (event === 'welcome-back') return 'Welcome back. Today is day one, and that is fine.'
    if (goldLeaf > 0) return `${streak} days. A leaf of gold for that.`
    if (event === 'grace') return `We kept your place. ${streak} days.`
    return `${streak} days.`
  })()

  return {
    daily: { lastFold: dateKey, streak, todaySpecies: daily.todaySpecies, claimed: true },
    seen: nextSeen,
    event,
    streak,
    streakGained: streak - streakBefore,
    goldLeaf,
    message,
    graceUsed,
  }
}

export interface DailyStatus {
  dateKey: string
  speciesId: string | null
  /** Already folded today. */
  done: boolean
  streak: number
  /** Days until the next Gold Leaf. Progress, not a deadline. */
  toNextGoldLeaf: number
}

export function dailyStatus(daily: SaveV3['daily'], dateKey: string): DailyStatus {
  const streak = Math.max(0, Math.floor(daily.streak))
  const done = daily.lastFold === dateKey
  const into = streak % 7
  return {
    dateKey,
    speciesId: daily.todaySpecies,
    done,
    streak,
    toNextGoldLeaf: streak === 0 ? 7 : into === 0 ? 7 : 7 - into,
  }
}
