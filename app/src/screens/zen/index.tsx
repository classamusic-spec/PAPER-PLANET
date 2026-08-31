/* PAPER PLANET — Zen Mode. The game gets out of the way. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AmbienceId, PaperMaterial, Species } from '../../contracts'
import { allSpecies, getSpecies } from '../../content'
import { actions, useGame, useSettings } from '../../systems'
import { audio } from '../../audio'
import { useNavigation } from '../../shell/Navigator'
import { Chip, Icon, IconButton, Sheet } from '../../ui'
import FoldCanvas from '../studio/FoldCanvas'
import './zen.css'

const BEDS: { id: AmbienceId; label: string }[] = [
  { id: 'meadow', label: 'Meadow' },
  { id: 'rain', label: 'Rain' },
  { id: 'shore', label: 'Shore' },
  { id: 'night', label: 'Night' },
  { id: 'tearoom', label: 'Tea room' },
  { id: 'none', label: 'Silence' },
]

/** Controls fade away while you fold, and come back when you touch the edge. */
const IDLE_MS = 6000

export default function ZenScreen() {
  const nav = useNavigation()
  const settings = useSettings()
  const folds = useGame((s) => s.folds)

  /* Zen offers what you already know how to fold — it teaches nothing. */
  const pool = useMemo<Species[]>(() => {
    const known = allSpecies().filter((s) => (folds[s.id] ?? 0) > 0)
    if (known.length) return known
    const crane = getSpecies('crane')
    return crane ? [crane] : allSpecies().slice(0, 1)
  }, [folds])

  const [which, setWhich] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [picking, setPicking] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const idle = useRef<number | null>(null)

  const species = pool[which % Math.max(1, pool.length)]
  const recipe = species?.recipe
  const total = recipe?.steps.length ?? 0
  const step = recipe?.steps[Math.min(stepIndex, Math.max(0, total - 1))]

  const material: PaperMaterial = useMemo(
    () => species?.material ?? { front: 'var(--beni)', back: 'var(--paper-back)' },
    [species],
  )

  /* Zen owns the soundscape: no ducking, no music unless asked. */
  useEffect(() => {
    audio.setFocusMode(false)
    audio.setAmbience(settings.ambience ?? 'meadow', 2.4)
    return () => audio.frictionEnd()
  }, [settings.ambience])

  const wake = useCallback(() => {
    setQuiet(false)
    if (idle.current) clearTimeout(idle.current)
    idle.current = window.setTimeout(() => setQuiet(true), IDLE_MS)
  }, [])

  useEffect(() => {
    wake()
    return () => {
      if (idle.current) clearTimeout(idle.current)
    }
  }, [wake])

  /* A finished sheet is simply replaced by a fresh one. Nothing is awarded,
     nothing is recorded, nothing ends. */
  const onStepComplete = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1
      if (next >= total) {
        window.setTimeout(() => {
          setStepIndex(0)
          setWhich((w) => (pool.length > 1 ? (w + 1) % pool.length : w))
          audio.play('sheet.pickup')
        }, 1600)
        return next
      }
      return next
    })
  }, [total, pool.length])

  if (!species || !recipe) return null

  return (
    <div className={'pp-zen' + (quiet ? ' is-quiet' : '')} onPointerDown={wake}>
      <div className="pp-zen__ground" aria-hidden="true" />

      <header className="pp-zen__chrome pp-zen__head">
        <IconButton icon="back" label="Leave Zen" variant="quiet" onClick={() => nav.back()} />
        <p className="pp-zen__name">{species.name}</p>
        <IconButton
          icon="sound-on"
          label="Choose an ambience"
          variant="quiet"
          onClick={() => {
            setPicking(true)
            wake()
          }}
        />
      </header>

      <div className="pp-zen__arena">
        <FoldCanvas
          recipe={recipe}
          material={material}
          stepIndex={Math.min(stepIndex, total - 1)}
          assist={settings.assistMode}
          guides={settings.guides}
          reducedMotion={settings.reducedMotion}
          complete={stepIndex >= total}
          onStepComplete={onStepComplete}
          fill={0.88}
        />
      </div>

      {/* A breathing guide you can fold along with. Nothing counts it. */}
      <footer className="pp-zen__foot">
        <div className="pp-zen__breath" aria-hidden="true">
          <span />
        </div>
        <p className="pp-zen__say">{step?.instruction}</p>
      </footer>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Ambience"
        note="Nothing here is scored, timed, or saved."
      >
        <div className="pp-zen__beds">
          {BEDS.map((b) => (
            <Chip
              key={b.id}
              selected={(settings.ambience ?? 'meadow') === b.id}
              onClick={() => {
                actions.updateSettings({ ambience: b.id })
                audio.setAmbience(b.id, 1.6)
              }}
            >
              {b.label}
            </Chip>
          ))}
        </div>
        <div className="pp-zen__pick">
          <p className="pp-zen__pick-label">
            <Icon name="fold" size={12} /> What to fold
          </p>
          <div className="pp-zen__beds">
            {pool.map((s, i) => (
              <Chip
                key={s.id}
                selected={i === which % pool.length}
                onClick={() => {
                  setWhich(i)
                  setStepIndex(0)
                  audio.play('ui.tap')
                }}
              >
                {s.name}
              </Chip>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
