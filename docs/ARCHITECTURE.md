# PAPER PLANET — Architecture

## Stack
Vite 7 · React 19 · TypeScript 5.9 · Tailwind 3.4 · Zustand (state) · no heavy 3D lib.

The 3D paper rendering is a **bespoke vector engine** (`src/engine`), not three.js.
Reason: paper wants crisp vector edges and flat facets. A hand-rolled facet
rasteriser gives us true 3D geometry + lighting at a fraction of the bundle size,
renders as SVG/Canvas2D, is pixel-sharp at any DPR, and runs at 60fps on a 4-year-old
phone. Three.js would give us worse-looking paper for 600kb.

---

## Module map & ownership

Each directory has **exactly one owner** during the parallel build. Do not write
outside your directory. Cross-module communication goes through `src/contracts.ts`,
which is **frozen** — if you need it changed, say so, do not edit it.

```
app/src/
├── contracts.ts      ── FROZEN. Every cross-module type & interface.
│
├── engine/           ── [A] fold3d. Pure TS, zero React, zero DOM deps.
│   ├── types.ts          Vec3, Facet, Sheet, FoldTree internals
│   ├── geom.ts           vector math, polygon clipping/splitting
│   ├── sheet.ts          Sheet construction, crease application, subdivision
│   ├── camera.ts         perspective projection, orbit, fit
│   ├── shade.ts          per-facet lighting, sheen, ambient occlusion at folds
│   ├── render.ts         facet -> SVG path/paint list (renderer-agnostic output)
│   ├── bend.ts           progressive strip bending during an in-flight fold
│   └── index.ts          public API implementing contracts.FoldEngine
│
├── audio/            ── [B] ASMR audio. Owns public/audio/*.
│   ├── engine.ts         AudioContext graph, buses, ducking, limiter
│   ├── sampler.ts        sample load/decode/cache, round-robin, pitch/vol jitter
│   ├── granular.ts       velocity-driven continuous rub/slide synthesis
│   ├── ambience.ts       looping beds w/ crossfade
│   ├── music.ts          sparse generative kalimba over drone
│   ├── haptics.ts        vibration patterns paired to cues
│   ├── manifest.ts       generated: cue id -> file(s)
│   └── index.ts          public API implementing contracts.AudioService
│
├── ui/               ── [C] The Paper UI kit. Presentational only.
│   ├── Paper.tsx         the base sheet primitive (elevation, deckle, grain, tilt)
│   ├── Button.tsx        folded-card button, all variants
│   ├── Sheet.tsx         bottom-sheet / modal built from Paper
│   ├── Tabs.tsx  Chip.tsx  Meter.tsx  Toggle.tsx  Slider.tsx
│   ├── Icon.tsx          cut-paper icon set
│   ├── Currency.tsx      Sheets / Gold Leaf pills
│   ├── Toast.tsx         paper-slip toasts
│   ├── Reveal.tsx        stagger/entrance helpers
│   ├── Logotype.tsx      brand logotype + crane mark
│   └── index.ts
│
├── systems/          ── [D] Game state. Zustand stores + pure logic.
│   ├── save.ts           v3 schema, migration from v1/v2, persistence
│   ├── store.ts          the root Zustand store & selectors
│   ├── economy.ts        Sheets/Gold Leaf earn & spend, pure functions
│   ├── progression.ts    mastery tiers, unlocks, biomes, XP curves
│   ├── daily.ts          Daily Fold selection, streaks (forgiving)
│   ├── commerce.ts       catalog, entitlements, StoreProvider + LocalStubProvider
│   ├── settings.ts       theme, motion, assist mode, volumes, high-ink
│   └── index.ts
│
├── content/          ── [E] Data. Mostly pure data + fold recipes.
│   ├── species/          one file per Kami: art + fold recipe + codex entry
│   ├── washi.ts          paper catalog (patterns as SVG defs)
│   ├── biomes.ts         Meadow/Shore/Forest/Peak/NightSky
│   ├── codex.ts          facts, mastery copy
│   ├── recipes.ts        shared fold-recipe builders (bases: kite, fish, bird…)
│   └── index.ts
│
├── screens/          ── [F/G/H/I] One folder per screen.
│   ├── studio/           THE FOLD EXPERIENCE (the centrepiece)
│   ├── planet/           the living world
│   ├── codex/            collection + mastery
│   ├── shop/             Atelier, Washi, Gold Leaf, Fold Journal
│   ├── title/            cold open + onboarding
│   └── settings/
│
├── shell/            ── [me] App shell, providers, navigation, theming.
└── styles/           ── [C] tokens.css (FROZEN by me), paper.css, globals
```

---

## Rules for every agent

1. **`src/contracts.ts` is frozen.** Import from it. Never edit it.
   If a contract is genuinely wrong, implement around it and report it.
2. **Stay in your directory.** Create as many files inside it as you like.
3. **`styles/tokens.css` is frozen.** Use the CSS variables. Never hardcode a hex
   value that duplicates a token. If you need a new token, use an existing one.
4. **No new npm dependencies** without saying so in your report. `zustand` is
   available. Everything else already in `package.json` is fair game.
5. **TypeScript strict.** No `any` (use `unknown` + narrowing). No `@ts-ignore`.
   `npx tsc --noEmit` must pass for your files.
6. **Mobile-first, tablet-native.** Test your layout mentally at 390×844 and
   1024×1366. Respect safe areas. 44pt touch targets.
7. **Honour `prefers-reduced-motion`** and the `highInk` setting.
8. **Every file starts with a one-line comment** saying what it is.
9. Read `docs/BRAND.md` before writing a single line of visual or copy work.
10. **No placeholder/TODO code paths.** Everything you ship must actually run.

## Build verification
```
cd app && npx tsc --noEmit && npm run build
```
