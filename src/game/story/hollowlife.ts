import * as THREE from 'three';
import { Geo } from '../../engine/geo';
import type { LightSource } from '../../engine/lights';
import { glowMaterial, K, worldMaterial } from '../../engine/materials';
import { P, type PSpec } from '../../engine/particles';
import { mulberry32 } from '../../engine/util';
import { GLOW } from '../../world/builder';
import { HOLLOW } from '../../world/hollowlife';
import { WOOD } from '../../world/wood';
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

/** A curl of pale wood off the carver's gouge. */
const CHIP: PSpec = { color: [0.85, 0.72, 0.5], color2: [0.6, 0.48, 0.3], size: 1, life: 0.8, gravity: 9, drag: 1.2 };
/** New leaves bursting out as a scarred tree greens. */
const BUD: PSpec = { color: [0.5, 1.4, 0.4], color2: [0.2, 0.6, 0.15], size: 1, size2: 2, life: 1.4, gravity: -0.4, wobble: 0.6, fadeIn: 0.1 };

/** Granny Yarrow's tale, a line at a time to whoever is near (the prototype's own: the Warden was once a
 *  guardian; something twisted it). */
const TALE = [
  'Long ago, when the oaks were acorns, the wood chose a keeper...',
  '...and the Warden walked every path with a lantern of green fire.',
  'Where he trod, the brambles bowed aside, and the deer were not afraid.',
  'But the wood grew old, and the Warden grew tired of keeping it...',
  '...and something whispered to him in the dark under the Great Tree.',
  'Now he keeps the wood the way a fist keeps a bird. Tighter and tighter.',
  'And the thorns? The thorns are only his fingers, children.',
];
/** What her listeners put in. */
const ASIDES: [string, string][] = [
  ['acorn', 'Did he have antlers?'],
  ['teasel', 'You said it was a red lantern last time.'],
  ['acorn', 'I am not scared.'],
  ['woad', 'Bed soon, you two.'],
];
/** What the folk add as the knight's deeds get about: Wren home, the stag freed, the oaks' trial won, the Thorn
 *  Heart torn out (once each; their words once the Warden falls are VICTORY). */
