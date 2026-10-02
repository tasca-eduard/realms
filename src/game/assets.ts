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
  hat?: 'hood' | 'helmet' | 'souwester';
  hatCol?: string;
  bald?: boolean;
  beard?: string;
  apron?: string;
  dress?: boolean;
  longHair?: boolean;
  /** Something carried: a fishing rod (right hand), a basket (left), a sack on the back. */
  prop?: 'rod' | 'basket' | 'sack';
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
  // Hollowbough's folk about their day.
  woodfisher: { skin: '#d8a888', hair: '#7a6a5a', cloth: '#5a6a5a', cloth2: '#4a5a4a', pants: '#3a3024', boots: '#2a2018', h: 21, hat: 'hood', hatCol: '#6a7a5a', beard: '#7a6a5a', prop: 'rod' },
  woodwasher: { skin: '#e8b890', hair: '#8a5a3a', cloth: '#7a5a8a', cloth2: '#6a4a7a', pants: '#3a3024', boots: '#2a2018', h: 20, apron: '#d8d0c0', dress: true, longHair: true },
  woodelder: { skin: '#d8a888', hair: '#e0e0e0', cloth: '#4a5a3a', cloth2: '#3a4a2e', pants: '#3a3024', boots: '#2a2018', h: 20, beard: '#e0e0e0', hat: 'hood', hatCol: '#3a4a2e' },
  woodchild: { skin: '#f0c8a0', hair: '#a86a2a', cloth: '#6a8a3a', cloth2: '#5a7a2e', pants: '#4a3a26', boots: '#2a2018', h: 15 },
  woodlass: { skin: '#f0c8a0', hair: '#d8a050', cloth: '#8a5a6a', cloth2: '#7a4a5a', pants: '#4a3a26', boots: '#2a2018', h: 15, dress: true, longHair: true },
  woodgardener: { skin: '#e0b090', hair: '#6a4a2a', cloth: '#5a6a3a', cloth2: '#4a5a2e', pants: '#3a3024', boots: '#2a2018', h: 21, apron: '#a8c080', dress: true, hat: 'hood', hatCol: '#8a6a3a', prop: 'basket' },
  woodward: { skin: '#d8a888', hair: '#4a3a2a', cloth: '#3b5b2a', cloth2: '#2e4a20', pants: '#2e2a20', boots: '#1e1a14', h: 22, hat: 'hood', hatCol: '#2e4a20' },
  woodcarrier: { skin: '#c89070', hair: '#3a2a1a', cloth: '#7a6a4a', cloth2: '#6a5a3a', pants: '#3a3024', boots: '#2a2018', h: 22, bald: true, beard: '#3a2a1a', prop: 'sack' },
  // The Sunken Reef's coral village: oilskins and sou'westers in faded sea colours (the prototype's fisher look).
  reefmaster: { skin: '#d8a888', hair: '#c8c8c0', cloth: '#3a5a78', cloth2: '#2e4a66', pants: '#3a3a44', boots: '#2a2a30', h: 22, hat: 'souwester', hatCol: '#2e4a66', beard: '#c8c8c0' },
  reefwife: { skin: '#e0b090', hair: '#8a4a2a', cloth: '#e8a060', cloth2: '#c88a50', pants: '#4a3a30', boots: '#2a2018', h: 21, apron: '#d8d0c0', dress: true, longHair: true },
  reefsmith: { skin: '#c89070', hair: '#2a2a2a', cloth: '#6a7aa8', cloth2: '#5a6a96', pants: '#2e2a30', boots: '#1e1a20', h: 22, apron: '#7a5a4a', longHair: true },
  reefdiver: { skin: '#d8a080', hair: '#2a1a14', cloth: '#3a8aa8', cloth2: '#2e7290', pants: '#3a3a44', boots: '#2a2a30', h: 21, longHair: true, dress: true },
  reefboy: { skin: '#e0a880', hair: '#2a1a14', cloth: '#3a8aa8', cloth2: '#2e7290', pants: '#4a4a3a', boots: '#2a2018', h: 16 },
  reefold: { skin: '#d8a888', hair: '#e0e0e0', cloth: '#6a7aa8', cloth2: '#5a6a96', pants: '#3a3a44', boots: '#2a2a30', h: 20, hat: 'souwester', hatCol: '#e8c060', dress: true },
  reefdiver2: { skin: '#c89070', hair: '#d0d0d0', cloth: '#e8a060', cloth2: '#c88a50', pants: '#3a3a44', boots: '#2a2a30', h: 21, hat: 'souwester', hatCol: '#e8c060', beard: '#d0d0d0' },
  reefcomber: { skin: '#d8a888', hair: '#6a5a4a', cloth: '#7a7a5a', cloth2: '#6a6a4a', pants: '#3a3024', boots: '#2a2018', h: 22, hat: 'souwester', hatCol: '#c8a040', beard: '#6a5a4a', prop: 'sack' },
  reefmender: { skin: '#e0b090', hair: '#4a2a1a', cloth: '#3a8aa8', cloth2: '#2e7290', pants: '#3a3a44', boots: '#2a2a30', h: 21, apron: '#c8b890', dress: true, hat: 'souwester', hatCol: '#e8c060' },
  reefchild: { skin: '#f0c8a0', hair: '#c88a3a', cloth: '#e8a060', cloth2: '#c88a50', pants: '#4a4a3a', boots: '#2a2018', h: 15 },
  // ...and its night: the inn's regulars, fishers with their rods, children, the cook, the boatwright, the carver.
  reefsalt: { skin: '#c89070', hair: '#d0d0d0', cloth: '#2e3a5a', cloth2: '#26304a', pants: '#3a3a44', boots: '#2a2a30', h: 22, bald: true, beard: '#d0d0d0' },
  reeflad: { skin: '#e0b090', hair: '#8a5a2a', cloth: '#5a7aa0', cloth2: '#4a6a8a', pants: '#3a3a44', boots: '#2a2a30', h: 21 },
  reefold2: { skin: '#d8a888', hair: '#b0b0a8', cloth: '#7a7a5a', cloth2: '#6a6a4a', pants: '#3a3a44', boots: '#2a2a30', h: 20, hat: 'souwester', hatCol: '#3a5a78', beard: '#b0b0a8' },
  reeffisher: { skin: '#d8a888', hair: '#4a3a2a', cloth: '#d8b040', cloth2: '#b89030', pants: '#3a3a44', boots: '#2a2a30', h: 22, hat: 'souwester', hatCol: '#d8b040', beard: '#4a3a2a', prop: 'rod' },
  reeffisher2: { skin: '#e0b090', hair: '#2a1a14', cloth: '#3a5a78', cloth2: '#2e4a66', pants: '#3a3a44', boots: '#2a2a30', h: 21, hat: 'souwester', hatCol: '#e8a060', longHair: true, prop: 'rod' },
  reeffisher3: { skin: '#c89070', hair: '#3a2a1a', cloth: '#5a6a5a', cloth2: '#4a5a4a', pants: '#3a3024', boots: '#2a2018', h: 22, hat: 'souwester', hatCol: '#3a4a3a', beard: '#3a2a1a', prop: 'rod' },
  reefgirl: { skin: '#f0c8a0', hair: '#5a3a1a', cloth: '#3a8aa8', cloth2: '#2e7290', pants: '#4a4a3a', boots: '#2a2018', h: 16, dress: true, longHair: true, prop: 'rod' },
  reeflass: { skin: '#f0c8a0', hair: '#5a3a1a', cloth: '#3a8aa8', cloth2: '#2e7290', pants: '#4a4a3a', boots: '#2a2018', h: 16, dress: true, longHair: true },
  reefgirl2: { skin: '#e0a880', hair: '#2a1a14', cloth: '#b86a5c', cloth2: '#9a5a4c', pants: '#4a4a3a', boots: '#2a2018', h: 15, dress: true, longHair: true },
  reefchild2: { skin: '#f0c8a0', hair: '#d8a050', cloth: '#5a7aa0', cloth2: '#4a6a8a', pants: '#4a4a3a', boots: '#2a2018', h: 15 },
  reefchild3: { skin: '#e0b090', hair: '#6a3a1a', cloth: '#8a9a6a', cloth2: '#7a8a5a', pants: '#4a4a3a', boots: '#2a2018', h: 16, hat: 'souwester', hatCol: '#d8b040' },
  reefcook: { skin: '#e0b090', hair: '#6a3a2a', cloth: '#b86a5c', cloth2: '#9a5a4c', pants: '#4a3a30', boots: '#2a2018', h: 21, apron: '#d8d0c0', dress: true, longHair: true },
  reefwright: { skin: '#c89070', hair: '#2a2a2a', cloth: '#4a4a3a', cloth2: '#3a3a2e', pants: '#2e2a28', boots: '#1e1a18', h: 23, beard: '#2a2a2a', apron: '#3a2a20' },
  reefcarver: { skin: '#d8a080', hair: '#c8c0b0', cloth: '#8a9a6a', cloth2: '#7a8a5a', pants: '#3a3a44', boots: '#2a2a30', h: 21, apron: '#e0d0c8', dress: true, longHair: true },
  reefgran: { skin: '#d8a888', hair: '#e8e8e8', cloth: '#5a4a6a', cloth2: '#4a3a5a', pants: '#3a3a44', boots: '#2a2a30', h: 19, dress: true, hat: 'souwester', hatCol: '#6a7aa8', apron: '#b8b0a0' },
  // The reef's errands (src/world/errands.ts): Brill the fisher, Wrasse the diver lad, Cockle the diver and his wife Winkle.
  reeffisher4: { skin: '#c89070', hair: '#5a4a3a', cloth: '#5a7a6a', cloth2: '#4a6a5a', pants: '#3a3a44', boots: '#2a2a30', h: 22, hat: 'souwester', hatCol: '#e8c060', beard: '#5a4a3a', prop: 'rod' },
  reeflad2: { skin: '#d8a080', hair: '#8a5a2a', cloth: '#3a6a8a', cloth2: '#2e5a76', pants: '#3a3a44', boots: '#2a2018', h: 18 },
  reefdiver3: { skin: '#d8a888', hair: '#3a2a1e', cloth: '#e07050', cloth2: '#c05a40', pants: '#4a4a58', boots: '#2a2a30', h: 21, beard: '#3a2a1e', hat: 'souwester', hatCol: '#e8e0c8' },
  reefwife2: { skin: '#e0b090', hair: '#3a2a1e', cloth: '#6a8aa8', cloth2: '#5a7a96', pants: '#4a3a30', boots: '#2a2018', h: 20, apron: '#c8b890', dress: true, longHair: true, hat: 'hood', hatCol: '#a85a4a' },
  // The castaway in the sea cave: thirty years of beard, rags of old sailcloth.
  reefhermit: { skin: '#c08868', hair: '#e8e4d8', cloth: '#9a8a68', cloth2: '#7a6c50', pants: '#5a4e3a', boots: '#4a3a2a', h: 20, beard: '#e8e4d8', longHair: true },
  // The lighthouse's keeper (a navy pea-coat, a white beard) and a fisher of the boats that come home.
  reefkeeper: { skin: '#d8a080', hair: '#e8e8e8', cloth: '#4a5c80', cloth2: '#3c4c6c', pants: '#2a2a30', boots: '#1e1a18', h: 21, bald: true, beard: '#e8e8e8' },
  reeffisher5: { skin: '#e0b090', hair: '#3a2a1a', cloth: '#a84a3a', cloth2: '#8a3a2e', pants: '#3a3a44', boots: '#2a2a30', h: 21, hat: 'souwester', hatCol: '#a84a3a', prop: 'rod' },
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
