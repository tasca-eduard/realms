import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { P } from '../engine/particles';
import type { Collider } from '../world/grid';
import { PAL, GLOW } from '../world/builder';
import { Enemy } from './enemies';
import type { Game } from './game';
import type { Interactable } from './objects';
import type { TrialDef } from '../world/realm';

/**
 * A realm's relic trial (the Seven Stones in realm 1): strike the altar, a ring of
 * runes seals the circle, and three waves come. Win and the relic is yours.
 */
export class Trial implements Interactable {
  y: number;
  radius = 1.8;
  state: 'idle' | 'wave' | 'between' | 'won' = 'idle';
  wave = 0;
  t = 0;
  private barrier: THREE.Group;
  private colliders: Collider[] = [];
  private foes: Enemy[] = [];
  private runeMat: THREE.MeshBasicMaterial;
  readonly R = 6.2;

  x: number;
  z: number;
  constructor(public def: TrialDef, g: Game) {
    const { x, z } = def;
    this.x = x;
    this.z = z;
    this.y = g.grid.groundAt(x, z);
    // Altar.
    const a = new Geo(), gl = new Geo(true);
    a.box(0, 0, 0, 1.4, 0.35, 1.0, PAL.stoneDark, { kind: K.Brick });
    a.box(0, 0.35, 0, 1.1, 0.5, 0.7, PAL.stone, { kind: K.Rock });
    a.box(0, 0.85, 0, 1.3, 0.12, 0.9, PAL.stoneDark, { kind: K.Flag });
    for (let i = 0; i < 5; i++) gl.box(-0.4 + i * 0.2, 0.55, 0.36, 0.08, 0.12, 0.02, GLOW.rune, {});
    const altar = new THREE.Group();
    const m = new THREE.Mesh(a.build(), worldMaterial());
    m.castShadow = m.receiveShadow = true;
    altar.add(m, new THREE.Mesh(gl.build(), glowMaterial()));
    altar.position.set(x, this.y, z);
    g.scene.add(altar);
    g.grid.addCollider({ kind: 'b', x0: x - 0.7, z0: z - 0.5, x1: x + 0.7, z1: z + 0.5, y0: this.y - 1, y1: this.y + 1 });
    // Barrier of rune pillars, hidden until the trial starts.
    this.barrier = new THREE.Group();
    this.runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.8, 3.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const n = 28;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const px = x + Math.cos(ang) * this.R, pz = z + Math.sin(ang) * this.R;
      const py = g.grid.groundAt(px, pz);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), this.runeMat);
      beam.position.set(px, py + 1.2, pz);
      this.barrier.add(beam);
      this.colliders.push(g.grid.addCollider({ kind: 'c', x: px, z: pz, r: 0.75, y0: -50, y1: 50, on: false }));
    }
    this.barrier.visible = false;
    g.scene.add(this.barrier);
    g.lights.add(x, this.y + 1.2, z + 0.6, 0x6aa0ff, 3, 5, 0.1);
  }

  private get won() {
    return this.state === 'won';
  }

  prompt(g: Game) {
    if (this.won || g.save.data.relics.includes(this.def.relic)) return null;
    return this.state === 'idle' ? this.def.prompt : null;
  }

  interact(g: Game) {
    if (this.state !== 'idle' || g.save.data.relics.includes(this.def.relic)) return;
    this.state = 'between';
    this.wave = 0;
    this.t = 1.2;
    this.seal(true, g);
    g.audio.sfx('moonfire', this.x, this.z);
    g.ui.toast(...this.def.wake);
    g.quest(this.def.quest, 0);
  }

  private seal(on: boolean, g: Game) {
    this.barrier.visible = on;
    for (const c of this.colliders) c.on = on;
    if (on) g.fx.burst(P.rune, this.x, this.y + 1, this.z, 40, 5, 2);
  }

  /** The knight fell mid-trial: everything resets. */
  reset(g: Game) {
    if (this.state === 'idle' || this.state === 'won') return;
    for (const e of this.foes) if (e.alive) e.despawn(g);
    this.foes = [];
    this.seal(false, g);
    this.state = 'idle';
  }

  update(dt: number, g: Game) {
    if (this.barrier.visible) {
      this.runeMat.opacity = 0.55 + 0.25 * Math.sin(g.time * 6);
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2;
        g.fx.emit(P.rune, this.x + Math.cos(a) * this.R, this.y + Math.random() * 2, this.z + Math.sin(a) * this.R, 0, 0.6, 0);
      }
    }
    if (this.state === 'between') {
      this.t -= dt;
      if (this.t <= 0) this.spawnWave(g);
    } else if (this.state === 'wave') {
      if (this.foes.every((e) => !e.alive)) {
        this.wave++;
        if (this.wave >= this.def.waves.length) this.win(g);
        else {
          this.state = 'between';
          this.t = 2;
          g.ui.toast(`Wave ${this.wave + 1} of ${this.def.waves.length}`);
        }
      }
    }
  }

  private spawnWave(g: Game) {
    this.state = 'wave';
    this.foes = [];
    const list = this.def.waves[this.wave];
    list.forEach((s, i) => {
      const a = (i / list.length) * Math.PI * 2 + this.wave;
      const x = this.x + Math.cos(a) * 3.8, z = this.z + Math.sin(a) * 3.8;
      const e = new Enemy(s.type, x, z, g, 'trial', false, s.elite);
      e.home = { x: this.x, z: this.z };
      e.state = 'chase';
      e.model.rig.addTo(g.scene);
      g.enemies.push(e);
      this.foes.push(e);
      g.fx.burst(P.puff, x, g.grid.groundAt(x, z) + 0.5, z, 10, 2);
      g.fx.burst(P.rune, x, g.grid.groundAt(x, z) + 1, z, 12, 2, 2);
    });
    g.audio.sfx('roar', this.x, this.z);
  }

  private win(g: Game) {
    this.state = 'won';
    this.seal(false, g);
    g.winRelic(this.def.relic);
    g.audio.sfx('victory');
    g.fx.burst(P.bluespark, this.x, this.y + 1.2, this.z, 50, 5, 3);
    // The old pilgrims' offerings, paid once (the trial's foes drop nothing).
    g.player.coins += this.def.purse;
    g.combat.coins(this.x, this.y + 1, this.z, this.def.purse, true);
    g.ui.toast(this.def.win[0], this.def.win[1], 4.5);
    g.quest(this.def.quest, 1);
  }
}
