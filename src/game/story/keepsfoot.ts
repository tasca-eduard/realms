import * as THREE from 'three';
import { Geo } from '../../engine/geo';
import { glowMaterial, K, worldMaterial } from '../../engine/materials';
import { P, type PSpec } from '../../engine/particles';
import { PAL } from '../../world/builder';
import { NONE } from '../../world/grid';
import { BUSINESS, DICE, FEAST, FLOAT, HELD, LAMP_STOPS, NORTH_LANTERNS, SPIT, WELL } from '../../world/keepsfoot';
import type { EnemySpawn } from '../../world/realm';
import type { Enemy } from '../enemies';
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

/** Grain flung to the hens; fat dripping off the boar into the fire. */
const GRAIN: PSpec = { color: [0.95, 0.82, 0.5], size: 1, life: 0.55, gravity: 9, drag: 1.2 };
const FAT: PSpec = { color: [4, 2.2, 0.6], color2: [1.5, 0.4, 0.05], size: 1, life: 0.4, gravity: 9, drag: 0.5, fadeIn: 0.01 };

/** What each says over the shoulder as the knight passes (the village's own five too). */
const PASSING: Record<string, string[]> = {
  elder: ['The north road, sir knight. Past the tavern.', 'Moon keep you.'],
  wife: ['Mind the towers, sir knight.', 'Evening.'],
  sister: ['Have you found him? Tam?', 'He went into Blackpine.'],
  keeper: ['Come in out of the dark.'],
  smith: ['Mind the sparks!', 'That edge wants work, knight.'],
  kfwatch: ['Evening, sir knight.', 'All quiet on the bridge.', 'Lantern\'s lit. Pass, friend.'],
  kfboy: ['Hot work!', 'Mind the coals!'],
  kfnell: ['Cannot catch me!', 'A knight! A real one!'],
  kfdickon: ['Nearly got her!', 'Is that a real sword?'],
  kfaldous: ['Evening, young knight.', 'Fine night for a war.'],
  kfmabel: ['Moon keep you, dear.', 'Wrap up warm.'],
  kflamp: ['Mind the ladder. I have no ladder. Mind it anyway.', 'Evening! Lamps are lit.'],
  kfangler: ['Shh. Trout.', 'Tread soft on the planks.'],
  kfwasher: ['Mind the wet.', 'Evening, sir.'],
  kfdrinker: ['To the knight!', 'Sit down, have one. No? More for me.'],
  kfhens: ['Mind the hens!', 'Shoo, Crumb!'],
  kfstall: ['Apple, sir knight? For the road.', 'Fresh as anything left.'],
  kfcarter: ['Coming through!', 'Mind your back.'],
  kfmilitia: ['Halt! ...Oh. Evening, sir knight.', 'North road\'s that way. Steps up.'],
  kfpriest: ['Moon keep you, child.', 'A candle for you tonight.'],
  kfwater: ['Mind the bucket.', 'Evening, sir knight.'],
};
/** ...and once Tam is home (in place of the first line above). */
const PASSING_TAM: Record<string, string> = {
  sister: 'Tam is home! You brought him home!',
  elder: 'You brought the boy back. Eat with us, knight.',
  kfwatch: 'Saw the lad come over the bridge myself. Good work.',
  kfnell: 'Tam is back! There is cake!',
  kfdickon: 'Tam says you smashed the cage with one blow!',
  kfdrinker: 'To Tam! And to the knight! And to Tam again!',
  kfaldous: 'Sit, eat. The boy is home.',
  kfmabel: 'Have some pie, dear. You have earned it.',
  kfcarter: 'Tam\'s home! Best load I have carried all week.',
  kfstall: 'Apples for the feast, all of them.',
};

