/* PAPER PLANET — Select screen. PLACEHOLDER: replaced by the screen author.
 *
 * Contract for the real implementation:
 *   - default export, no props
 *   - route params via `useRouteParams<T>()` from '../../shell/Navigator'
 *   - navigation via `useNavigation()` from '../../shell/Navigator'
 *   - game state via the store in 'src/systems'
 */
export default function SelectScreen() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-soft)' }}>
      <p style={{ fontFamily: 'var(--font-text)' }}>Select</p>
    </div>
  )
}
