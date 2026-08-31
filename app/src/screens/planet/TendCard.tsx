/* PAPER PLANET — the tending card. Two ways to say hello, and they are not the same. */

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { BOND_MAX, type TendKind } from '../../systems'
import { Button, IconButton, Paper } from '../../ui'
import { bondWord } from './away'
import type { Placed } from './layout'

export interface TendCardProps {
  placed: Placed
  /** Live bond, read from the store rather than the placement snapshot. */
  bond: number
  /** How much of today's 20 this Kami has left. */
  remainingToday: number
  /** Where the card sits over the world, already clamped by the caller. */
  style: CSSProperties
  /** True when the card hangs below the Kami rather than above it. */
  below: boolean
  /** The line `tendKami` just returned, held for a moment. */
  flash: string | null
  onTend: (kind: TendKind) => void
  onClose: () => void
}

/**
 * Tending used to be one tap, repeated: `tend(uid, 'pet')` and nothing else.
 * `tendKami` has always known two verbs with different weights and different
 * lines — feeding is worth 6 and says "It eats, and settles", petting is worth 2
 * and says "It leans into your hand" — and the Planet never offered the choice.
 *
 * So the tap opens this instead of spending itself. Both verbs are free, both
 * are unlimited, and both stop at the same 20 a day, so the card is a choice
 * about *how* you greet something rather than a resource to spend. There is no
 * food to run out of and nothing on this card is for sale (BRAND §12).
 */
export default function TendCard({ placed, bond, remainingToday, style, below, flash, onTend, onClose }: TendCardProps) {
  const ref = useRef<HTMLElement>(null)
  const name = placed.kami.nickname ?? placed.species.name
  const sated = remainingToday <= 0 || bond >= BOND_MAX

  /* Escape closes, whichever Kami the card is currently on. The handler is read
     through a ref so that re-rendering with a fresh `onClose` — which happens on
     every parent render, because it closes over the Kami — does not tear the
     listener down and put it back. */
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Take focus when the card opens, and hand it back to the Kami when it goes:
     a keyboard player should not be dropped at the top of the world every time
     they say hello to something. */
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null
    ref.current?.focus({ preventScroll: true })
    return () => {
      if (from?.isConnected) from.focus({ preventScroll: true })
    }
  }, [placed.kami.uid])

  return (
    <Paper
      ref={ref}
      elevation={3}
      edge="cut"
      tone={0}
      grain
      seed={placed.kami.uid}
      className={'pp-planet__tend' + (below ? ' is-below' : '')}
      style={style}
      role="dialog"
      aria-label={`Tend ${name}`}
      tabIndex={-1}
    >
      <div className="pp-planet__tendhead">
        <div>
          <p className="pp-planet__tendname">{name}</p>
          <p className={'pp-planet__tendnote' + (flash !== null ? ' is-flash' : '')} aria-live="polite">
            {flash ?? (sated ? 'It has had plenty today. Come back tomorrow.' : bondWord(bond))}
          </p>
        </div>
        <IconButton icon="close" label={`Leave ${name} be`} variant="quiet" size="sm" onClick={onClose} />
      </div>

      <div
        className="pp-planet__bond"
        role="img"
        aria-label={`Bond ${Math.round(bond)} of ${BOND_MAX}`}
      >
        <span style={{ width: `${Math.max(2, Math.min(100, bond))}%` }} />
      </div>

      <div className="pp-planet__tendacts">
        <Button
          variant="beni"
          size="sm"
          icon="leaf"
          cue={null}
          className={sated ? 'is-sated' : undefined}
          onClick={() => onTend('feed')}
        >
          Feed
        </Button>
        <Button
          variant="soft"
          size="sm"
          icon="hand"
          cue={null}
          className={sated ? 'is-sated' : undefined}
          onClick={() => onTend('pet')}
        >
          Pet
        </Button>
      </div>
    </Paper>
  )
}
