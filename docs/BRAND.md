# PAPER PLANET — Brand Bible v1.0

> **Fold. Breathe. Come alive.**

---

## 1. Positioning

**PAPER PLANET** is a tactile origami sanctuary for phone and tablet.
You fold paper creatures to life with your own hands, and they come to live on a
tiny planet you tend.

It sits at the intersection of three things:

| | |
|---|---|
| **An ASMR instrument** | Every gesture makes a real paper sound. Rub a crease and hear the fibres. |
| **A collection game** | 40+ species, mastery tiers, washi papers, biomes, a codex. |
| **A calm ritual** | No timers. No fail states. No red. Never punishes. Always yours. |

**It is NOT**: a puzzle game, a clicker, an idle farm, a kids' toy.
It is a *craft object* — a beautifully made thing you return to daily because it
feels good in the hand.

### The one-sentence pitch
*A paper world you fold into being with your fingertips.*

### Competitive frame
Where *Monument Valley* made geometry into art direction, PAPER PLANET makes
**material** into art direction. The entire interface is paper — not paper-themed,
paper. Every panel is a sheet. Every button is folded card. Every shadow is cast
by real thickness.

---

## 2. The Four Pillars

Every design decision answers to one of these. If it serves none, cut it.

### I. TACTILE
Nothing is glass. Nothing glows neon. Nothing is flat #FFF.
- Surfaces have fibre, deckle edges, and torn or cut boundaries.
- Elevation is expressed as **paper stacking** — a real drop shadow with warm tint,
  never a blur-only "material" shadow.
- Interactive elements physically depress, lift, curl, or crease.
- Everything sits at a slight, deliberate rotation (±0.4° to ±2°). Nothing is
  machine-perfect, because nothing is machine-made.

### II. CALM
- Palette is warm and low-chroma. Saturated colour is *earned*, used as an accent
  the way a dyer uses safflower — sparingly, and it means something.
- No countdown timers, no energy meters, no loss states, no punishing streak-break.
  A broken streak says "welcome back", not "you lost 43 days".
- Motion settles; it does not bounce. UI easing is `cubic-bezier(.2,.9,.25,1)`.
  Cartoon overshoot is reserved **only** for a creature coming alive.
- Sound-first. The app should be worth using with the screen off in your pocket…
  almost.

### III. HANDMADE
- Visible fibres, uneven ink, slightly-off registration.
- Type is set like a nice tea box or a letterpress broadside — generous, editorial,
  confident.
- Iconography is cut-paper silhouette, never line-icon.
- Imperfection is a feature. Perfectly-aligned grids read as corporate.

### IV. ALIVE
The creature is the payoff. It must feel like a *being*, not a sprite.
- It breathes (a 4s scale cycle, never linear).
- It blinks on an irregular schedule.
- It reacts to touch — lean toward your finger, startle, settle.
- It has weight: it lands, it settles, its paper rustles.

---

## 3. Naming System

Use these words. Do not invent synonyms mid-product.

| Concept | Name | Never call it |
|---|---|---|
| The app | **PAPER PLANET** | Paper Planet Origami, PP |
| The folding space | **The Studio** | level, stage, puzzle |
| Your world | **The Planet** | base, farm, home screen |
| The collection | **The Codex** | dex, album, gallery |
| A creature | **a Kami** (pl. Kami) | pet, monster, character |
| A creature species | **a fold** | recipe, blueprint |
| Soft currency | **Sheets** | coins, gold, cash |
| Premium currency | **Gold Leaf** | gems, crystals |
| Paper skins | **Washi** | skins, cosmetics |
| Subscription | **The Atelier** | Premium, Pro, VIP |
| Season pass | **The Fold Journal** | battle pass |
| Calm free-play | **Zen Mode** | endless, sandbox |
| Daily ritual | **The Daily Fold** | daily quest, mission |
| Mastery tiers | Novice · Adept · Master · **Grand** | bronze/silver/gold |

**Voice**: Warm, quiet, precise. Second person. Short sentences.
Write like the instructions in a good craft kit — never like a game UI.

> ✅ "Rub the crease until it holds."
> ❌ "COMPLETE THE OBJECTIVE! +50 XP!"

> ✅ "A heron. It stands very still, and then it doesn't."
> ❌ "Legendary Heron unlocked!! 🔥🔥"

---

## 4. Colour — the Kami Palette

Named after Japanese natural dyes and papers. All values are the *day* theme;
night theme values are given in §4.3.

### 4.1 Paper stack (the substrate)
Elevation is encoded in the paper value. Higher sheet = lighter.

| Token | Hex | Use |
|---|---|---|
| `--paper-0` | `#FDF8F0` | Topmost sheet: modals, cards lifted off everything |
| `--paper-1` | `#F7EDE0` | **Base sheet.** The default surface. |
| `--paper-2` | `#EFE1CE` | Recessed: wells, inputs, the desk behind a sheet |
| `--paper-3` | `#E0CDB2` | Deep shadow, fold interiors, the underside of a flap |
| `--paper-4` | `#C9B393` | The desk itself. Darkest paper value. |
| `--paper-edge` | `#D6C3A6` | Deckle/cut edge line on a sheet |

