/* PAPER PLANET — Practice: the desk.

   Two drills lie here, and they train different halves of the same craft.

   The fold sheet is the hand: five folds pulled from across the roster, each
   dropped in at the moment its landmark matters, and scored — this is the one
   corner of the app where a number is shown, because the Studio's refusal to
   grade you is right for making things and wrong for getting better at them.

   The notation sheet is the eye: six Yoshizawa–Randlett symbols on six real
   diagram plates. That is the transferable half. A player who can read a
   dash-dot line and a hollow arrowhead can open any origami book in any
   language and follow it, which is a skill that outlives this app.

   They get a desk rather than a tab strip because they are not two views of
   one thing — they are two exercises, with separate records, and picking one
   should feel like picking up a sheet. Each is a route of its own (`drill`
   with a `mode`), so the hardware back button lifts the sheet and puts the
   desk back, exactly like every other screen in the app.

   Neither pays anything. See docs/BRAND.md §12: practising is its own reward,
   and there is no sheet here you can buy your way past. */

import { useEffect, type CSSProperties } from 'react'
import { useGame, usePractice } from '../../systems'
import { useNavigation, useRouteParams } from '../../shell/Navigator'
import { Icon, IconButton, Paper, plural, spell, spellCap } from '../../ui'
import FoldSheet from './FoldSheet'
import NotationQuiz from './NotationQuiz'
import { ROUNDS } from './rounds'
import { QUESTIONS, warmNotation } from './notation'
import './drill.css'

/** Which sheet you picked up. No mode means you are still at the desk. */
export type PracticeMode = 'folds' | 'notation'

const pct = (n: number): string => `${Math.round(n * 100)}%`

export default function PracticeScreen() {
  const { mode } = useRouteParams<{ mode: PracticeMode }>()
  if (mode === 'folds') return <FoldSheet />
  if (mode === 'notation') return <NotationQuiz />
  return <PracticeDesk />
}

function PracticeDesk() {
  const nav = useNavigation()
  const today = useGame((s) => s.today)
  const folds = usePractice('folds')
  const reading = usePractice('notation')

  /* Building today's models takes about a sixth of a second, and spending it
     after the tap is a sixth of a second of nothing happening. Spend it here
     instead, in the gap where the player is reading two cards. */
  useEffect(() => warmNotation(today), [today])

  return (
    <div className="pp-drill pp-practice">
      <header className="pp-drill__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <div className="pp-drill__title">
          <h1>Practice</h1>
          <p>Two sheets today</p>
        </div>
        <span className="pp-practice__spacer" />
      </header>

      <div className="pp-practice__desk">
        <Paper
          as="button"
          elevation={1}
          edge="deckle"
          tone={0}
          radius="lg"
          seed="practice-folds"
          grain
          className="pp-practice__card"
          style={{ '--pp-mark': 'var(--beni-deep)' } as CSSProperties}
          onClick={() => nav.push('drill', { mode: 'folds' })}
          aria-label={`The fold sheet. ${ROUNDS} folds, scored against their reference.`}
        >
          <span className="pp-practice__icon" aria-hidden>
            <Icon name="hand" size={20} />
          </span>
          <span className="pp-practice__eyebrow">For the hand</span>
          <span className="pp-practice__name">Folds</span>
          <span className="pp-practice__blurb">
            {spellCap(ROUNDS)} folds from across the roster, each one handed to you at the moment
            its landmark matters. Scored — the one place the app tells you the number.
          </span>
          <span className="pp-practice__meta">
            {folds.doneToday && (
              <span className="pp-practice__done">
                <Icon name="check" size={12} /> Done today
              </span>
            )}
            {folds.best > 0 && (
              <span>
                <Icon name="star" size={12} /> Best {pct(folds.best)}
              </span>
            )}
            {folds.streak > 0 && (
              <span>
                <Icon name="leaf" size={12} /> {spell(folds.streak)}{' '}
                {plural(folds.streak, 'day', 'days')} in a row
              </span>
            )}
            {folds.best === 0 && !folds.doneToday && <span>A couple of minutes</span>}
          </span>
        </Paper>

        <Paper
          as="button"
          elevation={1}
          edge="deckle"
          tone={0}
          radius="lg"
          seed="practice-notation"
          grain
          className="pp-practice__card"
          style={{ '--pp-mark': 'var(--ai-deep)' } as CSSProperties}
          onClick={() => nav.push('drill', { mode: 'notation' })}
          aria-label={`The notation sheet. ${QUESTIONS} origami symbols to read.`}
        >
          <span className="pp-practice__icon" aria-hidden>
            <Icon name="codex" size={20} />
          </span>
          <span className="pp-practice__eyebrow">For the eye</span>
          <span className="pp-practice__name">Notation</span>
          <span className="pp-practice__blurb">
            {spellCap(QUESTIONS)} symbols to read, on real diagrams. The alphabet every origami
            book in the world is written in — learn it here, take it anywhere.
          </span>
          <span className="pp-practice__meta">
            {reading.doneToday && (
              <span className="pp-practice__done">
                <Icon name="check" size={12} /> Done today
              </span>
            )}
            {reading.best > 0 && (
              <span>
                <Icon name="star" size={12} /> Best {Math.round(reading.best * QUESTIONS)} of{' '}
                {QUESTIONS}
              </span>
            )}
            {reading.streak > 0 && (
              <span>
                <Icon name="leaf" size={12} /> {spell(reading.streak)}{' '}
                {plural(reading.streak, 'day', 'days')} in a row
              </span>
            )}
            {reading.best === 0 && !reading.doneToday && <span>About thirty seconds</span>}
          </span>
        </Paper>
      </div>

      <footer className="pp-practice__foot">
        <p>
          Neither sheet pays anything. A new one of each tomorrow, the same for everyone who folds
          today.
        </p>
      </footer>
    </div>
  )
}
