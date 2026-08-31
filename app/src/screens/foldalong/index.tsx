/* PAPER PLANET — Fold Along.

   The point of teaching is that you can then fold a real sheet. This is the
   mode for that: one step to a page, big, advanced by tap, because your hands
   are holding paper and cannot perform a gesture. No game view — the diagram,
   in the notation a book uses, so what you learn here you can take to any book.

   See docs/ORIGAMI.md §4.4. */

import { useCallback, useMemo, useState } from 'react'
import type { PaperMaterial } from '../../contracts'
import { getSpecies } from '../../content'
import { audio, haptics } from '../../audio'
import { useNavigation, useRouteParams } from '../../shell/Navigator'
import { Button, Icon, IconButton } from '../../ui'
import Diagram from './Diagram'
import { CP_SIDE, buildCreasePattern, buildDiagrams, facingNote } from './diagram'
import './foldalong.css'

/** A comfortable first sheet. Small paper punishes a beginner's fingers. */
const PAPER_NOTE = 'A square. 15 cm is comfortable; anything smaller fights you.'

export default function FoldAlongScreen() {
  const nav = useNavigation()
  const { speciesId } = useRouteParams<{ speciesId: string }>()
  const species = getSpecies(speciesId ?? '')
  /* Plain paper, always. A diagram is ink on white: a patterned or foiled
     sheet would say something about the washi and nothing about the fold. */
  const material: PaperMaterial = useMemo(
    () => ({ front: species?.material.front ?? '#E4664F', back: species?.material.back ?? '#F6EFE2' }),
    [species],
  )

  const set = useMemo(() => (species ? buildDiagrams(species.recipe, material) : null), [species, material])
  const creasePattern = useMemo(() => (species ? buildCreasePattern(species.recipe) : []), [species])

  /* Page 0 is the paper itself: what to cut, and which way up. */
  const [page, setPage] = useState(0)
  const last = set ? set.plates.length : 0

  const go = useCallback(
    (to: number) => {
      const clamped = Math.max(0, Math.min(last, to))
      setPage((cur) => {
        if (clamped === cur) return cur
        audio.play('sheet.slide', { volume: 0.55 })
        haptics.fire('tick')
        return clamped
      })
    },
    [last],
  )

  if (!species || !set) {
    return (
      <div className="pp-fa pp-fa--empty">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <p>That fold is not in the book.</p>
      </div>
    )
  }

  const plate = page > 0 ? set.plates[page - 1] : null
  const isSetup = page === 0
  const isDone = plate !== null && plate.step === null
  const first = set.plates[0]

  return (
    <div className="pp-fa">
      <header className="pp-fa__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <div className="pp-fa__title">
          <h1>{species.name}</h1>
          <p>Fold along</p>
        </div>
        <IconButton
          icon="share"
          label="Print these diagrams"
          variant="quiet"
          onClick={() => window.print()}
        />
      </header>

      {/* ── the page ─────────────────────────────────────────────────────── */}
      {/* Tap anywhere advances, because your hands are on paper — but the tap
          target is its own empty button laid over the page rather than a button
          wrapped around it. A button may not contain a heading or a list, and a
          screen reader handed the whole page as one control reads a wall. */}
      <div className="pp-fa__page">
        <button
          type="button"
          className="pp-fa__tap"
          onClick={() => go(page + 1)}
          disabled={page >= last}
          aria-label={page >= last ? 'The last step' : 'Next step'}
        />
        {isSetup ? (
          <div className="pp-fa__setup">
            <Diagram
              plate={first}
              viewBox={set.viewBox}
              front={material.front}
              back={material.back}
              label={`A square sheet, ${facingNote(first.facing).toLowerCase()}`}
              className="pp-fa__dia"
            />
            <h2>Before you start</h2>
            <ul className="pp-fa__setuplist">
              <li>
                <Icon name="sheets" size={16} /> {PAPER_NOTE}
              </li>
              <li>
                <Icon name="sun" size={16} /> {facingNote(first.facing)} The side you can see
                here is the side you should be looking at.
              </li>
              <li>
                <Icon name="hand" size={16} /> Crease every fold with a fingernail. Sharp
                creases are most of what makes a model look folded rather than bent.
              </li>
            </ul>
            <p className="pp-fa__tapnote">Tap anywhere to begin.</p>
          </div>
        ) : (
          plate && (
            <div className="pp-fa__plate">
              <Diagram
                plate={plate}
                viewBox={set.viewBox}
                front={material.front}
                back={material.back}
                label={
                  isDone
                    ? `The finished ${species.name}.`
                    : `Step ${plate.n}. ${plate.step?.instruction ?? ''} ${plate.landmark?.line ?? ''}`
                }
                className="pp-fa__dia"
              />
              <div className="pp-fa__say">
                <p className="pp-fa__n">{isDone ? 'Done' : `Step ${plate.n} of ${last - 1}`}</p>
                <h2>{isDone ? `A ${species.name.toLowerCase()}.` : plate.step?.instruction}</h2>
                {plate.landmark && (
                  <p className="pp-fa__ref">
                    <span className="pp-fa__reftick" aria-hidden="true" />
                    {plate.landmark.line}
                  </p>
                )}
                {/* A reader who does not notice the viewpoint moved will fold
                    the wrong thing. Books say it; so do we. */}
                {plate.view === 'angled' && !isDone && (
                  <p className="pp-fa__turned">
                    <Icon name="rotate" size={13} /> Seen from an angle — flat, this fold is
                    edge-on.
                  </p>
                )}
                {!isDone && plate.step?.detail && <p className="pp-fa__detail">{plate.step.detail}</p>}
                {isDone && (
                  <p className="pp-fa__detail">
                    Made on real paper. That is the whole point of the app.
                  </p>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* ── the controls ─────────────────────────────────────────────────── */}
      <footer className="pp-fa__foot">
        <Button variant="quiet" onClick={() => go(page - 1)} disabled={page === 0}>
          <Icon name="back" size={14} /> Back
        </Button>
        <ol className="pp-fa__dots" aria-hidden="true">
          {set.plates.map((p) => (
            <li key={p.n} className={p.n === page ? 'is-here' : p.n < page ? 'is-done' : ''} />
          ))}
        </ol>
        <Button variant="beni" onClick={() => go(page + 1)} disabled={page >= last}>
          Next <Icon name="fold" size={14} />
        </Button>
      </footer>

      {/* ── the printable sheet ──────────────────────────────────────────── */}
      <section className="pp-fa__print" aria-hidden="true">
        <header className="pp-fa__printhead">
          <h2>{species.name}</h2>
          <p>
            {species.binomial} · {PAPER_NOTE} {facingNote(first.facing)}
          </p>
        </header>
        <ol className="pp-fa__grid">
          {set.plates.map((p) => (
            <li key={p.n}>
              <Diagram
                plate={p}
                viewBox={set.viewBox}
                front={material.front}
                back={material.back}
                label=""
                className="pp-fa__dia"
              />
              <p>
                <strong>{p.step ? p.n : '✓'}</strong>{' '}
                {p.step ? p.step.instruction : `A ${species.name.toLowerCase()}.`}
                {p.landmark ? ` ${p.landmark.line}.` : ''}
                {p.view === 'angled' && p.step ? ' (Seen from an angle.)' : ''}
              </p>
            </li>
          ))}
        </ol>
        <div className="pp-fa__cp">
          <h3>The crease pattern</h3>
          <svg viewBox={`-40 -40 ${CP_SIDE + 80} ${CP_SIDE + 80}`} className="pp-dia" role="img" aria-label="">
            <rect x={0} y={0} width={CP_SIDE} height={CP_SIDE} className="pp-fa__cpsheet" />
            {creasePattern.map((c, i) => (
              <line
                key={i}
                x1={c.a[0]}
                y1={c.a[1]}
                x2={c.b[0]}
                y2={c.b[1]}
                className={'pp-dia__crease pp-dia__crease--' + c.direction}
                strokeWidth={5}
              />
            ))}
          </svg>
          <p>
            Dashed is a valley, dash–dot is a mountain. Unfold a finished model and this is
            what is left — the whole design in one picture.
          </p>
        </div>
        {/* docs/ORIGAMI.md section 1: the classical bases have no author and
            never had one, and the figure on top of this one is ours. Both halves
            of that are safe to give away, so say so plainly. */}
        <p className="pp-fa__printfoot">
          PAPER PLANET ·{' '}
          {species.recipe.base && species.recipe.base !== 'none'
            ? `Folded from the ${species.recipe.base} base — centuries old, and nobody's to own.`
            : 'Our own fold.'}{' '}
          These diagrams are ours: copy them, teach from them, give them away.
        </p>
      </section>
    </div>
  )
}
