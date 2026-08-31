/* PAPER PLANET — the Penguin. A kite base stood on its end, with a reversed beak and feet. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, crossFold, kiteBase, mountain, press, reverseAt, rotate } from '../recipes'
import type { SpeciesDef } from '../types'

const A = hue(TOKEN.aiDeep)

export const penguin: SpeciesDef = {
  id: 'penguin',
  name: 'Penguin',
  binomial: 'Spheniscus chartaceus',
  biome: 'shore',
  rarity: 'uncommon',
  material: { front: A.base, back: TOKEN.paperBack },
  chirp: [1.125, 1.335, 1.125],
  idle: 'sway',
  reward: 40,
  unlock: { type: 'species', id: 'crab', mastery: 'adept' },
  meta: { tier: 'master', surface: 'ground', scale: 0.98, altitude: 0.02 },
  codex: CODEX.penguin,
  art: [
    { pts: '60,92 40,120 58,126', fill: A.dark, layer: 0 },
    { pts: '140,92 160,120 142,126', fill: A.dark, layer: 0 },
    { pts: '66,56 100,40 134,56 140,120 124,164 76,164 60,120', fill: A.base, layer: 1 },
    { pts: '100,40 134,56 140,120 124,164 100,164', fill: A.dark, layer: 1 },
    { pts: '78,58 122,58 118,88 82,88', fill: TOKEN.paper0, layer: 1 },
    { pts: '78,84 122,84 118,152 82,152', fill: TOKEN.paper0, layer: 1 },
    { pts: '94,80 106,80 100,92', fill: TOKEN.kincha, layer: 2 },
    { pts: '78,164 70,176 92,168', fill: TOKEN.kincha, layer: 0 },
    { pts: '122,164 130,176 108,168', fill: TOKEN.kincha, layer: 0 },
    eye(86, 72, 4.5),
    eye(114, 72, 4.5),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Stood on its end this is already a penguin shape. Most of the work is in the details.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      rotate('stand', 90, {
        instruction: 'Turn it upright on the desk.',
        detail: 'Point up. Everything now reads as a bird instead of a boat.',
      }),
      reverseAt('beak', PT.TL, PT.BR, 0.14, 32, PT.TL, 'valley', {
        instruction: 'Tap the top point and wrap it round for the beak.',
        detail: 'An outside reverse: the point goes around the outside instead of hiding inside.',
        camera: CAM.detail,
      }),
      crossFold('white-front', PT.TL, PT.BR, 0.42, 62, PT.TL, 'valley', 165, {
        instruction: 'Turn the front edge back to show the white.',
        detail: 'One side of the paper is dyed and one is not. This is what the plain side is for.',
        camera: CAM.close,
      }),
      crossFold('flipper-near', PT.TL, PT.BR, 0.52, 78, PT.RQ, 'valley', 130, {
        instruction: 'Fold the near flipper down and out.',
      }),
      crossFold('flipper-far', PT.TL, PT.BR, 0.52, -78, PT.BQ, 'mountain', 130, {
        instruction: 'And the far one behind, to match.',
        detail: 'Hold the model up to the light — you can see whether they line up.',
      }),
      reverseAt('feet', PT.TL, PT.BR, 0.9, -34, PT.BR, 'mountain', {
        instruction: 'Reverse the bottom point forward into two feet.',
        detail: 'They should stick out in front. A penguin stands on its heels.',
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press it flat, then stand it on the feet.',
        detail: 'If it tips forward, fold a little more foot. That is the whole trick.',
        camera: CAM.desk,
      }),
    ],
  },
}
