/* PAPER PLANET — the Eagle. A bird base the other way up: what makes a neck makes a tail. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, birdBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const E = hue(mix(TOKEN.ink, TOKEN.kinchaDeep, 0.34))

export const eagle: SpeciesDef = {
  id: 'eagle',
  name: 'Sea Eagle',
  binomial: 'Haliaeetus chartaceus',
  biome: 'peak',
  rarity: 'rare',
  material: { front: E.base, back: TOKEN.paperBack },
  chirp: [1.5, 2, 1.5, 1.125],
  idle: 'fly',
  reward: 48,
  unlock: { type: 'collection', count: 24 },
  meta: { tier: 'master', surface: 'air', scale: 1.42, altitude: 0.62 },
  codex: CODEX.eagle,
  art: [
    { pts: '94,80 10,46 6,72 26,74 20,94 92,106', fill: E.base, layer: 0 },
    { pts: '106,80 190,46 194,72 174,74 180,94 108,106', fill: E.dark, layer: 0 },
    { pts: '94,84 46,72 22,80 90,98', fill: E.light, layer: 0 },
    { pts: '94,66 108,66 118,132 100,154 84,132', fill: E.base, layer: 1 },
    { pts: '94,66 100,66 100,154 84,132', fill: E.light, layer: 1 },
    { pts: '88,46 116,42 122,62 96,72', fill: TOKEN.paper0, layer: 1 },
    { pts: '118,50 140,58 120,70', fill: TOKEN.kincha, layer: 2 },
    { pts: '86,150 114,150 100,182', fill: TOKEN.paper0, layer: 0 },
    { pts: '92,124 108,124 106,146 94,146', fill: TOKEN.kincha, layer: 1 },
    eye(110, 54, 3.8),
  ],
  recipe: {
    base: 'bird',
    steps: [
      ...birdBase({ detail: 'Turn it so the two wide flaps face you. Those are the wings.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Close it along the middle, away from you.',
        camera: CAM.side,
      }),
      reverseAt('head', PT.TL, PT.BR, 0.2, -22, PT.TL, 'mountain', {
        instruction: 'Reverse the front point up into a head.',
        detail: 'Short and forward, then pinch the very tip down into a hook. A sea eagle is identifiable by that bill alone.',
        camera: CAM.close,
      }),
      pull('wing-near', [crease([300, 320], PT.RQ, [700, 320], 'valley', 150)], [640, 340], [720, 160], {
        instruction: 'Draw the near wing out and hold it flat.',
        detail: 'All the way out. A wing that is half open reads as a sick bird.',
        camera: CAM.close,
      }),
      pull('wing-far', [crease([320, 300], PT.BQ, [320, 700], 'mountain', 150)], [340, 640], [160, 720], {
        instruction: 'And the far wing, the same span.',
        detail: 'Sight along the back to check they match.',
      }),
      reverseAt('tail', PT.TL, PT.BR, 0.88, 26, PT.BR, 'mountain', {
        instruction: 'Reverse the back point down into a wedge tail.',
        detail: 'Wide and short. It is a brake, not a rudder.',
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press the body only. Leave the wings with a little lift.',
        detail: 'A dead-flat wing looks like paper. A curved one looks like it is holding air.',
        camera: CAM.desk,
      }),
    ],
  },
}
