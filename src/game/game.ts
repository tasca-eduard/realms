import * as THREE from 'three';
import { MOBILE, VIEW, WORLD } from '../config';
import { Pipeline } from '../engine/pipeline';
import { IsoCamera } from '../engine/camera';
import { Input } from '../engine/input';
import { LightPool } from '../engine/lights';
import { Particles, P } from '../engine/particles';
import { shared, worldMaterial } from '../engine/materials';
import { SpriteActor } from '../engine/sprites';
import { clamp, damp, lerp, mulberry32 } from '../engine/util';
import { Audio } from '../audio/audio';
import { UI, type DialogOption } from '../ui/ui';
import { Screens } from '../ui/screens';
import { TouchControls } from '../ui/touch';
import { Grid, T } from '../world/grid';
import { Builder, type Structure } from '../world/builder';
import { buildTerrain, buildWater } from '../world/terrain';
import { decorateOutskirts, paintOutskirts } from '../world/outskirts';
import { buildGrass } from '../world/grass';
import { buildRealm1, MAP_D, MAP_W, type RealmData, type RegionDef } from '../world/realm1';
import { ALERT_FRAME, type Assets } from './assets';
import { Player, POWERS, type PowerKind } from './player';
import { Enemy } from './enemies';
import { Combat, type Arrow, type Pickup, type Wave } from './combat';
import { Breakable, Cage, Chest, CrackedWall, Drawbridge, HallDoor, Lever, LoreStone, Moonfire, Npc, Shard, Sign, Windmill, type Interactable } from './objects';
import { Save } from './save';
import { FogOfWar } from './fow';
import { Mount } from './mount';
import { Trial } from './trial';
import { ArrowSlit, Chandelier } from './hazards';
import { Critter } from './critters';
import { QUESTS, questDef, questDone } from './quests';
import { reachability } from './reach';
import { makeArcher, makeBat, makeBoar, makeGoblin, makeKing, makeKnight, makeVillager, type Model } from './models';

type GameState = 'loading' | 'title' | 'story' | 'play' | 'dead' | 'victory';

const STORY = [
  'The eight realms lived in peace beneath the moon.',
  'Then the shadow came, and one by one the realms fell, each to its own tyrant.',
  'In the Moonlit Keep, a goblin sits on a stolen throne, and the village below keeps its doors barred at night.',
  'One knight still stands.',
];

const SWOOSH_VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SWOOSH_FRAG = /* glsl */ `
uniform float uStart, uLen, uProg, uAlpha, uIn, uOut; uniform vec3 uColor;
varying vec2 vP;
void main() {
  float a = atan(vP.y, vP.x);
  float t = mod(a - uStart + 6.28318, 6.28318) / uLen;
  if (t > 1.0) discard;
  float head = uProg;
  float d = head - t;
  if (d < 0.0 || d > 0.55) discard;
  float r = (length(vP) - uIn) / (uOut - uIn);
  float k = (1.0 - d / 0.55);
  k *= r * r;
  if (k < 0.12) discard;
  k = k > 0.5 ? 1.0 : 0.55;
  gl_FragColor = vec4(uColor * k * uAlpha, 1.0);
}
`;

interface Swoosh {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  t: number;
  dur: number;
}

export class Game {
  pipe: Pipeline;
  cam = new IsoCamera();
  scene = new THREE.Scene();
  input: Input;
  audio = new Audio();
  ui: UI;
  screens: Screens;
  touch: TouchControls;
  save = new Save();
  grid: Grid;
  lights = new LightPool(MOBILE ? 10 : 16);
  fx = new Particles();
  realm: RealmData;
  player: Player;
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  moonfires: Moonfire[] = [];
  chests: Chest[] = [];
  breakables: Breakable[] = [];
  crackedWalls: CrackedWall[] = [];
  shards: Shard[] = [];
  slits: ArrowSlit[] = [];
  critters: Critter[] = [];
  chandeliers: Chandelier[] = [];
  private chandelierCd = 0;
  /** Hits landed in a row; coins from kills are multiplied while it lasts. */
  comboCount = 0;
  comboT = 0;
  interactables: Interactable[] = [];
  structures: Structure[] = [];
  lever!: Lever;
  bridge!: Drawbridge;
  cage!: Cage;
  hallDoor!: HallDoor;
  windmill!: Windmill;
  horse!: Mount;
  trial!: Trial;
  combat: Combat;
  fow: FogOfWar;
  moon: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  time = 0;
  state: GameState = 'loading';
  paused = false;
  hitstopT = 0;
  slowT = 0;
  slowScale = 1;
  mouseGround: THREE.Vector3 | null = null;
  region: RegionDef | null = null;
  talking: Npc | null = null;
  victory = false;
  dawn = 0;
  boss: Enemy | null = null;
  bossActive = false;
  cutscene: { t: number; dur: number; x: number; y: number; z: number; onEnd?: () => void } | null = null;
  godMode = false;
  settings = { shake: true, hints: true, lines: 360 };
  private swooshes: Swoosh[] = [];
  private alerts: { s: SpriteActor; e: Enemy; t: number }[] = [];
  private focusTarget = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private ambT = 0;
  private ambCache = { water: 0, fire: 0 };
  private deadT = 0;
  private titleT = 0;
  private hintsShown = new Set<string>();
  private padHeld = false;
  private campCleared = false;
  private debug = new URLSearchParams(location.search).has('debug');
  private tutorialT = 0;
  private victoryT = 0;
  kills = 0;