/** What they add to their talk as the knight's deeds get about: Tam home, the drawbridge down. */
const NEWS: Record<string, { tam?: string; bridge?: string }> = {
  kfwatch: { tam: 'The boy came over my bridge at a run, crying and laughing both. I let him pass. I am not made of stone.', bridge: 'Heard the chains of the drawbridge from here. First time in a year I have wanted to stay awake.' },
  kfboy: { tam: 'Tam owes me a knife. He took mine into Blackpine. He can keep it.', bridge: 'Garrow says the bridge winch is old work. Our work. He sounded proud.' },
  kfnell: { tam: 'Tam told us about the goblins\' camp. Dickon cried. I did not. Much.' },
  kfdickon: { tam: 'Tam says the goblins dice for supper. If I was a goblin I would cheat.', bridge: 'Are you going up into the keep? Can I come? No? Can I watch from the well?' },
  kfaldous: { tam: 'A feast, for a boy come home! Like the old days.', bridge: 'The drawbridge is down? Then go up, young knight. I am too old to carry the banner, but I will cheer.' },
  kfmabel: { tam: 'Hesta has not stopped crying since he came home. The good kind.', bridge: 'We put lanterns up the north road for you. So you can find your way home after.' },
  kflamp: { tam: 'I lit an extra lamp tonight. For the boy.', bridge: 'The whole village hung lanterns up the north road. I lent them my wicks. All of them.' },
  kfangler: { bridge: 'Fish are biting since the chains came down. Or I am happier. Same thing.' },
  kfwasher: { tam: 'Tam came home in rags. I have washed them. They are still rags, but clean ones.' },
  kfdrinker: { tam: 'Brannoc let me back in for the feast. I am still sitting out here. Habit.', bridge: 'The drawbridge! Brannoc said I could drink to it. Inside, even.' },
  kfhens: { tam: 'Duchess laid an egg the night Tam came home. I am sure it means something.' },
  kfstall: { tam: 'I gave every apple on the stall to the feast. Do not tell Godric. He hauled them.' },
  kfcarter: { tam: 'Flour for a feast, this load. That is a better song.', bridge: 'Road\'s open to the keep, they say. When it is all done I will haul the king\'s flour again.' },
  kfmilitia: { tam: 'Tam came down the north road past me and I did not even shout. I forgot. I was too happy.', bridge: 'Lanterns all up the north road now. I lit the top one myself.' },
  kfpriest: { tam: 'I rang nothing, for we have no rope, but I sang. Badly.', bridge: 'Go up with the moon at your back. The chapel will be lit until you come down.' },
  kfwater: { tam: 'Fetching water for the feast. Half of Keepsfoot is at that table.' },
};

/** Their words once the Goblin King has fallen and dawn comes up over Keepsfoot. */
const VICTORY: Record<string, string> = {
  kfwatch: 'First dawn in a year, and I saw it from the bridge. I can sleep now. I will not.',
  kfboy: 'Garrow says I can hammer the first nail of the new keep door. The first one!',
  kfnell: 'It is morning! We can play past the well!',
  kfdickon: 'I am going to be a knight. Starting now.',
  kfaldous: 'There it is. The keep, with the sun on it. I can go to my grave content. Not yet, mind.',
  kfmabel: 'Aldous is crying. He says it is the sun in his eyes. It is.',
  kflamp: 'I can put the lamps out. I have never been so glad to put a lamp out.',
  kfangler: 'Dawn on the water. The trout will not know what to do with themselves.',
  kfwasher: 'Sun for the washing at last!',
  kfdrinker: 'Brannoc is pouring for free. I may never leave the square.',
  kfhens: 'Every hen laid this morning. Every one! Even the one that pecks.',
  kfstall: 'Free apples for the knight, for ever. Well. For the season.',
  kfcarter: 'The south road next. Somebody has to haul the new bridge timbers.',
  kfmilitia: 'I did not even have to shout. Best night of my life.',
  kfpriest: 'Somebody find us a bell rope. This morning wants ringing.',
  kfwater: 'I will fetch the water this morning and not look over my shoulder once.',
};

/** Who sits at the feast once Tam is home (on the north bench facing the camera, and one opposite), where Tam
 *  stands at its head. */
const SEATS: Record<string, { x: number; z: number; heading: number }> = {
  kfaldous: { x: FEAST.x0 + 0.5, z: FEAST.z - 0.85, heading: Math.PI / 2 },
  kfmabel: { x: FEAST.x0 + 1.3, z: FEAST.z - 0.85, heading: Math.PI / 2 },
  kfdrinker: { x: FEAST.x0 + 3.0, z: FEAST.z - 0.85, heading: Math.PI / 2 },
  kfcarter: { x: FEAST.x0 + 1.8, z: FEAST.z + 0.85, heading: -Math.PI / 2 },
};
const HEAD = { x: FEAST.x0 - 0.65, z: FEAST.z };
/** Where everyone stands at dawn: out in the square round the well (the children keep playing, the feast keeps
 *  its seats). */
const DAWN: [number, number][] = [
  [81.0, 60.3], [82.5, 61.1], [83.6, 62.5], [84.2, 64.2], [83.9, 66.0], [82.8, 67.6], [81.3, 68.6], [79.6, 69.2],
  [77.9, 69.5], [76.4, 68.8], [80.9, 62.6], [82.1, 64.0], [82.3, 65.7], [78.4, 67.6], [76.2, 66.9], [80.6, 59.2],
];
const GATHER = ['kfwatch', 'kflamp', 'kfangler', 'kfwasher', 'kfboy', 'kfhens', 'kfstall', 'kfmilitia', 'kfpriest', 'kfwater', 'smith', 'keeper', 'kfdrinker', 'kfaldous', 'kfmabel', 'kfcarter'];

