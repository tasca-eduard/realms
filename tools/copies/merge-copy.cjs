// Merges an agent's work copy back into the project, file by file, with a 3-way merge against the untouched copy the
// agent started from (its base). See docs/workflow/parallel-work.md.
//
// Usage: node tools/copies/merge-copy.cjs <copy> <base> [project] [--dry] [--json]
//   copy     the agent's folder (e.g. C:\...\scratchpad\wt\r1)
//   base     the untouched starting copy it was made from (e.g. ...\wt\base4)
//   project  where to merge into; the project root (two folders up from this file) when left out
//   --dry    report what would happen, write nothing
//   --json   print the report as JSON instead of lines
//
// For every file the agent changed against the base: if the project still has the base's version, the agent's is
// taken whole; if both changed it, a 3-way merge (`git merge-file`, which needs no repository and writes nothing to
// one); new files are copied in unless the project has a different file there. Files the agent deleted are only
// listed. Text is compared and merged with LF line endings and written back in the project's own (agents' tools
// sometimes flip a whole file between CRLF and LF, which would otherwise read as every line changed).
// Conflicts are written into the file with <<<<<<< project / ======= / >>>>>>> <copy> markers and listed; the exit
// code is 1 when there are any, 0 when there are none, 2 on a usage error.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const asJson = args.includes('--json');
const plain = args.filter((a) => !a.startsWith('--'));
// Git Bash hands over /c/Users/... paths; Node on Windows wants C:/Users/...
const fix = (p) => path.resolve(p.replace(/^\/([a-zA-Z])\//, '$1:/'));
if (plain.length < 2 || plain.length > 3) {
  console.error('Usage: node tools/copies/merge-copy.cjs <copy> <base> [project] [--dry] [--json]');
  process.exit(2);
}
const C = fix(plain[0]);
const B = fix(plain[1]);
const MAIN = plain[2] ? fix(plain[2]) : path.resolve(__dirname, '..', '..');
for (const [what, dir] of [['copy', C], ['base', B], ['project', MAIN]]) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`No ${what} folder at ${dir}`);
    process.exit(2);
  }
}
if (new Set([C, B, MAIN].map((p) => p.toLowerCase())).size < 3) {
  console.error('The copy, the base and the project must be three different folders.');
  process.exit(2);
}

// Never merged, at any depth: installs, caches, builds, screenshots.
const SKIP_ANY = new Set(['node_modules', '.vite-cache', 'dist', 'shots', '.git', '.merge-tmp']);
// Never merged at the project's top: the lead's own files (the board, the docs, the agent definitions, the copy's
// vite.config.ts with its cacheDir line, the lock file).
const SKIP_TOP = new Set(['BOARD.md', 'README.md', 'REALMS.md', 'CLAUDE.md', 'vite.config.ts', 'package-lock.json', 'board', 'docs', '.claude']);
const skipped = (name, top) => SKIP_ANY.has(name) || name.startsWith('shots-') || name.endsWith('.png') || (top && SKIP_TOP.has(name));
const walk = (dir, rel = '') => {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (skipped(e.name, rel === '')) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
};

const TEXT = /\.(ts|js|mjs|cjs|json|md|css|html|txt|sh|svg|yml|yaml)$/i;
// A file's bytes, with CRLF turned to LF for text; null when it isn't there.
const read = (p) => {
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  return TEXT.test(p) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n')) : buf;
};
const eol = (p) => (fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes('\r\n') ? '\r\n' : '\n');
// Writes LF text with the line endings of the file `like` (read before it's overwritten).
const write = (p, buf, like) => {
  if (dry) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!TEXT.test(p)) return fs.writeFileSync(p, buf);
  const e = eol(like);
  fs.writeFileSync(p, e === '\n' ? buf : Buffer.from(buf.toString('utf8').replace(/\n/g, e)));
};

const report = { taken: [], merged: [], added: [], conflicts: [], deleted: [], same: 0 };
const label = path.basename(C);
let tmp = null;
for (const rel of walk(C)) {
  const pa = path.join(C, rel), pm = path.join(MAIN, rel);
  const a = read(pa), b = read(path.join(B, rel)), m = read(pm);
  if (b && a.equals(b)) { report.same++; continue; }
  if (!b) {
    if (!m) { write(pm, a, pa); report.added.push(rel); }
    else if (m.equals(a)) report.same++;
    else report.conflicts.push(`${rel} (new in the copy, but the project has a different file there: left as it is)`);
    continue;
  }
  if (!m) { report.conflicts.push(`${rel} (changed in the copy, gone from the project: left out)`); continue; }
  if (m.equals(b)) { write(pm, a, pm); report.taken.push(rel); continue; }
  if (m.equals(a)) { report.same++; continue; }
  if (!TEXT.test(rel)) { report.conflicts.push(`${rel} (binary, changed in both: left as it is, pick one by hand)`); continue; }
  tmp ??= fs.mkdtempSync(path.join(os.tmpdir(), 'merge-copy-'));
  const [tm, tb, ta] = ['project', 'base', 'copy'].map((k) => path.join(tmp, k));
  fs.writeFileSync(tm, m); fs.writeFileSync(tb, b); fs.writeFileSync(ta, a);
  const res = spawnSync('git', ['merge-file', '-p', '-L', 'project', '-L', 'base', '-L', label, tm, tb, ta], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  // git merge-file exits with the number of conflicts (0 to 127), or below zero on an error.
  if (res.error || res.status === null || res.status < 0 || res.status > 127) {
    report.conflicts.push(`${rel} (git merge-file failed: ${res.error?.message ?? res.stderr.toString().trim()}; left as it is)`);
    continue;
  }
  write(pm, res.stdout, pm);
  if (res.status === 0) report.merged.push(rel);
  else report.conflicts.push(`${rel} (${res.status} conflicting hunk${res.status === 1 ? '' : 's'}, marked in the file)`);
}
if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
for (const rel of walk(B)) if (!fs.existsSync(path.join(C, rel))) report.deleted.push(rel);

if (asJson) console.log(JSON.stringify({ copy: C, base: B, project: MAIN, dry, ...report }, null, 1));
else {
  console.log(`${dry ? 'Dry run: ' : ''}${C} -> ${MAIN} (base ${B})`);
  const list = (name, items) => console.log(`${name.padEnd(10)}${items.length ? items.length + ': ' + items.join(', ') : 'none'}`);
  list('taken', report.taken);
  list('merged', report.merged);
  list('added', report.added);
  list('deleted', report.deleted.map((r) => `${r} (not removed from the project)`));
  console.log(`${'unchanged'.padEnd(10)}${report.same}`);
  console.log(`${'CONFLICTS'.padEnd(10)}${report.conflicts.length ? '' : 'none'}`);
  for (const c of report.conflicts) console.log(`  ${c}`);
}
process.exit(report.conflicts.length ? 1 : 0);
