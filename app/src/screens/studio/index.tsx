/* PAPER PLANET — The Studio. Where paper becomes a creature. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PaperMaterial, StudioResult, StudioSession } from '../../contracts'
import { getSpecies, getWashi, DEFAULT_WASHI } from '../../content'
import { FLAG, actions, useActiveWashi, useHasSeen, useSettings } from '../../systems'
import { audio, haptics } from '../../audio'
import { useNavigation, useRouteParams } from '../../shell/Navigator'
import { Button, IconButton, Icon } from '../../ui'
import FoldCanvas, { type FoldCanvasHandle } from './FoldCanvas'
import FoldCoach from './FoldCoach'
import { useFoldCoach, useLiveAnchors, type CoachTopic } from './coach'
import Reveal from './Reveal'
import { TEST_RECIPE } from './testRecipe'
import './studio.css'
import './coach.css'

/** The orbit is its own idea, learned once. `FLAG.studioIntro` covers the fold. */
const FLAG_ORBIT = 'studio-orbit'

interface StudioParams extends Record<string, unknown> {
  speciesId: string
  washiId: string
  mode: StudioSession['mode']
}

type Phase = 'folding' | 'reveal'

export default function StudioScreen() {
  const params = useRouteParams<StudioParams>()
  const nav = useNavigation()
  const settings = useSettings()
  const activeWashi = useActiveWashi()

  const species = getSpecies(params.speciesId ?? 'crane')
  const mode: StudioSession['mode'] = params.mode ?? 'normal'

  /* Kozo is undyed — the starting paper. A creature folded from it loses the
     colour that identifies it, so the species' own dye wins unless the player
     has deliberately chosen a Washi. */
  const chosenWashiId = params.washiId ?? (activeWashi === DEFAULT_WASHI ? undefined : activeWashi)
  const washi = chosenWashiId ? getWashi(chosenWashiId) : undefined

  const recipe = species?.recipe ?? TEST_RECIPE
  const total = recipe.steps.length

  /* Golden paper is rolled once, when the session opens — never re-rolled on a
     re-render, or a player could reload their way into a golden. */
  const goldenRef = useRef<boolean | null>(null)
  if (goldenRef.current === null) {
    goldenRef.current = mode === 'zen' ? false : actions.rollGoldenPaper()
  }
  const golden = goldenRef.current

  const material: PaperMaterial = useMemo(() => {
    const base = washi?.material ?? species?.material ?? { front: 'var(--beni)', back: 'var(--paper-back)' }
    const patterned = washi?.material.patternId ? base : { ...base, patternId: undefined }
    return golden
      ? { ...patterned, front: 'var(--gold-leaf)', back: 'var(--gold-hi)', foil: 1 }
      : patterned
  }, [washi, species, golden])

  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<Phase>('folding')
  const handleRef = useRef<FoldCanvasHandle | null>(null)
  const qualities = useRef<number[]>([])
  const startedAt = useRef(Date.now())
  const creases = useRef(0)

  const step = recipe.steps[Math.min(stepIndex, total - 1)]
  const complete = stepIndex >= total

  const onStepComplete = useCallback(
    (quality: number) => {
      qualities.current.push(quality)
      creases.current += 1
      setProgress(0)
      setStepIndex((i) => i + 1)
    },
    [],
  )

  /**
   * Unfold — real paper comes apart again.
   *
   * The Studio owns `stepIndex`, so stepping back is a state change: FoldCanvas
   * re-seeks the engine whenever the index moves, in either direction. The
   * quality sample for the step being undone goes with it, so an undone crease
   * cannot quietly hold your score down (BRAND §2 — it never punishes).
   *
   * The refs are touched outside the state updater on purpose: StrictMode runs
   * updaters twice, and a `pop()` in there would eat two samples.
   */
  const canUnfold = stepIndex > 0 && !complete
  const unfold = useCallback(() => {
    if (!canUnfold) return
    qualities.current.pop()
    creases.current = Math.max(0, creases.current - 1)
    setStepIndex(stepIndex - 1)
    setProgress(0)
    audio.play('sheet.slide', { volume: 0.7 })
    haptics.fire('flip')
  }, [canUnfold, stepIndex])

  /* "Show me" is always here, for everyone — asking is not failing (BRAND §11).
     FoldCanvas already books a modest 0.7 for a demonstrated crease, which is a
     nudge, not a penalty: you can still finish a beautiful bird. */
  const showMe = useCallback(() => {
    if (complete) return
    audio.play('ui.tap', { volume: 0.6 })
    handleRef.current?.demonstrate()
  }, [complete])

  /* ── the teacher ──────────────────────────────────────────────────────── */
  const teachFold = !useHasSeen(FLAG.studioIntro)
  const teachOrbit = !useHasSeen(FLAG_ORBIT)

  const onTaught = useCallback((topic: CoachTopic) => {
    actions.markSeen(topic === 'orbit' ? FLAG_ORBIT : FLAG.studioIntro)
  }, [])

  const { lesson: coachLesson, touch: coachTouch } = useFoldCoach({
    stepIndex,
    total,
    gesture: step?.gesture,
    complete,
    teachFold,
    teachOrbit,
    assist: settings.assistMode,
    onTaught,
  })

  const coachOpen = coachLesson !== null
  const liveAnchors = useLiveAnchors(coachOpen, stepIndex)

  /* A finger on the paper is the answer to every lesson: the teacher steps back
     in the capture phase, before FoldCanvas has even seen the event. A mouse
     merely passing over the sheet is not an answer, so it does not count. */
  const onPaperMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.buttons !== 0) coachTouch()
    },
    [coachTouch],
  )

  /* When the last crease lands, the paper becomes a creature. */
  useEffect(() => {
    if (!complete || phase === 'reveal') return
    const t = window.setTimeout(() => {
      setPhase('reveal')
      audio.play('alive.happy')
      haptics.fire('alive')
    }, 620)
    return () => clearTimeout(t)
  }, [complete, phase])

  const meanQuality = useMemo(() => {
    const q = qualities.current
    return q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0.8
  }, [stepIndex])

  const result: StudioResult = useMemo(
    () => ({
      speciesId: species?.id ?? 'crane',
      washiId: washi?.id ?? DEFAULT_WASHI,
      golden,
      quality: meanQuality,
      creases: creases.current,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    }),
    [species, washi, golden, meanQuality],
  )

  /* Zen never ends and never pays: start a fresh sheet instead. */
  const restart = useCallback(() => {
    qualities.current = []
    creases.current = 0
    startedAt.current = Date.now()
    setStepIndex(0)
    setProgress(0)
    setPhase('folding')
  }, [])

  const leave = useCallback(() => {
    audio.play('ui.back')
    nav.back()
  }, [nav])

  if (phase === 'reveal' && species) {
    return (
      <Reveal
        species={species}
        result={result}
        mode={mode}
        recipe={recipe}
        material={material}
        onFoldAnother={restart}
        onDone={() => nav.reset('planet')}
      />
    )
  }

  return (
    <div className="pp-studio" data-gesture={step?.gesture} data-kind={step?.kind} data-phase={phase} data-complete={String(complete)} data-step={stepIndex}>
      <div className="pp-studio__desk" aria-hidden="true" />

      <header className="pp-studio__head">
        <IconButton icon="back" label="Leave the studio" onClick={leave} variant="quiet" />

        <ol
          className="pp-studio__steps"
          aria-label={`Step ${Math.min(stepIndex + 1, total)} of ${total}`}
        >
          {recipe.steps.map((s, i) => (
            <li
              key={s.id}
              className={
                'pp-studio__pip' +
                (i < stepIndex ? ' is-done' : '') +
                (i === stepIndex ? ' is-now' : '') +
                (s.kind === 'crease' ? ' is-crease' : '')
              }
              style={{ ['--pip-tilt' as string]: `${i % 2 ? 8 : -6}deg` }}
            />
          ))}
        </ol>

        {/* "Show me" used to live here, for assist mode only. It is now in the
            footer, in the thumb zone, for everyone. */}
        <div className="pp-studio__spacer" />
      </header>

      {golden && (
        <p className="pp-studio__golden">
          <Icon name="sparkle" /> Gold leaf. This one will shine.
        </p>
      )}

      <div className="pp-studio__say" key={step?.id}>
        <p className="pp-studio__instruction">{step?.instruction}</p>
        {step?.detail && <p className="pp-studio__detail">{step.detail}</p>}
      </div>

      <div className="pp-studio__arena">
        <div
          className="pp-studio__stage"
          onPointerDownCapture={coachTouch}
          onPointerMoveCapture={onPaperMove}
        >
          <FoldCanvas
            recipe={recipe}
            material={material}
            stepIndex={Math.min(stepIndex, total - 1)}
            assist={settings.assistMode}
            guides={settings.guides}
            reducedMotion={settings.reducedMotion}
            complete={complete}
            onProgress={setProgress}
            onStepComplete={onStepComplete}
            handleRef={handleRef}
          />
          <FoldCoach
            lesson={coachLesson}
            live={liveAnchors}
            authored={step?.hint ?? null}
            guides={settings.guides}
            reducedMotion={settings.reducedMotion}
          />
        </div>
      </div>

      <footer className="pp-studio__foot">
        <div className="pp-studio__meter" aria-hidden="true">
          <span style={{ transform: `scaleX(${complete ? 1 : progress})` }} />
        </div>

        <div className="pp-studio__tools">
          {/* Paper unfolds. So does this. */}
          <Button
            className="pp-studio__tool pp-studio__tool--unfold"
            variant="ghost"
            size="sm"
            icon="back"
            cue={null}
            aria-label="Unfold one step"
            onClick={unfold}
            disabled={!canUnfold}
          >
            Unfold
          </Button>

          <p className="pp-studio__count">
            {species ? `${species.name} · ` : ''}
            {complete ? 'Finished' : `Step ${stepIndex + 1} of ${total}`}
          </p>

          {/* Asking to be shown is how anyone learns a fold. */}
          <Button
            className={'pp-studio__tool pp-studio__tool--show' + (coachOpen ? ' is-nudged' : '')}
            variant="ghost"
            size="sm"
            icon="hand"
            cue={null}
            aria-label="Show me this fold"
            onClick={showMe}
            disabled={complete}
          >
            Show me
          </Button>
        </div>

        {mode === 'zen' && (
          <Button variant="quiet" size="sm" onClick={restart}>
            New sheet
          </Button>
        )}
      </footer>
    </div>
  )
}
