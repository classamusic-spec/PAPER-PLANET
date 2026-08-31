/* PAPER PLANET — The Practice Sheet: reading the notation.

   The other drill trains the hand. This one trains the eye, and it is the
   half that travels: a player who can read a dash-dot line and a hollow
   arrowhead can open any origami book in any language and follow it. The
   symbols are Yoshizawa's, extended by Randlett and Harbin, unchanged since
   the 1950s. See docs/ORIGAMI.md §4.2 — that table is the source of truth for
   every meaning printed here, and the self-test reads it to check we agree.

   The questions are not written. They are found: we build real diagram plates
   from real recipes with the same `buildDiagrams` the Fold Along screen uses,
   look at what notation actually landed on each plate, and ask about that. So
   a question cannot drift from what the app draws — they are the same
   computation — and the answer is always derivable from the picture rather
   than from having read this file.

   Seeded by the date, like the fold sheet: the same six symbols for everyone
   today, six different ones tomorrow, and no server involved. */

import type { PaperMaterial } from '../../contracts'
import { SPECIES } from '../../content/species/index'
import { seededRng, type Rng } from '../../systems/rand'
import { buildDiagrams, type ArrowKind, type DiagramPlate } from '../foldalong/diagram'

/* ═══════════════════════════════════════════════════════════════════════════
   THE SYMBOLS

   Two tables. MEANINGS is what an instruction can say — one canonical line per
   meaning, so a question can never offer the same instruction twice in
   different words. SYMBOLS is how each meaning is drawn.

   They are separate because the mapping is many-to-one: a dashed line and a
   split-headed arrow are two different symbols that ask for the same thing,
   and if they were two options in the same list they would both be right.
   ═══════════════════════════════════════════════════════════════════════════ */

export type MeaningId =
  | 'valley'
  | 'mountain'
  | 'unfold'
  | 'turn'
  | 'rotate'
  | 'push'
  | 'hold'
  | 'existing'
  | 'hidden'
  | 'repeat'
  | 'equal'

/** Which questions may offer a meaning as a wrong answer. */
type MeaningFamily =
  /** Things a line can say. */
  | 'line'
  /** Things a symbol can tell your hands to do. */
  | 'action'

interface Meaning {
  id: MeaningId
  /** The answer, as it reads on a button. Short: it is read in a second. */
  line: string
  family: MeaningFamily
}

/**
 * One line per meaning, in the app's voice, saying what §4.2 says.
 *
 * `valley` and `mountain` belong to both families: a line can say them and an
 * arrow can say them, which is exactly why they are one entry each.
 */
const MEANINGS: Record<MeaningId, Meaning> = {
  valley: { id: 'valley', line: 'Fold it toward you — a valley fold.', family: 'line' },
  mountain: { id: 'mountain', line: 'Fold it away behind — a mountain fold.', family: 'line' },
  existing: { id: 'existing', line: 'A crease that is already there.', family: 'line' },
  hidden: { id: 'hidden', line: 'An edge hidden under the paper.', family: 'line' },
  unfold: { id: 'unfold', line: 'Fold it, then open it out again.', family: 'action' },
  turn: { id: 'turn', line: 'Turn the whole model over.', family: 'action' },
  /* "Same side up" is doing real work: it is the whole difference between a
     rotation and a turn-over, and without it the two answers read alike. */
  rotate: { id: 'rotate', line: 'Turn it round on the desk, same side up.', family: 'action' },
  push: { id: 'push', line: 'Push here — the paper goes inside.', family: 'action' },
  hold: { id: 'hold', line: 'Hold here, and press.', family: 'action' },
  repeat: { id: 'repeat', line: 'Do the last few steps again here.', family: 'action' },
  equal: { id: 'equal', line: 'These two lengths are equal.', family: 'action' },
}

/** Where on the plate the symbol lives, which decides how we point at it. */
export type SymbolFamily = 'line' | 'arrow' | 'mark'

export interface NotationSymbol {
  /** `line:valley`, `arrow:hold` — the drawn form, not the meaning. */
  id: string
  family: SymbolFamily
  meaning: MeaningId
  /** What it looks like. Shown in the key at the end, and read aloud as the
      picture's alt text — never in the question, which would give it away. */
  form: string
  /** One line, after the answer: why that form means that. */
  why: string
  /** The question stem. */
  ask: string
  /**
   * How soon you meet it in a book — 1 is on the first page of every book
   * ever printed. The sheet is ordered by it, so it opens on the symbol you
   * already half-know and ends on the one you have never seen.
   */
  rank: number
  /** False for the four we never draw: they exist here only as wrong answers. */
  drawn: boolean
  /**
   * False for a symbol we draw but will not ask about.
   *
   * There is exactly one, and it is a legibility judgement rather than a
   * pedagogical one: see the rotation's entry below.
   */
  askable: boolean
}

