/* PAPER PLANET — Zen screen. PLACEHOLDER: replaced by the screen author.
 *
 * Contract for the real implementation:
 *   - default export, no props
 *   - route params via `useRouteParams<T>()` from '../../shell/Navigator'
 *   - navigation via `useNavigation()` from '../../shell/Navigator'
 *   - game state via the store in 'src/systems'
 */
export default function ZenScreen() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-soft)' }}>
      <p style={{ fontFamily: 'var(--font-text)' }}>Zen</p>
    </div>
  )
}
