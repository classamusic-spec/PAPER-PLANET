# Teaching Real Origami

Research notes and a build plan for turning PAPER PLANET from a game that *looks*
like origami into one that actually teaches it.

---

## 1. The legal line (read this first)

This is the constraint that decides everything else, and it is easy to get
expensively wrong.

**Origami designs are copyrighted.** Both the *composer* of a figure and the
*diagrammer* (when different) hold rights. OrigamiUSA formulated its policy
after consulting an IP lawyer with 25+ years in copyright law, and its position
is unambiguous: the vast majority of published origami designs are of recent
authorship and cannot be published or used commercially without permission from
their creators.

**Traditional models are public domain.** These have no known designer — their
origins are lost — and anyone may teach them, diagram them, and sell the result.
The canonical set:

> crane (orizuru) · waterbomb · jumping frog · boat · cup · kabuto (samurai
> helmet) · flapping bird · Chinese junk · swan · sailboat · house · piano ·
> lantern · pig · box · fox · carp · butterfly · five-pointed star · lily/iris

**Teaching** informally is generally considered fair use. Teaching a *creator's*
model at an organised event requires their permission.

### What this means for us

| | |
|---|---|
| ✅ Safe | Traditional models, taught and diagrammed by us |
| ✅ Safe | Our own fantasy Kami composed from classical bases (what we ship today) |
| ✅ Safe | The classical **bases** themselves — kite, fish, bird, frog, waterbomb, preliminary, windmill. Centuries old, no author. |
| ⚠️ Needs a licence | Any named modern design (Lang, Kamiya, Montroll, Jackson…) |
| ❌ Never | Copying someone's diagrams or photographs |

The happy accident: **the traditional set and the classical bases are exactly
what a beginner should learn first.** The legally safe path and the
pedagogically correct path are the same path.

---

## 2. What we already have that is genuinely real

More than it looks. `src/content/recipes.ts` implements all eight classical
bases with correct geometry, not decoration:

```
simpleBase · kiteBase · fishBase · preliminaryBase
waterbombBase · birdBase · frogBase · windmillBase · blintz
```

with real landmark constants —

```ts
export const Q = SQ * (Math.SQRT2 - 1)   // 414.214: where a 22.5° crease
                                         // from a corner meets the far edge
```

That number is not invented. A 22.5° crease from a corner of a unit square
meets the opposite edge at exactly √2−1. The kite base in this app is the kite
base.

**So the foundation is sound.** What is missing is not geometry — it is
*pedagogy*.

---

## 3. The gap no existing tool fills

| Tool | What it does | What it cannot do |
|---|---|---|
| **Diagram books** | The canonical sequence, precise notation | No feedback. A tiny error on step 2 quietly ruins step 9. |
| **Video tutorials** | Sequence + a human demonstrating | No feedback either, and you are pausing with folded-paper hands. |
| **Origami Simulator** (Ghassaei / Demaine) | Folds a whole crease pattern at once in WebGL, imports FOLD/SVG | Deliberately **not sequential** — it simulates the destination, not the journey. Its own docs note the prepared example still takes considerable effort to actually fold. |
| **PAPER PLANET** | Sequential, gesture-driven, **and it can tell you whether you did it right** | — |

Nobody is doing interactive sequential folding *with feedback*. That is the
opening, and our engine already computes exact geometry, so we can score a fold
against the truth — the one thing a book physically cannot do.

---

## 4. The teaching design

Six systems, in dependency order.

### 4.1 Landmarks — the pedagogical core

Ask any origami teacher what beginners get wrong and the answer is precision,
and the cure is references. A **landmark** is a point, crease, edge or corner
that locates a move exactly. The community advice is literally *"find a
reference for every step."*

Today our steps say *"Bring the corner across."* A taught step says:

> **Corner to corner.** Bring the top-right corner down onto the bottom-left
> one. Let them touch before you press.

So `FoldStep` grows a `landmark`: what meets what. The engine knows both points
exactly, so we can

- name the reference in the instruction,
- draw it (two marks that snap together when they align),
- **score against it** — how close did the corners actually come? That replaces
  our current proxy (drift off the hint vector) with the thing origami actually
  cares about.

### 4.2 Real notation (Yoshizawa–Randlett)

The international standard since the 1950s, from Akira Yoshizawa, extended by
Randlett and Harbin. Learning it is *transferable* — it is how you read any
origami book in any language.

