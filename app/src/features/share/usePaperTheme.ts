/*
 * PAPER PLANET — which paper the document is currently wearing.
 *
 * The setting can say `auto`; the shell decides. Reading the resolved attribute
 * keeps a card in the same hour as the app that opened it, and High Ink comes
 * along the same way.
 */

import { useEffect, useState } from 'react'
import type { CardTheme } from './types'

export interface PaperTheme {
  theme: CardTheme
  highInk: boolean
}

function read(): PaperTheme {
  if (typeof document === 'undefined') return { theme: 'day', highInk: false }
  const root = document.documentElement
  return {
    theme: root.dataset.theme === 'night' ? 'night' : 'day',
    highInk: root.dataset.highInk === 'true',
  }
}

export function usePaperTheme(): PaperTheme {
  const [state, setState] = useState<PaperTheme>(read)

  useEffect(() => {
    const root = document.documentElement
    const sync = (): void => {
      setState((prev) => {
        const next = read()
        return prev.theme === next.theme && prev.highInk === next.highInk ? prev : next
      })
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-high-ink'] })
    return () => obs.disconnect()
  }, [])

  return state
}
