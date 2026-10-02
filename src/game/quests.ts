// Quests: what the knight is here to do, and what's worth finding off the road.
// Each realm has its own list; progress lives in that realm's part of the save
// (save.data.quests) as a step index (absent = not started). Every realm's main
// quest has the id 'main'.
import type { RealmId } from '../world/realm';

export interface QuestDef {
  id: string;
  title: string;
  main?: boolean;
  /** One line per step; the last step is the finished state. */
  steps: string[];
  /** Short line for the on-screen objective. */
  short?: string[];
}

const CASTLE: QuestDef[] = [
  {
    id: 'main',
    title: 'The Moonlit Keep',
    main: true,
    steps: [
      "Follow the King's Road north-west to Keepsfoot.",
      'Find a way into the keep. The village elder by the well may know one.',
      'Lower the drawbridge. The winch stands on the Outer Bailey, reached through Blackpine Wood.',
      'Cross the drawbridge and clear the courtyard garrison.',
      'Defeat the Goblin King in the Hall of the Moon Throne.',
      'The keep is free, and dawn has come.',
    ],
    short: ['Reach Keepsfoot', 'Talk to the elder by the well', 'Lower the drawbridge (Outer Bailey)', 'Clear the courtyard', 'Defeat the Goblin King', 'The keep is free'],
  },
  {
    id: 'tam',
    title: "Pip's Brother",
    steps: ['Pip\'s brother Tam went after the goblins in Blackpine Wood with a pitchfork. Find him.', 'Tam is free and running home. Tell Pip.', 'Tam is home with his sister.'],
  },
  {
    id: 'stones',
    title: 'The Seven Stones',
    steps: ['A stone circle stands east of the King\'s Road. Stand at its altar and face the trial.', 'The Knight\'s Crest is yours: blocking costs less stamina.'],
  },
  {
    id: 'shards',
    title: 'Moon Shards',
    steps: ['Shards of the moon are hidden across the realm: by still water, behind old stone, above a long drop.', 'All three shards found. Your heart is stronger.'],
  },
  {
    id: 'farm',
    title: 'Raiders on the Fields',
    steps: ['Goblins are burning the fields south of the Old Warden\'s house. Drive them off.', 'The fields are quiet. Tell the Old Warden.', 'The Warden paid you with what the king left him.'],
  },
  {
    id: 'lodge',
    title: 'The Hunting Lodge',
    steps: ['The Old Warden says the king\'s hunting lodge lies deep in Blackpine, in the north-east. Something big lairs there now.', 'The lodge beast is slain.'],
  },
  {
    id: 'thorns',
    title: 'The Thorn Road',
    steps: [
      'Black thorns from the Old Wood have grown across the deer trail past the hunting lodge, where it runs north along the gorge. A charging warhorse could break through.',
      'The thorn road is open. It runs north along the gorge into Whisperwood, and back.',
    ],
  },
];

const FOREST: QuestDef[] = [
  {
    id: 'main',
    title: 'Whisperwood',
    main: true,
    steps: [
      'Thorns choke the ancient wood. Find its people: the folk of Hollowbough live in great trees round a lake, west through the Old Grove.',
      'Hollowbough. Ask Alder the Reeve, who lives in the Heart Oak on the island in the lake, what has happened to the wood.',
      'The Reeve says the Thorn Warden holds the north-west. Cross the Rookfall bridge, north past the High Canopy.',
      'West through the Thorn Ravine, under the cliffs, to the stair by the Overhang.',
      "Thorns bar the stair up to the Warden's hold, and their heart beats in them, at the top of the stair. Tear it out.",
      "The thorns have withered. Clear the Warden's garrison, and face the Thorn Warden among the roots of the Great Tree.",
      'The Warden is soil again, and light comes down through the leaves.',
    ],
    short: ['Find Hollowbough', 'Talk to Alder the Reeve', 'Cross the Rookfall bridge', 'Through the Thorn Ravine', 'Tear out the Thorn Heart', 'Defeat the Thorn Warden', 'The wood wakes'],
  },
  {
    id: 'sister',
    title: 'A Sister Past the River',
    steps: ["Ash's sister Wren went gathering past the Whisper, by the black water, and never came back. Find her.", 'Wren is out of the cage and away down the deer paths. Ash will want to know.', 'Wren is back in the home tree, mending her frock again.'],
  },
  {
    id: 'oaks',
    title: 'The Ring of Oaks',
    steps: ['West of Hollowbough the old oaks stand in a ring, and they test whoever wakes them at their altar.', 'The Heartwood Seed is yours: one more heart.'],
  },
  {
    id: 'shards',
    title: 'Moon Shards',
    steps: ["Three more shards of the moon are hidden in the Old Wood: among the fen's pools, up where the vines climb, at the top of the canopy.", 'The wood has given up its three shards: one more heart.'],
  },
  {
    id: 'stag',
    title: 'The Bound Stag',
    steps: [
      "A great stag is held in the Warden's thorns, in a hollow of the Deep Wood west of the Ring of Oaks, and his goblins keep it. Cut it free.",
      'The Thornstag is free and will carry you: it leaps twice, gores with its antlers, and fights with thorns.',
    ],
  },
];

