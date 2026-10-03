# Realms 1 and 2 revisited: as alive and beautiful as realm 3 (plan, 2026-10-02)

The user (2026-10-02): "we wont start with realm 4 after you are done with all of this. I want us to check again
realm 1 and 2, because realm 3 is very beutiful in comaprison - maybe we can make them also this much
better/interesting/beutiful". Task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md). Realm 4 waits
([066](../blocked/066-read-the-realm-4-plan.md)).

Two agents compared realm 1 and realm 2 against realm 3 from the game camera on 2026-10-02: 39 and 43 shots, the
colours measured from the shots, the life, lights, particles and props counted in the live game within 20 m of
the knight. Nothing was changed. Their scripts (to become `tools/look.mjs` in group 85) and shots are in the
session's scratchpad: `r1look/shots-r1look/` (`analyze.mjs`, `stats.js`) and `r2look/shots-r2look/` (`hue.mjs`,
`measure.js`).

## What makes realm 3 look better (measured)

Not more colours: its night spans fewer hues than realm 1's. It is one colour family, **brighter, more saturated
and higher in contrast**, with warm and glowing accents that pop; and **everything moves**.

| | Realm 1 | Realm 2 | Realm 3 |
|---|---|---|---|
| Night brightness (mean of shots) | 0.21-0.25 | 0.25 | 0.33 |
| Night contrast | 0.07-0.10 in the countryside | 0.095 | 0.11-0.16 |
| Night saturation | 0.36-0.43 | | 0.42-0.58 |
| Dawn | one beige veil (warm 92-100%) | one yellow-green wash (hue spread 8-15) | its sea teal under warm light (spread 64) |
| Light per zone | none (the prototype tinted every zone) | mist thickest of all realms over every water | one family, accents from things |
| People (doing something) | 7 (none: no `roam`, no `pose`) | 18 (10) | 37 (28; 28 within 20 m of its green) |
| Animals, birds, fish | 48 small animals in the grass | 28; nothing flies or swims | ~800 fish, rays, turtles, jellies, gulls, seals, boats, crabs, moths |
| Particles in the empty places | 79-195 | | 328-1,546 everywhere |
| Water | near-black, opaque, square-stepped shores, no flow | a still plane under grey mist | clear, a lit floor, surf on every shore |
| Set pieces that change with the story | 3 (Tam home, the drawbridge, the farm) | the thorns only | the lighthouse and the boats, the bell and the floodgate, the blowhole, the raid... |
| Errands; lore; chests | 0; 5; 11 | 0; 9; 23 | 5; 13; 33 |
| Sound beds of its own | ~3 | birdsong over realm 1's six | ~11 |
| Props | even everywhere (43-63k vertices within 20 m) | 189 colours; 4,000 trees of realm 1's five kinds in two greens | peaks at set pieces (138-277k), rests between (23-33k); 1,087 colours |

**Keep:** realm 1's keep and hall (better than realm 3's fog-washed palace), its torch-against-blue look, the barrows
and the glowing arch, the half-timbered village; realm 2's lantern-lit home trees seen from above, the glowing
fungi and the Mushroom Dell, the Drowned Shrine, the rope bridges, the Warden's root-ringed hollow.

## Decisions (the lead, 2026-10-02; the user: decide what makes sense)

- **Each realm keeps its own character**: realm 1 a moonlit keep and its countryside (fields, a village, woods,
  barrows, the keep), its colours blue-violet with warm fire (hue 205-253); realm 2 a wild, old forest with a
  village in and under great trees, green-teal (143-169). No realm 3 colours, no recoloured gulls or fish: every
  new creature, prop and line is the realm's own (the 40/60 aim: the systems are shared grammar, the instances
  are each realm's vocabulary).
- **Shared groundwork first** (light per zone, water, life), built once for both realms in the engine and game
  code realm 3 already uses (`sealife.ts`, `shorelife.ts`, the light shafts), so realm 3 gains nothing and loses
  nothing; then each realm's own groups, realm 1's and realm 2's side by side (different files).
