import * as THREE from 'three';
import { PLAYER } from '../../config';
import { Geo } from '../../engine/geo';
import type { LightSource } from '../../engine/lights';
import { glowMaterial, K, worldMaterial } from '../../engine/materials';
import { P } from '../../engine/particles';
import { BOATS, BOAT_WAY, GALLERY_Y, LAMP, LENS, LIGHT, lighthouseTops, OIL, ROCK_Y, STAIR } from '../../world/lighthouse';
import type { Pt } from '../../world/paint';
import type { Game } from '../game';
import type { Interactable, Npc } from '../objects';

// ---------------------------------------------------------------------------
// "The Dark Lamp" (the Sunken Reef's lighthouse quest; its places are src/world/lighthouse.ts). Old Wick on
// the village shore says the crew put his lamp out so the fishers' boats would break on the rocks for
// salvage. The lamp wants oil (the last whole cask, in the sunken ship's hold) and its lens (thrown into the
// sea east of the rock): both lie under the water, so the salvager's suit first, and with the salvager gone
// Wick goes home to his tower. Up the stair round the tower to the gallery, the lamp lit: it blazes, its beam
// sweeps slowly round over the sea, the three boats waiting out past the reef come home to the jetty, and
// Wick gives the knight coins and his storm lantern (it lights the deep round him).
// ---------------------------------------------------------------------------

type RGB = [number, number, number];
const LAMP_GLOW: RGB = [3.6, 2.6, 1.1];
const LAMP_CORE: RGB = [7, 5, 2.2];
/** How fast the beam goes round (radians a second: once in about fourteen seconds). */
const SWEEP = 0.45;
const BEAM_LEN = 58;
/** The boats' speed home (m/s), and how far apart they set off. */
const BOAT_SPEED = 3.4, BOAT_GAP = 2.6;
const OIL_GLINT = { color: [3, 2.2, 0.8] as RGB, size: 1, life: 0.6, gravity: -0.6 };

function meshOf(build: (g: Geo, gl: Geo) => void) {
  const g = new Geo(), gl = new Geo(true);
  build(g, gl);
  const group = new THREE.Group();
  if (g.count) {
    const m = new THREE.Mesh(g.build(), worldMaterial());
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  if (gl.count) group.add(new THREE.Mesh(gl.build(), glowMaterial()));
  return group;
}

/** A soft shaft of light: brightest along its middle and near the lamp, fading out toward its far end and
 *  its edges (added onto what's behind it, never hiding anything). */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.8, 0.48) }, uOn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong; varying float vFace;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vFace = abs(dot(n, normalize(cameraPosition - wp.xyz)));
        vAlong = 1.0 - uv.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOn; varying float vAlong; varying float vFace;
      void main() {
        float a = pow(vFace, 1.3) * pow(1.0 - vAlong, 1.2) * smoothstep(0.0, 0.03, vAlong) * uOn * 0.55;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** A round soft glow (the lamp's halo, a boat's lantern), seen the same from every side. */
function haloSprite(color: number, size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!, grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1);
  return s;
}

/** Something to bring back, lying where it fell: glinting; walk onto it to take it. */
class Find {
  y: number;
  group: THREE.Group;
  light: LightSource;
  taken = false;
  constructor(public x: number, public z: number, g: Game, build: (m: Geo, gl: Geo) => void, glow: number, private onTake: () => void) {
    this.y = g.grid.groundAt(x, z);
    this.group = meshOf(build);
    this.group.position.set(x, this.y, z);
    g.scene.add(this.group);
    this.light = g.lights.add(x, this.y + 0.9, z, glow, 4.5, 6, 0.1);
  }
  update(dt: number, g: Game) {
    if (this.taken) return;
    if (Math.random() < dt * 4) g.fx.emit(OIL_GLINT, this.x + (Math.random() - 0.5) * 0.8, this.y + 0.2 + Math.random() * 0.5, this.z + (Math.random() - 0.5) * 0.8, 0, 0.5, 0);
    const p = g.player;
    if (p.alive && !g.flying && Math.hypot(p.x - this.x, p.z - this.z) < 1.1 && Math.abs(p.y - this.y) < 1.4) {
      this.remove(g);
      g.audio.sfx('power', this.x, this.z);
      this.onTake();
    }
  }
  remove(g: Game) {
    this.taken = true;
    g.scene.remove(this.group);
    this.light.on = false;
    this.light.level = 0;
  }
}

