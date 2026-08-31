/* PAPER PLANET — Practice: reading the notation.

   Six symbols, on six real diagram plates, about thirty seconds. The fold
   sheet next door trains the hand; this trains the eye, and it is the half you
   can take away with you: the Yoshizawa–Randlett symbols are the same in every
   origami book ever printed, in every language. Learn nine of them and the
   books open.

   Getting one right should teach and getting one wrong should teach harder —
   so a wrong answer never scolds, it shows you which one was right and says in
   one line why the drawing means that. See docs/BRAND.md §5 and §11. */

import { useCallback, useMemo, useState } from 'react'
import { actions, useGame, usePractice } from '../../systems'
import { audio, haptics } from '../../audio'
import { useNavigation } from '../../shell/Navigator'
import { Button, Icon, IconButton, Paper, plural, spell } from '../../ui'
import Diagram from '../foldalong/Diagram'
import { QUESTIONS, meaningLine, notationQuiz, quizScore, readGrade, type MeaningId } from './notation'
/* The notation's own stylesheet, so a plate here is drawn by exactly the same
   rules as a plate in Fold Along. Imported rather than copied: a second copy
   of the dash patterns is a second copy that can drift. */
import '../foldalong/foldalong.css'
import './drill.css'

/**
 * Plain paper, dyed with tokens rather than a species' washi.
 *
 * A diagram is ink on paper, and the two faces have to stay told apart in both
 * themes — a patterned sheet would say something about the washi and nothing
 * about the fold.
 */
const FRONT = 'var(--beni)'
const BACK = 'var(--paper-back)'

/** Best is stored as a share; the sheet is read as a count of symbols. */
const asCount = (share: number, total: number): number => Math.round(share * total)