/** A foe of the camp at its business: dicing or drumming while it hasn't seen the knight. */
interface Busy {
  id: number;
  role: 'dice' | 'drum';
  face: [number, number];
  k: number;
}

/**
 * Keepsfoot lived in (group 88): its people's night (held lanterns, poles, hammers and brooms, the smith's
 * sparks, the angler's float, grain for the hens), the word they say as the knight passes, the feast after Tam
 * comes home, the lanterns up the north road once the drawbridge is down, everyone out in the square at dawn;
 * and Gnasher's camp at its business before the fight (the boar turning on its spit, two goblins at dice, the
 * drummer). Its places and people are in src/world/keepsfoot.ts; the realm's story (castle.ts) hands its
 * moments here.
 */
export class KeepsfootLife {
  private made = false;
  private duty = '';
  private base = new Map<string, { x: number; z: number; roam?: [number, number][]; pose?: 'sit' | 'fish' | 'work' | 'play'; heading?: number }>();
  private held = new Map<string, THREE.Group>();
  private feast: THREE.Group | null = null;
  private feastCols: { on: boolean }[] = [];
  private lanterns: THREE.Group | null = null;
  private lanternCols: { on: boolean }[] = [];
  private boar: THREE.Group | null = null;
  private dice: THREE.Group[] = [];
  private float: THREE.Group | null = null;
  private fish: THREE.Group | null = null;
  private busy: Busy[] = [];
  /** The knight's last place (to tell him passing from him standing). */
  private px = 0;
  private pz = 0;
  private said = new Map<string, number>();
  private sayN = new Map<string, number>();
  private quiet = 0;
  private hammerT = 0;
  private grainT = 0;
  private bite = 0;
  private biteWait = 6;
  private caught = -1;
  private rollT = 0;
  private roller = 0;
  private chatT = 4;
  private flareT = 0;

  apply(g: Game) {
    if (!this.made) this.make(g);
    this.setDuties(g);
  }

