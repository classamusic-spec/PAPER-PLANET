/* PAPER PLANET — the notation drill's self-test.
   Run: npx tsx src/screens/drill/__selftest-notation.ts

   A quiz that marks a correct reading wrong is worse than no quiz at all, so
   most of what is checked here is that: that no question has two defensible
   answers, that every meaning printed is the meaning docs/ORIGAMI.md §4.2 gives
   (read out of the file, not from memory), that the symbol asked about is
   actually on the plate and big enough to see, and that today is the same
   sheet all day and a different one tomorrow. */

import { SPECIES } from '../../content/species/index'
import { seededRng } from '../../systems/rand'
import { buildDiagrams } from '../foldalong/diagram'
import {
  OPTIONS,
  QUESTIONS,
  SYMBOLS,
  meaningLine,
  notationQuiz,
  optionsFor,
  plateCandidates,
  quizScore,
  readGrade,
  speciesCandidates,
  symbolById,
  tightViewBox,
  type MeaningId,
  type PlateCandidate,
} from './notation'

/* The doc is read with node's own file system. The app's tsconfig carries the
   browser's types and not node's — this file is run by tsx, never bundled — so
   the specifier goes through a variable, which keeps the compiler from trying
   to resolve a module the app does not have, and the shape is named here. */
const NODE_FS = 'node:fs'
const { readFileSync } = (await import(NODE_FS)) as {
  readFileSync: (path: URL | string, encoding: 'utf8') => string
}

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const BOLD = '\x1b[1m'
const OFF = '\x1b[0m'

const failures: string[] = []
let checks = 0
function check(ok: boolean, message: string): void {
  checks++
  if (!ok) failures.push(message)
}

console.log(`\n${BOLD}reading the notation${OFF}`)

/* ═══════════════════════════════════════════════════════════════════════════
   1. THE SYMBOLS AGREE WITH THE BOOK

   docs/ORIGAMI.md §4.2 is the source of truth for what each symbol means, and
   it is a real file we can read. If somebody edits that table — or edits one
   of our strings away from it — these checks fail rather than the app quietly
   teaching a meaning nobody agreed to.
   ═══════════════════════════════════════════════════════════════════════════ */

const DOC = new URL('../../../../docs/ORIGAMI.md', import.meta.url)
const md = readFileSync(DOC, 'utf8')

/** The rows of the §4.2 table, as `symbol → meaning`. */
function docTable(): Map<string, string> {
  const out = new Map<string, string>()
  const at = md.indexOf('### 4.2')
  if (at < 0) return out
  for (const raw of md.slice(at).split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('|')) {
      if (out.size > 0) break
      continue
    }
    const cells = line.split('|').map((c) => c.trim())
    // ['', symbol, meaning, '']
    if (cells.length < 4) continue
    if (cells[1] === 'Symbol' || cells[1].startsWith('---')) continue
    out.set(cells[1].toLowerCase(), cells[2].toLowerCase())
  }
  return out
}

const rows = docTable()
check(rows.size >= 13, `§4.2 still has its symbol table (${rows.size} rows)`)

/**
 * Which row of the table each of our symbols is, and the word that has to
 * survive the trip from the table into what the player reads.
 *
 * `word` is checked in BOTH directions: the doc row must still contain it, and
 * our answer line must contain it too. So a meaning cannot drift on either
 * side without this failing.
 */
const AGAINST_DOC: readonly { id: string; row: string; word: string; also?: string }[] = [
  { id: 'line:valley', row: 'dashed line', word: 'valley', also: 'toward you' },
  { id: 'line:mountain', row: 'dash-dot line', word: 'mountain', also: 'away' },
  { id: 'line:thin', row: 'thin line', word: 'crease', also: 'already' },
  { id: 'line:dotted', row: 'dotted line', word: 'hidden' },
  { id: 'arrow:valley', row: 'split-headed arrow', word: 'valley', also: 'toward you' },
  { id: 'arrow:mountain', row: 'single hollow arrowhead, hooked', word: 'mountain', also: 'away' },
  { id: 'arrow:unfold', row: 'double-headed hollow arrow', word: 'unfold', also: 'open' },
  { id: 'arrow:turn', row: 'arrow with a loop in the stem', word: 'turn', also: 'over' },
  { id: 'arrow:rotate', row: 'fraction in a circle', word: 'rotate', also: 'round' },
  { id: 'arrow:push', row: 'hollow-stemmed arrow', word: 'push' },
  { id: 'arrow:hold', row: 'open circle', word: 'hold' },
  { id: 'mark:repeat', row: 'leader + hatch marks', word: 'repeat', also: 'again' },
  { id: 'mark:equal', row: 'matched tick marks', word: 'equal' },
]

