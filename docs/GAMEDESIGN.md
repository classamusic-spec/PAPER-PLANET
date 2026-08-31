# PAPER PLANET — Game Design

## 0. What was wrong

The original was a pleasant prototype with four real design holes:

| Hole | Consequence |
|---|---|
| 3 fold choreographies for 18 species | A third of the roster plays *identically*. The core verb has no depth. |
| No unlock gating at all | Every species foldable from minute one. No curve, no anticipation, no reason to return. |
| Sparkle guaranteed every 3rd fold | The rare thing is deterministic and farmable in 90 seconds. |
| Feeding uncapped and instant | Affection is meaningless; the display just clamps at 5 hearts. |
| No reason to fold twice | Once collected, a species is finished forever. |

Everything below exists to fix those.

---

## 1. The verb

**Folding is the game.** Everything else is a reason to fold again.

So the fold itself must carry the weight: it has to be *physically satisfying*,
*visually beautiful*, and *different every time*. That means three upgrades:

1. **Real 3D paper** (`src/engine`) — true facet geometry, per-face lighting,
   stacked layer thickness, progressive bending. Paper that bows as you fold it
   and snaps flat when it lands.
2. **A real gesture vocabulary** — 12 fold kinds mapped to 8 distinct gestures.
   Drag, rub, pinch, twist, swipe, tap, hold. Your *hands* learn origami.
3. **ASMR-grade sound** — velocity-mapped continuous paper friction, not one-shots.

---

## 2. The gesture vocabulary

The single biggest expansion. Each fold kind is a distinct physical action with
its own sound, haptic, and visual affordance.

| Fold kind | Gesture | What it feels like |
|---|---|---|
| `valley` | drag across the axis, toward you | The basic fold. Paper bows, then lands. |
| `mountain` | drag across the axis, away | Same, inverted — the flap goes behind. |
| `crease` | **rub back and forth** along a line | Burnishing. The ASMR moment. Velocity drives the sound. |
| `pinch` | two fingers together | Bring two points to meet. |
| `squash` | pinch-out then hold | Open a pocket, press it flat. |
| `petal` | drag from a point, two-finger | The bird-base move. Lifts a point, flattens the sides. |
| `reverse` | **tap the spot, then drag** | Inside-reverse. Makes heads, beaks, tails. The move that separates origami from paper-folding. |
| `pull` | drag a hidden flap out | Wings, necks. Reveals structure. |
| `flip` | two-finger swipe | Turn the whole model over. |
| `rotate` | two-finger twist | Turn it on the desk. |
| `press` | **long-press and hold** | Flatten everything. The satisfying finish. |
| `inflate` | pinch-out / two-finger spread | Open a 3D form. The balloon. The frog. |

Plus, at any time, **one-finger drag on empty space orbits the model in 3D** — so
you can look at your paper from the side and see that it's genuinely dimensional.
This is free, always available, and is how the player discovers the paper is real.

**Assist mode** (accessibility, a Setting not a difficulty): every gesture reduces
to tap-to-advance, with the fold animating itself. Nothing is gated behind motor
control.

---

## 3. Session loop (2–6 minutes)

```
   open ──► THE PLANET ──► the Daily Fold is waiting (a lantern is lit)
                │
                ├─► tap it ──► THE STUDIO ──────────────────┐
                │                  fold, 4–14 steps         │
                │                  quality tracked          │
                │                                           ▼
                │                                     THE REVEAL
                │                            model inflates, breathes, blinks
                │                            orbit it · name it · photograph it
                │                                           │
                │◄──────────────────────────────────────────┘
                │      the Kami walks onto the Planet and picks a spot
                │
                ├─► tend: pet, feed, rearrange, watch them interact
                ├─► Codex: new fact unlocked, mastery ticked
                └─► Shop / Zen Mode
```

