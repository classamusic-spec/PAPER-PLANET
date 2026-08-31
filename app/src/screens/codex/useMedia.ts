/* PAPER PLANET — a media-query hook, so layout decisions React can see stay in one place. */

import { useEffect, useState } from 'react'

/** True while the query matches. Safe before `matchMedia` exists. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const onChange = (): void => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * Wide enough for master/detail. 760px catches a landscape phone (844×390) as
 * well as every tablet, which is the point — the old grid showed a phone layout
 * floating in the middle of an iPad.
 */
export const TWO_PANE_QUERY = '(min-width: 760px)'

export const useTwoPane = (): boolean => useMedia(TWO_PANE_QUERY)
