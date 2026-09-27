// Pulls the FluidR3 instrument samples out of the old game's music module
// (src/o40.js, SAMPLE_DATA) into public/audio/samples/<instrument>/<midi>.mp3.
// Usage: node tools/extract-samples.mjs <path to old o40.js>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/extract-samples.mjs <o40.js>'); process.exit(1); }
const text = fs.readFileSync(src, 'utf8');
const start = text.indexOf('const SAMPLE_DATA = ');
const json = text.slice(start + 'const SAMPLE_DATA = '.length, text.indexOf('\n', start)).replace(/;\s*$/, '');
const data = JSON.parse(json);
const out = path.resolve('public/audio/samples');
const manifest = {};
for (const [inst, notes] of Object.entries(data)) {
  fs.mkdirSync(path.join(out, inst), { recursive: true });
  manifest[inst] = [];
  for (const [midi, b64] of Object.entries(notes)) {
    fs.writeFileSync(path.join(out, inst, `${midi}.mp3`), Buffer.from(b64, 'base64'));
    manifest[inst].push(Number(midi));
  }
  manifest[inst].sort((a, b) => a - b);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(manifest);
