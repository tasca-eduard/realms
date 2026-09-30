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
      "Thorns bar the stair to the Warden's hold. Their heart beats on the rock spire by the stair's foot: climb its vines and tear it out.",
      "The thorns have withered. Clear the Warden's garrison, and face the Thorn Warden among the roots of the Great Tree.",
      'The Old Wood is free, and dawn has come.',
    ],
    short: ['Find Hollowbough', 'Talk to Alder the Reeve', 'Cross the Rookfall bridge', 'Through the Thorn Ravine', 'Tear out the Thorn Heart', 'Defeat the Thorn Warden', 'The wood is free'],
  },
  {
    id: 'sister',
    title: 'A Sister Past the River',
    steps: ["Ash's sister Wren went gathering past the Whisper, by the black water, and never came back. Find her.", 'Wren is free and running home. Tell Ash.', 'Wren is home with her brother.'],
  },
  {
    id: 'oaks',
    title: 'The Ring of Oaks',
    steps: ['A ring of old oaks stands west of Hollowbough. Stand at its altar and face the trial.', 'The Heartwood Seed is yours: one more heart.'],
  },
  {
    id: 'shards',
    title: 'Moon Shards',
    steps: ["Three more shards of the moon are hidden in the Old Wood: among the fen's pools, up where the vines climb, at the top of the canopy.", 'All three found. Your heart is stronger.'],
  },
  {
    id: 'stag',
    title: 'The Bound Stag',
    steps: [
      "A great stag is held in the Warden's thorns west of the Ring of Oaks. Cut it free.",
      'The Thornstag is free and will carry you: it leaps twice, gores with its antlers, and fights with thorns.',
    ],
  },
];

export const QUESTS: Record<RealmId, QuestDef[]> = { castle: CASTLE, forest: FOREST };

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
