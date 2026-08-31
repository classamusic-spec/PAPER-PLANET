/* PAPER PLANET — the Turtle. Blintzed twice: the shell is a raised square of paper. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, blintz, flip, mountain, press, pull, valley, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const G = hue(TOKEN.matcha)
const SHELL = mix(TOKEN.matcha, TOKEN.ai, 0.3)

export const turtle: SpeciesDef = {
  id: 'turtle',
  name: 'Turtle',
  binomial: 'Testudo blintzata',
  biome: 'shore',
  rarity: 'uncommon',
  material: { front: SHELL, back: TOKEN.paperBack },
  chirp: [1, 1.25],
  idle: 'walk',
  reward: 26,
  unlock: { type: 'species', id: 'fish', mastery: 'adept' },
  meta: { tier: 'classic', surface: 'ground', scale: 0.9, altitude: 0.01 },
  codex: CODEX.turtle,
  art: [
    { pts: '58,108 44,102 56,122', fill: G.base, layer: 0 },
    { pts: '142,108 156,102 144,122', fill: G.base, layer: 0 },
    { pts: '58,140 48,158 72,148', fill: G.base, layer: 0 },
    { pts: '142,140 152,158 128,148', fill: G.base, layer: 0 },
    { pts: '50,110 36,106 48,122', fill: G.base, layer: 0 },
    { pts: '150,86 176,78 182,96 156,104', fill: G.base, layer: 0 },
    { pts: '50,110 64,66 136,66 150,110 136,146 64,146', fill: SHELL, layer: 1 },
    { pts: '64,66 100,66 100,146 64,146', fill: mix(SHELL, TOKEN.paper0, 0.3), layer: 1 },
    { pts: '82,86 118,86 126,110 118,134 82,134 74,110', fill: mix(SHELL, TOKEN.ink, 0.22), layer: 1 },
    eye(170, 86, 4),
  ],
  recipe: {
    base: 'none',
    steps: [
      blintz('blintz-a', {
        instruction: 'Bring all four corners in to the middle.',
        detail: 'One at a time, and check each corner really touches the centre before you press.',
        camera: CAM.desk,
      }),
      flip('turn-a', {
        instruction: 'Turn it over.',
      }),
      blintz('blintz-b', {
        instruction: 'And all four corners in again on this side.',
        detail: 'The sheet is a quarter of the size it was. That thickness is the shell.',
        camera: CAM.close,
      }),
      valley('leg-front', PT.QL, PT.QB, PT.Q4, 180, {
        instruction: 'Pull one small corner out for a front leg.',
      }),
      valley('leg-back', PT.QT, PT.QR, PT.Q2, 180, {
        instruction: 'And the opposite corner, for the back one.',
        detail: 'Diagonal pairs, always. A turtle moves one leg from each side at a time.',
      }),
      pull('head', [crease(PT.QT, PT.QL, PT.TL, 'valley', 150)], PT.TL, [400, 400], {
        instruction: 'Draw the last corner out and up for the head.',
        detail: 'Leave it standing a little. A turtle looking at the ground is a rock.',
        camera: CAM.close,
      }),
      mountain('dome', PT.TL, PT.BR, PT.TR, 26, {
        instruction: 'Bend the shell over your finger until it curves.',
        detail: 'Not a crease — a curve. Roll it, do not fold it.',
        effort: 3,
        camera: CAM.side,
      }),
      press('set', {
        instruction: 'Press the four legs flat so it stands level.',
      }),
    ],
  },
}