  constructor(public assets: Assets, view: HTMLElement, uiRoot: HTMLElement) {
    this.pipe = new Pipeline(view);
    this.input = new Input(this.pipe.renderer.domElement);
    this.ui = new UI(uiRoot);
    this.ui.tipsOn = () => this.settings.hints;
    this.ui.blip = () => this.audio.sfx('blip');
    try {
      const s = JSON.parse(localStorage.getItem('realms-settings') || 'null');
      if (s) Object.assign(this.settings, s);
    } catch {
      /* ignore */
    }
    this.screens = new Screens(uiRoot, this.audio, this.settings, () => {
      try {
        localStorage.setItem('realms-settings', JSON.stringify(this.settings));
      } catch {
        /* ignore */
      }
    });
    this.touch = new TouchControls(uiRoot, this.input);
    this.touch.onPause = () => this.setPaused(!this.paused);
    this.screens.onPauseAction((a) => {
      if (a === 'resume') this.setPaused(false);
      if (a === 'title') location.reload();
    });

    // ---------- world ----------
    // The grid reaches PAD cells past the realm on every side: that land is real
    // terrain, closed off by cliffs, the gorge, the river and the lake.
    const PAD = 26;
    this.grid = new Grid(MAP_W + PAD * 2, MAP_D + PAD * 2, -PAD, -PAD);
    const builder = new Builder(this.grid, this.lights, this.fx, mulberry32(7), WORLD.chunk);
    this.realm = buildRealm1(builder);
    paintOutskirts(this.grid, MAP_W, MAP_D);
    this.realm.afterOutskirts(this.grid, builder);
    decorateOutskirts(builder, this.grid, MAP_W, MAP_D, mulberry32(99));
    this.fow = new FogOfWar(MAP_W, MAP_D, PAD);
    this.pipe.fow = { tex: this.fow.tex, x: this.fow.originX, z: this.fow.originZ, size: this.fow.worldSize, amount: 0 };
    builder.finish(this.scene);
    this.structures = builder.structures;
    const outside = (x: number, z: number) => x < 0 || z < 0 || x >= MAP_W || z >= MAP_D;
    this.scene.add(buildTerrain(this.grid, WORLD.chunk, worldMaterial()));
    this.scene.add(buildWater(this.grid));
    this.scene.add(buildGrass(this.grid, (x, z) => this.realm.grassDensity(x, z) * (MOBILE ? 0.5 : 1) * (outside(x, z) ? 0.6 : 1), (x, z) => this.realm.grassScale(x, z)));
    this.scene.add(this.lights.group, this.fx.group);

    this.moon = new THREE.DirectionalLight(0x8fa6ff, 2.0);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
    const sc = this.moon.shadow.camera;
    sc.left = -28;
    sc.right = 28;
    sc.top = 28;
    sc.bottom = -28;
    sc.near = 1;
    sc.far = 140;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.03;
    this.scene.add(this.moon, this.moon.target);
    this.hemi = new THREE.HemisphereLight(0x3c4c80, 0x1a1422, 1.0);
    this.scene.add(this.hemi);

    this.combat = new Combat(this);
    this.player = new Player();
    this.player.rig.addTo(this.scene);

    // Objects.
    for (const o of this.realm.objects) {
      switch (o.kind) {
        case 'moonfire': {
          const m = new Moonfire(o.id, o.name, o.x, o.z, this);
          this.moonfires.push(m);
          this.interactables.push(m);
          if (o.id === 'hearth') m.setLit(true, this);
          break;
        }
        case 'chest': {
          const c = new Chest(o.id, o.x, o.z, o.rot, o.coins, this);
          c.power = o.power;
          this.chests.push(c);
          this.interactables.push(c);
          break;
        }
        case 'lore':
          this.interactables.push(new LoreStone(o.id, o.x, o.z, o.text, this));
          break;
        case 'sign':
          this.interactables.push(new Sign(o.x, o.z, o.text, this));
          break;
        case 'lever':
          this.lever = new Lever(o.id, o.x, o.z, this);
          this.interactables.push(this.lever);
          break;
        case 'drawbridge':
          this.bridge = new Drawbridge(o.x0, o.z0, o.x1, o.z1, o.deck, this);
          break;
        case 'cage':
          this.cage = new Cage(o.x, o.z, this);
          break;
        case 'hallDoor':
          this.hallDoor = new HallDoor(o.x, o.z, o.y, this);
          break;
        case 'breakable':
          this.breakables.push(new Breakable(o.x, o.z, o.what, this));
          break;
        case 'windmill':
          this.windmill = new Windmill(o.x, o.z, this);
          break;
        case 'shard':
          this.shards.push(new Shard(o.id, o.x, o.z, this));
          break;
        case 'cracked': {
          const w = new CrackedWall(o.id, o.x, o.z, o.alongX, this);
          this.crackedWalls.push(w);
          this.interactables.push(w);
          break;
        }
      }
    }
    // Arrow slits in the keep's towers, and the hall's chandeliers.
    for (const [x, y, z] of [[44.4, 7.2, 9.6], [44.4, 7.2, 38.4], [15.6, 7.2, 38.4], [47.9, 6.6, 20.5], [47.9, 6.6, 28.5]]) this.slits.push(new ArrowSlit(x, y, z, this));
    for (const cx of [24, 28.5]) this.chandeliers.push(new Chandelier(cx, 18.5, 4, this));
    // The Seven Stones' altar.
    this.trial = new Trial(this.realm.trial.x, this.realm.trial.z, this);
    this.interactables.push(this.trial);
    for (const c of this.realm.critters) this.critters.push(new Critter(c, this));
    // The warhorse waits by the King's Road.
    this.horse = new Mount(this.realm.horse.x, this.realm.horse.z, this);
    this.interactables.push(this.horse);
    for (const d of this.realm.npcs) {
      const n = new Npc(d, this);
      if (d.id === 'brother') n.visible = true;
      this.npcs.push(n);
      this.interactables.push(n);
    }
    this.spawnEnemies();

    window.addEventListener('resize', () => this.pipe.resize());
    const saveNow = () => {
      if ((this.state === 'play' || this.state === 'victory') && this.save.exists) this.writeSave();
    };
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow());
    (window as unknown as { __game: Game }).__game = this;
    (window as unknown as { __reach: (p?: boolean) => unknown }).__reach = (progress = true) => reachability(this, progress);
  }

  private spawnEnemies() {
    for (const e of this.enemies) e.model.rig.removeFrom(this.scene);
    this.enemies = [];
    this.realm.enemies.forEach((s, id) => {
      if (this.save.data.killed.includes(id)) return;
      if (s.group === 'courtyard' && this.save.data.courtyard) return;
      if (s.group === 'boss' && this.save.data.boss) return;
      const e = new Enemy(s.type, s.x, s.z, this, s.group, s.guard, s.elite);
      e.spawnId = id;
      e.model.rig.addTo(this.scene);
      this.enemies.push(e);
      if (s.type === 'king') this.boss = e;
    });
  }

  get controlsEnabled() {
    return this.state === 'play' && !this.paused && !this.ui.dialogOpen && !this.ui.loreOpen && !this.cutscene && this.player.state !== 'rest';
  }

  // ---------- flow ----------

  start() {
    this.save.load();
    this.applySave();
    this.state = 'title';
    this.screens.hideLoading();
    const items: { label: string; act: () => void }[] = [];
    if (this.save.exists) items.push({ label: 'Continue', act: () => this.beginPlay(false) });
    items.push({
      label: this.save.exists ? 'New journey' : 'Begin',
      act: () => {
        if (this.save.exists) {
          this.save.reset();
          location.search.includes('shot') ? this.beginPlay(true) : (localStorage.setItem('realms-new', '1'), location.reload());
          return;
        }
        this.beginPlay(true);
      },
    });
    this.screens.showTitle(items);
    this.ui.hudVisible(false);
    try {
      if (localStorage.getItem('realms-new')) {
        localStorage.removeItem('realms-new');
        this.screens.hideTitle();
        this.beginPlay(true);
      }
    } catch {
      /* ignore */
    }
    // Test shortcuts: ?play skips menus, &at=x,z places the knight, &dawn shows the ending light.
    const q = new URLSearchParams(location.search);
    if (q.has('play')) {
      this.screens.hideTitle();
      this.enterWorld();
      const at = q.get('at');
      if (at) {
        const [x, z] = at.split(',').map(Number);
        this.player.place(x, z, this);
        this.cam.focus.set(x, this.player.y, z);
      }
      if (q.has('dawn')) this.setDawn(1);
      if (q.has('viewer')) this.viewer(q.get('anim') ?? 'idle', q.get('t'));
      if (q.has('god')) this.godMode = true;
    }
    this.audio.unlock();
    const tick = (now: number) => {
      this.frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private beginPlay(fresh: boolean) {
    this.audio.unlock();
    if (this.input.usingTouch || matchMedia('(pointer: coarse)').matches) {
      const d = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      Promise.resolve(d.requestFullscreen?.() ?? d.webkitRequestFullscreen?.())
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
        .catch(() => {});
    }
    this.screens.hideTitle();
    if (fresh) {
      this.state = 'story';
      this.screens.showStory(STORY, () => {
        this.enterWorld();
        this.ui.hint(this.input.usingTouch ? 'Left thumb moves. Shield button: tap to roll, hold to block.' : '<kbd>WASD</kbd>move &nbsp; <kbd>Mouse</kbd>aim &nbsp; <kbd>Left click</kbd>attack &nbsp; <kbd>Right click</kbd>tap roll, hold block &nbsp; <kbd>Space</kbd>jump', 9);
      });
    } else this.enterWorld();
  }

  private enterWorld() {
    this.state = 'play';
    const cp = this.moonfires.find((m) => m.id === this.save.data.checkpoint);
    if (this.save.data.checkpoint === 'wayshrine' && !this.save.data.lit.includes('wayshrine')) this.player.place(this.realm.start.x, this.realm.start.z, this);
    else if (cp) this.player.place(cp.x + 1.3, cp.z + 1.3, this);
    this.player.rig.face(-0.7, -0.7, 0);
    this.player.fx = -0.7;
    this.player.fz = -0.7;
    this.cam.focus.set(this.player.x, this.player.y, this.player.z);
    this.ui.hudVisible(true);
    this.region = null;
    this.tutorialT = 0;
    if (this.save.data.quests.main === undefined) this.quest('main', 0);
    this.refreshQuests();
  }

  private applySave() {
    const d = this.save.data;
    if (d.fow) this.fow.load(d.fow);
    this.player.coins = d.coins;
    this.player.flasksMax = d.flasksMax;
    this.player.flasks = d.flasksMax;
    this.player.swordLevel = d.sword;
    this.player.crest = d.relic;
    this.player.maxHp = 5 + (d.shards.length >= 3 ? 1 : 0);
    this.player.hp = this.player.maxHp;
    for (const s of this.shards) if (d.shards.includes(s.id)) s.remove(this);
    for (const w of this.crackedWalls) if (d.walls.includes(w.id)) w.smash(this, true);
    for (const c of this.chests) if (d.chests.includes(c.id)) c.setOpen(true);
    for (const m of this.moonfires) if (d.lit.includes(m.id)) m.setLit(true, this);
    if (d.bridge) {
      this.lever.setPulled();
      this.bridge.lower(this, true);
    }
    if (d.rescued) {
      this.cage.breakOpen(this, true);
      this.npc('brother')!.visible = false;
      this.npc('tamhome')!.visible = true;
    }
    if (d.courtyard) this.hallDoor.setOpen(true, this, true);
    if (d.boss) this.setDawn(1);
    this.spawnEnemies();
  }

  private writeSave() {
    this.save.data.fow = this.fow.serialize();
    this.save.data.coins = this.player.coins;
    this.save.data.flasksMax = this.player.flasksMax;
    this.save.data.sword = this.player.swordLevel;
    this.save.write();
  }

  npc(id: string) {
    return this.npcs.find((n) => n.def.id === id);
  }

  setPaused(on: boolean) {
    this.paused = on;
    this.screens.setPause(on);
    this.audio.setMuffle(on ? 700 : 20000);
  }

  // ---------- helpers used by entities ----------

  hitstop(t: number) {
    this.hitstopT = Math.max(this.hitstopT, t);
  }
  shake(a: number) {
    if (this.settings.shake) this.cam.shake(a);
  }
  slowmo(scale: number, t: number) {
    this.slowScale = scale;
    this.slowT = t;
  }

  footstep(x: number, z: number) {
    const t = this.grid.typeAt(x, z);
    const w = this.grid.waterAt(x, z);
    const surf = w > -100 && this.grid.deck[this.grid.i(Math.floor(x), Math.floor(z))] < -100 ? 'water' : t === T.Wood || this.grid.deck[this.grid.i(Math.floor(x), Math.floor(z))] > -100 ? 'wood' : t === T.Cobble || t === T.Flag || t === T.Floor || t === T.Rock ? 'stone' : 'soft';
    this.audio.sfx('step-' + surf);
    if (Math.random() < 0.35) this.fx.emit(P.dust, x, this.player.y + 0.05, z, 0, 0.2, 0);
  }

  // ---------- quests ----------

  /** Move a quest to a step (never backwards). */
  quest(id: string, step: number) {
    const q = this.save.data.quests;
    const cur = q[id];
    if (cur !== undefined && cur >= step) return;
    q[id] = step;
    const def = questDef(id);
    if (cur === undefined && !questDone(id, step)) this.ui.questNote('New quest', def.title);
    else if (questDone(id, step)) {
      this.ui.questNote('Quest complete', def.title);
      this.audio.sfx('rune');
    } else this.ui.questNote('Quest updated', def.title);
    this.refreshQuests();
    this.writeSave();
  }

  refreshQuests() {
    const q = this.save.data.quests;
    const main = q.main;
    const def = questDef('main');
    this.ui.objective(main !== undefined && !questDone('main', main) ? def.short![main] : null);
    const shardsFound = this.save.data.shards.length;
    const rows = QUESTS.filter((d) => q[d.id] !== undefined).map((d) => {
      const s = q[d.id];
      const done = questDone(d.id, s);
      let text = d.steps[s];
      if (d.id === 'shards' && !done) text += ` (${shardsFound}/3 found)`;
      return `<div class="quest${done ? ' done' : ''}${d.main ? ' main' : ''}"><b>${d.title}</b><span>${text}</span></div>`;
    });
    this.screens.setJournal(rows.length ? rows.join('') : '<div class="quest"><span>Nothing yet.</span></div>');
  }

  /** Inside a building the warhorse cannot enter. */
  insideStructure(x: number, z: number, y: number) {
    for (const s of this.structures) {
      if (!s.interior) continue;
      const [x0, z0, x1, z1] = s.interior;
      if (x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3 && y > (s.interiorY ?? 0) - 1 && y < (s.interiorY ?? 0) + 4) return true;
    }
    return false;
  }

  /** Floating text over someone's head. */
  pop(at: { x: number; y: number; z: number }, text: string, color = '#ebe8f7') {
    const s = { x: 0, y: 0 };
    this.cam.toScreen(new THREE.Vector3(at.x, at.y + 2.1, at.z), s);
    this.ui.pop(text, s.x, s.y, color);
  }

  get comboMult() {
    return this.comboCount >= 15 ? 4 : this.comboCount >= 10 ? 3 : this.comboCount >= 5 ? 2 : 1;
  }

  /** A hit landed on a foe: the combo grows. */
  landed(_e: Enemy, _heavy: boolean) {
    this.comboCount++;
    this.comboT = 2.5 + this.player.swordLevel * 0.2;
    this.ui.combo(this.comboCount, this.comboMult);
  }

  /** The knight's plunge lands: a ring of force. */
  playerShockwave(x: number, y: number, z: number) {
    this.audio.sfx('boom', x, z);
    this.shake(0.6);
    this.hitstop(0.08);
    this.fx.burst(P.puff, x, y + 0.2, z, 14, 4);
    this.fx.burst(P.bluespark, x, y + 0.3, z, 24, 5, 2);
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 3.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.08, z);
    this.scene.add(mesh);
    let r = 0.4;
    const grow = () => {
      r += 0.35;
      mesh.scale.set(r, r, 1);
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - r / 3);
      if (r < 3) requestAnimationFrame(grow);
      else {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    };
    grow();
  }

  takeShard(s: Shard) {
    s.remove(this);
    if (!this.save.data.shards.includes(s.id)) this.save.data.shards.push(s.id);
    const n = this.save.data.shards.length;
    this.audio.sfx('rune');
    this.fx.burst(P.bluespark, s.x, s.y, s.z, 30, 3, 3);
    this.pipe.flash = 0.2;
    this.pipe.flashColor.setRGB(0.6, 0.8, 1);
    this.quest('shards', 0);
    if (n >= 3) {
      this.player.maxHp = 6;
      this.player.hp = this.player.maxHp;
      this.ui.pulseHearts();
      this.ui.toast('The moon is whole again', 'Three shards: +1 heart', 4);
      this.quest('shards', 1);
    } else this.ui.toast(`Moon Shard ${n} of 3`, 'Find all three to strengthen your heart');
    this.refreshQuests();
    this.writeSave();
  }

  breakWall(w: CrackedWall) {
    w.smash(this);
    this.audio.sfx('shieldBreak', w.x, w.z);
    this.shake(0.6);
    this.hitstop(0.1);
    this.ui.toast('A hidden passage!');
    if (!this.save.data.walls.includes(w.id)) this.save.data.walls.push(w.id);
    this.writeSave();
  }

  /** Clear line between two points at height y, stopping short of the target itself. */
  clearBetween(ax: number, az: number, bx: number, bz: number, y: number, short = 0.55) {
    const d = Math.hypot(bx - ax, bz - az);
    if (d <= short + 0.3) return true;
    const k = (d - short) / d;
    return this.grid.lineClear(ax, az, ax + (bx - ax) * k, az + (bz - az) * k, y);
  }

  enemiesNear(x: number, z: number, r: number) {
    return this.enemies.some((e) => e.alive && e.state !== 'idle' && e.state !== 'sleep' && e.state !== 'return' && Math.hypot(e.x - x, e.z - z) < r);
  }

  alert(e: Enemy) {
    this.audio.sfx('alert', e.x, e.z);
    const s = new SpriteActor(this.assets.pickups, { glow: 1.2 });
    s.mesh.castShadow = false;
    s.shadow.visible = false;
    this.scene.add(s.mesh);
    this.alerts.push({ s, e, t: 0 });
    if (!this.hintsShown.has('fight') && this.settings.hints) {
      this.hintsShown.add('fight');
      this.ui.hint(this.input.usingTouch ? 'Enemies flash before they strike. Tap the shield to roll through, hold it to block.' : 'Enemies flash before they strike. Tap <kbd>Right click</kbd> to roll through, hold it to block', 7);
    }
  }

  aimLine(e: Enemy) {
    this.combat.aim(e);
  }

  shootArrow(e: Enemy, x: number, y: number, z: number) {
    this.combat.shoot(e, x, y, z);
  }

  swoosh(p: Player, i: number) {
    if (i >= 3) return this.spinSwoosh(p, i === 4);
    const finisher = i === 2;
    const inner = finisher ? 1.0 : 0.95, outer = finisher ? 2.0 : 1.8;
    const geo = new THREE.RingGeometry(inner, outer, 36, 1);
    const yaw = Math.atan2(p.fx, p.fz);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SWOOSH_VERT,
      fragmentShader: SWOOSH_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uStart: { value: 0 }, uLen: { value: 2.6 }, uProg: { value: 0 }, uAlpha: { value: 1 },
        uIn: { value: inner }, uOut: { value: outer }, uColor: { value: new THREE.Color(0.9, 1.05, 1.5) },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 6;
    if (finisher) {
      // Vertical arc in the facing plane, from overhead down to the ground ahead.
      mesh.rotation.set(0, yaw - Math.PI / 2, 0);
      mesh.position.set(p.x, p.y + 1.3, p.z);
      mat.uniforms.uStart.value = -0.75;
      mat.uniforms.uLen.value = 2.6;
    } else {
      mesh.rotation.set(-Math.PI / 2, 0, 0);
      mesh.position.set(p.x, p.y + 1.15, p.z);
      mat.uniforms.uStart.value = yaw - 1.45 - Math.PI / 2;
      mat.uniforms.uLen.value = 2.7;
    }
    this.scene.add(mesh);
    this.swooshes.push({ mesh, mat, t: finisher ? -0.14 : -0.09, dur: 0.2 });
    // A finisher arc sweeps from overhead: flip progress direction by mirroring.
    if (finisher) mesh.scale.set(1, -1, 1);
    else if (i === 1) mesh.scale.set(1, -1, 1), (mat.uniforms.uStart.value = -(yaw + 1.3 - Math.PI / 2));
  }

  private spinSwoosh(p: Player, full: boolean) {
    const inner = full ? 1.5 : 1.2, outer = full ? 2.5 : 2.0;
    const geo = new THREE.RingGeometry(inner, outer, 48, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SWOOSH_VERT,
      fragmentShader: SWOOSH_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uStart: { value: 0 }, uLen: { value: Math.PI * 2 }, uProg: { value: 0 }, uAlpha: { value: 1 },
        uIn: { value: inner }, uOut: { value: outer },
        uColor: { value: full ? new THREE.Color(0.6, 1.4, 2.2) : new THREE.Color(1.3, 1.1, 0.6) },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 6;
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.position.set(p.x, p.y + 1.0, p.z);
    this.scene.add(mesh);
    this.swooshes.push({ mesh, mat, t: -0.02, dur: full ? 0.45 : 0.25 });
  }

  enemyHitsPlayer(e: Enemy, dmg: number, opts: { kb?: number; unblockable?: boolean } = {}) {
    const res = this.player.hurt(dmg, e.x, e.z, this, opts);
    this.afterPlayerHit(res, e.x, e.z, e);
    return res;
  }

  arrowHitsPlayer(a: Arrow) {
    const res = this.player.hurt(1, a.x - a.vx, a.z - a.vz, this, { kb: 4 });
    this.afterPlayerHit(res, a.x, a.z, null);
    return res;
  }

  waveHitsPlayer(w: Wave) {
    if (!this.player.onGround) return;
    const res = this.player.hurt(1, w.x, w.z, this, { unblockable: true, kb: 9 });
    this.afterPlayerHit(res, w.x, w.z, null);
  }

  private afterPlayerHit(res: string, x: number, z: number, e: Enemy | null) {
    const p = this.player;
    if (res === 'bubbled') {
      this.audio.sfx('parry', p.x, p.z);
      this.pop(p, p.power ? 'bubble!' : 'bubble burst', '#5ad1ff');
      this.fx.burst(P.bluespark, p.x, p.y + 1, p.z, 16, 3, 2);
    }
    if (res === 'hit') {
      this.comboCount = 0;
      this.ui.combo(0, 1);
      this.audio.sfx('hurt');
      this.shake(0.6);
      this.hitstop(0.08);
      this.ui.hurtFlash();
      this.fx.burst(P.spark, p.x, p.y + 1, p.z, 10, 3, 2);
      if (p.hp <= 0) this.onPlayerDeath();
    } else if (res === 'blocked') {
      this.audio.sfx('clang', x, z);
      this.fx.burst(P.spark, p.x + p.fx * 0.4, p.y + 1.0, p.z + p.fz * 0.4, 12, 4, 2);
      this.shake(0.25);
    } else if (res === 'parried') {
      this.audio.sfx('parry', x, z);
      this.fx.burst(P.bluespark, p.x + p.fx * 0.5, p.y + 1.1, p.z + p.fz * 0.5, 26, 6, 3);
      this.slowmo(0.25, 0.35);
      this.pipe.flash = 0.25;
      this.pipe.flashColor.setRGB(0.6, 0.8, 1);
      this.shake(0.3);
      if (e && e.type !== 'king') e.parried(this);
      else if (e && e.type === 'king' && e.state === 'charge') e.parried(this);
      if (!this.hintsShown.has('parry')) {
        this.hintsShown.add('parry');
        this.ui.toast('Parry!', 'The foe is stunned and takes extra damage');
      }
    }
  }

  onEnemyDeath(e: Enemy) {
    this.kills++;
    if (e.spawnId !== undefined && !this.save.data.killed.includes(e.spawnId)) this.save.data.killed.push(e.spawnId);
    this.audio.sfx('enemyDie', e.x, e.z);
    this.fx.burst(P.puff, e.x, e.y + 0.5, e.z, 8, 2);
    if (e.type !== 'king') {
      const n = e.coinDrop * this.comboMult;
      if (n) this.combat.coins(e.x, e.y + 0.5, e.z, n);
      if (this.comboMult > 1) this.pop(e, `x${this.comboMult} coins`, '#feae34');
      if (Math.random() < 0.12 && this.player.hp < this.player.maxHp) this.combat.spawnPickup('heart', e.x, e.y + 0.5, e.z);
      if (e.elite) {
        this.combat.powerOrb(e.x, e.y + 0.8, e.z);
        this.pop(e, 'ELITE DEFEATED', '#feae34');
        this.audio.sfx('victory');
      }
      if (e.golden) this.pop(e, 'golden!', '#feae34');
    }
    if (e.type === 'king') this.onBossDeath(e);
    // Group clears.
    if (e.group === 'courtyard' && !this.enemies.some((o) => o.alive && o.group === 'courtyard')) {
      this.save.data.courtyard = true;
      this.quest('main', 4);
      this.writeSave();
      this.after(1.2, () => {
        this.hallDoor.setOpen(true, this);
        this.focus(34.5, 5, 18.5, 3.2);
        this.ui.toast('The hall doors groan open', 'The Goblin King waits within');
      });
    }
    if (e.group === 'lodge' && e.elite) this.quest('lodge', 1);
    if (e.group === 'farm' && !this.enemies.some((o) => o.alive && o.group === 'farm')) {
      this.ui.toast('The raiders are gone', 'The Old Warden will want to hear');
      this.quest('farm', 1);
    }
    if (e.group === 'camp' && !this.campCleared && !this.enemies.some((o) => o.alive && o.group === 'camp')) {
      this.campCleared = true;
      this.ui.toast("Gnasher's Camp is quiet", 'The drums have stopped');
    }
  }

  breakObject(b: Breakable, dx: number, dz: number) {
    b.broken = true;
    b.collider.on = false;
    this.scene.remove(b.group);
    this.audio.sfx('break', b.x, b.z);
    const spec = b.what === 'pot' ? { ...P.splinter, color: [0.4, 0.2, 0.12] as [number, number, number] } : P.splinter;
    for (let i = 0; i < 16; i++) this.fx.emit(spec, b.x, b.y + 0.3, b.z, dx * 2 + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, dz * 2 + (Math.random() - 0.5) * 4);
    this.fx.burst(P.puff, b.x, b.y + 0.3, b.z, 4, 1);
    this.hitstop(0.03);
    if (Math.random() < 0.6) this.combat.coins(b.x, b.y + 0.3, b.z, 1 + Math.floor(Math.random() * 4));
    if (Math.random() < 0.15 && this.player.hp < this.player.maxHp) this.combat.spawnPickup('heart', b.x, b.y + 0.3, b.z);
    else if (Math.random() < 0.05) this.combat.powerOrb(b.x, b.y + 0.5, b.z);
  }

  hitCage() {
    const c = this.cage;
    c.hp--;
    this.audio.sfx('clang', c.x, c.z);
    this.fx.burst(P.spark, c.x, c.y + 1, c.z, 10, 4, 2);
    this.hitstop(0.05);
    if (c.hp > 0) {
      this.bubbleAt(this.npc('brother')!, 'Harder! The lock is rusted through!');
      return;
    }
    c.breakOpen(this);
    this.audio.sfx('shieldBreak', c.x, c.z);
    const tam = this.npc('brother')!;
    this.after(0.6, () => {
      this.talking = tam;
      this.ui.say(tam.name, tam.def.lines, () => {
        this.talking = null;
        this.player.flasksMax = Math.min(6, this.player.flasksMax + 1);
        this.player.flasks = this.player.flasksMax;
        this.audio.sfx('heal');
        this.ui.toast('Moon Flask found', 'You can carry one more flask');
        this.save.data.rescued = true;
        this.quest('tam', 1);
        this.writeSave();
        tam.walkTo = { x: 88, z: 36 };
        this.after(3.5, () => {
          tam.visible = false;
          this.npc('tamhome')!.visible = true;
        });
      });
    });
  }

  takePower(kind: PowerKind, x: number, y: number, z: number) {
    this.player.givePower(kind);
    this.audio.sfx('power');
    this.fx.burst(P.bluespark, x, y, z, 20, 3, 2);
    const info = POWERS[kind];
    this.ui.toast(info.name, `${info.desc} for 20 seconds`, 2.2);
  }

  collect(k: Pickup) {
    if (k.kind === 'coin') {
      this.player.coins += k.value;
      this.audio.sfx('coin');
    } else {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.audio.sfx('heart');
      this.ui.pulseHearts();
    }
  }

  openChest(c: Chest) {
    this.audio.sfx('chestOpen', c.x, c.z);
    this.after(0.35, () => {
      this.combat.coins(c.x, c.y + 0.6, c.z, c.coins);
      if (c.power || Math.random() < 0.35) this.combat.powerOrb(c.x, c.y + 0.9, c.z, c.power);
      this.fx.burst(P.coinGlint, c.x, c.y + 0.7, c.z, 20, 2, 3);
      const l = this.lights.add(c.x, c.y + 1, c.z, 0xffc060, 8, 5, 0.1);
      this.after(1.2, () => (l.on = false, (l.level = 0)));
      this.ui.toast(`${c.coins} coins`);
    });
    this.save.data.chests.push(c.id);
    this.writeSave();
  }

  pullLever() {
    this.save.data.bridge = true;
    this.quest('main', 3);
    this.writeSave();
    this.after(0.5, () => {
      this.focus(49, 4, 24.5, 4.2, () => this.ui.toast('The drawbridge is down', 'The way into the keep is open'));
      this.after(0.6, () => this.bridge.lower(this));
    });
  }

  rest(m: Moonfire) {
    const p = this.player;
    const first = !m.lit;
    if (first) {
      m.setLit(true, this);
      this.audio.sfx('moonfire', m.x, m.z);
      this.fx.burst({ color: [2, 3, 5.5], color2: [0.3, 0.6, 2], size: 1, life: 1.2, gravity: -2, drag: 1 }, m.x, m.y + 1, m.z, 40, 3, 3);
      this.pipe.flash = 0.2;
      this.pipe.flashColor.setRGB(0.5, 0.7, 1);
      this.ui.toast(m.name, 'Moonfire lit');
      if (!this.save.data.lit.includes(m.id)) this.save.data.lit.push(m.id);
    } else {
      this.audio.sfx('rest', m.x, m.z);
      this.ui.toast(m.name, 'Rested. Health and flasks restored.');
    }
    p.hp = p.maxHp;
    p.flasks = p.flasksMax;
    p.stamina = p.maxStamina;
    p.rest();
    const h = this.horse;
    h.hp = h.maxHp;
    if (!p.riding && h.state !== 'flee' && Math.hypot(h.x - m.x, h.z - m.z) > 25 && m.id !== 'hearth') {
      h.arriveAt(m.x - 2.2, m.z + 1.5, this);
      h.model.rig.root.visible = true;
      this.after(1.5, () => this.pop(h, 'your warhorse finds you', '#feae34'));
    }
    this.fx.burst(P.heal, p.x, p.y + 0.6, p.z, 16, 1, 1.5);
    this.ui.pulseHearts();
    this.save.data.checkpoint = m.id;
    this.writeSave();
    this.after(1.4, () => {
      if (p.state === 'rest') p.standUp();
    });
  }

  talkTo(n: Npc) {
    const d = n.def;
    if (d.id === 'brother' && !this.cage.open) {
      this.bubbleAt(n, 'Get me out of here! Break the lock!');
      return;
    }
    this.talking = n;
    const rescued = this.save.data.rescued;
    let lines = d.after && rescued ? d.after : d.lines;
    if (d.id === 'elder' && this.save.data.bridge) lines = ['The drawbridge! We heard the chains all the way down here.', 'Go, sir knight. End this.'];
    if (d.id === 'elder') this.after(0.1, () => this.quest('main', 2));
    if (d.id === 'sister' && !rescued) this.quest('tam', 0);
    if (d.id === 'sister' && rescued && (this.save.data.quests.tam ?? 0) < 2) {
      lines = [...lines, 'Here. It is not much, but it is all I saved. For the knight who brought him home.'];
      const reward = () => {
        this.talking = null;
        this.player.coins += 30;
        this.audio.sfx('coin');
        this.ui.toast('30 coins', "Pip's savings");
        this.quest('tam', 2);
      };
      this.talking = n;
      this.ui.say(n.name, lines, reward);
      this.audio.sfx('ui');
      return;
    }
    if (d.id === 'warden') {
      const farm = this.save.data.quests.farm;
      if (farm === 1) {
        // The raiders are gone: pay up.
        this.talking = n;
        this.ui.say(n.name, ['You cleared the fields? I heard the goblins screaming from my porch.', 'Here. The king paid wardens in silver once. This is the last of it.'], () => {
          this.talking = null;
          this.player.coins += 80;
          this.player.flasks = this.player.flasksMax;
          this.audio.sfx('coin');
          this.ui.toast('80 coins', 'and your flasks refilled');
          this.quest('farm', 2);
        });
        this.audio.sfx('ui');
        return;
      }
      if (farm === 2) lines = ['The fields will grow again. Go on, sir knight. The keep is waiting.'];
      this.after(0.1, () => {
        this.quest('farm', 0);
        this.quest('lodge', 0);
      });
    }
    if (this.victory) lines = [this.victoryLine(d.id)];
    const done = () => (this.talking = null);
    let options: DialogOption[] | undefined;
    const p = this.player;
    if (d.shop === 'flask' && !this.victory) {
      const cost = 60 + (p.flasksMax - 3) * 40;
      options = [
        { label: 'Refill my flasks', disabled: p.flasks >= p.flasksMax, act: () => { p.flasks = p.flasksMax; this.audio.sfx('drink'); done(); } },
        { label: 'Buy another Moon Flask', cost, disabled: p.coins < cost || p.flasksMax >= 6, act: () => this.buy(cost, () => { p.flasksMax++; p.flasks = p.flasksMax; this.ui.toast('Moon Flask bought', `You now carry ${p.flasksMax}`); }) },
        { label: 'Nothing, thank you', act: done },
      ];
    }
    if (d.shop === 'sword' && !this.victory) {
      const cost = [80, 150, 240][p.swordLevel];
      options = [
        { label: p.swordLevel >= 3 ? 'The blade is as sharp as it gets' : `Sharpen my sword (level ${p.swordLevel + 1})`, cost: p.swordLevel < 3 ? cost : undefined, disabled: p.swordLevel >= 3 || p.coins < cost, act: () => this.buy(cost, () => { p.swordLevel++; this.ui.toast('Sword sharpened', `+${p.swordLevel * 25}% damage`); }) },
        { label: 'Not now', act: done },
      ];
    }
    this.ui.say(n.name, lines, done, options);
    this.audio.sfx('ui');
  }

  private victoryLine(id: string) {
    const L: Record<string, string> = {
      elder: 'The sun is rising over the keep. I had forgotten what it looks like.',
      wife: 'Listen! Birds! When did we last hear birds?',
      sister: 'You did it! You really did it!',
      keeper: 'Drinks are on the house tonight. Well. This morning.',
      smith: 'I will forge you a crown of your own, if you like.',
      tamhome: 'They will sing about this, sir knight.',
      warden: 'Seven more realms, they say. Rest first.',
    };
    return L[id] ?? 'Thank you, knight.';
  }

  private buy(cost: number, fn: () => void) {
    this.player.coins -= cost;
    this.audio.sfx('buy');
    fn();
    this.writeSave();
    this.talking = null;
  }

  bubbleAt(n: { x: number; y: number; z: number }, text: string) {
    const s = { x: 0, y: 0 };
    this.cam.toScreen(new THREE.Vector3(n.x, n.y + 2.2, n.z), s);
    this.ui.bubble(text, s.x, s.y);
    this.bubbleTarget = n;
  }
  private bubbleTarget: { x: number; y: number; z: number } | null = null;

  /** Point the camera somewhere for a moment. */
  focus(x: number, y: number, z: number, dur: number, onEnd?: () => void) {
    this.cutscene = { t: 0, dur, x, y, z, onEnd };
  }

  private timers: { t: number; fn: () => void }[] = [];
  after(t: number, fn: () => void) {
    this.timers.push({ t, fn });
  }

  // ---------- boss ----------

  private startBoss() {
    const b = this.boss;
    if (!b || this.bossActive || !b.alive) return;
    this.bossActive = true;
    this.hallDoor.setOpen(false, this);
    this.audio.music?.setTrack('');
    this.focus(b.x + 1, b.y + 1.2, b.z, 3.2, () => {
      this.ui.bossShow('Goblin King');
      this.audio.music?.setTrack('boss');
    });
    this.after(0.8, () => {
      b.wake(this);
      this.audio.sfx('roar', b.x, b.z);
      this.shake(0.5);
      this.bubbleAt(b, 'Another tin can for my collection!');
      this.ui.bossIntro('The Goblin King', 'TYRANT OF THE MOONLIT KEEP', 2.6);
    });
  }

  bossSlam(e: Enemy, fromJump: boolean) {
    this.audio.sfx('slam', e.x, e.z);
    this.shake(0.8);
    this.fx.burst(P.puff, e.x + e.fx * 1.2, e.y + 0.2, e.z + e.fz * 1.2, 16, 4);
    this.combat.wave(e.x + e.fx * (fromJump ? 0 : 1.4), e.y, e.z + e.fz * (fromJump ? 0 : 1.4), e.enraged ? 10 : 8, e.enraged ? 8.5 : 7.5);
    if (e.enraged && !fromJump) this.after(0.45, () => e.alive && this.combat.wave(e.x, e.y, e.z, 9, 7));
    const p = this.player;
    const dx = p.x - (e.x + e.fx * 1.4), dz = p.z - (e.z + e.fz * 1.4);
    if (!fromJump && Math.hypot(dx, dz) < 1.8) this.enemyHitsPlayer(e, 1, { kb: 10 });
    if (fromJump && Math.hypot(p.x - e.x, p.z - e.z) < 1.6) this.enemyHitsPlayer(e, 1, { kb: 12, unblockable: true });
    this.chandelierShake();
  }

  bossSummon(e: Enemy) {
    this.audio.sfx('roar', e.x, e.z);
    this.bubbleAt(e, 'GUARDS!');
    for (const [x, z] of [[30, 13], [30, 24]]) {
      const g = new Enemy('goblin', x, z, this, 'boss');
      g.model.rig.addTo(this.scene);
      g.state = 'chase';
      this.enemies.push(g);
      e.summoned.push(g);
      this.fx.burst(P.puff, x, 4.2, z, 10, 2);
    }
  }

  bossEnrage(e: Enemy) {
    this.audio.sfx('roar', e.x, e.z);
    this.shake(0.7);
    this.bubbleAt(e, "ENOUGH! Feel the King's wrath!");
    this.pipe.flash = 0.2;
    this.pipe.flashColor.setRGB(1, 0.3, 0.2);
  }

  chandelierShake() {
    for (let i = 0; i < 18; i++) this.fx.emit(P.dust, 20 + Math.random() * 12, 9, 12 + Math.random() * 13, 0, -1, 0);
    // The king's crashes can bring a chandelier down, over the knight.
    if (!this.bossActive || this.chandelierCd > 0 || Math.random() > 0.55) return;
    const p = this.player;
    const c = this.chandeliers.filter((k) => k.state === 'hang').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!c) return;
    this.chandelierCd = 7;
    c.drop(this);
  }

  /** A fallen chandelier crushes whoever stood under it. */
  chandelierImpact(x: number, z: number, floor: number) {
    const p = this.player;
    if (Math.hypot(p.x - x, p.z - z) < 1.6 && Math.abs(p.y - floor) < 1.5) {
      const res = p.hurt(1, x, z, this, { unblockable: true, kb: 9 });
      this.afterPlayerHit(res, x, z, null);
    }
    for (const e of this.enemies) {
      if (!e.alive || e.flying) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d > 1.8 + e.r * 0.5) continue;
      e.takeHit(4, (e.x - x) / (d || 1), (e.z - z) / (d || 1), 6, false, this);
      this.pop(e, 'crushed!', '#ff9a50');
    }
  }

  private onBossDeath(e: Enemy) {
    this.bubbleAt(e, 'My... crown...');
    this.slowmo(0.2, 1.4);
    this.pipe.flash = 0.5;
    this.pipe.flashColor.setRGB(1, 0.95, 0.8);
    this.ui.bossHide();
    this.audio.music?.setTrack('');
    for (const s of e.summoned) if (s.alive) s.die(this);
    this.save.data.boss = true;
    this.quest('main', 5);
    this.writeSave();
    this.victory = true;
    this.after(2.5, () => {
      this.audio.sfx('victory');
      this.hallDoor.setOpen(true, this);
      this.dawnTarget = 1;
      this.audio.music?.setTrack('dawn');
      const d = this.save.data;
      const mins = Math.floor(d.playTime / 60);
      this.screens.showVictory(
        'The Goblin King has fallen, and dawn breaks over Keepsfoot.<br>The first of eight realms is free.',
        `${this.kills} foes defeated &middot; ${this.player.coins} coins &middot; ${d.deaths} falls &middot; ${mins} min`,
      );
      this.state = 'victory';
      this.victoryT = 0;
    });
  }

  private viewer(anim: string, tFixed: string | null) {
    const models = [makeKnight(false), makeGoblin(false), makeGoblin(true), makeArcher(), makeBat(), makeBoar(), makeKing(), makeVillager('old'), makeVillager('girl'), makeVillager('smith')];
    const cx = 79, cz = 64.5;
    const R = this.cam.groundRight, U = this.cam.groundUp;
    models.forEach((m, i) => {
      m.rig.addTo(this.scene);
      const col = (i % 5) - 2, row = Math.floor(i / 5) === 0 ? 1.6 : -1.6;
      const x = cx + R.x * col * 2.4 + U.x * row * 1.6, z = cz + R.z * col * 2.4 + U.z * row * 1.6;
      const y = this.grid.groundAt(x, z) + (i === 4 ? 1.2 : 0);
      m.rig.face(0.7, 0.7, 0);
      this.viewerModels.push({ m, x, y, z });
    });
    this.player.place(60, 60, this);
    this.viewerAnim = anim;
    this.viewerT = tFixed === null ? null : Number(tFixed);
    this.cam.focus.set(cx, 1.4, cz);
  }
  private viewerModels: { m: Model; x: number; y: number; z: number }[] = [];
  private viewerAnim = 'idle';
  private viewerT: number | null = null;

  private dawnTarget = 0;
  setDawn(k: number) {
    this.dawn = k;
    this.dawnTarget = k;
    this.victory = k > 0.5;
  }

  // ---------- falling ----------

  private falling = false;
  /** The knight fell off the world (the gorge): lose a heart, back to safe ground. */
  fellOut() {
    if (this.falling) return;
    this.falling = true;
    this.audio.sfx('hurt');
    this.ui.fade(true);
    this.after(0.7, () => {
      const p = this.player;
      if (!this.godMode) p.hp = Math.max(0, p.hp - 1);
      p.place(p.lastSafe.x, p.lastSafe.z, this);
      p.iframes = 1.2;
      this.cam.focus.set(p.x, p.y, p.z);
      this.ui.fade(false);
      this.falling = false;
      if (p.hp <= 0) {
        p.die();
        this.onPlayerDeath();
      }
    });
  }

  // ---------- death ----------

  private onPlayerDeath() {
    this.state = 'dead';
    this.trial.reset(this);
    this.deadT = 0;
    this.audio.sfx('death');
    this.slowmo(0.35, 1.2);
    this.save.data.deaths++;
    this.audio.setMuffle(500);
    this.after(1.0, () => this.ui.dead(true));
  }

  private respawn() {
    this.ui.fade(true);
    this.after(0.9, () => {
      this.ui.dead(false);
      const cp = this.moonfires.find((m) => m.id === this.save.data.checkpoint);
      const p = this.player;
      if (this.horse.ridden) {
        this.horse.ridden = false;
        this.horse.state = 'idle';
        this.horse.home = { x: this.horse.x, z: this.horse.z };
      }
      this.horse.hp = this.horse.maxHp;
      p.revive();
      if (cp && (cp.lit || cp.id === 'hearth')) p.place(cp.x + 1.3, cp.z + 1.3, this);
      else p.place(this.realm.start.x, this.realm.start.z, this);
      this.cam.focus.set(p.x, p.y, p.z);
      // Survivors regroup and heal.
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if ((e.group === 'boss' && e.type !== 'king') || e.group === 'trial') {
          e.despawn(this);
          continue;
        }
        e.hp = e.maxHp;
        e.x = e.home.x;
        e.z = e.home.z;
        e.y = e.flying ? this.grid.groundAt(e.x, e.z) + 1.3 : this.grid.groundAt(e.x, e.z);
        e.state = e.type === 'king' ? 'sleep' : 'idle';
        e.enraged = false;
        e.model.rig.lift = 0;
      }
      if (this.boss?.alive) for (const c of this.chandeliers) c.reset();
      if (this.bossActive) {
        this.bossActive = false;
        this.ui.bossHide();
        if (this.save.data.courtyard) this.hallDoor.setOpen(true, this, true);
        if (this.boss) this.boss.model.rig.face(1, 0, 0);
      }
      this.combat.arrows.forEach((a) => (a.dead = true));
      this.state = 'play';
      this.region = null;
      this.audio.setMuffle(20000);
      this.writeSave();
      this.ui.fade(false);
    });
  }

  // ---------- per frame ----------

  private last = 0;
  frame(now: number) {
    const real = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    const inp = this.input;
    inp.pollPad();
    this.time += real;
    shared.uTime.value = this.time;
    this.pipe.time = this.time;

    this.handleMenus(real);

    let dt = real;
    if (this.hitstopT > 0) {
      this.hitstopT -= real;
      dt = 0;
    }
    if (this.slowT > 0) {
      this.slowT -= real;
      dt *= this.slowScale;
    }
    if (this.paused) dt = 0;

    for (const t of this.timers) t.t -= real;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    due.forEach((t) => t.fn());

    this.updateWorld(dt, real);
    this.ui.update(real);
    this.screens.update(real);
    this.render(real);
    inp.endFrame();
  }

  private handleMenus(real: number) {
    const inp = this.input;
    if (this.state === 'title' && this.screens.titleOpen) {
      if (inp.usingPad) {
        const y = inp.padMove.y;
        if (Math.abs(y) > 0.6 && !this.padHeld) this.screens.titleKey(y > 0 ? 'up' : 'down');
        this.padHeld = Math.abs(y) > 0.6;
        if (inp.hit('attack') || inp.hit('interact') || inp.hit('jump')) this.screens.titleKey('ok');
      }
      return;
    }
    if (this.state === 'story') {
      if (inp.anyPressed) this.screens.storyKey();
      return;
    }
    if (this.state === 'dead') {
      this.deadT += real;
      if (this.deadT > 3 && inp.anyPressed) {
        this.deadT = -99;
        this.respawn();
      }
      return;
    }
    if (inp.hit('pause')) {
      if (this.ui.loreOpen) this.ui.closeLore();
      else if (!this.ui.dialogOpen) this.setPaused(!this.paused);
    }
    if (this.paused) return;
    if (this.ui.dialogOpen) {
      if (inp.keyPressed('KeyW')) this.ui.dialogKey('up');
      if (inp.keyPressed('KeyS')) this.ui.dialogKey('down');
      if (inp.usingPad) {
        const y = inp.padMove.y;
        if (Math.abs(y) > 0.6 && !this.padHeld) this.ui.dialogKey(y > 0 ? 'up' : 'down');
        this.padHeld = Math.abs(y) > 0.6;
      }
      if (inp.hit('interact')) this.ui.dialogKey('ok');
      return;
    }
    if (this.ui.loreOpen) {
      if (inp.hit('interact') && this.ui.closeLore()) this.audio.sfx('ui');
      return;
    }
    if (this.state === 'victory') {
      this.victoryT += real;
      if (this.victoryT > 4 && (inp.anyPressed || this.victoryT > 12)) {
        this.screens.hideVictory();
        this.state = 'play';
      }
    }
    if (this.debug) this.debugKeys();
  }

  private debugKeys() {
    const inp = this.input;
    if (inp.keyPressed('KeyG')) {
      this.godMode = !this.godMode;
      this.ui.toast(this.godMode ? 'God mode on' : 'God mode off');
    }
    if (inp.keyPressed('KeyT') && this.mouseGround) this.player.place(this.mouseGround.x, this.mouseGround.z, this);
    const spots: Record<string, [number, number]> = { Digit1: [111, 110], Digit2: [78, 66], Digit3: [40, 78], Digit4: [92, 32], Digit5: [58, 16], Digit6: [40, 26], Digit7: [31, 18.5] };
    for (const [k, v] of Object.entries(spots)) if (inp.keyPressed(k)) this.player.place(v[0], v[1], this);
  }

  private updateWorld(dt: number, real: number) {
    const p = this.player;
    const playing = this.state === 'play' || this.state === 'dead' || this.state === 'victory';

    // Mouse ray onto the knight's ground plane.
    const ndc = new THREE.Vector2((this.input.mouseX / window.innerWidth) * 2 - 1, -(this.input.mouseY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.cam.cam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(p.y + 0.9));
    const hit = new THREE.Vector3();
    this.mouseGround = this.raycaster.ray.intersectPlane(plane, hit) ? hit : null;

    if (playing) {
      // Foes and arrows hold still while you read, talk or watch a cutscene.
      const frozen = this.ui.dialogOpen || this.ui.loreOpen || !!this.cutscene;
      const edt = frozen ? 0 : dt;
      if (this.state === 'play') this.save.data.playTime += dt;
      p.update(dt, this);
      if (this.state === 'play' && p.state === 'rest' && (this.input.move().x || this.input.move().y)) p.standUp();
      for (const e of this.enemies) e.update(edt, this);
      this.enemies = this.enemies.filter((e) => {
        if (e.removed) e.model.rig.dispose(this.scene);
        return !e.removed;
      });
      this.combat.update(edt);
      this.checkInteract();
      this.checkRegion();
      this.checkBossTrigger();
      if (this.state === 'play' && this.player.hp <= 0 && this.player.state === 'dead') this.state = 'dead';
      this.tutorialT += dt;
    } else {
      p.rig.place(this.cam, p.x, p.y, p.z, p.y, false);
    }
    for (const n of this.npcs) n.update(dt, this);
    this.horse.update(dt, this);
    for (const s of this.shards) s.update(dt, this);
    for (const c of this.critters) c.update(dt, this);
    const hdt = this.ui.dialogOpen || this.cutscene || this.state !== 'play' ? 0 : dt;
    for (const s of this.slits) s.update(hdt, this);
    for (const c of this.chandeliers) c.update(dt, this);
    this.chandelierCd -= dt;
    this.trial.update(this.ui.dialogOpen || this.cutscene ? 0 : dt, this);
    for (const v of this.viewerModels) {
      const t = this.viewerT ?? (this.time % 1.2);
      v.m.animate(0, v.x, v.z, this.viewerAnim, t, this.time, { dur: 0.4 });
      v.m.rig.place(this.cam, v.x, v.y, v.z, this.grid.groundAt(v.x, v.z));
    }
    for (const c of this.chests) c.update(dt);
    this.lever?.update(dt);
    this.bridge?.update(dt, this);
    this.hallDoor?.update(dt);
    this.windmill?.update(dt);

    // Alerts above heads.
    for (const a of this.alerts) {
      a.t += dt;
      a.s.setFrame(ALERT_FRAME, false);
      const h = a.e.type === 'boar' ? 1.6 : a.e.type === 'bat' ? 0.9 : 2.0;
      a.s.place(this.cam, a.e.x, a.e.y + h + Math.min(0.3, a.t * 2), a.e.z, a.e.y, a.t < 0.7 && a.e.alive);
      if (a.t > 0.8) a.s.dispose(this.scene);
    }
    this.alerts = this.alerts.filter((a) => a.t <= 0.8);

    // Sword swooshes.
    for (const s of this.swooshes) {
      s.t += dt;
      s.mat.uniforms.uProg.value = clamp(s.t / 0.1, 0, 1.55);
      s.mat.uniforms.uAlpha.value = s.t < 0 ? 0 : clamp(1 - (s.t - 0.1) / s.dur, 0, 1);
      s.mesh.position.x = p.x;
      s.mesh.position.z = p.z;
      if (s.t > s.dur + 0.1) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
      }
    }
    this.swooshes = this.swooshes.filter((s) => s.t <= s.dur + 0.1);

    // Fireflies drift around the knight in the right places.
    if (!this.victory || this.dawn < 0.5)
      for (const z of this.realm.fireflyZones) {
        const d = Math.hypot(this.cam.focus.x - z.x, this.cam.focus.z - z.z);
        if (d < z.r + 20 && Math.random() < 0.25 * real * 60 * 0.12) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * z.r;
          const x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r;
          this.fx.emit(P.firefly, x, this.grid.groundAt(x, zz) + 0.4 + Math.random() * 1.2, zz, 0, 0, 0);
        }
      }
    // Falling leaves in the woods, dust motes indoors.
    if (this.region?.amb === 'woods' && Math.random() < real * 3) {
      const x = this.cam.focus.x + (Math.random() - 0.5) * 30, z = this.cam.focus.z + (Math.random() - 0.5) * 30;
      this.fx.emit(P.leaf, x, this.grid.groundAt(x, z) + 5, z, 0.4, -0.3, 0.2);
    }
    if (this.region?.amb === 'indoor' && Math.random() < real * 6) {
      const x = p.x + (Math.random() - 0.5) * 10, z = p.z + (Math.random() - 0.5) * 10;
      this.fx.emit(P.mote, x, p.y + 0.5 + Math.random() * 2.5, z, 0, 0, 0);
    }

    this.fx.setRes(this.pipe.w, this.pipe.h);
    this.fx.update(dt, this.time, this.cam.focus.x, this.cam.focus.z);
    this.lights.update(this.time, this.cam.focus.x, this.cam.focus.z);
    shared.uPlayer.value.set(p.x, p.y, p.z);
    this.updateStructures(real);
    this.updateCamera(dt, real);
    this.updateAudio(real);
    this.updateDawn(real);

    if (this.bubbleTarget) {
      const s = { x: 0, y: 0 };
      this.cam.toScreen(new THREE.Vector3(this.bubbleTarget.x, this.bubbleTarget.y + (this.bubbleTarget === this.boss ? 4.6 : 2.2), this.bubbleTarget.z), s);
      this.ui.moveBubble(s.x, s.y);
    }

    // Fog of war clears around the knight (and wherever a cutscene looks).
    if (this.state === 'play' || this.state === 'dead' || this.state === 'victory') {
      this.fow.reveal(p.x, p.z, 17);
      if (this.cutscene) this.fow.reveal(this.cam.focus.x, this.cam.focus.z, 9);
    }
    this.fow.flush();
    const fowTarget = this.state === 'play' || this.state === 'dead' || this.state === 'victory' ? 1 : 0;
    this.pipe.fow!.amount = damp(this.pipe.fow!.amount, fowTarget, 2, real);

    if (this.comboCount > 0 && dt > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.comboCount = 0;
        this.ui.combo(0, 1);
      }
    }

    this.ui.hud(p, p.riding ? { hp: p.riding.hp, max: p.riding.maxHp } : null);
    if (this.pipe.flash > 0) this.pipe.flash = Math.max(0, this.pipe.flash - real * 1.5);
    this.pipe.desat = damp(this.pipe.desat, this.state === 'dead' ? 0.85 : p.hp <= 1 ? 0.35 : 0, 3, real);
    this.audio.setMuffle(this.paused ? 700 : this.state === 'dead' ? 500 : p.hp <= 1 ? 2500 : 20000);

    // First steps: point the way.
    if (this.state === 'play' && this.settings.hints && !this.hintsShown.has('road') && this.tutorialT > 12 && !this.save.data.lit.length && Math.hypot(p.x - 105.5, p.z - 99.5) < 22) {
      this.hintsShown.add('road');
      this.ui.hint('Light the <b>moonfire</b> at the wayshrine with <kbd>E</kbd>. If you fall, you will rise there.', 7);
    }
  }

  private checkInteract() {
    document.body.classList.toggle('touch', this.input.usingTouch);
    this.touch.show(this.input.usingTouch && (this.state === 'play' || this.state === 'victory') && !this.paused && !this.ui.dialogOpen && !this.ui.loreOpen && !this.cutscene);
    if (!this.controlsEnabled) {
      this.ui.prompt(null);
      this.touch.setInteract(null);
      return;
    }
    const p = this.player;
    if (p.riding) {
      this.ui.prompt('Dismount');
      this.touch.setInteract('Dismount');
      return;
    }
    let best: Interactable | null = null, bd = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < it.radius && d < bd && Math.abs(it.y - p.y) < 1.5 && it.prompt(this)) {
        best = it;
        bd = d;
      }
    }
    if (this.cage && !this.cage.open && Math.hypot(this.cage.x - p.x, this.cage.z - p.z) < 2.4) {
      this.ui.prompt('Strike the cage to break the lock', 'Click');
      this.touch.setInteract(null);
      return;
    }
    const label = best ? best.prompt(this) : null;
    this.ui.prompt(label);
    this.touch.setInteract(label && !label.startsWith('!') ? label : null);
    if (best && this.input.hit('interact') && !p.busy && !best.prompt(this)!.startsWith('!')) best.interact(this);
  }

  private checkRegion() {
    const p = this.player;
    const r = this.realm.regions.find((rg) => rg.test(p.x, p.z, p.y)) ?? null;
    if (r && r !== this.region) {
      const prev = this.region;
      this.region = r;
      if (r.name === 'Keepsfoot') this.quest('main', 1);
      if (r.name === 'The Seven Stones') this.quest('stones', 0);
      if (r.name === "Gnasher's Camp" && !this.save.data.rescued) this.quest('tam', 0);
      if (!prev || prev.name !== r.name) {
        this.ui.area(r.name, r.name === 'The Moonlit Keep' && !this.victory ? 'Seat of the Goblin King' : '');
        this.audio.sfx('area');
      }
      if (!this.bossActive || !this.boss?.alive) this.audio.music?.setTrack(this.victory ? 'dawn' : r.music === 'tavern' ? '' : r.music);
    }
  }

  private checkBossTrigger() {
    const p = this.player, b = this.boss;
    if (!b || !b.alive || this.bossActive || this.save.data.boss) return;
    if (p.x < 32 && p.x > 16 && p.z > 10 && p.z < 27 && p.y > 3.5) this.startBoss();
  }

  private updateStructures(real: number) {
    const p = this.player;
    const ray = new THREE.Ray(new THREE.Vector3(p.x, p.y + 1.0, p.z), new THREE.Vector3().copy(this.cam.cam.position).sub(this.cam.focus).normalize());
    const ray2 = new THREE.Ray(new THREE.Vector3(p.x, p.y + 0.2, p.z), ray.direction);
    for (const s of this.structures) {
      let inside = false;
      if (s.interior) {
        const [x0, z0, x1, z1] = s.interior;
        inside = p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && p.y > (s.interiorY ?? 0) - 0.5 && p.y < (s.interiorY ?? 0) + 4;
      }
      const occ = !inside && (ray.intersectsBox(s.box) || ray2.intersectsBox(s.box)) && !s.box.containsPoint(ray.origin);
      const coreT = occ ? 0.25 : 1;
      const shellT = inside ? 0 : occ ? 0.25 : 1;
      s.fade = damp(s.fade, coreT, 8, real);
      s.shellFade = damp(s.shellFade, shellT, 8, real);
      for (const m of s.mats) m.opacity = s.fade > 0.98 ? 1 : s.fade;
      for (const m of s.shellMats) m.opacity = s.shellFade > 0.98 ? 1 : s.shellFade;
      for (const m of s.meshes) if (m.material instanceof THREE.MeshBasicMaterial) m.visible = s.fade > 0.5;
      for (const m of s.shellMeshes) m.visible = s.shellFade > 0.02;
      for (const m of s.shellMeshes) if (m.material instanceof THREE.MeshBasicMaterial) m.visible = s.shellFade > 0.5;
    }
  }

  private updateCamera(dt: number, real: number) {
    const p = this.player;
    const f = this.focusTarget;
    if (this.state === 'title' || this.state === 'story' || this.state === 'loading') {
      this.titleT += real;
      const t = this.titleT * 0.05;
      f.set(80 + Math.sin(t) * 8, 1.5, 66 + Math.cos(t * 0.7) * 6);
      this.cam.focus.copy(f);
    } else if (this.cutscene) {
      const c = this.cutscene;
      c.t += real;
      f.set(c.x, c.y, c.z);
      this.cam.focus.x = damp(this.cam.focus.x, f.x, 3, real);
      this.cam.focus.y = damp(this.cam.focus.y, f.y, 3, real);
      this.cam.focus.z = damp(this.cam.focus.z, f.z, 3, real);
      if (c.t >= c.dur) {
        this.cutscene = null;
        c.onEnd?.();
      }
    } else if (this.viewerModels.length) {
      f.set(79, 1.4, 64.5);
      this.cam.focus.copy(f);
    } else {
      f.set(p.x, p.y + 0.6, p.z);
      if (this.input.mouseAim && this.mouseGround) {
        const dx = clamp((this.mouseGround.x - p.x) * 0.18, -2.4, 2.4), dz = clamp((this.mouseGround.z - p.z) * 0.18, -2.4, 2.4);
        f.x += dx;
        f.z += dz;
      } else {
        f.x += p.fx * 1.2;
        f.z += p.fz * 1.2;
      }
      if (this.bossActive && this.boss?.alive) {
        f.x = lerp(f.x, this.boss.x, 0.3);
        f.z = lerp(f.z, this.boss.z, 0.3);
      }
      const k = dt > 0 ? 6 : 0;
      this.cam.focus.x = damp(this.cam.focus.x, f.x, k, real);
      this.cam.focus.y = damp(this.cam.focus.y, f.y, 4, real);
      this.cam.focus.z = damp(this.cam.focus.z, f.z, k, real);
    }
    this.cam.update(this.pipe, real, this.settings.shake);
    // Foliage cut-out around the knight (render-buffer pixels).
    const chest = new THREE.Vector3(p.x, p.y + 1.0, p.z).project(this.cam.cam);
    shared.uCutCenter.value.set(((chest.x + 1) / 2) * this.pipe.w, ((chest.y + 1) / 2) * this.pipe.h);
    shared.uCutRadius.value = this.state === 'play' || this.state === 'dead' || this.state === 'victory' ? 46 : 0;
    shared.uCamPos.value.copy(this.cam.cam.position);
    shared.uCamFwd.value.copy(this.cam.forward);
    shared.uCutDepth.value = new THREE.Vector3(p.x, p.y + 1.0, p.z).sub(this.cam.cam.position).dot(this.cam.forward);
    this.audio.setListener(p.x, p.z);
    this.audio.rx = this.cam.groundRight.x;
    this.audio.rz = this.cam.groundRight.z;

    // Moon shadow camera follows the view, snapped to shadow texels to stop shimmer.
    const L = new THREE.Vector3(-0.62, 0.72, 0.3).normalize();
    const right = new THREE.Vector3().crossVectors(L, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, L).normalize();
    const texel = (this.moon.shadow.camera.right - this.moon.shadow.camera.left) / this.moon.shadow.mapSize.x;
    const c = this.cam.focus.clone();
    const a = c.dot(right), b = c.dot(up);
    c.addScaledVector(right, Math.round(a / texel) * texel - a).addScaledVector(up, Math.round(b / texel) * texel - b);
    this.moon.target.position.copy(c);
    this.moon.position.copy(c).addScaledVector(L, 70);
    this.moon.target.updateMatrixWorld();
  }

  private updateAudio(real: number) {
    const a = this.audio;
    if (!a.ctx) return;
    const p = this.player;
    this.ambT -= real;
    if (this.ambT <= 0) {
      this.ambT = 0.25;
      let wd = Infinity;
      for (const [x, z] of this.realm.waterPoints) wd = Math.min(wd, (x - p.x) ** 2 + (z - p.z) ** 2);
      this.ambCache.water = 1 / (1 + wd / 30);
      let fire = 0;
      for (const f of this.realmFires()) {
        const d2 = (f.x - p.x) ** 2 + (f.z - p.z) ** 2;
        fire += (f.big ? 1 : 0.35) / (1 + d2 / 6);
      }
      this.ambCache.fire = Math.min(1, fire);
    }
    const amb = this.region?.amb ?? 'road';
    const prof: Record<string, [number, number, number]> = {
      fields: [1, 1, 0.7], road: [0.7, 0.9, 0.6], village: [0.5, 0.7, 0.4], woods: [0.6, 0.5, 1], keep: [0.9, 0.2, 0.2], indoor: [0, 0, 0],
    };
    const [wind, crickets, owls] = prof[amb];
    const campAlive = this.enemies.some((e) => e.alive && e.group === 'camp');
    const campD = Math.hypot(p.x - 95, p.z - 27);
    const dawnMul = 1 - this.dawn * 0.8;
    a.update(real, {
      x: p.x, z: p.z, wind, crickets: crickets * dawnMul, owls: owls * dawnMul, water: this.ambCache.water, fire: this.ambCache.fire,
      drums: campAlive ? 1 / (1 + (campD / 12) ** 2) : 0, indoor: amb === 'indoor',
    });
    // The tavern tune leaks out into the square.
    const td = Math.hypot(p.x - 77, p.z - 53.5);
    const inside = this.region?.name === 'The Crescent & Crown';
    a.music?.setTavern(this.state === 'title' ? 0.25 : inside ? 0.8 : 0.9 / (1 + (td / 6) ** 2), inside);
  }

  private realmFires() {
    return this.realm.builder.fires;
  }

  private updateDawn(real: number) {
    if (Math.abs(this.dawn - this.dawnTarget) > 0.0001) this.dawn = damp(this.dawn, this.dawnTarget, 0.25, real);
    const k = this.dawn;
    const a = this.pipe.atmo;
    this.moon.color.setRGB(lerp(0.56, 1.0, k), lerp(0.65, 0.78, k), lerp(1.0, 0.6, k));
    this.moon.intensity = lerp(2.0, 3.0, k);
    this.hemi.color.setRGB(lerp(0.235, 0.55, k), lerp(0.3, 0.52, k), lerp(0.5, 0.62, k));
    this.hemi.groundColor.setRGB(lerp(0.1, 0.35, k), lerp(0.08, 0.26, k), lerp(0.13, 0.22, k));
    this.hemi.intensity = lerp(1.0, 1.6, k);
    a.fogColor.setRGB(lerp(0.012, 0.35, k), lerp(0.014, 0.22, k), lerp(0.035, 0.22, k));
    a.fogTop.setRGB(lerp(0.006, 0.2, k), lerp(0.006, 0.15, k), lerp(0.02, 0.25, k));
    a.mistColor.setRGB(lerp(0.07, 0.5, k), lerp(0.085, 0.38, k), lerp(0.14, 0.34, k));
    a.lift.setRGB(lerp(0.012, 0.02, k), lerp(0.014, 0.012, k), lerp(0.04, 0.01, k));
    a.warmth = k * 0.5;
    a.exposure = lerp(1.45, 1.25, k);
    a.mistAmount = lerp(0.8, 0.45, k);
    a.cloud = lerp(0.28, 0.15, k);
  }

  private render(real: number) {
    void real;
    void VIEW;
    this.pipe.render(this.scene, this.cam.cam);
  }
}
