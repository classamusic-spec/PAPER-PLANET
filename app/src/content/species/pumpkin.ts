/* PAPER PLANET — the Paper Pumpkin. The traditional waterbomb, blown into. */

import { CODEX } from '../codex'
import { eyeShape } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, flip, inflate, pinch, valley, waterbombBase, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const K = hue(TOKEN.kincha)

export const pumpkin: SpeciesDef = {
  id: 'pumpkin',
  name: 'Paper Pumpkin',
  binomial: 'Cucurbita plicata',
  biome: 'meadow',
  rarity: 'common',
  material: { front: K.base, back: TOKEN.paperBack },
  chirp: [1, 1.25, 1],
  idle: 'bob',
  reward: 20,
  unlock: { type: 'collection', count: 10 },
  seasonal: 'autumn',
  meta: { tier: 'classic', surface: 'ground', scale: 0.92, altitude: 0.02 },
  codex: CODEX.pumpkin,
  art: [
    { pts: '52,86 76,72 78,134 56,126', fill: TOKEN.kinchaSoft, layer: 0 },
    { pts: '148,86 124,72 122,134 144,126', fill: K.dark, layer: 0 },
    { pts: '70,80 100,66 130,80 136,124 100,146 64,124', fill: K.base, layer: 1 },
    { pts: '70,80 100,66 100,146 64,124', fill: K.light, layer: 1 },
    { pts: '94,64 106,64 110,44 96,48', fill: TOKEN.matcha, layer: 1 },
    { pts: '108,52 128,44 120,62', fill: TOKEN.matchaDeep, layer: 0 },
    { pts: '97,114 103,114 100,120', fill: TOKEN.ink, noStroke: true, layer: 2 },
    { pts: '80,126 92,136 100,128 108,136 120,126 116,140 84,140', fill: TOKEN.ink, noStroke: true, layer: 2 },
    eyeShape('80,98 92,98 86,110'),
    eyeShape('108,98 120,98 114,110'),
  ],
  recipe: {
    base: 'waterbomb',
    steps: [
      ...waterbombBase({ detail: 'Keep it loose. Everything from here on has to stay openable.' }),
      valley('corner-a', PT.MB, PT.MR, PT.BR, 180, {
        instruction: 'Fold the near right corner up to the top.',
        camera: CAM.close,
      }),
      valley('corner-b', PT.MB, PT.ML, PT.BL, 180, {
        instruction: 'And the left corner up to match.',
        detail: 'A diamond now. Two more corners are hiding behind.',
      }),
      flip('turn', {
        instruction: 'Turn it over.',
        detail: 'Support the middle as you go — there is air in there already.',
      }),
      pinch(
        'corners-back',
        [
          crease(PT.MT, PT.MR, PT.TR, 'valley', 180),
          crease(PT.MT, PT.ML, PT.TL, 'valley', 180),
        ],
        PT.TR,
        PT.C,
        {
          instruction: 'Both corners up on this side too.',
          detail: 'Match the front. If one is off, the pumpkin will lean, which is not the worst outcome.',
        },
      ),
      inflate('blow', {
        instruction: 'Find the small hole at the base, and blow.',
        detail: 'It goes from flat to round in one breath. This is the oldest trick in origami and it never stops being good.',
        camera: CAM.close,
      }),
    ],
  },
}