// (Being built: the main quest grows with the realm.)
const AQUA: QuestDef[] = [
  {
    id: 'main',
    title: 'The Sunken Reef',
    main: true,
    steps: [
      'The sea swallowed a kingdom, and its lord still waits below. In armour you would sink like a stone, but the goblins out on the lighthouse isle dive the wrecks somehow: a sandbar runs out to it.',
      "The salvager's diving suit is yours: patched and leaky, good for a minute and a half under the water. Go down into the deep.",
      // The Tidelord's palace (group 35).
      "Across the trench from the drowned kingdom stands the Tidelord's palace, its floodgate shut fast. The kingdom's great bell still hangs in its plaza: they say its toll once opened the palace's gates. Ring it.",
      "Far off, the floodgate has risen. Ride the current over the trench, past the Tidelord's crew, into his throne hall.",
      'The sea is free, and daylight finds the floor again.',
    ],
    short: ['Find a way down into the sea', 'Go down into the deep', 'Ring the sunken bell', 'Face the Tidelord', 'The sea is free'],
  },
  {
    id: 'serpent',
    title: 'The Netted Serpent',
    steps: [
      "The goblins have netted a great sea serpent in the pool south of the sandbar, and its keepers stand guard. Cut the nets' lines where they're staked on the sand.",
      'The Tide Serpent is free and will carry you across the sea; in the diving suit it swims down through it too. It spits bubbles, stirs up whirlpools and wraps you in a bubble shell.',
    ],
  },
  // The reef's own (group 34): the pearl-diver's son, the Whalebone Isle's trial, the shards.
  {
    id: 'kip',
    title: "The Pearl-Diver's Son",
    steps: [
      "Maren's son Kip was taken by the crew toward the deep trenches. The crew's floats run out from the lighthouse isle, past the wreck. Find him.",
      'Kip is out of the cage and swimming for home. Maren will want to know.',
      'Kip is home, and already talking about diving again.',
    ],
  },
  {
    id: 'pearl',
    title: 'The Whalebone Isle',
    steps: ["Off the coral gardens an old whale's bones ring a giant clam, and the clam gives the Tide Pearl to whoever holds the ring. The village's floats lead out to it.", 'The Tide Pearl is yours: whatever carries you takes one more hit.'],
  },
  {
    id: 'shards',
    title: 'Moon Shards',
    steps: ["Three more shards of the moon are hidden under the sea: where the coral grows thickest, in the kelp's dark heart, at the bottom of the trench.", 'The sea has given up its three shards: one more heart.'],
  },
  // The reef's errands (src/game/story/errands.ts).
  {
    id: 'bottlemap',
    title: 'A Message in a Bottle',
    steps: ["A map from a bottle on the beach: an X of stones out on the north dunes, past the crew's camp. Strike the sand where the stones cross to dig.", 'You dug up the chest the map led to.'],
  },
  {
    id: 'glowbait',
    title: 'Glowing Bait',
    steps: [
      'Brill, fishing off the jetty, wants five glowing shrimp from the coral gardens. They shine among the coral like lamps.',
      'Five glowing shrimp. Take them to Brill on the jetty.',
      'Brill paid you, and put the shrimp in your Moon Flasks: each heals one more heart.',
    ],
  },
  {
    id: 'currentrace',
    title: 'The Current Race',
    steps: [
      "Pike the diver lad bets you can't beat his time: through the glowing rings off Gull Rock, from the trench's lip west of the rock, along the current over the abyss, up the column of bubbles, back to the rock. Sixteen breaths.",
      "You beat Pike's time, and took his winnings.",
    ],
  },
  {
    id: 'lostdiver',
    title: 'The Lost Diver',
    steps: [
      "Merrow's husband Cockle dived for their sunk boat off the lighthouse isle's far side and never came up. Find him, and lead him to air: a column of bubbles, a vent, or the shallows.",
      'Cockle is breathing again and off home. Tell Merrow.',
      'Cockle is home, and swears he will never dive again. Until tomorrow.',
    ],
  },
  {
    id: 'nightraid',
    title: 'The Night Raid',
    steps: ["The crew have waded ashore at the coral village to pay it back for the salvager's suit. Drive them off.", 'The crew are driven off, and the village paid you all it could spare.'],
  },
  // The lighthouse's (src/game/story/lighthouse.ts).
  {
    id: 'lamp',
    title: 'The Dark Lamp',
    steps: [
      "Old Wick kept the lighthouse lamp until the crew put it out, so that the fishers' boats would break on the rocks for salvage. It wants oil, from the sunken ship's hold, and its lens, thrown into the sea east of the lighthouse rock.",
      'You have the oil and the lens. Climb the stair round the lighthouse to its gallery, and light the lamp.',
      "The lamp burns again, and the fishers' boats are coming home. Old Wick is waiting at the foot of his lighthouse.",
      "The lighthouse burns, the boats are home, and Wick gave you his storm lantern: it lights the deep round you.",
    ],
  },
];

export const QUESTS: Record<RealmId, QuestDef[]> = { castle: CASTLE, forest: FOREST, aqua: AQUA };

/** One realm's quests. */
export class QuestBook {
  constructor(public list: QuestDef[]) {}
  def(id: string) {
    return this.list.find((q) => q.id === id)!;
  }
  done(id: string, step: number | undefined) {
    return step !== undefined && step >= this.def(id).steps.length - 1;
  }
}
