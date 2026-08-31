/* PAPER PLANET — the Fox. A kite base, two ears turned up, a nose reversed out. */

import { CODEX } from '../codex'
import { eyeShape } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, kiteBase, mountain, press, reverseAt } from '../recipes'
import type { SpeciesDef } from '../types'

const F = hue(mix(TOKEN.kincha, TOKEN.beni, 0.35))

export const fox: SpeciesDef = {
  id: 'fox',
  name: 'Fox',
  binomial: 'Vulpes plicata',
  biome: 'forest',
  rarity: 'common',
  material: { front: F.base, back: TOKEN.paperBack },
  chirp: [1.25, 0.938, 1.25, 1.5],
  idle: 'walk',
  reward: 20,
  unlock: { type: 'biome', id: 'forest' },
  meta: { tier: 'classic', surface: 'ground', scale: 1.04, altitude: 0.02, flock: ['tanuki'] },
  codex: CODEX.fox,
  art: [
    { pts: '58,72 50,22 94,54', fill: F.dark, layer: 0 },
    { pts: '142,72 150,22 106,54', fill: F.dark, layer: 0 },
    { pts: '62,64 58,34 86,54', fill: TOKEN.kinchaSoft, layer: 1 },
    { pts: '138,64 142,34 114,54', fill: TOKEN.kinchaSoft, layer: 1 },
    { pts: '100,48 58,72 66,120 100,150', fill: F.base, layer: 1 },
    { pts: '100,48 142,72 134,120 100,150', fill: F.dark, layer: 1 },
    { pts: '82,112 118,112 100,148', fill: TOKEN.paper0, layer: 1 },
    { pts: '93,134 107,134 100,146', fill: TOKEN.ink, layer: 2 },
    eyeShape('74,92 86,88 82,100'),
    eyeShape('126,92 114,88 118,100'),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Wide end up. That is the fox’s face, and the point becomes the nose.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      crossFold('ear-left', PT.TL, PT.BR, 0.16, 44, PT.TL, 'valley', 165, {
        instruction: 'Turn one corner up for an ear.',
        detail: 'Big. Fox ears are enormous and it is the whole reason a fox reads as a fox.',
        camera: CAM.close,
      }),
      crossFold('ear-right', PT.TL, PT.BR, 0.16, -44, PT.TL, 'valley', 165, {
        instruction: 'And the other, mirrored.',
        detail: 'Set them at the same angle. Then set them slightly differently, because nothing living is symmetrical.',
      }),
      reverseAt('nose', PT.TL, PT.BR, 0.86, 22, PT.BR, 'mountain', {
        instruction: 'Tap the long point and reverse it down into a nose.',
        detail: 'A fox’s muzzle is thin and low. Take more off than you think.',
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press the head flat and leave the ears standing.',
        detail: 'Then open the ears with a fingernail so they cup forward. It starts listening.',
        camera: CAM.desk,
      }),
    ],
  },
}