/** Where the doc's own word is not the word a player would want to read. */
const SAID_AS: Record<string, string> = {
  // "unfold" is the doc's word; ours says what unfolding is, so the check
  // falls to `also` ("open ... again"). Same for a rotation, which we describe
  // as turning the model round rather than naming the Latin.
  unfold: 'open',
  rotate: 'turn',
  repeat: 'again',
}

for (const want of AGAINST_DOC) {
  const symbol = symbolById(want.id)
  check(!!symbol, `${want.id}: the symbol is in our table`)
  const docMeaning = rows.get(want.row)
  check(docMeaning !== undefined, `${want.id}: §4.2 still lists "${want.row}"`)
  if (!symbol || docMeaning === undefined) continue

  check(
    docMeaning.includes(want.word),
    `${want.id}: §4.2 still says "${want.word}" for that symbol — if the doc changed, so must we`,
  )
  const said = meaningLine(symbol.meaning).toLowerCase()
  const needle = SAID_AS[want.word] ?? want.word
  check(said.includes(needle), `${want.id}: what the player reads carries "${needle}", as §4.2 does`)
  if (want.also) {
    check(said.includes(want.also), `${want.id}: and "${want.also}", so the meaning is not half-said`)
  }
  check(symbol.form.length > 6, `${want.id}: the symbol's drawn form is described, for the key and the alt text`)
  check(symbol.why.length > 12, `${want.id}: and there is a line saying why the drawing means that`)
  check(/[a-z]/.test(symbol.why) && symbol.why.endsWith('.'), `${want.id}: the why line is a sentence`)
}

check(
  SYMBOLS.length === AGAINST_DOC.length,
  `we teach exactly the symbols §4.2 lists — no inventions (${SYMBOLS.length} of ${AGAINST_DOC.length})`,
)
check(new Set(SYMBOLS.map((s) => s.id)).size === SYMBOLS.length, 'no symbol is listed twice')
check(
  new Set(SYMBOLS.map((s) => s.rank)).size === SYMBOLS.length,
  'every symbol has its own place in the order, so the sheet sorts the same way every time',
)
for (const s of SYMBOLS) {
  check(s.ask.length > 12 && s.ask.endsWith('?'), `${s.id}: the question is a question`)
  /* The stem may point at the symbol — "this arrow", "one line here" — but it
     must never describe the part that carries the meaning. Naming the head or
     the dash pattern would answer the question for anyone who has read the
     table, and the picture would be decoration. */
  const TELLS = /dash|dot|split|hollow|loop|fraction|circle|stem|head|tick|hatch|thin|unbroken/i
  check(!TELLS.test(s.ask), `${s.id}: the question does not describe the symbol, only points at it`)
  check(TELLS.test(s.form), `${s.id}: the form, which is not shown in the question, does describe it`)
  check(!/undefined|null|NaN/.test(s.form + s.why + s.ask), `${s.id}: no debris in anything shown`)
}

/* Nothing anywhere in the vocabulary tells a player they failed. The fold
   sheet holds itself to this and so does this one: a symbol you did not know
   is a symbol you now know. */
const VOICE = SYMBOLS.map((s) => s.why + ' ' + s.ask).join(' ') +
  ' ' +
  ([0, 1, 2, 3, 4, 5, 6].map((n) => readGrade(n, 6).label + ' ' + readGrade(n, 6).note).join(' ')) +
  ' ' +
  (Object.keys({}) as MeaningId[]).join(' ')
check(!/\bfail|\bwrong\b|\bbad\b|poor|incorrect|error/i.test(VOICE), 'nothing in the copy scolds')

