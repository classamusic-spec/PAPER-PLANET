/* PAPER PLANET — the reveal. The paper stops being paper. */

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FoldRecipe,
  PaperMaterial,
  Species,
  StudioResult,
  StudioSession,
} from '../../contracts'
import { actions } from '../../systems'
import { audio, haptics } from '../../audio'
import { Button, Icon, Paper } from '../../ui'
import KamiMark from '../codex/KamiMark'
import FoldCanvas from './FoldCanvas'
import './reveal.css'

/** What `actions.completeFold` hands back. Narrowed to what this screen shows. */
interface Outcome {
  reward?: { sheets?: number; lines?: string[] }
  goldLeaf?: number
  masteryFrom?: string
  masteryTo?: string
  newBiomes?: string[]
  unlockedSpecies?: string[]
  message?: string
  kami?: { uid: string } | null
}

export default function Reveal({
  species,
  result,
  mode,
  recipe,
  material,
  onFoldAnother,
  onDone,
  onFoldAlong,
}: {
  species: Species
  result: StudioResult
  mode: StudioSession['mode']
  recipe: FoldRecipe
  material: PaperMaterial
  onFoldAnother: () => void
  onDone: () => void
  /** Take this same fold to the diagrams, for real paper. */
  onFoldAlong: () => void
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [name, setName] = useState('')
  const [naming, setNaming] = useState(false)
  const [alive, setAlive] = useState(false)
  const settled = useRef(false)

  /* A held breath, then the paper is a creature. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setAlive(true)
      audio.play('alive.breath')
      haptics.fire('alive')
    }, 620)
    return () => clearTimeout(t)
  }, [])

  /* Award exactly once. Zen is its own reward and pays nothing, by contract. */
  useEffect(() => {
    if (settled.current) return
    settled.current = true
    actions.recordStudioTime(result.seconds, result.creases)
    if (mode === 'zen') {
      setOutcome({})
      return
    }
    const out = actions.completeFold(result, mode) as unknown as Outcome
    setOutcome(out)
    if (out?.goldLeaf) {
      window.setTimeout(() => audio.play('reward.goldleaf'), 620)
    } else if (out?.reward?.sheets) {
      window.setTimeout(() => audio.play('reward.sheets'), 620)
    }
    if (out?.masteryTo && out.masteryTo !== out.masteryFrom) {
      window.setTimeout(() => {
        audio.play('reward.mastery')
        haptics.fire('reward')
      }, 980)
    }
  }, [result, mode])

  const quality = Math.round(result.quality * 100)
  const craft = useMemo(() => {
    if (quality >= 92) return 'Crisp as a new sheet.'
    if (quality >= 78) return 'Cleanly folded.'
    if (quality >= 60) return 'Softly folded — it suits them.'
    return 'A little rumpled. They do not seem to mind.'
  }, [quality])

  const commitName = () => {
    const uid = outcome?.kami?.uid
    const trimmed = name.trim()
    if (uid && trimmed) actions.renameKami(uid, trimmed.slice(0, 24))
    setNaming(false)
    audio.play('ui.confirm')
  }

  return (
    <div className="pp-reveal">
      <div className="pp-reveal__desk" aria-hidden="true" />

      {/*
        The paper you folded, and then the creature it becomes.

        Showing only the raw folded sheet was the weakest moment in the app: a
        four-step butterfly is, geometrically, a triangle — correct, and deeply
        unsatisfying to be handed as your reward. So the sheet holds for a beat
        and then turns into the Kami.
      */}
      <div className={'pp-reveal__stage' + (alive ? ' is-alive' : '')}>
        <div className="pp-reveal__paper" aria-hidden={alive}>
          <FoldCanvas
            recipe={recipe}
            material={material}
            stepIndex={recipe.steps.length - 1}
            assist={false}
            guides={false}
            reducedMotion={false}
            complete
            fill={0.95}
          />
        </div>
        <div className="pp-reveal__kami">
          <KamiMark
            art={species.art}
            name={species.name}
            size="100%"
            mode="folded"
            gold={result.golden}
          />
        </div>
      </div>

      <div className="pp-reveal__card">
        <Paper elevation={3} edge="deckle" tone={0} tilt={-0.8} grain>
          <div className="pp-reveal__inner">
            <p className="pp-reveal__eyebrow">
              {result.golden ? 'Gold leaf' : species.rarity}
            </p>

            {naming ? (
              <form
                className="pp-reveal__nameform"
                onSubmit={(e) => {
                  e.preventDefault()
                  commitName()
                }}
              >
                <label className="pp-reveal__namelabel" htmlFor="pp-name">
                  What will you call them?
                </label>
                <input
                  id="pp-name"
                  className="pp-reveal__nameinput"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  placeholder={species.name}
                  autoFocus
                />
                <Button type="submit" variant="matcha" size="sm">
                  That&rsquo;s the one
                </Button>
              </form>
            ) : (
              <>
                <h1 className="pp-reveal__name">{name.trim() || species.name}</h1>
                <p className="pp-reveal__binomial">{species.binomial}</p>
                <button
                  type="button"
                  className="pp-reveal__rename"
                  onClick={() => {
                    setNaming(true)
                    audio.play('ui.tap')
                  }}
                >
                  <Icon name="plus" /> Give them a name
                </button>
              </>
            )}

            <p className="pp-reveal__craft">{craft}</p>

            {mode !== 'zen' && outcome && (
              <ul className="pp-reveal__rewards">
                {!!outcome.reward?.sheets && (
                  <li>
                    <Icon name="sheets" /> {outcome.reward.sheets} Sheets
                  </li>
                )}
                {!!outcome.goldLeaf && (
                  <li>
                    <Icon name="goldleaf" /> {outcome.goldLeaf} Gold Leaf
                  </li>
                )}
                {outcome.masteryTo && outcome.masteryTo !== outcome.masteryFrom && (
                  <li className="is-mastery">
                    <Icon name="crown" /> {outcome.masteryTo}
                  </li>
                )}
                {outcome.newBiomes?.map((b) => (
                  <li key={b} className="is-unlock">
                    <Icon name="mountain" /> {b} opened
                  </li>
                ))}
                {outcome.unlockedSpecies?.map((s) => (
                  <li key={s} className="is-unlock">
                    <Icon name="fold" /> {s} unlocked
                  </li>
                ))}
              </ul>
            )}

            <p className="pp-reveal__fact">{species.codex.fact}</p>

            {/* The best moment in the app to offer real paper: they have just
                made this thing and can see it. Offered, never pushed — it sits
                as a line, not a third button competing with the other two. */}
            <button type="button" className="pp-reveal__real" onClick={onFoldAlong}>
              <Icon name="sheets" size={14} />
              <span>Now fold {species.name.toLowerCase()} on real paper</span>
              <Icon name="chevron" size={13} />
            </button>

            <div className="pp-reveal__actions">
              <Button variant="quiet" onClick={onFoldAnother}>
                Fold another
              </Button>
              <Button variant="beni" onClick={onDone}>
                To the planet
              </Button>
            </div>
          </div>
        </Paper>
      </div>
    </div>
  )
}
