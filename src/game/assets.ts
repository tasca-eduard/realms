import * as THREE from 'three';
import { pixelTexture, type Frame } from '../engine/sprites';

// Villager looks: colours for the code-built villager models.
export interface Look {
  skin: string;
  hair: string;
  cloth: string;
  cloth2: string;
  pants: string;
  boots: string;
  /** Rough height class: under 18 is a child. */
  h: number;
  hat?: 'hood' | 'helmet';
  hatCol?: string;
  bald?: boolean;
  beard?: string;
  apron?: string;
  dress?: boolean;
  longHair?: boolean;
}

export const LOOKS: Record<string, Look> = {
  old: { skin: '#e0b090', hair: '#d8d8e0', cloth: '#5a4a7a', cloth2: '#4a3a66', pants: '#3a3050', boots: '#2a2230', h: 21, hat: 'hood', hatCol: '#4a3a66', dress: true },
  woman: { skin: '#e8b890', hair: '#7a4a2a', cloth: '#4a6a9a', cloth2: '#3a5a86', pants: '#3a4a6a', boots: '#3a2a20', h: 21, apron: '#d8d0c0', dress: true, longHair: true },
  girl: { skin: '#f0c8a0', hair: '#c88a3a', cloth: '#8a6a3a', cloth2: '#7a5a2a', pants: '#5a4a2a', boots: '#3a2a20', h: 16, dress: true, longHair: true },
  keeper: { skin: '#e0a880', hair: '#6a4a2a', cloth: '#7a4a3a', cloth2: '#6a3a2a', pants: '#3a2e28', boots: '#2a2018', h: 22, bald: true, beard: '#6a4a2a', apron: '#d8d0c0' },
  smith: { skin: '#c89070', hair: '#2a2a2a', cloth: '#4a4a52', cloth2: '#3a3a42', pants: '#2e2a28', boots: '#1e1a18', h: 23, beard: '#2a2a2a', apron: '#5a3a2a' },
  captive: { skin: '#e8b890', hair: '#c88a3a', cloth: '#7a6a4a', cloth2: '#6a5a3a', pants: '#4a3a2a', boots: '#3a2a20', h: 19 },
  woodreeve: { skin: '#d8a888', hair: '#c8c8c0', cloth: '#3b6b2a', cloth2: '#2e5420', pants: '#3a3024', boots: '#2a2018', h: 21, hat: 'hood', hatCol: '#3b6b2a', beard: '#c8c8c0' },
  woodwife: { skin: '#e0b090', hair: '#5a3a26', cloth: '#6b4226', cloth2: '#5a3620', pants: '#3a3024', boots: '#2a2018', h: 21, hat: 'hood', hatCol: '#5a7a3a', dress: true },
  woodsmith: { skin: '#c89070', hair: '#3a2a1a', cloth: '#5a7a3a', cloth2: '#4a6a2e', pants: '#2e2a20', boots: '#1e1a14', h: 23, beard: '#3a2a1a', apron: '#6b4226' },
  woodboy: { skin: '#f0c8a0', hair: '#6b4226', cloth: '#5a7a3a', cloth2: '#4a6a2e', pants: '#4a3a26', boots: '#2a2018', h: 16, hat: 'hood', hatCol: '#6b4226' },
  woodgirl: { skin: '#f0c8a0', hair: '#8a5a2a', cloth: '#3b6b2a', cloth2: '#2e5420', pants: '#4a3a26', boots: '#2a2018', h: 17, longHair: true, dress: true },
  herbwife: { skin: '#d8a888', hair: '#b8b8b0', cloth: '#5a4a6a', cloth2: '#4a3a5a', pants: '#3a3024', boots: '#2a2018', h: 20, hat: 'hood', hatCol: '#44603a', dress: true },
  guard: { skin: '#e0b090', hair: '#8a8a8a', cloth: '#6a2a2a', cloth2: '#5a2020', pants: '#3a3a44', boots: '#2a2a30', h: 22, hat: 'helmet', hatCol: '#8a8a9a', beard: '#9a9a9a' },
};

// ---------- small pickups (billboards: they look the same from every side) ----------

function paintPickups() {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 8;
  const g = c.getContext('2d')!;
  const P = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const widths = [7, 5, 3, 5];
  widths.forEach((w, f) => {
    const ox = f * 8 + Math.floor((7 - w) / 2);
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < w; x++) {
        const edge = x === 0 || x === w - 1 || y === 0 || y === 6;
        const corner = (x === 0 || x === w - 1) && (y === 0 || y === 6);
        if (corner && w > 3) continue;
        P(ox + x, y, edge ? '#b86f10' : x === 1 && w > 3 ? '#fff0a0' : '#feae34');
      }
  });
  const heart = ['.XX.XX.', 'XHHXRRX', 'XHRRRRX', 'XRRRRRX', '.XRRRX.', '..XRX..', '...X...'];
  heart.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'X') P(32 + x, y, '#5a1020');
      if (ch === 'R') P(32 + x, y, '#e43b44');
      if (ch === 'H') P(32 + x, y, '#ff9aa0');
    }),
  );
  // Alert mark.
  for (let y = 0; y < 5; y++) P(41, y, '#feae34');
  for (let y = 0; y < 5; y++) P(42, y, '#feae34');
  P(41, 6, '#feae34');
  P(42, 6, '#feae34');
  return c;
}

export function coinFrame(f: number): Frame {
  return { x: (f % 4) * 8, y: 0, w: 8, h: 7, ax: 4, ay: 6 };
}
export const HEART_FRAME: Frame = { x: 32, y: 0, w: 8, h: 7, ax: 3, ay: 6 };
export const ALERT_FRAME: Frame = { x: 40, y: 0, w: 4, h: 7, ax: 2, ay: 7 };

export interface Assets {
  pickups: THREE.Texture;
}

export async function loadAssets(): Promise<Assets> {
  return { pickups: pixelTexture(paintPickups()) };
}
