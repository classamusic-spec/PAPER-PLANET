/* PAPER PLANET — the content layer: species, recipes, washi, biomes, codex. Pure data. */

import type { Biome, BiomeId, Species, Washi } from '../contracts'
import { BIOMES, BIOME_SCENERY, getBiome } from './biomes'
import { SPECIES } from './species/index'
import { WASHI, WASHI_PACKS, getWashi, getWashiPack } from './washi'
import type { SpeciesDef, SpeciesMeta } from './types'

export * from './palette'
export * from './recipes'
export * from './types'
export { BIOMES, BIOME_SCENERY, BIOME_IDS, unlockedBiomes } from './biomes'
export { CODEX, MASTERY_LABEL, MASTERY_NOTE, MASTERY_ORDER, MASTERY_THRESHOLD, visibleCodex } from './codex'
export { WASHI, WASHI_PACKS, DEFAULT_WASHI, STARTER_WASHI, allPatternDefs } from './washi'
export { SPECIES } from './species/index'
export { eye, eyeShape, sclera, stroke } from './art'

/* ── lookups ─────────────────────────────────────────────────────────────
   Every one of these returns `undefined` rather than throwing. The old
   `getAnimal` ended in `!` and took the app down whenever a save held an id
   that no longer existed. Saves outlive rosters; look-ups must survive them. */

/** Find a fold by id. Returns `undefined` for an id this build does not know. */
export function getSpecies(id: string): Species | undefined {
  return SPECIES.find((s) => s.id === id)
}

/** The same, keeping the Planet metadata attached. */
export function getSpeciesDef(id: string): SpeciesDef | undefined {
  return SPECIES.find((s) => s.id === id)
}

/** Planet placement, difficulty tier and flocking for one species. */
export function getMeta(id: string): SpeciesMeta | undefined {
  return SPECIES.find((s) => s.id === id)?.meta
}

export { getWashi, getWashiPack, getBiome }

/** The whole roster. A fresh array, so callers cannot reorder the corpus. */
export function allSpecies(): Species[] {
  return SPECIES.slice()
}

/** The whole paper catalogue. */
export function allWashi(): Washi[] {
  return WASHI.slice()
}

/** All five biomes, in the order they open. */
export function allBiomes(): Biome[] {
  return BIOMES.slice()
}

/** The roster grouped by biome, in biome order, each group in Codex order. */
export function speciesByBiome(): Record<BiomeId, Species[]> {
  const out = {} as Record<BiomeId, Species[]>
  for (const b of BIOMES) out[b.id] = []
  for (const s of SPECIES) out[s.biome].push(s)
  return out
}

/** Folds that live in one biome. */
export function speciesInBiome(id: BiomeId): Species[] {
  return SPECIES.filter((s) => s.biome === id)
}

/**
 * Can this Kami be placed in this biome? Replaces the Planet screen's hardcoded
 * `['whale','fish','octopus']` pond list — the data says so now.
 */
export function canPlace(speciesId: string, biome: BiomeId): boolean {
  const meta = getMeta(speciesId)
  if (!meta) return false
  if (meta.surface === 'water') return BIOME_SCENERY[biome].water
  return true
}

/** Washi grouped by the pack that sells them. */
export function washiByPack(): Record<string, Washi[]> {
  const out: Record<string, Washi[]> = {}
  for (const p of WASHI_PACKS) {
    out[p.sku] = p.washi
      .map((id) => getWashi(id))
      .filter((w): w is Washi => w !== undefined)
  }
  return out
}

/** Everything a player owns without spending anything. */
export function freeWashi(): Washi[] {
  return WASHI.filter((w) => w.source.type === 'free')
}

export const SPECIES_COUNT = SPECIES.length
export const WASHI_COUNT = WASHI.length
