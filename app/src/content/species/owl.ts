/* PAPER PLANET — the Owl. A kite base with the point folded back, which is how paper says "round". */

import { CODEX } from '../codex'
import { eye, sclera } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, flip, kiteBase, press, reverseAt, squash, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const O = hue(mix(TOKEN.kinchaDeep, TOKEN.ink, 0.28))

export const owl: SpeciesDef = {
  id: 'owl',
  name: 'Owl',
  binomial: 'Strix plicata',
  biome: 'nightsky',
  rarity: 'uncommon',
  material: { front: O.base, back: TOKEN.paperBack },
  chirp: [0.75, 0.667, 0.75],
  idle: 'stand',
  reward: 40,
  unlock: { type: 'species', id: 'bat', mastery: 'novice' },
  meta: { tier: 'master', surface: 'perch', scale: 1.06, altitude: 0.34 },
  codex: CODEX.owl,
  art: [
    { pts: '70,52 58,24 88,44', fill: O.dark, layer: 0 },
    { pts: '130,52 142,24 112,44', fill: O.dark, layer: 0 },
    { pts: '52,84 36,110 58,124', fill: O.dark, layer: 0 },
    { pts: '148,84 164,110 142,124', fill: O.dark, layer: 0 },
    { pts: '58,60 100,40 142,60 148,120 100,164 52,120', fill: O.base, layer: 1 },
    { pts: '58,60 100,40 100,164 52,120', fill: O.light, layer: 1 },
    { pts: '78,108 122,108 100,152', fill: O.pale, layer: 1 },
    { pts: '94,84 106,84 100,96', fill: TOKEN.kincha, layer: 2 },
    { pts: '88,164 84,175 96,166', fill: TOKEN.kincha, layer: 0 },
    { pts: '112,164 116,175 104,166', fill: TOKEN.kincha, layer: 0 },
    sclera(80, 74, 14),
    sclera(120, 74, 14),
    eye(82, 76, 6),
    eye(118, 76, 6),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Wide end up. An owl is a circle with two ears, so the point has to go.' }),
      crossFold('blunt', PT.TL, PT.BR, 0.26, 0, PT.TL, 'valley', 180, {
        instruction: 'Fold the top point back down on itself.',
        detail: 'Blunting a point is the classical way to say round. There is no other way with a square.',
        camera: CAM.close,
      }),
      squash('face', [
        crease(PT.C, PT.MT, [420, 220], 'valley', 180),
        crease(PT.C, PT.ML, [220, 420], 'valley', 180),
      ], [360, 360], [280, 280], {
        instruction: 'Open the blunted flap and press it flat into a face.',
        detail: 'The wide flat disc of an owl’s face is a dish. It collects sound the way a hand behind your ear does.',
        camera: CAM.close,
      }),
      crossFold('tuft-left', PT.TL, PT.BR, 0.14, 44, PT.TL, 'valley', 140, {
        instruction: 'Turn a small corner up for an ear tuft.',
        detail: 'They are not ears. The ears are hidden under the feathers, at different heights.',
      }),
      crossFold('tuft-right', PT.TL, PT.BR, 0.14, -44, PT.TL, 'valley', 140, {
        instruction: 'And the other tuft.',
      }),
      flip('turn', {
        instruction: 'Turn it over.',
      }),
      crossFold('wing-left', PT.TL, PT.BR, 0.52, 66, PT.RQ, 'valley', 160, {
        instruction: 'Fold one side edge in for a folded wing.',
        detail: 'Wings closed. An owl on a branch is a shape with nothing sticking out of it.',
        camera: CAM.close,
      }),
      crossFold('wing-right', PT.TL, PT.BR, 0.52, -66, PT.BQ, 'valley', 160, {
        instruction: 'And the other side to match.',
      }),
      reverseAt('feet', PT.TL, PT.BR, 0.88, -26, PT.BR, 'mountain', {
        instruction: 'Reverse the bottom point forward into two feet.',
        detail: 'Two toes forward and two behind, if you want to be right about it.',
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press it flat and sit it on the edge of something.',
        detail: 'It will look like it is not going to move for an hour. It is not.',
        camera: CAM.desk,
      }),
    ],
  },
}
