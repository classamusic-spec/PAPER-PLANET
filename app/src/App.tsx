/* PAPER PLANET — root. Wires the navigator to the screen registry. */

import { lazy, Suspense, type ReactNode } from 'react'
import { Navigator, type Route } from './shell/Navigator'
import { ErrorBoundary } from './shell/ErrorBoundary'
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

export default function App() {
  return (
    <ErrorBoundary>
      <Navigator initial="title">{renderScreen}</Navigator>
    </ErrorBoundary>
  )
}