  private make(g: Game) {
    this.made = true;
    for (const n of g.npcs) this.base.set(n.def.id, { x: n.def.x, z: n.def.z, roam: n.def.roam, pose: n.def.pose, heading: n.def.heading });
    // Things in hand: hung on the right arm's joint, so they swing with it.
    for (const [id, what] of Object.entries(HELD)) {
      const n = g.npc(id);
      if (!n) continue;
      const item = meshOf((m, gl) => {
        if (what === 'lantern') {
          m.beam([0, 0, 0], [0, -0.12, 0], 0.008, '#2a2a30');
          m.box(0, -0.16, 0, 0.16, 0.03, 0.16, '#2a2a30', { kind: K.Metal });
          m.pyramid(0, -0.14, 0, 0.17, 0.17, 0.07, '#2a2a30', { kind: K.Metal });
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(sx * 0.065, -0.4, sz * 0.065, 0.02, 0.24, 0.02, '#2a2a30');
          m.box(0, -0.42, 0, 0.16, 0.03, 0.16, '#2a2a30', { kind: K.Metal });
          gl.box(0, -0.39, 0, 0.12, 0.2, 0.12, [3.2, 1.9, 0.75], { kind: 1 });
        } else if (what === 'bucket') {
          m.beam([0, 0, 0], [0, -0.06, 0.12], 0.008, '#3a3a40');
          m.beam([0, 0, 0], [0, -0.06, -0.12], 0.008, '#3a3a40');
          m.cyl(0, -0.36, 0, 0.12, 0.15, 0.3, 8, '#7a5a3a', { kind: K.Wood, top: '#3a5070' });
        } else if (what === 'pole') {
          m.beam([0, 0.5, 0], [0, -1.9, 0], 0.022, '#6a4a2a', { kind: K.Wood });
          m.box(0, -1.96, 0, 0.06, 0.08, 0.06, '#3a3a40', { kind: K.Metal });
          gl.box(0, -2.04, 0, 0.04, 0.07, 0.04, [5, 2.6, 0.8], { kind: 1 });
        } else if (what === 'spear') {
          m.beam([0, 0.6, 0], [0, -1.6, 0], 0.025, '#6a4a2a', { kind: K.Wood });
          m.cyl(0, -1.9, 0, 0, 0.045, 0.3, 5, '#a8a8b8', { kind: K.Metal });
          m.box(0, -1.62, 0, 0.05, 0.1, 0.12, '#4a5a8a', { kind: K.Cloth, wind: 0.6 });
        } else if (what === 'broom') {
          m.beam([0, 0.3, 0], [0, -1.05, 0], 0.02, '#8a6a48', { kind: K.Wood });
          m.cyl(0, -1.35, 0, 0.13, 0.05, 0.32, 7, '#a08a50', { kind: K.Thatch });
        } else {
          // Garrow's hammer: the haft out past his fist, the head across it.
          m.beam([0, 0.05, 0], [0, -0.4, 0], 0.025, '#6a4a2a', { kind: K.Wood });
          m.box(0, -0.46, -0.02, 0.09, 0.09, 0.22, '#3a3a44', { kind: K.Metal });
        }
      });
      item.position.set(0, -0.53, 0.02);
      n.model.rig.j('armR').add(item);
      this.held.set(id, item);
    }
    // The feast: a trestle table under a cloth, benches either side; a roast, loaves, a cheese, a pie, apples,
    // jugs and tankards, and candles down the middle.
    const fy = g.grid.groundAt((FEAST.x0 + FEAST.x1) / 2, FEAST.z), L = FEAST.x1 - FEAST.x0;
    this.feast = meshOf((m, gl) => {
      const cx = (FEAST.x0 + FEAST.x1) / 2, z = FEAST.z;
      m.box(cx, 0.72, z, L, 0.07, 0.9, '#8a6a48', { kind: K.Wood });
      m.box(cx, 0.785, z, L - 0.3, 0.012, 0.92, '#d8d0c0', { kind: K.Cloth });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.beam([cx + sx * (L / 2 - 0.3), 0, z + sz * 0.32], [cx + sx * (L / 2 - 0.3), 0.72, z], 0.035, PAL.woodDark);
      for (const sz of [-1, 1]) {
        m.box(cx, 0.38, z + sz * 0.85, L, 0.06, 0.34, '#7a5a3a', { kind: K.Wood });
        for (const sx of [-1, 0, 1]) m.box(cx + sx * (L / 2 - 0.25), 0, z + sz * 0.85, 0.08, 0.38, 0.28, PAL.woodDark);
      }
      const top = 0.8;
      // The roast on a board in the middle, loaves and a cheese, a pie, a bowl of apples.
      m.box(cx, top, z, 0.6, 0.04, 0.4, '#6a4a2a', { kind: K.Wood });
      m.blob(cx, top + 0.12, z, 0.24, 0.13, 0.17, '#8a4a20', 51, { jitter: 0.1 });
      for (const s of [-1, 1]) m.beam([cx + s * 0.18, top + 0.12, z + 0.05], [cx + s * 0.32, top + 0.2, z + 0.1], 0.03, '#e0d0b0');
      for (const [dx, dz] of [[-1.2, -0.15], [-0.95, 0.18], [1.05, 0.12]]) m.blob(cx + dx, top + 0.06, z + dz, 0.13, 0.07, 0.09, '#c8904a', 60 + dx * 10, { jitter: 0.1 });
      m.cyl(cx + 0.65, top, z - 0.12, 0.16, 0.16, 0.1, 8, '#e8c860', { top: '#d8a840' });
      m.cyl(cx - 0.55, top, z + 0.12, 0.17, 0.15, 0.08, 9, '#b07a3a', { top: '#c89a50' });
      m.cyl(cx + 1.4, top, z - 0.05, 0.15, 0.17, 0.08, 8, '#8a6a48', { kind: K.Wood });
      for (let k = 0; k < 6; k++) m.blob(cx + 1.4 + Math.cos(k) * 0.08, top + 0.12, z - 0.05 + Math.sin(k) * 0.08, 0.05, 0.05, 0.05, k % 2 ? '#a83030' : '#c8a030', 70 + k, {});
      // Jugs and tankards along both sides, candles down the middle.
      for (let k = 0; k < 6; k++) {
        const x = FEAST.x0 + 0.4 + k * 0.58, sz = k % 2 ? 1 : -1;
        m.cyl(x, top, z + sz * 0.3, 0.05, 0.05, 0.13, 6, '#8a8a90', { kind: K.Metal });
      }
      for (const dx of [-1.55, 0.35]) m.cyl(cx + dx, top, z + 0.05, 0.09, 0.07, 0.24, 7, '#b88a5a', { top: '#4a2a1a' });
      for (const dx of [-0.85, 0.85, -1.5, 1.6]) {
        m.cyl(cx + dx, top, z, 0.035, 0.035, 0.14, 5, '#e8e0c8');
        gl.box(cx + dx, top + 0.15, z, 0.035, 0.07, 0.035, [5, 2.8, 1], { kind: 1 });
      }
    });
    this.feast.position.y = fy;
    this.feast.visible = false;
    g.scene.add(this.feast);
    // Lanterns up the north road: a post, an arm, a lantern of moon-blue glass.
    this.lanterns = meshOf((m, gl) => {
      for (const [x, z] of NORTH_LANTERNS) {
        const y = g.grid.groundAt(x, z);
        m.box(x, y - 0.05, z, 0.1, 1.55, 0.1, '#4e3826', { kind: K.Wood });
        m.box(x, y + 1.45, z + 0.12, 0.06, 0.06, 0.3, '#4e3826', { kind: K.Wood });
        m.box(x, y + 1.24, z + 0.24, 0.16, 0.03, 0.16, '#2a2a30', { kind: K.Metal });
        m.pyramid(x, y + 1.43, z + 0.24, 0.18, 0.18, 0.08, '#2a2a30', { kind: K.Metal });
        gl.box(x, y + 1.26, z + 0.24, 0.12, 0.17, 0.12, [1.2, 1.7, 3.4], { kind: 1 });
      }
    });
    this.lanterns.visible = false;
    g.scene.add(this.lanterns);
    // The boar turning on Gnasher's spit, the rod through it.
    this.boar = meshOf((m) => {
      m.beam([-1.25, 0, 0], [1.25, 0, 0], 0.025, '#3a3a40', { kind: K.Metal });
      m.blob(0, -0.18, 0, 0.55, 0.24, 0.25, '#a85a28', 81, { jitter: 0.08, detail: 1 });
      m.blob(0.48, -0.16, 0, 0.24, 0.18, 0.17, '#985024', 82, { jitter: 0.08 });
      m.box(0.72, -0.24, 0, 0.12, 0.12, 0.14, '#4a2412');
      for (const s of [-1, 1]) m.beam([0.62, -0.26, s * 0.08], [0.66, -0.12, s * 0.15], 0.018, '#e8e0c8');
      for (const [lx, s] of [[-0.35, -1], [-0.35, 1], [0.3, -1], [0.3, 1]]) m.beam([lx, -0.3, s * 0.12], [lx + (lx < 0 ? -0.35 : 0.35), -0.05, s * 0.06], 0.045, '#8a4620');
    });
    this.boar.position.set(SPIT.x, g.grid.groundAt(SPIT.x, SPIT.z) + 1.12, SPIT.z);
    this.boar.scale.setScalar(1.2);
    g.scene.add(this.boar);
    // The dicers' two dice.
    for (let k = 0; k < 2; k++) {
      const d = meshOf((m) => {
        m.box(0, -0.035, 0, 0.07, 0.07, 0.07, '#e8e0cc');
        m.box(0, 0.036, 0, 0.02, 0.002, 0.02, '#1a1410');
      });
      g.scene.add(d);
      this.dice.push(d);
    }
    // The angler's float on the stream, and the trout that comes up on the line now and then.
    this.float = meshOf((m) => {
      m.blob(0, 0.04, 0, 0.06, 0.05, 0.06, '#c83a2a', 11, { jitter: 0 });
      m.blob(0, -0.01, 0, 0.055, 0.045, 0.055, '#e8e0d0', 12, { jitter: 0 });
      m.box(0, 0.07, 0, 0.015, 0.08, 0.015, '#e8e0d0');
    });
    g.scene.add(this.float);
    this.fish = meshOf((m) => {
      m.blob(0, 0, 0, 0.16, 0.055, 0.035, '#8a8a6a', 13, { jitter: 0.05, kind: K.Metal });
      m.blob(-0.17, 0, 0, 0.05, 0.06, 0.02, '#6a6a4a', 14, { jitter: 0.05 });
    });
    this.fish.visible = false;
    g.scene.add(this.fish);
    // The camp's goblins at their business (the ones still standing: a foe's index is its save id).
    this.busy = [];
    BUSINESS.forEach((b, k) => {
      const id = g.realm.enemies.indexOf(b.spawn);
      if (id >= 0) this.busy.push({ id, role: b.role, face: b.face, k });
    });
  }

