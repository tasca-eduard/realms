// Quests: what the knight is here to do, and what's worth finding off the road.
// Progress lives in save.data.quests as a step index (absent = not started).

export interface QuestDef {
  id: string;
  title: string;
  main?: boolean;
  /** One line per step; the last step is the finished state. */
  steps: string[];
  /** Short line for the on-screen objective. */
  short?: string[];
}

export const QUESTS: QuestDef[] = [
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
    steps: ['A stone circle stands east of the King\'s Road. Strike its altar and face the trial.', 'The Knight\'s Crest is yours: blocking costs less stamina.'],
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
];

export const questDef = (id: string) => QUESTS.find((q) => q.id === id)!;
export const questDone = (id: string, step: number | undefined) => step !== undefined && step >= questDef(id).steps.length - 1;
