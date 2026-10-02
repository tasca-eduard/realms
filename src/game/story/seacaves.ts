import type { PSpec } from '../../engine/particles';
import { P } from '../../engine/particles';
import { BLOWHOLE, GROTTO } from '../../world/seacaves';
import type { Game } from '../game';
import type { Npc } from '../objects';

/** The blowhole's spray: thick white water thrown up, falling back as rain; the mist hanging after. */
const SPRAY: PSpec = { color: [1.4, 1.55, 1.7], color2: [0.6, 0.7, 0.85], size: 3, size2: 5, life: 1.4, gravity: 9, drag: 0.7, alpha: 0.8, fadeIn: 0.02 };
const MIST: PSpec = { color: [0.8, 0.9, 1.0], color2: [0.4, 0.48, 0.58], size: 5, size2: 10, life: 1.6, drag: 2.5, gravity: -0.4, wobble: 0.3, alpha: 0.35, fadeIn: 0.1 };
/** What Jetsam's secret costs. */
const SECRET_COST = 30;

/**
 * The Sunken Reef's caves (group 36; their places are in src/world/seacaves.ts): Jetsam the castaway in the sea cave
 * (his lore, a hint a talk, his one secret for a little coin: where the grotto is), and the blowhole on the strand's
 * point, which breathes in as each swell comes (a gurgle, spray from its throat) and then spouts, tossing whoever
 * stands in it.
 */
export class SeaCaves {
  private hint = 0;
  /** The blowhole: waiting for the swell, drawing it in, spouting; seconds left of it; swells since the last big one. */
  private phase: 'wait' | 'swell' | 'spout' = 'wait';
  private t = 3;
  private swells = 0;
  private tossed = false;

  tick(g: Game, dt: number) {
    const p = g.player, d = Math.hypot(p.x - BLOWHOLE.x, p.z - BLOWHOLE.z);
    if (d > 50) return;
    const y = g.grid.groundAt(BLOWHOLE.x, BLOWHOLE.z), big = this.swells % 3 === 2;
    this.t -= dt;
    if (this.phase === 'wait' && this.t <= 0) {
      // The swell comes in under the rock: a gurgle, the throat breathing out a little spray.
      this.phase = 'swell';
      this.t = 0.9;
      g.audio.sfx('whirl', BLOWHOLE.x, BLOWHOLE.z);
    } else if (this.phase === 'swell') {
      if (Math.random() < dt * 30) g.fx.emit(SPRAY, BLOWHOLE.x + (Math.random() - 0.5) * 0.3, y + 0.1, BLOWHOLE.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6);
      if (this.t <= 0) {
        this.phase = 'spout';
        this.t = big ? 1.4 : 1;
        this.tossed = false;
        g.audio.sfx('splash', BLOWHOLE.x, BLOWHOLE.z);
        g.audio.sfx('steam', BLOWHOLE.x, BLOWHOLE.z);
        g.fx.burst(P.splash, BLOWHOLE.x, y + 0.3, BLOWHOLE.z, 24, 3, 3);
      }
    } else if (this.phase === 'spout') {
      const n = Math.round(dt * (big ? 380 : 260) * Math.min(1, this.t * 2));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * (big ? 1.1 : 0.8);
        g.fx.emit(SPRAY, BLOWHOLE.x + Math.cos(a) * 0.15, y + 0.2, BLOWHOLE.z + Math.sin(a) * 0.15, Math.cos(a) * s, (big ? 11.5 : 9.5) + Math.random() * 3, Math.sin(a) * s);
      }
      if (Math.random() < dt * 18) g.fx.emit(MIST, BLOWHOLE.x, y + 2 + Math.random() * 3, BLOWHOLE.z, (Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8);
      // Whoever stands in its throat goes up with it.
      if (!this.tossed && d < 0.85 && p.onGround && !p.riding && Math.abs(p.y - y) < 0.4) {
        this.tossed = true;
        p.vy = big ? 12 : 10;
        p.onGround = false;
        p.y += 0.02;
        if (!g.save.data.flags.blowhole) {
          g.save.data.flags.blowhole = true;
          g.ui.toast('The blowhole', 'The swell throws its spray up through the rock, and you with it.', 4);
        }
      }
      if (this.t <= 0) {
        this.phase = 'wait';
        this.swells++;
        this.t = 3.5 + Math.random() * 3;
      }
    }
  }

  /** Jetsam is spoken to: the lines to say, 'handled', or null (not him). */
  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled' | null {
    if (n.def.id !== 'jetsam') return null;
    const f = g.save.data.flags, p = g.player;
    const done = () => (g.talking = null);
    // (Once the sea is free he opens with what he says of it: the game's victory line, which his own talk would hide.)
    const said = g.victory ? [this.victoryLine('jetsam')!] : [...lines];
    if (g.save.data.chests.includes('r3_seacache')) said.push('You have been at the crew\'s cache, then. Good. They chalk their names on what they steal; I never could read goblin.');
    else if (f.costume) said.push('A suit of brass, is it? Then the deep water at the back of the cave is no wall to you. The crew\'s things are past it.');
    const hints = [
      'The point down the shore breathes when the swell comes. Stand in its throat if you want to fly. A little.',
      'The weed on these walls glows when the sea is cold. It is the only lamp I never had to fill.',
      'The crew\'s salvager wears a suit of brass. Down there in it, he is a fish. Up here, he is a goblin. Fight him up here.',
      'Bubbles out of the floor are air. I have watched the crew stand in them, gulping like cod.',
    ];
    g.ui.say(n.name, said, done, [
      { label: 'Ask about the sea', act: () => g.ui.say(n.name, [hints[this.hint++ % hints.length]], done) },
      {
        label: f.grottoTold ? 'Ask about the grotto again' : 'Buy his secret',
        cost: f.grottoTold ? undefined : SECRET_COST,
        disabled: !f.grottoTold && p.coins < SECRET_COST,
        act: () => {
          if (!f.grottoTold) {
            p.coins -= SECRET_COST;
            g.audio.sfx('buy');
            f.grottoTold = true;
            g.fow.reveal(GROTTO.x - 3, GROTTO.z - 3, 6);
            g.fow.flush();
            g.writeSave();
          }
          g.ui.say(n.name, [
            'Thirty coins. A fair price for the only thing I own.',
            'Below the reef south-east of the whale\'s isle, the sea floor drops into the trench. In the trench\'s wall there is a mouth that breathes light.',
            'A diver went in there before my ship ever sailed, and left something he could not carry up. I was younger when I found it. Now I cannot hold my breath past a sneeze.',
          ], done);
        },
      },
      { label: 'Leave him be', act: done },
    ]);
    return 'handled';
  }

  /** What Jetsam says once the sea is free (undefined: not him). */
  victoryLine(id: string): string | undefined {
    return id === 'jetsam' ? 'Daylight in the cave mouth. I had forgotten what colour the sea is. I may go out and look at it. Tomorrow.' : undefined;
  }
}
