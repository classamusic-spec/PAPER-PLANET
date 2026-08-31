/* PAPER PLANET — the Firefly. Folded small on purpose, from gold-flecked paper. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, press, simpleBase } from '../recipes'
import type { SpeciesDef } from '../types'

const F = hue(mix(TOKEN.aiDeep, TOKEN.ink, 0.35))

export const firefly: SpeciesDef = {
  id: 'firefly',
  name: 'Firefly',
  binomial: 'Luciola chartae',
  biome: 'nightsky',
  rarity: 'uncommon',
  material: { front: F.base, back: TOKEN.paperBack },
  chirp: [3, 2.5, 3, 3.75],
  idle: 'flutter',
  reward: 18,
  unlock: { type: 'collection', count: 7 },
  meta: { tier: 'simple', surface: 'air', scale: 0.46, altitude: 0.26, flock: ['moth'] },
  codex: CODEX.firefly,
  art: [
    { pts: '92,72 46,48 36,78 88,92', fill: mix(TOKEN.paper0, TOKEN.matchaSoft, 0.5), noStroke: true, layer: 0 },
    { pts: '108,72 154,48 164,78 112,92', fill: mix(TOKEN.paper0, TOKEN.aiSoft, 0.5), noStroke: true, layer: 0 },
    { pts: '88,62 112,62 118,104 100,140 82,104', fill: F.base, layer: 1 },
    { pts: '88,62 100,62 100,140 82,104', fill: F.light, layer: 1 },
    { pts: '86,104 114,104 108,136 92,136', fill: TOKEN.goldHi, noStroke: true, layer: 1 },
    { circle: [100, 128, 12], fill: TOKEN.kincha, noStroke: true, layer: 0 },
    { pts: '90,44 110,44 112,62 88,62', fill: TOKEN.beni, layer: 1 },
    { line: [92, 44, 80, 28], fill: TOKEN.ink, noStroke: true, layer: 2 },
    { line: [108, 44, 120, 28], fill: TOKEN.ink, noStroke: true, layer: 2 },
    eye(94, 52, 3),
    eye(106, 52, 3),
  ],
  recipe: {
    base: 'none',
    steps: [
      ...simpleBase({ detail: 'Use a quarter sheet. A firefly folded full size is a beetle.' }),
      crossFold('lantern', PT.TR, PT.BL, 0.74, 0, PT.BL, 'valley', 180, {
        instruction: 'Fold the bottom corner up to make the lantern.',
        detail: 'That fold shows the pale side of the paper. It is where the light comes from.',
        camera: CAM.close,
      }),
      press('set', {
        instruction: 'Press it once and let it go.',
        detail: 'Four folds. Some of the best things are very short.',
      }),
    ],
  },
}