/* Two answers that read alike are as unfair as two answers that are both true.
   Every pair of meanings has to differ by more than a word or two. */
{
  const lines = SYMBOLS.map((s) => meaningLine(s.meaning))
  const words = (t: string): Set<string> =>
    new Set(t.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2))
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i] === lines[j]) continue
      const a = words(lines[i])
      const b = words(lines[j])
      let shared = 0
      for (const w of a) if (b.has(w)) shared++
      const overlap = shared / Math.min(a.size, b.size)
      check(
        overlap < 0.75,
        `"${lines[i]}" and "${lines[j]}" do not read as the same sentence (${overlap.toFixed(2)})`,
      )
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. EVERY QUESTION IS ABOUT SOMETHING REALLY ON THE PLATE

   The whole corpus, plate by plate. These are the checks that catch a question
   asking about an arrow that is not there, or one drawn too small to read, or
   a plate whose own two symbols disagree.
   ═══════════════════════════════════════════════════════════════════════════ */

const all: PlateCandidate[] = []
for (const species of SPECIES) all.push(...speciesCandidates(species.id))

check(all.length > 300, `there is a deep pool of readable plates (${all.length})`)
const bySymbol = new Map<string, PlateCandidate[]>()
for (const c of all) {
  const list = bySymbol.get(c.symbol.id)
  if (list) list.push(c)
  else bySymbol.set(c.symbol.id, [c])
}
const drawn = SYMBOLS.filter((s) => s.askable)
for (const s of drawn) {
  check(
    (bySymbol.get(s.id)?.length ?? 0) > 0,
    `${s.id}: the corpus really draws this symbol somewhere, so it can be asked about (${bySymbol.get(s.id)?.length ?? 0})`,
  )
}
for (const s of SYMBOLS.filter((x) => !x.askable)) {
  check(
    !bySymbol.has(s.id),
    `${s.id}: never asked about — either this app does not draw it, or it does not draw it legibly`,
  )
  check(
    s.drawn || !SYMBOLS.some((o) => o.id === s.id && o.askable),
    `${s.id}: a symbol we do not draw is never asked about either`,
  )
}
check(
  SYMBOLS.every((s) => s.askable === false || s.drawn),
  'nothing is asked about that the app does not actually draw',
)
check(
  SYMBOLS.filter((s) => s.drawn && !s.askable).length === 1,
  'exactly one drawn symbol is held back, and it is the one the renderer draws too small to read',
)

const box = (viewBox: string): { x: number; y: number; side: number } => {
  const n = viewBox.split(/\s+/).map(Number)
  return { x: n[0], y: n[1], side: n[2] }
}

