import type { EnemySpawn, RegionDef } from '../../world/realm';
import { KeepLife } from '../castlelife';
import type { Enemy } from '../enemies';
import type { Game } from '../game';
import type { Npc } from '../objects';
import { KeepsfootLife } from './keepsfoot';
import type { BossInfo, RealmStory } from './story';

/**
 * Realm 1, the Moonlit Keep: the captive in Gnasher's Camp, the winch and the
 * drawbridge, the courtyard garrison that bars the hall, the Old Warden's jobs,
 * and the Goblin King.
 */
export class CastleStory implements RealmStory {
  title = 'I &middot; THE MOONLIT KEEP';
  intro = [
    'The eight realms lived in peace beneath the moon.',
    'Then the shadow came, and one by one the realms fell, each to its own tyrant.',
    'In the Moonlit Keep, a goblin sits on a stolen throne, and the village below keeps its doors barred at night.',
    'One knight still stands.',
  ];
  victoryTitle = 'The Keep Is Free';
  victoryText = 'The Goblin King has fallen, and dawn breaks over Keepsfoot.<br>The first of eight realms is free.';
  boss: BossInfo = {
    name: 'Goblin King',
    intro: ['The Goblin King', 'TYRANT OF THE MOONLIT KEEP'],
    lines: { wake: 'Another tin can for my collection!', enrage: "ENOUGH! Feel the King's wrath!", summon: 'GUARDS!', summonEnraged: 'BRING ME GROGG!', death: 'My... crown...' },
    summons: { calm: ['goblin', 'goblin'], enraged: ['brute', 'goblin'] },
  };
  cagedPlea = 'Get me out of here! Break the lock!';
  cageHolds = 'Harder! The lock is rusted through!';
  private campCleared = false;
  /** The realm's harmless life: crows, bats, swans, ducks, the heron, sheep, cows, geese, frogs, fish, moths (src/game/castlelife.ts). */
  wildlife = new KeepLife();
  /** Keepsfoot's night, the feast, the lanterns, the dawn; Gnasher's camp at its business (story/keepsfoot.ts). */
  private folk = new KeepsfootLife();

  apply(g: Game) {
    const f = g.save.data.flags;
    if (f.bridge) {
      g.lever?.setPulled();
      g.bridge?.lower(g, true);
    }
    if (f.rescued) {
      g.cage?.breakOpen(g, true);
      g.npc('brother')!.visible = false;
      g.npc('tamhome')!.visible = true;
    }
    if (f.courtyard) g.hallDoor?.setOpen(true, g, true);
    if (f.boss) g.setDawn(1);
    this.wildlife.apply(g);
    this.folk.apply(g);
  }

  spawns(g: Game, s: EnemySpawn) {
    const f = g.save.data.flags;
    if (s.group === 'courtyard' && f.courtyard) return false;
    if (s.group === 'boss' && f.boss) return false;
    if (!this.folk.spawns(g, s)) return false;
    return true;
  }

  onKill(g: Game, e: Enemy) {
    const alive = (group: string) => g.enemies.some((o) => o.alive && o.group === group);
    if (e.group === 'courtyard' && !alive('courtyard')) {
      g.save.data.flags.courtyard = true;
      g.quest('main', 4);
      g.writeSave();
      g.after(1.2, () => {
        g.hallDoor?.setOpen(true, g);
        g.focus(34.5, 5, 18.5, 3.2);
        g.ui.toast('The hall doors groan open', 'The Goblin King waits within');
      });
    }
    if (e.group === 'lodge' && e.elite) g.quest('lodge', 1);
    if (e.group === 'farm' && !alive('farm')) {
      g.ui.toast('The raiders are gone', 'The Old Warden will want to hear');
      g.quest('farm', 1);
    }
    if (e.group === 'camp' && !this.campCleared && !alive('camp')) {
      this.campCleared = true;
      g.ui.toast("Gnasher's Camp is quiet", 'The drums have stopped');
    }
  }

  onRegion(g: Game, r: RegionDef) {
    if (r.name === 'Keepsfoot') g.quest('main', 1);
    if (r.name === 'The Seven Stones') g.quest('stones', 0);
    if (r.name === "Gnasher's Camp" && !g.save.data.flags.rescued) g.quest('tam', 0);
    if (r.name === 'The Thorn Road') g.quest('thorns', 0);
  }

  onBreak(g: Game, id: string) {
    if (id !== 'w_thorns') return;
    g.quest('thorns', 1);
    g.after(1.2, () => g.ui.toast('The thorn road is open', 'North along the gorge lies the Old Wood'));
  }