### Quality, not pass/fail
There is **no failure state.** But there is *craft*. Every crease is scored on
accuracy (how closely your gesture tracked the intended axis, how completely you
burnished). Session `quality` (0..1) feeds:
- the Sheets reward multiplier,
- the **finish** of the model (a well-folded Kami has crisper creases and a
  subtle sheen; a rushed one is softer and slightly rumpled — *visibly*),
- the Codex record ("best fold: 94%").

You can always finish. Folding better is its own reward, and it shows.

---

## 4. Meta loop (weeks)

### Mastery — the reason to fold the same species twice
| Folds | Tier | Unlocks |
|---|---|---|
| 1 | **Novice** | Codex entry + habitat |
| 3 | **Adept** | A second, deeper fact · a colour variant |
| 10 | **Master** | The fold's origami history · a larger idle animation · a Washi |
| 25 | **Grand** | The Grand variant (gold-leaf edging) · a Planet decoration |

Each tier is a genuine content unlock, not a number going up.

### Biomes — the reason to keep collecting
`Meadow → Shore → Forest → Peak → Night Sky`, unlocked by collection size.
Each biome brings: new species, its own **ambience bed**, its own scenery palette,
and its own light. The Planet visibly grows.

### The Daily Fold — the reason to come back tomorrow
One curated species per day, chosen deterministically from the date (same for
everyone, no server). Comes with a special Washi and bonus Sheets.

**Streaks are forgiving.** Miss a day and you get a grace day. Break it entirely
and the app says *"Welcome back"* — never *"you lost 43 days"*. Pillar II.

### Zen Mode — the reason to open it when you don't want a game
Any unlocked fold, no rewards, no progression, no HUD. Pick an ambience. Fold
forever. **This is the ASMR product**, and it's the honest answer to "make it
calming" — a mode where the game gets out of the way entirely.

---

## 5. Economy

| | Sheets 📄 | Gold Leaf ✨ |
|---|---|---|
| Earned by | every fold, dailies, mastery, bonds | 7-day streaks, Grand mastery, Journal, purchase |
| Spent on | Washi, Planet decorations, biome seeds | rare Washi, instant species unlock |
| Purchasable | **no** | yes |

**Folding is always free.** No energy, no lives, no timers. There is no state in
which a player cannot play.

---

## 6. The Planet

Fixes for the old version: it was one sage circle with three triangles and
absolutely-pixel-positioned creatures that became postage stamps on an iPad.

- **Data-driven placement** — habitat (`ground/water/air/perch`) lives on the
  species record, not hardcoded in the screen. Kami choose a spot appropriate to
  their habitat and *walk there* on arrival.
- **Parallax depth** — far scenery, mid scenery, ground, and creatures move at
  different rates as you pan. The world has depth.
- **Scale-relative sizing** — creature size in world units, not device pixels, so
  the Planet composes properly on a 1024pt tablet.
- **A real day/night cycle** tied to the device clock (not a 75-second interval
  that resets whenever you navigate away, which is what the old one did).
- **Kami interact** — proximity reactions, follow behaviour, shared idles. Two
  Kami near each other do something. This is what makes a world feel alive.
- **Bond** rises when you pet or feed, with a **daily cap** and a very gentle
  decay. Affection has to mean something to be worth having.

---

## 7. Feel checklist

Every one of these must be true, or the app is not premium:

- [ ] Paper **bows** during a fold and **snaps** flat at the end
- [ ] You can **orbit** the model and it is unmistakably 3D
- [ ] Rubbing a crease sounds different **fast vs. slow**
- [ ] Every crease has a **haptic** paired to its sound
- [ ] The finished Kami **breathes** and **blinks** on an irregular schedule
- [ ] It **reacts to your touch** — leans, startles, settles
- [ ] Nothing in the UI is a rectangle with a blur shadow; everything is **a sheet**
- [ ] Screen transitions are **sheets laid on a desk**, not slides
- [ ] The app is beautiful with **motion disabled** and with **sound off**
- [ ] Nothing sits under a notch or a home indicator, on any device
- [ ] Nothing pressures, expires, or punishes