for (const c of all) {
  const id = `${c.speciesId}#${c.plate.n}/${c.symbol.id}`
  const p = c.plate

  check(p.view === 'flat', `${id}: read straight down, the way a book prints it`)
  check(p.step !== null, `${id}: a plate with an instruction on it, not the finished model`)
  check(c.speciesName.length > 0, `${id}: the plate says which model it came from`)
  check(Number.isFinite(p.n) && p.n >= 1, `${id}: and which step, as a book numbers it`)
  check(c.symbol.drawn && c.symbol.askable, `${id}: only symbols this app draws, and draws legibly, are asked about`)

  // The symbol asked about is the symbol on the plate.
  if (c.symbol.family === 'line') {
    check(p.crease !== null, `${id}: a line question has a fold line to read`)
    check(
      p.crease?.direction === c.symbol.meaning,
      `${id}: the line drawn is the line asked about`,
    )
  } else {
    check(p.arrow !== null, `${id}: an arrow question has an arrow to read`)
    check(p.arrow?.kind === c.symbol.meaning, `${id}: the arrow drawn is the arrow asked about`)
  }

  // A plate that contradicts itself would mark a correct reading wrong.
  if (p.arrow && p.crease && (p.arrow.kind === 'valley' || p.arrow.kind === 'mountain')) {
    check(
      p.arrow.kind === p.crease.direction,
      `${id}: the arrow and the fold line agree with each other`,
    )
  }

  // Nothing reaches the screen as NaN, and the box is a box.
  const b = box(c.viewBox)
  check(
    Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.side) && b.side > 0,
    `${id}: the plate has a real viewBox`,
  )
  const inside = (x: number, y: number): boolean =>
    Number.isFinite(x) && Number.isFinite(y) && x >= b.x - 1 && x <= b.x + b.side + 1 && y >= b.y - 1 && y <= b.y + b.side + 1
  let pts = 0
  let strays = 0
  for (const f of p.facets) {
    for (const pair of f.pts.split(' ')) {
      const [px, py] = pair.split(',').map(Number)
      pts++
      if (!inside(px, py)) strays++
    }
  }
  check(pts > 2, `${id}: there is paper drawn on the plate`)
  check(strays === 0, `${id}: the whole model is inside the frame — nothing is cropped off (${strays})`)
  if (p.crease) {
    check(
      inside(p.crease.from[0], p.crease.from[1]) && inside(p.crease.to[0], p.crease.to[1]),
      `${id}: the fold line is inside the frame`,
    )
    const len = Math.hypot(p.crease.to[0] - p.crease.from[0], p.crease.to[1] - p.crease.from[1])
    if (c.symbol.family === 'line') {
      check(
        len / b.side >= 0.16,
        `${id}: the fold line is long enough to show its dash pattern (${(len / b.side).toFixed(2)} of the plate)`,
      )
    }
  }
  if (p.arrow) {
    const span = Math.hypot(p.arrow.to[0] - p.arrow.from[0], p.arrow.to[1] - p.arrow.from[1])
    check(Number.isFinite(span), `${id}: the arrow has real endpoints`)
    if (c.symbol.family !== 'line') {
      check(
        span / b.side >= 0.08,
        `${id}: the arrow is big enough to see which head it has (${(span / b.side).toFixed(2)})`,
      )
    }
  }
  for (const m of p.marks) {
    check(Number.isFinite(m[0]) && Number.isFinite(m[1]), `${id}: no mark lands at NaN`)
  }

  // The truths are exactly what the plate says, which is what the distractor
  // filter leans on. If this list were short, a wrong answer could be right.
  const expect = new Set<MeaningId>()
  if (p.arrow) expect.add(p.arrow.kind)
  if (p.crease) expect.add(p.crease.direction)
  check(
    c.truths.length === expect.size && c.truths.every((t) => expect.has(t)),
    `${id}: the plate's true meanings are counted exactly`,
  )
  check(c.truths.includes(c.symbol.meaning), `${id}: what we ask about is one of them`)
}