const ASK_LINE = 'One line here is not an edge of the paper. What does it ask for?'
const ASK_ARROW = 'What is this arrow asking you to do?'
const ASK_MARK = 'What is this symbol asking you to do?'

/**
 * Every symbol in §4.2, in the order that table lists them.
 *
 * The nine `drawn: true` ones are the nine this app actually puts on a plate,
 * so every one of them can be quizzed on a real picture. The four `drawn:
 * false` ones are real notation we do not happen to draw — they make honest
 * wrong answers, because they are things a reader could genuinely believe a
 * mark means, and never things this plate is saying.
 */
export const SYMBOLS: readonly NotationSymbol[] = [
  {
    id: 'line:valley',
    family: 'line',
    meaning: 'valley',
    form: 'a line of long, even dashes',
    why: 'Even dashes are a valley: the crease comes up toward you.',
    ask: ASK_LINE,
    rank: 1,
    drawn: true,
    askable: true,
  },
  {
    id: 'line:mountain',
    family: 'line',
    meaning: 'mountain',
    form: 'a dash-dot-dash line',
    why: 'Dash-dot-dash is a mountain: the crease goes away from you.',
    ask: ASK_LINE,
    rank: 3,
    drawn: true,
    askable: true,
  },
  {
    id: 'line:thin',
    family: 'line',
    meaning: 'existing',
    form: 'a thin, unbroken line',
    why: 'A thin line is a crease you already made. Nothing to do.',
    ask: ASK_LINE,
    rank: 10,
    drawn: false,
    askable: false,
  },
  {
    id: 'line:dotted',
    family: 'line',
    meaning: 'hidden',
    form: 'a dotted line',
    why: 'Dots are an x-ray: an edge that is really underneath.',
    ask: ASK_LINE,
    rank: 11,
    drawn: false,
    askable: false,
  },
  {
    id: 'arrow:valley',
    family: 'arrow',
    meaning: 'valley',
    form: 'a solid arrow with a split head',
    why: 'A split head means the paper folds over toward you.',
    ask: ASK_ARROW,
    rank: 2,
    drawn: true,
    askable: true,
  },
  {
    id: 'arrow:mountain',
    family: 'arrow',
    meaning: 'mountain',
    form: 'an arrow with a hollow head',
    why: 'A hollow head means the paper goes behind.',
    ask: ASK_ARROW,
    rank: 4,
    drawn: true,
    askable: true,
  },
  {
    id: 'arrow:unfold',
    family: 'arrow',
    meaning: 'unfold',
    form: 'a hollow arrow with a head at each end',
    why: 'Two heads, one each way: fold it, then open it again.',
    ask: ASK_ARROW,
    rank: 5,
    drawn: true,
    askable: true,
  },
  {
    id: 'arrow:turn',
    family: 'arrow',
    meaning: 'turn',
    form: 'an arrow with a loop in its stem',
    why: 'The loop in the stem turns the whole model over.',
    ask: ASK_ARROW,
    rank: 8,
    drawn: true,
    askable: true,
  },
  {
    id: 'arrow:rotate',
    family: 'mark',
    meaning: 'rotate',
    form: 'a fraction inside a circle',
    why: 'A fraction in a circle: turn the model that far round.',
    ask: ASK_MARK,
    rank: 9,
    drawn: true,
    /*
     * Drawn, and not asked about.
     *
     * The renderer sizes the circled fraction from the step's hint span, and a
     * rotation's hint is not the size of anything — on both plates in the
     * corpus that carry one it comes out about fifteen pixels across on a
     * phone, with the 1 and the 4 overlapping the stroke between them. Nobody
     * can read that, and a question you cannot answer by looking is a question
     * that punishes the reader for reading. The symbol still belongs in the
     * table: it is real notation, it is offered as a wrong answer, and the day
     * Diagram sizes it from the model rather than the hint this flips to true.
     */
    askable: false,
  },
  {
    id: 'arrow:push',
    family: 'arrow',
    meaning: 'push',
    form: 'an arrow with a hollow stem',
    why: 'A hollow stem is a push: the paper sinks inside itself.',
    ask: ASK_ARROW,
    rank: 7,
    drawn: true,
    askable: true,
  },
  {
    id: 'arrow:hold',
    family: 'mark',
    meaning: 'hold',
    form: 'two open circles',
    why: 'An open circle is a fingertip: hold there while you press.',
    ask: ASK_MARK,
    rank: 6,
    drawn: true,
    askable: true,
  },
  {
    id: 'mark:repeat',
    family: 'mark',
    meaning: 'repeat',
    form: 'a leader with hatch marks across it',
    why: 'One hatch per step: do that many steps again, here.',
    ask: ASK_MARK,
    rank: 12,
    drawn: false,
    askable: false,
  },
  {
    id: 'mark:equal',
    family: 'mark',
    meaning: 'equal',
    form: 'matched tick marks',
    why: 'Matched ticks say two distances are the same. Measure by eye.',
    ask: ASK_MARK,
    rank: 13,
    drawn: false,
    askable: false,
  },
]

