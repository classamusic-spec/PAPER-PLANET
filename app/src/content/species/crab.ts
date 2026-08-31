/* PAPER PLANET — the Crab. A windmill base opened out: four vanes, two of them claws. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, press, pull, windmillBase, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const B = hue(TOKEN.beni)

export const crab: SpeciesDef = {
  id: 'crab',
  name: 'Crab',
  binomial: 'Cancer quadratus',
  biome: 'shore',
  rarity: 'common',
  material: { front: B.base, back: TOKEN.paperBack },
  chirp: [1.5, 1.335, 1.5],
  idle: 'walk',
  reward: 20,
  unlock: { type: 'species', id: 'fish', mastery: 'novice' },
  meta: { tier: 'classic', surface: 'ground', scale: 0.74, altitude: 0.01 },
  codex: CODEX.crab,
  art: [
    { pts: '48,88 20,66 10,88 30,102', fill: B.dark, layer: 0 },
    { pts: '152,88 180,66 190,88 170,102', fill: B.dark, layer: 0 },
    { pts: '30,102 44,96 50,108 34,114', fill: B.light, layer: 0 },
    { pts: '170,102 156,96 150,108 166,114', fill: B.light, layer: 0 },
    stroke(58, 124, 30, 142, B.dark),
    stroke(66, 134, 44, 156, B.dark),
    stroke(142, 124, 170, 142, B.dark),
    stroke(134, 134, 156, 156, B.dark),
    { pts: '54,104 76,82 124,82 146,104 138,138 62,138', fill: B.base, layer: 1 },
    { pts: '54,104 76,82 100,82 100,138 62,138', fill: B.light, layer: 1 },
    { pts: '76,116 124,116 120,134 80,134', fill: B.pale, layer: 1 },
    stroke(86, 76, 84, 62, B.dark),
    stroke(114, 76, 116, 62, B.dark),
    eye(84, 60, 5),
    eye(116, 60, 5),
  ],
  recipe: {
    base: 'windmill',
    steps: [
      ...windmillBase({ detail: 'Four vanes. Two of them are about to become claws, which is a piece of luck.' }),
      pull(
        'claws',
        [
          crease(PT.Q1, PT.TL, [120, 60], 'valley', 120),
          crease(PT.Q2, PT.TR, [880, 60], 'valley', 120),
        ],
        [180, 120],
        [90, 60],
        {
          instruction: 'Lift the two top vanes and open each one into a claw.',
          detail: 'Squeeze the tip and it opens along the crease that is already there.',
          effort: 3,
          camera: CAM.close,
        },
      ),
      press('set', {
        instruction: 'Press the shell flat and leave the legs proud.',
        detail: 'Bend the back legs down last, so it stands off the desk a little.',
        camera: CAM.desk,
      }),
    ],
  },
}
