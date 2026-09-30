import * as THREE from 'three';
import { EFFECTS, FOES, MOBILE, VIEW, WORLD } from '../config';
import { Pipeline } from '../engine/pipeline';
import { IsoCamera } from '../engine/camera';
import { Input, loadKeyLayout } from '../engine/input';
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
import { buildGrass } from '../world/grass';
import type { BorderDef, RealmData, RealmId, RegionDef } from '../world/realm';
import { ALERT_FRAME, type Assets } from './assets';
import { Player, POWERS, type PowerKind } from './player';
import { Enemy } from './enemies';
import { Combat, type Arrow, type Pickup, type Wave } from './combat';
import { Bindings, Breakable, Cage, Chest, CrackedWall, Drawbridge, HallDoor, Lever, LoreStone, Moonfire, Npc, Shard, Sign, ThornGate, ThornHedge, Windmill, type Interactable } from './objects';
import { Save } from './save';
import { FogOfWar } from './fow';
import { Mount } from './mount';
import { Trial } from './trial';
import { ArrowSlit, Chandelier, SnareTrap, ThornBurst, WardenMark } from './hazards';
import { ROUTE, type MapRealm } from '../ui/worldmap';
import { Critter } from './critters';
import { QuestBook } from './quests';
import { REALMS, isRealm, type RealmDef } from './realms';
import type { RealmStory } from './story/story';
import { reachability } from './reach';
import { makeArcher, makeBat, makeBoar, makeBomber, makeBrute, makeDarter, makeGoblin, makeKing, makeKnight, makeShaman, makeSnarer, makeSpitter, makeThornback, makeVillager, setFoePalette, type Model } from './models';

type GameState = 'loading' | 'title' | 'story' | 'play' | 'dead' | 'victory';

