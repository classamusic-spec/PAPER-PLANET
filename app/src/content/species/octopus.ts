/* PAPER PLANET — the Octopus. Eight points want a frog base. That is what it was for. */

import { CODEX } from '../codex'
import { eye, sclera, stroke } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, frogBase, inflate, press, pull, rotate, squash, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const M = hue(TOKEN.murasaki)

export const octopus: SpeciesDef = {
  id: 'octopus',
  name: 'Octopus',
  binomial: 'Octopus origamiensis',
  biome: 'shore',
  rarity: 'rare',
  material: { front: M.base, back: TOKEN.paperBack },
  chirp: [1, 1.25, 1.5, 1.875],
  idle: 'swim',
  reward: 69,
  unlock: { type: 'species', id: 'whale', mastery: 'master' },
  meta: { tier: 'grand', surface: 'water', scale: 1.14, altitude: 0, flock: ['fish'] },
  codex: CODEX.octopus,
  art: [
    { pts: '52,92 26,110 54,106', fill: M.dark, layer: 0 },
    { pts: '148,92 174,110 146,106', fill: M.dark, layer: 0 },
    { pts: '56,104 44,150 70,116', fill: M.dark, layer: 0 },
    { pts: '76,112 70,158 92,118', fill: M.base, layer: 0 },
    { pts: '96,116 94,162 112,118', fill: M.dark, layer: 0 },
    { pts: '116,116 120,158 134,112', fill: M.base, layer: 0 },
    { pts: '136,108 148,148 152,104', fill: M.dark, layer: 0 },
    { pts: '100,36 142,56 150,104 100,116 50,104 58,56', fill: M.base, layer: 1 },
    { pts: '58,56 100,36 100,116 50,104', fill: M.light, layer: 1 },
    sclera(80, 80, 10),
    sclera(120, 80, 10),
    stroke(92, 98, 108, 98),
    { circle: [76, 138, 3], fill: M.pale, noStroke: true, layer: 1 },
    { circle: [102, 140, 3], fill: M.pale, noStroke: true, layer: 1 },
    { circle: [126, 136, 3], fill: M.pale, noStroke: true, layer: 1 },
    eye(82, 82, 5),
    eye(118, 82, 5),
  ],
  recipe: {
    base: 'frog',
    steps: [
      ...frogBase({ detail: 'Four long points on this side, four hiding behind. Eight. That is the whole reason for this base.' }),
      pull(
        'arms-front',
        [
          crease(PT.C, PT.RIDGE_TL_A, [520, 200], 'valley', 140),
          crease(PT.C, PT.RIDGE_TL_B, [200, 520], 'valley', 140),
        ],
        [420, 300],
        [300, 200],
        {
          instruction: 'Draw the four near points down and spread them.',
          detail: 'Take them one at a time and do not let the others slip back.',
          effort: 3,
          camera: CAM.close,
        },
      ),
      pull(
        'arms-back',
        [
          crease(PT.C, PT.RIDGE_BR_A, [480, 800], 'valley', 140),
          crease(PT.C, PT.RIDGE_BR_B, [800, 480], 'valley', 140),
        ],
        [580, 700],
        [700, 800],
        {
          instruction: 'And the four behind, the same way.',
          detail: 'Count them. Eight arms is the entire point of the last forty minutes.',
          effort: 3,
        },
      ),
      squash('head', [
        crease(PT.C, PT.MT, [420, 240], 'valley', 180),
        crease(PT.C, PT.ML, [240, 420], 'valley', 180),
      ], PT.C, [360, 360], {
        instruction: 'Open the top and press it into a dome.',
        detail: 'That bulge is the mantle. It holds the gills, the hearts, and most of the animal.',
        camera: CAM.close,
      }),
      inflate('mantle', {
        instruction: 'Blow softly into the base of the head.',
        detail: 'Only a little. Too much and it looks surprised.',
      }),
      rotate('settle', 16, {
        instruction: 'Turn it a few degrees on the desk.',
        detail: 'An octopus is never square to anything.',
      }),
      press('set', {
        instruction: 'Curl each arm over your fingertip, one at a time.',
        detail: 'Roll, do not crease. Then set it down and let it choose a corner.',
        camera: CAM.desk,
      }),
    ],
  },
}