export function symbolById(id: string): NotationSymbol | undefined {
  return SYMBOLS.find((s) => s.id === id)
}

export function meaningLine(id: MeaningId): string {
  return MEANINGS[id].line
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINDING QUESTIONS IN REAL DIAGRAMS
   ═══════════════════════════════════════════════════════════════════════════ */

/** The engine wants real colours; the SVG is dyed with tokens at render time. */
const PROBE_PAPER: PaperMaterial = { front: '#E4664F', back: '#F6EFE2' }

/**
 * How much of the plate a symbol has to cover before we will ask about it.
 *
 * A fold line is read by its dash pattern, and a mountain's pattern is 62
 * drawing units long; below about a sixth of the plate there is not a whole
 * pattern to look at, and the question stops being about reading and starts
 * being about eyesight.
 *
 * The arrow bar is doing more work than it looks. An arrow is drawn between
 * the step's two hint anchors, and a fold that carries one anchor onto the
 * other — folding in half is the classic — leaves both at the same point, so
 * the arrow has no length at all and the plate shows a head-sized smudge or
 * nothing. Eighteen of the corpus's twenty-two mountain arrows are like that.
 * Anything under a twelfth of the plate is one of them.
 */
const MIN_CREASE = 0.16
const MIN_ARROW = 0.08

export interface PlateCandidate {
  symbol: NotationSymbol
  speciesId: string
  speciesName: string
  plate: DiagramPlate
  /** The plate's own box, cropped from the sequence's shared one. */
  viewBox: string
  /** Every meaning that is true of this plate — the ambiguity guard. */
  truths: readonly MeaningId[]
}

/**
 * Which meaning an arrow carries.
 *
 * The seven `ArrowKind`s are named after their meanings, so this is an
 * identity — but it is written down rather than assumed, because the day a
 * new arrow is added to the renderer this line is where the compiler will
 * stop and ask what it means.
 */
function arrowMeaning(kind: ArrowKind): MeaningId {
  return kind
}

/** The side of a square viewBox, in drawing units. */
function viewBoxSide(viewBox: string): number {
  const n = viewBox.split(/\s+/).map(Number)
  return n.length === 4 && Number.isFinite(n[2]) ? n[2] : 1000
}

/**
 * A box around this plate alone.
 *
 * A book fixes one scale across a whole sequence, so the reader can watch the
 * paper get smaller as it folds — `buildDiagrams` does exactly that, and Fold
 * Along is right to use it. Here there is no sequence: one plate, on its own,
 * and the thing being read is a dash pattern about forty units long. Framing
 * that plate to the union of every state of the model would draw the symbol at
 * half the size for no reader benefit.
 *
 * Cropping does not touch the notation — same drawing, same proportions, more
 * of the card. The box takes in the paper, the fold line, the marks, and a
 * region around the arrow big enough for the parts the renderer derives from
 * the arrow's own span: a head up to 0.22 of it, a curve that bulges by up to
 * 0.19 of it, and the circles a hold or a rotation draws.
 */
export function tightViewBox(plate: DiagramPlate, fallback: string): string {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const eat = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }

  for (const f of plate.facets) {
    for (const pair of f.pts.split(' ')) {
      const [px, py] = pair.split(',')
      eat(Number(px), Number(py))
    }
  }
  if (plate.crease) {
    eat(plate.crease.from[0], plate.crease.from[1])
    eat(plate.crease.to[0], plate.crease.to[1])
  }
  for (const m of plate.marks) eat(m[0], m[1])
  if (plate.arrow) {
    const a = plate.arrow
    const span = Math.hypot(a.to[0] - a.from[0], a.to[1] - a.from[1])
    /* What the renderer adds around the two endpoints it is given: a head half
       as wide as its own size, which is capped at 64 units; a curve that bows
       out by about a fifth of the span; and, for a hold, a circle of about 32
       units at each end. Generous enough to hold all three, tight enough that
       a model folded small is not left swimming in its own frame. */
    const reach = span * 0.2 + 34
    for (const p of [a.from, a.to]) {
      eat(p[0] - reach, p[1] - reach)
      eat(p[0] + reach, p[1] + reach)
    }
  }
  if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return fallback

  // Square, so the plate sits the same way up as every other plate, plus air.
  const side = Math.max(x1 - x0, y1 - y0) * 1.06
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return `${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`
}

