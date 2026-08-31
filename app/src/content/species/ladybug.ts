/* PAPER PLANET — the Ladybird. A waterbomb base stopped before the air goes in. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, shade } from '../palette'
import { CAM, PT, crossFold, press, waterbombBase } from '../recipes'
import type { SpeciesDef } from '../types'

const B = hue(TOKEN.beni)

export const ladybug: SpeciesDef = {
  id: 'ladybug',
  name: 'Ladybird',
  binomial: 'Coccinella plicata',
  biome: 'meadow',
  rarity: 'common',
  material: { front: B.base, back: TOKEN.paperBack },
  chirp: [2, 2.5],
  idle: 'walk',
  reward: 12,
  unlock: { type: 'species', id: 'butterfly', mastery: 'novice' },
  meta: { tier: 'simple', surface: 'ground', scale: 0.6, altitude: 0.03, flock: ['bee'] },
  codex: CODEX.ladybug,
  art: [
    { pts: '54,86 40,80 52,98', fill: TOKEN.ink, layer: 0 },
    { pts: '52,112 38,114 52,124', fill: TOKEN.ink, layer: 0 },
    { pts: '146,86 160,80 148,98', fill: TOKEN.ink, layer: 0 },
    { pts: '148,112 162,114 148,124', fill: TOKEN.ink, layer: 0 },
    { pts: '100,52 148,80 146,130 100,158 54,130 52,80', fill: B.base, layer: 1 },
    { pts: '52,80 100,52 100,158 54,130', fill: B.light, layer: 1 },
    { line: [100, 54, 100, 156], fill: shade(TOKEN.beni, 0.4), noStroke: true, layer: 1 },
    { circle: [74, 92, 8], fill: TOKEN.ink, noStroke: true, layer: 1 },
    { circle: [126, 92, 8], fill: TOKEN.ink, noStroke: true, layer: 1 },
    { circle: [70, 124, 7], fill: TOKEN.ink, noStroke: true, layer: 1 },
    { circle: [130, 124, 7], fill: TOKEN.ink, noStroke: true, layer: 1 },
    { pts: '86,40 114,40 122,62 78,62', fill: TOKEN.ink, layer: 1 },
    { line: [90, 40, 80, 24], fill: TOKEN.ink, noStroke: true, layer: 2 },
    { line: [110, 40, 120, 24], fill: TOKEN.ink, noStroke: true, layer: 2 },
    eye(90, 50, 4, TOKEN.paper0),
    eye(110, 50, 4, TOKEN.paper0),
  ],
  recipe: {
    base: 'waterbomb',
    steps: [
      ...waterbombBase({ detail: 'Stop here and it is a shell. Blow into it and it would be a balloon.' }),
      crossFold('head', PT.TL, PT.BR, 0.24, 0, PT.TL, 'valley', 180, {
        instruction: 'Fold the top point down for the head.',
        detail: 'A small one. Ladybirds are mostly back.',
        camera: CAM.close,
      }),
      press('set', {
        instruction: 'Press the dome down gently — just enough to hold.',
        detail: 'Leave a little air under it. A flat ladybird is a sad one.',
      }),
    ],
  },
}