  /** Where everyone is for the story so far: their night, the feast once Tam is home, the square at dawn. */
  private setDuties(g: Game) {
    const f = g.save.data.flags, duty = g.victory ? 'dawn' : f.rescued ? 'feast' : 'night';
    // The feast table and the north road's lanterns, with somewhere solid to bump into.
    const fy = g.grid.groundAt((FEAST.x0 + FEAST.x1) / 2, FEAST.z);
    if (this.feast && f.rescued && !this.feast.visible) {
      this.feast.visible = true;
      this.feastCols.push(g.grid.addCollider({ kind: 'b', x0: FEAST.x0 - 0.05, z0: FEAST.z - 1.05, x1: FEAST.x1 + 0.05, z1: FEAST.z + 1.05, y0: fy - 1, y1: fy + 0.82 }));
    }
    if (this.lanterns && f.bridge && !this.lanterns.visible) {
      this.lanterns.visible = true;
      for (const [x, z] of NORTH_LANTERNS) {
        const y = g.grid.groundAt(x, z);
        this.lanternCols.push(g.grid.addCollider({ kind: 'c', x, z, r: 0.1, y0: y - 1, y1: y + 1.5 }));
      }
    }
    if (duty === this.duty) return;
    this.duty = duty;
    for (const n of g.npcs) {
      const b = this.base.get(n.def.id);
      if (!b) continue;
      let to: { x: number; z: number; roam?: [number, number][]; pose?: 'sit' | 'fish' | 'work' | 'play'; heading?: number } | null = null;
      const seat = SEATS[n.def.id];
      if (duty !== 'night' && seat) to = { ...seat, pose: 'sit' };
      else if (duty !== 'night' && n.def.id === 'tamhome') to = { ...HEAD, heading: 0 };
      else if (duty === 'dawn' && GATHER.includes(n.def.id)) {
        const [x, z] = DAWN[GATHER.indexOf(n.def.id) % DAWN.length];
        to = { x, z, heading: Math.atan2(WELL.z - z, WELL.x - x) };
      } else if (n.def.id.startsWith('kf') || n.def.id === 'smith' || n.def.id === 'keeper' || n.def.id === 'tamhome') to = b;
      if (!to) continue;
      Object.assign(n.def, { roam: to.roam, pose: to.pose, heading: to.heading });
      n.x = to.x;
      n.z = to.z;
      n.y = g.grid.groundAt(to.x, to.z) + (n.def.perch ?? 0);
      n.walkTo = null;
      n.route = [];
      if (to.heading !== undefined) {
        n.fx = Math.cos(to.heading);
        n.fz = Math.sin(to.heading);
        n.model.rig.face(n.fx, n.fz, 0);
      }
    }
  }

