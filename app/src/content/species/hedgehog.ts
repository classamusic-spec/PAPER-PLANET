/* PAPER PLANET — the Hedgehog. A pleated edge, which is the oldest way to make many of one thing. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, mix, hue } from '../palette'
import { CAM, PT, crossFold, pinch, press, simpleBase, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const SPINE = mix(TOKEN.kinchaDeep, TOKEN.ink, 0.42)
const F = hue(TOKEN.paper3)

export const hedgehog: SpeciesDef = {
  id: 'hedgehog',
  name: 'Hedgehog',
  binomial: 'Erinaceus plicatus',
  biome: 'forest',
  rarity: 'common',
  material: { front: SPINE, back: TOKEN.paperBack },
  chirp: [1.5, 1.667, 1.5],
  idle: 'walk',
  reward: 12,
  unlock: { type: 'collection', count: 4 },
  meta: { tier: 'simple', surface: 'ground', scale: 0.7, altitude: 0.01 },
  codex: CODEX.hedgehog,
  art: [
    { pts: '38,124 52,86 62,106 74,80 86,102 98,76 110,100 122,78 134,102 148,84 158,118 152,148 44,150', fill: SPINE, layer: 1 },
    { pts: '38,124 52,86 62,106 74,80 86,102 98,76 100,150 44,150', fill: mix(SPINE, TOKEN.paper0, 0.18), layer: 1 },
    { pts: '148,114 178,110 188,124 174,140 150,142', fill: F.base, layer: 1 },
    { pts: '150,128 176,126 174,140 152,142', fill: F.light, layer: 1 },
    { pts: '52,150 44,164 70,156', fill: F.base, layer: 0 },
    { pts: '132,150 142,164 116,156', fill: F.base, layer: 0 },
    { circle: [186, 124, 4.5], fill: TOKEN.ink, noStroke: true, layer: 2 },
    eye(164, 120, 3.6),
  ],
  recipe: {
    base: 'none',
    steps: [
      ...simpleBase({ detail: 'A triangle. The long edge is going to be a back full of spines.' }),
      crossFold('snout', PT.BL, PT.TR, 0.84, 20, PT.TR, 'valley', 180, {
        instruction: 'Fold one corner in to make the face.',
        detail: 'Small and pointed. A hedgehog is a nose with a back attached.',
        camera: CAM.close,
      }),
      pinch(
        'spines',
        [
          crease([180, 240], [420, 480], [300, 220], 'mountain', 120),
          crease([300, 360], [540, 600], [420, 340], 'valley', 120),
          crease([420, 480], [660, 720], [540, 460], 'mountain', 120),
        ],
        [300, 300],
        [420, 420],
        {
          instruction: 'Pleat the long edge: under, over, under.',
          detail: 'Even spacing matters more than sharpness here. Spines are a rhythm.',
          effort: 3,
          camera: CAM.close,
        },
      ),
      press('set', {
        instruction: 'Press the belly flat and let the spines stand up.',
        detail: 'Run a thumbnail along each pleat afterwards and they separate.',
      }),
    ],
  },
}
