/*
 * PAPER PLANET — the affordance. A cut-paper icon, and the sheet it opens.
 *
 * It owns its own open state so a screen can drop one anywhere without
 * threading a boolean through itself. The sheet is only mounted once it has
 * been asked for: the composer, the fibre tiles and the font wait are all
 * several hundred kilobytes of work nobody has requested yet.
 */

import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, IconButton, type ButtonSize, type ButtonVariant } from '../../ui'
import { ShareSheet } from './ShareSheet'
import type { ShareSubject } from './types'

export interface ShareButtonProps {
  /** What the card will be about. */
  subject: ShareSubject
  /** The accessible name. Always says what is being shared. */
  label: string
  /** Show the label as text beside the icon instead of only to a screen reader. */
  withLabel?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  style?: CSSProperties
}

export function ShareButton({
  subject,
  label,
  withLabel = false,
  variant = 'ghost',
  size = 'md',
  className,
  style,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [used, setUsed] = useState(false)
  const [openedAt, setOpenedAt] = useState(0)

  /* Rebuilt from primitives, so a caller passing a fresh object literal on
     every render does not make the sheet recompose the card on every render. */
  const kind = subject.kind
  const id = subject.kind === 'kami' ? subject.uid : subject.kind === 'species' ? subject.speciesId : ''
  const stable = useMemo<ShareSubject>(() => {
    if (kind === 'planet') return { kind: 'planet' }
    if (kind === 'kami') return { kind: 'kami', uid: id }
    return { kind: 'species', speciesId: id }
  }, [kind, id])

  const show = useCallback(() => {
    setUsed(true)
    setOpenedAt(Date.now())
    setOpen(true)
  }, [])

  return (
    <>
      {withLabel ? (
        <Button
          variant={variant}
          size={size}
          icon="share"
          className={className}
          style={style}
          onClick={show}
          cue="ui.open"
        >
          {label}
        </Button>
      ) : (
        <IconButton
          icon="share"
          label={label}
          variant={variant}
          size={size}
          className={className}
          style={style}
          onClick={show}
          cue="ui.open"
        />
      )}
      {used && <ShareSheet open={open} onClose={() => setOpen(false)} subject={stable} now={openedAt} />}
    </>
  )
}

export default ShareButton
