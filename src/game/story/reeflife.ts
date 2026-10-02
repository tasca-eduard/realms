import * as THREE from 'three';
import { Geo } from '../../engine/geo';
import { glowMaterial, K, worldMaterial } from '../../engine/materials';
import { P, type PSpec } from '../../engine/particles';
import { CAST, FISHERS, SHELLS, TAG } from '../../world/reeflife';
import type { Game } from '../game';
import type { Npc } from '../objects';

function meshOf(build: (g: Geo, gl: Geo) => void) {
  const g = new Geo(), gl = new Geo(true);
  build(g, gl);
  const group = new THREE.Group();
  if (g.count) {
    const m = new THREE.Mesh(g.build(), worldMaterial());
    m.castShadow = true;
    group.add(m);
  }
  if (gl.count) group.add(new THREE.Mesh(gl.build(), glowMaterial()));
  return group;
}

/** A shell flicked onto the heap. */
const SHELL: PSpec = { color: [0.9, 0.86, 0.78], color2: [0.5, 0.48, 0.55], size: 1, life: 0.55, gravity: 9, drag: 0.3 };

/** A fisher's float on the water, the fish that comes up on the line now and then. */
interface Float {
  id: string;
  x: number;
  z: number;
  mesh: THREE.Group;
  fish: THREE.Group;
  /** Seconds till the next bite; how long this bite still tugs; how far through a catch (flying to the fisher). */
  wait: number;
  bite: number;
  caught: number;
  ph: number;
}

/** What the reef's people add as the knight's deeds get about: after the diving suit, once the Tide Serpent is
 *  free, once Kip is home; and a line said every time. (Their words once the Tidelord falls are VICTORY.) */
const NEWS: Record<string, { also?: string; suit?: string; serpent?: string; kip?: string }> = {
  // The reef's own folk (src/world/reef.ts).
  dulse: {
    also: 'This was the Harbour Arms when there was a harbour. The tide took the quay; we floated the sign across on a raft.',
    suit: 'You are the one in Brassbelly\'s suit. Half my regulars want to stand you a drink. The other half want to sell you a patch for it.',
    serpent: 'A sea serpent in harness? My grandmother would have rowed out to see that. I am staying right here.',
    kip: 'Kip came in for fish pie and told the whole room how you tore the cage open. By the third telling, it was two cages.',
  },
  gannet: {
    serpent: 'You cut the Tide Serpent loose? The crew netted it to tow their boats. Good. Let them row.',
    kip: 'Maren has her boy back. The whole shelf heard her.',
  },
  shale: {
    suit: 'That brass suit? Coral would file it to ribbons. Mind the fire coral down there.',
    serpent: 'The serpent\'s teeth are old coral, did you know? Do not let it bite. Or let it bite the crew.',
    kip: 'Kip brought me a shard of glass from the trench. Too hard to file. I like him.',
  },
  ling: {
    suit: 'A diving suit is only a net that keeps the water out. Mostly.',
    kip: 'Maren is mending her own nets again. Badly, but her own.',
  },
  hake: {
    suit: 'When the air runs thin in that suit, look for bubbles rising. A vent breathes for you.',
    serpent: 'I rode a dolphin once, when I was young and stupid. Not far. You are doing better.',
    kip: 'The boy beat my record down there. Forty years I held it. Good.',
  },
  flotsam: {
    suit: 'If you find a brass button down there, it is mine. I lost it some year or other.',
    serpent: 'The crew\'s old nets off the serpent washed up on my beach. Good rope. Thank you.',
  },
  shrimp: {
    suit: 'Can I try the suit? Just the helmet? Just to see?',
    serpent: 'You have a SEA SERPENT?',
  },
  // The village's night (src/world/reeflife.ts).
  gurnard: {
    suit: 'In that suit you will hear the bells too, if you go deep enough. Do not follow them.',
    serpent: 'The Tide Serpent used to swim the pilot boat in past the rocks. An old friend of the harbour. Treat it well.',
  },
  wrasse: {
    serpent: 'My nets came up full this morning, first time since the crew netted the serpent. The fish follow it, the old ones say.',
    kip: 'Kip says the crew made him dive the trench. I would have bitten them.',
  },
  mullet: {
    suit: 'Brassbelly\'s helm, is it? I watched him dive in it once. He sang the whole way down. Badly.',
    kip: 'Maren\'s boy home, and not a scratch on him. That is a tale for the fire.',
  },
  bass: {
    suit: 'You can walk about down there? Tell the fish we are sorry about the hooks.',
    serpent: 'Something big swam under the jetty this morning. My float went down and stayed down. I let it keep the hook.',
  },
  sprat: { kip: 'Kip says he saw a fish as big as the jetty in the trench. Kip lies.' },
  tern: {
    suit: 'The salvager\'s suit is yours now? Bring up my father\'s anchor if you see it. Green paint, mostly gone.',
    kip: 'The boy is home. Maren cooked for the whole shelf. I ate twice.',
  },
  skua: { serpent: 'You let the serpent out, and the fish came back the same day. Do not tell me that is luck.' },
  minnow: { kip: 'Kip is home, but he is not allowed to play. He is grounded. On a coral shelf. Ha.' },
  smelt: { serpent: 'Can the serpent play catch? It has a big mouth.' },
  winkle: { suit: 'Are you a fish now, in that? Fish cannot play tag. You are out.' },
  limpet: { kip: 'Kip is home! He is the fastest at tag. I am the second fastest. Now.' },
  nipper: { serpent: 'If you have a sea serpent, I can have a crab. That is fair.' },
  samphire: { kip: 'Kip ate four bowls. Four. Diving makes you hungry, he says.', suit: 'Wear that suit near my pot and it will smell of chowder for a year.' },
  caulk: { suit: 'Brassbelly\'s suit, is it? Then they have one diver less. I will sleep easier for that.' },
  pollock: { serpent: 'Those were good nets the crew had on the serpent. Wasted on goblins.' },
  cowrie: { kip: 'I carved Kip a little whale. He says it is a fish. It is a whale.' },
  whelk: { kip: 'Maren\'s boy is home. I knew the sea would give him back. It knows who is ours.', suit: 'The tide took my Wilf in a brass helm like that one. Come back up, you hear?' },
};