export default function NotationQuiz() {
  const nav = useNavigation()
  const today = useGame((s) => s.today)
  const record = usePractice('notation')

  const questions = useMemo(() => notationQuiz(today, QUESTIONS), [today])

  const [index, setIndex] = useState(0)
  /** The answer just given, or null while the question is still open. */
  const [picked, setPicked] = useState<MeaningId | null>(null)
  const [marks, setMarks] = useState<boolean[]>([])
  const [finished, setFinished] = useState<{ right: number; best: number; streak: number } | null>(null)

  const question = questions[index]

  const answer = useCallback(
    (choice: MeaningId) => {
      if (picked !== null || !question) return
      const ok = choice === question.answer
      setPicked(choice)
      setMarks((m) => [...m, ok])
      /* A crisp crease for a right read; for a wrong one the sound of a page
         settling, which is a sound and not a verdict. */
      audio.play(ok ? 'crease.crisp' : 'sheet.settle')
      haptics.fire(ok ? 'creaseSet' : 'tick')
    },
    [picked, question],
  )

  const advance = useCallback(() => {
    if (index + 1 < questions.length) {
      setPicked(null)
      setIndex((i) => i + 1)
      audio.play('sheet.slide')
      return
    }
    const scored = marks.filter(Boolean).length
    const log = actions.recordPractice(quizScore(scored, questions.length), 'notation')
    setFinished({ right: scored, best: log.best, streak: log.streak })
    audio.play('ui.confirm')
  }, [index, questions.length, marks])

  const again = useCallback(() => {
    setIndex(0)
    setPicked(null)
    setMarks([])
    setFinished(null)
    audio.play('sheet.pickup')
  }, [])

  if (questions.length === 0) {
    return (
      <div className="pp-drill pp-drill--empty">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <p>No symbols today.</p>
      </div>
    )
  }

  const grade = finished ? readGrade(finished.right, questions.length) : null

  return (
    <div className="pp-drill pp-nq">
      <header className="pp-drill__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <div className="pp-drill__title">
          <h1>Notation</h1>
          <p>
            {finished
              ? 'Sheet finished'
              : `Symbol ${Math.min(index + 1, questions.length)} of ${questions.length}`}
          </p>
        </div>
        <ol className="pp-drill__pips" aria-hidden="true">
          {questions.map((q, i) => (
            <li
              key={q.symbol.id}
              className={
                i < marks.length ? (marks[i] ? 'is-done is-clean' : 'is-done is-rough') : i === index ? 'is-now' : ''
              }
            />
          ))}
        </ol>
      </header>

      {finished && grade ? (
        /* ── the finished sheet, and the key ──────────────────────────────── */
        <div className="pp-drill__done">
          <Paper elevation={2} edge="deckle" tone={0} grain className="pp-drill__card">
            <p className="pp-drill__eyebrow">Today&rsquo;s reading</p>
            <p className="pp-drill__big" data-tone={grade.tone}>
              {finished.right} of {questions.length}
            </p>
            <p className="pp-drill__grade">{grade.label}</p>
            <p className="pp-nq__gradenote">{grade.note}</p>

            <ul className="pp-nq__key">
              {questions.map((q, i) => (
                <li key={q.symbol.id} data-got={marks[i] ? 'yes' : 'no'}>
                  <span className="pp-nq__keymark" aria-hidden="true">
                    {marks[i] ? <Icon name="check" size={12} /> : <Icon name="fold" size={12} />}
                  </span>
                  <span className="pp-nq__keyform">
                    {q.symbol.form.charAt(0).toUpperCase() + q.symbol.form.slice(1)}
                  </span>
                  <span className="pp-nq__keymeaning">{meaningLine(q.symbol.meaning)}</span>
                </li>
              ))}
            </ul>

            <p className="pp-drill__record">
              {record.best > 0 && (
                <span>
                  <Icon name="star" size={13} /> Best {asCount(finished.best, questions.length)} of{' '}
                  {questions.length}
                </span>
              )}
              <span>
                <Icon name="leaf" size={13} /> {spell(finished.streak)}{' '}
                {plural(finished.streak, 'day', 'days')} in a row
              </span>
            </p>
            <p className="pp-drill__tomorrow">
              Six more tomorrow. The same six for everyone, all day.
            </p>
            <div className="pp-drill__acts">
              <Button variant="quiet" onClick={again}>
                Read them again
              </Button>
              <Button variant="beni" onClick={() => nav.back()}>
                Done
              </Button>
            </div>
          </Paper>
        </div>
      ) : question ? (
        <>
          {/* The plate, the question and the answers scroll together if a
              short screen cannot hold them; the verdict below never does,
              because a Next button you have to go looking for is a dead end. */}
          <div className="pp-nq__body">
          {/* ── the plate: a real diagram, drawn in real notation ─────────── */}
          <div className="pp-nq__stage">
            <p className="pp-drill__from">
              {question.speciesName} · step {question.plateNumber}
            </p>
            <Paper elevation={1} edge="cut" tone={0} grain className="pp-nq__plate">
              <Diagram
                plate={question.plate}
                viewBox={question.viewBox}
                front={FRONT}
                back={BACK}
                size="100%"
                label={`${question.speciesName}, step ${question.plateNumber}, drawn in origami notation: ${question.symbol.form}.`}
              />
            </Paper>
          </div>

          {/* ── the question ─────────────────────────────────────────────── */}
          <h2 className="pp-nq__ask">{question.ask}</h2>

          <ul className="pp-nq__options">
            {question.options.map((option) => {
              const isAnswer = option === question.answer
              const mark =
                picked === null ? undefined : isAnswer ? 'right' : option === picked ? 'chosen' : 'quiet'
              return (
                <li key={option}>
                  <Button
                    block
                    variant={mark === 'right' ? 'matcha' : 'ghost'}
                    className="pp-nq__opt"
                    data-mark={mark}
                    aria-disabled={picked === null ? undefined : true}
                    icon={mark === 'right' ? 'check' : undefined}
                    onClick={() => answer(option)}
                  >
                    {meaningLine(option)}
                    {mark === 'chosen' && <span className="pp-sr-only"> — the answer you gave</span>}
                  </Button>
                </li>
              )
            })}
          </ul>
          </div>

          {/* ── what it meant, either way ────────────────────────────────── */}
          {/* Always here, empty or not. It holds its own height so answering
              does not shove the options out from under the finger that just
              tapped one, and it is a live region before it has anything to
              say, which is the only way a screen reader reliably reads it. */}
          <div className="pp-nq__after" role="status">
            {picked !== null && (
              <div className="pp-nq__afterin">
                <p className="pp-nq__why">
                  <Icon name={picked === question.answer ? 'check' : 'info'} size={14} />
                  {question.symbol.why}
                </p>
                <Button variant="beni" onClick={advance}>
                  {index + 1 < questions.length ? 'Next symbol' : 'Finish'}
                </Button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
