/*
 * PAPER PLANET — getting the card off the phone.
 *
 * Three routes, and the honest truth is that only one of them exists
 * everywhere:
 *
 *   share  · `navigator.share({ files })` — iOS, Android, Edge. The good one.
 *   copy   · `ClipboardItem` with an image/png — Chromium, Safari 13.1+.
 *   save   · an object URL and a `download` attribute. Everywhere.
 *
 * Every route can fail, and a failed share is not an error — the player pressed
 * a button and wanted a picture. So each one degrades to the next, quietly, and
 * the caller is told what actually happened so it can say something warm.
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'saved' | 'copied' | 'unsupported' | 'failed'

/** `ClipboardItem.supports` is newer than the type definitions. */
interface ClipboardItemCtor {
  new (items: Record<string, Blob | Promise<Blob>>): ClipboardItem
  supports?: (type: string) => boolean
}

function clipboardItemCtor(): ClipboardItemCtor | null {
  if (typeof globalThis === 'undefined') return null
  const ctor = (globalThis as { ClipboardItem?: unknown }).ClipboardItem
  return typeof ctor === 'function' ? (ctor as ClipboardItemCtor) : null
}

/* ── what this browser can actually do ───────────────────────────────────── */

export interface ShareCapabilities {
  share: boolean
  copy: boolean
  save: boolean
}

/** A one-byte PNG, only ever used to ask `canShare` an honest question. */
const PROBE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

let cached: ShareCapabilities | null = null

export function shareCapabilities(): ShareCapabilities {
  if (cached) return cached
  let share = false
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File === 'function') {
      const probe = new File([PROBE], 'probe.png', { type: 'image/png' })
      share = navigator.canShare({ files: [probe] })
    }
  } catch {
    share = false
  }

  let copy = false
  try {
    const ctor = clipboardItemCtor()
    const supported = ctor?.supports ? ctor.supports('image/png') : true
    copy = Boolean(ctor) && supported && typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.write)
  } catch {
    copy = false
  }

  const save = typeof document !== 'undefined' && 'download' in document.createElement('a')
  cached = { share, copy, save }
  return cached
}

/** Forget the probe. Only the tests and the dev harness need this. */
export function resetShareCapabilities(): void {
  cached = null
}

/* ── the routes ──────────────────────────────────────────────────────────── */

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/**
 * Hand the file to the system sheet. Cancelling is a normal thing a person
 * does, so it comes back as `cancelled` and the caller says nothing at all.
 */
export async function shareBlob(blob: Blob, filename: string, text: string): Promise<ShareOutcome> {
  const caps = shareCapabilities()
  if (!caps.share) return 'unsupported'
  try {
    const file = new File([blob], filename, { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return 'unsupported'
    await navigator.share({ files: [file], title: 'Paper Planet', text })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
      return 'cancelled'
    }
    return 'failed'
  }
}

/**
 * Save it. The object URL is revoked on the next frame rather than immediately,
 * because Safari has not started reading it yet when the click returns.
 */
export function saveBlob(blob: Blob, filename: string): ShareOutcome {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.position = 'fixed'
    a.style.opacity = '0'
    document.body.appendChild(a)
    a.click()
    window.setTimeout(() => {
      a.remove()
      URL.revokeObjectURL(url)
    }, 1200)
    return 'saved'
  } catch {
    return 'failed'
  }
}

/**
 * Copy to the clipboard. The `ClipboardItem` is built around the *promise* of a
 * blob, not an awaited one — Safari drops the user gesture the moment you await
 * before constructing it.
 */
export async function copyBlob(blob: Blob | Promise<Blob>): Promise<ShareOutcome> {
  const Ctor = clipboardItemCtor()
  if (!Ctor || typeof navigator === 'undefined' || !navigator.clipboard?.write) return 'unsupported'
  try {
    const item = new Ctor({ 'image/png': blob })
    await navigator.clipboard.write([item])
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** `crane-square.png` — no spaces, no punctuation, nothing a filesystem minds. */
export function cardFilename(stem: string, shape: string): string {
  return `${stem}-${shape}.png`
}
