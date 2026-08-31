import { allSpecies, allWashi, allBiomes } from './src/content'

const sp = allSpecies()
const kinds = new Map<string, number>()
const gestures = new Map<string, number>()
const stepCounts: number[] = []
const tierByBiome = new Map<string, number>()
let badCrease = 0

for (const s of sp) {
  stepCounts.push(s.recipe.steps.length)
  tierByBiome.set(s.biome, (tierByBiome.get(s.biome) ?? 0) + 1)
  for (const st of s.recipe.steps) {
    kinds.set(st.kind, (kinds.get(st.kind) ?? 0) + 1)
    gestures.set(st.gesture, (gestures.get(st.gesture) ?? 0) + 1)
    for (const c of st.creases) {
      const len = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1])
      if (!Number.isFinite(len) || len < 1) badCrease++
      if (c.side !== 1 && c.side !== -1) badCrease++
    }
  }
}
const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
console.log('species:', sp.length, '| washi:', allWashi().length, '| biomes:', allBiomes().length)
console.log('steps: min', Math.min(...stepCounts), 'max', Math.max(...stepCounts),
  'mean', (stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length).toFixed(1),
  'total', stepCounts.reduce((a, b) => a + b, 0))
console.log('fold kinds  :', JSON.stringify(Object.fromEntries(sorted(kinds))))
console.log('gestures    :', JSON.stringify(Object.fromEntries(sorted(gestures))))
console.log('by biome    :', JSON.stringify(Object.fromEntries(tierByBiome)))
console.log('rarity      :', JSON.stringify(sp.reduce<Record<string, number>>((a, s) => (a[s.rarity] = (a[s.rarity] ?? 0) + 1, a), {})))
console.log('degenerate creases:', badCrease)
console.log('distinct recipes (by step signature):',
  new Set(sp.map(s => s.recipe.steps.map(x => x.kind + ':' + x.gesture).join('|'))).size, 'of', sp.length)