/**
 * Everything on one plate that can honestly be asked about.
 *
 * Three ways a plate is turned down:
 *
 * - It is not the flat, straight-down view. A book turns its viewpoint when a
 *   model stands on its edge, and reading notation off a three-quarter view is
 *   a harder, different skill than the one this drill teaches.
 * - Its symbols contradict each other. Four plates in the corpus carry a
 *   mountain fold line under a solid valley arrow, because the arrow is chosen
 *   from the step's kind and the line from its crease. A reader answering
 *   either symbol correctly would be told they were wrong, which is worse than
 *   asking nothing.
 * - The symbol is too small on the page to read.
 */
export function plateCandidates(
  plate: DiagramPlate,
  viewBox: string,
  speciesId: string,
  speciesName: string,
): PlateCandidate[] {
  const out: PlateCandidate[] = []
  // The trailing plate is the finished model: a picture, with no instruction.
  if (plate.step === null) return out
  if (plate.view !== 'flat') return out

  const side = viewBoxSide(viewBox)
  const arrow = plate.arrow
  const crease = plate.crease

  const directional = arrow && (arrow.kind === 'valley' || arrow.kind === 'mountain')
  if (directional && crease && arrow.kind !== crease.direction) return out

  const truths: MeaningId[] = []
  if (arrow) truths.push(arrowMeaning(arrow.kind))
  if (crease && !truths.includes(crease.direction)) truths.push(crease.direction)

  const box = tightViewBox(plate, viewBox)
  const add = (id: string): void => {
    const symbol = symbolById(id)
    if (!symbol || !symbol.askable) return
    out.push({ symbol, speciesId, speciesName, plate, viewBox: box, truths })
  }

  if (crease) {
    const len = Math.hypot(crease.to[0] - crease.from[0], crease.to[1] - crease.from[1])
    if (len >= side * MIN_CREASE) add('line:' + crease.direction)
  }
  if (arrow) {
    const span = Math.hypot(arrow.to[0] - arrow.from[0], arrow.to[1] - arrow.from[1])
    if (span >= side * MIN_ARROW) add('arrow:' + arrow.kind)
  }
  return out
}

/** Diagram sets are not cheap to build. One per species, kept. */
const sets = new Map<string, PlateCandidate[]>()

/** Every question a species can pose. */
export function speciesCandidates(speciesId: string): PlateCandidate[] {
  const cached = sets.get(speciesId)
  if (cached) return cached
  const species = SPECIES.find((s) => s.id === speciesId)
  if (!species) return []
  const set = buildDiagrams(species.recipe, PROBE_PAPER)
  const out: PlateCandidate[] = []
  for (const plate of set.plates) {
    out.push(...plateCandidates(plate, set.viewBox, species.id, species.name))
  }
  sets.set(speciesId, out)
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY'S SHEET
   ═══════════════════════════════════════════════════════════════════════════ */

/** Six symbols. About thirty seconds, which is the whole idea. */
export const QUESTIONS = 6

/**
 * How many models we open before we start hoping.
 *
 * Building a species' diagrams runs its whole recipe through the engine —
 * about 20ms each — so this is the difference between a screen that appears
 * and a screen that hangs. Six models is normally plenty: between them they
 * carry every common symbol several times over.
 *
 * Past this point we keep opening models only while the desk is still short of
 * symbols, because a five-question sheet on a screen that promises six is a
 * worse bug than a slow one. Across two years of dates that costs an extra
 * model or two on some days and never comes up short.
 */
const ENOUGH_MODELS = 6

export interface NotationQuestion {
  symbol: NotationSymbol
  /** The question, verbatim. */
  ask: string
  /** The four options, in the order shown. Exactly one is the answer. */
  options: readonly MeaningId[]
  answer: MeaningId
  /** The picture: a real plate from a real recipe. */
  plate: DiagramPlate
  viewBox: string
  speciesId: string
  speciesName: string
  /** Which plate of that model, as a book would number it. */
  plateNumber: number
}

function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Draw `n` items, each item's chance proportional to its weight.
 *
 * Weight is how many plates in the corpus carry that symbol, capped: a symbol
 * you meet on every page should come up more often than one you meet twice in
 * a book, but not so much more that the rare ones never appear. Without the
 * cap the valley fold — 128 plates against the rotation's 2 — would fill the
 * sheet every day and there would be nothing left to learn.
 */
function weightedDraw<T>(items: readonly T[], weight: (t: T) => number, n: number, rng: Rng): T[] {
  const pool = items.slice()
  const out: T[] = []
  while (out.length < n && pool.length > 0) {
    let total = 0
    for (const p of pool) total += Math.max(1, weight(p))
    let roll = rng() * total
    let at = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      roll -= Math.max(1, weight(pool[i]))
      if (roll <= 0) {
        at = i
        break
      }
    }
    out.push(pool[at])
    pool.splice(at, 1)
  }
  return out
}

