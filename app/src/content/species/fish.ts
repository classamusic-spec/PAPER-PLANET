/* PAPER PLANET — the Fish. A kite base folded once more. Four steps and a fin. */

import { CODEX } from '../codex'
import { eye, sclera } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, kiteBase, mountain, press } from '../recipes'
import type { SpeciesDef } from '../types'

const K = hue(TOKEN.kincha)

export const fish: SpeciesDef = {
  id: 'fish',
  name: 'Fish',
  binomial: 'Carassius plicatus',
  biome: 'shore',
  rarity: 'common',
  material: { front: K.base, back: TOKEN.paperBack },
  chirp: [2, 2.25],
  idle: 'swim',
  reward: 12,
  unlock: { type: 'biome', id: 'shore' },
  meta: { tier: 'simple', surface: 'water', scale: 0.78, altitude: 0, flock: ['whale', 'octopus'] },
  codex: CODEX.fish,
  art: [
    { pts: '132,100 168,74 168,126', fill: K.dark, layer: 0 },
    { pts: '78,68 96,48 104,70', fill: K.dark, layer: 0 },
    { pts: '84,132 98,148 106,128', fill: K.dark, layer: 0 },
    { pts: '28,100 72,66 120,72 136,100 120,128 72,134', fill: K.base, layer: 1 },
    { pts: '28,100 72,66 100,70 96,130 72,134', fill: K.pale, layer: 1 },
    { line: [84, 80, 84, 120], fill: K.dark, noStroke: true, layer: 1 },
    { pts: '22,94 22,106 30,100', fill: K.dark, layer: 1 },
    sclera(56, 94, 8),
    eye(58, 95, 4),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Already a fish, seen from above. It only needs to be seen from the side.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half, away from you.',
        detail: 'The two folded edges meet. The tail opens by itself at the far end.',
        camera: CAM.side,
      }),
      press('set', {
        instruction: 'Press along the back, and let the tail stay open.',
        detail: 'Press the tail too and you get a leaf. It happens to everyone once.',
      }),
    ],
  },
}
