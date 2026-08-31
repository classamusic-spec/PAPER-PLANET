<div align="center">

# PAPER PLANET

### Fold. Breathe. Come alive.

*A paper world you fold into being with your fingertips.*

</div>

---

**PAPER PLANET** is a tactile origami sanctuary for phone and tablet. You fold
paper creatures to life with your own hands, and they come to live on a small
planet you tend.

It sits at the intersection of three things:

| | |
|---|---|
| **An ASMR instrument** | Every gesture makes a real paper sound. Rub a crease and hear the fibres. |
| **A collection game** | Species, mastery tiers, washi papers, biomes, a codex worth reading. |
| **A calm ritual** | No timers. No fail states. No red. It never punishes you. |

It is not a puzzle game or a clicker. It is a *craft object* — a well-made thing
you come back to because it feels good in the hand.

---

## What makes it different

### The paper is actually 3D
Not a flat sprite with a CSS rotation. `src/engine` is a bespoke vector 3D
engine: the sheet is a real planar subdivision of facets, creases split polygons
and reparent them into a fold tree, and every facet is lit per-face from a key
light with a specular sheen and ambient occlusion at the fold seams. Stacked
layers carry micro-thickness, so you can see the edge of the stack.

Paper **bows** as you fold it — the moving flap is subdivided into strips with a
non-linear rotation distribution — and **snaps** flat when it lands. You can
orbit the model at any time and see that it is genuinely dimensional.

It renders as crisp vectors at any DPR, and it is a fraction of the weight of a
general-purpose 3D library.

### Your hands learn origami
Twelve fold kinds across eight distinct gestures — not one drag repeated:

`valley` · `mountain` · `crease` (rub to burnish) · `pinch` · `squash` ·
`petal` · `reverse` (inside-reverse — the move that makes heads and beaks) ·
`pull` · `flip` · `rotate` · `press` · `inflate`

An **assist mode** reduces every gesture to a tap, so nothing is gated behind
motor control.

### The sound is the point
Real paper, generated and mastered as 75 close-mic'd assets, plus a **granular
friction engine**: rubbing a crease is a continuous velocity-mapped voice, not a
stream of one-shots. Slow rubbing is deep and sparse; fast is bright and dense.
Every sound is paired with a haptic.

### Nothing pressures you
No countdown timers, no fake scarcity, no expiring offers, no loot boxes for
money, no ads in the Studio. A free player can fold, collect, and finish,
forever. See [`docs/BRAND.md` §12](docs/BRAND.md).

---

## Running it

```bash
cd app
npm install
npm run dev        # http://localhost:3000
npm run build      # typecheck + production bundle
npm run typecheck
```

Node 20+. No API keys are needed to run the app — all audio is pre-generated and
committed.

### Regenerating the audio
```bash
export ELEVENLABS_API_KEY='...'      # never commit this
node tools/gen-sfx.mjs
```

---

## Layout

```
app/src/
├── contracts.ts   frozen cross-module interfaces
├── engine/        the 3D paper simulation
├── audio/         ASMR engine: sampler, granular friction, ambience, haptics
├── ui/            the Paper UI kit — every surface is a sheet
├── systems/       save + migration, economy, progression, commerce
├── content/       species, fold recipes, washi, biomes, codex
├── screens/       studio · planet · codex · shop · title · settings · zen
├── shell/         navigation, gestures, error boundary, PWA
└── styles/        frozen design tokens (day · night · high-ink)
```

## Documentation

| | |
|---|---|
| [`docs/BRAND.md`](docs/BRAND.md) | Pillars, palette, type, motion, sound, voice, monetization ethics |
| [`docs/GAMEDESIGN.md`](docs/GAMEDESIGN.md) | Core loop, gesture vocabulary, mastery, biomes, economy |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Module map and build rules |

## Accessibility

Contrast ≥ 4.5:1 in both themes · `prefers-reduced-motion` honoured throughout ·
a **High Ink** mode for low vision · **Assist mode** replaces every fold gesture
with a tap · 44pt minimum touch targets · full safe-area handling · no
information conveyed by sound alone.