  spawns(g: Game, s: EnemySpawn) {
    // The camp's goblins at their business came later: where an older journey already cleared the camp, they
    // stay gone with it.
    if (!BUSINESS.some((b) => b.spawn === s)) return true;
    const mine = BUSINESS.map((b) => b.spawn), killed = g.save.data.killed;
    const camp = g.realm.enemies.map((e, i) => [e, i] as const).filter(([e]) => e.group === 'camp' && !e.off && !mine.includes(e));
    return !camp.every(([, i]) => killed.includes(i));
  }

  tick(g: Game, dt: number) {
    if (!this.made) return;
    this.setDuties(g);
    const p = g.player, t = g.time;
    const step = Math.hypot(p.x - this.px, p.z - this.pz), moving = step > dt * 0.8 && step < 1.5;
    this.px = p.x;
    this.pz = p.z;
    this.passing(g, moving, dt);
    this.hands(g, dt);
    this.angle(g, dt);
    this.camp(g, dt);
    // The hens get their grain: a handful flung toward the yard now and then.
    const bess = g.npc('kfhens');
    if (bess?.visible && !bess.walkTo && bess.heed <= 0 && g.talking !== bess && (this.grainT -= dt) <= 0) {
      this.grainT = 0.7 + Math.random() * 0.9;
      const h = bess.def.heading ?? 0, hx = bess.x + Math.cos(h) * 0.35, hz = bess.z + Math.sin(h) * 0.35;
      for (let k = 0; k < 6; k++) g.fx.emit(GRAIN, hx, bess.y + 0.75, hz, Math.cos(h + (Math.random() - 0.5) * 0.9) * (1.2 + Math.random()), 1.2 + Math.random() * 0.8, Math.sin(h + (Math.random() - 0.5) * 0.9) * (1.2 + Math.random()));
    }
    void t;
  }

  /** A word over the shoulder as the knight goes by: one at a time, each now and then, only while he's moving. */
  private passing(g: Game, moving: boolean, dt: number) {
    this.quiet -= dt;
    const p = g.player;
    if (!moving || this.quiet > 0 || g.talking || g.ui.dialogOpen || !p.alive || g.victory) return;
    const rescued = !!g.save.data.flags.rescued;
    for (const n of g.npcs) {
      const lines = PASSING[n.def.id];
      if (!lines || !n.visible || Math.hypot(p.x - n.x, p.z - n.z) > 3.0 || Math.abs(p.y - n.y) > 2) continue;
      if (g.time - (this.said.get(n.def.id) ?? -99) < 30) continue;
      const k = this.sayN.get(n.def.id) ?? 0;
      const tam = rescued ? PASSING_TAM[n.def.id] : undefined;
      // (Once he is home, Pip has only the one thing to say.)
      const line = tam && (k % 2 === 0 || n.def.id === 'sister') ? tam : lines[k % lines.length];
      this.sayN.set(n.def.id, k + 1);
      this.said.set(n.def.id, g.time);
      this.quiet = 3.5;
      n.heed = 2.6;
      g.bubbleAt(n, line);
      return;
    }
  }

