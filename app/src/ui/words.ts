// PAPER PLANET — words for numbers. Copy is set like a craft kit, not a scoreboard.

/**
 * Small counts read better spelled out — "Six days in a row" is a sentence a
 * person says; "6 days in a row" is a scoreboard. Above twelve the numeral is
 * clearer than the word, which is roughly where English stops being friendly.
 */
const SPELLED: readonly string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
]

export function spell(n: number): string {
  const i = Math.max(0, Math.floor(n))
  return SPELLED[i] ?? String(i)
}

/** `spell`, capitalised — for the head of a sentence. */
export function spellCap(n: number): string {
  const word = spell(n)
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** "a Heron" / "an Owl" — small, but it is the difference between craft and CMS. */
export function article(name: string): string {
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`
}
