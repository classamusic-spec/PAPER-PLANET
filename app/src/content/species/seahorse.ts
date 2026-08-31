/* PAPER PLANET — the Seahorse. A fish base pleated down its length into a curl. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, fishBase, mountain, press, reverseAt } from '../recipes'
import type { SpeciesDef } from '../types'

const K = hue(mix(TOKEN.kincha, TOKEN.beni, 0.3))

export const seahorse: SpeciesDef = {
  id: 'seahorse',
  name: 'Seahorse',
  binomial: 'Hippocampus plicatus',
  biome: 'shore',
  rarity: 'rare',
  material: { front: K.base, back: TOKEN.paperBack },
  chirp: [1.875, 2.25, 1.875, 2.5],
  idle: 'bob',
  reward: 48,
  unlock: { type: 'species', id: 'whale', mastery: 'adept' },
  meta: { tier: 'master', surface: 'water', scale: 0.8, altitude: 0.1 },
  codex: CODEX.seahorse,
  art: [
    { pts: '112,20 118,6 126,18 134,8 138,26 124,30', fill: K.dark, layer: 0 },
    { pts: '128,72 150,84 132,102', fill: K.light, layer: 0 },
    { pts: '96,26 122,20 138,38 132,58 110,64 94,50', fill: K.base, layer: 1 },
    { pts: '96,34 64,44 96,54', fill: K.light, layer: 1 },
    { pts: '110,60 136,66 142,98 124,126 104,142 90,126 108,102 116,80', fill: K.base, layer: 1 },
    { pts: '110,60 100,68 96,98 88,122 90,126 108,102 116,80', fill: K.pale, layer: 1 },
    { pts: '104,142 120,150 118,168 100,174 86,164 92,150 106,152 108,162', fill: K.dark, layer: 1 },
    eye(116, 38, 4),
  ],
  recipe: {
    base: 'fish',
    steps: [
      ...fishBase({ detail: 'Turn it point-up. The fins become a crown and a fin, and the long point becomes a tail.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Close it in half, away from you.',
        camera: CAM.side,
      }),
      reverseAt('neck', PT.TL, PT.BR, 0.22, 34, PT.TL, 'mountain', {
        instruction: 'Reverse the top point forward for the head.',
        detail: 'A seahorse holds its head at right angles to its body. Nothing else does.',
        camera: CAM.detail,
      }),
      reverseAt('snout', PT.TL, PT.BR, 0.1, -20, PT.TL, 'valley', {
        instruction: 'One small reverse at the tip for the snout.',
        detail: 'Long and straight. It feeds by sucking, so the snout is a pipe.',
        camera: CAM.detail,
      }),
      crossFold('pleat-a', PT.TL, PT.BR, 0.66, 18, PT.BR, 'valley', 150, {
        instruction: 'Pleat the tail: one fold toward you.',
        detail: 'Paper will not curve. A run of pleats is how it lies about it.',
        effort: 3,
        camera: CAM.close,
      }),
      crossFold('pleat-b', PT.TL, PT.BR, 0.79, 24, PT.BR, 'mountain', 150, {
        instruction: 'And one away, a little shorter.',
        detail: 'Each pleat shorter than the last, and the tail turns into a spiral.',
        effort: 3,
      }),
      press('set', {
        instruction: 'Press the body, leave the tail loose.',
        camera: CAM.desk,
      }),
    ],
  },
}
