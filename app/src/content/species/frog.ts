/* PAPER PLANET — the Frog. Waterbomb base, four corners up, and a pleat that makes it jump. */

import { CODEX } from '../codex'
import { eye, sclera, stroke } from '../art'
import { TOKEN, hue, tint } from '../palette'
import { CAM, PT, crossFold, pinch, press, valley, waterbombBase, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const G = hue(TOKEN.matcha)

export const frog: SpeciesDef = {
  id: 'frog',
  name: 'Frog',
  binomial: 'Rana saliens',
  biome: 'meadow',
  rarity: 'common',
  material: { front: G.base, back: TOKEN.paperBack },
  chirp: [0.667, 0.667, 0.889],
  idle: 'hop',
  reward: 20,
  unlock: { type: 'species', id: 'rabbit', mastery: 'adept' },
  meta: { tier: 'classic', surface: 'ground', scale: 0.86, altitude: 0.02, flock: ['treefrog'] },
  codex: CODEX.frog,
  art: [
    { pts: '44,150 28,168 66,164', fill: G.dark, layer: 0 },
    { pts: '156,150 172,168 134,164', fill: G.dark, layer: 0 },
    { pts: '44,120 100,64 156,120 142,162 58,162', fill: G.base, layer: 1 },
    { pts: '44,120 100,64 100,162 58,162', fill: G.light, layer: 1 },
    { pts: '74,118 126,118 118,158 82,158', fill: tint(TOKEN.matcha, 0.6), layer: 1 },
    { circle: [72, 60, 17], fill: G.base, layer: 1 },
    { circle: [128, 60, 17], fill: G.base, layer: 1 },
    sclera(72, 60, 11),
    sclera(128, 60, 11),
    stroke(80, 134, 120, 134),
    eye(74, 62, 5.5),
    eye(130, 62, 5.5),
  ],
  recipe: {
    base: 'waterbomb',
    steps: [
      ...waterbombBase({ detail: 'A triangle with four loose corners. Those are the legs.' }),
      valley('leg-front', PT.MB, PT.MR, PT.BR, 180, {
        instruction: 'Take the near right corner up to the top point.',
        detail: 'Corner exactly onto corner. Everything in this fold is symmetrical, so mistakes show.',
        camera: CAM.close,
      }),
      valley('leg-back', PT.MB, PT.ML, PT.BL, 180, {
        instruction: 'And the left corner up to meet it.',
        detail: 'Two legs, pointing the way the frog is about to go.',
      }),
      pinch(
        'waist',
        [
          crease([250, 0], [250, PT.BL[1]], PT.TL, 'valley', 180),
          crease([750, 0], [750, PT.BR[1]], PT.TR, 'valley', 180),
        ],
        PT.ML,
        PT.C,
        {
          instruction: 'Bring both sides in to the middle.',
          detail: 'It narrows into a body. The legs stay where they are.',
        },
      ),
      crossFold('spring', PT.MT, PT.MB, 0.72, 0, PT.MB, 'mountain', 180, {
        instruction: 'Fold the bottom half up, then back down on itself.',
        detail: 'That is the spring. Press the back of it later and your finger slips off, and it jumps.',
        effort: 3,
        camera: CAM.side,
      }),
      press('set', {
        instruction: 'Press the pleat hard. This one wants to be crisp.',
        detail: 'Everything else in this game you press gently. Not this.',
      }),
    ],
  },
}