/** The lamp on the gallery: lit here once the knight brings oil and lens up. */
class Lamp implements Interactable {
  x = LIGHT.x;
  z = LIGHT.z;
  y = GALLERY_Y;
  radius = 2.3;
  constructor(private q: DarkLamp) {}
  prompt(g: Game) {
    return this.q.lampPrompt(g);
  }
  interact(g: Game) {
    this.q.light(g);
  }
}

/** A fisher's boat: a broad hull, a mast with its sail furled, a lantern on a pole at the stern. */
function boatModel(paint: string) {
  return meshOf((m, gl) => {
    m.box(0, -0.1, 0, 2.4, 0.5, 1.1, '#4e3826', { kind: K.Wood });
    m.box(0.05, 0.38, 0, 2.3, 0.1, 1.16, paint, { kind: K.Wood });
    m.push().translate(1.35, -0.1, 0).rotateY(Math.PI / 4);
    m.box(0, 0, 0, 0.62, 0.55, 0.62, '#4e3826', { kind: K.Wood });
    m.pop();
    m.box(0.2, 0.3, 0, 0.3, 0.08, 1.0, '#7a5c40', { kind: K.Wood });
    m.cyl(0.35, 0.3, 0, 0.06, 0.05, 2.6, 6, '#5e4430', { kind: K.Wood });
    m.beam([0.35, 1.2, 0], [-0.9, 1.0, 0], 0.04, '#5e4430', { kind: K.Wood });
    m.blob(-0.25, 1.12, 0, 0.62, 0.13, 0.14, '#c8b890', 31, { kind: K.Cloth, jitter: 0.1 });
    m.beam([-1.05, 0.35, 0], [-1.05, 1.15, 0], 0.03, '#3a2e24', { kind: K.Wood });
    m.box(-1.05, 1.0, 0, 0.16, 0.2, 0.16, '#3a3a44', { kind: K.Metal });
    gl.box(-1.05, 1.03, 0, 0.11, 0.14, 0.11, [3.2, 2, 0.7], { kind: 1 });
    // Nets heaped in the bottom, a crate of the catch.
    m.blob(-0.45, 0.35, 0.15, 0.4, 0.12, 0.3, '#6a6a4a', 33, { kind: K.Cloth });
    m.box(0.85, 0.35, -0.2, 0.36, 0.22, 0.3, '#7a5c40', { kind: K.Wood });
  });
}

interface Boat {
  group: THREE.Group;
  light: LightSource;
  path: Pt[];
  len: number[];
  s: number;
  rot: number;
  moored: boolean;
  seed: number;
}

export class DarkLamp {
  private made = false;
  private lamp: Lamp | null = null;
  private darkGlass: THREE.Group | null = null;
  private litGlass: THREE.Group | null = null;
  private halo: THREE.Sprite | null = null;
  private beam: THREE.Group | null = null;
  private beamMat: THREE.ShaderMaterial | null = null;
  private lampLight: LightSource | null = null;
  private sweepLight: LightSource | null = null;
  private lantern: LightSource | null = null;
  /** How far the lamp has come up (0 dark, 1 blazing). */
  private glow = 0;
  private finds: Find[] = [];
  private boats: Boat[] = [];
  private boatT = -1;
  /** Grid cells whose decks the stair and gallery are laid into, and what each held before. */
  private cells = new Map<number, number>();
  private stamp = new Map<number, number>();
  private frame = 0;
  private tops: number[] = [];
  /** Wick is at his lighthouse (not on the village shore). */
  private home = false;

  apply(g: Game) {
    if (!this.made) this.make(g);
    const f = g.save.data.flags;
    if (f.lampOil) this.finds[0]?.remove(g);
    if (f.lampLens) this.finds[1]?.remove(g);
    if (f.lampLit) {
      this.glow = 1;
      for (const b of this.boats) this.moor(b);
      this.boatT = 999;
      g.npc('ness')!.visible = true;
    }
    if (this.wantsHome(g)) this.setHome(g, true);
  }

