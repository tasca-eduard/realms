import type { EnemySpawn, RegionDef } from '../../world/realm';
import type { Game } from '../game';
import type { Npc } from '../objects';
import type { Enemy } from '../enemies';
import type { BossInfo, RealmStory } from './story';

/**
 * Realm 2, Whisperwood: the folk of Hollowbough, the sister caged past the river, the
 * Thornstag bound in the Deep Wood, the Ring of Oaks, the Thorn Heart that feeds the thorns
 * barring the Warden's hold, the garrison in the Withered Wood, and the Thorn Warden.
 */
export class ForestStory implements RealmStory {
  title = 'II &middot; WHISPERWOOD';
  victoryTitle = 'The Old Wood Wakes';
  victoryText = 'The Thorn Warden is soil again, and the first light in years comes down through the leaves.<br>The second of eight realms is free.';
  cagedPlea = 'Please, get me out!';
  cageHolds = 'Goblin knots and a rusty lock. Again!';
  boss: BossInfo = {
    name: 'Thorn Warden',
    intro: ['The Thorn Warden', 'TYRANT OF THE OLD WOOD'],
    lines: { wake: 'The wood is mine to keep. Leave, or feed it.', enrage: 'Roots! Rise and hold him!', summon: 'To me, my thorns!', summonEnraged: 'Tear him down!', death: 'I kept... the wood...' },
    summons: { calm: ['goblin', 'goblin'], enraged: ['shield', 'goblin'] },
  };
  private garrisonCleared = false;
  private owlHint = 0;

  apply(g: Game) {
    const f = g.save.data.flags;
    if (f.rescued) {
      g.cage?.breakOpen(g, true);
      g.npc('wren')!.visible = false;
      g.npc('wrenhome')!.visible = true;
    }
    // (Saves from before the heart had its own flag called it 'bridge'.)
    if (f.heart || f.bridge) {
      g.lever?.setPulled();
      g.thornWall?.setOpen(true, g, true);
    }
    if (f.garrison) g.hallDoor?.setOpen(true, g, true);
    if (f.boss) g.setDawn(1);
  }
  spawns(g: Game, s: EnemySpawn) {
    const f = g.save.data.flags;
    if (s.group === 'garrison' && f.garrison) return false;
    if (s.group === 'boss' && f.boss) return false;
    return true;
  }
  onKill(g: Game, e: Enemy) {
    if (e.group !== 'garrison' || this.garrisonCleared || g.enemies.some((o) => o.alive && o.group === 'garrison')) return;
    this.garrisonCleared = true;
    g.save.data.flags.garrison = true;
    g.writeSave();
    g.after(1.2, () => {
      const d = g.hallDoor;
      g.hallDoor?.setOpen(true, g);
      if (d) g.focus(d.x + 1, d.y + 1.5, d.z, 3.2);
      g.ui.toast('The thorns at the roots draw back', 'The Thorn Warden waits among the roots of the Great Tree');
    });
  }
  onRegion(g: Game, r: RegionDef) {
    if (r.name === "The Stag's Thicket") g.quest('stag', 0);
    if (r.name === 'Hollowbough') g.quest('main', 1);
    if (r.name === 'The Thorn Ravine') g.quest('main', 3);
    if (r.name === 'The Overhang' || r.name === "The Warden's Hold") g.quest('main', 4);
    if (r.name === 'The Ring of Oaks') g.quest('oaks', 0);
    if (r.name === "The Gatherers' Clearing" && !g.save.data.flags.rescued) g.quest('sister', 0);
  }

  onCageOpen(g: Game) {
    const wren = g.npc('wren')!;
    g.after(0.6, () => {
      g.talking = wren;
      g.ui.say(wren.name, wren.def.lines, () => {
        g.talking = null;
        g.player.coins += 40;
        g.audio.sfx('coin');
        g.ui.toast('40 coins', "the goblins' hidden takings");
        g.save.data.flags.rescued = true;
        g.quest('sister', 1);
        g.writeSave();
        // Down to the lane along the black water, then out of sight toward home.
        wren.walkTo = { x: 47.5, z: 44.2 };
        wren.route = [{ x: 56, z: 45.2 }, { x: 64, z: 45.3 }];
        g.after(5, () => {
          wren.visible = false;
          g.npc('wrenhome')!.visible = true;
        });
      });
    });
  }
  onBreak(g: Game, id: string) {
    if (id === 'stag') g.quest('stag', 1);
  }
  areaSub(g: Game, r: RegionDef) {
    if (r.name === 'The Sea Stair') return 'The old way down to the drowned coast';
    return r.name === "The Warden's Hold" && !g.victory ? 'Where the thorns grow from' : '';
  }
  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled' {
    const id = n.def.id, f = g.save.data.flags;
    if (id === 'reeve') g.after(0.1, () => g.quest('main', 2));
    // The owl gives one hint a talk, in turn.
    if (id === 'owl') return [lines[this.owlHint++ % lines.length]];
    if (id === 'ash' && !f.rescued) g.quest('sister', 0);
    if (id === 'ash' && f.rescued && (g.save.data.quests.sister ?? 0) < 2) {
      g.ui.say(n.name, [...lines, 'Here. My savings. For the knight who brought her home.'], () => {
        g.talking = null;
        g.player.coins += 30;
        g.audio.sfx('coin');
        g.ui.toast('30 coins', "Ash's savings");
        g.quest('sister', 2);
      });
      return 'handled';
    }
    return lines;
  }
  victoryLine(id: string) {
    const L: Record<string, string> = {
      reeve: 'The thorns are drying up already. We will come down from the trees.',
      keeper2: 'The good elderflower jug, for you. I was saving it for the end of the world.',
      thornsmith: 'Bring that blade back any time. It has heartwood in it now.',
      ash: 'You did it! Wren says she helped.',
      wrenhome: 'Morning in the Old Wood. I had forgotten the colour of it.',
      herbwife: 'The stag knew. It always knows.',
      owl: 'Hoo. Hoo! Go to bed, knight.',
    };
    return L[id] ?? 'The wood breathes again.';
  }
  onLever(g: Game) {
    g.save.data.flags.heart = true;
    g.quest('main', 5);
    g.writeSave();
    const w = g.thornWall;
    g.after(0.5, () => {
      if (w) g.focus(w.x, w.y + 1.5, w.z, 3.6, () => g.ui.toast('The thorns wither', "Nothing bars the stair to the Warden's hold now"));
      g.after(0.8, () => g.thornWall?.setOpen(true, g));
    });
  }
  onBossDeath(g: Game) {
    g.save.data.flags.boss = true;
    g.quest('main', 6);
  }
  arenaOpen(g: Game) {
    return !!g.save.data.flags.garrison;
  }
  tick() {}
}