const NEWS: Record<string, { wren?: string; stag?: string; oaks?: string; heart?: string }> = {
  // The village's own folk (src/world/realm2.ts).
  fisher: { heart: 'Something tugged the line this morning. First bite since the thorns came. It got away, but it bit.' },
  washer: { wren: 'Wren came home with her frock in ribbons and the biggest smile in the wood. I will wash it anyway.' },
  pip: { stag: 'Is it true you ride a stag? A real one? With antlers? Can I touch the antlers?' },
  linnet: { wren: 'Wren is back! She says the goblins smelled of cabbage.' },
  burdock: { heart: 'The trees by the lanes have leaves again. I had not seen that green since I had hair.', oaks: 'The oaks gave you their seed? They never gave me anything but splinters.' },
  hazel: { heart: 'The thorns have let go of the trees. My moonflowers will have somewhere to climb that does not bite.' },
  bram: { stag: 'You came in on the stag! I will carry for anyone, but I am not carrying that.' },
  rowan: { heart: 'The purple light on the heights has gone out. I watched it all night to be sure.' },
  marigold: { heart: 'The bees are sweeter-tempered already. Well. Less cross.' },
  sorrel: { wren: 'Wren will need new stockings. Spider silk, or she will only tear wool again.' },
  // ...and those of its evening (src/world/hollowlife.ts).
  clover: { stag: 'Grandad Elm says a stag can jump higher than the swing goes. Can it? Make it jump!' },
  nutkin: { wren: 'Wren pushed me so high once I saw the river. Then I saw the nettles.' },
  yarrow: { heart: 'You tore the heart out of the thorns? Then I shall need a new ending. A better one.', stag: 'The white stag of the Old Wood, bound and freed. That goes in the tale too.' },
  acorn: { stag: 'I saw you on the stag! I did! Teasel did not. I did.' },
  teasel: { wren: 'Wren says the goblins were scared of her. Wren says a lot of things.' },
  woad: { heart: 'The trees on the west bank are green again. The children think Granny\'s story did it. Let them.' },
  midge: { heart: 'The moths came back to the green trees. Hundreds! My jar is not big enough.' },
  kestrel: { heart: 'The purple pulse on the heights stopped. I nearly fell out of the tree cheering.', stag: 'I saw a white shape cross the Deep Wood at a run. That was you? Hoo. Sorry. The owl is catching.' },
  elm: { stag: 'A real stag? Then hold still, both of you. A carver never gets a model that will stand.', heart: 'The thorns have let go of the wood. I can carve without picking them out of the grain.' },
  fern: { heart: 'The deer paths are open again. Nothing pricks at your ankles now.' },
  hob: { oaks: 'The Ring of Oaks rang last night. Like bells, but wooden. Was that you?' },
  sloe: { heart: 'The bushes in the Old Grove are only bushes again. I checked. With a stick.' },
  linden: { heart: 'If the Warden falls, I light every lane in the wood. I have the oil set by. I have had it set by for years.' },
  rush: { wren: 'Wren says she will carry water for me for a week, for the worry. She will carry it for a day.' },
  robin: { wren: 'I have a new song: "Three Blows for Wren". Or one blow. She and Ash cannot agree.', stag: '"The Knight and the White Stag." I have the tune. I need a rhyme for stag that is not nag.' },
  thistle: { oaks: 'The oaks tested you and let you go? They tested my grandfather. He came back bald.' },
  burl: { heart: 'The thorns are gone? Then I am a woodcutter again. Tomorrow. Or the day after.' },
};
/** Their words once the Warden has fallen and the light comes down through the leaves. */
const VICTORY: Record<string, string> = {
  clover: 'Push me! Higher than ever! It is morning and nobody says come in!',
  nutkin: 'My go! It is definitely my go. Today everything is my go.',
  yarrow: 'And the knight climbed the roots, and the Warden fell, and the wood woke. That is how it ends now.',
  acorn: 'Was it scary? It was scary, was it not? Tell me it was scary.',
  teasel: 'Granny says this is the best ending yet. She has said that before.',
  woad: 'Everyone is out, even the old ones. I have not seen the whole village in daylight since I was small.',
  midge: 'The moths are going to bed. I am not. Nobody is!',
  kestrel: 'I can see clear to the Great Tree, and nothing up there is purple. I am coming down for breakfast.',
  elm: 'The stag can wait. I am carving you next. Hold still. No, stiller.',
  fern: 'The whole wood smells of rain and green. I shall pick everything.',
  hob: 'Beechmast for a feast. Roast, this time. No regrets.',
  sloe: 'I walked the Old Grove road at sunrise and nothing rustled. I nearly missed it.',
  linden: 'Every lane lit, all the way to the wood\'s edge. I did it the moment we heard. Lanterns in daylight! Who cares.',
  rush: 'River water for the dye-pots! The Whisper runs clean again.',
  robin: 'I am going to play until my fingers fall off. Then I shall whistle.',
  thistle: 'Forty years at this table. Today I shall sit outside.',
  burl: 'Tomorrow I cut wood. Today I drink to the one who cut thorns.',
};

/** A scarred tree's two crowns: thorns and dead leaves while the Thorn Heart beats, leaves and blossom after. */
interface Scar {
  withered: THREE.Group;
  green: THREE.Group;
  x: number;
  y: number;
  z: number;
  /** How far the greening has got (0 scarred, 1 green). */
  k: number;
}

