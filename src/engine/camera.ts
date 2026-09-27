import * as THREE from 'three';
import { VIEW } from '../config';
import type { Pipeline } from './pipeline';

const DEG = Math.PI / 180;

/**
 * Orthographic isometric camera. The rendered camera is snapped to the pixel grid
 * of the low-res buffer; the leftover fraction is handed to the pipeline as a
 * screen-space offset so motion stays smooth.
 */
export class IsoCamera {
  cam: THREE.OrthographicCamera;
  /** Point the camera looks at (smoothed). */
  focus = new THREE.Vector3();
  /** Unit vectors of the view in world space. */
  right = new THREE.Vector3();
  up = new THREE.Vector3();
  forward = new THREE.Vector3();
  /** Ground-plane directions for screen right / screen up. */
  groundRight = new THREE.Vector3();
  groundUp = new THREE.Vector3();
  shakeAmp = 0;
  private shakeT = 0;
  private offsetDir = new THREE.Vector3();

  constructor() {
    this.cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 260);
    const el = VIEW.elevation * DEG, yaw = VIEW.yaw * DEG;
    this.offsetDir.set(Math.cos(el) * Math.sin(yaw), Math.sin(el), Math.cos(el) * Math.cos(yaw));
    this.cam.position.copy(this.offsetDir).multiplyScalar(VIEW.distance);
    this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld();
    this.right.setFromMatrixColumn(this.cam.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(this.cam.matrixWorld, 1).normalize();
    this.forward.setFromMatrixColumn(this.cam.matrixWorld, 2).negate().normalize();
    this.groundRight.set(this.right.x, 0, this.right.z).normalize();
    this.groundUp.set(-this.offsetDir.x, 0, -this.offsetDir.z).normalize();
  }

  shake(amount: number) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  update(p: Pipeline, dt: number, shakeEnabled = true) {
    const ppu = VIEW.ppu;
    const c = this.cam;
    c.left = -p.w / 2 / ppu;
    c.right = p.w / 2 / ppu;
    c.top = p.h / 2 / ppu;
    c.bottom = -p.h / 2 / ppu;
    c.updateProjectionMatrix();

    this.shakeT += dt;
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 3.2);
    const s = shakeEnabled ? this.shakeAmp * this.shakeAmp : 0;
    const sx = (Math.sin(this.shakeT * 71) + Math.sin(this.shakeT * 43.7)) * 0.5 * s;
    const sy = (Math.sin(this.shakeT * 57.3) + Math.cos(this.shakeT * 38.1)) * 0.5 * s;

    // Desired camera position, then snap its screen-plane coordinates to pixels.
    const pos = new THREE.Vector3().copy(this.focus).addScaledVector(this.offsetDir, VIEW.distance);
    pos.addScaledVector(this.right, sx).addScaledVector(this.up, sy);
    const r = pos.dot(this.right), u = pos.dot(this.up);
    const rs = Math.round(r * ppu) / ppu, us = Math.round(u * ppu) / ppu;
    pos.addScaledVector(this.right, rs - r).addScaledVector(this.up, us - u);
    p.offset.set((r - rs) * ppu, (u - us) * ppu);
    c.position.copy(pos);
    c.updateMatrixWorld();
  }

  /** Snap a world position so a sprite at it lands on whole pixels. */
  snap(v: THREE.Vector3) {
    const ppu = VIEW.ppu;
    const r = v.dot(this.right), u = v.dot(this.up);
    v.addScaledVector(this.right, Math.round(r * ppu) / ppu - r);
    v.addScaledVector(this.up, Math.round(u * ppu) / ppu - u);
    return v;
  }

  /** Project a world point to CSS pixel coordinates. */
  toScreen(v: THREE.Vector3, out: { x: number; y: number }) {
    const p = v.clone().project(this.cam);
    out.x = (p.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    return out;
  }
}