/** Their words once the Tidelord is gone and daylight finds the sea floor. */
const VICTORY: Record<string, string> = {
  gurnard: 'The bells have stopped. First quiet night in forty years.',
  wrasse: 'Full nets every day now. I may have to build a bigger boat.',
  mullet: 'Write it down, someone: the night the knight came up out of the sea, and the Tidelord did not.',
  bass: 'Daylight on the water. I can see my float. I can see the fish ignoring it.',
  sprat: 'I am going to catch the biggest fish now. Bigger than Kip\'s.',
  tern: 'We could build a quay again. On the coral, mind. We are not going back.',
  skua: 'Fish in the bay again. I will have to find something new to grumble about.',
  minnow: 'Catch! ...You caught it! Knights can catch.',
  smelt: 'Kip is allowed to play again. Everybody is allowed everything today.',
  winkle: 'You are it! Forever! Because you won!',
  limpet: 'Mum says we can go past the floats now. Just a little.',
  nipper: 'Pinch can go home now. He does not want to. He likes the string.',
  samphire: 'Chowder for everyone. Even the knight. Especially the knight.',
  caulk: 'No more stove-in boats. I shall have to learn to fish.',
  pollock: 'Nets come up full and whole. I hardly know what to do with my hands.',
  cowrie: 'I am carving you. Small, mind. Coral is dear.',
  whelk: 'Dry streets in my dreams again, and the sun on the water when I wake.',
};

/**
 * The coral village's night (the realm 3 content pass): the fishers' floats bobbing and now and then a bite, a
 * fish swung in; the ball between two children on the green; tag in the shallows; Pinch the crab on Nipper's
 * string; Granny Whelk's shells onto the heap; and what the village says as the knight's deeds get about. Its
 * places and people are in src/world/reeflife.ts; the realm's story (aqua.ts) hands its moments here.
 */