- **Targets** (measured at the same `&at=` spots as the comparison): realm 1's night brightness ~0.28, saturation
  ~0.45, contrast 0.11 or more; realm 2's ~0.30 and ~0.12; dawns at about half warm, hue spread over 40; people
  ~20 in Keepsfoot and ~35 in Hollowbough, most doing something; something moving in every screen; particles over
  250 in the empty places; errands 5 (realm 1) and 4 (realm 2); lore ~12 and ~13; chests ~18 and ~28, the economy
  re-balanced to the same surplus; draw calls no worse than now, phones measured.
- **The design rules hold** ([docs/design/design-rules.md](../../docs/design/design-rules.md)): villages with room,
  nothing tall on the camera's +x+z side (the mill, the beacon, the island shrine on the far side of what they
  dress), paths only to purposeful places (none to secrets), zones that read as zones, wild realms stay wild,
  changes plainly visible from the game camera with before/after shots.
- **Performance** as realm 3 does it: one instanced mesh per kind, culled beyond ~38 m, fewer on phones; realm 1
  already has 163 light sources and 138 emitters, so new light comes from emissive things, not more point lights.
- **Left out for now:** a roll pressed early in a swing ([084](../backlog/084-roll-dropped-early-in-a-swing.md)) is
  a moveset change for its own decision.

## Groups

Shared groundwork (one agent each, side by side):

- [ ] **85 Light, mist and dawn per zone** ([085](../done/085-light-mist-dawn-per-zone.md)): a light per zone,
  blended at the borders (realm 1: Keepsfoot warm amber, Blackpine green-black, the barrows cold violet with
  ghost-cyan, the marsh sallow, the fields silver-blue, the keep indigo against torch orange, the hall ember-red;
  realm 2: mist by zone, thin and low over open ground, water and the village, thick only in the Deep Wood, the
  Mossfen and Rookfall's floor); brighter nights to the targets; dawns of their own (realm 1 rose-gold on stone,
  green meadows, silver water; realm 2 gold through the trunks, mist burning off); moon-blue as realm 1's
  signature glow (moonpetals, moon-blue banners with a gold crescent, as the prototype had). `tools/look.mjs` for
  the measures.
- [ ] **86 Water that reads** ([086](../done/086-water-that-reads.md)): a lapping edge on every bank and shores that
  aren't square steps; flow on streams and rivers (ripples and foam drifting downstream, white water at fords,
  falls and bridges); clear shallows over a visible bed, dark deeps as a mirror; a moon path and lamps' light laid
  on the water. Realm 3's sea unchanged.