/* Plates the corpus offers that we deliberately refuse. */
{
  let angled = 0
  let contradicting = 0
  let finished = 0
  for (const species of SPECIES) {
    const set = buildDiagrams(species.recipe, { front: '#E4664F', back: '#F6EFE2' })
    for (const plate of set.plates) {
      const got = plateCandidates(plate, set.viewBox, species.id, species.name)
      if (plate.step === null) {
        finished++
        check(got.length === 0, `${species.id}: the finished model is never a question`)
      }
      if (plate.view !== 'flat') {
        angled++
        check(got.length === 0, `${species.id}#${plate.n}: a turned viewpoint is never a question`)
      }
      const a = plate.arrow
      const c = plate.crease
      if (a && c && (a.kind === 'valley' || a.kind === 'mountain') && a.kind !== c.direction) {
        contradicting++
        check(
          got.length === 0,
          `${species.id}#${plate.n}: a plate whose arrow and line disagree is never a question`,
        )
      }
    }
  }
  check(finished === SPECIES.length, 'every model has exactly one finished plate, and it is excluded')
  check(angled > 0, `the turned-viewpoint plates really exist and really are excluded (${angled})`)
  /* This used to assert that self-contradicting plates EXIST, as proof the
     exclusion above was not a check of nothing. It was a fair guard while four
     of them did exist — arrowFor() switched on the fold's kind, and for a
     pinch, a petal or a pull the direction of the paper is in the crease, not
     in the kind's name, so a solid valley head could sit over a dash-dot line.
     That is fixed at the source in foldalong/diagram.ts, so the honest
     assertion is now the opposite one: the corpus draws no such plate, and the
     quiz's exclusion stays as defence against it coming back. */
  check(
    contradicting === 0,
    `no plate in the corpus contradicts itself (${contradicting} do)`,
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. NO QUESTION HAS TWO ANSWERS

   Every candidate in the corpus, offered under several different draws. The
   rule: exactly one option is true of the plate, and it is the one being asked
   about. Everything else has to be wrong about THIS plate, not merely
   different from the answer.
   ═══════════════════════════════════════════════════════════════════════════ */

{
  let asked = 0
  for (const c of all) {
    for (const seed of ['a', 'b', 'c']) {
      const rng = seededRng(`test/${c.speciesId}/${c.plate.n}/${c.symbol.id}/${seed}`)
      const options = optionsFor(c.symbol, c.truths, rng)
      asked++
      const id = `${c.speciesId}#${c.plate.n}/${c.symbol.id}/${seed}`
      check(options.length === OPTIONS, `${id}: four answers, every time`)
      check(new Set(options).size === options.length, `${id}: no answer is offered twice`)
      check(options.includes(c.symbol.meaning), `${id}: the right answer is on the list`)
      const alsoTrue = options.filter((o) => o !== c.symbol.meaning && c.truths.includes(o))
      check(
        alsoTrue.length === 0,
        `${id}: no wrong answer is also true of this plate (${alsoTrue.join(', ')})`,
      )
      const texts = options.map((o) => meaningLine(o))
      check(new Set(texts).size === texts.length, `${id}: no two answers read the same`)
      check(
        texts.every((t) => t.length > 8 && !/undefined|NaN/.test(t)),
        `${id}: every answer is a readable sentence`,
      )
      // A line question offers line meanings; an arrow question offers actions.
      const lineish = new Set<MeaningId>(['valley', 'mountain', 'existing', 'hidden'])
      if (c.symbol.family === 'line') {
        check(
          options.every((o) => lineish.has(o)),
          `${id}: a line is only ever offered things a line can say`,
        )
      } else {
        check(
          options.every((o) => !['existing', 'hidden'].includes(o)),
          `${id}: an arrow is never offered a meaning only a line can carry`,
        )
      }
    }
  }
  check(asked > 900, `the ambiguity rule was tested on every plate, three ways (${asked})`)
}

/* The answer must not sit in a predictable slot. A quiz whose answer is always
   second is a tapping exercise. */
{
  const slots = [0, 0, 0, 0]
  let n = 0
  for (const c of all) {
    const rng = seededRng(`slots/${c.speciesId}/${c.plate.n}/${c.symbol.id}`)
    const options = optionsFor(c.symbol, c.truths, rng)
    slots[options.indexOf(c.symbol.meaning)]++
    n++
  }
  for (let i = 0; i < OPTIONS; i++) {
    check(
      slots[i] / n > 0.15,
      `the answer lands in slot ${i + 1} often enough that position tells you nothing (${((slots[i] / n) * 100).toFixed(0)}%)`,
    )
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. TODAY'S SHEET

   The same six for everyone all day, six different ones tomorrow, and no
   server. And a sheet that is always six long: a screen that promises six and
   shows five is a bug the player can count.
   ═══════════════════════════════════════════════════════════════════════════ */

const DAYS: string[] = []
for (let i = 0; i < 40; i++) {
  DAYS.push(new Date(Date.UTC(2026, 7, 31 + i)).toISOString().slice(0, 10))
}
DAYS.push('2025-02-28', '2027-01-01', '2030-12-31')

const fingerprints = new Set<string>()
const seenSymbols = new Map<string, number>()

for (const day of DAYS) {
  const sheet = notationQuiz(day)
  const fp = sheet.map((q) => `${q.symbol.id}@${q.speciesId}#${q.plateNumber}`).join('|')
  fingerprints.add(fp)

  check(sheet.length === QUESTIONS, `${day}: a full sheet of ${QUESTIONS} (${sheet.length})`)
  const again = notationQuiz(day)
  check(
    again.map((q) => `${q.symbol.id}@${q.speciesId}#${q.plateNumber}`).join('|') === fp,
    `${day}: the same day is the same sheet — reopening it does not reroll`,
  )
  check(
    again.every((q, i) => q.options.join() === sheet[i].options.join()),
    `${day}: even the answers come back in the same order`,
  )

  const ids = sheet.map((q) => q.symbol.id)
  check(new Set(ids).size === ids.length, `${day}: six different symbols — none asked twice`)
  check(
    sheet.every((q, i) => i === 0 || q.symbol.rank >= sheet[i - 1].symbol.rank),
    `${day}: the sheet opens on the symbol you meet first in a book`,
  )
  check(
    sheet.some((q) => q.symbol.family === 'line'),
    `${day}: at least one fold line to read`,
  )
  check(
    sheet.some((q) => q.symbol.family !== 'line'),
    `${day}: at least one arrow or mark to read`,
  )

  for (const q of sheet) {
    seenSymbols.set(q.symbol.id, (seenSymbols.get(q.symbol.id) ?? 0) + 1)
    const id = `${day}/${q.symbol.id}`
    check(q.ask === q.symbol.ask && q.ask.length > 0, `${id}: the question is the symbol's own`)
    check(q.answer === q.symbol.meaning, `${id}: the answer is the symbol's meaning`)
    check(q.options.includes(q.answer), `${id}: and it is one of the options`)
    check(new Set(q.options).size === OPTIONS, `${id}: four distinct options`)
    check(q.speciesName.length > 0, `${id}: the plate is attributed to a model`)
    check(Number.isFinite(q.plateNumber) && q.plateNumber >= 1, `${id}: with a real step number`)
    check(q.viewBox.split(/\s+/).length === 4, `${id}: and a real frame`)
    check(
      q.viewBox.split(/\s+/).every((v) => Number.isFinite(Number(v))),
      `${id}: no NaN in the frame`,
    )
    check(q.plate.facets.length > 0, `${id}: there is a picture to look at`)
    check(
      !/undefined|NaN/.test(q.options.map((o) => meaningLine(o)).join(' ')),
      `${id}: no debris in the answers`,
    )

    // The plate's own truths, recomputed here rather than trusted.
    const truths = new Set<MeaningId>()
    if (q.plate.arrow) truths.add(q.plate.arrow.kind)
    if (q.plate.crease) truths.add(q.plate.crease.direction)
    const right = q.options.filter((o) => truths.has(o))
    check(
      right.length === 1 && right[0] === q.answer,
      `${id}: exactly one option is true of the plate, and it is the answer (${right.join(', ')})`,
    )
  }

  const species = sheet.map((q) => q.speciesId)
  check(new Set(species).size >= 3, `${day}: the sheet shows several different models, not one`)
}

check(
  fingerprints.size === DAYS.length,
  `a different sheet every day (${fingerprints.size} of ${DAYS.length})`,
)
check(
  seenSymbols.size >= 7,
  `across a run of days the sheet gets round most of the alphabet (${seenSymbols.size} symbols)`,
)
/* The four symbols on the first page of every origami book are on nearly every
   sheet, which is right: that is how often you meet them. What has to be true
   is that they never fill it — the sheet is six of seven or more, so at least
   two of the six are always something less common. */
const EVERYDAY = new Set(['line:valley', 'line:mountain', 'arrow:valley', 'arrow:unfold'])
for (const day of DAYS) {
  const sheet = notationQuiz(day)
  check(
    sheet.filter((q) => !EVERYDAY.has(q.symbol.id)).length >= 2,
    `${day}: at least two of the six are symbols you do not meet on page one`,
  )
}
for (const s of drawn) {
  check(
    (seenSymbols.get(s.id) ?? 0) > 0,
    `${s.id}: this symbol does come round over a run of days (${seenSymbols.get(s.id) ?? 0} of ${DAYS.length})`,
  )
}
for (const id of ['arrow:turn', 'arrow:mountain']) {
  check(
    (seenSymbols.get(id) ?? 0) < DAYS.length,
    `${id}: a symbol you meet twice in a book is not on every sheet`,
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. THE FRAME

   Cropping a plate to itself makes the symbol as large as the card allows. It
   must never crop the drawing.
   ═══════════════════════════════════════════════════════════════════════════ */

{
  let tighter = 0
  for (const species of SPECIES) {
    const set = buildDiagrams(species.recipe, { front: '#E4664F', back: '#F6EFE2' })
    const shared = Number(set.viewBox.split(/\s+/)[2])
    for (const plate of set.plates) {
      const vb = tightViewBox(plate, set.viewBox)
      const b = box(vb)
      check(Number.isFinite(b.side) && b.side > 0, `${species.id}#${plate.n}: the crop is a real box`)
      if (b.side < shared) tighter++
      let out = 0
      for (const f of plate.facets) {
        for (const pair of f.pts.split(' ')) {
          const [px, py] = pair.split(',').map(Number)
          if (px < b.x - 1 || px > b.x + b.side + 1 || py < b.y - 1 || py > b.y + b.side + 1) out++
        }
      }
      check(out === 0, `${species.id}#${plate.n}: cropping never cuts the paper off (${out})`)
      if (plate.arrow) {
        const a = plate.arrow
        const span = Math.hypot(a.to[0] - a.from[0], a.to[1] - a.from[1])
        /* The head and the curve's bulge are both derived from the span, so
           the frame has to allow for them and not just for the two endpoints.
           These are the renderer's own rules, read off Diagram.tsx: a head
           sized max(26, min(64, span·0.22)) and half as wide again as that,
           and a stem bowed by up to 0.38·span at its control point, which puts
           the curve itself half that far off the straight line. */
        const head = Math.max(26, Math.min(64, span * 0.22)) * 0.46
        const need = head + span * 0.19
        for (const pt of [a.from, a.to]) {
          check(
            pt[0] - need >= b.x - 1 &&
              pt[0] + need <= b.x + b.side + 1 &&
              pt[1] - need >= b.y - 1 &&
              pt[1] + need <= b.y + b.side + 1,
            `${species.id}#${plate.n}: the arrow, head and all, is inside the frame`,
          )
        }
      }
    }
  }
  check(tighter > 100, `the crop actually does something on most plates (${tighter})`)
  check(
    tightViewBox({ facets: [], crease: null, arrow: null, marks: [], n: 1, step: null, landmark: null, view: 'flat', facing: 'front' }, '0 0 10 10') === '0 0 10 10',
    'an empty plate falls back to the shared frame instead of dividing by nothing',
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. THE GRADE
   ═══════════════════════════════════════════════════════════════════════════ */

check(readGrade(6, 6).tone === 'clean', 'reading all six reads clean')
check(readGrade(5, 6).tone === 'close', 'five of six is close')
check(readGrade(3, 6).tone === 'close', 'half of them is still close')
check(readGrade(0, 6).tone === 'rough', 'none of them still gets a tone, not a verdict')
check(readGrade(0, 6).label === 'Keep going', 'and the lowest band is "Keep going", as the fold sheet promises')
check(readGrade(0, 0).label.length > 0, 'an empty sheet does not divide by zero')
check(!Number.isNaN(quizScore(0, 0)), 'nor does the score')
check(quizScore(3, 6) === 0.5, 'the score is the share read')
check(quizScore(6, 6) === 1, 'a clean sheet is 1')
for (let n = 0; n <= 6; n++) {
  const g = readGrade(n, 6)
  check(g.label.length > 0 && g.note.length > 0, `${n}/6: the grade says something`)
  check(g.note.endsWith('.'), `${n}/6: and says it as a sentence`)
  check(['clean', 'close', 'rough'].includes(g.tone), `${n}/6: with a tone the sheet knows how to colour`)
}
check(
  readGrade(6, 6).label !== readGrade(0, 6).label,
  'six of six and none of six do not read the same',
)

/* ── what the sheet looks like today ─────────────────────────────────────── */

const sample = notationQuiz(DAYS[0])
console.log(`  ${all.length} readable plates across ${SPECIES.length} models`)
console.log(`  ${[...bySymbol.entries()].map(([k, v]) => `${k}:${v.length}`).join('  ')}`)
console.log(`  sample sheet: ${sample.map((q) => q.symbol.id).join(' · ')}`)

console.log(`\n${BOLD}verdict${OFF}`)
if (failures.length > 0) {
  for (const f of failures.slice(0, 20)) console.log(`  ${RED}FAIL${OFF} ${f}`)
  console.log('')
  throw new Error(`${failures.length} notation failures out of ${checks} checks`)
}
console.log(`  ${GREEN}all ${checks} checks passed${OFF}`)
console.log('')
