// PAPER PLANET — the sound vocabulary. Prompts, variant counts and loudness targets.

/**
 * Every prompt ends with DRY so the generator gives us close-mic'd, roomless
 * material. BRAND.md §8: "Sounds are close-mic'd and dry — you are 15cm from
 * the paper." Anything with a tail baked in can never be placed in our own room.
 */
const DRY = 'close mic ASMR, dry, isolated, mono, no music, no reverb, no room, no voices'
const DRY_ROOM = 'close mic, natural, no music, no voices'

/** Per-family loudness so cues sit consistently against each other. */
export const FAMILY_TARGETS = {
  crease: -21,
  fold: -21,
  sheet: -22,
  press: -20,
  ui: -24,
  alive: -23,
  reward: -20,
  texture: -22,
  ambience: -27,
}

/**
 * kind:
 *   oneshot   — trimmed, faded, short
 *   texture   — continuous granular source, loop-crossfaded, no internal silence
 *   ambience  — long bed, loop-crossfaded, low target level
 */
export const SPEC = [
  /* ── Crease ───────────────────────────────────────────────────────────── */
  { id: 'crease.soft', family: 'crease', kind: 'oneshot', variants: 4, duration: 1.0,
    prompt: `soft gentle paper crease being folded slowly by fingertips, thin washi origami paper, single quiet crease, ${DRY}` },
  { id: 'crease.crisp', family: 'crease', kind: 'oneshot', variants: 4, duration: 1.0,
    isolate: { preMs: 26, postMs: 520 },
    prompt: `one crisp sharp paper crease snapping into a fold, thin origami paper, single decisive crease, ${DRY}` },
  { id: 'crease.set', family: 'crease', kind: 'oneshot', variants: 2, duration: 1.0,
    prompt: `a fingernail burnishing a paper fold flat, short firm press along a crease, ${DRY}` },

  /* ── Fold ─────────────────────────────────────────────────────────────── */
  { id: 'fold.valley', family: 'fold', kind: 'oneshot', variants: 3, duration: 1.2,
    prompt: `folding a sheet of origami paper toward you, one smooth paper sweep ending in a soft crease, ${DRY}` },
  { id: 'fold.mountain', family: 'fold', kind: 'oneshot', variants: 3, duration: 1.2,
    prompt: `folding a sheet of origami paper away from you, paper turning over into a low crease, ${DRY}` },
  { id: 'fold.reverse', family: 'fold', kind: 'oneshot', variants: 2, duration: 1.2,
    prompt: `pushing a paper flap inside out, small collapsing paper crackle, reverse fold, ${DRY}` },
  { id: 'fold.petal', family: 'fold', kind: 'oneshot', variants: 2, duration: 1.4,
    prompt: `lifting a paper point and flattening the sides, layered origami paper shifting and creasing, ${DRY}` },
  { id: 'fold.squash', family: 'fold', kind: 'oneshot', variants: 2, duration: 1.2,
    prompt: `squashing a paper pocket flat with a thumb, soft paper collapse then press, ${DRY}` },

  /* ── Sheet ────────────────────────────────────────────────────────────── */
  { id: 'sheet.slide', family: 'sheet', kind: 'oneshot', variants: 4, duration: 1.2,
    prompt: `a sheet of paper sliding across a smooth wooden desk, short even slide, ${DRY}` },
  { id: 'sheet.flip', family: 'sheet', kind: 'oneshot', variants: 3, duration: 1.0,
    prompt: `flipping a sheet of paper over, quick paper whoosh then it lands, ${DRY}` },
  { id: 'sheet.lift', family: 'sheet', kind: 'oneshot', variants: 2, duration: 1.0,
    prompt: `lifting a single sheet of paper off a wooden desk, soft peel and air, ${DRY}` },
  { id: 'sheet.settle', family: 'sheet', kind: 'oneshot', variants: 3, duration: 1.3,
    prompt: `a sheet of paper landing and settling on a wooden desk, soft flutter then rest, ${DRY}` },
  { id: 'sheet.pickup', family: 'sheet', kind: 'oneshot', variants: 2, duration: 1.0,
    prompt: `picking up a sheet of paper between two fingers, light paper rustle, ${DRY}` },

  /* ── Press ────────────────────────────────────────────────────────────── */
  { id: 'press.flatten', family: 'press', kind: 'oneshot', variants: 2, duration: 1.3,
    prompt: `pressing a folded paper model flat with the palm, firm compression of layered paper, ${DRY}` },
  { id: 'press.release', family: 'press', kind: 'oneshot', variants: 2, duration: 1.2,
    prompt: `releasing pressure from folded paper, the paper springing back with a soft crackle, ${DRY}` },

  /* ── UI ───────────────────────────────────────────────────────────────── */
  { id: 'ui.tap', family: 'ui', kind: 'oneshot', variants: 4, duration: 0.6,
    isolate: { preMs: 14, postMs: 190 },
    prompt: `a single soft fingertip tap on thick paper card, one short dry tick, ${DRY}` },
  { id: 'ui.back', family: 'ui', kind: 'oneshot', variants: 2, duration: 0.8,
    prompt: `a small paper card sliding back into a stack, short soft paper slide, ${DRY}` },
  { id: 'ui.confirm', family: 'ui', kind: 'oneshot', variants: 2, duration: 1.0,
    prompt: `one warm wooden kalimba note with a soft paper tap, gentle and low, ${DRY}` },
  { id: 'ui.open', family: 'ui', kind: 'oneshot', variants: 2, duration: 0.9,
    prompt: `a folded paper card opening, soft short unfolding paper, ${DRY}` },
  { id: 'ui.close', family: 'ui', kind: 'oneshot', variants: 2, duration: 0.8,
    isolate: { preMs: 20, postMs: 300 },
    prompt: `a folded paper card closing softly, short paper fold shut, ${DRY}` },
  { id: 'ui.toggle', family: 'ui', kind: 'oneshot', variants: 2, duration: 0.6,
    isolate: { preMs: 14, postMs: 200 },
    prompt: `a small wooden toggle click against paper, one soft dry tick, ${DRY}` },

  /* ── Life ─────────────────────────────────────────────────────────────── */
  { id: 'alive.breath', family: 'alive', kind: 'oneshot', variants: 2, duration: 1.8,
    prompt: `a very soft slow breath of air moving through paper, gentle papery swell, ${DRY}` },
  { id: 'alive.happy', family: 'alive', kind: 'oneshot', variants: 2, duration: 1.4,
    variantHints: ['low warm single tine', 'two quick higher tines rising'],
    prompt: `a tiny warm wooden music box note with a soft paper flutter, bright and gentle, ${DRY}` },
  { id: 'alive.nuzzle', family: 'alive', kind: 'oneshot', variants: 2, duration: 1.2,
    prompt: `soft paper rubbing gently against paper, small affectionate rustle, ${DRY}` },

  /* ── Reward ───────────────────────────────────────────────────────────── */
  { id: 'reward.sheets', family: 'reward', kind: 'oneshot', variants: 2, duration: 1.3,
    prompt: `a small stack of paper sheets being riffled with a thumb, soft dry paper shuffle, ${DRY}` },
  { id: 'reward.goldleaf', family: 'reward', kind: 'oneshot', variants: 2, duration: 1.6,
    prompt: `delicate gold leaf foil crinkling, very thin metallic paper shimmer, ${DRY}` },
  { id: 'reward.mastery', family: 'reward', kind: 'oneshot', variants: 1, duration: 2.6,
    prompt: `a warm wooden music box chord resolving with a soft paper flutter, gentle, ${DRY}` },
  { id: 'reward.unlock', family: 'reward', kind: 'oneshot', variants: 1, duration: 2.0,
    prompt: `a small wooden box lid opening with a soft paper slide, warm and gentle, ${DRY}` },

  /* ── Granular textures — the ASMR core. Continuous, no gaps. ──────────── */
  { id: 'texture.rub.slow', family: 'texture', kind: 'texture', variants: 1, duration: 12,
    prompt: `slow steady rubbing of a fingertip back and forth on thick paper, continuous deep papery friction, unbroken, ${DRY}` },
  { id: 'texture.rub.fast', family: 'texture', kind: 'texture', variants: 1, duration: 12,
    prompt: `fast brisk rubbing of a fingertip on paper, continuous bright fibrous friction hiss, unbroken, ${DRY}` },
  { id: 'texture.burnish', family: 'texture', kind: 'texture', variants: 1, duration: 10,
    prompt: `continuous burnishing of a paper crease with a fingernail, steady scraping of paper fibres, unbroken, ${DRY}` },
  { id: 'texture.press.hold', family: 'texture', kind: 'texture', variants: 1, duration: 8,
    prompt: `continuous slow pressure on folded paper, faint steady creaking crackle of layered paper, unbroken, ${DRY}` },

  /* ── Ambience beds ────────────────────────────────────────────────────── */
  { id: 'amb.meadow', family: 'ambience', kind: 'ambience', variants: 1, duration: 22,
    prompt: `a quiet sunny meadow at midday, small songbirds chirping in the middle distance, soft grass and leaves in a light breeze, calm and even, continuous, no wind rumble, no low hum, ${DRY_ROOM}` },
  { id: 'amb.rain', family: 'ambience', kind: 'ambience', variants: 1, duration: 22,
    prompt: `gentle steady rain falling on a paper window, soft even patter, no thunder, calm, continuous, ${DRY_ROOM}` },
  { id: 'amb.night', family: 'ambience', kind: 'ambience', variants: 1, duration: 22,
    lowpass: 4200,
    prompt: `a calm summer night in a garden, warm low crickets chirping steadily in the middle distance, soft leaves stirring, mellow and round, continuous, no hiss, no static, no high whine, no insects close to the microphone, ${DRY_ROOM}` },
  { id: 'amb.shore', family: 'ambience', kind: 'ambience', variants: 1, duration: 22,
    prompt: `small gentle waves lapping on a quiet shore, soft distant water, no seagulls, calm, continuous, ${DRY_ROOM}` },
  { id: 'amb.tearoom', family: 'ambience', kind: 'ambience', variants: 1, duration: 22,
    prompt: `inside a traditional wooden tea house, a constant soft rustle of paper screens and a steady gentle breeze through an open door, unbroken and even throughout, never silent, warm and calm, clearly audible, continuous, no gaps, no pauses, no low hum, no rumble, ${DRY_ROOM}` },
]

/** Slight prompt_influence spread across variants keeps takes distinct in character. */
export const VARIANT_INFLUENCE = [0.7, 0.6, 0.75, 0.65]

/** Cues in the frozen contract that this spec must cover. */
export const CONTRACT_CUES = [
  'crease.soft', 'crease.crisp', 'crease.set',
  'fold.valley', 'fold.mountain', 'fold.reverse', 'fold.petal', 'fold.squash',
  'sheet.slide', 'sheet.flip', 'sheet.lift', 'sheet.settle', 'sheet.pickup',
  'press.flatten', 'press.release',
  'ui.tap', 'ui.back', 'ui.confirm', 'ui.open', 'ui.close', 'ui.toggle',
  'alive.breath', 'alive.happy', 'alive.nuzzle',
  'reward.sheets', 'reward.goldleaf', 'reward.mastery', 'reward.unlock',
]

export const AMBIENCE_IDS = ['meadow', 'rain', 'night', 'shore', 'tearoom']
