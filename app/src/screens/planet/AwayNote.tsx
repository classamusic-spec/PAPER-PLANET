/* PAPER PLANET — the note the Planet leaves out for you when you have been away. */

import { Button, IconButton, Paper } from '../../ui'
import type { Away } from '../../systems'
import { awayBody, awayHead, awayWaiting } from './away'

export interface AwayNoteProps {
  away: Away
  /** The Kami the note speaks about, or null when the planet is still blank. */
  name: string | null
  /** How many Kami are on the planet, across every biome. */
  waiting: number
  /** Dismiss, and make everybody look up. */
  onGreet: () => void
  /** Dismiss quietly. */
  onClose: () => void
}

/**
 * A slip of paper left on the desk. It states the gap once, plainly, and then
 * spends the rest of itself on the creatures rather than on the player — see
 * `away.ts` for why every word here is chosen the way it is.
 */
export default function AwayNote({ away, name, waiting, onGreet, onClose }: AwayNoteProps) {
  const line = awayWaiting(waiting)
  return (
    <Paper
      elevation={3}
      edge="torn"
      tone={0}
      grain
      seed="away-note"
      className="pp-planet__away"
      role="status"
    >
      <div className="pp-planet__awayclose">
        <IconButton icon="close" label="Put the note away" variant="quiet" size="sm" onClick={onClose} />
      </div>
      <p className="pp-planet__awaylabel">While you were away</p>
      <p className="pp-planet__awayhead">{awayHead(away.days)}</p>
      <p className="pp-planet__awaybody">{awayBody(away.days, away.lost, name)}</p>
      {line !== null && <p className="pp-planet__awaywaiting">{line}</p>}
      <Button variant="beni" size="sm" icon="hand" onClick={onGreet} cue="ui.confirm">
        Say hello
      </Button>
    </Paper>
  )
}
