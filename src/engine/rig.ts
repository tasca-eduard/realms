import * as THREE from 'three';
import { Geo } from './geo';
import { glowMaterial } from './materials';
import type { IsoCamera } from './camera';
import { angleLerp } from './util';

/** Lit material for character parts, with hit flash and tint. */
function rigMaterial() {
  const flash = { value: 0 };
  const tint = { value: new THREE.Color(1, 1, 1) };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = flash;
    sh.uniforms.uTint = tint;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uFlash; uniform vec3 uTint;`)
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= uTint;
         // A touch of self-light so characters stay readable at night.
         outgoingLight += diffuseColor.rgb * 0.07;
         outgoingLight = mix(outgoingLight, vec3(1.7, 1.6, 1.5), uFlash);
         #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'rig';
  return { mat, flash, tint };
}

// See-through silhouette: drawn only where the character is hidden (depth
// test inverted) and only over pixels no character owns (stencil 0).
function silhouetteMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.5,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
}

let blobTex: THREE.Texture | null = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / 8, dy = (y + 0.5 - 8) / 8;
      const d = dx * dx + dy * dy;
      if (d < 1) {
        g.fillStyle = d < 0.45 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.28)';
        g.fillRect(x, y, 1, 1);
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  blobTex = t;
  return t;
}

/**
 * A character made of rigid low-poly parts in a joint hierarchy.
 * The root sits at the feet and turns to face the move/aim direction.
 * Local forward is +z; the right hand is on -x.
 */
export class Rig {
  root = new THREE.Group();
  joints: Record<string, THREE.Group> = {};
  rest: Record<string, { p: THREE.Vector3; r: THREE.Euler }> = {};
  yaw = 0;
  private flashU: { value: number };
  private tintU: { value: THREE.Color };
  mat: THREE.MeshLambertMaterial;
  glow = glowMaterial();
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  meshes: THREE.Mesh[] = [];
  silMat: THREE.MeshBasicMaterial | null = null;
  silMeshes: THREE.Mesh[] = [];
  /** Extra lift (jumps), in world units. */
  lift = 0;
  scale = 1;

  constructor(opts: { silhouette?: boolean; shadow?: number } = {}) {
    const { mat, flash, tint } = rigMaterial();
    this.mat = mat;
    this.flashU = flash;
    this.tintU = tint;
    if (opts.silhouette) this.enableSilhouette(new THREE.Color(0.3, 0.42, 1.1), 1);
    const sm = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sm);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    const s = opts.shadow ?? 0.8;
    this.shadow.scale.set(s, s * 0.8, 1);
    this.joints.root = this.root;
    this.root.rotation.order = 'YXZ';
  }

  /** Add a joint under a parent at a local offset. */
  joint(name: string, parent: string, x: number, y: number, z: number) {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    j.rotation.order = 'YXZ';
    this.joints[parent].add(j);
    this.joints[name] = j;
    this.rest[name] = { p: j.position.clone(), r: j.rotation.clone() };
    return j;
  }

  /** Attach geometry built in the joint's local space. */
  part(joint: string, build: (g: Geo, glow: Geo) => void) {
    const g = new Geo(), gl = new Geo(true);
    build(g, gl);
    const j = this.joints[joint];
    if (g.count) {
      const geo = g.build();
      const m = new THREE.Mesh(geo, this.mat);
      m.castShadow = true;
      m.receiveShadow = true;
      j.add(m);
      this.meshes.push(m);
      if (this.silMat) this.addSil(m);
    }
    if (gl.count) j.add(new THREE.Mesh(gl.build(), this.glow));
  }

  /**
   * Let this character be seen through whatever hides it. ref marks its own
   * pixels in the stencil so no silhouette is drawn over a visible character.
   */
  enableSilhouette(color: THREE.ColorRepresentation, ref: number) {
    this.silMat = silhouetteMaterial(color);
    this.mat.stencilWrite = true;
    this.mat.stencilRef = ref;
    this.mat.stencilFunc = THREE.AlwaysStencilFunc;
    this.mat.stencilZPass = THREE.ReplaceStencilOp;
    for (const m of this.meshes) this.addSil(m);
  }

  private addSil(m: THREE.Mesh) {
    const s = new THREE.Mesh(m.geometry, this.silMat!);
    s.renderOrder = 10;
    m.parent!.add(s);
    this.silMeshes.push(s);
  }

  showSilhouette(on: boolean) {
    for (const s of this.silMeshes) s.visible = on;
  }

  /** Reset every joint to its rest pose before posing. */
  reset() {
    for (const [k, r] of Object.entries(this.rest)) {
      const j = this.joints[k];
      j.position.copy(r.p);
      j.rotation.copy(r.r);
    }
  }

  j(name: string) {
    return this.joints[name];
  }

  set flash(v: number) {
    this.flashU.value = v;
  }
  get tint() {
    return this.tintU.value;
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.root, this.shadow);
  }
  /** Remove and free GPU memory (geometries and per-rig materials). */
  dispose(scene: THREE.Object3D) {
    this.removeFrom(scene);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.mat.dispose();
    this.glow.dispose();
    this.silMat?.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }

  removeFrom(scene: THREE.Object3D) {
    scene.remove(this.root, this.shadow);
  }

  /** Turn toward a world-space direction. */
  face(fx: number, fz: number, dt: number, rate = 14) {
    const target = Math.atan2(fx, fz);
    this.yaw = dt <= 0 ? target : angleLerp(this.yaw, target, 1 - Math.exp(-rate * dt));
  }

  place(cam: IsoCamera, x: number, y: number, z: number, groundY: number, visible = true) {
    const v = cam.snap(new THREE.Vector3(x, y + this.lift, z));
    this.root.position.copy(v);
    this.root.rotation.y = this.yaw;
    this.root.scale.setScalar(this.scale);
    this.root.visible = visible;
    const air = Math.max(0, y + this.lift - groundY);
    const k = Math.max(0.35, 1 - air * 0.22);
    this.shadow.position.set(x, groundY + 0.03, z);
    this.shadow.material.opacity = k;
    this.shadow.visible = visible;
  }
}
