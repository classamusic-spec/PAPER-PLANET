/* PAPER PLANET — the Snow Hare. Dyed one side only, so every reverse fold shows white. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, mix } from '../palette'
import { CAM, PT, kiteBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const COAT = TOKEN.paper0
const SHADOW = mix(TOKEN.paper0, TOKEN.aiSoft, 0.4)

export const snowhare: SpeciesDef = {
  id: 'snowhare',
  name: 'Snow Hare',
  binomial: 'Lepus nivalis',
  biome: 'peak',
  rarity: 'uncommon',
  material: { front: SHADOW, back: TOKEN.paperBack },
  chirp: [2, 2.5, 2],
  idle: 'hop',
  reward: 26,
  unlock: { type: 'biome', id: 'peak' },
  seasonal: 'winter',
  meta: { tier: 'classic', surface: 'ground', scale: 0.96, altitude: 0.02, flock: ['rabbit'] },
  codex: CODEX.snowhare,
  art: [
    { pts: '78,84 62,10 96,70', fill: COAT, layer: 0 },
    { pts: '122,84 138,10 104,70', fill: COAT, layer: 0 },
    { pts: '78,70 70,26 90,64', fill: TOKEN.aiSoft, layer: 1 },
    { pts: '122,70 130,26 110,64', fill: TOKEN.aiSoft, layer: 1 },
    { pts: '60,96 100,72 140,96 136,154 64,154', fill: COAT, layer: 1 },
    { pts: '100,72 140,96 136,154 100,154', fill: SHADOW, layer: 1 },
    { pts: '70,104 130,104 128,116 72,116', fill: TOKEN.beni, layer: 1 },
    { pts: '124,112 140,132 128,138 118,116', fill: TOKEN.beniDeep, layer: 0 },
    { pts: '94,112 106,112 100,122', fill: TOKEN.beni, noStroke: true, layer: 2 },
    { pts: '64,154 54,168 88,160', fill: SHADOW, layer: 0 },
    { pts: '136,154 146,168 112,160', fill: SHADOW, layer: 0 },
    eye(82, 98, 5),
    eye(118, 98, 5),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Use paper dyed on one side. Everything white in this hare is the back of the sheet.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      reverseAt('ears', PT.TL, PT.BR, 0.66, -12, PT.BR, 'mountain', {
        instruction: 'Reverse the long point up for the ears.',
        detail: 'The white side comes out as it turns. That is the whole idea of the fold.',
        camera: CAM.close,
      }),
      pull('ear-split', [crease([700, 620], [860, 460], [820, 600], 'valley', 90)], [760, 540], [850, 470], {
        instruction: 'Separate the two ears and open them.',
        detail: 'Take them apart slowly — there is only one layer holding each.',
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press the body and leave the ears up.',
        detail: 'A hare in the snow is mostly ears and patience.',
        camera: CAM.desk,
      }),
    ],
  },
}