  private make(g: Game) {
    this.made = true;
    // The lamp: dark glass, the lit lamp in it (hidden until lit), its halo, the beams, its lights.
    this.lamp = new Lamp(this);
    g.interactables.push(this.lamp);
    const { x, y, z, r, h } = LAMP;
    this.darkGlass = meshOf((m) => m.cyl(0, 0, 0, r, r, h, 12, '#1a2630', { kind: K.Metal }));
    this.litGlass = meshOf((_m, gl) => {
      gl.cyl(0, 0, 0, r - 0.02, r - 0.02, h, 12, LAMP_GLOW, { kind: 0 });
      gl.blob(0, h * 0.5, 0, 0.32, 0.38, 0.32, LAMP_CORE, 5, { detail: 1, jitter: 0 });
    });
    for (const m of [this.darkGlass, this.litGlass]) {
      m.position.set(x, y, z);
      g.scene.add(m);
    }
    this.litGlass.visible = false;
    this.halo = haloSprite(0xffd890, 5.5);
    this.halo.position.set(x, y + h * 0.5, z);
    this.halo.visible = false;
    g.scene.add(this.halo);
    // Two shafts of light, back to back, tipped a little down toward the sea.
    this.beamMat = beamMaterial();
    const geo = new THREE.CylinderGeometry(0.45, 7, BEAM_LEN, 24, 1, true);
    geo.translate(0, -BEAM_LEN / 2, 0);
    geo.rotateZ(Math.PI / 2 - 0.075);
    this.beam = new THREE.Group();
    for (const a of [0, Math.PI]) {
      const m = new THREE.Mesh(geo, this.beamMat);
      m.rotation.y = a;
      m.frustumCulled = false;
      m.renderOrder = 5;
      this.beam.add(m);
    }
    this.beam.position.set(x, y + h * 0.5, z);
    this.beam.visible = false;
    g.scene.add(this.beam);
    this.lampLight = g.lights.add(x, y + h * 0.6, z, 0xffd27a, 9, 24, 0.04);
    this.sweepLight = g.lights.add(x, 2, z, 0xffe2a8, 7, 13, 0);
    for (const l of [this.lampLight, this.sweepLight]) {
      l.on = false;
      l.level = 0;
    }
    // What the lamp needs: the oil cask in the ship's hold, the lens on the sea floor.
    this.finds.push(new Find(OIL.x, OIL.z, g, (m) => {
      m.cyl(0, 0, 0, 0.3, 0.34, 0.4, 10, '#5a4228', { kind: K.Wood, cap: false });
      m.cyl(0, 0.4, 0, 0.34, 0.3, 0.4, 10, '#5a4228', { kind: K.Wood });
      for (const yy of [0.1, 0.68]) m.cyl(0, yy, 0, 0.33, 0.33, 0.05, 10, '#3a3a44', { kind: K.Metal, cap: false });
      m.box(0, 0.42, 0.32, 0.22, 0.22, 0.04, '#c8a040', { kind: K.Plain });
      m.beam([0, 0.2, 0.3], [0, 0.2, 0.45], 0.03, '#b8862e', { kind: K.Metal });
    }, 0xffc070, () => this.take(g, 'oil')));
    this.finds.push(new Find(LENS.x, LENS.z, g, (m, gl) => {
      // A panel of the lens: a brass frame, rings of glass, leaning on a stone.
      m.blob(0, 0.3, -0.5, 0.55, 0.42, 0.4, '#4c585e', 41, { kind: K.Rock, flatBottom: true });
      m.push().translate(0, 0.08, 0).rotateX(-1.0);
      m.box(0, 0, 0, 1.3, 0.08, 1.3, '#c8962e', { kind: K.Metal });
      for (const [rr, k] of [[0.56, 0], [0.42, 1], [0.28, 2], [0.13, 3]] as const) gl.cyl(0, 0.04 + k * 0.014, 0, rr, rr - 0.05, 0.03, 18, [1.3, 2.6, 3], { kind: 0 });
      m.pop();
    }, 0x9fe8ff, () => this.take(g, 'lens')));
    // The boats, waiting out past the reef.
    BOATS.forEach((d, k) => {
      const path: Pt[] = [d.wait, ...BOAT_WAY, [d.moor[0], d.moor[1]]], len = [0];
      for (let i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const group = boatModel(['#4a8a8c', '#b86a5c', '#c8b890'][k]);
      g.scene.add(group);
      const light = g.lights.add(d.wait[0], 1, d.wait[1], 0xffb060, 2.4, 6, 0.25);
      const b: Boat = { group, light, path, len, s: 0, rot: 2.6 + k * 0.7, moored: false, seed: k * 1.7 };
      this.boats.push(b);
      this.place(b, d.wait[0], d.wait[1], 0);
    });
  }

  /** The salvager is down (his suit taken, or felled): the isle is the keeper's again. */
  private salvagerDown(g: Game) {
    const i = g.realm.enemies.findIndex((s) => s.type === 'salvager');
    return !!g.save.data.flags.costume || (i >= 0 && g.save.data.killed.includes(i));
  }
  private wantsHome(g: Game) {
    return g.save.data.quests.lamp !== undefined && this.salvagerDown(g);
  }
  private setHome(g: Game, on: boolean) {
    this.home = on;
    g.npc('wick')!.visible = !on;
    g.npc('wickhome')!.visible = on;
  }

  /** The knight picks up the oil or the lens. */
  private take(g: Game, what: 'oil' | 'lens') {
    const f = g.save.data.flags;
    if (what === 'oil') f.lampOil = true;
    else f.lampLens = true;
    g.quest('lamp', 0);
    if (f.lampOil && f.lampLens) {
      g.ui.toast(what === 'oil' ? 'A cask of lamp oil' : "The lighthouse's lens", 'Oil and lens: take them up the lighthouse stair to the lamp.', 5);
      g.quest('lamp', 1);
    } else if (what === 'oil') g.ui.toast('A cask of lamp oil', 'The last whole one. The lamp wants its lens too: it lies in the sea east of the lighthouse rock.', 5);
    else g.ui.toast("The lighthouse's lens", 'Not a crack in it. The lamp wants oil too: in the sunken ship\'s hold.', 5);
    g.writeSave();
  }

  lampPrompt(g: Game) {
    const f = g.save.data.flags;
    if (f.lampLit) return null;
    if (f.lampOil && f.lampLens) return 'Light the lamp';
    return f.lampOil ? '!The lamp has oil, but its lens is gone' : f.lampLens ? '!The lens is back, but the lamp is dry' : '!The lamp is dry, and its lens is gone';
  }

  /** The knight lights the lamp: it blazes, the beam starts round, the boats turn for home. */
  light(g: Game) {
    const f = g.save.data.flags;
    if (f.lampLit) return;
    f.lampLit = true;
    g.quest('lamp', 2);
    g.audio.sfx('moonfire', LAMP.x, LAMP.z);
    g.fx.burst(P.spark, LAMP.x, LAMP.y + 0.5, LAMP.z, 40, 4, 3);
    g.fx.burst(P.ember, LAMP.x, LAMP.y + 0.6, LAMP.z, 20, 2, 2);
    g.pipe.flash = 0.35;
    g.pipe.flashColor.setRGB(1, 0.85, 0.55);
    g.shake(0.2);
    this.boatT = 0;
    g.ui.toast('The lighthouse burns', "Its beam sweeps the reef again, and out past the isle the fishers' boats turn for home.", 6);
    // The camera looks out to where the boats wait, then back.
    const w = this.boats[1];
    g.after(1.4, () => g.focus(w.group.position.x, 0.5, w.group.position.z, 3.6));
    g.writeSave();
  }

  /** Someone of the lighthouse's is spoken to (or the net-mender, who knows where the keeper sits): the
   *  lines to say, 'handled', or null (not one of these). */
  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled' | null {
    const id = n.def.id, f = g.save.data.flags, step = g.save.data.quests.lamp;
    if (id === 'ling') return [...lines, f.lampLit ? 'The lighthouse burns again, and every boat is home. Old Wick has not stopped grinning.' : 'Since the lighthouse went dark, three of our boats have not come home. Old Wick sits at the north edge of the shelf every night, staring at it.'];
    if (id === 'wick') {
      const down = this.salvagerDown(g);
      const said = f.lampLit
        ? ['You lit her! I saw the beam from here, sweeping the reef the way she used to.', 'I am going home. Come to the lighthouse: I owe you.']
        : [...(step === undefined ? lines : lines.slice(3)), down ? 'The salvager is gone from my isle? Then I am going home. Find me at the foot of my tower: the steps go up from the yard.' : 'And while that brass-bellied salvager holds my isle, I am staying here.'];
      g.ui.say(n.name, said, () => {
        g.talking = null;
        g.quest('lamp', 0);
        if (down) this.walkHome(g, n);
      });
      return 'handled';
    }
    if (id === 'wickhome') {
      if (f.lampLit && !f.lampPaid) {
        g.ui.say(n.name, [
          'Look at her! Look at her go round. And out there past the reef: the boats, turning for home.',
          'Forty years I kept her, and I never thought to see her lit by a knight. Take this: my storm lantern. It has burned through every gale I ever saw, and it will light the deep round you.',
        ], () => {
          g.talking = null;
          f.lampPaid = true;
          g.player.coins += 50;
          g.audio.sfx('coin');
          g.winRelic('stormlantern');
          g.ui.toast("The keeper's storm lantern", 'Relic: a light at your belt that shows the deep round you. And 50 coins.', 6);
          g.quest('lamp', 3);
          g.writeSave();
        });
        return 'handled';
      }
      if (f.lampPaid) return ['She has not missed a sweep since. Every boat on this coast can see her now.', 'Keep that lantern lit down there. The deep is no place to be in the dark.'];
      if (f.lampOil && f.lampLens) return ['That is my lens! Not a crack in it. And oil, good lamp oil.', 'Up the steps from the yard and round the tower to the gallery. Light her, knight. My knees will follow you up, one day.'];
      const need: string[] = [];
      if (!f.lampOil) need.push('Oil: the last casks went down in the hold of the ship the crew wrecked first, off the far rock east of here. Their floats run past it.');
      if (!f.lampLens) need.push('My lens: they threw it off the gallery into the sea, east of the rock. You have the salvager\'s suit. Walk in after it.');
      return [...lines, ...need];
    }
    return null;
  }

