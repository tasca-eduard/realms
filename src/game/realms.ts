import type { Rng } from '../engine/util';
import type { Builder } from '../world/builder';
import type { Grid } from '../world/grid';
import type { RealmData, RealmId } from '../world/realm';
import { buildRealm1 } from '../world/realm1';
import { buildRealm2, decorateForestOutskirts, paintForestOutskirts } from '../world/realm2';
import { decorateOutskirts, paintOutskirts } from '../world/outskirts';
import { QUESTS, type QuestDef } from './quests';
import { CastleStory } from './story/castle';
import { ForestStory } from './story/forest';
import type { RealmStory } from './story/story';

type RGB = [number, number, number];

/** A realm's light: its night, and its dawn once the tyrant has fallen. */
export interface Light {
  moon: RGB;
  moonI: number;
  hemi: RGB;
  ground: RGB;
  hemiI: number;
  fog: RGB;
  fogTop: RGB;
  mist: RGB;
  lift: RGB;
  warmth: number;
  exposure: number;
  mistAmount: number;
  cloud: number;
}

export interface RealmDef {
  id: RealmId;
  name: string;
  /** Size of the playable map in cells. */
  w: number;
  d: number;
  /** The map, its people, foes and objects. */
  build(b: Builder): RealmData;
  /** The land beyond the map edge, painted then dressed. */
  paintOutskirts(grid: Grid, W: number, D: number): void;
  decorateOutskirts(b: Builder, grid: Grid, W: number, D: number, r: Rng): void;
  story(): RealmStory;
  quests: QuestDef[];
  night: Light;
  dawn: Light;
}

/** The Moonlit Keep's moonlight, and its sunrise. */
const CASTLE_NIGHT: Light = {
  moon: [0.56, 0.65, 1.0], moonI: 2.0, hemi: [0.235, 0.3, 0.5], ground: [0.1, 0.08, 0.13], hemiI: 1.0,
  fog: [0.012, 0.014, 0.035], fogTop: [0.006, 0.006, 0.02], mist: [0.07, 0.085, 0.14], lift: [0.012, 0.014, 0.04],
  warmth: 0, exposure: 1.45, mistAmount: 0.8, cloud: 0.28,
};
const CASTLE_DAWN: Light = {
  moon: [1.0, 0.78, 0.6], moonI: 3.0, hemi: [0.55, 0.52, 0.62], ground: [0.35, 0.26, 0.22], hemiI: 1.6,
  fog: [0.35, 0.22, 0.22], fogTop: [0.2, 0.15, 0.25], mist: [0.5, 0.38, 0.34], lift: [0.02, 0.012, 0.01],
  warmth: 0.5, exposure: 1.25, mistAmount: 0.45, cloud: 0.15,
};

/** Whisperwood: a green-teal night under a smaller, greener moon; its dawn comes gold-green. */
const FOREST_NIGHT: Light = {
  moon: [0.6, 0.78, 0.66], moonI: 1.8, hemi: [0.18, 0.32, 0.3], ground: [0.07, 0.1, 0.07], hemiI: 1.05,
  fog: [0.01, 0.03, 0.028], fogTop: [0.004, 0.012, 0.012], mist: [0.06, 0.12, 0.1], lift: [0.01, 0.028, 0.022],
  warmth: 0, exposure: 1.5, mistAmount: 0.9, cloud: 0.3,
};
const FOREST_DAWN: Light = {
  moon: [0.95, 0.85, 0.55], moonI: 2.8, hemi: [0.45, 0.56, 0.42], ground: [0.26, 0.28, 0.16], hemiI: 1.55,
  fog: [0.25, 0.3, 0.18], fogTop: [0.15, 0.2, 0.16], mist: [0.42, 0.46, 0.3], lift: [0.02, 0.02, 0.01],
  warmth: 0.4, exposure: 1.25, mistAmount: 0.5, cloud: 0.15,
};

export const REALMS: Record<RealmId, RealmDef> = {
  castle: {
    id: 'castle',
    name: 'The Moonlit Keep',
    w: 120,
    d: 120,
    build: buildRealm1,
    paintOutskirts,
    decorateOutskirts,
    story: () => new CastleStory(),
    quests: QUESTS.castle,
    night: CASTLE_NIGHT,
    dawn: CASTLE_DAWN,
  },
  forest: {
    id: 'forest',
    name: 'Whisperwood',
    w: 120,
    d: 120,
    build: buildRealm2,
    paintOutskirts: paintForestOutskirts,
    decorateOutskirts: decorateForestOutskirts,
    story: () => new ForestStory(),
    quests: QUESTS.forest,
    night: FOREST_NIGHT,
    dawn: FOREST_DAWN,
  },
};

export const isRealm = (id: string | null): id is RealmId => !!id && id in REALMS;
