/* PAPER PLANET — the Bat. Mountain folds, because a membrane curves away from you. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, crossFold, press, valley, waterbombBase } from '../recipes'
import type { SpeciesDef } from '../types'

const M = hue(TOKEN.murasakiDeep)

export const bat: SpeciesDef = {
  id: 'bat',
  name: 'Bat',
  binomial: 'Vespertilio plicatus',
  biome: 'nightsky',
  rarity: 'common',
  material: { front: M.base, back: TOKEN.paperBack },
  chirp: [2.5, 3, 2.5],
  idle: 'fly',
  reward: 20,
  unlock: { type: 'biome', id: 'nightsky' },
  meta: { tier: 'classic', surface: 'air', scale: 0.92, altitude: 0.56, flock: ['moth'] },
  codex: CODEX.bat,
  art: [
    { pts: '96,84 30,54 22,96 44,92 38,120 64,112 66,132 96,116', fill: M.dark, layer: 0 },
    { pts: '104,84 170,54 178,96 156,92 162,120 136,112 134,132 104,116', fill: M.dark, layer: 0 },
    { pts: '96,84 44,64 36,92 52,90 50,112 70,106 72,124 96,112', fill: M.base, layer: 0 },
    { pts: '86,74 100,60 114,74 112,116 88,116', fill: M.base, layer: 1 },
    { pts: '86,74 100,60 100,116 88,116', fill: M.light, layer: 1 },
    { pts: '88,72 84,50 98,64', fill: M.dark, layer: 0 },
    { pts: '112,72 116,50 102,64', fill: M.dark, layer: 0 },
    { pts: '96,96 99,96 97,101', fill: TOKEN.paper0, noStroke: true, layer: 2 },
    { pts: '101,96 104,96 103,101', fill: TOKEN.paper0, noStroke: true, layer: 2 },
    eye(94, 84, 4, TOKEN.kincha),
    eye(106, 84, 4, TOKEN.kincha),
  ],
  recipe: {
    base: 'waterbomb',
    steps: [
      ...waterbombBase({ detail: 'Point down. The two side corners are going to be wings.' }),
      valley('wing-left', PT.MB, PT.ML, PT.BL, 150, {
        instruction: 'Swing one side corner out into a wing.',
        detail: 'Not flat to the desk — a bat’s wing is always slightly cupped.',
        camera: CAM.close,
      }),
      valley('wing-right', PT.MB, PT.MR, PT.BR, 150, {
        instruction: 'And the other, the same amount.',
      }),
      crossFold('scallop', PT.MT, PT.MB, 0.62, 24, PT.MB, 'mountain', 140, {
        instruction: 'Fold two small notches into the back edge of each wing.',
        detail: 'Away from you, both of them. A membrane curves away, and that is what a mountain fold is for.',
        effort: 3,
        camera: CAM.detail,
      }),
      crossFold('ears', PT.MT, PT.MB, 0.2, 40, PT.MT, 'valley', 140, {
        instruction: 'Turn two points up at the top for ears.',
        detail: 'Comically large. They are correct.',
        camera: CAM.close,
      }),
      press('set', {
        instruction: 'Press the body and leave the wings loose.',
        detail: 'Bend the middle back a little first, so it has a spine. Then hang it upside down.',
        camera: CAM.desk,
      }),
    ],
  },
}
