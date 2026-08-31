/*
 * PAPER PLANET — turning what the player owns into what a card says.
 *
 * Pure: everything comes in as arguments, so a card can be composed from a save
 * without a React tree anywhere near it. The renderer never touches the store.
 */

import type { BiomeId, KamiInstance, Rarity, Species } from '../../contracts'
import { MASTERY_LABEL, getBiome, getSpecies, getWashi } from '../../content'
import { masteryFor, type CollectionSummary } from '../../systems'
import { RARITY_LABEL, RARITY_TOKEN, type CardData, type CardKami, type CardShape } from './types'

/** How many Kami a planet card can hold before it stops being a portrait. */
const CROWD: Record<CardShape, number> = { square: 6, story: 7 }

const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3 }

export function formatDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(ms)
  } catch {
    return new Date(ms).toDateString()
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** "the meadow, the shore and the forest" — an Oxford-free list, as the voice writes. */
function listOf(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const SMALL = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]

/** Small numbers are written out. A sentence does not open with a digit. */
function count(n: number): string {
  return n >= 0 && n < SMALL.length ? SMALL[n] : String(n)
}

/* ═══════════════════════════════════════════════════════════════════════════
   ONE KAMI
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SpecimenInput {
  species: Species
  /** The folded instance, when the card is about a creature the player owns. */
  instance?: KamiInstance
  /** Times this fold has been made, for the mastery tier. */
  folds: number
  /** Falls back to today when there is no instance to date. */
  now: number
}

export function specimenCard(input: SpecimenInput): CardData {
  const { species, instance, folds, now } = input
  const tier = masteryFor(folds)
  const name = instance?.nickname?.trim() || species.name
  const golden = instance?.golden ?? false
  const washi = instance ? getWashi(instance.washiId) : undefined
  const when = instance?.foldedAt ?? now
  const date = formatDate(when)
  const biome = getBiome(species.biome)

  const provenance = instance
    ? [washi ? `Folded from ${washi.name}` : 'Folded by hand', date]
    : [`A fold from the ${biome?.name.toLowerCase() ?? 'codex'}`, date]

  const kami: CardKami[] = [{ key: instance?.uid ?? species.id, art: species.art, name, golden }]

  const tierLabel = tier === 'none' ? null : MASTERY_LABEL[tier]
  const alt = [
    `A Paper Planet share card.`,
    `${name}, ${species.binomial}.`,
    `${RARITY_LABEL[species.rarity]}${tierLabel ? `, ${tierLabel}` : ''}.`,
    golden ? 'Folded in gold leaf.' : '',
    provenance.join('. ') + '.',
    species.codex.fact,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    title: name,
    subtitle: species.binomial,
    stamp: { label: RARITY_LABEL[species.rarity], token: RARITY_TOKEN[species.rarity] },
    tag: tierLabel,
    fact: species.codex.fact,
    provenance,
    kami,
    layout: 'specimen',
    seed: `${species.id}-${instance?.uid ?? 'codex'}`,
    alt,
    fileStem: `paper-planet-${slug(name)}`,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   A WHOLE PLANET
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PlanetInput {
  kami: KamiInstance[]
  summary: CollectionSummary
  biomes: BiomeId[]
  shape: CardShape
  now: number
}

/**
 * Pick who stands on the card, then arrange them centre-out so the ones worth
 * looking at are the ones nearest the middle, where the world is widest.
 */
function chooseCrowd(all: KamiInstance[], limit: number): { chosen: KamiInstance[]; more: number } {
  const ranked = all.slice().sort((a, b) => {
    if (a.golden !== b.golden) return a.golden ? -1 : 1
    const ra = RARITY_RANK[getSpecies(a.speciesId)?.rarity ?? 'common']
    const rb = RARITY_RANK[getSpecies(b.speciesId)?.rarity ?? 'common']
    if (ra !== rb) return rb - ra
    if (a.bond !== b.bond) return b.bond - a.bond
    return b.foldedAt - a.foldedAt
  })
  const top = ranked.slice(0, limit)
  const line: KamiInstance[] = []
  top.forEach((k, i) => {
    if (i % 2 === 0) line.push(k)
    else line.unshift(k)
  })
  return { chosen: line, more: Math.max(0, all.length - top.length) }
}

export function planetCard(input: PlanetInput): CardData {
  const { kami, summary, biomes, shape, now } = input
  const { chosen, more } = chooseCrowd(kami, CROWD[shape])

  const cards: CardKami[] = chosen.flatMap((k) => {
    const species = getSpecies(k.speciesId)
    if (!species) return []
    return [{ key: k.uid, art: species.art, name: k.nickname?.trim() || species.name, golden: k.golden }]
  })

  /* biome names already carry their article — "The Meadow" — so the sentence
     borrows the first one's and lowercases the rest */
  const biomeNames = biomes
    .map((id) => getBiome(id)?.name.toLowerCase())
    .filter((n): n is string => Boolean(n))

  const lines: string[] = []
  if (biomeNames.length) {
    const list = listOf(biomeNames)
    lines.push(`${list.charAt(0).toUpperCase()}${list.slice(1)} ${biomeNames.length === 1 ? 'is' : 'are'} open.`)
  }
  if (summary.golden > 0) {
    lines.push(`${count(summary.golden)} Kami ${summary.golden === 1 ? 'is' : 'are'} gold leaf.`)
  } else if (summary.mastered > 0) {
    lines.push(`${count(summary.mastered)} ${summary.mastered === 1 ? 'fold' : 'folds'} mastered.`)
  }

  const earliest = kami.reduce((min, k) => Math.min(min, k.foldedAt), now)
  const provenance = [
    kami.length > 0 ? `Tending since ${formatDate(earliest)}` : 'Waiting for its first fold',
    `Today, ${formatDate(now)}`,
  ]

  const alt = [
    'A Paper Planet share card showing a collection.',
    `${summary.kami} Kami on the planet, from ${summary.collected} of ${summary.total} folds.`,
    cards.length ? `On the card: ${cards.map((k) => k.name).join(', ')}.` : '',
    more > 0 ? `And ${more} more not shown.` : '',
    lines.join(' '),
  ]
    .filter(Boolean)
    .join(' ')

  return {
    title: 'My planet',
    subtitle: `${summary.kami} Kami · ${summary.collected} of ${summary.total} folds`,
    stamp: { label: 'The collection', token: 'matcha' },
    tag: `${summary.collected} of ${summary.total}`,
    fact: lines.join(' ') || null,
    provenance,
    kami: cards,
    moreCount: more || undefined,
    layout: 'crowd',
    seed: `planet-${summary.kami}-${summary.collected}`,
    alt,
    fileStem: 'paper-planet-my-planet',
  }
}