/**
 * The most weight any one symbol can carry, in plates.
 *
 * Four symbols in the corpus are drawn on dozens of plates each and the rest
 * on a handful; uncapped, the four would fill every sheet forever. Capped low
 * enough that a rarer symbol has a real chance and high enough that a valley
 * fold still turns up far more often than a rotation, which is also how often
 * you meet them in a book.
 */
const WEIGHT_CAP = 8

/**
 * Today's sheet.
 *
 * Six different symbols — never the same one twice, because six questions is
 * not enough room to repeat yourself — each on a plate from a different model
 * where the corpus allows it. Ordered by how soon you meet the symbol in a
 * book, so the sheet opens on something you probably know.
 */
export function notationQuiz(dateKey: string, count = QUESTIONS): NotationQuestion[] {
  const rng = seededRng(`paper-planet/notation/${dateKey}`)

  /* Walk the models in a shuffled order, opening one at a time, and stop as
     soon as there is enough on the desk: enough distinct symbols to fill the
     sheet, and enough models that no two questions need share one. */
  const bySymbol = new Map<string, PlateCandidate[]>()
  const opened: string[] = []
  for (const species of shuffle(SPECIES, rng)) {
    /* One more symbol than the sheet needs, so the draw has something to leave
       out. Stopping at exactly six would mean the six commonest symbols were
       the only ones on the desk and the "choice" would choose all of them —
       the same sheet every day, with different pictures. */
    const enoughSymbols = bySymbol.size >= count + 1
    if (enoughSymbols && opened.length >= Math.min(count, ENOUGH_MODELS)) break
    const found = speciesCandidates(species.id)
    if (found.length === 0) continue
    opened.push(species.id)
    for (const c of found) {
      const list = bySymbol.get(c.symbol.id)
      if (list) list.push(c)
      else bySymbol.set(c.symbol.id, [c])
    }
  }
  if (bySymbol.size === 0) return []

  const available = [...bySymbol.keys()]
    .map((id) => symbolById(id))
    .filter((s): s is NotationSymbol => s !== undefined)

  const chosen = weightedDraw(
    available,
    (s) => Math.min(WEIGHT_CAP, bySymbol.get(s.id)?.length ?? 1),
    Math.min(count, available.length),
    rng,
  )

  /* A sheet that never shows a fold line, or never shows an arrow, has taught
     half the alphabet. If the draw managed that, swap its least-weighted pick
     for one of the missing kind. */
  const poolSize = (s: NotationSymbol): number => bySymbol.get(s.id)?.length ?? 0
  const ensure = (want: (s: NotationSymbol) => boolean): void => {
    if (chosen.some(want)) return
    const options = available.filter((s) => want(s) && !chosen.includes(s))
    if (options.length === 0) return
    /* Drop the commonest of the kind we already have too much of — never one
       the other `ensure` just put there, which is why the candidates for
       dropping are filtered before the smallest is found rather than after. */
    const droppable = chosen.filter((s) => !want(s))
    if (droppable.length === 0) return
    const drop = droppable.reduce((a, b) => (poolSize(b) > poolSize(a) ? b : a))
    chosen[chosen.indexOf(drop)] = options[Math.floor(rng() * options.length)]
  }
  ensure((s) => s.family === 'line')
  ensure((s) => s.family !== 'line')

  chosen.sort((a, b) => a.rank - b.rank)

  const usedSpecies = new Set<string>()
  const out: NotationQuestion[] = []
  for (const symbol of chosen) {
    const pool = shuffle(bySymbol.get(symbol.id) ?? [], rng)
    if (pool.length === 0) continue
    // A different model each time where one exists — six pictures, not one
    // model six times — but never at the cost of dropping a symbol.
    const pick = pool.find((c) => !usedSpecies.has(c.speciesId)) ?? pool[0]
    usedSpecies.add(pick.speciesId)
    out.push({
      symbol,
      ask: symbol.ask,
      options: optionsFor(symbol, pick.truths, rng),
      answer: symbol.meaning,
      plate: pick.plate,
      viewBox: pick.viewBox,
      speciesId: pick.speciesId,
      speciesName: pick.speciesName,
      plateNumber: pick.plate.n,
    })
  }
  return out
}

