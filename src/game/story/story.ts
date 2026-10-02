import type { EnemySpawn, EnemyType, RegionDef } from '../../world/realm';
import type { Enemy } from '../enemies';
import type { Game } from '../game';
import type { Npc } from '../objects';

/** The realm's tyrant: names, what it says, whom it calls in. */
export interface BossInfo {
  /** Over the health bar. */
  name: string;
  /** The intro card: name and title. */
  intro: [string, string];
  lines: { wake: string; enrage: string; summon: string; summonEnraged: string; death: string };
  /** Guards it calls in, calm and enraged (one per summon point). */
  summons: { calm: EnemyType[]; enraged: EnemyType[] };
}

/**
 * The moments that belong to one realm's story. The game runs the generic flow
 * (moonfires, chests, fights, saving) and asks the realm's story what happens
 * when a lever is pulled, a cage breaks, a group falls, someone is spoken to...
 * Story state lives in save.data.flags.
 */
export interface RealmStory {
  /** Under the logo on the title screen. */
  title: string;
  /** Told before a new journey starts. */
  intro?: string[];
  /** The victory screen's heading and text. */
  victoryTitle: string;
  victoryText: string;
  boss?: BossInfo;
  /** What a caged captive calls out, and what it says when a blow doesn't break the lock. */
  cagedPlea: string;
  cageHolds: string;

  /** The realm's objects exist: restore story state from the save. */
  apply(g: Game): void;
  /** Should this placed foe appear? */
  spawns(g: Game, s: EnemySpawn): boolean;
  /** A foe fell (groups cleared, beasts slain...). */
  onKill(g: Game, e: Enemy): void;
  /** The knight walked into a region. */
  onRegion(g: Game, r: RegionDef): void;
  /** Subtitle under an area's name. */
  areaSub(g: Game, r: RegionDef): string;
  /** Someone is spoken to. Return the lines to say, or 'handled' if the story ran the talk itself. */
  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled';
  /** What people say once the realm is free. */
  victoryLine(id: string): string;
  onLever(g: Game): void;
  /** A wall or hedge was broken (its id is kept with the broken walls). */
  onBreak?(g: Game, id: string): void;
  /** A blow lands: anything of the story's it reaches? (`hit` says whether the blow reaches a point, once a blow.) */
  struck?(g: Game, hit: (it: object, x: number, y: number, z: number, r: number) => boolean): void;
  /** The captive's cage broke open. */
  onCageOpen(g: Game): void;
  /** The tyrant fell (flags and quests; the game runs the victory screen). */
  onBossDeath(g: Game, e: Enemy): void;
  /** Should the arena door stand open when a lost boss fight resets? */
  arenaOpen(g: Game): boolean;
  /** Every frame while playing (tips, ambient beats). */
  tick(g: Game, dt: number): void;
}
