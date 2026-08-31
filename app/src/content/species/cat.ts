/* PAPER PLANET — the Cat. Traditional: one flat body, two ears, no legs at all. */

import { CODEX } from '../codex'
import { eyeShape, stroke } from '../art'
import { TOKEN, mix, hue } from '../palette'
import { CAM, PT, crossFold, flip, kiteBase, mountain, press, reverseAt } from '../recipes'
import type { SpeciesDef } from '../types'

const C = hue(mix(TOKEN.paper3, TOKEN.ai, 0.34))

export const cat: SpeciesDef = {
  id: 'cat',
  name: 'Cat',
  binomial: 'Felis sedens',
  biome: 'meadow',
  rarity: 'uncommon',
  material: { front: C.base, back: TOKEN.paperBack },
  chirp: [1.25, 1.5, 1.25],
  idle: 'sway',
  reward: 40,
  unlock: { type: 'collection', count: 14 },
  meta: { tier: 'master', surface: 'ground', scale: 1.02, altitude: 0.03 },
  codex: CODEX.cat,
  art: [
    { pts: '140,120 172,92 178,104 150,132', fill: C.dark, layer: 0 },
    { pts: '66,108 134,108 142,164 58,164', fill: C.base, layer: 1 },
    { pts: '66,108 100,108 100,164 58,164', fill: C.light, layer: 1 },
    { pts: '70,62 66,30 94,50', fill: C.dark, layer: 0 },
    { pts: '130,62 134,30 106,50', fill: C.dark, layer: 0 },
    { pts: '73,56 71,40 88,50', fill: TOKEN.sakura, noStroke: true, layer: 1 },
    { pts: '127,56 129,40 112,50', fill: TOKEN.sakura, noStroke: true, layer: 1 },
    { pts: '68,60 100,44 132,60 130,100 70,100', fill: C.base, layer: 1 },
    { pts: '68,60 100,44 100,100 70,100', fill: C.light, layer: 1 },
    { pts: '96,88 104,88 100,95', fill: TOKEN.beni, noStroke: true, layer: 2 },
    { pts: '66,164 86,164 76,152', fill: C.light, layer: 1 },
    { pts: '114,164 134,164 124,152', fill: C.light, layer: 1 },
    stroke(64, 86, 46, 82),
    stroke(64, 93, 48, 95),
    stroke(136, 86, 154, 82),
    stroke(136, 93, 152, 95),
    eyeShape('82,74 90,74 86,82'),
    eyeShape('110,74 118,74 114,82'),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'The wide end is the head. Cats are folded head-first.' }),
      crossFold('face', PT.TL, PT.BR, 0.3, 0, PT.TL, 'valley', 180, {
        instruction: 'Fold the top corner down to blunt it.',
        detail: 'Nothing about a cat is pointed except the ears. Take the point off first.',
        camera: CAM.close,
      }),
      crossFold('ear-left', PT.TL, PT.BR, 0.2, 40, PT.TL, 'valley', 150, {
        instruction: 'Turn one corner up into an ear.',
        detail: 'Not flat — leave it standing, so the light gets underneath.',
      }),
      crossFold('ear-right', PT.TL, PT.BR, 0.2, -40, PT.TL, 'valley', 150, {
        instruction: 'And the other, at the same angle.',
        detail: 'Hold the first one down while you make the second. They should mirror.',
        camera: CAM.close,
      }),
      flip('turn', {
        instruction: 'Turn it over.',
        detail: 'The ears are done. The rest happens behind.',
      }),
      mountain('back', PT.TL, PT.BR, PT.TR, 34, {
        instruction: 'Fold the body back along the middle, but only part way.',
        detail: 'A sitting cat is a wedge, not a sheet. Thirty degrees is plenty.',
        camera: CAM.side,
      }),
      crossFold('haunch', PT.TL, PT.BR, 0.78, -22, PT.BR, 'valley', 180, {
        instruction: 'Fold the bottom corner up for the haunches.',
        detail: 'This is what the cat sits on. Make it flat and it will not fall over.',
      }),
      reverseAt('tail', PT.TL, PT.BR, 0.88, -30, PT.BR, 'mountain', {
        instruction: 'Tap the last point and reverse it out for the tail.',
        detail: 'Push it out sideways, not backwards. Cats curl their tails around themselves.',
        camera: CAM.detail,
      }),
      reverseAt('tail-tip', PT.TL, PT.BR, 0.97, 40, PT.BR, 'valley', {
        instruction: 'One more, tiny, at the very end.',
        detail: 'The tip flicks. It is two millimetres of paper and it changes the whole animal.',
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press it flat and stand it up.',
        detail: 'Then leave it somewhere warm. It will find its own spot anyway.',
        camera: CAM.desk,
      }),
    ],
  },
}
