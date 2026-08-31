/* PAPER PLANET — the cold open: a lit desk, one sheet, a crane, and a way in. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Crane, IconButton, Icon, Logotype, Paper, Reveal } from '../../ui'
import { useNavigation } from '../../shell/Navigator'
import {
  FLAG,
  actions,
  motionAllowed,
  useActiveWashi,
  useCollection,
  useDaily,
  useHasSeen,
  useKamiCount,
  useSettings,
} from '../../systems'
import { getSpecies } from '../../content'
import { audio } from '../../audio'
import { useAudioSettings } from '../settings/audioSettings'
import Motes from './Motes'
import './title.css'

/** The crane is the brand mascot and the first fold every player makes. BRAND §6. */
const FIRST_FOLD = 'crane'

interface Beat {
  /** The one line, set large. */
  line: string
  /** The quiet second line. Never more than a sentence and a half. */
  note: string
  /** What the button says to move on. */
  cta: string
}

/**
 * Three beats, three taps, roughly five seconds. This is the whole of the
 * onboarding: it is not a modal, it does not gate anything, and the last tap
 * puts the player's finger on paper.
 */
function beatsFor(steps: number): Beat[] {
  return [
    {
      line: 'Take a sheet.',
      note: 'A square of kozo paper. It weighs almost nothing, and it keeps every crease you give it.',
      cta: 'I have it',
    },
    {
      line: 'Your finger is the fold.',
      note: 'Drag across the paper and it bows, then lands. Rub a crease and you will hear the fibres.',
      cta: 'Go on',
    },
    {
      line: 'Now, a crane.',
      note:
        steps > 0
          ? `${steps} folds. There is no clock, and nothing here can go wrong.`
          : 'Take as long as you like. There is no clock, and nothing here can go wrong.',
      cta: 'Start folding',
    },
  ]
}