/**
 * Build today's models ahead of the tap, one per tick.
 *
 * Assembling a sheet costs about 150ms of engine time, which is invisible if
 * it happens while somebody is reading the two cards on the practice desk and
 * very visible if it happens between their tap and the screen. One model per
 * timeout keeps each slice near a frame, so the warm-up never shows up as a
 * stutter in the transition it is hiding behind.
 *
 * The order is the same seeded shuffle the sheet itself walks, so the models
 * warmed are exactly the models opened. Returns its own cancel.
 */
export function warmNotation(dateKey: string, models = ENOUGH_MODELS): () => void {
  const order = shuffle(SPECIES, seededRng(`paper-planet/notation/${dateKey}`)).slice(0, models)
  let at = 0
  let timer = 0
  const step = (): void => {
    if (at >= order.length) return
    speciesCandidates(order[at++].id)
    timer = window.setTimeout(step, 16)
  }
  timer = window.setTimeout(step, 0)
  return () => window.clearTimeout(timer)
}

/** How many answers a question offers. Four is a book page, not an exam. */
export const OPTIONS = 4

/**
 * The four answers.
 *
 * The rule that matters: a wrong answer must be wrong about THIS plate, not
 * merely different from the answer. So every meaning the plate actually
 * carries is struck out of the distractor pool first — otherwise a plate whose
 * dashed line is crossed by a fold-and-unfold arrow would offer "fold it
 * toward you" as a wrong answer while the line says exactly that, and a reader
 * who read it correctly would be marked down.
 *
 * The pool is also kept to the same family as the question. "A crease that is
 * already there" is a thing a line can say and a thing no arrow has ever said,
 * so offering it against an arrow is not a plausible wrong answer, it is
 * filler.
 */
export function optionsFor(
  symbol: NotationSymbol,
  truths: readonly MeaningId[],
  rng: Rng,
  count = OPTIONS,
): MeaningId[] {
  const family: MeaningFamily = symbol.family === 'line' ? 'line' : 'action'
  const pool = (Object.keys(MEANINGS) as MeaningId[]).filter(
    (id) =>
      id !== symbol.meaning &&
      MEANINGS[id].family === family &&
      !truths.includes(id),
  )
  const options = [symbol.meaning, ...shuffle(pool, rng).slice(0, count - 1)]
  return shuffle(options, rng)
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE GRADE

   The same promise the fold sheet makes: the lowest band is "keep going", and
   nothing here tells you that you failed. A symbol you did not know is a
   symbol you now know, which is the entire point of a thirty-second quiz.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ReadGrade {
  label: string
  note: string
  tone: 'clean' | 'close' | 'rough'
}

export function readGrade(right: number, total: number): ReadGrade {
  const share = total > 0 ? right / total : 0
  if (share >= 0.999) {
    return {
      label: 'Fluent',
      note: 'You can read a page now. Any book, any language.',
      tone: 'clean',
    }
  }
  if (share >= 0.8) {
    return { label: 'Nearly', note: 'One symbol away. It will stick next time.', tone: 'close' }
  }
  if (share >= 0.5) {
    return { label: 'Getting it', note: 'Half the alphabet is most of the way there.', tone: 'close' }
  }
  return { label: 'Keep going', note: 'Six more tomorrow. Nobody was born reading these.', tone: 'rough' }
}

/** What the record stores: a share, so it compares with any sheet length. */
export function quizScore(right: number, total: number): number {
  return total > 0 ? right / total : 0
}
