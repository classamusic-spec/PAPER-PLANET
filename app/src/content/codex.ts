/* PAPER PLANET — the Codex writing: one true fact per Kami, plus what mastery reveals. */

import type { CodexEntry, MasteryTier } from '../contracts'

/* ═══════════════════════════════════════════════════════════════════════════
   MASTERY
   ═══════════════════════════════════════════════════════════════════════════ */

export const MASTERY_ORDER: readonly MasteryTier[] = ['none', 'novice', 'adept', 'master', 'grand']

/** Folds of one species needed to reach each tier. Forgiving on purpose. */
export const MASTERY_THRESHOLD: Record<MasteryTier, number> = {
  none: 0,
  novice: 1,
  adept: 3,
  master: 8,
  grand: 20,
}

export const MASTERY_LABEL: Record<MasteryTier, string> = {
  none: 'Unfolded',
  novice: 'Novice',
  adept: 'Adept',
  master: 'Master',
  grand: 'Grand',
}

/** What the Codex says when a tier is reached. Quiet. Never a fanfare. */
export const MASTERY_NOTE: Record<MasteryTier, string> = {
  none: 'Not yet folded.',
  novice: 'Folded once. The paper remembers.',
  adept: 'Your hands have stopped reading the steps.',
  master: 'You could fold this in the dark. The history of the fold is yours now.',
  grand: 'A thousand times over. Nothing left to learn here but the pleasure of it.',
}

