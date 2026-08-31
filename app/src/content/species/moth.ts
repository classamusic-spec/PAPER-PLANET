/* PAPER PLANET — the Luna Moth. The same fold as the butterfly until the very last step. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, burnish, pinch, press, simpleBase, valley, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const L = hue(mix(TOKEN.matcha, TOKEN.aiSoft, 0.4))

export const moth: SpeciesDef = {
  id: 'moth',
  name: 'Luna Moth',
  binomial: 'Actias chartacea',
  biome: 'nightsky',
  rarity: 'common',
  material: { front: L.base, back: TOKEN.paperBack },
  chirp: [1.875, 1.667, 1.875],
  idle: 'flutter',
  reward: 20,
  unlock: { type: 'species', id: 'butterfly', mastery: 'adept' },
  meta: { tier: 'classic', surface: 'air', scale: 0.82, altitude: 0.44, flock: ['butterfly', 'firefly'] },
  codex: CODEX.moth,
  art: [
    { pts: '96,70 40,36 24,72 52,96 94,98', fill: L.base, layer: 0 },
    { pts: '104,70 160,36 176,72 148,96 106,98', fill: L.dark, layer: 0 },
    { pts: '94,98 52,98 60,132 78,168 92,128', fill: L.base, layer: 0 },
    { pts: '106,98 148,98 140,132 122,168 108,128', fill: L.dark, layer: 0 },
    { circle: [58, 66, 7], fill: TOKEN.paper0, noStroke: true, layer: 1 },
    { circle: [142, 66, 7], fill: TOKEN.paper0, noStroke: true, layer: 1 },
    { circle: [58, 66, 3], fill: TOKEN.beni, noStroke: true, layer: 1 },
    { circle: [142, 66, 3], fill: TOKEN.beni, noStroke: true, layer: 1 },
    { pts: '95,60 105,60 104,132 96,132', fill: mix(TOKEN.paper0, TOKEN.matchaSoft, 0.4), layer: 1 },
    { circle: [100, 54, 8], fill: mix(TOKEN.paper0, TOKEN.matchaSoft, 0.4), layer: 1 },
    stroke(96, 48, 78, 32, TOKEN.inkSoft),
    stroke(104, 48, 122, 32, TOKEN.inkSoft),
    eye(96.5, 52, 2.4),
    eye(103.5, 52, 2.4),
  ],
  recipe: {
    base: 'none',
    steps: [
      ...simpleBase({ detail: 'The same beginning as a butterfly. It parts company at the end.' }),
      burnish('mark', [[PT.TR, PT.BL, PT.TL]], 'valley', {
        instruction: 'Rub a line down the middle of the triangle.',
      }),
      valley('wing-lower', PT.TR, PT.BL, PT.BR, 30, {
        instruction: 'Turn the lower wings out from under the upper pair.',
        detail: 'A moth has four wings, and the back two barely show. Leave a hand’s width of them.',
      }),
      valley('wing-upper', PT.TR, PT.BL, PT.TL, 20, {
        instruction: 'Open the wings almost flat.',
        detail: 'Almost. A moth at rest lies its wings down over its back; a butterfly holds them up.',
        camera: CAM.close,
      }),
      pinch('tails', [crease([560, 640], [820, 900], [820, 640], 'valley', 120)], [700, 760], [820, 880], {
        instruction: 'Draw two long tails out of the lower corners.',
        detail: 'They spin as it flies and throw a bat’s sonar off. That is what they are for.',
        effort: 3,
        camera: CAM.detail,
      }),
      press('set', {
        instruction: 'Press the wings flat to the desk.',
        detail: 'Flat. That single difference is the whole species.',
        camera: CAM.desk,
      }),
    ],
  },
}
