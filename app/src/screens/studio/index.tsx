/* PAPER PLANET — The Studio. Where paper becomes a creature. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaperMaterial, StudioResult, StudioSession } from '../../contracts'
import { getSpecies, getWashi, DEFAULT_WASHI } from '../../content'
import { actions, useActiveWashi, useSettings } from '../../systems'
import { audio, haptics } from '../../audio'
import { useNavigation, useRouteParams } from '../../shell/Navigator'
import { Button, IconButton, Icon } from '../../ui'
import FoldCanvas, { type FoldCanvasHandle } from './FoldCanvas'
import Reveal from './Reveal'
import { TEST_RECIPE } from './testRecipe'
import './studio.css'

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

        {settings.assistMode ? (
          <IconButton
            icon="hand"
            label="Show me this fold"
            variant="quiet"
            onClick={() => handleRef.current?.demonstrate()}
          />
        ) : (
          <div className="pp-studio__spacer" />
        )}
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
      </div>

      <footer className="pp-studio__foot">
        <div className="pp-studio__meter" aria-hidden="true">
          <span style={{ transform: `scaleX(${complete ? 1 : progress})` }} />
        </div>
        <p className="pp-studio__count">
          {species ? `${species.name} · ` : ''}
          {complete ? 'Finished' : `Step ${stepIndex + 1} of ${total}`}
        </p>
        {mode === 'zen' && (
          <Button variant="quiet" size="sm" onClick={restart}>
            New sheet
          </Button>
        )}
      </footer>
    </div>
  )
}