### 4.2 Ink & accents

| Token | Hex | Name | Use |
|---|---|---|---|
| `--ink` | `#2E2438` | Sumi | Primary text, outlines, creases |
| `--ink-soft` | `#6B5B7B` | Usu-zumi | Secondary text, hints |
| `--ink-faint` | `#A294B0` | — | Tertiary text, disabled |
| `--beni` | `#E4664F` | Safflower | Primary action, warmth, hearts |
| `--beni-deep` | `#C24732` | — | Pressed state of beni |
| `--kincha` | `#E0A340` | Amber | Currency, highlights, sun |
| `--matcha` | `#7E9E7B` | Green tea | Confirm, growth, nature |
| `--ai` | `#4A6D8C` | Indigo | Water, calm, info, night |
| `--murasaki` | `#7B5EA7` | Purple | Rare, magic, sparkle paper |
| `--sakura` | `#EFC2C0` | Blossom | Soft accent, affection |
| `--gold-leaf` | `#C9962E` | Kinpaku | Premium currency & rarity |
| `--gold-hi` | `#F5DC96` | — | Gold leaf highlight/shimmer |

**Rule of accent**: at most **two** accent colours visible in one screen region.
The rest is paper and ink. Colour is a *dye*, not a *paint*.

### 4.3 Night theme — "Lantern"
Night is not "dark mode". Night is **the same paper, lit by a warm lamp on a dark desk.**
- Paper values shift warm-dim, not grey: `--paper-1: #3B3040`.
- Ink inverts to cream `#F3E7D6`.
- A radial amber pool of lamplight sits behind the content.
- Shadows go deep indigo, never black.
- Accent chroma drops ~15%; `--kincha` gets *brighter* (it's the lamp).

Night is a *setting*, and also the state of the Planet after dusk.

### 4.4 Forbidden
- Pure `#000` or pure `#FFF` anywhere. Ever.
- Neon, gradient-mesh, glassmorphism, blur-heavy "frosted" panels.
- More than two accents per region.
- Grey. If something needs to recede, use a paper value, not grey.

---

## 5. Typography

Two families, doing clearly separate jobs.

### Display — **Fraunces**
A variable serif with `SOFT` and `WONK` axes. Editorial, warm, crafted — reads
"nice letterpress" not "video game".
- Used for: the logotype, screen titles, creature names, numbers that matter.
- Settings: `wght 600–900`, `opsz 24–144`, `SOFT 40`, `WONK 1`.
- Always generous: `letter-spacing: -0.02em` at display sizes.

### Text — **Nunito**
Rounded, humanist, extremely legible at small sizes on a warm ground.
- Used for: all body copy, instructions, labels, buttons.
- Weights 400 / 600 / 700 / 800.

### Label — **Nunito 800, uppercase, `letter-spacing: .14em`**
For tiny metadata: `MASTERY`, `SHEETS`, `STEP 3 OF 7`.

### Scale (fluid, clamped — see `tokens.css`)
`display-xl → display-l → display-m → title → body-l → body → label → micro`

### Rules
- Never centre a paragraph longer than two lines.
- Numbers in the HUD are **tabular** (`font-variant-numeric: tabular-nums`) so they
  don't jitter when they tick.
- Instructional text in the Studio is set large and calm — it's the voice of a
  patient teacher, not a HUD.

---

## 6. Logotype & Marks

### Logotype
`PAPER PLANET` set in Fraunces 900, tight. The **A** in PAPER carries a fold crease
through it; the **O** in PLANET is replaced by a folded-paper disc with a visible
mountain-fold ridge. Below, a hairline rule and the wordmark `FOLD · BREATHE · COME ALIVE`
in Label style.

### App icon
A single origami crane, cut-paper silhouette in `--beni`, on a `--paper-1` disc,
with one diagonal crease shadow crossing the disc at 34°. No text. No gradient
except the crease's soft shadow.

### The Crane
The crane is the brand mascot and the first fold every player makes. It appears in:
the icon, the loading state (folding itself), the empty states, the Atelier badge.

---

## 7. Motion Language

Paper is light, stiff, and has air resistance. It does not bounce like rubber.

| Curve | Value | Use |
|---|---|---|
| `--ease-paper` | `cubic-bezier(.2,.9,.25,1)` | **Default.** All UI. Quick attack, soft settle. |
| `--ease-settle` | `cubic-bezier(.16,1,.3,1)` | Long, luxurious settles (sheets landing) |
| `--ease-crisp` | `cubic-bezier(.65,0,.35,1)` | Creases, snaps, decisive moments |
| `--ease-alive` | `cubic-bezier(.28,1.6,.4,1)` | **Only** for a Kami coming alive |

### Durations
`--t-tap 90ms` · `--t-quick 180ms` · `--t-base 300ms` · `--t-slow 520ms` · `--t-page 640ms`

### Screen transitions
Screens are **sheets laid onto a desk**. The incoming screen slides up from the
bottom edge with a 1.2° rotation that resolves to 0, its shadow growing as it
approaches. The outgoing screen darkens ~8% and scales to .985 — it's now underneath.

### Micro-motion vocabulary
- **breathe** — 4.2s scale 1 → 1.018, `ease-in-out`. On every living thing.
- **rustle** — 90ms ±0.6° jitter. On tap.
- **settle** — a two-bounce damped landing. On drop.
- **curl** — a corner lifts on hover/press.
- **drift** — 12–20s slow float. Background motes, clouds.

### Reduced motion
`prefers-reduced-motion: reduce` must kill drift, breathe, parallax, and confetti,
and shorten transitions to `--t-quick`. The app must remain fully beautiful — the
paper look does not depend on motion.

---

## 8. Sound Language

Sound is a **first-class pillar**, not decoration. Target: someone folds with
headphones on to relax.

### Principles
- Every SFX is **paper or wood or air**. No synth blips. No coins. No lasers.
- Sounds are **close-mic'd and dry** — you are 15cm from the paper.
- Gesture sounds are **continuous and velocity-mapped**, not one-shots. Rubbing a
  crease slowly sounds different from rubbing it fast.
- Layer three beds: **material** (the paper), **room** (space tone), **music** (sparse).
- Music is a sparse pentatonic kalimba/music-box over a low drone. It should be
  possible to not notice it.

### The SFX vocabulary
| Family | Cues |
|---|---|
| **Crease** | `crease.soft`, `crease.crisp`, `crease.burnish` (loop), `crease.set` |
| **Fold** | `fold.valley`, `fold.mountain`, `fold.reverse`, `fold.petal`, `fold.squash` |
| **Sheet** | `sheet.slide`, `sheet.flip`, `sheet.lift`, `sheet.settle`, `sheet.pickup` |
| **Press** | `press.flatten`, `press.hold` (loop), `press.release` |
| **UI** | `ui.tap`, `ui.back`, `ui.confirm`, `ui.open`, `ui.close`, `ui.toggle` |
| **Life** | `alive.breath`, `alive.chirp.*`, `alive.happy`, `alive.nuzzle` |
| **Reward** | `reward.sheets`, `reward.goldleaf`, `reward.mastery`, `reward.unlock` |
| **Ambience** | `amb.meadow`, `amb.rain`, `amb.night`, `amb.shore`, `amb.tearoom` |

### Haptics (paired with sound, always)
| Gesture | Pattern (ms) |
|---|---|
| crease tick (during rub) | `4` |
| crease set | `[18, 40, 26]` |
| valley/mountain complete | `28` |
| flip | `[10, 30, 10]` |
| press flatten | `[40, 30, 60]` |
| come alive | `[30, 50, 40, 60, 90]` |

---

## 9. Iconography & Illustration

- **Cut-paper silhouette.** Solid shapes with a 1px darker edge, never outline icons.
- Every icon is drawn as if scissored from a single sheet — no floating pieces
  unless they'd survive being cut.
- Slight rotation, slight asymmetry.
- Creature art is **flat polygon on flat polygon** with one shadow facet — a paper
  model photographed from directly above, not a cartoon.

---

## 10. Layout & Device

Built **mobile-first, tablet-native**. Not a stretched phone app.

- **Phone (≤ 640px)**: single column, thumb-zone actions, bottom-anchored primary CTA.
- **Tablet (≥ 768px)**: the Studio becomes a **desk** — the model centred, tools on a
  side rail, the codex as a sliding drawer. Two-pane where it earns it.
- Safe areas respected everywhere via `env(safe-area-inset-*)`. Never let a control
  sit under a home indicator or a notch.
- **Touch targets ≥ 44×44pt.** No exceptions.
- The Studio arena is always square-ish and centred, sized `min(92vw, 62vh)` on
  phone, `min(58vw, 74vh)` on tablet.
- Support both orientations. Landscape phone = the desk view.

---

## 11. Accessibility (non-negotiable)

- Contrast ≥ 4.5:1 for body, ≥ 3:1 for large display text, in **both** themes.
- Every interactive element has an accessible name.
- `prefers-reduced-motion` honoured (§7).
- A **"High Ink"** setting boosts outline weight and ink contrast for low vision.
- Sound is never the *only* channel for information — every audio cue has a visual
  and (where possible) haptic partner.
- Fold gestures have a **"Guided" assist mode**: tap-to-fold instead of drag, for
  players with limited motor control. This is a setting, not a difficulty.

---

## 12. Monetization Ethics

The business model must never contradict Pillar II (CALM).

**We will:**
- Sell beautiful cosmetic Washi.
- Sell a subscription (**The Atelier**) that is clearly worth it.
- Sell a season of content (**The Fold Journal**) that is generous on the free track.
- Let a non-paying player fold, collect, and finish, forever.

**We will never:**
- Use countdown pressure, fake scarcity, or "offer expires!" modals.
- Interrupt a fold with an ad or an upsell. **The Studio is sacred.**
- Show a paywall before the player has folded their first Kami.
- Sell power. Everything purchasable is cosmetic, convenience, or content.
- Use loot boxes with real money.

Upsells appear in exactly two places: the **Shop** (which the player opens), and a
single tasteful line in **Settings**. Plus one contextual, dismissible-forever card
on the Codex when a locked Washi is relevant.
