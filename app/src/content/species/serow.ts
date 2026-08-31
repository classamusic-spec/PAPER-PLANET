/* PAPER PLANET — the Serow. Neither goat nor antelope, and folded like neither. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, kiteBase, mountain, press, reverseAt } from '../recipes'
import type { SpeciesDef } from '../types'

const S = hue(mix(TOKEN.paper4, TOKEN.ink, 0.22))

export const serow: SpeciesDef = {
  id: 'serow',
  name: 'Serow',
  binomial: 'Capricornis solus',
  biome: 'peak',
  rarity: 'uncommon',
  material: { front: S.base, back: TOKEN.paperBack },
  chirp: [0.75, 0.938, 0.75, 1.125],
  idle: 'stand',
  reward: 26,
  unlock: { type: 'collection', count: 16 },
  meta: { tier: 'classic', surface: 'rock', scale: 1.12, altitude: 0.12 },
  codex: CODEX.serow,
  art: [
    { pts: '146,52 152,26 160,28 156,54', fill: TOKEN.ink, layer: 0 },
    { pts: '164,54 174,30 182,34 172,58', fill: TOKEN.ink, layer: 0 },
    { pts: '52,104 124,90 154,108 150,150 60,154', fill: S.base, layer: 1 },
    { pts: '52,104 100,94 100,152 60,154', fill: S.light, layer: 1 },
    { pts: '58,120 146,114 144,146 62,150', fill: S.pale, layer: 1 },
    { pts: '126,94 146,58 164,56 156,96', fill: S.base, layer: 1 },
    { pts: '144,50 178,46 186,68 158,82 138,72', fill: S.light, layer: 1 },
    { pts: '176,66 192,72 176,80', fill: TOKEN.ink, layer: 2 },
    { pts: '178,40 194,32 186,52', fill: S.dark, layer: 0 },
    { pts: '66,154 62,180 74,180 76,154', fill: S.dark, layer: 0 },
    { pts: '134,150 132,180 144,180 146,150', fill: S.dark, layer: 0 },
    { pts: '24,110 52,102 50,122', fill: S.dark, layer: 0 },
    eye(164, 62, 3.4),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Short, heavy, low to the rock. A serow does not run anywhere.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      reverseAt('head', PT.TL, PT.BR, 0.24, -30, PT.TL, 'mountain', {
        instruction: 'Reverse the front point up into a head.',
        detail: 'Short neck. Almost none, in fact.',
        camera: CAM.close,
      }),
      reverseAt('horns', PT.TL, PT.BR, 0.1, 48, PT.TL, 'valley', {
        instruction: 'Reverse the tip back for two short horns.',
        detail: 'Backward-curving and blunt. They are for shoving, not stabbing.',
        camera: CAM.detail,
      }),
      crossFold('legs', PT.TL, PT.BR, 0.74, -18, PT.BR, 'valley', 130, {
        instruction: 'Fold the back point under for the hind legs.',
        detail: 'Wide apart. It stands on ground you would not.',
      }),
      press('set', {
        instruction: 'Press it flat and set it down somewhere steep.',
        camera: CAM.desk,
      }),
    ],
  },
}
