/* PAPER PLANET — the Tree Frog. The classical frog base with four legs pulled from four points. */

import { CODEX } from '../codex'
import { eye, sclera } from '../art'
import { TOKEN, hue, mix, tint } from '../palette'
import { CAM, PT, crossFold, frogBase, inflate, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const G = hue(mix(TOKEN.matcha, TOKEN.kincha, 0.22))

export const treefrog: SpeciesDef = {
  id: 'treefrog',
  name: 'Tree Frog',
  binomial: 'Hyla adhaerens',
  biome: 'forest',
  rarity: 'rare',
  material: { front: G.base, back: TOKEN.paperBack },
  chirp: [1.5, 1.5, 2, 1.5],
  idle: 'hop',
  reward: 69,
  unlock: { type: 'species', id: 'frog', mastery: 'master' },
  meta: { tier: 'grand', surface: 'perch', scale: 0.76, altitude: 0.3, flock: ['frog'] },
  codex: CODEX.treefrog,
  art: [
    { pts: '40,116 18,138 34,150 52,132', fill: G.dark, layer: 0 },
    { pts: '160,116 182,138 166,150 148,132', fill: G.dark, layer: 0 },
    { pts: '54,146 40,172 62,176 72,152', fill: G.dark, layer: 0 },
    { pts: '146,146 160,172 138,176 128,152', fill: G.dark, layer: 0 },
    { circle: [24, 146, 6], fill: G.light, noStroke: true, layer: 0 },
    { circle: [176, 146, 6], fill: G.light, noStroke: true, layer: 0 },
    { circle: [48, 176, 6], fill: G.light, noStroke: true, layer: 0 },
    { circle: [152, 176, 6], fill: G.light, noStroke: true, layer: 0 },
    { pts: '46,116 100,66 154,116 142,160 58,160', fill: G.base, layer: 1 },
    { pts: '46,116 100,66 100,160 58,160', fill: G.light, layer: 1 },
    { pts: '76,120 124,120 118,156 82,156', fill: tint(TOKEN.matcha, 0.66), layer: 1 },
    { circle: [70, 62, 19], fill: G.base, layer: 1 },
    { circle: [130, 62, 19], fill: G.base, layer: 1 },
    sclera(70, 62, 12, TOKEN.kincha),
    sclera(130, 62, 12, TOKEN.kincha),
    eye(71, 63, 6),
    eye(131, 63, 6),
  ],
  recipe: {
    base: 'frog',
    steps: [
      ...frogBase({ detail: 'Four points on top, four beneath. A frog has four legs and two eyes, and here they all are.' }),
      pull(
        'legs-front',
        [
          crease(PT.C, PT.RIDGE_TL_A, [520, 220], 'valley', 130),
          crease(PT.C, PT.RIDGE_TL_B, [220, 520], 'valley', 130),
        ],
        [400, 320],
        [260, 220],
        {
          instruction: 'Draw the two near points out for the front legs.',
          detail: 'Forward and a little apart, the way a frog sits when it is thinking about leaving.',
          effort: 3,
          camera: CAM.close,
        },
      ),
      pull(
        'legs-back',
        [
          crease(PT.C, PT.RIDGE_BR_A, [480, 780], 'valley', 130),
          crease(PT.C, PT.RIDGE_BR_B, [780, 480], 'valley', 130),
        ],
        [600, 680],
        [760, 780],
        {
          instruction: 'And the two behind, for the back legs.',
          detail: 'Longer than the front pair. Everything a frog does is stored in these.',
          effort: 3,
        },
      ),
      reverseAt('toes', PT.C, PT.BR, 0.78, 30, PT.BR, 'mountain', {
        instruction: 'Reverse the end of each back leg forward into a foot.',
        detail: 'Then flatten the very tips: those pads are how it holds onto wet glass.',
        camera: CAM.detail,
      }),
      crossFold('eyes', PT.TL, PT.BR, 0.18, 0, PT.TL, 'valley', 150, {
        instruction: 'Fold the top point down and split it into two eyes.',
        detail: 'They should stand above the head. A tree frog sees over the top of a leaf without moving.',
        camera: CAM.close,
      }),
      inflate('body', {
        instruction: 'Puff the body open from underneath.',
        detail: 'Just enough that it is round. A frog at rest is inflated.',
      }),
      press('set', {
        instruction: 'Press the feet flat so it grips the desk.',
        detail: 'Then leave it on something vertical and see how long it stays.',
        camera: CAM.desk,
      }),
    ],
  },
}
