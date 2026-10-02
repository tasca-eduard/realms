import type { EnemySpawn, RegionDef } from '../../world/realm';
import type { Enemy } from '../enemies';
import type { Game } from '../game';
import { DiveSuit, type Npc } from '../objects';
import { SeaLife } from '../sealife';
import { SerpentPen } from '../serpent';
import { ReefErrands } from './errands';
import { ShoreLife } from '../shorelife';
import { DarkLamp } from './lighthouse';
import { ReefFolk } from './reef';
import { ReefLife } from './reeflife';
import { SeaCaves } from './seacaves';
import { InkGrotto } from './grotto';
import type { BossInfo, RealmStory } from './story';
import { BELL, FLOODGATE, HALL } from '../../world/realm3';
import { DawnShafts, Floodgate, SunkenBell } from '../palace';
import { tideHallTick } from '../tidelord';

/** The salvager's name over his health bar. */
const SALVAGER = 'Brassbelly the Salvager';

/**
 * Realm 3, the Sunken Reef: the sea swallowed a kingdom, and its lord still waits below. A drowned coast:
 * in armour the knight would sink like a stone, so the way down is the diving suit of Brassbelly, the
 * goblins' salvager on the lighthouse isle (out along the sandbar); felled, he drops it, and in it the
 * knight walks into deep water, his air running down below the surface. The crew have netted the Tide Serpent
 * in a pool off the sandbar: cut free, it carries him across the sea, and in the suit down through it
 * (src/game/serpent.ts). Across the trench from the drowned kingdom, the Tidelord's palace: the kingdom's great
 * bell, rung, opens its floodgate once his crew before it, who hold its winch, are beaten; he waits on his throne within (src/game/palace.ts,
 * tidelord.ts). The reef's people, the pearl-diver's son and the coral shrine (story/reef.ts), the village's night
 * (story/reeflife.ts), its errands (story/errands.ts).
 */
/** Where the way to the palace goes: the drowned kingdom (and its places with names of their own), the trench, the
 *  palace's floor. Down there without having rung the bell, the quest says to ring it. */
const KINGDOM_WAY = ['The Drowned Kingdom', 'The Drowned Plaza', 'The Trench', 'The Drowned Palace', 'The Sunken Temple', 'The Royal Treasury', 'The Royal Library', "The Kings' Way", 'The Market Square', "The Queen's Gardens", 'The Old Harbour'];

export class AquaStory implements RealmStory {
  title = 'III &middot; THE SUNKEN REEF';
  victoryTitle = 'The Tide Turns';
  victoryText = 'The Tidelord sinks into his own deep, and daylight finds the sea floor again.<br>The third of eight realms is free.';
  cagedPlea = 'Help! Before the tide comes back for me!';
  cageHolds = 'Coral has grown over the lock. Harder!';
  boss: BossInfo = {
    name: 'Tidelord',
    intro: ['The Tidelord', 'LORD OF THE DEEP'],
    lines: { wake: 'You will drown before you see the light.', enrage: 'The tide turns!', summon: 'Crew! To me!', summonEnraged: 'Drag him under!', death: 'The deep... claims me...' },
    summons: { calm: ['goblin', 'goblin'], enraged: ['shield', 'goblin'] },
  };
  /** The salvager's suit, lying where he fell until it's taken. */
  private suit: DiveSuit | null = null;
  /** His health bar is up (he's fighting, near the knight). */
  private bar = false;
  private shouted = false;
  /** The Tide Serpent: in the crew's nets, then the knight's. */
  private serpent: SerpentPen | null = null;
  /** The reef's people, the pearl-diver's son, the coral shrine (group 34: src/game/story/reef.ts). */
  private reef = new ReefFolk();
  /** The coral village's night: floats and bites, the children's games, the crab, the news (src/game/story/reeflife.ts). */
  private life = new ReefLife();
  /** The reef's errands: the bottle's map, the current race, glowing bait, the lost diver, the night raid (src/game/story/errands.ts). */
  private errands = new ReefErrands();
  /** The Tidelord's palace: the bell that opens its floodgate, the dawn come down into his hall. */
  private bell: SunkenBell | null = null;
  private dawn: DawnShafts | null = null;
  private garrisonCleared = false;
  private airTold = false;
  /** The sea cave's castaway, the blowhole (group 36: src/game/story/seacaves.ts). */
  private caves = new SeaCaves();
  /** Life on the shore and the surface: gulls, seals, crabs, surf, boats, fish (src/game/shorelife.ts). */
  private shore = new ShoreLife();
  /** The sea's harmless life: fish, rays, turtles, jellies, octopuses, crabs, plankton (src/game/sealife.ts). */
  private sealife: SeaLife | null = null;
  /** The lighthouse's keeper and his dark lamp (src/game/story/lighthouse.ts). */
  private lamp = new DarkLamp();
  /** Old Inkarm's grotto: its health bar, its chest, the old diver's warning (src/game/story/grotto.ts). */
  private grotto = new InkGrotto();

