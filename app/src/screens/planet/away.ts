/* PAPER PLANET — how the Planet says "you were gone", without ever saying it unkindly. */

/**
 * BRAND.md §2.II: nothing punishes the player for leaving. The systems layer has
 * always known how long you were away and how far everyone drifted; the only
 * question here is the telling of it.
 *
 * So: no number of days lost, no streak broken, no bond figure, no "you". The
 * count of days is stated once, plainly, the way you would say "it's Thursday" —
 * and then the rest of the note is about what the Kami did, not what you failed
 * to do. The one mechanical fact that gets through is the one that helps: a hand
 * on any of them puts the drift right back.
 */

const WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
]

function word(n: number): string {
  return WORDS[n] ?? String(n)
}

/** "Four days." — the length of the gap, said once and never again. */
export function awayHead(days: number): string {
  if (days <= 1) return 'A day.'
  if (days < 7) return `${word(days)} days.`
  if (days < 14) return 'A week.'
  if (days < 28) return `${word(Math.floor(days / 7))} weeks.`
  if (days < 60) return 'A month.'
  if (days < 365) return `${word(Math.round(days / 30))} months.`
  if (days < 730) return 'A year.'
  return 'A long time.'
}

/**
 * What happened here, in the Kami's terms.
 *
 * Four lines, chosen by the length of the gap rather than at random, so the
 * planet does not tell you a different story about the same absence when you
 * come back to this screen.
 */
export function awayBody(days: number, lost: number, name: string | null): string {
  if (name === null) {
    return lost > 0
      ? 'The light went round the planet without you, and the paper kept. Nothing here was lost.'
      : 'The paper kept. Nothing here counts the days.'
  }
  if (lost <= 0) {
    return days <= 1
      ? `${name} has not moved from that spot. Nothing here counts the days.`
      : `${name} held the same patch of ground the whole time. Nothing here counts the days.`
  }
  if (days < 14) {
    return `${name} kept your spot warm. Everyone went a little quiet — a hand on any of them puts that right.`
  }
  if (days < 60) {
    return `${name} learned the sound of the wind here. They are quieter than you left them, and one hand each is all it takes.`
  }
  return `${name} waited without counting. They are quiet now, and they will not be quiet for long.`
}

/** The line under the head, when there is anyone to count. */
export function awayWaiting(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return 'One of them is waiting.'
  return `${word(count)} of them are waiting.`
}

/* ── how a Kami is doing, in words rather than a number ────────────────────── */

/**
 * Bond has no reward attached to it — BRAND §12, and progression.ts says the
 * same — so it is never shown as a score. It is shown as a sentence about the
 * creature, which is the only thing bond actually means.
 */
export function bondWord(bond: number): string {
  if (bond >= 100) return 'Could not be happier.'
  if (bond >= 88) return 'Would follow you anywhere.'
  if (bond >= 72) return 'Glad you came.'
  if (bond >= 58) return 'Knows your hands.'
  if (bond >= 44) return 'Getting used to you.'
  return 'Still new to your hands.'
}