/**
 * Hollowbough's evening, lived in (group 93): the rope swing and the child on it; the lamplighter's pole, raised
 * and sparking at each lantern; the lute in Robin's lap, strummed; Granny Yarrow's tale, a line at a time to
 * anyone near, her listeners putting in; the lookout shading her eyes; chips off Old Elm's gouge; the shuttle
 * across the weaver's loom. With the story: the thorn-scarred trees go green when the Thorn Heart is torn out;
 * the lantern posts up every lane light (one lane after another) and garlands go up between them when the
 * Warden falls. And what the folk add as the knight's deeds get about. Its places and people are in
 * src/world/hollowlife.ts; the realm's story (forest.ts) hands its moments here.
 */
export class HollowLife {
  private made = false;
  private swing: THREE.Group | null = null;
  private pole: THREE.Group | null = null;
  private lute: THREE.Group | null = null;
  private shuttle: THREE.Group | null = null;
  private scars: Scar[] = [];
  private lanes: THREE.Group[] = [];
  private garlands: THREE.Group | null = null;
  private laneLights: { s: LightSource; lane: number }[] = [];
  /** The lanes lit so far (they light one after another once the Warden falls), and the time to the next. */
  private lit = 0;
  private litT = 0;
  private amp = 0.55;
  private taleI = 0;
  private taleT = 2;
  private asideI = 0;
  private chipT = 0;
  private sparkT = 0;

  apply(g: Game) {
    const f = g.save.data.flags;
    if (!this.made) this.make(g);
    // The thorn-scarred trees: green once the Thorn Heart is torn out.
    for (const s of this.scars) s.k = f.heart || f.bridge ? 1 : 0;
    this.showScars();
    // The lanes' lanterns: lit once the Warden has fallen.
    if (f.boss) this.lit = this.lanes.length;
    this.showLanes();
  }