/** Set in sessionStorage while a border crossing reloads the page: the travel card. */
const TRAVEL_KEY = 'realms-travel';

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
  /** The realm being played: its definition, its map and its story. */
  def: RealmDef;
  realm: RealmData;
  story: RealmStory;
  quests: QuestBook;
  player: Player;
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  moonfires: Moonfire[] = [];
  chests: Chest[] = [];
  breakables: Breakable[] = [];
  crackedWalls: CrackedWall[] = [];
  hedges: ThornHedge[] = [];
  shards: Shard[] = [];
  slits: ArrowSlit[] = [];
  critters: Critter[] = [];
  chandeliers: Chandelier[] = [];
  snareTraps: SnareTrap[] = [];
  thornBursts: ThornBurst[] = [];
  /** Spots the Thorn Warden has marked for arrows or roots. */
  wardenMarks: WardenMark[] = [];
  private chandelierCd = 0;
  /** Hits landed in a row; coins from kills are multiplied while it lasts. */
  comboCount = 0;
  comboT = 0;
  interactables: Interactable[] = [];
  structures: Structure[] = [];
  lever?: Lever;
  bridge?: Drawbridge;
  cage?: Cage;
  hallDoor?: HallDoor | ThornGate;
  /** The Warden's thorns across the way to its hold (they wither when the heart is torn out). */
  thornWall?: ThornGate;
  windmill?: Windmill;
  horse!: Mount;
  /** Every mount the knight has in this realm (the warhorse; the Thornstag once freed). */
  mounts: Mount[] = [];
  /** The one that comes when the knight rests at a far moonfire: the last one ridden. */
  lastMount!: Mount;
  bindings: Bindings[] = [];
  trial?: Trial;
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
  private hintsShown = new Set<string>(Game.loadTips());

  private static loadTips(): string[] {
    try {
      return JSON.parse(localStorage.getItem('realms-tips') || '[]');
    } catch {
      return [];
    }
  }

  /** Has this tip come up on this device before? */
  tipShown(key: string) {
    return this.hintsShown.has(key);
  }

  /** True the first time a tip comes up on this device; remembers it. */
  firstTime(key: string) {
    if (this.hintsShown.has(key)) return false;
    this.hintsShown.add(key);
    try {
      localStorage.setItem('realms-tips', JSON.stringify([...this.hintsShown]));
    } catch {
      /* storage blocked: tips may repeat */
    }
    return true;
  }
  private padHeld = false;
  private debug = new URLSearchParams(location.search).has('debug');
  /** Seconds played since entering the world (first-steps tips wait on it). */
  tutorialT = 0;
  /** This page was loaded by a border crossing. */
  private travelling = false;
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
    this.ui.keyLabel = (a) => this.input.label(a);
    loadKeyLayout(() => {
      this.screens.refreshKeys();
      this.ui.refreshKeys();
    });
    this.touch.onPause = () => this.setPaused(!this.paused);
    this.screens.onPauseAction((a) => {
      if (a === 'resume') this.setPaused(false);
      if (a === 'title') location.reload();
      if (a.startsWith('realm:')) {
        this.setPaused(false);
        this.travelTo(a.slice(6) as RealmId);
      }
    });

    // ---------- which realm ----------
    // The save says where the knight is; a border crossing reloads the page into
    // the realm on the other side. Tests can ask for one with ?realm=forest.
    this.save.load();
    const q = new URLSearchParams(location.search);
    let card: [string, string] | null = null;
    try {
      card = JSON.parse(sessionStorage.getItem(TRAVEL_KEY) || 'null');
      sessionStorage.removeItem(TRAVEL_KEY);
    } catch {
      /* ignore */
    }
    this.travelling = !!card;
    const want = q.get('realm');
    if (!this.travelling && isRealm(want) && want !== this.save.realm) this.save.select(want);
    this.def = REALMS[this.save.realm];
    this.story = this.def.story();
    this.quests = new QuestBook(this.def.quests);
    // Each realm's goblins, archers and beasts wear its own colours.
    setFoePalette(this.def.id);
    this.screens.setRealm(this.story.title, this.story.victoryTitle, card);
    this.screens.setTravel(Object.values(REALMS).filter((r) => r.id !== this.def.id).map((r) => ({ id: r.id, name: r.name })));

    // ---------- world ----------
    // The grid reaches PAD cells past the realm on every side: that land is real
    // terrain, closed off by what the realm has there (cliffs, a gorge, a river...).
    const PAD = 26;
    const W = this.def.w, D = this.def.d;
    this.grid = new Grid(W + PAD * 2, D + PAD * 2, -PAD, -PAD);
    const builder = new Builder(this.grid, this.lights, this.fx, mulberry32(7), WORLD.chunk);
    this.realm = this.def.build(builder);
    this.def.paintOutskirts(this.grid, this.realm.w, this.realm.d);
    this.realm.afterOutskirts(this.grid, builder);
    this.def.decorateOutskirts(builder, this.grid, this.realm.w, this.realm.d, mulberry32(99));
    this.fow = new FogOfWar(this.realm.w, this.realm.d, PAD);
    this.pipe.fow = { tex: this.fow.tex, x: this.fow.originX, z: this.fow.originZ, size: this.fow.worldSize, amount: 0 };
    builder.finish(this.scene);
    this.structures = builder.structures;
    const outside = (x: number, z: number) => x < 0 || z < 0 || x >= this.realm.w || z >= this.realm.d;
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
          const m = new Moonfire(o.id, o.name, o.x, o.z, this, o.indoor);
          this.moonfires.push(m);
          this.interactables.push(m);
          if (o.indoor) m.setLit(true, this);
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
          this.lever = new Lever(o.id, o.x, o.z, this, o.look);
          this.interactables.push(this.lever);
          break;
        case 'drawbridge':
          this.bridge = new Drawbridge(o.x0, o.z0, o.x1, o.z1, o.deck, this);
          break;
        case 'cage':
          this.cage = new Cage(o.x, o.z, this);
          break;
        case 'thornGate': {
          const t = new ThornGate(o.id, o.x, o.z, o.w, o.alongX, this);
          if (o.role === 'arena') this.hallDoor = t;
          else this.thornWall = t;
          break;
        }
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
        case 'bindings':
          this.bindings.push(new Bindings(o.id, o.x, o.z, this));
          break;
        case 'thorns': {
          const h = new ThornHedge(o.id, o.x, o.z, o.alongX, o.w, this);
          this.hedges.push(h);
          this.interactables.push(h);
          break;
        }
      }
    }
    // Arrow slits in towers, chandeliers over the boss's hall.
    for (const [x, y, z] of this.realm.slits ?? []) this.slits.push(new ArrowSlit(x, y, z, this));
    for (const c of this.realm.chandeliers ?? []) this.chandeliers.push(new Chandelier(c.x, c.z, c.floor, this));
    for (const [x, z] of this.realm.snares ?? []) this.snareTraps.push(new SnareTrap(x, z, this));
    for (const t of this.realm.thornBursts ?? []) this.thornBursts.push(new ThornBurst(t.x, t.z, t.w, t.d, t.ph, this));
    // The realm's relic trial (the Seven Stones in realm 1).
    if (this.realm.trial) {
      this.trial = new Trial(this.realm.trial, this);
      this.interactables.push(this.trial);
    }
    for (const c of this.realm.critters) this.critters.push(new Critter(c, this));
    // The warhorse: by the King's Road in realm 1, and wherever the realm keeps it after that.
    this.horse = new Mount(this.realm.horse.x, this.realm.horse.z, this);
    this.interactables.push(this.horse);
    this.mounts.push(this.horse);
    this.lastMount = this.horse;
    for (const d of this.realm.npcs) {
      const n = new Npc(d, this);
      this.npcs.push(n);
      this.interactables.push(n);
    }
    this.spawnEnemies();
    this.warmShaders();

    window.addEventListener('resize', () => this.pipe.resize());
    const saveNow = () => {
      if ((this.state === 'play' || this.state === 'victory') && this.save.exists && !this.leaving) this.writeSave();
    };
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    // Switching to another app or tab (or a phone's home screen) pauses the game.
    const autoPause = () => {
      if (this.state === 'play' && !this.paused && !this.ui.dialogOpen && !this.ui.loreOpen) this.setPaused(true);
    };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveNow();
        autoPause();
        this.audio.sleep(true);
      } else this.audio.sleep(false);
    });
    (window as unknown as { __game: Game }).__game = this;
    (window as unknown as { __reach: (p?: boolean) => unknown }).__reach = (progress = true) => reachability(this, progress);
  }

  /**
   * Firepots, target rings, power orbs, sword arcs and pickup sprites each use a shader
   * nothing else does; compiled on first use they froze a frame for ~170 ms. Compile
   * them now, against the same target the scene renders to.
   */
  private warmShaders() {
    const probes: THREE.Object3D[] = [];
    const at = (o: THREE.Object3D) => {
      o.position.set(this.realm.start.x, 1, this.realm.start.z);
      this.scene.add(o);
      probes.push(o);
    };
    at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: 0x8a5a3a, emissive: new THREE.Color(0.4, 0.15, 0.02) })));
    at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    const ring = this.combat.markTarget(this.realm.start.x, this.realm.start.z);
    const n = this.swooshes.length;
    this.swoosh(this.player, 0);
    this.swoosh(this.player, 4);
    const sprite = new SpriteActor(this.assets.pickups, { glow: 0.9, shadowSize: 0.25, shared: true });
    sprite.addTo(this.scene);
    sprite.setFrame(ALERT_FRAME, false);
    sprite.place(this.cam, this.realm.start.x, 1, this.realm.start.z, 0, true);
    this.pipe.compile(this.scene, this.cam.cam);
    // One real frame (hidden behind the loading screen) also builds the shadow-pass
    // variants, which compile() leaves out, and uploads the textures.
    this.pipe.render(this.scene, this.cam.cam);
    for (const o of probes) {
      this.scene.remove(o);
      const m = o as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.combat.clearMark(ring);
    for (const s of this.swooshes.splice(n)) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
    }
    sprite.dispose(this.scene);
  }

  private spawnEnemies() {
    for (const e of this.enemies) e.model.rig.removeFrom(this.scene);
    this.enemies = [];
    this.realm.enemies.forEach((s, id) => {
      if (s.off || this.save.data.killed.includes(id) || !this.story.spawns(this, s)) return;
      const e = new Enemy(s.type, s.x, s.z, this, s.group, s.guard, s.elite);
      e.spawnId = id;
      e.model.rig.addTo(this.scene);
      this.enemies.push(e);
      if (s.group === 'boss') this.boss = e;
    });
  }

  /** Reading, talking or watching a cutscene: foes, arrows and effects all wait. */
  get worldFrozen() {
    return this.ui.dialogOpen || this.ui.loreOpen || !!this.cutscene || this.state === 'victory' || this.leaving;
  }

  get controlsEnabled() {
    return this.state === 'play' && !this.paused && !this.ui.dialogOpen && !this.ui.loreOpen && !this.cutscene && this.player.state !== 'rest' && !this.leaving;
  }

  // ---------- flow ----------

  start() {
    this.applySave();
    this.state = 'title';
    // After a border crossing the travel card stays up a moment.
    if (this.travelling) setTimeout(() => this.screens.hideLoading(), 900);
    else this.screens.hideLoading();
    const mainMenu = () => {
      const items: { label: string; act: () => void }[] = [];
      if (this.save.exists) items.push({ label: 'Continue', act: () => this.beginPlay(false) });
      items.push({ label: this.save.exists ? 'New journey' : 'Begin', act: () => (this.save.exists ? askFirst() : this.beginPlay(true)) });
      this.screens.showTitle(items);
    };
    // Starting over wipes the save: ask first, with "keep it" as the default.
    const askFirst = () =>
      this.screens.showTitle(
        [
          { label: 'No, keep my journey', act: mainMenu },
          {
            label: 'Yes, start over',
            act: () => {
              this.save.reset();
              location.search.includes('shot') ? this.beginPlay(true) : (localStorage.setItem('realms-new', '1'), location.reload());
            },
          },
        ],
        'Start a new journey? Your saved progress will be lost.',
      );
    mainMenu();
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
    // Came over a border: straight back into the world, on the other side.
    if (this.travelling) {
      this.screens.hideTitle();
      this.beginPlay(false);
    }
    // Test shortcuts: ?play skips menus, &at=x,z places the knight, &dawn shows the ending light.
    const q = new URLSearchParams(location.search);
    if (q.has('play') && !this.travelling) {
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
    if (fresh && this.story.intro) {
      this.state = 'story';
      this.screens.showStory(this.story.intro, () => {
        this.enterWorld();
        const k = (a: Parameters<Input['label']>[0]) => `<kbd>${this.input.label(a)}</kbd>`;
        this.ui.hint(this.input.usingTouch ? 'Left thumb moves. Shield button: tap to roll, hold to block.' : `${k('move')}move &nbsp; ${k('aim')}aim &nbsp; ${k('attack')}attack &nbsp; ${k('guard')}tap roll, hold block &nbsp; ${k('jump')}jump`, 9);
      });
    } else this.enterWorld();
  }

  private enterWorld() {
    this.state = 'play';
    // Over a border: out at this side of it. Otherwise at the last moonfire, or the realm's start.
    // (From the menu, 'menu:<border>': the last moonfire if one is lit, else that border.)
    const want = this.save.arrival ?? '', fromMenu = want.startsWith('menu:');
    const arrival = this.realm.borders?.find((b) => b.id === (fromMenu ? want.slice(5) : want));
    this.save.arrival = null;
    const cp = this.moonfires.find((m) => m.id === this.save.data.checkpoint);
    const cpOk = !!cp && (cp.lit || cp.indoor);
    let face = { x: -0.7, z: -0.7 };
    if (arrival && !(fromMenu && cpOk)) {
      this.player.place(arrival.out.x, arrival.out.z, this);
      face = { x: arrival.out.fx, z: arrival.out.fz };
      this.horse.arriveAt(arrival.out.x - arrival.out.fz * 2.2, arrival.out.z + arrival.out.fx * 2.2, this);
    } else if (cp && cpOk) this.player.place(cp.x + 1.3, cp.z + 1.3, this);
    else this.player.place(this.realm.start.x, this.realm.start.z, this);
    this.player.rig.face(face.x, face.z, 0);
    this.player.fx = face.x;
    this.player.fz = face.z;
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
    for (const l of this.realm.landmarks ?? []) this.fow.reveal(l.x, l.z, l.r);
    this.player.coins = d.coins;
    this.player.flasksMax = d.flasksMax;
    this.player.flasks = d.flasksMax;
    this.player.swordLevel = d.sword;
    this.applyRelics();
    this.player.hp = this.player.maxHp;
    for (const s of this.shards) if (d.shards.includes(s.id)) s.remove(this);
    for (const w of this.crackedWalls) if (d.walls.includes(w.id)) w.smash(this, true);
    for (const h of this.hedges) if (d.walls.includes(h.id)) h.smash(this, true);
    for (const c of this.chests) if (d.chests.includes(c.id)) c.setOpen(true);
    for (const m of this.moonfires) if (d.lit.includes(m.id)) m.setLit(true, this);
    for (const b of this.bindings) if (d.mounts.includes('stag')) b.free(this, true);
    if (d.mounts.includes('stag')) this.addStag();
    this.story.apply(this);
    this.spawnEnemies();
  }

  /** The Thornstag, once freed, comes along to every realm (it waits at its home, or by the horse). */
  private addStag() {
    if (this.mounts.some((m) => m.kind === 'stag')) return;
    const home = this.realm.stagHome ?? { x: this.realm.horse.x + 2.4, z: this.realm.horse.z + 1.2 };
    const s = new Mount(home.x, home.z, this, 'stag');
    this.mounts.push(s);
    this.interactables.push(s);
    return s;
  }

  /** The last thorn knot is cut: the beast shakes itself free and will carry the knight. */
  freeBeast(b: Bindings) {
    if (!this.save.data.mounts.includes('stag')) this.save.data.mounts.push('stag');
    const s = this.addStag()!;
    s.arriveAt(b.x, b.z, this);
    s.home = { x: b.x, z: b.z };
    this.audio.sfx('bellow', b.x, b.z);
    this.fx.burst(P.leaf, b.x, b.y + 1.2, b.z, 30, 2, 3);
    this.pipe.flash = 0.15;
    this.pipe.flashColor.setRGB(0.7, 1, 0.5);
    this.ui.toast('The Thornstag is free', 'It will carry you. It leaps twice and fights with thorns.', 4);
    this.story.onBreak?.(this, b.id);
    this.writeSave();
  }

  /** Hearts and relic effects from what the knight has found in every realm. */
  private applyRelics() {
    const d = this.save.data;
    this.player.crest = d.relics.includes('crest');
    // Hearts: five, one for each realm's three Moon Shards, one for the Heartwood Seed.
    this.player.maxHp = 5 + this.save.shardSets + (d.relics.includes('heartwood') ? 1 : 0);
  }

  /** A relic won (from a realm's trial): kept, and its effect applied. */
  winRelic(id: string) {
    if (!this.save.data.relics.includes(id)) this.save.data.relics.push(id);
    this.applyRelics();
    if (id === 'heartwood') {
      this.player.hp = this.player.maxHp;
      this.ui.pulseHearts();
    }
  }

  /** Cross a border: save, fade, and reload the page into the realm on the other side. */
  travel(b: BorderDef) {
    if (this.leaving) return;
    this.writeSave();
    // From here the save's working view is the realm ahead: nothing from this one may be written into it.
    this.save.travel(b.to, b.arrive);
    this.leaving = true;
    try {
      sessionStorage.setItem(TRAVEL_KEY, JSON.stringify(b.card));
    } catch {
      /* ignore */
    }
    this.ui.fade(true);
    this.audio.music?.setTrack('');
    this.after(0.9, () => this.reload());
  }
  private leaving = false;
  /** Replaced in tests, which can't follow a real reload. */
  reload = () => location.reload();

  writeSave() {
    if (this.leaving) return;
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
    if (on) this.refreshMap();
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
    const def = this.quests.def(id);
    if (cur === undefined && !this.quests.done(id, step)) this.ui.questNote('New quest', def.title);
    else if (this.quests.done(id, step)) {
      this.ui.questNote('Quest complete', def.title);
      this.audio.sfx('rune');
    } else this.ui.questNote('Quest updated', def.title);
    this.refreshQuests();
    this.writeSave();
  }

  /** The pause menu's map: where the knight has been, and what's done in each realm. */
  refreshMap() {
    const here = this.def.id, built = Object.keys(REALMS);
    let furthest = -1;
    const realms: MapRealm[] = ROUTE.map((id, i) => {
      const place = built.includes(id) ? this.save.place(id as RealmId) : null;
      const reached = id === here || !!place;
      if (reached) furthest = Math.max(furthest, i);
      return { id, state: id === here ? 'here' : reached ? 'visited' : 'unknown', freed: !!place?.flags.boss, shards: place?.shards.length ?? 0, chests: place?.chests.length ?? 0 };
    });
    if (realms[furthest + 1]) realms[furthest + 1].state = 'rumour';
    this.screens.setWorldMap(realms);
  }

  refreshQuests() {
    const q = this.save.data.quests;
    const main = q.main;
    const def = this.quests.def('main');
    this.ui.objective(main !== undefined && !this.quests.done('main', main) ? def.short![main] : null);
    const shardsFound = this.save.data.shards.length;
    const rows = this.quests.list.filter((d) => q[d.id] !== undefined).map((d) => {
      const s = q[d.id];
      const done = this.quests.done(d.id, s);
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
      this.applyRelics();
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
    this.story.onBreak?.(this, w.id);
    this.writeSave();
  }

  /** A warhorse's charge tears through the thorns. */
  breakHedge(h: ThornHedge) {
    h.smash(this);
    this.audio.sfx('shieldBreak', h.x, h.z);
    this.audio.sfx('break', h.x, h.z);
    this.shake(0.7);
    this.hitstop(0.12);
    this.ui.toast('The thorns give way');
    if (!this.save.data.walls.includes(h.id)) this.save.data.walls.push(h.id);
    this.story.onBreak?.(this, h.id);
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
    const s = new SpriteActor(this.assets.pickups, { glow: 1.2, shared: true });
    s.mesh.castShadow = false;
    s.shadow.visible = false;
    this.scene.add(s.mesh);
    this.alerts.push({ s, e, t: 0 });
    if (this.settings.hints && this.firstTime('fight')) {
      this.ui.hint(this.input.usingTouch ? 'Enemies flash before they strike. Tap the shield to roll through, hold it to block.' : `Enemies flash before they strike. Tap <kbd>${this.input.label('guard')}</kbd> to roll through, hold it to block`, 7);
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

  enemyHitsPlayer(e: Enemy, dmg: number, opts: { kb?: number; unblockable?: boolean; guardCost?: number } = {}) {
    const res = this.player.hurt(dmg, e.x, e.z, this, opts);
    this.afterPlayerHit(res, e.x, e.z, e);
    return res;
  }

  arrowHitsPlayer(a: Arrow) {
    const res = this.player.hurt(1, a.x - a.vx, a.z - a.vz, this, { kb: 4 });
    this.afterPlayerHit(res, a.x, a.z, null);
    // Arrows can lodge in a leg.
    if (res === 'hit' && a.from && a.kind === 'arrow' && this.player.alive && !this.player.riding && Math.random() < FOES.archer.maimChance) this.player.afflict('maim', this);
    return res;
  }

  /** A bat's swoop: no hearts lost, but a shove, lost stamina, a broken action, maybe lost coins. */
  batHits(e: Enemy) {
    const p = this.player;
    const res = p.harass(e.x, e.z, this, { kb: 5, stamina: FOES.bat.stamina });
    if (res === 'blocked') {
      this.audio.sfx('guard', e.x, e.z);
      e.vx = -e.fx * 6;
      e.vz = -e.fz * 6;
    }
    if (res !== 'hit') return false;
    this.audio.sfx('bat', e.x, e.z);
    this.fx.burst(P.dust, p.x, p.y + 1, p.z, 5, 1.5);
    if (e.thief && e.loot === 0 && p.coins > 0) {
      const [a, b] = FOES.bat.steal;
      const n = Math.min(p.coins, a + Math.floor(Math.random() * (b - a + 1)));
      p.coins -= n;
      e.loot = n;
      this.pop(p, `-${n} coins! a bat snatched them`, '#feae34');
      this.audio.sfx('steal', e.x, e.z);
      e.state = 'flee';
      e.t = 0;
      return true;
    }
    return false;
  }

  /** The first time each effect lands, say how to deal with it. */
  effectTip(kind: string) {
    if (!this.firstTime('fx-' + kind)) return;
    const touch = this.input.usingTouch;
    const roll = touch ? 'tap the shield' : `tap <kbd>${this.input.label('guard')}</kbd>`;
    const drink = touch ? 'the flask button' : `<kbd>${this.input.label('heal')}</kbd>`;
    const tips: Record<string, string> = {
      burn: `<b>Burning</b>: ${roll} to roll, or step into water, before it costs a heart.`,
      maim: `<b>Maimed</b>: you move slower for a while. Drink a flask (${drink}) to cure it, even at full health.`,
      poison: `<b>Poisoned</b>: stamina comes back at half speed. Drink a flask (${drink}) to cure it, even at full health.`,
      daze: `<b>Dazed</b>: the brute's maul and charges knock the wits out of you. A parry turns them back.`,
      snare: `<b>Snared</b>: held fast for a moment. You can still swing and block; a flask (${drink}) frees you.`,
    };
    this.ui.hint(tips[kind] ?? '', 7);
  }

  /** A snarer's bola: no hearts lost, but it holds the knight fast (blocked by a shield). */
  bolaHitsPlayer(a: Arrow) {
    const p = this.player;
    const res = p.harass(a.x - a.vx, a.z - a.vz, this, { kb: 0.5, stamina: 8 });
    if (res === 'blocked') this.audio.sfx('guard', a.x, a.z);
    if (res === 'hit') p.afflict('snare', this);
    return res;
  }

  /** A snare trap bites: a heart, and held fast. */
  snareBites(x: number, z: number) {
    const p = this.player;
    const res = p.hurt(EFFECTS.trapBite, x, z, this, { unblockable: true, kb: 0.5 });
    this.afterPlayerHit(res, x, z, null);
    if (p.alive) p.afflict('snare', this, { time: EFFECTS.snareTime + 0.4 });
    this.fx.burst(P.spark, x, p.y + 0.2, z, 10, 2, 1.5);
    if (this.firstTime('snaretrap')) this.ui.hint(this.input.usingTouch ? 'Snare traps glint in the grass. Strike one (the sword button) to spring it safely.' : `Snare traps glint in the grass. Strike one (<kbd>${this.input.label('attack')}</kbd>) to spring it safely.`, 7);
  }

  /** The ravine's thorns burst up under the knight: a heart and a shove. */
  thornsHit(x: number, z: number) {
    const p = this.player;
    const res = p.hurt(1, x, z, this, { unblockable: true, kb: 7 });
    this.afterPlayerHit(res, x, z, null);
    if (res === 'hit') this.pop(p, 'thorns!', '#d8e8a0');
    if (this.firstTime('thornburst')) this.ui.hint('The thorns rustle before they burst. Wait for them to sink, then run.', 6);
  }

  /** The thornback's thorns prick the knight when he strikes it before it's stunned. */
  thornsPrick(e: Enemy) {
    const p = this.player;
    if (!p.alive || p.riding) return;
    const res = p.harass(e.x, e.z, this, { kb: 4, stamina: FOES.thornback.prickStamina });
    if (res === 'hit') this.pop(p, 'pricked!', '#d8e8a0');
    if (this.firstTime('thornback')) this.ui.hint('Its thorns prick whatever strikes them. Stun it first: parry it, or let it charge into a tree.', 7);
  }

  /** A blowpipe dart: no hearts lost, but poison. */
  dartHitsPlayer(a: Arrow) {
    const p = this.player;
    const res = p.harass(a.x - a.vx, a.z - a.vz, this, { kb: 1.5, stamina: 10 });
    if (res === 'blocked') this.audio.sfx('guard', a.x, a.z);
    if (res === 'hit') p.afflict('poison', this);
    return res;
  }

  /** The brute's maul comes down: a crack in the ground and a cloud of dust. */
  hammerImpact(e: Enemy) {
    const x = e.x + e.fx * 1.6, z = e.z + e.fz * 1.6;
    this.audio.sfx('thud', x, z);
    this.shake(0.35);
    this.fx.burst(P.puff, x, this.grid.groundAt(x, z) + 0.1, z, 10, 2.5);
    this.fx.burst(P.spark, x, this.grid.groundAt(x, z) + 0.2, z, 6, 3, 2);
  }

  /** The brute's maul lands on the knight: a heavy blow that may leave him dazed. */
  bruteHits(e: Enemy) {
    const res = this.enemyHitsPlayer(e, 1, { kb: 9, guardCost: FOES.brute.guardCost });
    if (res === 'hit' && this.player.alive && Math.random() < FOES.brute.dazeChance) this.player.afflict('daze', this);
    if (res === 'blocked') this.pop(this.player, 'heavy blow!', '#c0c0cc');
    return res;
  }

  /** The shaman sings: nearby goblins heal and quicken, idle ones join the fight. */
  shamanChant(s: Enemy) {
    this.audio.sfx('chant', s.x, s.z);
    this.fx.burst(P.heal2, s.x, s.y + 1.2, s.z, 20, 3, 2);
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e === s || e.isBoss || e.type === 'bat') continue;
      if (Math.hypot(e.x - s.x, e.z - s.z) > FOES.shaman.chantRange) continue;
      e.hp = Math.min(e.maxHp, e.hp + FOES.shaman.heal);
      e.hasteT = FOES.shaman.hasteTime;
      if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
      this.fx.burst(P.heal2, e.x, e.y + 1, e.z, 10, 1, 1.5);
      n++;
    }
    if (n) this.pop(s, 'war-chant!', '#9ef07a');
  }

  /** The shaman vanishes and reappears further from the knight. Returns false if there was no room. */
  shamanBlink(s: Enemy) {
    const p = this.player;
    const away = Math.atan2(s.z - p.z, s.x - p.x);
    for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
      const a = away + off, r = 5.5;
      const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!this.grid.inside(cx, cz) || this.grid.isDeep(cx, cz) || this.grid.solid[this.grid.i(cx, cz)]) continue;
      if (Math.abs(this.grid.groundAt(x, z) - s.y) > 1 || !this.grid.lineClear(s.x, s.z, x, z, s.y + 0.5)) continue;
      this.fx.burst(P.puff, s.x, s.y + 0.8, s.z, 12, 2);
      this.fx.burst(P.bubble, s.x, s.y + 0.8, s.z, 10, 2, 1);
      s.x = x;
      s.z = z;
      s.y = this.grid.groundAt(x, z);
      this.fx.burst(P.puff, x, s.y + 0.8, z, 12, 2);
      this.audio.sfx('blink', x, z);
      return true;
    }
    return false;
  }

  /** A thief bat got away: gone for good, and so are the coins. */
  batEscaped(e: Enemy) {
    this.pop(e, `the bat got away with ${e.loot} coins`, '#8a82a3');
    if (e.spawnId !== undefined && !this.save.data.killed.includes(e.spawnId)) this.save.data.killed.push(e.spawnId);
    e.loot = 0;
    e.despawn(this);
  }

  waveHitsPlayer(w: Wave) {
    if (!this.player.onGround) return;
    const res = this.player.hurt(1, w.x, w.z, this, { unblockable: true, kb: 9 });
    this.afterPlayerHit(res, w.x, w.z, null);
  }

  /** Feedback after something reaches the knight (hit, blocked, parried...). */
  afterHit(res: string, x: number, z: number, e: Enemy | null) {
    this.afterPlayerHit(res, x, z, e);
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
      if (this.firstTime('parry')) {
        this.ui.toast('Parry!', 'The foe is stunned and takes extra damage');
      }
    }
  }

  onEnemyDeath(e: Enemy) {
    this.kills++;
    this.save.data.kills++;
    if (e.spawnId !== undefined && !this.save.data.killed.includes(e.spawnId)) this.save.data.killed.push(e.spawnId);
    this.audio.sfx('enemyDie', e.x, e.z);
    this.fx.burst(P.puff, e.x, e.y + 0.5, e.z, 8, 2);
    if (!e.isBoss) {
      // The trial's foes carry nothing (the stones pay once, when it's won), so dying and
      // retrying can't farm them. A thief bat's loot comes back as it was, never multiplied.
      const n = (e.group === 'trial' ? 0 : e.coinDrop * this.comboMult) + e.loot;
      if (n) this.combat.coins(e.x, e.y + 0.5, e.z, n);
      if (this.comboMult > 1 && e.group !== 'trial') this.pop(e, `x${this.comboMult} coins`, '#feae34');
      if (Math.random() < 0.12 && this.player.hp < this.player.maxHp) this.combat.spawnPickup('heart', e.x, e.y + 0.5, e.z);
      if (e.elite) {
        this.combat.powerOrb(e.x, e.y + 0.8, e.z);
        this.pop(e, 'ELITE DEFEATED', '#feae34');
        this.audio.sfx('victory');
      }
      if (e.golden) this.pop(e, 'golden!', '#feae34');
    }
    if (e === this.boss) this.onBossDeath(e);
    // Groups cleared, beasts slain: the realm's story.
    this.story.onKill(this, e);
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

  /** The captive locked in the realm's cage. */
  get captive() {
    return this.npcs.find((n) => n.def.caged);
  }

  hitCage() {
    const c = this.cage;
    if (!c) return;
    c.hp--;
    this.audio.sfx('clang', c.x, c.z);
    this.fx.burst(P.spark, c.x, c.y + 1, c.z, 10, 4, 2);
    this.hitstop(0.05);
    if (c.hp > 0) {
      const who = this.captive;
      if (who) this.bubbleAt(who, this.story.cageHolds);
      return;
    }
    c.breakOpen(this);
    this.audio.sfx('shieldBreak', c.x, c.z);
    this.story.onCageOpen(this);
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
    // Counted now (and saved with the open chest below), so nothing can be lost.
    this.player.coins += c.coins;
    this.after(0.35, () => {
      this.combat.coins(c.x, c.y + 0.6, c.z, c.coins, true);
      if (c.power || Math.random() < 0.35) this.combat.powerOrb(c.x, c.y + 0.9, c.z, c.power);
      this.fx.burst(P.coinGlint, c.x, c.y + 0.7, c.z, 20, 2, 3);
      const l = this.lights.add(c.x, c.y + 1, c.z, 0xffc060, 8, 5, 0.1);
      this.after(1.2, () => this.lights.remove(l));
      this.ui.toast(`${c.coins} coins`);
    });
    this.save.data.chests.push(c.id);
    this.writeSave();
  }

  pullLever() {
    this.story.onLever(this);
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
    p.cureAll();
    p.rest();
    for (const mm of this.mounts) mm.hp = mm.maxHp;
    // The mount last ridden finds the knight at a far-off moonfire.
    const h = this.lastMount;
    if (!p.riding && h.state !== 'flee' && Math.hypot(h.x - m.x, h.z - m.z) > 25 && !m.indoor) {
      h.arriveAt(m.x - 2.2, m.z + 1.5, this);
      h.model.rig.root.visible = true;
      this.after(1.5, () => this.pop(h, `your ${h.called} finds you`, '#feae34'));
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
    if (d.caged && this.cage && !this.cage.open) {
      this.bubbleAt(n, this.story.cagedPlea);
      return;
    }
    this.talking = n;
    const said = this.story.talk(this, n, d.after && this.save.data.flags.rescued ? d.after : d.lines);
    if (said === 'handled') {
      this.audio.sfx('ui');
      return;
    }
    let lines = said;
    if (this.victory) lines = [this.story.victoryLine(d.id)];
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
      const top = d.upTo ?? 3, cost = [80, 150, 240, 400, 560][p.swordLevel] ?? 0;
      const bonus = (L: number) => Math.round((Math.min(3, L) * 0.25 + Math.max(0, L - 3) * 0.15) * 100);
      const maxed = p.swordLevel >= top;
      options = [
        { label: maxed ? (top > 3 ? 'The heartwood temper is as fine as it gets' : 'The blade is as sharp as it gets') : `${p.swordLevel >= 3 ? 'Temper' : 'Sharpen'} my sword (level ${p.swordLevel + 1})`, cost: !maxed ? cost : undefined, disabled: maxed || p.coins < cost, act: () => this.buy(cost, () => { p.swordLevel++; this.ui.toast(p.swordLevel > 3 ? 'Sword tempered' : 'Sword sharpened', `+${bonus(p.swordLevel)}% damage`); }) },
        { label: 'Not now', act: done },
      ];
    }
    this.ui.say(n.name, lines, done, options);
    this.audio.sfx('ui');
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
    const b = this.boss, info = this.story.boss;
    if (!b || !info || this.bossActive || !b.alive) return;
    this.bossActive = true;
    this.hallDoor?.setOpen(false, this);
    this.audio.music?.setTrack('');
    this.focus(b.x + 1, b.y + 1.2, b.z, 3.2, () => {
      this.ui.bossShow(info.name);
      this.audio.music?.setTrack('boss');
    });
    this.after(0.8, () => {
      b.wake(this);
      this.audio.sfx('roar', b.x, b.z);
      this.shake(0.5);
      this.bubbleAt(b, info.lines.wake);
      this.ui.bossIntro(info.intro[0], info.intro[1], 2.6);
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
    const info = this.story.boss!, arena = this.realm.arena!;
    this.audio.sfx('roar', e.x, e.z);
    this.bubbleAt(e, e.enraged ? info.lines.summonEnraged : info.lines.summon);
    const kinds = e.enraged ? info.summons.enraged : info.summons.calm;
    for (const [i, [x, z]] of arena.summons.entries()) {
      const g = new Enemy(kinds[i % kinds.length], x, z, this, 'boss');
      g.model.rig.addTo(this.scene);
      g.state = 'chase';
      this.enemies.push(g);
      e.summoned.push(g);
      this.fx.burst(P.puff, x, this.grid.groundAt(x, z) + 0.2, z, 10, 2);
    }
  }

  /** The Thorn Warden marks a spot: arrows will rain on it, or roots burst up through it. */
  wardenMark(x: number, z: number, kind: 'rain' | 'roots', delay: number) {
    this.wardenMarks.push(new WardenMark(x, z, kind, delay, this));
  }

  /** A marked spot's arrows land (a shield raised toward the Warden stops them) or its roots burst. */
  wardenMarkLands(m: WardenMark) {
    const p = this.player, b = this.boss;
    if (p.alive && Math.hypot(p.x - m.x, p.z - m.z) < 1.0 && p.y - m.y < 1.4) {
      const res = m.kind === 'rain' ? p.hurt(1, b?.x ?? m.x, b?.z ?? m.z, this, { kb: 3 }) : p.hurt(1, m.x, m.z, this, { unblockable: true, kb: 6 });
      this.afterPlayerHit(res, m.x, m.z, null);
      if (res === 'blocked') this.audio.sfx('guard', p.x, p.z);
      else if (res === 'hit') this.pop(p, m.kind === 'rain' ? 'arrows!' : 'roots!', '#d8e8a0');
    }
    // Roots don't care whom they catch.
    if (m.kind === 'roots')
      for (const e of this.enemies)
        if (e.alive && !e.isBoss && !e.flying && Math.hypot(e.x - m.x, e.z - m.z) < 1.1) e.prick(2, this);
  }

  bossEnrage(e: Enemy) {
    this.audio.sfx('roar', e.x, e.z);
    this.shake(0.7);
    this.bubbleAt(e, this.story.boss?.lines.enrage ?? '');
    this.pipe.flash = 0.2;
    this.pipe.flashColor.setRGB(1, 0.3, 0.2);
  }

  chandelierShake() {
    const dust = this.realm.arena?.dust;
    if (dust) for (let i = 0; i < 18; i++) this.fx.emit(P.dust, dust[0] + Math.random() * dust[1], dust[2], dust[3] + Math.random() * dust[4], 0, -1, 0);
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
    this.bubbleAt(e, this.story.boss?.lines.death ?? '');
    this.slowmo(0.2, 1.4);
    this.pipe.flash = 0.5;
    this.pipe.flashColor.setRGB(1, 0.95, 0.8);
    this.ui.bossHide();
    this.audio.music?.setTrack('');
    for (const s of e.summoned) if (s.alive) s.die(this);
    this.story.onBossDeath(this, e);
    this.writeSave();
    this.victory = true;
    this.after(2.5, () => {
      this.audio.sfx('victory');
      this.hallDoor?.setOpen(true, this);
      this.dawnTarget = 1;
      this.audio.music?.setTrack('dawn');
      const d = this.save.data;
      const mins = Math.floor(d.playTime / 60);
      this.screens.showVictory(this.story.victoryText, `${d.kills} foes defeated &middot; ${this.player.coins} coins &middot; ${d.deaths} falls &middot; ${mins} min`);
      this.state = 'victory';
      this.victoryT = 0;
    });
  }

  private viewer(anim: string, tFixed: string | null) {
    const models = [makeKnight(false), makeGoblin(false), makeGoblin(true), makeArcher(), makeBat(), makeBrute(), makeBomber(), makeDarter(), makeShaman(), makeBoar(), makeKing(), makeVillager('old'), makeVillager('girl'), makeVillager('smith'), makeSpitter(), makeSnarer(), makeThornback()];
    const [cx, cz] = this.realm.viewer ?? [this.realm.titleView.x, this.realm.titleView.z];
    const R = this.cam.groundRight, U = this.cam.groundUp;
    models.forEach((m, i) => {
      m.rig.addTo(this.scene);
      const col = (i % 5) - 2, row = (1 - Math.floor(i / 5)) * 2.2;
      const x = cx + R.x * col * 2.4 + U.x * row * 1.6, z = cz + R.z * col * 2.4 + U.z * row * 1.6;
      const y = this.grid.groundAt(x, z) + (i === 4 ? 1.2 : 0);
      m.rig.face(0.7, 0.7, 0);
      this.viewerModels.push({ m, x, y, z });
    });
    this.player.place(cx - 19, cz - 4.5, this);
    this.fow.revealAll();
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
    this.trial?.reset(this);
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
      if (cp && (cp.lit || cp.indoor)) p.place(cp.x + 1.3, cp.z + 1.3, this);
      else p.place(this.realm.start.x, this.realm.start.z, this);
      this.cam.focus.set(p.x, p.y, p.z);
      // Survivors regroup and heal; flames and pots in flight are gone.
      for (const f of this.combat.fires) f.t = f.life;
      for (const pot of this.combat.pots) pot.t = -1;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.cancelAim(this);
        if ((e.group === 'boss' && !e.isBoss) || e.group === 'trial') {
          e.despawn(this);
          continue;
        }
        e.hp = e.maxHp;
        e.x = e.home.x;
        e.z = e.home.z;
        e.y = e.flying ? this.grid.groundAt(e.x, e.z) + 1.3 : this.grid.groundAt(e.x, e.z);
        e.state = e.isBoss ? 'sleep' : 'idle';
        e.enraged = false;
        e.model.rig.lift = 0;
      }
      if (this.boss?.alive) for (const c of this.chandeliers) c.reset();
      if (this.bossActive) {
        this.bossActive = false;
        this.ui.bossHide();
        if (this.story.arenaOpen(this)) this.hallDoor?.setOpen(true, this, true);
        if (this.boss) this.boss.model.rig.face(1, 0, 0);
      }
      this.combat.arrows.forEach((a) => (a.dead = true));
      for (const m of this.wardenMarks) m.remove(this);
      this.wardenMarks = [];
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

    // Timers (delayed dialogs, cutscenes, respawns) wait while the game is paused.
    const tdt = this.paused ? 0 : real;
    for (const t of this.timers) t.t -= tdt;
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
      if (inp.keyPressed('ArrowUp') || inp.keyPressed('KeyW')) this.screens.titleKey('up');
      if (inp.keyPressed('ArrowDown') || inp.keyPressed('KeyS')) this.screens.titleKey('down');
      if (inp.keyPressed('Enter') || inp.keyPressed('Space') || inp.keyPressed('KeyE')) this.screens.titleKey('ok');
      if (inp.usingPad) {
        const y = inp.padMove.y;
        if (Math.abs(y) > 0.6 && !this.padHeld) this.screens.titleKey(y > 0 ? 'up' : 'down');
        this.padHeld = Math.abs(y) > 0.6;
        if (inp.hit('attack') || inp.hit('interact') || inp.hit('jump')) this.screens.titleKey('ok');
      }
      inp.swallow();
      return;
    }
    if (this.state === 'story') {
      if (inp.anyPressed) this.screens.storyKey();
      inp.swallow();
      return;
    }
    if (this.state === 'dead') {
      this.deadT += real;
      if (this.deadT > 3 && inp.anyPressed) {
        this.deadT = -99;
        this.respawn();
      }
      inp.swallow();
      return;
    }
    if (inp.hit('pause')) {
      if (this.ui.loreOpen) this.ui.closeLore();
      else if (!this.ui.dialogOpen) this.setPaused(!this.paused);
    }
    if (this.paused) {
      if (inp.keyPressed('ArrowUp') || inp.keyPressed('KeyW')) this.screens.pauseKey('up');
      if (inp.keyPressed('ArrowDown') || inp.keyPressed('KeyS')) this.screens.pauseKey('down');
      if (inp.keyPressed('Enter') || inp.keyPressed('KeyE')) this.screens.pauseKey('ok');
      if (inp.usingPad) {
        const y = inp.padMove.y;
        if (Math.abs(y) > 0.6 && !this.padHeld) this.screens.pauseKey(y > 0 ? 'up' : 'down');
        this.padHeld = Math.abs(y) > 0.6;
        if (inp.hit('jump') || inp.hit('interact') || inp.hit('attack')) this.screens.pauseKey('ok');
        if (inp.hit('guard')) this.setPaused(false);
      }
      inp.swallow();
      return;
    }
    // Dialogs and reading answer the same keys as the menus (E, Enter, Space, or the pad's
    // A, X or Y; up and down pick an answer), and the press that closes one goes no further:
    // it mustn't start the talk again or make the knight jump. (A mouse click only counts on
    // the dialog box itself, so a stray click can't pick a shop option.)
    const ok = inp.hit('interact') || inp.hit('jump') || inp.keyPressed('Enter') || (inp.usingPad && inp.hit('attack'));
    if (this.ui.dialogOpen) {
      if (inp.keyPressed('KeyW') || inp.keyPressed('ArrowUp')) this.ui.dialogKey('up');
      if (inp.keyPressed('KeyS') || inp.keyPressed('ArrowDown')) this.ui.dialogKey('down');
      if (inp.usingPad) {
        const y = inp.padMove.y;
        if (Math.abs(y) > 0.6 && !this.padHeld) this.ui.dialogKey(y > 0 ? 'up' : 'down');
        this.padHeld = Math.abs(y) > 0.6;
      }
      if (ok) this.ui.dialogKey('ok');
      inp.swallow();
      return;
    }
    if (this.ui.loreOpen) {
      if (ok && this.ui.closeLore()) this.audio.sfx('ui');
      inp.swallow();
      return;
    }
    if (this.state === 'victory') {
      this.victoryT += real;
      if (this.victoryT > 4 && (inp.anyPressed || this.victoryT > 12)) {
        this.screens.hideVictory();
        this.state = 'play';
        inp.swallow();
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
    this.realm.debugSpots.forEach(([x, z], i) => {
      if (inp.keyPressed(`Digit${i + 1}`)) this.player.place(x, z, this);
    });
    // N and B: over to the next or previous realm, finished or not.
    if (inp.keyPressed('KeyN') || inp.keyPressed('KeyB')) this.jumpRealm(inp.keyPressed('KeyN') ? 1 : -1);
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
      const frozen = this.worldFrozen;
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
    for (const m of this.mounts) m.update(dt, this);
    for (const b of this.bindings) b.update(dt, this);
    for (const s of this.shards) s.update(dt, this);
    for (const c of this.critters) c.update(dt, this);
    const hdt = this.ui.dialogOpen || this.cutscene || this.state !== 'play' ? 0 : dt;
    for (const s of this.slits) s.update(hdt, this);
    for (const t of this.snareTraps) t.update(hdt, this);
    for (const t of this.thornBursts) t.update(hdt, this);
    if (this.wardenMarks.length) {
      for (const m of this.wardenMarks) m.update(hdt, this);
      this.wardenMarks = this.wardenMarks.filter((m) => !m.done);
    }
    for (const c of this.chandeliers) c.update(dt, this);
    this.chandelierCd -= dt;
    this.trial?.update(this.worldFrozen ? 0 : dt, this);
    for (const v of this.viewerModels) {
      const t = this.viewerT ?? (this.time % 1.2);
      v.m.animate(0, v.x, v.z, this.viewerAnim, t, this.time, { dur: 0.4 });
      v.m.rig.place(this.cam, v.x, v.y, v.z, this.grid.groundAt(v.x, v.z));
    }
    for (const c of this.chests) c.update(dt);
    this.lever?.update(dt);
    this.bridge?.update(dt, this);
    this.hallDoor?.update(dt);
    this.thornWall?.update(dt);
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
    this.ui.effects(p.effects, p.effectMax);
    if (this.pipe.flash > 0) this.pipe.flash = Math.max(0, this.pipe.flash - real * 1.5);
    this.pipe.desat = damp(this.pipe.desat, this.state === 'dead' ? 0.85 : p.hp <= 1 ? 0.35 : 0, 3, real);
    this.audio.setMuffle(this.paused ? 700 : this.state === 'dead' ? 500 : p.hp <= 1 ? 2500 : 20000);

    if (this.state === 'play') {
      this.story.tick(this, dt);
      this.checkBorders();
    }
  }

  /** Walked (or rode) into a border: over to the realm on the other side. */
  private checkBorders() {
    const p = this.player;
    if (!p.alive || this.leaving || this.cutscene) return;
    for (const b of this.realm.borders ?? []) if (Math.hypot(p.x - b.x, p.z - b.z) < b.r) return this.travel(b);
  }

  /** Debug: cross to the next or previous realm from wherever the knight stands. */
  private jumpRealm(step: number) {
    const ids = Object.keys(REALMS) as RealmId[];
    this.travelTo(ids[(ids.indexOf(this.def.id) + step + ids.length) % ids.length]);
  }

  /**
   * From the pause menu (or debug keys): over to another realm, finished or not. You come
   * out at your last moonfire there, or else where the road from this realm comes in.
   */
  travelTo(to: RealmId) {
    if (to === this.def.id) return;
    const road = this.realm.borders?.find((b) => b.to === to);
    this.travel({ id: 'menu', to, arrive: `menu:${road?.arrive ?? ''}`, x: 0, z: 0, r: 0, out: { x: 0, z: 0, fx: 0, fz: 0 }, card: [this.def.name, REALMS[to].name] });
  }

  private lastDevice = '';
  private checkInteract() {
    document.body.classList.toggle('touch', this.input.usingTouch);
    document.body.classList.toggle('pad', this.input.usingPad);
    if (this.input.device !== this.lastDevice) {
      this.lastDevice = this.input.device;
      this.ui.refreshKeys();
    }
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
      this.ui.prompt(this.input.usingTouch ? '!Strike the cage with your sword to break the lock' : 'Strike the cage to break the lock', this.input.label('attack'));
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
      this.story.onRegion(this, r);
      if (!prev || prev.name !== r.name) {
        this.ui.area(r.name, this.story.areaSub(this, r));
        this.audio.sfx('area');
      }
      if (!this.bossActive || !this.boss?.alive) this.audio.music?.setTrack(this.victory ? 'dawn' : r.music === 'tavern' ? '' : r.music);
    }
  }

  private checkBossTrigger() {
    const p = this.player, b = this.boss, a = this.realm.arena;
    if (!b || !a || !b.alive || this.bossActive || this.save.data.flags.boss) return;
    if (p.x > a.x0 && p.x < a.x1 && p.z > a.z0 && p.z < a.z1 && p.y > a.y) this.startBoss();
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
      const tv = this.realm.titleView;
      f.set(tv.x + Math.sin(t) * 8, 1.5, tv.z + Math.cos(t * 0.7) * 6);
      this.cam.focus.copy(f);
    } else if (this.cutscene) {
      const c = this.cutscene;
      if (!this.paused) c.t += real;
      f.set(c.x, c.y, c.z);
      this.cam.focus.x = damp(this.cam.focus.x, f.x, 3, real);
      this.cam.focus.y = damp(this.cam.focus.y, f.y, 3, real);
      this.cam.focus.z = damp(this.cam.focus.z, f.z, 3, real);
      if (c.t >= c.dur) {
        this.cutscene = null;
        c.onEnd?.();
      }
    } else if (this.viewerModels.length) {
      const [vx, vz] = this.realm.viewer ?? [this.realm.titleView.x, this.realm.titleView.z];
      f.set(vx, 1.4, vz);
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
    // A war drum beats while its camp stands.
    const dr = this.realm.drums;
    const drums = dr && this.enemies.some((e) => e.alive && e.group === dr.group) ? 1 / (1 + (Math.hypot(p.x - dr.x, p.z - dr.z) / 12) ** 2) : 0;
    const dawnMul = 1 - this.dawn * 0.8;
    a.update(real, {
      x: p.x, z: p.z, wind, crickets: crickets * dawnMul, owls: owls * dawnMul, water: this.ambCache.water, fire: this.ambCache.fire,
      drums, indoor: amb === 'indoor',
    });
    // The inn's tune leaks out into the street.
    const inn = this.realm.inn;
    if (inn) {
      const td = Math.hypot(p.x - inn.x, p.z - inn.z);
      const inside = this.region?.name === inn.region;
      a.music?.setTavern(this.state === 'title' ? 0.25 : inside ? 0.8 : 0.9 / (1 + (td / 6) ** 2), inside);
    } else a.music?.setTavern(0, false);
  }

  private realmFires() {
    return this.realm.builder.fires;
  }

  private updateDawn(real: number) {
    if (Math.abs(this.dawn - this.dawnTarget) > 0.0001) this.dawn = damp(this.dawn, this.dawnTarget, 0.25, real);
    const k = this.dawn;
    const n = this.def.night, d = this.def.dawn, a = this.pipe.atmo;
    const mix = (c: THREE.Color, x: [number, number, number], y: [number, number, number]) => c.setRGB(lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k));
    mix(this.moon.color, n.moon, d.moon);
    this.moon.intensity = lerp(n.moonI, d.moonI, k);
    mix(this.hemi.color, n.hemi, d.hemi);
    mix(this.hemi.groundColor, n.ground, d.ground);
    this.hemi.intensity = lerp(n.hemiI, d.hemiI, k);
    mix(a.fogColor, n.fog, d.fog);
    mix(a.fogTop, n.fogTop, d.fogTop);
    mix(a.mistColor, n.mist, d.mist);
    mix(a.lift, n.lift, d.lift);
    a.warmth = lerp(n.warmth, d.warmth, k);
    a.exposure = lerp(n.exposure, d.exposure, k);
    a.mistAmount = lerp(n.mistAmount, d.mistAmount, k);
    a.cloud = lerp(n.cloud, d.cloud, k);
  }

  private render(real: number) {
    void real;
    void VIEW;
    this.pipe.render(this.scene, this.cam.cam);
  }
}
