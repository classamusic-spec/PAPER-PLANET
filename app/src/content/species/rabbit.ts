/* PAPER PLANET — the Rabbit. A kite base with the point folded back into ears. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN } from '../palette'
import { CAM, PT, crossFold, kiteBase, press } from '../recipes'
import type { SpeciesDef } from '../types'

export const rabbit: SpeciesDef = {
  id: 'rabbit',
  name: 'Rabbit',
  binomial: 'Lepus plicatus',
  biome: 'meadow',
  rarity: 'common',
  material: { front: TOKEN.sakura, back: TOKEN.paperBack },
  chirp: [1.5, 1.875, 1.5, 2.25],
  idle: 'hop',
  reward: 12,
  unlock: { type: 'collection', count: 2 },
  meta: { tier: 'simple', surface: 'ground', scale: 0.94, altitude: 0.04, flock: ['snowhare', 'cat'] },
  codex: CODEX.rabbit,
  art: [
    { pts: '80,84 66,14 98,72', fill: TOKEN.paper0, layer: 0 },
    { pts: '120,84 134,14 102,72', fill: TOKEN.paper0, layer: 0 },
    { pts: '80,72 73,28 91,66', fill: TOKEN.sakura, layer: 1 },
    { pts: '120,72 127,28 109,66', fill: TOKEN.sakura, layer: 1 },
    { pts: '62,96 100,74 138,96 134,152 66,152', fill: TOKEN.paper0, layer: 1 },
    { pts: '100,74 138,96 134,152 100,152', fill: TOKEN.paper2, layer: 1 },
    { pts: '66,152 56,166 90,158', fill: TOKEN.paper2, layer: 0 },
    { pts: '134,152 144,166 110,158', fill: TOKEN.paper2, layer: 0 },
    { pts: '94,120 106,120 100,130', fill: TOKEN.beni, noStroke: true, layer: 2 },
    stroke(100, 130, 100, 138),
    eye(82, 104, 5),
    eye(118, 104, 5),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'The wide end will be the rabbit sitting. The point becomes its ears.' }),
      crossFold('ears', PT.TL, PT.BR, 0.58, 0, PT.BR, 'valley', 180, {
        instruction: 'Fold the long point back up over itself.',
        detail: 'Where you put this crease decides how tall the ears are. Higher is happier.',
        camera: CAM.close,
      }),
      press('set', {
        instruction: 'Hold it flat for a moment, then let go.',
        detail: 'Run a thumbnail up the middle of the ears afterwards and they will stand apart.',
      }),
    ],
  },
}