- [ ] **87 Life in the air, the water and the fields** ([087](../done/087-life-air-water-fields.md)): the reef's
  instanced flocks and schools made general; realm 1: crows round the keep's towers, harmless bats over the
  barrows, swans and ducks on Mirrormere and the moat, a heron at the ford, frogs, fish rising, sheep, cows,
  geese, moths at every lamp, glow-worms in Blackpine, pale chimney smoke; realm 2: rooks over Rookfall, a heron
  and ducks on the Heartpool, bats leaving the Roost, trout in the Whisper, carp, frogs on the lily pads, moths,
  fireflies in every glade (yellow as the prototype's beside the cyan), more deer, a white hart in each realm.

Realm 1, the Moonlit Keep:

- [ ] **88 Keepsfoot lived in** ([088](../done/088-keepsfoot-lived-in.md)): about 12 more villagers, each doing
  something (a night watchman's round with a lantern, the smith at his anvil with sparks, children at the well, a
  couple on a bench, a lamplighter, a fisher on the bridge, washing hung, a drinker at the tavern door, a girl
  feeding the hens); villagers turn and speak as he passes (as the prototype's did); lanterns strung across the
  street; the village changes with the story (a feast table after Tam comes home, lanterns up the north road after
  the drawbridge falls, everyone out at dawn); Gnasher's camp at its business before the fight.
- [ ] **89 Realm 1's set pieces** ([089](../done/089-realm-1-set-pieces.md)): a watermill on the stream above the
  ford (a turning wheel, a lit window, a lane); the keep's beacon as a landmark (cold moon-blue while the Goblin
  King holds it, gold at dawn); a ruined shrine on Mirrormere's island (hidden stepping stones); the Seven Stones'
  runes glowing in turn and the eighth stone half-buried with a chest; the Kings' Orchard in blossom; the raided
  farm smouldering, then mended; a waterfall off the Overlook with a ledge behind it; a night fisher's lantern
  boat on Mirrormere.
- [ ] **90 Realm 1's errands and finds** ([090](../in-progress/090-realm-1-errands-finds.md)): five errands that change a
  place you can see (the miller's jammed wheel turns; the lamplighter's stolen oil lights the road's lamps up to
  the keep; Pip's cat in the Hollow; the shepherd's strays in Blackpine; the chapel's bell rope back from
  Gnasher's camp, and the bell rings the hour); lore 5 to ~12, chests 11 to ~18; things that answer the sword
  (bells, crows bursting up, falling apples); the economy re-balanced.
- [ ] **91 Realm 1's sound** ([091](../in-progress/091-realm-1-sound.md)): beds of its own per place (the smithy's hammer
  and bellows, the tavern's voices through its walls, the chapel bell, the mill wheel, frogs and bitterns in the
  marsh, the ford's babble, wind in the pines, crows over the keep, banners and chains at the bailey) and animal
  voices placed in space.

Realm 2, Whisperwood:

- [ ] **92 Whisperwood's trees and colours** ([092](../in-progress/092-whisperwood-trees-colours.md)): leaves by zone
  (silver birches at the verges, copper and gold beeches in the Old Grove, blue-black pines in the East Woods,
  rust in the Withered Wood, lime oaks in the Deep Wood, one tree in twelve an odd tone); accent trees by hand
  (white hawthorn by the Heartpool, rowans with red berries on the lanes); the prototype's pink campion and
  foxgloves; vines on more cliff faces; Hollowbough's camera side cleared (near crowns thinned, the hidden doors in
  view: [082](../backlog/082-hollowbough-doors-hidden.md), cut-away trunks drawn as faint outlines).
- [ ] **93 Hollowbough lived in** ([093](../done/093-hollowbough-lived-in.md)): 15-20 more villagers doing things
  (children on a rope swing, a lamplighter, foragers coming home, a storyteller with listeners, a lookout up a
  treehouse, a carver, the weaver at her loom); the inn's hollow as a room to walk into, with voices and a lute;
  the village changes with the story (the thorn-scarred trees green again when the Thorn Heart is torn out,
  lanterns up the lanes after the Warden falls).
- [ ] **94 Whisperwood's set pieces** ([094](../in-progress/094-whisperwood-set-pieces.md)): moonlit glades (openings in
  the canopy with light shafts and pale moss); the Great Tree as a landmark (a violet-green pulse of the Warden's
  sickness in its crown, seen from the village; it blossoms after the victory); Rookfall a gorge that reads (a
  falling curtain with spray, ferns and moss, mist only below the rim); the High Canopy dressed up high (glowing
  pods, lanterns on the rope walk); the Wardens' Circle, a ruin telling the Warden was once a guardian (the
  prototype's own line); the Fallen Giant a hollow to walk through; a beaver pond; wisps over the Blackwater.
- [ ] **95 Whisperwood's errands, finds and sound** ([095](../todo/095-whisperwood-errands-finds-sound.md)): four
  errands of the wood (the beekeeper's lost swarm, the forester's snares, Old Nettle's night flower, a kite caught
  in the High Canopy); lore ~13, chests ~28; birds' nests and fairy rings; beds of its own (the canopy's hush and
  creak, the roar at the falls, a frog chorus, the village's chimes, voices and lute, a dawn chorus, a nightingale
  by the Heartpool); the economy re-balanced.

Both:

- [ ] **96 Review and balance** ([096](../todo/096-realms-1-2-review-balance.md)): the look measured again against
  the targets; performance on desktop and phones; a playthrough of each realm from a fresh save; the full suite;
  the 40/60 re-measured ([realm scores](../../docs/design/realm-scores.md)); the docs and the realms' pages.

## Order and agents

85, 86 and 87 side by side (shared code: the light, the water shader, the life module; each owns its files),
merged and committed; then 88-91 and 92-95 two at a time (one realm-1 group beside one realm-2 group: different
files), merged after each pair; then 96. Each group in its own copy with the realm-builder or content-builder
agent; before/after shots from the game camera at the comparison's spots; its checks; committed and pushed to
master by the lead after merging. About an hour or two of agent time a group.
