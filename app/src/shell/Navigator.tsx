/* PAPER PLANET — screen stack. Screens are sheets laid onto a desk, never slides. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ScreenId } from '../contracts'

/** One entry on the stack. `params` is opaque to the navigator. */
export interface Route {
  id: ScreenId
  params?: Record<string, unknown>
  /** Monotonic key so React remounts only when we mean it. */
  key: number
}

type Direction = 'forward' | 'back' | 'none'

interface NavApi {
  route: Route
  stack: readonly Route[]
  direction: Direction
  /** Lay a new sheet on top. */
  push: (id: ScreenId, params?: Record<string, unknown>) => void
  /** Swap the top sheet without growing the stack. */
  replace: (id: ScreenId, params?: Record<string, unknown>) => void
  /** Lift the top sheet off. No-op at the root. */
  back: () => void
  /** Clear down to a single root sheet. */
  reset: (id: ScreenId, params?: Record<string, unknown>) => void
  canGoBack: boolean
}

const NavContext = createContext<NavApi | null>(null)

export function useNavigation(): NavApi {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNavigation must be used inside <Navigator>')
  return ctx
}

/** Read the params of the current route with a caller-supplied shape. */
export function useRouteParams<T extends Record<string, unknown>>(): Partial<T> {
  return (useNavigation().route.params ?? {}) as Partial<T>
}

let keySeq = 0

export function Navigator({
  initial,
  children,
}: {
  initial: ScreenId
  children: (route: Route) => ReactNode
}) {
  const [stack, setStack] = useState<Route[]>(() => [{ id: initial, key: keySeq++ }])
  const [direction, setDirection] = useState<Direction>('none')
  /** The sheet being animated away, kept mounted until its transition ends. */
  const [leaving, setLeaving] = useState<Route | null>(null)
  const leaveTimer = useRef<number | null>(null)

  const scheduleLeave = useCallback((route: Route) => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current)
    setLeaving(route)
    leaveTimer.current = window.setTimeout(() => {
      setLeaving(null)
      leaveTimer.current = null
    }, 660)
  }, [])

  useEffect(() => {
    return () => {
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current)
    }
  }, [])

  const push = useCallback(
    (id: ScreenId, params?: Record<string, unknown>) => {
      setStack((prev) => {
        scheduleLeave(prev[prev.length - 1])
        return [...prev, { id, params, key: keySeq++ }]
      })
      setDirection('forward')
    },
    [scheduleLeave],
  )

  const replace = useCallback(
    (id: ScreenId, params?: Record<string, unknown>) => {
      setStack((prev) => {
        scheduleLeave(prev[prev.length - 1])
        const next = prev.slice(0, -1)
        return [...next, { id, params, key: keySeq++ }]
      })
      setDirection('forward')
    },
    [scheduleLeave],
  )

  const back = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev
      scheduleLeave(prev[prev.length - 1])
      return prev.slice(0, -1)
    })
    setDirection('back')
  }, [scheduleLeave])

  const reset = useCallback(
    (id: ScreenId, params?: Record<string, unknown>) => {
      setStack((prev) => {
        scheduleLeave(prev[prev.length - 1])
        return [{ id, params, key: keySeq++ }]
      })
      setDirection('back')
    },
    [scheduleLeave],
  )

  const route = stack[stack.length - 1]

  /* Hardware / browser back maps to lifting a sheet. */
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      e.preventDefault()
      back()
    }
    window.history.pushState({ pp: true }, '')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [back])

  useEffect(() => {
    // Keep one spare history entry so the next back press has something to pop.
    if (stack.length > 0) window.history.pushState({ pp: true, depth: stack.length }, '')
  }, [stack.length])

  const api = useMemo<NavApi>(
    () => ({ route, stack, direction, push, replace, back, reset, canGoBack: stack.length > 1 }),
    [route, stack, direction, push, replace, back, reset],
  )

  return (
    <NavContext.Provider value={api}>
      <div className="pp-nav">
        {leaving && leaving.key !== route.key && (
          <div
            key={leaving.key}
            className={`pp-screen pp-screen--leaving pp-screen--${direction}`}
            aria-hidden="true"
          >
            {children(leaving)}
          </div>
        )}
        <div key={route.key} className={`pp-screen pp-screen--entering pp-screen--${direction}`}>
          {children(route)}
        </div>
      </div>
    </NavContext.Provider>
  )
}