  /** The keeper gets up off his stool and wades off along the shore toward his isle. */
  private walkHome(g: Game, n: Npc) {
    if (this.home) return;
    n.walkTo = { x: 38.2, z: 56.8 };
    n.route = [{ x: 40, z: 55.6 }];
    g.after(3.2, () => this.setHome(g, true));
  }

  victoryLine(id: string): string | undefined {
    const L: Record<string, string> = {
      wick: 'Daylight on the sea, and I will keep her lit anyway. Habit.',
      wickhome: 'Daylight on the sea, and I will keep her lit anyway. Habit.',
      ness: 'The fish came back with the daylight. I told you there would be fish for you.',
    };
    return L[id];
  }

  tick(g: Game, dt: number) {
    if (!this.made) return;
    const f = g.save.data.flags, p = g.player;
    this.lay(g);
    for (const s of this.finds) s.update(dt, g);
    // Standing at the dark lamp, the knight learns what it needs.
    if (!f.lampLit && p.y > GALLERY_Y - 0.5 && Math.hypot(p.x - LIGHT.x, p.z - LIGHT.z) < 2.6 && g.save.data.quests.lamp === undefined) g.quest('lamp', 0);
    // Wick goes home (out of sight) once his quest is begun and the salvager is gone.
    if (!this.home && this.wantsHome(g)) {
      const wick = g.npc('wick')!, away = (x: number, z: number) => Math.hypot(p.x - x, p.z - z) > 18;
      if (away(wick.x, wick.z) && away(99.9, 33.1)) this.setHome(g, true);
    }
    // The lamp comes up, the beam goes round, its light sweeps the water.
    if (f.lampLit && this.glow < 1) this.glow = Math.min(1, this.glow + dt * 0.6);
    const on = this.glow > 0;
    this.darkGlass!.visible = this.glow < 0.3;
    this.litGlass!.visible = this.halo!.visible = this.beam!.visible = on;
    if (on) {
      const k = this.glow * this.glow, a = g.time * SWEEP;
      this.beamMat!.uniforms.uOn.value = k;
      this.beam!.rotation.y = -a;
      this.halo!.material.opacity = k * (0.85 + 0.15 * Math.sin(g.time * 3.1));
      for (const l of [this.lampLight!, this.sweepLight!]) {
        l.on = true;
        l.level = k;
      }
      // (The pool of light where the nearer beam meets the water.)
      const d = 11;
      this.sweepLight!.x = LIGHT.x + Math.cos(a) * d;
      this.sweepLight!.z = LIGHT.z + Math.sin(a) * d;
    }
    this.sailBoats(g, dt);
    // The keeper's storm lantern: a light at the knight's belt, brighter under the water.
    if (g.save.data.relics.includes('stormlantern')) {
      if (!this.lantern) this.lantern = g.lights.add(p.x, p.y + 1, p.z, 0xffd090, 3, 7, 0.15);
      const l = this.lantern;
      l.x = p.x + p.fx * 0.3;
      l.y = p.y + 1.1;
      l.z = p.z + p.fz * 0.3;
      l.intensity = p.under ? 6 : 2.5;
      l.range = p.under ? 10 : 6;
    }
  }