export default function TitleScreen() {
  const nav = useNavigation()
  const settings = useSettings()
  const kamiCount = useKamiCount()
  const collection = useCollection()
  const daily = useDaily()
  const activeWashi = useActiveWashi()
  const onboarded = useHasSeen(FLAG.onboarded)

  const motion = motionAllowed(settings)
  const returning = kamiCount > 0

  useAudioSettings(settings)

  /* `null` is the hero; 0..2 is the cold-open sequence. */
  const [beat, setBeat] = useState<number | null>(null)

  const firstFold = getSpecies(FIRST_FOLD)
  const beats = useMemo(() => beatsFor(firstFold?.recipe.steps.length ?? 0), [firstFold])
  const dailySpecies = daily.speciesId ? getSpecies(daily.speciesId) : undefined

  /* Preload the sounds the very next screen will need while the player reads. */
  useEffect(() => {
    void audio.preload(['ui.tap', 'ui.confirm', 'sheet.slide', 'sheet.settle'])
  }, [])

  const toStudio = useCallback(() => {
    actions.markSeen(FLAG.onboarded)
    nav.push('studio', { speciesId: FIRST_FOLD, washiId: activeWashi, mode: 'normal' })
  }, [nav, activeWashi])

  const advance = useCallback(() => {
    setBeat((b) => {
      if (b === null) return 0
      if (b + 1 >= beats.length) {
        toStudio()
        return b
      }
      audio.play('sheet.slide', { volume: 0.5 })
      return b + 1
    })
  }, [beats.length, toStudio])

  const skip = useCallback(() => {
    actions.markSeen(FLAG.onboarded)
    audio.play('ui.tap')
    setBeat(null)
    nav.push('select')
  }, [nav])

  const inSequence = beat !== null
  const active = inSequence ? beats[Math.min(beat, beats.length - 1)] : null

  /* ── the line under the logotype, for someone coming back ───────────────── */
  const welcome = useMemo(() => {
    if (!returning) return null
    const kamiLine = kamiCount === 1 ? 'One Kami on your planet.' : `${kamiCount} Kami on your planet.`
    if (daily.done) return `${kamiLine} Today's fold is done — the paper will keep.`
    if (dailySpecies) return `${kamiLine} Today's fold is ${article(dailySpecies.name)}.`
    return kamiLine
  }, [returning, kamiCount, daily.done, dailySpecies])

  return (
    <div className="pp-title pp-desk pp-on-desk" data-phase={inSequence ? 'open' : 'hero'}>
      <Motes animate={motion} count={motion ? 13 : 9} />

      {/* Settings is reachable before the first fold: assist mode, high ink and
          reduced motion are accessibility, not a reward. */}
      <div className="pp-title__bar">
        <IconButton
          icon="settings"
          label="Settings"
          variant="quiet"
          size="sm"
          onClick={() => nav.push('settings')}
        />
      </div>

      <main className="pp-title__stage">
        {/* the paper stack: two sheets under the title card, off-register */}
        <div className="pp-title__stack" aria-hidden="true">
          <Paper className="pp-title__under pp-title__under--a" elevation={1} edge="deckle" tone={1} tilt={-3.4} seed="t-a" />
          <Paper className="pp-title__under pp-title__under--b" elevation={2} edge="deckle" tone={0} tilt={2.1} seed="t-b" />
        </div>

        <Reveal className="pp-title__cardwrap" delay={motion ? 90 : 0} y={26} rotate={2.2}>
          <Paper className="pp-title__card" elevation={4} edge="deckle" tone={0} tilt={-1.1} seed="title-card" dogEar>
            {active ? (
              <div className="pp-title__beat" key={beat} aria-live="polite">
                <p className="pp-label pp-title__count">
                  {(beat ?? 0) + 1} of {beats.length}
                </p>
                <h1 className="pp-title__line">{active.line}</h1>
                <p className="pp-title__note">{active.note}</p>
              </div>
            ) : (
              <>
                <Logotype className="pp-title__logo" mark markSize={72} />
                {welcome ? <p className="pp-title__welcome">{welcome}</p> : null}
              </>
            )}
          </Paper>
        </Reveal>

        <Crane
          className={`pp-title__crane${motion ? ' pp-breathe' : ''}`}
          size={132}
          title=""
        />
      </main>

      <footer className="pp-title__acts">
        {inSequence ? (
          <Reveal delay={0} y={14}>
            <div className="pp-title__seq">
              <Button variant="beni" size="lg" block onClick={advance} cue="ui.confirm" iconAfter="chevron">
                {active?.cta}
              </Button>
              <Button variant="quiet" size="sm" onClick={skip}>
                Skip the introduction
              </Button>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal delay={motion ? 320 : 0} y={18}>
              {returning ? (
                <Button variant="beni" size="lg" block icon="planet" cue="ui.confirm" onClick={() => nav.reset('planet')}>
                  Continue
                </Button>
              ) : (
                <Button
                  variant="beni"
                  size="lg"
                  block
                  icon="fold"
                  cue="ui.confirm"
                  onClick={() => (onboarded ? toStudio() : advance())}
                >
                  {onboarded ? 'Start folding' : 'Fold your first crane'}
                </Button>
              )}
            </Reveal>

            {returning ? (
              <Reveal delay={motion ? 420 : 0} y={14}>
                <nav className="pp-title__ways" aria-label="Elsewhere">
                  <Button variant="ghost" size="md" icon="fold" onClick={() => nav.push('select')}>
                    Fold
                  </Button>
                  <Button variant="ghost" size="md" icon="codex" onClick={() => nav.push('codex')}>
                    Codex
                  </Button>
                  <Button variant="ghost" size="md" icon="hand" onClick={() => nav.push('drill')}>
                    Practice
                  </Button>
                  <Button variant="ghost" size="md" icon="moon" onClick={() => nav.push('zen')}>
                    Zen
                  </Button>
                </nav>
              </Reveal>
            ) : null}

            {returning ? (
              <p className="pp-title__stat pp-num">
                <Icon name="codex" size="sm" />
                {collection.collected} of {collection.total} folds
                {daily.streak > 1 ? ` · ${daily.streak} days` : ''}
              </p>
            ) : (
              <p className="pp-title__stat">Fold. Breathe. Come alive.</p>
            )}
          </>
        )}
      </footer>
    </div>
  )
}

/** "a Heron" / "an Owl" — small, but it is the difference between craft and CMS. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`
}
