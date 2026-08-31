// PAPER PLANET — the crane, cut once. Shared by the icon set, the mark and the logotype.

/** A facet of the folded model, in a 120×100 sheet. `shade` is how the light falls. */
export interface CraneFacet {
  d: string
  shade?: 'deep' | 'soft'
}

/**
 * The model sits on the desk: a hull, one wing folded up with its twin behind
 * it in shadow, the long neck rising to a small head and beak, and the tail
 * thrown back. It survives being scaled down to 20px, which is the only test
 * a mascot has to pass.
 */
export const CRANE_FACETS: CraneFacet[] = [
  /* the hull, resting on the desk */
  { d: 'M30 62 92 62 78 84 44 84Z', shade: 'soft' },
  /* the far wing, in the model's own shadow */
  { d: 'M38 62 56 16 68 26 60 62Z', shade: 'deep' },
  /* the near wing, catching the light */
  { d: 'M46 62 70 8 90 62Z' },
  /* neck */
  { d: 'M84 64 100 20 107 22 92 66Z' },
  /* head */
  { d: 'M98 13 115 20 106 30 96 24Z' },
  /* beak */
  { d: 'M110 14 121 19 108 24Z' },
  /* tail, thrown back */
  { d: 'M40 64 10 31 2 43 32 68Z', shade: 'deep' },
]

/** Fit the 120×100 model into a 24×24 icon sheet. */
export const CRANE_ICON_TRANSFORM = 'translate(-0.4 3) scale(0.2)'
