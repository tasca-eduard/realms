// Colour measures of screenshots: how bright, how contrasted, how saturated a picture is, its hue and how far its
// hues spread, and how much of its colour is warm, cool or green (the measures realms 1 and 2 were compared to
// realm 3 with; board/plans/realms-1-2-revisit.md).
// Usage: node tools/look.mjs <png or folder>... [--vs <folder>] [--bottom=0.86] [--json=out.json]
//   folders:   every .png in them (sorted by name)
//   --vs:      a second folder with shots of the same names (the "before"): each row shows before -> after
//   --bottom:  where the measured band ends (0.14 to 1 of the height by default: the HUD's top strip is skipped)
//   --json:    also write the measures to a file
// Columns: lum (mean luminance 0-1), contrast (its standard deviation), sat (mean saturation), hue (of the mean
// colour), wHue (the weighted mean hue of the coloured pixels), spread (their hue spread in degrees: 0 one hue,
// large many), warm/cool/green (shares of the colour: warm under 70 or over 320, cool 160-270, green 70-160),
// bins (30-degree hue bins holding over 3% of the colour), colourful (Hasler and Suesstrunk's measure).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const vsAt = args.indexOf('--vs');
const vs = vsAt >= 0 ? args[vsAt + 1] : null;
const bottom = Number(opt('bottom') ?? 1);
const json = opt('json');
const inputs = args.filter((a, i) => !a.startsWith('--') && !(vsAt >= 0 && i === vsAt + 1));
const files = inputs.flatMap((p) =>
  fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(p, f)) : [p],
);
if (!files.length) {
  console.log('Usage: node tools/look.mjs <png or folder>... [--vs <folder>] [--bottom=0.86] [--json=out.json]');
  process.exit(1);
}

function measure(src, bottom) {
  return (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.getElementById('c');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const y0 = Math.round(img.height * 0.14), y1 = Math.round(img.height * bottom);
    const d = x.getImageData(0, y0, img.width, y1 - y0).data;
    let n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, ss = 0, cx = 0, cy = 0, cw = 0;
    const rg = [0, 0], yb = [0, 0], bins = new Float64Array(12);
    let warm = 0, cool = 0, green = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      n++; sr += R; sg += G; sb += B; sl += l; sl2 += l * l;
      const s = mx > 0 ? (mx - mn) / mx : 0;
      ss += s;
      const a = d[i] - d[i + 1], bb = 0.5 * (d[i] + d[i + 1]) - d[i + 2];
      rg[0] += a; rg[1] += a * a; yb[0] += bb; yb[1] += bb * bb;
      if (s < 0.12 || mx < 0.06 || mx === mn) continue;
      let h = mx === R ? ((G - B) / (mx - mn)) % 6 : mx === G ? (B - R) / (mx - mn) + 2 : (R - G) / (mx - mn) + 4;
      h = (h * 60 + 360) % 360;
      const w = s * mx;
      cx += Math.cos((h * Math.PI) / 180) * w; cy += Math.sin((h * Math.PI) / 180) * w; cw += w;
      bins[Math.floor(h / 30)] += w;
      if (h < 70 || h >= 320) warm += w;
      else if (h >= 160 && h < 270) cool += w;
      else if (h >= 70 && h < 160) green += w;
    }
    const mR = sr / n, mG = sg / n, mB = sb / n, mx = Math.max(mR, mG, mB), mn = Math.min(mR, mG, mB);
    let h = mx === mn ? 0 : mx === mR ? ((mG - mB) / (mx - mn)) % 6 : mx === mG ? (mB - mR) / (mx - mn) + 2 : (mR - mG) / (mx - mn) + 4;
    const sd = (v) => Math.sqrt(Math.max(0, v[1] / n - (v[0] / n) ** 2));
    const lm = sl / n, Rl = cw ? Math.hypot(cx, cy) / cw : 1;
    return {
      lum: +lm.toFixed(3),
      contrast: +Math.sqrt(Math.max(0, sl2 / n - lm * lm)).toFixed(3),
      sat: +(ss / n).toFixed(3),
      hue: Math.round((h * 60 + 360) % 360),
      wHue: Math.round(((Math.atan2(cy, cx) * 180) / Math.PI + 360) % 360),
      spread: Math.round((Math.sqrt(-2 * Math.log(Math.max(1e-9, Rl))) * 180) / Math.PI),
      warm: +(warm / (cw || 1)).toFixed(2),
      cool: +(cool / (cw || 1)).toFixed(2),
      green: +(green / (cw || 1)).toFixed(2),
      bins: Array.from(bins).filter((b) => b / (cw || 1) > 0.03).length,
      colourful: +(Math.sqrt(sd(rg) ** 2 + sd(yb) ** 2) + 0.3 * Math.hypot(rg[0] / n, yb[0] / n)).toFixed(1),
    };
  })();
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
const look = async (f) => page.evaluate(`(${measure.toString()})(${JSON.stringify('data:image/png;base64,' + fs.readFileSync(f).toString('base64'))}, ${bottom})`);
const KEYS = ['lum', 'contrast', 'sat', 'hue', 'wHue', 'spread', 'warm', 'cool', 'green', 'bins', 'colourful'];
const out = [];
console.log('shot'.padEnd(34) + KEYS.map((k) => k.padStart(vs ? 15 : 10)).join(''));
for (const f of files) {
  const name = path.basename(f);
  const now = await look(f);
  const was = vs && fs.existsSync(path.join(vs, name)) ? await look(path.join(vs, name)) : null;
  out.push({ f: name, ...now, ...(was ? { before: was } : {}) });
  const cell = (k) => (was ? `${was[k]}>${now[k]}` : String(now[k])).padStart(vs ? 15 : 10);
  console.log(name.padEnd(34) + KEYS.map(cell).join(''));
}
if (out.length > 1) {
  const mean = (k, rows) => +(rows.reduce((s, o) => s + o[k], 0) / rows.length).toFixed(3);
  const was = out.filter((o) => o.before).map((o) => o.before);
  const cell = (k) => (was.length ? `${mean(k, was)}>${mean(k, out)}` : String(mean(k, out))).padStart(vs ? 15 : 10);
  console.log('(mean)'.padEnd(34) + ['lum', 'contrast', 'sat'].map(cell).join(''));
}
if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
await browser.close();
