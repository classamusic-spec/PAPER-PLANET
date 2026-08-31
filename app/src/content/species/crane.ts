/* PAPER PLANET — the Crane. Kite base, folded in half, neck and head reversed out. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, shade } from '../palette'
import { CAM, PT, SQ, kiteBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const B = hue(TOKEN.beni)

export const crane: SpeciesDef = {
  id: 'crane',
  name: 'Crane',
  binomial: 'Grus papyracea',
  biome: 'meadow',
  rarity: 'uncommon',
  material: { front: B.base, back: TOKEN.paperBack },
  chirp: [1, 1.5, 1.335],
  idle: 'stand',
  reward: 26,
  unlock: { type: 'free' },
  meta: { tier: 'classic', surface: 'ground', scale: 1.16, altitude: 0.06, flock: ['heron', 'orizuru'] },
  codex: CODEX.crane,
  art: [
    { pts: '132,92 178,52 146,112', fill: B.dark, layer: 0 },
    { pts: '76,104 128,28 136,96', fill: B.dark, layer: 0 },
    { pts: '92,132 96,168 102,132', fill: shade(TOKEN.beni, 0.45), layer: 0 },
    { pts: '108,132 114,166 118,130', fill: shade(TOKEN.beni, 0.45), layer: 0 },
    { pts: '68,100 134,92 112,134 72,132', fill: B.base, layer: 1 },
    { pts: '70,102 44,42 88,94', fill: B.light, layer: 1 },
    { pts: '44,42 26,52 54,60', fill: B.base, layer: 1 },
    { pts: '28,50 12,56 32,60', fill: TOKEN.kincha, layer: 2 },
    eye(40, 48, 3.5),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'A kite. The long point down there is going to be a neck.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold the whole kite in half, away from you.',
        detail: 'The two folded edges go together, and the model stands on its side.',
        camera: CAM.side,
      }),
      reverseAt('neck', PT.TL, PT.BR, 0.7, -16, PT.BR, 'mountain', {
        instruction: 'Tap the point, then push it up between the layers.',
        detail: 'An inside reverse fold. The point does not travel — it turns inside out and comes back the other way.',
        camera: CAM.close,
      }),
      reverseAt('head', PT.TL, PT.BR, 0.92, 24, PT.BR, 'valley', {
        instruction: 'The same again at the tip, the other way, for the head.',
        detail: 'Small. A crane’s head is a quarter the length of its beak.',
        camera: CAM.detail,
      }),
      pull(
        'wing',
        // From the apex of the half-fold, out past the shoulder. The hinge has
        // to START on the spine: a wing crease that cuts ACROSS the spine drags
        // the body fold along with the wing and the bird comes apart.
        [crease(PT.TL, [SQ, 620], [900, 300], 'valley', 100)],
        [600, 300],
        [640, 180],
        {
          instruction: 'Draw the near wing up and out.',
          detail: 'Only until it feels tight. Paper tells you where a wing stops.',
        },
      ),
      press('set', {
        instruction: 'Press the whole bird flat under your palm, then let go.',
        detail: 'It will open a little as it settles. That is the crane deciding how it wants to stand.',
        camera: CAM.desk,
      }),
    ],
  },
}