  // ---------- the boats ----------

  private place(b: Boat, x: number, z: number, rot: number) {
    b.group.position.set(x, -0.18, z);
    b.group.rotation.y = rot;
    b.light.x = x - Math.cos(rot) * 1.05;
    b.light.z = z + Math.sin(rot) * 1.05;
    b.light.y = 1.1;
  }
  private moor(b: Boat) {
    const k = this.boats.indexOf(b), m = BOATS[k].moor;
    b.moored = true;
    b.s = b.len[b.len.length - 1];
    b.rot = m[2];
    this.place(b, m[0], m[1], m[2]);
  }
  private sailBoats(g: Game, dt: number) {
    const going = this.boatT >= 0;
    if (going) this.boatT += dt;
    let home = 0;
    this.boats.forEach((b, k) => {
      const bob = Math.sin(g.time * 1.3 + b.seed) * 0.06;
      if (b.moored || !going || this.boatT < k * BOAT_GAP) {
        if (!b.moored) {
          // Waiting out past the reef for the light: drifting, turning slowly.
          b.rot += Math.sin(g.time * 0.2 + b.seed) * dt * 0.05;
          this.place(b, b.path[0][0], b.path[0][1], b.rot);
        }
        b.group.position.y = -0.18 + bob;
        b.group.rotation.z = Math.sin(g.time * 0.9 + b.seed) * 0.04;
        if (b.moored) home++;
        return;
      }
      b.s += BOAT_SPEED * dt;
      const end = b.len[b.len.length - 1];
      if (b.s >= end) {
        this.moor(b);
        home++;
        return;
      }
      let i = 1;
      while (i < b.len.length - 1 && b.len[i] < b.s) i++;
      const [ax, az] = b.path[i - 1], [cx, cz] = b.path[i], t = (b.s - b.len[i - 1]) / (b.len[i] - b.len[i - 1]);
      const want = -Math.atan2(cz - az, cx - ax);
      let dr = want - b.rot;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      b.rot += dr * Math.min(1, dt * 1.5);
      this.place(b, ax + (cx - ax) * t, az + (cz - az) * t, b.rot);
      b.group.position.y = -0.18 + bob;
      b.group.rotation.z = Math.sin(g.time * 0.9 + b.seed) * 0.05;
    });
    // All three home: the fisher comes up from the jetty.
    if (home === this.boats.length && going && !g.npc('ness')!.visible) {
      g.npc('ness')!.visible = true;
      g.ui.toast('The boats are home', 'All three, moored at the end of the village jetty.', 4);
    }
  }

