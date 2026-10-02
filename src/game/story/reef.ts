import type { RegionDef } from '../../world/realm';
import { KIP_SWIM, SHRINE } from '../../world/reef';
import type { Game } from '../game';
import type { Interactable, Npc } from '../objects';

/** The shrine's rose sparks (the prototype's colour). */
const ROSE = { color: [2.6, 0.8, 1.4] as [number, number, number], color2: [1, 0.3, 0.6] as [number, number, number], size: 1, life: 1.4, gravity: -1.2, wobble: 0.3 };

/**
 * The coral shrine on the village green (the prototype's): touched, it mends whatever carries the knight,
 * wherever it waits.
 */
class CoralShrine implements Interactable {
  x = SHRINE.x;
  z = SHRINE.z;
  y: number;
  radius = 1.9;
  constructor(g: Game) {
    this.y = g.grid.groundAt(this.x, this.z);
  }
  prompt() {
    return 'Touch the coral shrine';
  }
  interact(g: Game) {
    const hurt = g.mounts.filter((m) => m.hp < m.maxHp);
    for (const m of g.mounts) m.hp = m.maxHp;
    g.audio.sfx('moonfire', this.x, this.z);
    g.fx.burst(ROSE, this.x, this.y + 1, this.z, 34, 2, 2.5);
    g.pipe.flash = 0.15;
    g.pipe.flashColor.setRGB(1, 0.5, 0.7);
    if (!g.mounts.length) g.ui.toast('The coral shrine', 'It mends whatever carries you. Nothing does, yet.');
    else if (hurt.length) g.ui.toast('The coral shrine', `Your ${hurt[0].called} is whole again`);
    else g.ui.toast('The coral shrine', 'Whatever carries you is whole already');
  }
}

/**
 * The Sunken Reef's people (group 34): the coral village going about its day, the coral shrine, the
 * tide-reader's hints, Kip the pearl-diver's son caged by the crew on Gull Rock (freed, he swims home and his
 * mother pays her best pearl), the Whalebone Isle's trial. Its places and people are in src/world/reef.ts;
 * the realm's story (aqua.ts) hands its moments here.
 */
export class ReefFolk {
  private shrine: CoralShrine | null = null;
  private hint = 0;

  apply(g: Game) {
    if (!this.shrine) {
      this.shrine = new CoralShrine(g);
      g.interactables.push(this.shrine);
    }
    if (g.save.data.flags.rescued) {
      g.cage?.breakOpen(g, true);
      g.npc('kip')!.visible = false;
      g.npc('kiphome')!.visible = true;
    }
  }
  onRegion(g: Game, r: RegionDef) {
    if (r.name === 'Gull Rock' && !g.save.data.flags.rescued) g.quest('kip', 0);
    if (r.name === 'The Whalebone Isle') g.quest('pearl', 0);
  }
  /** Kip's cage broke open: his thanks and his pearls, then he swims for home. */
  onCageOpen(g: Game) {
    const kip = g.npc('kip')!;
    g.after(0.6, () => {
      g.talking = kip;
      g.ui.say(kip.name, kip.def.lines, () => {
        g.talking = null;
        g.player.coins += 40;
        g.audio.sfx('coin');
        g.ui.toast('40 coins', 'the pearls Kip hid from the crew');
        g.save.data.flags.rescued = true;
        g.quest('kip', 1);
        g.writeSave();
        // Off the rock and down into the water, swimming for the village.
        kip.walkTo = { x: KIP_SWIM[0][0], z: KIP_SWIM[0][1] };
        kip.route = KIP_SWIM.slice(1).map(([x, z]) => ({ x, z }));
        g.after(4.5, () => {
          kip.visible = false;
          g.npc('kiphome')!.visible = true;
        });
      });
    });
  }
  /** Someone of the reef is spoken to: the lines to say, 'handled', or null (not one of the reef's). */
  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled' | null {
    const id = n.def.id, f = g.save.data.flags;
    // The tide-reader gives one hint a talk, in turn.
    if (id === 'tally') return [lines[this.hint++ % lines.length]];
    // The harbourmaster, once the knight has the salvager's suit.
    if (id === 'gannet' && f.costume) return [lines[0], lines[1], 'You have the salvager\'s suit, I see. Then go down where he went: past the drowned kingdom, toward the trench. Mind the crew.'];
    if (id === 'maren' && !f.rescued) g.quest('kip', 0);
    if (id === 'maren' && f.rescued && (g.save.data.quests.kip ?? 0) < 2) {
      g.ui.say(n.name, [...lines, 'Take this. The best pearl I ever brought up. I was keeping it for his wedding, but he is ten.'], () => {
        g.talking = null;
        g.player.coins += 30;
        g.audio.sfx('coin');
        g.ui.toast('30 coins', "Maren's best pearl");
        g.quest('kip', 2);
      });
      return 'handled';
    }
    return null;
  }
  /** What the reef's people say once the sea is free (undefined: not one of the reef's). */
  victoryLine(id: string): string | undefined {
    const L: Record<string, string> = {
      gannet: 'Daylight on the sea floor. We could build a harbour again. We could, I said.',
      dulse: 'Drinks on the inn tonight. Dry ones, for once.',
      shale: 'Bring that edge back when it dulls. It will not, but bring it.',
      maren: 'Kip wants to dive the drowned kingdom now. I said yes. I must be mad.',
      kiphome: 'The glowing thing in the trench went out. I checked.',
      tally: 'The tide says: go home, knight. It is going home too.',
      shrimp: 'I held my breath the whole fight! Nearly.',
      ling: 'Nets to mend, kelp to dry. Some things do not change, and good.',
      hake: 'Forty years, and I never saw the floor in daylight. Look at it.',
      flotsam: 'Now the sea will give back the good things. You will see.',
    };
    return L[id];
  }
}