  areaSub(g: Game, r: RegionDef) {
    return r.name === 'The Moonlit Keep' && !g.victory ? 'Seat of the Goblin King' : '';
  }

  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled' {
    const d = n.def, f = g.save.data.flags;
    const folk = this.folk.talk(g, n, lines);
    if (folk) return folk;
    if (d.id === 'elder') {
      if (f.bridge) lines = ['The drawbridge! We heard the chains all the way down here.', 'Go, sir knight. End this.'];
      g.after(0.1, () => g.quest('main', 2));
    }
    if (d.id === 'sister' && !f.rescued) g.quest('tam', 0);
    if (d.id === 'sister' && f.rescued && (g.save.data.quests.tam ?? 0) < 2) {
      g.ui.say(n.name, [...lines, 'Here. It is not much, but it is all I saved. For the knight who brought him home.'], () => {
        g.talking = null;
        g.player.coins += 30;
        g.audio.sfx('coin');
        g.ui.toast('30 coins', "Pip's savings");
        g.quest('tam', 2);
      });
      return 'handled';
    }
    if (d.id === 'warden') {
      const farm = g.save.data.quests.farm;
      if (farm === 1) {
        // The raiders are gone: pay up.
        g.ui.say(n.name, ['You cleared the fields? I heard the goblins screaming from my porch.', 'Here. The king paid wardens in silver once. This is the last of it.'], () => {
          g.talking = null;
          g.player.coins += 80;
          g.player.flasks = g.player.flasksMax;
          g.audio.sfx('coin');
          g.ui.toast('80 coins', 'and your flasks refilled');
          g.quest('farm', 2);
        });
        return 'handled';
      }
      if (farm === 2) lines = ['The fields will grow again. Go on, sir knight. The keep is waiting.'];
      g.after(0.1, () => {
        g.quest('farm', 0);
        g.quest('lodge', 0);
        g.quest('thorns', 0);
      });
    }
    return lines;
  }

  victoryLine(id: string) {
    const folk = this.folk.victoryLine(id);
    if (folk) return folk;
    const L: Record<string, string> = {
      elder: 'The sun is rising over the keep. I had forgotten what it looks like.',
      wife: 'Listen! Birds! When did we last hear birds?',
      sister: 'You did it! You really did it!',
      keeper: 'Drinks are on the house tonight. Well. This morning.',
      smith: 'I will forge you a crown of your own, if you like.',
      tamhome: 'They will sing about this, sir knight.',
      warden: 'Seven more realms, they say. The next lies up the thorn road, past the old lodge. Rest first.',
    };
    return L[id] ?? 'Thank you, knight.';
  }

  onLever(g: Game) {
    g.save.data.flags.bridge = true;
    g.quest('main', 3);
    g.writeSave();
    g.after(0.5, () => {
      g.focus(49, 4, 24.5, 4.2, () => g.ui.toast('The drawbridge is down', 'The way into the keep is open'));
      g.after(0.6, () => g.bridge?.lower(g));
    });
  }

  onCageOpen(g: Game) {
    const tam = g.npc('brother')!;
    g.after(0.6, () => {
      g.talking = tam;
      g.ui.say(tam.name, tam.def.lines, () => {
        g.talking = null;
        g.player.flasksMax = Math.min(6, g.player.flasksMax + 1);
        g.player.flasks = g.player.flasksMax;
        g.audio.sfx('heal');
        g.ui.toast('Moon Flask found', 'You can carry one more flask');
        g.save.data.flags.rescued = true;
        g.quest('tam', 1);
        g.writeSave();
        // Out of the cage, down the camp's road north toward the village.
        tam.walkTo = { x: 97.5, z: 27.6 };
        tam.route = [{ x: 93.2, z: 29.2 }, { x: 89.2, z: 33.8 }, { x: 86.3, z: 39.5 }];
        g.after(5.5, () => {
          tam.visible = false;
          g.npc('tamhome')!.visible = true;
        });
      });
    });
  }

  onBossDeath(g: Game) {
    g.save.data.flags.boss = true;
    g.quest('main', 5);
  }

  arenaOpen(g: Game) {
    return !!g.save.data.flags.courtyard;
  }

  tick(g: Game, dt: number) {
    this.wildlife.update(g, dt);
    this.folk.tick(g, dt);
    // First steps: point the way to the wayshrine's moonfire.
    const p = g.player;
    if (g.state === 'play' && g.settings.hints && !g.tipShown('road') && g.tutorialT > 12 && !g.save.data.lit.length && Math.hypot(p.x - 105.5, p.z - 99.5) < 22 && g.firstTime('road')) {
      g.ui.hint(g.input.usingTouch ? 'Light the <b>moonfire</b> at the wayshrine with the gold button. If you fall, you will rise there.' : `Light the <b>moonfire</b> at the wayshrine with <kbd>${g.input.label('interact')}</kbd>. If you fall, you will rise there.`, 7);
    }
  }
}