| Symbol | Meaning |
|---|---|
| dashed line | valley fold (toward you) |
| dash-dot line | mountain fold (away) |
| thin line | an existing crease |
| dotted line | hidden edge / x-ray |
| split-headed arrow | valley fold motion |
| single hollow arrowhead, hooked | mountain fold |
| double-headed hollow arrow | unfold |
| arrow with a loop in the stem | turn over |
| fraction in a circle | rotate |
| hollow-stemmed arrow | push (sink, reverse fold) |
| open circle | hold here |
| leader + hatch marks | repeat steps n–m |
| matched tick marks | equal distances |

A **Diagram layer** toggle re-draws the live model in this notation. The player
learns the language while folding, then can open any book.

### 4.3 Pre-crease, then collapse

The real workflow for every classical base, and a documented teaching result:
folding all creases *first* and then collapsing produces a visibly better bird
base than following the steps in order.

Our engine already supports crease-without-rotation, so this is a recipe
authoring pattern plus a UI beat: a **crease pass** (flat, all references laid
in), then a **collapse** — one gesture that brings the whole base together. The
collapse is the most satisfying move in origami and we currently do not have it.

### 4.4 Transfer to real paper

The point of teaching is that you can then fold a real sheet. Add a **Fold
Along** mode:

- one step per screen, big, at your own pace, advanced by tap — no gestures,
  because your hands are holding paper
- the notation diagram, not the game view
- a printable one-page reference: the crease pattern plus numbered steps
- "what size paper" and "which side up" guidance, because colour references
  beat directional words: *"fold the coloured side to the white side"* is
  unambiguous where *"fold it up"* is not

### 4.5 The crease pattern, and why it lies flat

Unfold a finished model and you get its crease pattern. Show it, and use it to
teach the two theorems a curious person can actually verify by hand:

- **Maekawa**: at any flat-foldable vertex, mountains − valleys = ±2
- **Kawasaki**: alternately adding and subtracting the angles around a vertex
  gives zero

(General flat-foldability is NP-complete, which is a fun thing to be able to
tell someone.)

Export the CP as **FOLD** — the JSON interchange format from Demaine's group,
the de-facto standard for computational origami — so a model folded here opens
in Origami Simulator. That is a real bridge to the wider origami world.

### 4.6 A skill tree that mirrors the real craft

Progression gated on *technique demonstrated*, not folds counted:

```
Valley & mountain → kite base → fish base
  → preliminary → waterbomb → bird base → inside reverse
  → frog base → squash & petal → sink
```

Each technique gets a short drill, and unlocks the traditional models that use
it. That is how origami is actually taught, and it maps onto the mastery system
we already have.

---

## 5. Build order

1. **Landmarks** (§4.1) — everything else leans on it, and it upgrades our
   quality score from a proxy to the real measure.
2. **Traditional models** (§1) — add ~12 real public-domain models beside the
   fantasy Kami. Crane and waterbomb first; we already fold both.
3. **Notation layer** (§4.2) — the transferable skill.
4. **Pre-crease + collapse** (§4.3) — the best-feeling move we are missing.
5. **Fold Along + printable** (§4.4) — where it stops being a game and becomes
   teaching.
6. **CP view + FOLD export** (§4.5) — depth, and credibility with real folders.
7. **Skill tree** (§4.6) — restructures progression once the rest exists.

Keep the Kami. The fantasy creatures are the reason someone opens the app; the
real origami is the reason they keep it. A player who folds a Kami has, without
being told, folded a bird base.

---

## Sources

- OrigamiUSA — [Copyright Policy](https://origamiusa.org/copyright), [Copyright FAQ](https://origamiusa.org/copyright-faq), [Teaching Tips](https://origamiusa.org/teaching-tips)
- Robert J. Lang — [Origami Diagramming Conventions](https://langorigami.com/article/origami-diagramming-conventions/), [Copyright](https://langorigami.com/copyright/)
- [Yoshizawa–Randlett system](https://en.wikipedia.org/wiki/Yoshizawa%E2%80%93Randlett_system)
- [Origami bases](https://en.wikibooks.org/wiki/Origami/Techniques/Model_bases) · [British Origami Society: Bases](https://www.britishorigami.org/resources/bases/)
- [Kawasaki's theorem](https://en.wikipedia.org/wiki/Kawasaki%27s_theorem) · [Maekawa's theorem](https://en.wikipedia.org/wiki/Maekawa%27s_theorem) · [Huzita–Hatori axioms](https://en.wikipedia.org/wiki/Huzita%E2%80%93Hatori_axioms)
- [Origami Simulator](https://origamisimulator.org/) — Ghassaei, Demaine et al.
- [FOLD file format](https://github.com/edemaine/fold) — Demaine et al.
- [Jeff Raab — Find a Reference for Every Step](https://www.jeffreymichaelraab.com/2023/07/14/origami-challenge-11-find-a-reference-for-every-step/)
