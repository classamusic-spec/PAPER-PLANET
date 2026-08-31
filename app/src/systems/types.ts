/* PAPER PLANET — structural views of injected content. systems/ never imports src/content. */

import type { AmbienceId, Biome, BiomeId, Rarity, Species, UnlockRule, Washi } from '../contracts'

/**
 * Content is *injected*, never imported. `systems/` only ever needs a few fields
 * off each content record, so every content parameter is typed as a structural
 * subset. A real `Species` / `Washi` / `Biome` from `src/content` is assignable
 * to these with no adapter, and a five-line fixture is assignable too — which is
 * what makes the economy and progression maths unit-testable.
 */
export type SpeciesLike = {
  readonly id: string
  readonly name: string
  readonly biome: BiomeId
  readonly rarity: Rarity
  /** Sheets awarded for a first fold. 0 or absent → derived from rarity. */
  readonly reward: number
  readonly unlock: UnlockRule
}

export type WashiLike = {
  readonly id: string
  readonly name: string
  readonly rarity: Rarity
  readonly source: Washi['source']
}

export type BiomeLike = {
  readonly id: BiomeId
  readonly name: string
  readonly ambience: AmbienceId
  /** Unlocked when the collection reaches this many distinct folds. */
  readonly unlockAt: number
}

/* Compile-time proof that the real contract types satisfy the structural views.
   If `contracts.ts` ever drifts, these lines fail the build instead of runtime. */
type _AssertSpecies = Species extends SpeciesLike ? true : never
type _AssertWashi = Washi extends WashiLike ? true : never
type _AssertBiome = Biome extends BiomeLike ? true : never
export type ContentShapesAreCompatible = _AssertSpecies & _AssertWashi & _AssertBiome

/** Everything `systems/` needs to know about the world, handed in at boot. */
export interface ContentIndex {
  readonly species: readonly SpeciesLike[]
  readonly speciesById: ReadonlyMap<string, SpeciesLike>
  readonly washi: readonly WashiLike[]
  readonly washiById: ReadonlyMap<string, WashiLike>
  readonly biomes: readonly BiomeLike[]
  readonly biomeById: ReadonlyMap<BiomeId, BiomeLike>
  /** Every species id, sorted — the stable pool the Daily Fold draws from. */
  readonly speciesIds: readonly string[]
  readonly washiIds: ReadonlySet<string>
}

export const EMPTY_CONTENT: ContentIndex = {
  species: [],
  speciesById: new Map(),
  washi: [],
  washiById: new Map(),
  biomes: [],
  biomeById: new Map(),
  speciesIds: [],
  washiIds: new Set(),
}

export function buildContentIndex(input: {
  species?: readonly SpeciesLike[]
  washi?: readonly WashiLike[]
  biomes?: readonly BiomeLike[]
}): ContentIndex {
  const species = input.species ?? []
  const washi = input.washi ?? []
  const biomes = input.biomes ?? []
  return {
    species,
    speciesById: new Map(species.map((s) => [s.id, s])),
    washi,
    washiById: new Map(washi.map((w) => [w.id, w])),
    biomes,
    biomeById: new Map(biomes.map((b) => [b.id, b])),
    speciesIds: species.map((s) => s.id).sort(),
    washiIds: new Set(washi.map((w) => w.id)),
  }
}
