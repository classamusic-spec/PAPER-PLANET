/* PAPER PLANET — the Boar. A fish base, snout reversed, one tusk showing. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, fishBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const P = hue(mix(TOKEN.ink, TOKEN.paper3, 0.44))

export const boar: SpeciesDef = {
  id: 'boar',
  name: 'Wild Boar',
  binomial: 'Sus plicatus',
  biome: 'forest',
  rarity: 'uncommon',
  material: { front: P.base, back: TOKEN.paperBack },
  chirp: [0.667, 0.75, 0.5],
  idle: 'walk',
  reward: 40,
  unlock: { type: 'collection', count: 22 },
  meta: { tier: 'master', surface: 'ground', scale: 1.18, altitude: 0.02 },
  codex: CODEX.boar,
  art: [
    { pts: '46,104 74,84 96,72 100,90 76,102', fill: P.dark, layer: 0 },
    { pts: '100,90 110,68 122,86 134,66 144,88 156,74 162,96', fill: P.dark, layer: 0 },
    { pts: '44,110 100,88 150,94 170,116 160,150 56,152', fill: P.base, layer: 1 },
    { pts: '44,110 100,88 100,152 56,152', fill: P.light, layer: 1 },
    { pts: '60,122 152,120 148,146 62,148', fill: P.pale, layer: 1 },
    { pts: '170,116 192,120 190,136 168,134', fill: P.light, layer: 1 },
    { pts: '176,134 192,146 178,142', fill: TOKEN.paper0, layer: 2 },
    { pts: '140,92 148,70 160,90', fill: P.dark, layer: 0 },
    { pts: '30,116 44,110 42,128', fill: P.dark, layer: 0 },
    { pts: '66,152 62,178 76,178 78,152', fill: P.dark, layer: 0 },
    { pts: '136,152 134,178 148,178 150,152', fill: P.dark, layer: 0 },
    { circle: [188, 128, 3], fill: TOKEN.ink, noStroke: true, layer: 2 },
    eye(160, 108, 3.6),
  ],
  recipe: {
    base: 'fish',
    steps: [
      ...fishBase({ detail: 'A heavy front end and a small back end. That is a boar in one shape.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      reverseAt('snout', PT.TL, PT.BR, 0.16, 18, PT.TL, 'mountain', {
        instruction: 'Reverse the front point down into a snout.',
        detail: 'Blunt and low, pointing at the ground. It spends its whole life looking there.',
        camera: CAM.detail,
      }),
      crossFold('tusk', PT.TL, PT.BR, 0.1, -52, PT.TL, 'valley', 130, {
        instruction: 'Turn out one small point for a tusk.',
        detail: 'One. Two is a warthog and this is not one.',
        camera: CAM.detail,
      }),
      pull('legs', [crease([420, 560], [760, 720], [560, 740], 'valley', 110)], [560, 660], [560, 800], {
        instruction: 'Draw the legs down out of the body.',
        detail: 'Short. A boar’s legs disappear into it when it stands still.',
      }),
      press('set', {
        instruction: 'Press the back flat, and leave the bristles standing.',
        detail: 'Nick the top edge with a thumbnail and the fibre lifts on its own.',
        camera: CAM.desk,
      }),
    ],
  },
}