  /** Things in hand: the lantern and the bucket hang straight; the lamplighter's pole goes up to each lamp he
   *  stops at (a flare at its head) and is carried upright between; Garrow's hammer rises and falls on the anvil,
   *  sparks off every blow. */
  private hands(g: Game, dt: number) {
    for (const [id, item] of this.held) {
      const n = g.npc(id);
      if (!n) continue;
      const arm = n.model.rig.j('armR'), busy = !n.walkTo && n.heed <= 0 && g.talking !== n && !g.victory;
      const what = HELD[id];
      if (what === 'lantern' || what === 'bucket') item.rotation.x = -arm.rotation.x;
      else if (what === 'pole' || what === 'spear') {
        const lamp = what === 'pole' && busy ? LAMP_STOPS.find((s) => Math.hypot(s.at[0] - n.x, s.at[1] - n.z) < 0.3) : undefined;
        if (lamp) {
          // Reaching up to the lamp's head, facing it.
          const dx = lamp.head[0] - n.x, dz = lamp.head[1] - n.z, d = Math.hypot(dx, dz) || 1;
          n.fx = dx / d;
          n.fz = dz / d;
          arm.rotation.x = -1.95;
          item.rotation.x = 0;
          if ((this.flareT -= dt) <= 0) {
            this.flareT = 1.4 + Math.random();
            g.fx.burst(P.spark, lamp.head[0] + 0.0, g.grid.groundAt(n.x, n.z) + 1.85, lamp.head[1], 5, 1.2, 0.8);
          }
        } else item.rotation.x = Math.PI - 0.15 - arm.rotation.x;
      } else if (what === 'hammer' && busy) {
        // Up slowly, down hard, a beat on the anvil.
        this.hammerT += dt;
        const c = (this.hammerT % 1.1) / 1.1;
        const k = c < 0.5 ? Math.sin((c / 0.5) * Math.PI * 0.5) : c < 0.6 ? 1 - (c - 0.5) / 0.1 : 0;
        arm.rotation.x = -0.45 - 2.0 * k;
        if (c >= 0.6 && c - dt / 1.1 < 0.6 && Math.hypot(g.player.x - n.x, g.player.z - n.z) < 30) {
          const ay = g.grid.groundAt(94.4, 65.5) + 0.85;
          g.fx.burst(P.spark, 94.4, ay, 65.5, 9, 2.6, 2.2);
        }
      }
    }
  }

  /** Osric's float bobs on the stream; now and then a bite (it tugs under), and one bite in three a trout swung
   *  up onto the bridge. */
  private angle(g: Game, dt: number) {
    const fl = this.float, fish = this.fish, n = g.npc('kfangler');
    if (!fl || !fish || !n) return;
    const w = g.grid.waterAt(FLOAT.x, FLOAT.z), surf = w === NONE ? -0.35 : w;
    fl.visible = n.visible && n.def.pose === 'fish';
    let y = surf + 0.01 + Math.sin(g.time * 1.4) * 0.012;
    if (this.bite > 0) {
      this.bite -= dt;
      y = surf - 0.08 * Math.abs(Math.sin(g.time * 13));
      if (Math.random() < dt * 5) g.fx.burst(P.splash, FLOAT.x, surf + 0.05, FLOAT.z, 2, 1, 1.3);
      if (this.bite <= 0) {
        this.biteWait = 7 + Math.random() * 14;
        if (Math.random() < 0.4 && fl.visible) {
          this.caught = 0;
          fish.visible = true;
          g.fx.burst(P.splash, FLOAT.x, surf + 0.05, FLOAT.z, 10, 2, 2.2);
          if (!g.talking && Math.hypot(g.player.x - n.x, g.player.z - n.z) < 9 && Math.random() < 0.5 && this.quiet <= 0)
            g.bubbleAt(n, ['A trout!', 'Supper.', 'Too small. Back you go.', 'Ha! Look at him.'][Math.floor(Math.random() * 4)]);
        }
      }
    } else if ((this.biteWait -= dt) <= 0) this.bite = 0.8 + Math.random() * 1.2;
    fl.position.set(FLOAT.x, y, FLOAT.z);
    if (this.caught >= 0) {
      this.caught += dt / 0.8;
      const k = Math.min(1, this.caught), hx = n.x + 0.35, hz = n.z;
      fish.position.set(FLOAT.x + (hx - FLOAT.x) * k, surf + Math.sin(k * Math.PI) * 1.8 + (n.y + 0.6 - surf) * k, FLOAT.z + (hz - FLOAT.z) * k);
      fish.rotation.set(Math.sin(g.time * 20) * 0.5, 0, k * 6);
      if (this.caught >= 1) {
        this.caught = -1;
        fish.visible = false;
      }
    }
  }

