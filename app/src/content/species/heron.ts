/* PAPER PLANET — the Heron. Two reverse folds and a very long neck. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN, mix } from '../palette'
import { CAM, PT, kiteBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const BODY = TOKEN.paper0
const SHADE = mix(TOKEN.paper2, TOKEN.ai, 0.22)

export const heron: SpeciesDef = {
  id: 'heron',
  name: 'Heron',
  binomial: 'Ardea immobilis',
  biome: 'shore',
  rarity: 'uncommon',
  material: { front: BODY, back: TOKEN.paperBack },
  chirp: [0.75, 1.125, 0.75],
  idle: 'stand',
  reward: 26,
  unlock: { type: 'species', id: 'crane', mastery: 'adept' },
  meta: { tier: 'classic', surface: 'water', scale: 1.24, altitude: 0.04, flock: ['crane', 'fish'] },
  codex: CODEX.heron,
  art: [
    stroke(102, 134, 100, 178, TOKEN.kinchaDeep),
    stroke(118, 132, 124, 176, TOKEN.kinchaDeep),
    { pts: '70,96 118,84 148,104 138,134 82,138', fill: BODY, layer: 1 },
    { pts: '84,100 130,94 134,124 90,128', fill: SHADE, layer: 1 },
    { pts: '148,104 186,120 152,124', fill: SHADE, layer: 0 },
    { pts: '76,98 56,60 64,34 78,36 70,64 90,96', fill: BODY, layer: 1 },
    { pts: '60,30 84,26 88,40 66,46', fill: BODY, layer: 1 },
    { pts: '84,26 106,16 88,34', fill: TOKEN.ink, layer: 0 },
    { pts: '86,32 126,40 86,45', fill: TOKEN.kincha, layer: 2 },
    eye(74, 34, 3.2),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'The long point is going to be a neck, and it needs every millimetre.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      reverseAt('neck', PT.TL, PT.BR, 0.6, -8, PT.BR, 'mountain', {
        instruction: 'Tap the point and push it up, steeply.',
        detail: 'Steeper than feels right. A heron holds its neck almost vertical when it is waiting.',
        camera: CAM.close,
      }),
      reverseAt('head', PT.TL, PT.BR, 0.88, 34, PT.BR, 'valley', {
        instruction: 'Reverse the tip forward for the head and beak.',
        detail: 'Long, straight, level. The beak is a spear and it is held like one.',
        camera: CAM.detail,
      }),
      pull('legs', [crease([420, 620], [700, 900], [700, 620], 'valley', 100)], [640, 700], [720, 860], {
        instruction: 'Draw the two legs down out of the body.',
        detail: 'Thin as you can. They carry nothing but a bird that is standing still.',
      }),
      press('set', {
        instruction: 'Press the body and leave everything else alone.',
        detail: 'It stands very still, and then it does not.',
        camera: CAM.desk,
      }),
    ],
  },
}
