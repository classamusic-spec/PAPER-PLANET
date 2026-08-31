// PAPER PLANET — <Sheet>: a sheet slid onto a dimmed desk. Bottom sheet or centred modal.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import type { Elevation } from '../contracts'
import { Paper } from './Paper'
import type { EdgeKind } from './paperShapes'
import { IconButton } from './Button'
import { useEscape, useFocusTrap, useScrollLock, usePaperSound, useReducedMotion } from './hooks'

export interface SheetProps {
  open: boolean
  /** Called for every dismissal route: backdrop, Escape, drag, close button. */
  onClose: () => void
  title?: ReactNode
  /** One quiet line under the title. */
  note?: ReactNode
  /** `bottom` is the thumb-reachable default; `center` is a decision modal. */
  side?: 'bottom' | 'center'
  children?: ReactNode
  /** Actions, pinned below the scrolling body. */
  footer?: ReactNode
  /** Show the ✕. Off for sheets you only leave by choosing something. */
  closable?: boolean
  /** Allow backdrop tap / Escape / drag-down. */
  dismissible?: boolean
  elevation?: Elevation
  edge?: EdgeKind
  seed?: string | number
  className?: string
  style?: CSSProperties
}

const DRAG_CLOSE_PX = 92
const DRAG_CLOSE_VELOCITY = 0.55

export function Sheet({
  open,
  onClose,
  title,
  note,
  side = 'bottom',
  children,
  footer,
  closable = true,
  dismissible = true,
  elevation = 4,
  edge = 'deckle',
  seed,
  className,
  style,
}: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const sheetRef = useRef<HTMLElement | null>(null)
  const play = usePaperSound()
  const reduced = useReducedMotion()
  const titleId = useId()
  const noteId = useId()

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      play('ui.open')
    } else if (mounted) {
      setClosing(true)
    }
    // `mounted` is intentionally not a dependency: this reacts to `open` alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const dismiss = useCallback(() => {
    if (!dismissible) return
    play('ui.close')
    onClose()
  }, [dismissible, onClose, play])

  useEscape(mounted && !closing && dismissible, dismiss)
  useFocusTrap(sheetRef, mounted && !closing)
  useScrollLock(mounted)

  /* ── drag to dismiss ───────────────────────────────────────────────────
     Pointer maths happens on the element directly: no React render per move,
     so the sheet tracks the thumb at refresh rate. */
  const drag = useRef({ active: false, startY: 0, startT: 0, dy: 0, id: -1 })

  const onGripDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dismissible || side !== 'bottom') return
    const el = sheetRef.current
    if (!el) return
    drag.current = { active: true, startY: e.clientY, startT: performance.now(), dy: 0, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    el.style.animation = 'none'
    el.style.transition = 'none'
    play('sheet.lift')
  }

  const onGripMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = sheetRef.current
    if (!drag.current.active || !el) return
    const raw = e.clientY - drag.current.startY
    // pulling up past the stop resists, like paper against a desk edge
    const dy = raw < 0 ? raw * 0.22 : raw
    drag.current.dy = dy
    el.style.transform = `translate3d(0, ${dy}px, 0) rotate(${(dy / 260).toFixed(2)}deg)`
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = sheetRef.current
    if (!drag.current.active || !el) return
    const { dy, startT } = drag.current
    drag.current.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    const velocity = dy / Math.max(1, performance.now() - startT)
    if (dy > DRAG_CLOSE_PX || velocity > DRAG_CLOSE_VELOCITY) {
      dismiss()
      return
    }
    el.style.transition = `transform var(--t-base) var(--ease-settle)`
    el.style.transform = 'translate3d(0,0,0) rotate(0deg)'
    play('sheet.settle')
  }

  const onAnimationEnd = (): void => {
    if (!closing) return
    setClosing(false)
    setMounted(false)
    const el = sheetRef.current
    if (el) {
      el.style.transform = ''
      el.style.transition = ''
      el.style.animation = ''
    }
  }

  /* a closing sheet whose animation never fires (reduced motion + no transition)
     still has to leave the tree */
  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(onAnimationEnd, reduced ? 200 : 640)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, reduced])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className="pp-scrim" data-closing={closing ? 'true' : undefined} onClick={dismiss} aria-hidden />
      <div className="pp-sheet-host" data-side={side}>
        <Paper
          ref={sheetRef}
          className={className ? `pp-sheet ${className}` : 'pp-sheet'}
          role="dialog"
          aria-modal
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={note ? noteId : undefined}
          elevation={elevation}
          edge={edge}
          tone={0}
          tilt={0}
          radius={side === 'bottom' ? 'xl' : 'lg'}
          seed={seed}
          data-closing={closing ? 'true' : undefined}
          style={style}
          onAnimationEnd={onAnimationEnd}
        >
          {side === 'bottom' && dismissible ? (
            <div
              className="pp-sheet__grip"
              onPointerDown={onGripDown}
              onPointerMove={onGripMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              role="button"
              tabIndex={-1}
              aria-label="Drag down to close"
            />
          ) : null}

          {title || closable ? (
            <div className="pp-sheet__head">
              <div style={{ flex: 1, minWidth: 0 }}>
                {title ? (
                  <h2 className="pp-sheet__title" id={titleId}>
                    {title}
                  </h2>
                ) : null}
                {note ? (
                  <p className="pp-sheet__note" id={noteId}>
                    {note}
                  </p>
                ) : null}
              </div>
              {closable ? (
                <IconButton icon="close" label="Close" variant="quiet" size="md" cue="ui.close" onClick={dismiss} />
              ) : null}
            </div>
          ) : null}

          <div className="pp-sheet__body">{children}</div>
          {footer ? <div className="pp-sheet__foot">{footer}</div> : null}
        </Paper>
      </div>
    </>,
    document.body,
  )
}
