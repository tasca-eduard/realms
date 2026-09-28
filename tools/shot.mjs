// Headless screenshot of the running dev server, for checking visuals.
// Usage: node tools/shot.mjs [query] [out.png] [waitMs] [WxH] [script.js]
//   query:  e.g. "shot&at=78,64"  (appended to http://localhost:5173/?; PORT=<n> for another server)
//   script: optional JS file evaluated in the page after load (drive the game).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [query = 'shot', out = 'shots/shot.png', wait = '2500', size = '1280x720', script] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const mobile = !!process.env.MOBILE;
const ctxOpts = { viewport: { width: w, height: h }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) };
// PROFILE=<dir> keeps browser storage between runs (to test saving and loading).
const ctx = process.env.PROFILE
  ? await chromium.launchPersistentContext(process.env.PROFILE, { channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], ...ctxOpts })
  : null;
const page = ctx ? await ctx.newPage() : await browser.newPage(ctxOpts);
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push('[404] ' + r.url()); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/?${query}`, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
} catch {
  logs.push('[shot] __ready never set');
}
if (mobile) await page.touchscreen.tap(w / 2, h / 2);
if (script) {
  const code = fs.readFileSync(script, 'utf8');
  try {
    const r = await page.evaluate(code);
    if (r !== undefined) logs.push(`[script] ${JSON.stringify(r)}`);
  } catch (e) {
    logs.push(`[script error] ${e.message}`);
  }
}
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
try {
  const rep = await page.evaluate(() => (window.__report ? window.__report() : undefined));
  if (rep !== undefined) logs.push(`[report] ${JSON.stringify(rep)}`);
} catch (e) {
  logs.push(`[report error] ${e.message}`);
}
if (ctx) await ctx.close();
await browser.close();
console.log(logs.slice(-40).join('\n'));
console.log('saved', out);
