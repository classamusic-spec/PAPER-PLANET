/* PAPER PLANET — The Studio. Where paper becomes a creature. */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { PaperMaterial } from '../../contracts'
import FoldCanvas, { type FoldCanvasHandle } from './FoldCanvas'
import { TEST_RECIPE } from './testRecipe'
import './studio.css'

const MATERIAL: PaperMaterial = { front: 'var(--beni)', back: 'var(--paper-back)' }

export default function StudioScreen() {
  const recipe = TEST_RECIPE
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [qualities, setQualities] = useState<number[]>([])
  const handleRef = useRef<FoldCanvasHandle | null>(null)

  const total = recipe.steps.length
  const step = recipe.steps[stepIndex]
  const complete = stepIndex >= total

  const onStepComplete = useCallback(
    (quality: number) => {
      setQualities((q) => [...q, quality])
      setProgress(0)
      setStepIndex((i) => i + 1)
    },
    [],
  )

  const meanQuality = useMemo(
    () => (qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0),
    [qualities],
  )

  return (
    <div className="pp-studio">
      {/* ── the desk ─────────────────────────────────────────────────────── */}
      <div className="pp-studio__desk" aria-hidden="true" />

      {/* ── header ───────────────────────────────────────────────────────── */}
      <header className="pp-studio__head">
        <button type="button" className="pp-studio__back" aria-label="Leave the studio">
          ←
        </button>
        <ol className="pp-studio__steps" aria-label={`Step ${Math.min(stepIndex + 1, total)} of ${total}`}>
          {recipe.steps.map((s, i) => (
            <li
              key={s.id}
              className={
                'pp-studio__pip' +
                (i < stepIndex ? ' is-done' : '') +
                (i === stepIndex ? ' is-now' : '') +
                (s.kind === 'crease' ? ' is-crease' : '')
              }
              style={{ transform: `rotate(${i % 2 ? 8 : -6}deg)` }}
            />
          ))}
        </ol>
        <div className="pp-studio__spacer" />
      </header>

      {/* ── the instruction: a patient teacher, not a HUD ─────────────────── */}
      {!complete && step && (
        <div className="pp-studio__say" key={step.id}>
          <p className="pp-studio__instruction">{step.instruction}</p>
          {step.detail && <p className="pp-studio__detail">{step.detail}</p>}
        </div>
      )}
      {complete && (
        <div className="pp-studio__say">
          <p className="pp-studio__instruction">It&rsquo;s alive.</p>
          <p className="pp-studio__detail">
            Folded at {Math.round(meanQuality * 100)}% — drag to look around it.
          </p>
        </div>
      )}

      {/* ── the paper ────────────────────────────────────────────────────── */}
      <div className="pp-studio__arena">
        <FoldCanvas
          recipe={recipe}
          material={MATERIAL}
          stepIndex={Math.min(stepIndex, total - 1)}
          assist={false}
          guides
          reducedMotion={false}
          complete={complete}
          onProgress={setProgress}
          onStepComplete={onStepComplete}
          handleRef={handleRef}
        />
      </div>

      {/* ── footer ───────────────────────────────────────────────────────── */}
      <footer className="pp-studio__foot">
        <div className="pp-studio__meter" aria-hidden="true">
          <span style={{ transform: `scaleX(${complete ? 1 : progress})` }} />
        </div>
        <p className="pp-studio__count">
          {complete ? 'Finished' : `Step ${stepIndex + 1} of ${total}`}
        </p>
      </footer>
    </div>
  )
}
