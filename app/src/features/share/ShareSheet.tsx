/*
 * PAPER PLANET — the share sheet: choose a shape, look at the card, send it.
 *
 * The preview is a live canvas, drawn at whatever resolution it is actually
 * displayed at; the file is composed separately, off-screen, at 2×. The two are
 * the same composer, so what you look at is what you send.
 *
 * The file is also composed *ahead of the tap* and kept. `navigator.share` needs
 * transient activation, and awaiting `toBlob` inside the handler is long enough
 * for iOS to decide the tap has expired.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audio, haptics } from '../../audio'
import { Button, Sheet, Tabs, useElementSize, useToast } from '../../ui'
import { auditPalette } from './palette'
import { cardFilename, copyBlob, saveBlob, shareBlob, shareCapabilities } from './export'
import { renderCard, renderCardBlob } from './render'
import { useCardData } from './useCardSubject'
import { usePaperTheme } from './usePaperTheme'
import { CARD_SIZE, type CardShape, type CardSpec, type CardTheme, type ShareSubject } from './types'
import './share.css'

/**
 * The card is already composed on a 2× grid (see `CARD_SIZE`), so the file goes
 * out at 1080×1080 / 1080×1920 — the sizes a feed and a story actually want,
 * and a few megabytes rather than a dozen, which matters when the next thing
 * that happens to it is `navigator.share`.
 */
const EXPORT_RATIO = 1

export interface ShareSheetProps {
  open: boolean
  onClose: () => void
  /** Memoise this at the call site — the card is rebuilt whenever it changes. */
  subject: ShareSubject
  /**
   * The moment the player asked for the card, which is the date it carries.
   * Captured in the opening handler so it cannot drift while the sheet is up;
   * defaults to when the sheet was first mounted.
   */
  now?: number
}

