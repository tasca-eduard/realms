import { DEN, GROTTO } from '../../world/inkgrotto';
import type { Enemy } from '../enemies';
import type { Game } from '../game';
import { Chest, type Npc } from '../objects';

/** The octopus's name over its health bar. */
const INKARM = 'Old Inkarm';
/** Its chest, where it lay: the Kraken's Ink in it, and a fortune besides. */
const CHEST = { id: 'r3_inkarm', coins: 110, rot: 0.1 };

/**
 * The Ink Grotto's story (src/world/inkgrotto.ts, src/game/inkarm.ts): Old Inkarm's health bar while it fights
 * the knight; felled, a great chest comes up out of the ink where it lay (the Kraken's Ink in it, the power that
 * blinds foes); the old diver on the jetty warns of it. The realm's story (aqua.ts) hands its moments here.
 */
export class InkGrotto {
  private bar = false;
  private chest: Chest | null = null;
  /** The chest rising out of the floor (seconds since it began). */
  private rise = -1;

  apply(g: Game) {
    // Felled before (a fall, a journey): its chest waits where it lay.
    const i = g.realm.enemies.findIndex((s) => s.type === 'inkarm');
    if (i >= 0 && g.save.data.killed.includes(i) && !this.chest) this.dropChest(g, false);
  }

  onKill(g: Game, e: Enemy) {
    if (e.type !== 'inkarm') return;
    this.bar = false;
    g.ui.bossHide();
    g.fightMusic = Math.min(g.fightMusic, 1.5);
    g.ui.toast('Old Inkarm is felled', 'It sinks into its own ink, and something comes up out of the floor', 4);
    g.after(1.4, () => this.dropChest(g, true));
  }

  /** The great chest where it lay: coming up out of the floor, or already there. */
  private dropChest(g: Game, live: boolean) {
    const c = new Chest(CHEST.id, DEN.x, DEN.z + 0.3, CHEST.rot, CHEST.coins, g);
    c.power = 'ink';
    c.radius = 2;
    c.group.scale.setScalar(1.45);
    g.chests.push(c);
    g.interactables.push(c);
    if (g.save.data.chests.includes(c.id)) c.setOpen(true);
    this.chest = c;
    if (live) {
      this.rise = 0;
      c.group.position.y = c.y - 1.2;
      g.audio.sfx('creak', c.x, c.z);
      g.shake(0.3);
      g.fx.burst({ color: [0.3, 0.28, 0.32], color2: [0.16, 0.15, 0.2], size: 4, size2: 9, life: 1.2, drag: 3.5, gravity: -0.3, alpha: 0.6, soft: true }, c.x, c.y + 0.2, c.z, 30, 3, 1);
      const l = g.lights.add(c.x, c.y + 1.2, c.z, 0xffc060, 6, 6, 0.1);
      g.after(2.5, () => g.lights.remove(l));
    }
  }

  /** The old diver on the jetty warns of it (and knows when it's gone). */
  talk(g: Game, n: Npc, lines: string[]) {
    if (n.def.id !== 'hake') return lines;
    const i = g.realm.enemies.findIndex((s) => s.type === 'inkarm');
    const felled = i >= 0 && g.save.data.killed.includes(i);
    return [...lines, felled
      ? 'Old Inkarm, gone? Forty years she kept that cave. Then what she kept is yours, knight, and welcome to it.'
      : "West of the drowned kingdom, where the trench begins, there's a cave in its wall. Old Inkarm lives there: arms longer than my boat, an eye like a lamp. Strike her body when her arms are down, never before."];
  }

  tick(g: Game, dt: number) {
    if (this.chest && this.rise >= 0) {
      this.rise += dt;
      const k = Math.min(1, this.rise / 1.1);
      this.chest.group.position.y = this.chest.y - 1.2 * (1 - k * k * (3 - 2 * k));
      if (k >= 1) this.rise = -1;
    }
    // Its health bar while it fights the knight in its grotto (none while the realm's tyrant is up).
    const e = g.enemies.find((x) => x.type === 'inkarm');
    const p = g.player;
    const on = !!e && e.alive && e.state !== 'idle' && p.x > GROTTO.x0 - 3 && p.x < GROTTO.x1 + 3 && p.z > GROTTO.z0 - 3 && p.z < GROTTO.z1 + 3 && !g.bossActive;
    if (on !== this.bar) {
      this.bar = on;
      if (on) g.ui.bossShow(INKARM);
      else g.ui.bossHide();
    }
    if (on) g.ui.bossHp(e!.hp / e!.maxHp);
    // (Its fight has its own music while the bar is up.)
    if (on) g.fightMusic = 4;
  }
}
