/* PAPER PLANET — Share Card: the shapes the renderer and the sheet agree on. */

import type { ArtPoly, MasteryTier, Rarity } from '../../contracts'

/** The two things a player posts: a square for the feed, a story for the top of it. */
export type CardShape = 'square' | 'story'

/** Which paper the card is cut from. Independent of the app's own theme. */
export type CardTheme = 'day' | 'night'

/** What the card is about. */
export type ShareSubject =
  | { kind: 'kami'; uid: string }
  | { kind: 'species'; speciesId: string }
  | { kind: 'planet' }

/** One creature, flattened to exactly what the canvas needs. */
export interface CardKami {
  /** Stable key — the instance uid, or the species id for an unfolded fold. */
  key: string
  art: readonly ArtPoly[]
  /** What it is called on the card: a nickname if it has one. */
  name: string
  golden: boolean
}

/** A subject resolved against the store and the content layer. Pure data. */
export interface CardData {
  /** The headline. */
  title: string
  /** The small line under it — a binomial, or a count. */
  subtitle: string
  /** Top-left tracked label and the dye of its dot — rarity, or "Collection". */
  stamp: { label: string; token: string } | null
  /** Top-right tracked label — the mastery tier, or the size of a collection. */
  tag: string | null
  /** The prose block. Omitted when there is nothing worth reading. */
  fact: string | null
  /** Bottom-left provenance: the paper, and the day. */
  provenance: string[]
  /** Everyone on the card. One for a Kami, several for a planet. */
  kami: CardKami[]
  /** How many more the planet holds than the card could show. */
  moreCount?: number
  /** Layout hint — a lone specimen is composed differently from a crowd. */
  layout: 'specimen' | 'crowd'
  /** Deterministic irregularity seed. Two cards of the same thing are the same card. */
  seed: string
  /** What a screen reader is told the preview shows. */
  alt: string
  /** The stem of the downloaded file. */
  fileStem: string
}

/** Everything the composer needs beyond the data. */
export interface CardSpec {
  shape: CardShape
  theme: CardTheme
  /** Heavier hairlines and firmer ink, mirroring the app's High Ink setting. */
  highInk: boolean
  /** Backing-store multiplier. 2 = retina. */
  pixelRatio: number
}

/** Design-space size of each shape, before `pixelRatio`. */
export const CARD_SIZE: Record<CardShape, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
}

/** The dye each rarity is stamped in. Matches the Codex detail exactly. */
export const RARITY_TOKEN: Record<Rarity, 'ink' | 'matcha' | 'ai' | 'murasaki'> = {
  common: 'ink',
  uncommon: 'matcha',
  rare: 'ai',
  mythic: 'murasaki',
}

export const TIER_ORDER: readonly MasteryTier[] = ['none', 'novice', 'adept', 'master', 'grand']