  apply(g: Game) {
    const f = g.save.data.flags;
    g.player.dives = !!f.costume;
    // Felled before the suit was taken (a fall, a journey): it lies where he stood.
    const i = g.realm.enemies.findIndex((s) => s.type === 'salvager');
    if (!f.costume && i >= 0 && g.save.data.killed.includes(i)) this.dropSuit(g, g.realm.enemies[i].x, g.realm.enemies[i].z);
    this.serpent = SerpentPen.make(g);
    if (f.boss) g.setDawn(1);
    this.reef.apply(g);
    this.life.apply(g);
    this.errands.apply(g);
    this.palace(g);
    this.shore.apply(g);
    this.sealife = new SeaLife(g);
    this.lamp.apply(g);
    this.grotto.apply(g);
  }
  spawns(g: Game, s: EnemySpawn) {
    const f = g.save.data.flags;
    return !(s.group === 'boss' && f.boss) && !(s.group === 'garrison' && f.garrison);
  }
  onKill(g: Game, e: Enemy) {
    if (e.group === 'garrison') this.garrisonFalls(g);
    this.grotto.onKill(g, e);
    if (e.type !== 'salvager') return;
    this.bar = false;
    g.ui.bossHide();
    g.fightMusic = Math.min(g.fightMusic, 1.5);
    g.bubbleAt(e, 'My... suit...');
    if (!g.save.data.flags.costume) this.dropSuit(g, e.x, e.z);
  }
  private dropSuit(g: Game, x: number, z: number) {
    this.suit = new DiveSuit(x, z, g, () => this.takeSuit(g));
  }
  /** The knight takes the suit: from now on he walks into deep water. */
  private takeSuit(g: Game) {
    this.suit = null;
    g.save.data.flags.costume = true;
    g.player.dives = true;
    g.audio.sfx('power', g.player.x, g.player.z);
    g.audio.sfx('clang', g.player.x, g.player.z);
    g.ui.toast('The diving suit', 'Patched and leaky, but yours: walk into deep water. Its air lasts a minute and a half under the surface; come up, or stand in a stream of bubbles.', 6);
    g.quest('main', step(g, 'Go down into the deep'));
    g.writeSave();
  }
  onRegion(g: Game, r: RegionDef) {
    // The village first (as in the realms before): its harbourmaster sends the knight on to the salvager.
    if (r.name === 'The Coral Village') g.quest('main', step(g, 'Talk to Gannet the Harbourmaster'));
    this.reef.onRegion(g, r);
    this.errands.onRegion(g, r);
    // Down in the drowned kingdom, or over the trench: the palace and its bell. (In the suit: swum over on the
    // serpent's back before it, the quest mustn't skip "Go down into the deep".)
    if (g.save.data.flags.costume && !g.save.data.flags.bell && KINGDOM_WAY.includes(r.name)) g.quest('main', step(g, 'Ring the sunken bell'));
  }
  areaSub(g: Game, r: RegionDef) {
    // The way on to realm 4: only the serpent swims it, and not yet.
    if (r.name === 'The Dune Strait') return 'East across the open sea to the Scorched Dunes: shut, for now';
    return r.name === 'The Throne Hall' && !g.victory ? 'Where the Lord of the Deep waits' : '';
  }
  struck(g: Game, hit: (it: object, x: number, y: number, z: number, r: number) => boolean) {
    this.serpent?.struck(g, hit);
    this.errands.struck(g, hit);
  }
  talk(g: Game, n: Npc, lines: string[]) {
    if (n.def.id === 'gannet') g.after(0.1, () => g.quest('main', step(g, "Take the salvager's suit")));
    lines = this.grotto.talk(g, n, lines);
    // Each in turn adds its say to what the last left (or runs the talk itself): none swallows another's lines.
    for (const part of [this.caves, this.errands, this.reef, this.life, this.lamp]) {
      const said = part.talk(g, n, lines);
      if (said === 'handled') return said;
      if (said) lines = said;
    }
    return lines;
  }
  victoryLine(id: string) {
    return this.reef.victoryLine(id) ?? this.life.victoryLine(id) ?? this.errands.victoryLine(id) ?? this.caves.victoryLine(id) ?? this.lamp.victoryLine(id) ?? 'The sea is quiet again.';
  }
  onLever() {}
  onCageOpen(g: Game) {
    this.reef.onCageOpen(g);
  }
  onBossDeath(g: Game) {
    g.save.data.flags.boss = true;
    g.quest('main', step(g, 'The sea is free'));
    // (The game runs the victory; the morning comes down through the water into his hall with it.)
    g.after(2.5, () => (this.dawn ??= new DawnShafts(HALL.x0, HALL.z0, HALL.x1, HALL.z1, HALL.y, g.realm.sea?.surface ?? 0, g)));
  }
  /** A lost fight: the floodgate lifts again (the bell has been rung, the crew on the landing beaten). */
  arenaOpen(g: Game) {
    return !!(g.save.data.flags.bell && g.save.data.flags.garrison);
  }
  tick(g: Game, dt: number) {
    this.suit?.update(dt, g);
    this.serpent?.update(dt, g);
    this.life.tick(g, dt);
    this.errands.tick(g, dt);
    this.bell?.update(dt, g);
    this.dawn?.update(dt, g);
    tideHallTick(g, dt);
    // The first fight in his hall: where the air is.
    if (g.bossActive && !this.airTold && g.player.dives) {
      this.airTold = true;
      g.after(3.4, () => g.ui.hint("Vents in the hall's corners breathe air: stand in one to fill yours.", 6));
    }
    this.caves.tick(g, dt);
    this.shore.update(dt, g);
    this.sealife?.update(g, dt);
    this.lamp.tick(g, dt);
    this.grotto.tick(g, dt);
    // The salvager's health bar while he fights the knight (none while the realm's tyrant is up).
    const s = g.enemies.find((e) => e.type === 'salvager');
    const p = g.player;
    const on = !!s && s.alive && s.state !== 'idle' && s.state !== 'return' && Math.hypot(p.x - s.x, p.z - s.z) < 18 && !g.bossActive;
    if (on && !this.shouted) {
      this.shouted = true;
      g.bubbleAt(s!, 'Oi! Everything under this sea is MINE!');
    }
    if (on !== this.bar) {
      this.bar = on;
      if (on) g.ui.bossShow(SALVAGER);
      else g.ui.bossHide();
    }
    if (on) g.ui.bossHp(s!.hp / s!.maxHp);
    // (His fight has its own music while the bar is up.)
    if (on) g.fightMusic = 4;
  }