  // ---------- the stair and the gallery underfoot ----------

  /**
   * One height a cell can't hold a stair that passes over itself, so the stair's and the gallery's
   * surfaces are laid into the decks of the cells round the knight each frame: for each, the highest
   * surface he can step onto from where he stands (else the lowest, a wall), measured at the cell's
   * nearest point to him, so that the steps run on smoothly from one cell to the next. Under the stair's
   * lowest steps (built solid to the rock) the rock isn't there to stand on. Cells left behind get back
   * what they held.
   */
  private lay(g: Game) {
    const p = g.player, grid = g.grid, frame = ++this.frame;
    const near = !g.flying && !p.riding && Math.hypot(p.x - LIGHT.x, p.z - LIGHT.z) < STAIR.out + 2.5;
    if (near) {
      const reach = p.y + PLAYER.stepUp + 0.05, fx = Math.floor(p.x), fz = Math.floor(p.z);
      for (let cz = fz - 2; cz <= fz + 2; cz++)
        for (let cx = fx - 2; cx <= fx + 2; cx++) {
          const px = Math.max(cx, Math.min(cx + 1, p.x)), pz = Math.max(cz, Math.min(cz + 1, p.z));
          const firm = lighthouseTops(px, pz, this.tops);
          if (!this.tops.length) continue;
          const i = grid.i(cx, cz);
          if (!this.cells.has(i)) this.cells.set(i, grid.deck[i]);
          this.stamp.set(i, frame);
          const own = this.cells.get(i)!, ground = grid.h[i], bare = !(firm && ground >= ROCK_Y - 0.1);
          let best = bare && ground <= reach ? ground : -Infinity;
          for (const t of this.tops) if (t <= reach && t > best) best = t;
          // (A wall at the lowest; where the bare rock under the stair is lower than that, the rock itself: else a
          // foe standing there, Brassbelly on the steps from his yard, is lifted onto a turn of the stair high above.)
          if (best === -Infinity) best = bare ? Math.min(ground, this.tops[0]) : this.tops[0];
          grid.deck[i] = bare && best === ground ? own : best;
        }
    }
    for (const [i, own] of this.cells)
      if (this.stamp.get(i) !== frame) {
        grid.deck[i] = own;
        this.cells.delete(i);
        this.stamp.delete(i);
      }
  }
}