export function ShareSheet({ open, onClose, subject, now: openedAt }: ShareSheetProps) {
  const toast = useToast()
  const paper = usePaperTheme()
  const [shape, setShape] = useState<CardShape>('square')
  const [theme, setTheme] = useState<CardTheme | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameRef, frame] = useElementSize<HTMLDivElement>(open)

  /* One date for the life of the sheet, so it cannot change under a preview. */
  const [mountedAt] = useState(() => Date.now())
  const now = openedAt || mountedAt

  const data = useCardData(subject, shape, now)
  const cardTheme = theme ?? paper.theme

  const spec = useMemo<CardSpec>(
    () => ({ shape, theme: cardTheme, highInk: paper.highInk, pixelRatio: EXPORT_RATIO }),
    [shape, cardTheme, paper.highInk],
  )

  const caps = useMemo(() => shareCapabilities(), [])

  /* ── the preview ───────────────────────────────────────────────────────── */

  const design = CARD_SIZE[shape]
  const previewRatio = useMemo(() => {
    const css = frame.w || 320
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    return Math.max(0.35, Math.min(EXPORT_RATIO, (css * dpr) / design.w))
  }, [frame.w, design.w])

  /* `aria-busy` is written straight to the node: the preview redraws on every
     nudge of the controls, and a state flip per redraw would re-render the
     whole sheet twice for a single attribute. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!open || !data || !canvas) return
    let live = true
    canvas.setAttribute('aria-busy', 'true')
    void renderCard(canvas, data, { ...spec, pixelRatio: previewRatio }).then(() => {
      if (live) canvas.removeAttribute('aria-busy')
    })
    return () => {
      live = false
    }
  }, [open, data, spec, previewRatio])

  /* ── the file, composed before it is wanted ────────────────────────────── */

  const blobRef = useRef<{ key: string; blob: Blob } | null>(null)
  const key = data ? `${data.seed}|${shape}|${cardTheme}|${paper.highInk}` : ''

  useEffect(() => {
    if (!open || !data) return
    let live = true
    const id = window.setTimeout(() => {
      void renderCardBlob(data, spec).then((blob) => {
        if (live && blob) blobRef.current = { key, blob }
      })
    }, 120)
    return () => {
      live = false
      window.clearTimeout(id)
    }
  }, [open, data, spec, key])

  const takeBlob = useCallback(async (): Promise<Blob | null> => {
    if (blobRef.current?.key === key) return blobRef.current.blob
    if (!data) return null
    const blob = await renderCardBlob(data, spec)
    if (blob) blobRef.current = { key, blob }
    return blob
  }, [data, spec, key])

  /* ── dev only: prove the mirrored palette still matches tokens.css ─────── */
  useEffect(() => {
    if (!import.meta.env.DEV || !open) return
    const drift = auditPalette()
    if (drift.length) console.warn('[share] palette has drifted from tokens.css\n' + drift.join('\n'))
  }, [open])

  /* ── the three routes out ──────────────────────────────────────────────── */

  const filename = data ? cardFilename(data.fileStem, shape) : 'paper-planet.png'

  const fallbackSave = useCallback(
    (blob: Blob, note?: string) => {
      const result = saveBlob(blob, filename)
      if (result === 'saved') {
        toast.show({ title: 'Saved to your pictures.', note, icon: 'check', accent: 'matcha' })
      } else {
        toast.show({
          title: 'That one stayed on the desk.',
          note: 'Try again in a moment — nothing was lost.',
          icon: 'leaf',
          cue: 'ui.close',
        })
      }
    },
    [filename, toast],
  )

  const onShare = useCallback(async () => {
    const blob = await takeBlob()
    if (!blob) return fallbackNothing(toast)
    const text = data?.alt ?? 'Folded in Paper Planet.'
    const result = await shareBlob(blob, filename, text)
    if (result === 'shared') {
      haptics.fire('reward')
      return
    }
    if (result === 'cancelled') return
    fallbackSave(blob, result === 'unsupported' ? 'Sharing is not offered by this browser.' : undefined)
  }, [takeBlob, data, filename, fallbackSave, toast])

  const onSave = useCallback(async () => {
    const blob = await takeBlob()
    if (!blob) return fallbackNothing(toast)
    fallbackSave(blob)
  }, [takeBlob, fallbackSave, toast])

  const onCopy = useCallback(async () => {
    /* built around the promise, not an awaited blob: Safari drops the gesture */
    const pending = takeBlob().then((blob) => {
      if (!blob) throw new Error('no card')
      return blob
    })
    const result = await copyBlob(pending)
    if (result === 'copied') {
      audio.play('ui.confirm')
      toast.show({ title: 'Copied.', note: 'Paste it wherever you like.', icon: 'check', accent: 'matcha' })
      return
    }
    const blob = await pending.catch(() => null)
    if (!blob) return fallbackNothing(toast)
    fallbackSave(blob, 'Copying is not offered here, so it is saved instead.')
  }, [takeBlob, fallbackSave, toast])

  /* ── chrome ────────────────────────────────────────────────────────────── */

  const title = subject.kind === 'planet' ? 'Share your planet' : 'Share this fold'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      note="A card to send to someone."
      side="bottom"
      seed={`share-${shape}`}
      className="pps-sheet"
      footer={
        <div className="pps-actions">
          {caps.share && (
            <Button variant="beni" size="lg" icon="share" block onClick={() => void onShare()} cue="ui.confirm">
              Share
            </Button>
          )}
          <div className="pps-actions__row">
            <Button variant={caps.share ? 'ghost' : 'beni'} size="md" icon="camera" onClick={() => void onSave()}>
              Save
            </Button>
            {caps.copy && (
              <Button variant="ghost" size="md" onClick={() => void onCopy()}>
                Copy
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="pps-body">
        <div className="pps-preview" ref={frameRef} data-shape={shape}>
          <canvas
            ref={canvasRef}
            className="pps-canvas"
            role="img"
            aria-label={data ? data.alt : 'No card yet.'}
            style={{ aspectRatio: `${design.w} / ${design.h}` }}
          >
            {data ? data.alt : 'No card yet.'}
          </canvas>
          {!data && (
            <p className="pps-gone">
              That fold is not on your planet any more. Fold it again and the card comes back.
            </p>
          )}
        </div>

        <div className="pps-controls">
          <Tabs
            label="Card shape"
            bare
            value={shape}
            onChange={(id) => setShape(id === 'story' ? 'story' : 'square')}
            items={[
              { id: 'square', label: 'Square' },
              { id: 'story', label: 'Story' },
            ]}
          />
          <Tabs
            label="Card paper"
            bare
            value={cardTheme}
            onChange={(id) => setTheme(id === 'night' ? 'night' : 'day')}
            items={[
              { id: 'day', label: 'Daylight' },
              { id: 'night', label: 'Lantern' },
            ]}
          />
        </div>
      </div>
    </Sheet>
  )
}

/** The card could not be composed at all. Say so gently and stop. */
function fallbackNothing(toast: ReturnType<typeof useToast>): void {
  toast.show({
    title: 'The card did not set.',
    note: 'Close this and open it again — it usually takes the second time.',
    icon: 'leaf',
    cue: 'ui.close',
  })
}

export default ShareSheet
