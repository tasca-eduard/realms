import * as THREE from 'three';
import { VIEW } from '../config';
import { spriteMaterial } from './materials';
import type { IsoCamera } from './camera';

const COS_EL = Math.cos((VIEW.elevation * Math.PI) / 180);

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

export function pixelTexture(src: HTMLImageElement | HTMLCanvasElement) {
  const t = new THREE.Texture(src);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Anchor (feet) inside the frame, in pixels from the top-left. */
  ax: number;
  ay: number;
}

let blobTex: THREE.Texture | null = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  // Hard-edged pixel ellipse, two tones.
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / 8, dy = (y + 0.5 - 8) / 8;
      const d = dx * dx + dy * dy;
      if (d < 1) {
        g.fillStyle = d < 0.45 ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)';
        g.fillRect(x, y, 1, 1);
      }
    }
  blobTex = pixelTexture(c);
  return blobTex;
}

/** Materials and frame quads shared by every "shared" sprite on a sheet (coins, alerts). */
const sharedMats = new Map<string, { mat: THREE.Material; depth: THREE.MeshDepthMaterial }>();
const sharedQuads = new Map<string, THREE.BufferGeometry>();
let emptyQuad: THREE.BufferGeometry | null = null;
let blobShared: { geo: THREE.PlaneGeometry; mat: THREE.MeshBasicMaterial } | null = null;

function quad() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(8), 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

/** Shape a quad to show one frame, feet at the origin. */
function frameQuad(geo: THREE.BufferGeometry, tex: THREE.Texture, f: Frame, flip: boolean) {
  const ppu = VIEW.ppu;
  const ax = flip ? f.w - f.ax : f.ax;
  const l = -ax / ppu, r = (f.w - ax) / ppu;
  const b = -(f.h - f.ay) / (ppu * COS_EL), t = f.ay / (ppu * COS_EL);
  const P = geo.getAttribute('position') as THREE.BufferAttribute;
  P.setXYZ(0, l, b, 0);
  P.setXYZ(1, r, b, 0);
  P.setXYZ(2, r, t, 0);
  P.setXYZ(3, l, t, 0);
  P.needsUpdate = true;
  const img = tex.image as { width: number; height: number };
  let u0 = f.x / img.width, u1 = (f.x + f.w) / img.width;
  const v0 = 1 - (f.y + f.h) / img.height, v1 = 1 - f.y / img.height;
  if (flip) [u0, u1] = [u1, u0];
  const U = geo.getAttribute('uv') as THREE.BufferAttribute;
  U.setXY(0, u0, v0);
  U.setXY(1, u1, v0);
  U.setXY(2, u1, v1);
  U.setXY(3, u0, v1);
  U.needsUpdate = true;
  geo.computeBoundingSphere();
}

/**
 * A camera-facing, upright billboard that shows one frame of a sprite sheet at
 * exactly one texel per render pixel. Position is the feet.
 *
 * A "shared" sprite (many short-lived copies: coins, alert marks) reuses one material
 * and one quad per frame instead of making its own, so spawning a handful costs
 * almost nothing; it can't flash, tint or have a silhouette of its own.
 */
export class SpriteActor {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  silhouette: THREE.Mesh | null = null;
  pos = new THREE.Vector3();
  flip = false;
  private geo: THREE.BufferGeometry;
  private flashU: { value: number };
  private tintU: { value: THREE.Color };
  private tex: THREE.Texture;
  private frameKey = '';
  private shared: boolean;
  shadowSize = 0.7;
  lift = 0;

  constructor(tex: THREE.Texture, opts: { silhouette?: boolean; glow?: number; shadowSize?: number; shared?: boolean } = {}) {
    this.tex = tex;
    this.shared = !!opts.shared;
    // A shared sprite shows the empty quad until its first frame is set.
    this.geo = this.shared ? (emptyQuad ??= quad()) : quad();
    const glow = opts.glow ?? 0.22;
    let mat: THREE.Material, depth: THREE.MeshDepthMaterial;
    if (this.shared) {
      const key = `${tex.uuid}:${glow}`;
      let s = sharedMats.get(key);
      if (!s) {
        s = { mat: spriteMaterial(tex, glow).mat, depth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 }) };
        sharedMats.set(key, s);
      }
      ({ mat, depth } = s);
      // Its own (unused) uniforms, so setting flash or tint can't touch the others.
      this.flashU = { value: 0 };
      this.tintU = { value: new THREE.Color(1, 1, 1) };
    } else {
      const m = spriteMaterial(tex, glow);
      mat = m.mat;
      this.flashU = m.flash;
      this.tintU = m.tint;
      depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    }
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.rotation.y = (VIEW.yaw * Math.PI) / 180;
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = depth;
    this.mesh.frustumCulled = false;

    if (this.shared) {
      blobShared ??= { geo: new THREE.PlaneGeometry(1, 0.6), mat: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }) };
      this.shadow = new THREE.Mesh(blobShared.geo, blobShared.mat);
    } else {
      const sm = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), sm);
    }
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    this.shadowSize = opts.shadowSize ?? 0.7;

    if (opts.silhouette && !this.shared) {
      const m = new THREE.MeshBasicMaterial({
        map: tex,
        alphaTest: 0.5,
        color: new THREE.Color(0.35, 0.45, 1.0),
        transparent: true,
        opacity: 0.5,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.silhouette = new THREE.Mesh(this.geo, m);
      this.silhouette.rotation.copy(this.mesh.rotation);
      this.silhouette.renderOrder = 10;
      this.silhouette.frustumCulled = false;
    }
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.mesh, this.shadow);
    if (this.silhouette) scene.add(this.silhouette);
  }

  dispose(scene: THREE.Object3D) {
    this.removeFrom(scene);
    if (this.shared) return;
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.customDepthMaterial?.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    (this.silhouette?.material as THREE.Material | undefined)?.dispose();
  }

  removeFrom(scene: THREE.Object3D) {
    scene.remove(this.mesh, this.shadow);
    if (this.silhouette) scene.remove(this.silhouette);
  }

  set flash(v: number) {
    this.flashU.value = v;
  }
  get tint() {
    return this.tintU.value;
  }

  setFrame(f: Frame, flip: boolean) {
    const key = `${f.x},${f.y},${f.w},${f.h},${flip}`;
    if (key === this.frameKey) return;
    this.frameKey = key;
    if (this.shared) {
      // One quad per frame of the sheet, made the first time that frame is shown.
      const k = `${this.tex.uuid}:${key}`;
      let q = sharedQuads.get(k);
      if (!q) {
        q = quad();
        frameQuad(q, this.tex, f, flip);
        sharedQuads.set(k, q);
      }
      this.mesh.geometry = q;
      return;
    }
    frameQuad(this.geo, this.tex, f, flip);
  }

  /** Place at feet position; groundY is where the shadow goes. */
  place(cam: IsoCamera, x: number, y: number, z: number, groundY: number, visible = true) {
    this.pos.set(x, y + this.lift, z);
    const v = cam.snap(this.pos.clone());
    this.mesh.position.copy(v);
    if (this.silhouette) this.silhouette.position.copy(v);
    this.mesh.visible = visible;
    if (this.silhouette) this.silhouette.visible = visible;
    const air = Math.max(0, y + this.lift - groundY);
    const s = this.shadowSize * Math.max(0.4, 1 - air * 0.25);
    this.shadow.position.set(x, groundY + 0.03, z);
    this.shadow.scale.set(s, s, 1);
    this.shadow.visible = visible;
  }
}
