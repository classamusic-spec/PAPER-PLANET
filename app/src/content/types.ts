/* PAPER PLANET — content-local types: the per-species metadata the frozen contracts have no room for. */

import type { AccentToken, BiomeId, Species } from '../contracts'
import type { FoldTier } from './recipes'

/** Where a Kami settles on the Planet, and how it is drawn there. */
export type Surface = 'ground' | 'water' | 'air' | 'perch' | 'burrow' | 'rock'

/**
 * Everything about a species that the frozen `Species` interface has no field for.
 * The old Planet screen hardcoded `['whale','fish','octopus']` to decide who needed
 * a pond; that knowledge lives here now, on the species, where it belongs.
 */
export interface SpeciesMeta {
  /** Declared difficulty. `__selftest.ts` checks the recipe actually is this long. */
  tier: FoldTier
  /** What this Kami stands, swims, perches or flies on. */
  surface: Surface
  /** Render scale on the Planet. 1 = a rabbit. */
  scale: number
  /** Preferred height in the scene, 0 = on the horizon line, 1 = high above it. */
  altitude: number
  /** Species this one likes to settle near. */
  flock?: string[]
}

/** A species record plus its Planet metadata. Structurally still a `Species`. */
export interface SpeciesDef extends Species {
  meta: SpeciesMeta
}

/** A purchasable set of Washi. Agent D's commerce catalog reads these. */
export interface WashiPack {
  sku: string
  name: string
  note: string
  accent: AccentToken
  washi: string[]
}

/** Scenery the Planet screen builds a biome out of. */
export interface BiomeScenery {
  /** This biome has standing water, so `surface: 'water'` Kami can be placed. */
  water: boolean
  /** Silhouette props, far to near. */
  props: string[]
  /** Ground cover motif id. */
  cover: string
  /** Biomes are laid out around the planet in this order. */
  order: number
  id: BiomeId
}
