/* PAPER PLANET — the Dino. Two long points at opposite corners: the fish base's whole purpose. */

import { CODEX } from '../codex'
import { eye, sclera } from '../art'
import { TOKEN, hue, mix, tint } from '../palette'
import { CAM, PT, crossFold, fishBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const D = hue(mix(TOKEN.matcha, TOKEN.kincha, 0.38))

export const dino: SpeciesDef = {
  id: 'dino',
  name: 'Dino',
  binomial: 'Papyrosaurus minimus',
  biome: 'peak',
  rarity: 'mythic',
  material: { front: D.base, back: TOKEN.paperBack },
  chirp: [0.5, 0.667, 0.5, 0.375],
  idle: 'walk',
  reward: 80,
  unlock: { type: 'goldleaf', cost: 60 },
  meta: { tier: 'grand', surface: 'ground', scale: 1.34, altitude: 0.04 },
  codex: CODEX.dino,
  art: [
    { pts: '56,116 18,132 26,108', fill: D.base, layer: 0 },
    { pts: '72,82 78,62 88,78', fill: D.dark, layer: 0 },
    { pts: '94,76 102,56 112,74', fill: D.dark, layer: 0 },
    { pts: '116,74 126,56 134,80', fill: D.dark, layer: 0 },
    { pts: '56,84 120,70 150,100 140,146 70,146', fill: D.base, layer: 1 },
    { pts: '124,98 142,140 100,142', fill: tint(TOKEN.matcha, 0.7), layer: 1 },
    { pts: '128,108 142,116 130,122', fill: D.dark, layer: 1 },
    { pts: '80,146 76,170 94,170 96,146', fill: D.dark, layer: 0 },
    { pts: '116,146 114,170 132,170 134,146', fill: D.dark, layer: 0 },
    { pts: '128,52 168,48 178,76 146,92', fill: D.base, layer: 1 },
    { pts: '146,92 178,76 174,92 148,100', fill: D.light, layer: 1 },
    { circle: [170, 60, 2], fill: TOKEN.ink, noStroke: true, layer: 2 },
    sclera(156, 64, 6),
    eye(157, 65, 3),
  ],
  recipe: {
    base: 'fish',
    steps: [
      ...fishBase({ detail: 'Two long points at opposite ends. One is a neck, one is a tail, and that is a dinosaur.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      reverseAt('neck', PT.TL, PT.BR, 0.24, -34, PT.TL, 'mountain', {
        instruction: 'Reverse the front point up for the neck.',
        detail: 'High and back over the shoulders. There is a lot of animal balanced on those hips.',
        camera: CAM.close,
      }),
      reverseAt('head', PT.TL, PT.BR, 0.1, 38, PT.TL, 'valley', {
        instruction: 'Reverse the tip forward into a head.',
        camera: CAM.detail,
      }),
      reverseAt('jaw', PT.TL, PT.BR, 0.04, -20, PT.TL, 'mountain', {
        instruction: 'One more, tiny, to open the jaw.',
        detail: 'Slightly open. Fully open is a cartoon.',
        camera: CAM.detail,
      }),
      reverseAt('tail', PT.TL, PT.BR, 0.84, 24, PT.BR, 'mountain', {
        instruction: 'Reverse the back point down and out for the tail.',
        detail: 'It should reach as far behind as the neck reaches in front. That is how it stands up.',
        camera: CAM.close,
      }),
      crossFold('spine-a', PT.TL, PT.BR, 0.4, 60, [520, 300], 'valley', 120, {
        instruction: 'Turn out a row of small points along the back.',
        detail: 'Pinch and pull each one. Three is plenty.',
        effort: 3,
      }),
      crossFold('spine-b', PT.TL, PT.BR, 0.52, 60, [640, 420], 'valley', 120, {
        instruction: 'And a second row, a little smaller.',
        effort: 3,
      }),
      pull('leg-near', [crease([460, 600], [760, 720], [600, 760], 'valley', 120)], [600, 680], [600, 820], {
        instruction: 'Draw the near leg down out of the body.',
        detail: 'Thick at the top, thin at the foot.',
      }),
      pull('leg-far', [crease([440, 620], [740, 740], [560, 780], 'mountain', 120)], [560, 700], [560, 840], {
        instruction: 'And the far leg to match.',
        detail: 'Stand it as you go — it will tell you when the legs are right.',
      }),
      press('set', {
        instruction: 'Press the feet flat until it stands on its own.',
        detail: 'Tail down for balance. Every child who has folded this has discovered that themselves.',
        camera: CAM.desk,
      }),
    ],
  },
}
