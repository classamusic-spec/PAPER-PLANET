/* PAPER PLANET — the Deer. A bird base standing on all four of its points. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, birdBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const D = hue(mix(TOKEN.kincha, TOKEN.paper3, 0.4))

export const deer: SpeciesDef = {
  id: 'deer',
  name: 'Sika Deer',
  binomial: 'Cervus inclinans',
  biome: 'forest',
  rarity: 'uncommon',
  material: { front: D.base, back: TOKEN.paperBack },
  chirp: [1, 1.5, 1.335, 1.125],
  idle: 'walk',
  reward: 40,
  unlock: { type: 'species', id: 'squirrel', mastery: 'adept' },
  meta: { tier: 'master', surface: 'ground', scale: 1.3, altitude: 0.03 },
  codex: CODEX.deer,
  art: [
    { pts: '150,44 148,14 158,12 160,38', fill: D.dark, layer: 0 },
    { pts: '152,26 132,10 142,6 158,20', fill: D.dark, layer: 0 },
    { pts: '166,40 176,10 186,14 174,44', fill: D.dark, layer: 0 },
    { pts: '172,24 190,8 196,16 178,32', fill: D.dark, layer: 0 },
    { pts: '58,104 128,92 152,110 148,152 64,156', fill: D.base, layer: 1 },
    { pts: '58,104 100,96 100,154 64,156', fill: D.light, layer: 1 },
    { circle: [92, 116, 4], fill: D.pale, noStroke: true, layer: 1 },
    { circle: [112, 124, 4], fill: D.pale, noStroke: true, layer: 1 },
    { circle: [128, 112, 4], fill: D.pale, noStroke: true, layer: 1 },
    { pts: '124,96 140,54 156,50 148,96', fill: D.base, layer: 1 },
    { pts: '136,44 168,38 176,58 152,74 132,64', fill: D.base, layer: 1 },
    { pts: '160,32 180,24 170,44', fill: D.dark, layer: 0 },
    { pts: '170,54 186,58 172,68', fill: TOKEN.ink, layer: 2 },
    { pts: '72,156 68,182 80,182 82,156', fill: D.dark, layer: 0 },
    { pts: '132,152 130,182 142,182 144,152', fill: D.dark, layer: 0 },
    eye(154, 54, 3.6),
  ],
  recipe: {
    base: 'bird',
    steps: [
      ...birdBase({ detail: 'Four points. Two are the front legs, one is the neck, one is the back.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Close it along the middle, away from you.',
        detail: 'Now it is a standing animal instead of a flat star.',
        camera: CAM.side,
      }),
      reverseAt('neck', PT.TL, PT.BR, 0.28, -26, PT.TL, 'mountain', {
        instruction: 'Reverse the front point up for the neck.',
        detail: 'Not vertical. A deer that is browsing holds its neck at about forty degrees.',
        camera: CAM.close,
      }),
      reverseAt('head', PT.TL, PT.BR, 0.12, 40, PT.TL, 'valley', {
        instruction: 'Reverse the tip forward for the head.',
        detail: 'Short. The muzzle is a third of the length of the neck.',
        camera: CAM.detail,
      }),
      pull(
        'antlers',
        [
          crease([180, 240], [60, 120], [140, 140], 'valley', 110),
          crease([220, 200], [100, 60], [180, 100], 'mountain', 110),
        ],
        [160, 180],
        [90, 90],
        {
          instruction: 'Draw two thin points out of the head for antlers.',
          detail: 'Every tine needs its own point of paper. Two is what a square will honestly give you.',
          effort: 3,
          camera: CAM.detail,
        },
      ),
      press('set', {
        instruction: 'Press the legs flat and set it standing.',
        detail: 'Adjust one back leg until it stops rocking. It will.',
        camera: CAM.desk,
      }),
    ],
  },
}