/** Which tier unlocks which part of an entry. */
export function visibleCodex(entry: CodexEntry, mastery: MasteryTier): CodexEntry {
  const rank = MASTERY_ORDER.indexOf(mastery)
  const out: CodexEntry = { fact: entry.fact, habitat: entry.habitat }
  if (rank >= MASTERY_ORDER.indexOf('adept') && entry.factAdept) out.factAdept = entry.factAdept
  if (rank >= MASTERY_ORDER.indexOf('master') && entry.foldLore) out.foldLore = entry.foldLore
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE ENTRIES
   Every `fact` is true. Not a joke, not filler — a thing worth knowing.
   `factAdept` opens at Adept; `foldLore` — the real history of the fold — at Master.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CODEX = {
  /* ── meadow ─────────────────────────────────────────────────────────────── */
  butterfly: {
    fact: 'A butterfly tastes with its feet. It lands on a leaf to find out whether its caterpillars could eat it.',
    habitat: 'Sunny edges, clover, anywhere still enough to warm a wing.',
    factAdept: 'Their wings are not coloured so much as built: rows of microscopic scales that split light. Rub one and the colour comes away as dust.',
    foldLore: 'The four-fold butterfly is the oldest ceremonial origami known — ocho and mecho, male and female butterflies, tied to sake bottles at Shinto weddings since at least the Muromachi period.',
  },
  crane: {
    fact: 'Red-crowned cranes dance: they bow, leap, throw grass in the air. Pairs go on dancing for the whole of their lives together, not only when courting.',
    habitat: 'Marsh and flooded rice field. In Hokkaido they winter in the snow and dance anyway.',
    factAdept: 'A crane’s windpipe is coiled inside its breastbone like a trumpet. That is why one bird calling can be heard two kilometres away.',
    foldLore: 'The simple crane comes from the kite base — the shortest honest road to a bird. Two edges to a line, fold it in half, and the neck is already there waiting to be pushed out.',
  },
  rabbit: {
    fact: 'A happy rabbit leaps and twists in mid-air for no reason at all. Keepers call it a binky.',
    habitat: 'Long grass and hedge bottoms, with a burrow never far behind.',
    factAdept: 'Rabbits eat their food twice. The first pass through produces soft pellets they take again straight from the source — it is how they get at the vitamins grass will not give up the first time.',
    foldLore: 'Folded rabbits are a Japanese New Year habit: the hare is the fourth animal of the zodiac, and paper ones are set out in twelve-year turns.',
  },
  ladybug: {
    fact: 'One ladybird can eat fifty aphids in a day, which is why gardeners have been buying them by the tub since the 1880s.',
    habitat: 'Rose stems, nettles, the underside of any leaf with something to eat on it.',
    factAdept: 'Threatened, a ladybird bleeds on purpose — a bitter yellow fluid seeps from its knee joints. Birds that try one remember the taste and the spots together.',
    foldLore: 'The domed back is a half-inflated waterbomb, closed early. Stop before the air goes in and you have a shell instead of a balloon.',
  },
  snail: {
    fact: 'A snail can seal its shell with dried mucus and sleep through a drought. Desert species have been woken after three years.',
    habitat: 'Damp walls, leaf litter, the shaded side of everything.',
    factAdept: 'A snail’s tongue is a ribbon carrying thousands of tiny teeth. You can hear a large one eating a lettuce leaf if the room is quiet.',
    foldLore: 'The spiral shell is the one classical shape origami cannot fold flat honestly, so folders cheat it the same way every time: a coil of pleats, tightened as it turns.',
  },
  frog: {
    fact: 'A frog drinks through its skin. There is a patch on its belly, the drinking patch, that it presses to wet ground instead of sipping.',
    habitat: 'Pond edges and paddy fields; anywhere with water and something to sit on.',
    factAdept: 'Frogs blink to swallow. Their eyes sink down into the roof of the mouth and push the mouthful backwards.',
    foldLore: 'The jumping frog is a Victorian parlour trick — press its back, let your finger slip off the pleat, and it hops. It is the only classical fold designed to be flicked.',
  },
  bee: {
    fact: 'A returning honeybee dances the way to the flowers: the angle of her waggle is the angle from the sun, and the length of it is the distance.',
    habitat: 'Clover, lime blossom, and a hollow with forty thousand relatives in it.',
    factAdept: 'On hot days bees stand at the entrance and fan. The hive holds itself at about 35 °C all summer — steadier than most houses.',
    foldLore: 'Insect folds are where modern origami began to leave the classical bases behind: to get six legs and two wings from one uncut square you need more points than the old five bases can give.',
  },
  cat: {
    fact: 'Cats sleep around sixteen hours a day, in short pieces, keeping the shallow kind of sleep they can leave instantly.',
    habitat: 'The warmest square metre available, recalculated hourly.',
    factAdept: 'The ridged pattern on a cat’s nose is unique to that cat, the way a fingerprint is.',
    foldLore: 'The sitting cat is traditional Japanese and unusual for having no legs at all — the whole animal is one flat body and two ears, and it works because a sitting cat really is that shape.',
  },
  pumpkin: {
    fact: 'A pumpkin is about ninety per cent water. The rest is mostly the skin that holds the water in.',
    habitat: 'Field corners and allotments, sprawling further than anyone planned.',
    factAdept: 'Every pumpkin is a berry, botanically — a fruit with the seeds inside the flesh. The largest berry there is.',
    foldLore: 'This is the traditional waterbomb, folded and then blown into. Children in Japan filled them from the tap and threw them; the base is named for what it was for.',
  },

  /* ── shore ──────────────────────────────────────────────────────────────── */
  fish: {
    fact: 'Goldfish remember for months, not seconds. They can be trained to push a lever for food and will still push it weeks later.',
    habitat: 'Slow water, weed, and the shade under a lily pad.',
    factAdept: 'A goldfish kept in the dark slowly loses its colour. The gold is made in the skin, and it needs light to keep making it.',
    foldLore: 'The traditional fish gives the fish base its name: four edges to one diagonal, and the two ears that push out at the waist become the fins.',
  },
  crab: {
    fact: 'Crabs walk sideways because their leg joints bend that way — sideways is simply the fastest gear they have.',
    habitat: 'Between tides. Under the flat rock you were about to turn over.',
    factAdept: 'A crab that loses a claw grows it back at the next moult, folded up inside the shell and pumped full of water the moment it splits.',
    foldLore: 'The crab is folded from a windmill base opened out — the four vanes become two claws and two pairs of legs, which is as neat a piece of luck as origami has.',
  },
  turtle: {
    fact: 'A turtle cannot leave its shell. The shell is its ribs and backbone, fused and flattened and grown outward into plates.',
    habitat: 'Warm shallows and the one log everyone wants.',
    factAdept: 'Some freshwater turtles spend the winter underwater without breathing, taking what oxygen they need through the lining of the throat — and, in a few species, through the tail end.',
    foldLore: 'Shelled animals were the hard problem of classical origami: a shell wants to be round and paper wants to be flat. The traditional answer is to fold the shell as a raised blintz and let the light do the rest.',
  },
  penguin: {
    fact: 'Penguins cannot fly in air, but they fly underwater — the same wingbeat, in a fluid eight hundred times thicker.',
    habitat: 'Cold coast. A colony you can hear before you can see.',
    factAdept: 'Emperor penguins huddle against the wind and the huddle rotates, a slow shuffle that brings everyone in from the cold edge and out again. Nobody stays outside.',
    foldLore: 'The penguin is a kite base stood on end. Almost every classical bird is: the kite gives you a body and a point, and where you put the point decides the species.',
  },
  whale: {
    fact: 'A blue whale’s tongue weighs about as much as an elephant. It has to — a mouthful of water and krill weighs more than the whale does.',
    habitat: 'Deep open ocean, and shallow bays when the krill are in.',
    factAdept: 'Blue whale song runs below 20 Hz, under the floor of human hearing, and carries for hundreds of kilometres. Since the 1960s the songs have been slowly dropping in pitch, and nobody is sure why.',
    foldLore: 'The whale is one of the very few classical folds finished with a reverse fold as its last move — the tail flukes flick up out of the body, and the model is done in one gesture.',
  },
  seahorse: {
    fact: 'The male seahorse carries the eggs. She deposits them into a pouch on his belly and he carries them, and then gives birth.',
    habitat: 'Seagrass and coral, holding on with the tail so the current cannot take him.',
    factAdept: 'A seahorse has no stomach. Food passes through so fast that it has to eat almost continuously — up to fifty times a day.',
    foldLore: 'The curled tail is a pleat sequence, not a curve: a run of alternating valleys and mountains, each a little shorter than the last. Paper only bends by lying about it.',
  },
  octopus: {
    fact: 'An octopus has three hearts and nine brains — a central one, and a ring of eight, one for each arm. An arm can solve a problem on its own.',
    habitat: 'Dens in rock and wreck, with a wall of chosen stones across the door.',
    factAdept: 'Its blood is blue. It carries oxygen on copper rather than iron, which works far better in cold water with little of it about.',
    foldLore: 'Eight arms from one square needs eight points, and eight points is exactly what the frog base gives you. It is the oldest reason anyone learned it.',
  },
  heron: {
    fact: 'Green herons fish with bait. They drop an insect, a feather, even a crust onto the water and wait for something to come up for it.',
    habitat: 'The edge of anything wet, standing still enough to be mistaken for a reed.',
    factAdept: 'A heron’s neck folds into an S because one vertebra in the middle is shaped differently. That is the spring; the strike takes about a fifteenth of a second.',
    foldLore: 'Long-necked birds are what the inside reverse fold was invented for. One crease across a folded point, and the point changes its mind about which way it was going.',
  },

  /* ── forest ─────────────────────────────────────────────────────────────── */
  fox: {
    fact: 'A fox hunting under snow lines itself up facing north before it pounces, and the north-facing pounces are the ones that land. It appears to use the earth’s magnetic field as a rangefinder.',
    habitat: 'Woodland edge, hedgerow, and increasingly the end of your street.',
    factAdept: 'Foxes are not pack animals but they are not solitary either — they talk constantly. Zoologists have counted at least twenty-eight distinct calls.',
    foldLore: 'The fox is the classical proof that two ears and a nose are enough. Kitsune folds have been used as messenger figures at Inari shrines for centuries.',
  },
  hedgehog: {
    fact: 'A hedgehog that finds a strong new smell will chew it into a froth and paint the froth over its own spines. Nobody knows why. It is called self-anointing.',
    habitat: 'Hedge bottoms and leaf piles, with a nightly patrol of two kilometres or more.',
    factAdept: 'Hibernating, its heart slows from about 190 beats a minute to twenty, and its body drops to the temperature of the air around it.',
    foldLore: 'The spines are a pleated edge — the same accordion that makes a fan, cut short. Pleating is the oldest way paper was made to look like many things at once.',
  },
  squirrel: {
    fact: 'A squirrel that thinks it is being watched will dig a hole, mime burying a nut, and cover the empty hole up. The nut stays in its mouth.',
    habitat: 'Any wood with hard seed in it, and the roof space above you.',
    factAdept: 'Squirrels forget a good share of what they bury, and the forgotten ones grow. A single grey squirrel may plant a few thousand trees in its life without meaning to.',
    foldLore: 'The tail is a pleated fan locked into a reverse fold — the classical way to get a wide, curved shape out of a base that only wants to make points.',
  },
  deer: {
    fact: 'The sika deer of Nara bow to people. They learned it from the way visitors bow before handing over a cracker, and now they bow first.',
    habitat: 'Forest edge and temple lawn. Wherever browsing is easy and nobody hunts.',
    factAdept: 'Antlers are the fastest-growing tissue of any mammal — a stag can lay down two centimetres of bone in a day — and then he drops them and does it again next year.',
    foldLore: 'Antlers ask more of a square than almost anything else: every tine needs its own point. The classical deer gives up and suggests them with two, which is usually enough.',
  },
  tanuki: {
    fact: 'The raccoon dog is the only dog that sleeps through winter. In the cold north it puts on weight through autumn and spends the worst weeks in torpor.',
    habitat: 'Damp woodland and the ditches beside it, in pairs that stay together.',
    factAdept: 'It is not a raccoon and not a badger — it is the most ancient branch of the dog family still alive. Families share a latrine, and the pile is a noticeboard.',
    foldLore: 'Tanuki statues stand outside restaurants holding a sake flask and a promissory note. The paper ones are folded for luck with money, and traditionally given, never bought.',
  },
  treefrog: {
    fact: 'A tree frog holds on with wet feet, not sticky ones. A film of mucus a few thousandths of a millimetre thick is enough to grip wet glass.',
    habitat: 'Rice paddies in summer, tree bark and gutters the rest of the year.',
    factAdept: 'The Japanese tree frog changes colour with its background — bright green on a leaf, grey-brown on bark — over a few minutes, and does it without looking.',
    foldLore: 'The classical Japanese frog is a frog base with four legs pulled from the four points, and it is the fold that made the base worth the trouble.',
  },
  boar: {
    fact: 'Wild boar piglets are striped for their first months — pale lines down a brown back. In Japan they are called uribo, after the melon whose rind they match.',
    habitat: 'Thick cover near water, coming out at dusk to turn the ground over.',
    factAdept: 'A boar cannot sweat, so it wallows: wet mud cools it, and drying mud takes the parasites off with it when it is rubbed against a tree.',
    foldLore: 'The boar is the last animal of the Japanese zodiac, and the one most often folded in kozo paper left undyed — the fibre in the sheet does the bristles for you.',
  },

  /* ── peak ───────────────────────────────────────────────────────────────── */
  snowhare: {
    fact: 'Mountain hares turn white for winter. The change is triggered by the shortening day, not the cold — which is why a brown hare on early snow is a hare that trusted the calendar.',
    habitat: 'Open ground above the treeline; a shallow scrape in the lee of a rock.',
    factAdept: 'Hares are born with their eyes open and fur on, and are left alone in the open within hours. Rabbits are born blind and bald in a burrow. They are not the same animal at all.',
    foldLore: 'Winter folds are traditionally made from paper dyed on one side only, so that every reverse fold shows white. The hare is the fold that idea was invented for.',
  },
  serow: {
    fact: 'The Japanese serow is neither goat nor antelope but something older than both, and it is so rare and so odd that Japan made it a Special Natural Monument in 1955.',
    habitat: 'Steep forested rock, alone, in a territory it marks and keeps for years.',
    factAdept: 'It marks its ground with a gland below each eye, pressing its face to a branch to leave a smear of scent — which is why serow trails smell faintly of vinegar.',
    foldLore: 'Mountain animals are folded standing on all four points of a bird base — two front legs, two back — with the head reverse-folded from what would have been the tail.',
  },
  eagle: {
    fact: 'Steller’s sea eagle is the heaviest eagle alive, up to nine kilograms, and its bill is so deep it can be told from any other eagle at a glance.',
    habitat: 'Sea cliffs and river mouths of the far north, on drift ice in winter.',
    factAdept: 'An eagle’s eye has a deep central pit packed with receptors, giving it a magnified patch in the middle of its vision — a built-in telephoto, four to eight times sharper than ours.',
    foldLore: 'Spread wings need the widest part of the paper, so eagles are folded from a bird base turned the other way up: what makes a crane’s neck makes an eagle’s tail.',
  },
  dino: {
    fact: 'Not all dinosaurs were large. Compsognathus was the size of a chicken, and the smallest known adults would have fitted in two hands.',
    habitat: 'Mudstone, siltstone, and the side of a mountain that used to be a riverbed.',
    factAdept: 'Birds are dinosaurs — not descended from them, but inside the group, the way a sparrow is inside the birds. The line never actually ended.',
    foldLore: 'The long neck and long tail from one square is the classic test of a fold: two big points at opposite corners, which is exactly what the fish base was built to give.',
  },
  orizuru: {
    fact: 'Red-crowned cranes live thirty years and more in the wild, and were thought to live a thousand — which is why one thousand of them are folded for one wish, one crane a year.',
    habitat: 'Marshland, snowfield, and the string of a senbazuru in a hospital window.',
    factAdept: 'The wild population fell to about thirty birds in Japan in the early 1900s. It was saved by farmers in Kushiro who started feeding them corn in the hard winters, and there are over a thousand now.',
    foldLore: 'The orizuru appears in Hiden Senbazuru Orikata, published in 1797 — the oldest known book of origami instructions in the world. It shows how to fold connected cranes from a single cut sheet.',
  },

  /* ── nightsky ───────────────────────────────────────────────────────────── */
  bat: {
    fact: 'A little brown bat can take a thousand insects in an hour, catching each one in the pocket of its tail membrane and eating on the wing.',
    habitat: 'Caves, roof spaces and hollow trees; over water at dusk.',
    factAdept: 'Bats are the only mammals that truly fly. The wing is a hand — four enormous fingers with skin stretched between them, and a thumb left free to climb with.',
    foldLore: 'Bat wings are the reason the mountain fold exists in the vocabulary at all: to get a membrane that curves away from you, the crease has to go the other way.',
  },
  moth: {
    fact: 'An adult luna moth has no mouth. It lives about a week on what it stored as a caterpillar, and spends all of it looking for a mate.',
    habitat: 'Birch and walnut woods, at a lit window at two in the morning.',
    factAdept: 'The long twisted tails on its hindwings spin as it flies and throw a bat’s sonar off, so the strike lands on the tail instead of the body. Moths with the tails cut off are caught far more often.',
    foldLore: 'Moth and butterfly folds are the same until the last step. The moth’s wings stay flat to the table; the butterfly’s are lifted. One crease, two species.',
  },
  firefly: {
    fact: 'Firefly larvae are the hungry ones, and Genji-botaru larvae live underwater for a year eating river snails. The adult glows for two weeks and eats nothing but dew.',
    habitat: 'Clean slow rivers, one warm humid night in June.',
    factAdept: 'The flash rhythm differs across Japan: fireflies in the east flash about every four seconds, those in the west about every two. The dividing line runs down the middle of Honshu.',
    foldLore: 'Folded from gold-flecked paper, the fold is deliberately tiny — the traditional size is one eighth of a sheet, so a boxful can be scattered on a table like a river bank.',
  },
  owl: {
    fact: 'An owl can turn its head about 270 degrees. It has to: its eyes are tubes fixed in the skull and cannot swivel at all.',
    habitat: 'Old trees with holes in them, hunting a wood it knows by heart.',
    factAdept: 'A barn owl’s ears sit at different heights on its head, so a sound arrives at each at a slightly different moment. That difference tells it how high the mouse is, in the dark, exactly.',
    foldLore: 'The owl is folded from a kite base blunted — the point that would be a beak is folded back on itself, which is the classical way to say round.',
  },
  musasabi: {
    fact: 'The Japanese giant flying squirrel does not fly but glides, and a good launch from a tall cedar carries it more than a hundred metres.',
    habitat: 'Old cedar and temple woods; a hole in a trunk, and out at dusk.',
    factAdept: 'A rod of cartilage on each wrist swings out to hold the gliding membrane wide — a spar no other gliding mammal has — and the flat tail works as the brake.',
    foldLore: 'The glider is a blintz fold: all four corners to the centre. It makes a shape with no points at all, which is exactly right for an animal that is mostly membrane.',
  },
} satisfies Record<string, CodexEntry>

export type CodexId = keyof typeof CODEX