export class ReefLife {
  private made = false;
  private floats: Float[] = [];
  private ball: THREE.Group | null = null;
  /** The ball's flight: who has it (0 or 1), how far through the throw (over 1: held). */
  private holder = 0;
  private throwT = 1.5;
  private itId = 'winkle';
  private counting = 1.5;
  private fleeT = 0;
  private splashT = 0;
  private crab: THREE.Group | null = null;
  private crabPos = new THREE.Vector3();
  private string: THREE.Line | null = null;
  private shellT = 1;

  apply(g: Game) {
    if (this.made) return;
    this.made = true;
    for (const f of FISHERS) {
      const x = f.x + Math.cos(f.heading) * CAST, z = f.z + Math.sin(f.heading) * CAST;
      // A float of cork painted red and white, its line up to the rod.
      const mesh = meshOf((m) => {
        m.blob(0, 0.04, 0, 0.07, 0.06, 0.07, '#c83a2a', 11, { jitter: 0 });
        m.blob(0, -0.01, 0, 0.065, 0.05, 0.065, '#e8e0d0', 12, { jitter: 0 });
        m.box(0, 0.08, 0, 0.02, 0.1, 0.02, '#e8e0d0');
        m.beam([0, 0.17, 0], [-Math.cos(f.heading) * 0.12, 0.85, -Math.sin(f.heading) * 0.12], 0.006, '#d8d8c8');
      });
      mesh.position.set(x, 0, z);
      g.scene.add(mesh);
      const fish = meshOf((m) => {
        m.blob(0, 0, 0, 0.17, 0.06, 0.035, '#b8c4cc', 13, { jitter: 0.05, kind: K.Metal });
        m.blob(-0.18, 0, 0, 0.05, 0.06, 0.02, '#8a9aa4', 14, { jitter: 0.05 });
      });
      fish.visible = false;
      g.scene.add(fish);
      this.floats.push({ id: f.id, x, z, mesh, fish, wait: 4 + Math.random() * 10, bite: 0, caught: -1, ph: Math.random() * 6 });
    }
    // The children's ball: a fish bladder sewn into sailcloth.
    this.ball = meshOf((m) => {
      m.blob(0, 0, 0, 0.17, 0.17, 0.17, '#e8dcb8', 21, { jitter: 0.05, kind: K.Cloth, detail: 1 });
      m.box(0, -0.025, 0, 0.35, 0.05, 0.35, '#b83a2a', { kind: K.Cloth });
    });
    g.scene.add(this.ball);
    // Pinch, Nipper's crab, and the string between them.
    this.crab = meshOf((m) => {
      m.blob(0, 0.07, 0, 0.13, 0.06, 0.1, '#c8582a', 31, { jitter: 0.1 });
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) m.beam([-0.05 + k * 0.05, 0.06, s * 0.08], [-0.08 + k * 0.07, 0, s * 0.2], 0.012, '#a8481e');
        m.beam([0.1, 0.07, s * 0.05], [0.18, 0.08, s * 0.1], 0.015, '#a8481e');
        m.blob(0.21, 0.08, s * 0.1, 0.05, 0.03, 0.035, '#d86a3a', 32, { jitter: 0 });
        m.box(0.1, 0.12, s * 0.035, 0.015, 0.05, 0.015, '#1a1a20');
      }
    });
    const nip = g.npc('nipper');
    if (nip) this.crabPos.set(nip.x - 0.8, nip.y, nip.z);
    g.scene.add(this.crab);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.string = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8d0b0 }));
    this.string.frustumCulled = false;
    g.scene.add(this.string);
  }

  tick(g: Game, dt: number) {
    if (!this.made) return;
    const t = g.time, p = g.player;
    // The floats: bobbing on the swell; now and then a bite (it tugs under, the water splashes), and one bite in
    // three a fish swung up out of the sea to the fisher.
    for (const f of this.floats) {
      const who = g.npc(f.id);
      let y = 0.01 + Math.sin(t * 1.6 + f.ph) * 0.015;
      if (f.bite > 0) {
        f.bite -= dt;
        y = -0.09 * Math.abs(Math.sin(t * 13 + f.ph));
        if (Math.random() < dt * 6) g.fx.burst(P.splash, f.x, 0.05, f.z, 2, 1, 1.4);
        if (f.bite <= 0) {
          f.wait = 6 + Math.random() * 14;
          if (Math.random() < 0.4 && who) {
            f.caught = 0;
            f.fish.visible = true;
            g.fx.burst(P.splash, f.x, 0.05, f.z, 10, 2, 2.4);
            if (!g.talking && Math.hypot(p.x - who.x, p.z - who.z) < 9 && Math.random() < 0.5)
              g.bubbleAt(who, ['Got one!', 'A mackerel!', 'Look at that!', 'Supper.', 'Small. It counts.'][Math.floor(Math.random() * 5)]);
          }
        }
      } else if ((f.wait -= dt) <= 0) f.bite = 0.8 + Math.random() * 1.2;
      f.mesh.position.y = y;
      f.mesh.rotation.z = Math.sin(t * 1.3 + f.ph) * 0.12;
      if (f.caught >= 0 && who) {
        f.caught += dt / 0.8;
        const k = Math.min(1, f.caught), hx = who.x + Math.cos(who.def.heading ?? 0) * 0.4, hz = who.z + Math.sin(who.def.heading ?? 0) * 0.4;
        f.fish.position.set(f.x + (hx - f.x) * k, Math.sin(k * Math.PI) * 1.9 + (who.y + 0.6) * k, f.z + (hz - f.z) * k);
        f.fish.rotation.set(Math.sin(t * 20) * 0.5, -(who.def.heading ?? 0), k * 6);
        if (f.caught >= 1) {
          f.caught = -1;
          f.fish.visible = false;
        }
      }
    }
    this.playBall(g, dt);
    this.playTag(g, dt);
    this.walkCrab(g, dt);
    // Granny Whelk shells her mussels, flicking the shells onto the heap.
    const w = g.npc('whelk');
    if (w && (this.shellT -= dt) <= 0 && g.talking !== w) {
      this.shellT = 0.9 + Math.random() * 1.2;
      const hx = w.x + Math.cos(1.25) * 0.3, hz = w.z + Math.sin(1.25) * 0.3;
      g.fx.emit(SHELL, hx, w.y + 0.55, hz, (SHELLS.x - hx) * 1.6, 2.2, (SHELLS.z - hz) * 1.6);
    }
  }

  /** The ball goes back and forth between Minnow and Smelt, in a high arc; held a moment each catch. */
  private playBall(g: Game, dt: number) {
    const a = g.npc('minnow'), b = g.npc('smelt'), ball = this.ball;
    if (!a || !b || !ball) return;
    const kids = [a, b], from = kids[this.holder], to = kids[1 - this.holder];
    const hold = g.talking === a || g.talking === b;
    if (!hold) this.throwT += dt / 1.15;
    if (this.throwT < 1) {
      const k = this.throwT;
      ball.position.set(from.x + (to.x - from.x) * k, from.y + 1.0 + Math.sin(k * Math.PI) * 2.1, from.z + (to.z - from.z) * k);
      ball.rotation.x += dt * 6;
    } else {
      // Caught: held up a moment, then thrown back.
      ball.position.set(to.x + (from.x - to.x) * 0.06, to.y + 1.0 + Math.abs(Math.sin(g.time * 6)) * 0.12, to.z + (from.z - to.z) * 0.06);
      if (this.throwT > 1.55 && !hold) {
        this.holder = 1 - this.holder;
        this.throwT = 0;
      }
    }
  }

  /** Tag in the shallows: whoever is it counts a moment, then gives chase; the other runs, away from them and
   *  round the sand; caught, it's the other's turn. They splash where the water is. */
  private playTag(g: Game, dt: number) {
    const ids = ['winkle', 'limpet'], it = g.npc(this.itId), run = g.npc(ids.find((i) => i !== this.itId)!);
    if (!it || !run || g.talking === it || g.talking === run) return;
    const d = Math.hypot(it.x - run.x, it.z - run.z);
    if (this.counting > 0) {
      this.counting -= dt;
      it.walkTo = null;
    } else it.walkTo = { x: run.x, z: run.z };
    this.fleeT -= dt;
    if (!run.walkTo || (d < 2.4 && this.fleeT <= 0)) {
      const away = Math.atan2(run.z - it.z, run.x - it.x) + (Math.random() - 0.5) * 1.8, L = 2.5 + Math.random() * 2;
      let x = run.x + Math.cos(away) * L, z = run.z + Math.sin(away) * L;
      // Cornered: double back past the chaser instead.
      if (x < TAG.x0 || x > TAG.x1 || z < TAG.z0 || z > TAG.z1) {
        x = TAG.x0 + Math.random() * (TAG.x1 - TAG.x0);
        z = TAG.z0 + Math.random() * (TAG.z1 - TAG.z0);
      }
      run.walkTo = { x, z };
      this.fleeT = 0.9;
    }
    if (d < 0.6 && this.counting <= 0) {
      this.itId = run.def.id;
      this.counting = 1.6;
      run.walkTo = null;
      it.walkTo = { x: Math.min(TAG.x1, Math.max(TAG.x0, it.x + (it.x - run.x) * 4)), z: Math.min(TAG.z1, Math.max(TAG.z0, it.z + (it.z - run.z) * 4)) };
      if (Math.hypot(g.player.x - it.x, g.player.z - it.z) < 10 && !g.talking && Math.random() < 0.25) g.bubbleAt(run, 'Got you! You are it!');
    }
    if ((this.splashT -= dt) <= 0) {
      this.splashT = 0.16;
      for (const k of [it, run]) if (k.walkTo && k.y < -0.1) g.fx.burst(P.splash, k.x, k.y + 0.3, k.z, 3, 1.3, 1.8);
    }
  }

  /** Pinch scuttles after Nipper on his string (pulled along when it goes taut), claws toward the boy. */
  private walkCrab(g: Game, dt: number) {
    const n = g.npc('nipper'), crab = this.crab, line = this.string;
    if (!n || !crab || !line) return;
    const c = this.crabPos, dx = n.x - c.x, dz = n.z - c.z, d = Math.hypot(dx, dz) || 1;
    const moving = d > 0.95;
    if (moving) {
      const v = Math.min(d - 0.95, 3 * dt);
      c.x += (dx / d) * v;
      c.z += (dz / d) * v;
    }
    c.y = g.grid.groundAt(c.x, c.z);
    crab.position.set(c.x, c.y + (moving ? Math.abs(Math.sin(g.time * 18)) * 0.03 : 0), c.z);
    crab.rotation.y = -Math.atan2(dz, dx) + (moving ? Math.sin(g.time * 9) * 0.25 : Math.sin(g.time * 1.5) * 0.15);
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, n.x - (dx / d) * 0.18, n.y + 0.5, n.z - (dz / d) * 0.18);
    pos.setXYZ(1, c.x + (dx / d) * 0.12, c.y + 0.1, c.z + (dz / d) * 0.12);
    pos.needsUpdate = true;
  }

  /** Someone of the village is spoken to: their lines, with the news of the knight's deeds added (null: not
   *  one of theirs). */
  talk(g: Game, n: Npc, lines: string[]): string[] | null {
    const more = NEWS[n.def.id];
    if (!more) return null;
    const f = g.save.data.flags, out = [...lines];
    if (more.also) out.push(more.also);
    if (f.costume && more.suit) out.push(more.suit);
    if (g.save.data.mounts.includes('serpent') && more.serpent) out.push(more.serpent);
    if (f.rescued && more.kip) out.push(more.kip);
    return out;
  }

  victoryLine(id: string): string | undefined {
    return VICTORY[id];
  }
}
