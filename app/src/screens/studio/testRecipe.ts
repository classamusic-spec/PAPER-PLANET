/* PAPER PLANET — a hand-written recipe used to exercise the engine before
   content lands. Real recipes live in src/content. */

import type { FoldRecipe } from '../../contracts'

const S = 1000

export const TEST_RECIPE: FoldRecipe = {
  base: 'kite',
  steps: [
    {
      id: 't1',
      kind: 'valley',
      gesture: 'drag',
      creases: [{ a: [0, 0], b: [S, S], side: 1, direction: 'valley', angle: 180 }],
      hint: { from: [780, 220], to: [280, 720] },
      instruction: 'Bring the corner across to meet its opposite.',
      detail: 'Take it slowly. The paper will follow your finger.',
      effort: 1,
    },
    {
      id: 't2',
      kind: 'crease',
      gesture: 'rub',
      creases: [{ a: [0, 0], b: [S, S], side: 1, direction: 'valley', angle: 0 }],
      hint: { from: [260, 260], to: [740, 740] },
      instruction: 'Rub the crease until it holds.',
      detail: 'Back and forth. Listen to it sharpen.',
      effort: 1,
    },
    {
      id: 't3',
      kind: 'valley',
      gesture: 'drag',
      creases: [{ a: [0, 500], b: [S, 500], side: -1, direction: 'valley', angle: 180 }],
      hint: { from: [500, 760], to: [500, 260] },
      instruction: 'Fold the lower edge up to the line.',
      effort: 1,
    },
    {
      id: 't4',
      kind: 'mountain',
      gesture: 'drag',
      creases: [{ a: [500, 0], b: [500, S], side: 1, direction: 'mountain', angle: 150 }],
      hint: { from: [300, 500], to: [700, 500] },
      instruction: 'Now take this one behind.',
      detail: 'A mountain fold — the crease points toward you.',
      effort: 2,
    },
    {
      id: 't5',
      kind: 'flip',
      gesture: 'swipe',
      creases: [],
      hint: { from: [300, 500], to: [720, 500] },
      instruction: 'Turn the paper over.',
      effort: 1,
    },
    {
      id: 't6',
      kind: 'press',
      gesture: 'hold',
      creases: [],
      hint: { from: [500, 500], to: [500, 500] },
      instruction: 'Press it flat and hold.',
      detail: 'The last thing you do to any fold.',
      effort: 1,
    },
  ],
}
