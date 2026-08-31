/* PAPER PLANET — root. Wires the navigator to the screen registry. */

import { lazy, Suspense, type ReactNode } from 'react'
import { Navigator, type Route } from './shell/Navigator'
import { ErrorBoundary } from './shell/ErrorBoundary'
import { Boot } from './shell/boot'
import type { ScreenId } from './contracts'

/* Screens are code-split: the Studio's engine should not be in the boot bundle. */
const screens: Record<ScreenId, React.LazyExoticComponent<() => ReactNode>> = {
  title: lazy(() => import('./screens/title')),
  planet: lazy(() => import('./screens/planet')),
  select: lazy(() => import('./screens/select')),
  studio: lazy(() => import('./screens/studio')),
  codex: lazy(() => import('./screens/codex')),
  shop: lazy(() => import('./screens/shop')),
  settings: lazy(() => import('./screens/settings')),
  zen: lazy(() => import('./screens/zen')),
}

function renderScreen(route: Route): ReactNode {
  const Screen = screens[route.id]
  return (
    <Suspense fallback={<div className="pp-boot" aria-busy="true" />}>
      <Screen />
    </Suspense>
  )
}

const SCREEN_IDS = Object.keys(screens) as ScreenId[]

/**
 * Deep link support: `?screen=studio`. The PWA manifest's shortcuts use this to
 * drop the player straight into the Daily Fold or Zen Mode.
 */
function initialScreen(): ScreenId {
  try {
    const want = new URLSearchParams(window.location.search).get('screen')
    if (want && (SCREEN_IDS as string[]).includes(want)) return want as ScreenId
  } catch {
    /* malformed URL — fall through to the title */
  }
  return 'title'
}

export default function App() {
  return (
    <ErrorBoundary>
      <Boot>
        <Navigator initial={initialScreen()}>{renderScreen}</Navigator>
      </Boot>
    </ErrorBoundary>
  )
}