  // ---------- the Tidelord's palace ----------

  /** The kingdom's bell in the drowned plaza, and the palace's floodgate (the hall's door: shut until the bell is
   *  rung; it drops shut behind the knight when the Tidelord wakes). */
  private palace(g: Game) {
    if (this.bell) return;
    const f = g.save.data.flags;
    const gate = new Floodgate(FLOODGATE.x, FLOODGATE.z, FLOODGATE.w, FLOODGATE.h, g);
    g.hallDoor = gate;
    g.interactables.push(gate);
    this.bell = new SunkenBell(BELL.x, BELL.z, BELL.top, g, () => this.rang(g));
    g.interactables.push(this.bell);
    if (f.bell) this.bell.setRung();
    if (f.bell && f.garrison) gate.setOpen(true, g, true);
    if (f.boss) this.dawn = new DawnShafts(HALL.x0, HALL.z0, HALL.x1, HALL.z1, HALL.y, g.realm.sea?.surface ?? 0, g, true);
  }
  /** The bell tolls: across the trench the floodgate grinds up, or, while his crew on the landing still hold its
   *  winch, strains in its towers and holds. */
  private rang(g: Game) {
    const f = g.save.data.flags;
    if (f.bell) return;
    f.bell = true;
    g.quest('main', step(g, f.garrison ? 'Face the Tidelord' : 'Clear the palace landing'));
    g.writeSave();
    const gate = g.hallDoor;
    g.after(0.9, () => {
      if (!f.garrison) {
        if (gate) g.focus(gate.x - 1, gate.y + 2.5, gate.z, 3.6, () => g.ui.toast('The floodgate strains', "Across the trench it shudders in its towers, but the Tidelord's crew on the landing hold its winch. Ride the current over and beat them."));
        g.after(0.8, () => gate instanceof Floodgate && gate.strain(g));
        return;
      }
      if (gate) g.focus(gate.x - 1, gate.y + 2.5, gate.z, 3.6, () => g.ui.toast('The floodgate rises', "Across the trench the Tidelord's palace stands open. Ride the current over."));
      g.after(0.8, () => gate?.setOpen(true, g));
    });
  }
  /** His crew before the palace, all down (saved: they stay down). They held the floodgate's winch: with the
   *  bell rung, it rises now. */
  private garrisonFalls(g: Game) {
    if (this.garrisonCleared || g.enemies.some((o) => o.alive && o.group === 'garrison')) return;
    this.garrisonCleared = true;
    const f = g.save.data.flags;
    f.garrison = true;
    g.writeSave();
    if (!f.bell) return g.after(1, () => g.ui.toast("The Tidelord's crew are beaten", "The floodgate is still shut fast: they say the kingdom's great bell opens it"));
    g.quest('main', step(g, 'Face the Tidelord'));
    const gate = g.hallDoor;
    g.after(1, () => {
      if (gate) g.focus(gate.x - 1, gate.y + 2.5, gate.z, 3.2, () => g.ui.toast("The Tidelord's crew are beaten", 'Their winch runs free, and the floodgate rises'));
      g.after(0.6, () => gate?.setOpen(true, g));
    });
  }
}

/** A step of the main quest by its short name (the people's steps come before the palace's). */
function step(g: Game, short: string) {
  return Math.max(0, (g.quests.def('main').short ?? []).indexOf(short));
}
