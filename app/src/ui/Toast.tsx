// PAPER PLANET — paper-slip toasts: a note dropped in from the top edge of the desk.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import { Icon, type IconName } from './Icon'
import { stableTilt } from './paperShapes'
import { usePaperSound, type CSSVars, type PaperCue } from './hooks'

export interface ToastOptions {
  /** The line the player reads. Keep it short and warm. */
  title: ReactNode
  /** An optional quieter second line. */
  note?: ReactNode
  icon?: IconName
  accent?: AccentToken
  /** Milliseconds on screen. `0` keeps it until dismissed. */
  duration?: number
  /** The sound it makes when it lands. `null` for silence. */
  cue?: PaperCue | null
}

interface ToastRecord extends ToastOptions {
  id: string
  closing?: boolean
}

export interface ToastApi {
  /** Drop a slip onto the desk. Returns its id. */
  show: (options: ToastOptions) => string
  /** Take one back. */
  dismiss: (id: string) => void
  /** Clear the desk. */
  clear: () => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** A no-op API, so a component can be rendered outside the provider in tests. */
const NOOP: ToastApi = { show: () => '', dismiss: () => {}, clear: () => {} }

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP
}

export interface ToastProviderProps {
  children?: ReactNode
  /** How many slips can sit on the desk at once. */
  limit?: number
  defaultDuration?: number
}

export function ToastProvider({ children, limit = 3, defaultDuration = 3600 }: ToastProviderProps) {
  const [items, setItems] = useState<ToastRecord[]>([])
  const timers = useRef(new Map<string, number>())
  const play = usePaperSound()
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, closing: true } : t)))
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.set(
      id,
      window.setTimeout(() => {
        setItems((list) => list.filter((t) => t.id !== id))
        timers.current.delete(id)
      }, 320),
    )
  }, [])

  const show = useCallback(
    (options: ToastOptions): string => {
      counter.current += 1
      const id = `toast-${counter.current}`
      const record: ToastRecord = { ...options, id }
      setItems((list) => [...list, record].slice(-limit))
      const cue = options.cue === undefined ? 'sheet.slide' : options.cue
      if (cue) play(cue)
      const duration = options.duration ?? defaultDuration
      if (duration > 0) {
        timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
      }
      return id
    },
    [limit, defaultDuration, play, dismiss],
  )

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current.clear()
    setItems([])
  }, [])

  useEffect(() => {
    const timerMap = timers.current
    return () => {
      timerMap.forEach((t) => window.clearTimeout(t))
      timerMap.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss, clear }), [show, dismiss, clear])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(<ToastRegion items={items} onDismiss={dismiss} />, document.body)
        : null}
    </ToastContext.Provider>
  )
}

function ToastRegion({ items, onDismiss }: { items: ToastRecord[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pp-toasts" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <ToastSlip key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastSlip({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const vars: CSSVars = { '--pp-tilt': `${stableTilt(toast.id, 1.2)}deg` }
  return (
    <div
      className="pp-toast"
      data-accent={toast.accent ?? 'kincha'}
      data-closing={toast.closing ? 'true' : undefined}
      style={vars as CSSProperties}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.icon ? (
        <span className="pp-toast__mark" aria-hidden>
          <Icon name={toast.icon} size={16} cut={false} />
        </span>
      ) : null}
      <span className="pp-toast__text">
        {toast.title}
        {toast.note ? <span className="pp-toast__note">{toast.note}</span> : null}
      </span>
    </div>
  )
}
