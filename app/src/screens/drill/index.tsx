/* PAPER PLANET — The Practice Sheet.

   Five folds, drawn from across the whole roster, each one dropped in at the
   moment its landmark matters. The reference is the only instruction. And this
   is the one screen in the app that shows you the number, because the Studio's
   refusal to grade you is right for making things and wrong for getting better
   at them.

   It pays nothing. Practising is its own reward, and BRAND section 12 keeps it
   that way — there is no sheet here you can buy your way past. */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { PaperMaterial } from '../../contracts'
import { getSpecies } from '../../content'
import { actions, useGame, usePractice, useSettings } from '../../systems'
import { audio, haptics } from '../../audio'
import { useNavigation } from '../../shell/Navigator'
import { Button, Icon, IconButton, Paper } from '../../ui'
import FoldCanvas from '../studio/FoldCanvas'
import { ROUNDS, drillFor, gradeFor, sheetGrade } from './rounds'
import './drill.css'

/** Plain paper. A drill is about the hand, not the washi. */
const PAPER: PaperMaterial = { front: 'var(--beni)', back: 'var(--paper-back)' }

const pct = (n: number): string => `${Math.round(n * 100)}%`

export default function DrillScreen() {
  const nav = useNavigation()
  const today = useGame((s) => s.today)
  const settings = useSettings()
  const practice = usePractice()

  const rounds = useMemo(() => drillFor(today, ROUNDS), [today])

  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  /** The score just landed, or null while folding. */
  const [landed, setLanded] = useState<number | null>(null)
  const [finished, setFinished] = useState<{ sheet: number; best: number; streak: number } | null>(null)
  /** One commit per round: FoldCanvas can settle and fire again on a re-press. */
  const takenRef = useRef(-1)

  const round = rounds[index]
  const species = round ? getSpecies(round.speciesId) : undefined

  const record = useCallback(
    (quality: number) => {
      if (takenRef.current === index) return
      takenRef.current = index
      const next = [...scores, quality]
      setScores(next)
      setLanded(quality)
      audio.play(quality >= 0.94 ? 'crease.crisp' : 'crease.soft')
      haptics.fire(quality >= 0.94 ? 'reward' : 'foldComplete')

      if (next.length >= rounds.length) {
        const sheet = sheetGrade(next)
        const log = actions.recordPractice(sheet)
        setFinished({ sheet, best: log.best, streak: log.streak })
      }
    },
    [index, scores, rounds.length],
  )

  const advance = useCallback(() => {
    setLanded(null)
    setIndex((i) => i + 1)
    audio.play('sheet.slide')
  }, [])

  const again = useCallback(() => {
    takenRef.current = -1
    setIndex(0)
    setScores([])
    setLanded(null)
    setFinished(null)
    audio.play('sheet.pickup')
  }, [])

  if (rounds.length === 0) {
    return (
      <div className="pp-drill pp-drill--empty">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <p>No sheet today.</p>
      </div>
    )
  }

  return (
    <div className="pp-drill">
      <header className="pp-drill__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <div className="pp-drill__title">
          <h1>Practice</h1>
          <p>
            {finished ? 'Sheet finished' : `Fold ${Math.min(index + 1, rounds.length)} of ${rounds.length}`}
          </p>
        </div>
        <ol className="pp-drill__pips" aria-hidden="true">
          {rounds.map((r, i) => (
            <li
              key={r.speciesId + r.stepIndex}
              className={
                i < scores.length
                  ? 'is-done is-' + gradeFor(scores[i]).tone
                  : i === index
                    ? 'is-now'
                    : ''
              }
            />
          ))}
        </ol>
      </header>

      {/* ── the sheet's result ───────────────────────────────────────────── */}
      {finished ? (
        <div className="pp-drill__done">
          <Paper elevation={2} edge="deckle" tone={0} grain className="pp-drill__card">
            <p className="pp-drill__eyebrow">Today&rsquo;s sheet</p>
            <p className="pp-drill__big" data-tone={gradeFor(finished.sheet).tone}>
              {pct(finished.sheet)}
            </p>
            <p className="pp-drill__grade">{gradeFor(finished.sheet).label}</p>
            <ul className="pp-drill__tally">
              {rounds.map((r, i) => (
                <li key={r.speciesId + r.stepIndex}>
                  <span className="pp-drill__tallyname">{r.speciesName}</span>
                  <span className="pp-drill__tallyref">{r.landmark.line}</span>
                  <span className="pp-drill__tallyscore" data-tone={gradeFor(scores[i] ?? 0).tone}>
                    {pct(scores[i] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="pp-drill__record">
              <span>
                <Icon name="star" size={13} /> Best {pct(finished.best)}
              </span>
              <span>
                <Icon name="leaf" size={13} /> {finished.streak}{' '}
                {finished.streak === 1 ? 'day' : 'days'} in a row
              </span>
            </p>
            <p className="pp-drill__tomorrow">A new sheet tomorrow. The same five for everyone.</p>
            <div className="pp-drill__acts">
              <Button variant="quiet" onClick={again}>
                Fold it again
              </Button>
              <Button variant="beni" onClick={() => nav.back()}>
                Done
              </Button>
            </div>
          </Paper>
        </div>
      ) : (
        <>
          {/* ── the reference. The only instruction you get. ─────────────── */}
          <div className="pp-drill__ask">
            <p className="pp-drill__from">{species?.name}</p>
            <h2>{round?.landmark.line}.</h2>
          </div>

          <div className="pp-drill__stage">
            {species && round && (
              <FoldCanvas
                key={`${round.speciesId}-${round.stepIndex}`}
                recipe={species.recipe}
                material={PAPER}
                stepIndex={round.stepIndex}
                assist={settings.assistMode}
                guides={settings.guides}
                reducedMotion={settings.reducedMotion}
                complete={landed !== null}
                fill={0.74}
                onStepComplete={record}
              />
            )}

            {/* The number, the moment it lands. */}
            {landed !== null && (
              <div className="pp-drill__land" role="status">
                <Paper elevation={3} edge="cut" tone={0} grain className="pp-drill__landcard">
                  <p className="pp-drill__landscore" data-tone={gradeFor(landed).tone}>
                    {pct(landed)}
                  </p>
                  <p className="pp-drill__landgrade">{gradeFor(landed).label}</p>
                  <p className="pp-drill__landnote">{gradeFor(landed).note}</p>
                  {index + 1 < rounds.length && (
                    <Button variant="beni" onClick={advance}>
                      Next fold
                    </Button>
                  )}
                </Paper>
              </div>
            )}
          </div>

          <footer className="pp-drill__foot">
            {practice.streak > 0 && (
              <p>
                <Icon name="leaf" size={13} /> {practice.streak}{' '}
                {practice.streak === 1 ? 'day' : 'days'} in a row
              </p>
            )}
            {practice.best > 0 && (
              <p>
                <Icon name="star" size={13} /> Best {pct(practice.best)}
              </p>
            )}
          </footer>
        </>
      )}
    </div>
  )
}