  private make(g: Game) {
    this.made = true;
    const sw = HOLLOW.swing;
    // The swing: two ropes and a plank seat, hung from the bough.
    if (sw) {
      this.swing = meshOf((m) => {
        for (const sd of [-1, 1]) m.beam([0, 0, sd * 0.28], [0, -sw.len, sd * 0.24], 0.018, '#b8a070');
        m.box(0, -sw.len - 0.04, 0, 0.36, 0.07, 0.62, '#7a5a3a', { kind: K.Wood });
      });
      this.swing.position.set(sw.x, sw.y, sw.z);
      this.swing.rotation.y = -sw.dir;
      g.scene.add(this.swing);
    }
    // Linden's pole: a long hazel rod, a brass hook and a lit wick at its top.
    this.pole = meshOf((m, gl) => {
      m.beam([0, 0, 0], [0, 2.5, 0], 0.025, '#6a5038', { kind: K.Wood });
      m.beam([0, 2.5, 0], [0, 2.62, 0.14], 0.012, '#c8a040');
      m.box(-0.025, 2.38, -0.025, 0.05, 0.08, 0.05, '#c8a040');
      gl.box(-0.03, 2.46, -0.03, 0.06, 0.08, 0.06, GLOW.flame, { kind: 1 });
    });
    g.scene.add(this.pole);
    // Robin's lute: a round-backed body of pale wood, a rose, the neck bent back at the pegs.
    this.lute = meshOf((m) => {
      m.blob(0, 0, 0, 0.17, 0.08, 0.21, '#b07a40', 51, { jitter: 0.02, detail: 1 });
      m.box(-0.13, 0.075, -0.16, 0.26, 0.012, 0.3, '#d8b070');
      m.blob(0, 0.085, -0.02, 0.045, 0.006, 0.045, '#3a2a1a', 52, { jitter: 0 });
      m.box(-0.03, 0.04, 0.18, 0.06, 0.04, 0.4, '#5a3a1e');
      m.beam([0, 0.06, 0.58], [0, -0.04, 0.72], 0.035, '#5a3a1e');
      for (const sd of [-0.015, 0.015]) m.beam([sd, 0.085, -0.12], [sd, 0.08, 0.58], 0.003, '#e8e0c8');
    });
    g.scene.add(this.lute);
    // The shuttle across the weaver's loom.
    const lm = HOLLOW.loom;
    if (lm) {
      this.shuttle = meshOf((m) => {
        m.blob(0, 0, 0, 0.13, 0.025, 0.035, '#a07a48', 61, { jitter: 0 });
        m.box(-0.03, 0.02, -0.015, 0.06, 0.02, 0.03, '#e8e4d8');
      });
      this.shuttle.rotation.y = Math.PI / 2 - lm.rot;
      g.scene.add(this.shuttle);
    }
    // The scarred trees' two crowns each.
    for (const [n, t] of HOLLOW.scarred.entries()) {
      const r = mulberry32(9400 + n);
      const withered = meshOf((m, gl) => {
        // Canes of the Warden's briar wound up the trunk, pale thorns on them, red berries; out along the boughs.
        for (const w of [0, Math.PI]) {
          let prev: [number, number, number] | null = null;
          for (let k = 0; k <= 16; k++) {
            const h = (k / 16) * t.h, a = w + k * 0.75, rr = t.r * (1 - 0.3 * (h / t.h)) + 0.07;
            const p: [number, number, number] = [Math.cos(a) * rr, h + 0.1, Math.sin(a) * rr];
            if (prev) m.beam(prev, p, 0.05, k % 2 ? WOOD.thorn : WOOD.thornDark, { kind: K.Bark });
            if (k % 2) m.box(p[0] * 1.2 - 0.02, p[1], p[2] * 1.2 - 0.02, 0.04, 0.12, 0.04, WOOD.thornTip);
            prev = p;
          }
        }
        for (const [tx, ty, tz] of t.tips) {
          const lx = tx - t.x, ly = ty - t.y, lz = tz - t.z;
          m.beam([lx * 0.45, ly * 0.7, lz * 0.45], [lx, ly - 0.2, lz], 0.04, WOOD.thornDark, { kind: K.Bark });
          // A few clumps of dead leaves, grey-brown, hanging on.
          for (let k = 0; k < 2; k++) m.blob(lx + (r() - 0.5) * 0.9, ly - 0.2 + (r() - 0.5) * 0.4, lz + (r() - 0.5) * 0.9, 0.45 + r() * 0.25, 0.3, 0.45 + r() * 0.25, r() < 0.5 ? '#6a5a40' : '#5a4e3e', Math.floor(r() * 999), { kind: K.Leaves, jitter: 0.4 });
          m.box(lx + 0.15, ly - 0.35, lz, 0.08, 0.08, 0.08, WOOD.berry);
          // A bead of the thorns' sap, faintly glowing.
          if (r() < 0.5) gl.box(lx * 0.7, ly * 0.75, lz * 0.7, 0.06, 0.06, 0.06, [1.6, 0.6, 2.2], {});
        }
      });
      const green = meshOf((m, gl) => {
        for (const [tx, ty, tz] of t.tips) {
          const lx = tx - t.x, ly = ty - t.y, lz = tz - t.z;
          for (let k = 0; k < 3; k++) m.blob(lx + (r() - 0.5) * 1.3, ly + (r() - 0.3) * 0.6, lz + (r() - 0.5) * 1.3, 0.9 + r() * 0.4, 0.65 + r() * 0.25, 0.9 + r() * 0.4, k === 2 ? '#5a8a3a' : r() < 0.5 ? WOOD.leaf : WOOD.leaf2, Math.floor(r() * 999), { kind: K.Leaves, wind: 0.25, jitter: 0.3, detail: 1 });
          // Blossom: white with a blush, in sprays.
          for (let k = 0; k < 5; k++) m.box(lx + (r() - 0.5) * 1.6, ly + 0.2 + r() * 0.6, lz + (r() - 0.5) * 1.6, 0.1, 0.1, 0.1, r() < 0.6 ? '#f0ece0' : '#e8b8c0', { wind: 0.3 });
          if (r() < 0.4) gl.box(lx, ly + 0.5, lz, 0.07, 0.07, 0.07, [1.2, 1.6, 0.6], {});
        }
      });
      for (const grp of [withered, green]) {
        grp.position.set(t.x, t.y, t.z);
        g.scene.add(grp);
      }
      this.scars.push({ withered, green, x: t.x, y: t.y, z: t.z, k: 0 });
    }
    // The lanes' lanterns lit (a mesh a lane: they light one lane after another), their lights, and garlands.
    const lanes = new Map<number, typeof HOLLOW.lamps>();
    for (const l of HOLLOW.lamps) lanes.set(l.lane, [...(lanes.get(l.lane) ?? []), l]);
    for (const [, ls] of [...lanes.entries()].sort((a, b) => a[0] - b[0])) {
      const grp = meshOf((_m, gl) => {
        for (const l of ls) gl.box(l.x, l.y - 0.005, l.z, 0.2, 0.27, 0.2, GLOW.window, {});
      });
      grp.visible = false;
      g.scene.add(grp);
      this.lanes.push(grp);
      ls.forEach((l, k) => {
        if (k % 2) return;
        const s = g.lights.add(l.x, l.y - 0.2, l.z, 0xffa050, 3.5, 6, 0.2);
        s.on = false;
        s.level = 0;
        this.laneLights.push({ s, lane: this.lanes.length - 1 });
      });
    }
    // Garlands from each lantern post to the next up its lane, pennants of the wood's colours on them.
    this.garlands = meshOf((m) => {
      const COL = ['#d8c060', '#3b6b2a', '#e8e0c8', '#8a4a6a', '#5a8a3a'];
      let c = 0;
      for (const ls of lanes.values())
        for (let k = 0; k + 1 < ls.length; k++) {
          const a = ls[k], b = ls[k + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
          if (len > 7.5) continue;
          const at = (u: number): [number, number, number] => [a.x + (b.x - a.x) * u, a.y + 0.5 + (b.y - a.y) * u - Math.sin(u * Math.PI) * 0.4, a.z + (b.z - a.z) * u];
          for (let s = 0; s < 8; s++) m.beam(at(s / 8), at((s + 1) / 8), 0.008, '#d8d0b8', { wind: 0.4 });
          for (let u = 0.08; u < 0.95; u += 0.35 / len) {
            const [px, py, pz] = at(u), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
            m.tri([px - dx * 0.1, py, pz - dz * 0.1], [px + dx * 0.1, py, pz + dz * 0.1], [px, py - 0.24, pz], COL[c++ % COL.length], { kind: K.Cloth, wind: 0.9 });
            m.tri([px + dx * 0.1, py, pz + dz * 0.1], [px - dx * 0.1, py, pz - dz * 0.1], [px, py - 0.24, pz], COL[(c - 1) % COL.length], { kind: K.Cloth, wind: 0.9 });
          }
        }
    });
    this.garlands.visible = false;
    g.scene.add(this.garlands);
  }

  private showScars() {
    for (const s of this.scars) {
      s.withered.visible = s.k < 1;
      s.withered.scale.setScalar(Math.max(0.01, 1 - s.k));
      s.green.visible = s.k > 0;
      s.green.scale.setScalar(Math.max(0.01, s.k));
    }
  }

  private showLanes() {
    this.lanes.forEach((grp, k) => (grp.visible = k < this.lit));
    for (const l of this.laneLights) {
      l.s.on = l.lane < this.lit;
      l.s.level = l.s.on ? 1 : 0;
    }
    if (this.garlands) this.garlands.visible = this.lit >= this.lanes.length && this.lanes.length > 0;
  }

  tick(g: Game, dt: number) {
    if (!this.made) return;
    const f = g.save.data.flags, t = g.time, p = g.player;
    // The Thorn Heart torn out: the thorns wither off the trees and the leaves come, a few seconds over.
    if (f.heart)
      for (const s of this.scars)
        if (s.k < 1) {
          s.k = Math.min(1, s.k + dt / 3);
          if (Math.random() < dt * 8) g.fx.burst(BUD, s.x + (Math.random() - 0.5) * 3, s.y + 3 + Math.random() * 2, s.z + (Math.random() - 0.5) * 3, 3, 1, 0.5);
          this.showScars();
        }
    // The Warden fallen: the lanes light, one after another, then the garlands go up.
    if ((f.boss || g.victory) && this.lit < this.lanes.length && (this.litT -= dt) <= 0) {
      this.lit++;
      this.litT = 0.7;
      this.showLanes();
    }
    this.swingAbout(g, dt);
    // Linden carries his pole on his shoulder; stopped under a lantern he raises it, the wick sparking.
    const lin = g.npc('linden');
    if (lin && this.pole) {
      this.pole.visible = lin.visible;
      const fx = lin.fx, fz = lin.fz, rx = -fz, rz = fx, up = !lin.walkTo && g.talking !== lin;
      this.pole.position.set(lin.x + rx * 0.32 + fx * 0.1, lin.y + (up ? 1.05 : 0.95), lin.z + rz * 0.32 + fz * 0.1);
      this.pole.rotation.set(up ? 0.12 : 0.9, Math.atan2(fx, fz), 0, 'YXZ');
      if (up) {
        lin.model.rig.j('armR').rotation.x = -2.2;
        if ((this.sparkT -= dt) <= 0) {
          this.sparkT = 0.5 + Math.random() * 0.8;
          const wx = this.pole.position.x + Math.sin(this.pole.rotation.y) * 0.3, wz = this.pole.position.z + Math.cos(this.pole.rotation.y) * 0.3;
          g.fx.burst(P.ember, wx, this.pole.position.y + 2.45, wz, 3, 0.5, 0.3);
        }
      } else lin.model.rig.j('armR').rotation.x = -0.5;
    }
    // Robin's lute in his lap, his right hand strumming, his left along the neck.
    const rob = g.npc('robin');
    if (rob && this.lute) {
      const fx = rob.fx, fz = rob.fz, lx = fz, lz = -fx;
      this.lute.position.set(rob.x + fx * 0.22 + lx * 0.05, rob.y + 0.5, rob.z + fz * 0.22 + lz * 0.05);
      this.lute.rotation.set(-0.35, Math.atan2(fx, fz) + Math.PI / 2 + 0.2, 1.25, 'YXZ');
      if (g.talking !== rob) {
        const rig = rob.model.rig;
        rig.j('armR').rotation.x = -0.75 + Math.sin(t * 9) * 0.22;
        rig.j('armR').rotation.z = 0.35;
        rig.j('armL').rotation.x = -1.2;
        rig.j('armL').rotation.z = -0.55;
        rig.j('head').rotation.x = 0.15 + Math.sin(t * 2.3) * 0.08;
      }
    }
    // Kestrel shades her eyes and looks the wood over, slowly, side to side.
    const kes = g.npc('kestrel');
    if (kes && g.talking !== kes) {
      kes.model.rig.j('armR').rotation.x = -2.5;
      kes.model.rig.j('armR').rotation.z = -0.4;
      if (Math.hypot(p.x - kes.x, p.z - kes.z) > 4.5) {
        const a = Math.PI / 4 + Math.sin(t * 0.22) * 1.1;
        kes.fx = Math.cos(a);
        kes.fz = Math.sin(a);
      }
    }
    // Granny Yarrow tells her tale with her hands; anyone near hears a line of it every few seconds, and now and
    // then a listener puts in.
    const yar = g.npc('yarrow');
    if (yar && g.talking !== yar) {
      const rig = yar.model.rig, k = Math.max(0, Math.sin(t * 1.3)), k2 = Math.max(0, Math.sin(t * 1.3 + 2.2));
      rig.j('armR').rotation.x = -0.5 - k * 1.1;
      rig.j('armL').rotation.x = -0.4 - k2 * 0.9;
      const near = Math.hypot(p.x - yar.x, p.z - yar.z) < 9;
      if (near && !g.talking && !g.ui.dialogOpen && (this.taleT -= dt) <= 0) {
        this.taleT = 5.5;
        if (this.taleI % 3 === 2 && Math.random() < 0.6) {
          const [id, line] = ASIDES[this.asideI++ % ASIDES.length], who = g.npc(id);
          if (who) g.bubbleAt(who, line);
          this.taleI++;
        } else g.bubbleAt(yar, TALE[this.taleI++ % TALE.length]);
      }
    }
    // Chips fly off Old Elm's gouge.
    const elm = g.npc('elm');
    if (elm && g.talking !== elm && (this.chipT -= dt) <= 0) {
      this.chipT = 0.25 + Math.random() * 0.3;
      g.fx.emit(CHIP, elm.x + elm.fx * 0.75, elm.y + 0.75, elm.z + elm.fz * 0.75, (Math.random() - 0.5) * 2, 1.6 + Math.random(), (Math.random() - 0.5) * 2);
    }
    // The shuttle across the loom and back, Old Sorrel's hands after it.
    const lm = HOLLOW.loom, sor = g.npc('sorrel');
    if (lm && this.shuttle) {
      const u = Math.sin(t * 0.9) * 0.5, px = Math.sin(lm.rot), pz = -Math.cos(lm.rot);
      this.shuttle.position.set(lm.x + px * u * lm.w * 0.92, lm.y - 0.01, lm.z + pz * u * lm.w * 0.92);
      if (sor && g.talking !== sor) {
        sor.model.rig.j('armR').rotation.x = -1.2 - Math.max(0, Math.cos(t * 0.9)) * 0.4;
        sor.model.rig.j('armL').rotation.x = -1.2 - Math.max(0, -Math.cos(t * 0.9)) * 0.4;
      }
    }
  }

  /** Clover on the swing: up and back along the shore, slowing to a dangle while she's spoken to. */
  private swingAbout(g: Game, dt: number) {
    const sw = HOLLOW.swing, n = g.npc('clover'), grp = this.swing;
    if (!sw || !n || !grp) return;
    this.amp += ((g.talking === n ? 0.12 : 0.55) - this.amp) * Math.min(1, dt * 1.5);
    const th = this.amp * Math.sin(g.time * (Math.PI * 2) / 3.6);
    grp.rotation.z = th;
    const cx = Math.cos(sw.dir), cz = Math.sin(sw.dir), s = Math.sin(th) * sw.len;
    n.x = sw.x + cx * s;
    n.z = sw.z + cz * s;
    n.y = sw.y - Math.cos(th) * sw.len - 0.27;
    const rig = n.model.rig;
    if (g.talking !== n) {
      rig.j('armR').rotation.x = -2.75;
      rig.j('armL').rotation.x = -2.75;
      rig.j('legR').rotation.x = -1.45 - th * 0.8;
      rig.j('legL').rotation.x = -1.3 - th * 0.8;
    }
    rig.place(g.cam, n.x, n.y, n.z, g.grid.groundAt(n.x, n.z), n.visible);
  }

  /** Someone of Hollowbough is spoken to: their lines, with the news of the knight's deeds added (null: nobody
   *  this knows). */
  talk(g: Game, n: Npc, lines: string[]): string[] | null {
    const more = NEWS[n.def.id];
    if (!more) return null;
    const f = g.save.data.flags, out = [...lines];
    if (f.rescued && more.wren) out.push(more.wren);
    if (g.save.data.mounts.includes('stag') && more.stag) out.push(more.stag);
    if ((g.save.data.quests.oaks ?? -1) >= 1 && more.oaks) out.push(more.oaks);
    if ((f.heart || f.bridge) && more.heart) out.push(more.heart);
    return out;
  }

  victoryLine(id: string): string | undefined {
    return VICTORY[id];
  }
}
