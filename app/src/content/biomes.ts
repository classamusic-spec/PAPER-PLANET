/* PAPER PLANET — the five biomes: palette, ambience, unlock thresholds, and what the Planet builds them from. */

import type { Biome, BiomeId } from '../contracts'
import { TOKEN, mix } from './palette'
import type { BiomeScenery } from './types'

export const BIOMES: Biome[] = [
  {
    id: 'meadow',
    name: 'The Meadow',
    note: 'Long grass, and something small moving in it.',
    ambience: 'meadow',
    unlockAt: 0,
    palette: {
      sky: mix(TOKEN.aiSoft, TOKEN.paper0, 0.55),
      ground: TOKEN.matchaSoft,
      far: TOKEN.matcha,
      accent: TOKEN.kincha,
    },
  },
  {
    id: 'shore',
    name: 'The Shore',
    note: 'The tide goes out and leaves the whole world lying there.',
    ambience: 'shore',
    unlockAt: 3,
    palette: {
      sky: mix(TOKEN.aiSoft, TOKEN.paper0, 0.32),
      ground: mix(TOKEN.paper3, TOKEN.kinchaSoft, 0.45),
      far: TOKEN.ai,
      accent: TOKEN.aiSoft,
    },
  },
  {
    id: 'forest',
    name: 'The Forest',
    note: 'Rain in the canopy, an hour after the rain has stopped.',
    ambience: 'rain',
    unlockAt: 8,
    palette: {
      sky: mix(TOKEN.matchaSoft, TOKEN.paper0, 0.38),
      ground: mix(TOKEN.matchaDeep, TOKEN.paper3, 0.32),
      far: TOKEN.matchaDeep,
      accent: TOKEN.kinchaDeep,
    },
  },
  {
    id: 'nightsky',
    name: 'The Night Sky',
    note: 'Everything up here is awake. It just does not say so.',
    ambience: 'night',
    unlockAt: 14,
    palette: {
      sky: mix(TOKEN.aiDeep, TOKEN.ink, 0.55),
      ground: mix(TOKEN.murasakiDeep, TOKEN.ink, 0.3),
      far: TOKEN.murasaki,
      accent: TOKEN.kincha,
    },
  },
  {
    id: 'peak',
    name: 'The Peak',
    note: 'Up here the wind takes the sound away with it.',
    ambience: 'none',
    unlockAt: 20,
    palette: {
      sky: mix(TOKEN.aiSoft, TOKEN.paper0, 0.68),
      ground: TOKEN.paper1,
      far: mix(TOKEN.ai, TOKEN.paper2, 0.42),
      accent: TOKEN.beni,
    },
  },
]

/**
 * What the Planet screen draws for each biome. `water: true` is what decides
 * whether a `surface: 'water'` Kami can be placed here — no more hardcoded
 * species lists inside the screen.
 */
export const BIOME_SCENERY: Record<BiomeId, BiomeScenery> = {
  meadow: { id: 'meadow', water: true, cover: 'grass', props: ['hill', 'clover', 'reed', 'stone'], order: 0 },
  shore: { id: 'shore', water: true, cover: 'sand', props: ['dune', 'wave', 'driftwood', 'shell'], order: 1 },
  forest: { id: 'forest', water: true, cover: 'moss', props: ['cedar', 'fern', 'stump', 'toadstool'], order: 2 },
  nightsky: { id: 'nightsky', water: false, cover: 'cloud', props: ['moon', 'star', 'branch', 'lantern'], order: 3 },
  peak: { id: 'peak', water: false, cover: 'snow', props: ['ridge', 'pine', 'boulder', 'cairn'], order: 4 },
}

export const BIOME_IDS: readonly BiomeId[] = BIOMES.map((b) => b.id)

export function getBiome(id: string): Biome | undefined {
  return BIOMES.find((b) => b.id === id)
}

/** Biomes a player with this many Kami has opened. */
export function unlockedBiomes(collected: number): Biome[] {
  return BIOMES.filter((b) => collected >= b.unlockAt)
}