  /** Gnasher's camp before the fight: the boar turns over the fire, dripping; two goblins squat over the dice; one
   *  beats the war drum. Seen, they're up and fighting (a foe the knight has fought goes back to its business when
   *  it gives up the chase). */
  private camp(g: Game, dt: number) {
    const alive = (e: Enemy | undefined): e is Enemy => !!e && e.alive;
    const campUp = g.enemies.some((e) => e.alive && e.group === 'camp');
    if (this.boar) {
      if (campUp) {
        this.boar.rotation.x += dt * 0.9;
        if (Math.random() < dt * 3) g.fx.emit(FAT, SPIT.x + (Math.random() - 0.5) * 0.8, this.boar.position.y - 0.4, SPIT.z + (Math.random() - 0.5) * 0.3, 0, 0, 0);
      }
    }
    const busy = this.busy.map((b) => ({ b, e: g.enemies.find((e) => e.spawnId === b.id) }));
    const dicers = busy.filter((o) => o.b.role === 'dice' && alive(o.e) && o.e.state === 'idle');
    // The dice: shaken, thrown (they hop and tumble onto the crate), argued over.
    const cy = g.grid.groundAt(DICE.x, DICE.z) + 0.47;
    this.rollT += dt;
    if (this.rollT > 2.6) {
      this.rollT = 0;
      this.roller = (this.roller + 1) % 2;
    }
    const thrown = this.rollT > 1.0 ? Math.min(1, (this.rollT - 1.0) / 0.45) : 0;
    this.dice.forEach((d, k) => {
      d.visible = dicers.length > 0;
      const hop = Math.sin(thrown * Math.PI) * 0.3, ox = (k - 0.5) * 0.14 + (thrown < 1 ? (1 - thrown) * 0.1 : 0);
      d.position.set(DICE.x + ox, cy + hop, DICE.z + (k ? 0.06 : -0.05));
      d.rotation.set(thrown * 7 + k, thrown * 5, 0);
    });
    for (const { b, e } of busy) {
      if (!alive(e) || e.state !== 'idle') continue;
      e.faceTo(b.face[0], b.face[1]);
      const r = e.model.rig;
      if (b.role === 'dice') {
        // Squatting over the crate: the roller shakes his fist, then flings; the other leans in.
        r.j('hips').position.y *= 0.55;
        r.j('legR').rotation.x = -1.35;
        r.j('legL').rotation.x = -1.15;
        r.j('torso').rotation.x = 0.45;
        const rolling = this.dicers(b) === this.roller;
        if (rolling) r.j('armL').rotation.x = this.rollT < 1.0 ? -1.1 + Math.sin(g.time * 22) * 0.25 : -0.4 - (1 - thrown) * 0.8;
        else r.j('armL').rotation.x = -0.6 + Math.sin(g.time * 3 + b.k) * 0.15;
        r.j('head').rotation.x = 0.25;
      } else {
        // The drummer: the drum's own lopsided beat, one arm then the other.
        const step = Math.floor(g.time / 0.19), on = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0][step % 16];
        const ph = (g.time / 0.19) % 1, hit = on ? Math.max(0, 1 - ph * 3) : 0;
        r.j(step % 2 ? 'armR' : 'armL').rotation.x = -0.6 - (1 - hit) * 0.9;
        r.j(step % 2 ? 'armL' : 'armR').rotation.x = -1.4;
        r.j('torso').rotation.x = 0.3;
        r.j('head').rotation.x = Math.sin(g.time * 6) * 0.1;
      }
    }
    // Their talk carries, if the knight is near enough to hear and they haven't seen him.
    if (dicers.length && (this.chatT -= dt) <= 0) {
      this.chatT = 6 + Math.random() * 6;
      const e = dicers[Math.floor(Math.random() * dicers.length)].e!;
      const d = Math.hypot(g.player.x - e.x, g.player.z - e.z);
      if (d > 7 && d < 17 && !g.talking && this.quiet <= 0)
        g.bubbleAt(e, ['Skulls! Pay up!', 'You cheat. You ALWAYS cheat.', 'Roll, roll, ROLL!', 'Double moons? Nobody gets double moons.', 'Winner gets the boar\'s ears.'][Math.floor(Math.random() * 5)]);
    }
  }

  /** Which of the two dicers this is (0 or 1). */
  private dicers(b: Busy) {
    return this.busy.filter((o) => o.role === 'dice').indexOf(b);
  }

  /** Someone of Keepsfoot's night is spoken to: their lines, with the news of the knight's deeds added (null: not
   *  one of theirs). */
  talk(g: Game, n: Npc, lines: string[]): string[] | null {
    if (!PASSING[n.def.id] || !n.def.id.startsWith('kf')) return null;
    const f = g.save.data.flags, more = NEWS[n.def.id], out = [...lines];
    if (f.rescued && more?.tam) out.push(more.tam);
    if (f.bridge && more?.bridge) out.push(more.bridge);
    return out;
  }

  victoryLine(id: string): string | undefined {
    return VICTORY[id];
  }
}
