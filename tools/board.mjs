// The board: one markdown file per task in board/<folder>/NNN-slug.md (see board/README.md).
//
//   node tools/board.mjs                      the board: counts per folder, then the titles (done: the latest 10)
//   node tools/board.mjs all                  the same with every done task
//   node tools/board.mjs todo [--done N]      the to-do list in the user's format, to post in chat after each task
//   node tools/board.mjs todo --plan realm-4-draft   every group of that plan, done ones crossed out
//   node tools/board.mjs move 064 done        move a task: its file, its status (and done date), links, BOARD.md's "Now"
//   node tools/board.mjs new backlog some-slug "A title"   a new task file from the template, with the next free id
//   node tools/board.mjs next                 the next free id
//   node tools/board.mjs index                rewrite BOARD.md's "Now" section from the folders
//   node tools/board.mjs check                every task well formed, status = folder, ids unique, links resolve
//
// No dependencies; works from any folder (paths are found from this file). Never runs git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOARD = path.join(ROOT, 'board');
const INDEX = path.join(ROOT, 'BOARD.md');
const FOLDERS = ['in-progress', 'todo', 'blocked', 'backlog', 'done'];
const PRIORITIES = ['high', 'medium', 'low', 'cant-check'];
const REQUIRED = ['id', 'title', 'realm', 'area', 'status', 'created', 'done', 'owner', 'depends', 'links'];
const NAME = /^(\d{3})-[a-z0-9-]+\.md$/;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const meta = {};
  let end = -1;
  if (lines[0] === '---') {
    end = lines.indexOf('---', 1);
    for (const line of lines.slice(1, end)) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) val = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      meta[key] = val;
    }
  }
  return { file, text, lines, meta, body: lines.slice(end + 1) };
}

function load() {
  const tasks = [];
  for (const folder of FOLDERS) {
    const dir = path.join(BOARD, folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.md')) continue;
      const t = parse(path.join(dir, name));
      t.folder = folder;
      t.name = name;
      t.id = (name.match(/^(\d+)/) || [])[1] || name;
      tasks.push(t);
    }
  }
  return tasks;
}

const title = (t) => `${t.id} ${t.meta.title || t.name}`;
const byDoneDesc = (a, b) => String(b.meta.done || '').localeCompare(String(a.meta.done || '')) || b.id.localeCompare(a.id);
const prioRank = (t) => { const i = PRIORITIES.indexOf(t.meta.priority); return i < 0 ? PRIORITIES.length : i; };
const byPriority = (a, b) => prioRank(a) - prioRank(b) || a.id.localeCompare(b.id);

// The "## Steps" checklist of a task (sub-steps of the current work), continuation lines joined.
function steps(t) {
  const out = [];
  let on = false;
  for (const line of t.body) {
    if (/^## /.test(line)) { on = /^## Steps/i.test(line); continue; }
    if (!on) continue;
    if (/^- \[[ xX]\]/.test(line)) out.push(line.trim());
    else if (/^\s+\S/.test(line) && out.length) out[out.length - 1] += ' ' + line.trim();
  }
  return out;
}

function tag(t) {
  const bits = [];
  if (t.meta.realm && t.meta.realm !== 'all') bits.push(`realm ${t.meta.realm}`);
  if (t.meta.priority) bits.push(t.meta.priority);
  if (t.folder === 'in-progress' && t.meta.owner) bits.push(`owner: ${t.meta.owner}`);
  if (t.folder === 'blocked' && t.meta.blocked_on) bits.push(`on: ${t.meta.blocked_on}`);
  if (t.folder === 'done' && t.meta.done) bits.push(t.meta.done);
  if (t.folder === 'backlog' && t.meta.plan) bits.push(`plan ${t.meta.plan}`);
  return bits.length ? `  (${bits.join('; ')})` : '';
}

function showBoard(all) {
  const tasks = load();
  const counts = FOLDERS.map((f) => `${f} ${tasks.filter((t) => t.folder === f).length}`);
  console.log(`Board (board/): ${tasks.length} tasks. ${counts.join(' | ')}\n`);
  for (const f of FOLDERS) {
    let list = tasks.filter((t) => t.folder === f);
    if (f === 'backlog') list.sort(byPriority);
    if (f === 'done') list.sort(byDoneDesc);
    const shown = f === 'done' && !all ? list.slice(0, 10) : list;
    console.log(`${f} (${list.length})`);
    if (!list.length) console.log('  (none)');
    for (const t of shown) console.log(`  ${title(t)}${tag(t)}`);
    if (shown.length < list.length) console.log(`  ... ${list.length - shown.length} more: node tools/board.mjs all`);
    console.log('');
  }
}

function showTodo(args) {
  const tasks = load();
  const nDone = Number(args[args.indexOf('--done') + 1]) || 5;
  const planName = args.includes('--plan') ? args[args.indexOf('--plan') + 1] : '';
  const out = [`**To-do** (${today()}, from board/)`, ''];
  const line = (t) => {
    if (t.folder === 'done') return `- ~~${title(t)}~~ (done ${t.meta.done || '?'})`;
    if (t.folder === 'in-progress') return `- **${title(t)}** <- now (${t.meta.owner || 'no owner'})`;
    if (t.folder === 'blocked') return `- ${title(t)} (blocked on ${t.meta.blocked_on || '?'})`;
    return `- ${title(t)} (${t.folder}${t.meta.priority ? ', ' + t.meta.priority : ''})`;
  };
  const withSteps = (t) => [line(t), ...(t.folder === 'in-progress' ? steps(t).map((s) => '  ' + s) : [])];
  if (planName) {
    const list = tasks.filter((t) => t.meta.plan === planName).sort((a, b) => a.id.localeCompare(b.id));
    if (!list.length) { console.error(`no tasks with plan: ${planName}`); process.exit(1); }
    out.push(`Plan ${planName} (board/plans/${planName}.md):`);
    for (const t of list) out.push(...withSteps(t));
    const others = tasks.filter((t) => t.meta.plan !== planName && ['in-progress', 'todo', 'blocked'].includes(t.folder));
    if (others.length) { out.push('', 'Also open:'); for (const t of others) out.push(...withSteps(t)); }
  } else {
    const done = tasks.filter((t) => t.folder === 'done').sort(byDoneDesc).slice(0, nDone).reverse();
    const sec = (head, list) => { out.push(head); if (!list.length) out.push('- (none)'); for (const t of list) out.push(...withSteps(t)); out.push(''); };
    sec(`Done (the latest ${done.length})`, done);
    sec('In progress', tasks.filter((t) => t.folder === 'in-progress'));
    sec('Todo (next)', tasks.filter((t) => t.folder === 'todo'));
    sec('Blocked', tasks.filter((t) => t.folder === 'blocked'));
    const back = tasks.filter((t) => t.folder === 'backlog');
    const n = (p) => back.filter((t) => t.meta.priority === p).length;
    out.push(`Backlog: ${back.length} (high ${n('high')}, medium ${n('medium')}, low ${n('low')}, can't be checked here ` +
      `${n('cant-check')}, plan groups waiting ${back.filter((t) => t.meta.plan).length}): node tools/board.mjs`);
    for (const t of back.filter((t) => t.meta.priority === 'high')) out.push(line(t));
  }
  console.log(out.join('\n').replace(/\n+$/, ''));
}

function find(tasks, id) {
  const want = String(id).padStart(3, '0');
  const t = tasks.find((x) => x.id === want);
  if (!t) { console.error(`no task ${want} under board/`); process.exit(1); }
  return t;
}

function mdFiles() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(BOARD);
  walk(path.join(ROOT, 'docs'));
  walk(path.join(ROOT, '.claude'));
  for (const f of ['BOARD.md', 'CLAUDE.md', 'README.md']) if (fs.existsSync(path.join(ROOT, f))) out.push(path.join(ROOT, f));
  return out;
}

function setField(text, key, value) {
  const re = new RegExp(`^${key}:.*$`, 'm');
  return re.test(text) ? text.replace(re, `${key}: ${value}`.trimEnd()) : text.replace(/^status:.*$/m, (m) => `${m}\n${key}: ${value}`);
}

function move(id, dest) {
  if (!FOLDERS.includes(dest)) { console.error(`folder must be one of: ${FOLDERS.join(', ')}`); process.exit(1); }
  const tasks = load();
  const t = find(tasks, id);
  if (t.folder === dest) { console.log(`${t.name} is already in ${dest}/`); return; }
  let text = setField(t.text, 'status', dest);
  if (dest === 'done' && !t.meta.done) text = setField(text, 'done', today());
  const to = path.join(BOARD, dest, t.name);
  fs.writeFileSync(to, text);
  fs.unlinkSync(t.file);
  // Links to it anywhere in the docs: "<from>/<name>" -> "<dest>/<name>"; in its own plan, tick its group when done.
  const re = new RegExp(`(^|[(\\[/\\s])${t.folder}/${t.name.replace(/[.]/g, '\\.')}`, 'gm');
  let fixed = 0;
  for (const f of mdFiles()) {
    const s = fs.readFileSync(f, 'utf8');
    let n = s.replace(re, (m, pre) => { fixed++; return `${pre}${dest}/${t.name}`; });
    if (dest === 'done' && f.startsWith(path.join(BOARD, 'plans'))) n = n.replace(new RegExp(`^- \\[ \\](.*\\(\\[task ${t.id}\\])`, 'm'), '- [x]$1');
    if (n !== s) fs.writeFileSync(f, n);
  }
  console.log(`moved ${t.folder}/${t.name} -> ${dest}/ (status ${dest}${dest === 'done' && !t.meta.done ? ', done ' + today() : ''}); ${fixed} link(s) updated`);
  if (dest === 'blocked' && !t.meta.blocked_on) console.log('  now add "blocked_on: <what it waits for>" to its frontmatter');
  if (dest === 'in-progress' && !t.meta.owner) console.log('  now set "owner:" (an agent or the lead)');
  if (dest === 'done') console.log('  now write what was built and checked under "## Done <date>" in it');
  index(true);
}

const nextId = (tasks) => String(Math.max(0, ...tasks.map((t) => Number(t.id) || 0)) + 1).padStart(3, '0');

function create(folder, slug, words) {
  if (!FOLDERS.includes(folder) || !/^[a-z0-9-]+$/.test(slug || '') || !words.length) {
    console.error('usage: node tools/board.mjs new <folder> <short-slug> "<Title>"'); process.exit(1);
  }
  const id = nextId(load());
  const file = path.join(BOARD, folder, `${id}-${slug}.md`);
  const ttl = words.join(' ');
  fs.writeFileSync(file, `---
id: ${id}
title: ${ttl}
realm:
area:
status: ${folder}
${folder === 'backlog' ? 'priority: low\n' : ''}created: ${today()}
done:
owner:
${folder === 'blocked' ? 'blocked_on:\n' : ''}depends: []
links: []
---

# ${id} ${ttl}

## What

## Why

## Checks
`);
  console.log(`wrote ${rel(file)}`);
  index(true);
}

// BOARD.md keeps a "Now" section between these markers, rewritten from the folders (CRLF kept as the file has it).
const START = '<!-- board:now -->';
const END = '<!-- /board:now -->';
function index(quiet) {
  if (!fs.existsSync(INDEX)) return;
  const old = fs.readFileSync(INDEX, 'utf8');
  const a = old.indexOf(START), b = old.indexOf(END);
  if (a < 0 || b < a) { if (!quiet) console.error('BOARD.md has no board:now markers'); return; }
  const tasks = load();
  const link = (t) => `[${title(t)}](board/${t.folder}/${t.name})`;
  const out = [START, `_Written by \`node tools/board.mjs index\` on ${today()}; the folders are always the truth._`, ''];
  const sec = (head, list, extra) => {
    out.push(`**${head}**`, '');
    if (!list.length) out.push('- (none)');
    for (const t of list) out.push(`- ${link(t)}${extra(t)}`);
    out.push('');
  };
  sec('In progress', tasks.filter((t) => t.folder === 'in-progress'), (t) => (t.meta.owner ? `: ${t.meta.owner}` : ''));
  sec('Todo (next)', tasks.filter((t) => t.folder === 'todo'), () => '');
  sec('Blocked', tasks.filter((t) => t.folder === 'blocked'), (t) => (t.meta.blocked_on ? `: on ${t.meta.blocked_on}` : ''));
  const back = tasks.filter((t) => t.folder === 'backlog').sort(byPriority);
  const plans = [...new Set(back.filter((t) => t.meta.plan).map((t) => t.meta.plan))];
  const firsts = plans.map((p) => back.filter((t) => t.meta.plan === p).sort((x, y) => x.id.localeCompare(y.id))[0]);
  sec('Next in the backlog', [...back.filter((t) => t.meta.priority === 'high' || t.meta.priority === 'medium'), ...firsts],
    (t) => (t.meta.plan ? ` (first group of plan ${t.meta.plan}, waiting)` : ` (${t.meta.priority})`));
  const done = tasks.filter((t) => t.folder === 'done').sort(byDoneDesc).slice(0, 3);
  sec('Done lately', done, (t) => ` (${t.meta.done})`);
  out.push(END);
  const eol = old.includes('\r\n') ? '\r\n' : '\n';
  const next = old.slice(0, a) + out.join(eol) + old.slice(b + END.length);
  if (next !== old) fs.writeFileSync(INDEX, next);
  if (!quiet) console.log(`BOARD.md "Now" ${next === old ? 'already up to date' : 'rewritten'}`);
}

function check() {
  const tasks = load();
  const errors = [], warnings = [];
  const ids = new Map();
  for (const t of tasks) {
    const where = rel(t.file);
    if (!NAME.test(t.name)) errors.push(`${where}: name must be NNN-short-slug.md (lower case)`);
    if (ids.has(t.id)) errors.push(`${where}: id ${t.id} also used by ${rel(ids.get(t.id).file)}`);
    ids.set(t.id, t);
    for (const k of REQUIRED) if (!(k in t.meta)) errors.push(`${where}: no "${k}:" in its frontmatter`);
    if (t.meta.id !== undefined && t.meta.id !== t.id) errors.push(`${where}: id ${t.meta.id} but the file says ${t.id}`);
    if (t.meta.status !== t.folder) errors.push(`${where}: status "${t.meta.status}" but it sits in ${t.folder}/`);
    if (t.folder === 'done' && !/^\d{4}-\d\d-\d\d$/.test(t.meta.done || '')) errors.push(`${where}: done without a date`);
    if (t.folder === 'blocked' && !t.meta.blocked_on) errors.push(`${where}: blocked without "blocked_on:"`);
    if (t.folder === 'in-progress' && !t.meta.owner) warnings.push(`${where}: in progress without an owner`);
    if (t.meta.priority && !PRIORITIES.includes(t.meta.priority)) errors.push(`${where}: priority must be ${PRIORITIES.join(', ')}`);
    if (t.folder === 'backlog' && !t.meta.priority && !t.meta.plan) warnings.push(`${where}: backlog without a priority`);
    if (t.meta.plan && !fs.existsSync(path.join(BOARD, 'plans', `${t.meta.plan}.md`))) errors.push(`${where}: no board/plans/${t.meta.plan}.md`);
  }
  for (const t of tasks) for (const d of t.meta.depends || []) if (!ids.has(String(d).padStart(3, '0'))) errors.push(`${rel(t.file)}: depends on ${d}, which isn't on the board`);
  // Links: markdown links in every board file and BOARD.md, and each task's "links:" list.
  const files = [...tasks.map((t) => t.file), ...fs.readdirSync(path.join(BOARD, 'plans')).map((n) => path.join(BOARD, 'plans', n)),
    path.join(BOARD, 'README.md'), INDEX].filter((f) => fs.existsSync(f));
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const targets = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    const t = tasks.find((x) => x.file === f);
    if (t) targets.push(...(t.meta.links || []));
    for (const raw of new Set(targets)) {
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      const target = path.resolve(path.dirname(f), decodeURI(raw.split('#')[0]));
      if (fs.existsSync(target)) continue;
      const msg = `${rel(f)}: link to ${raw} doesn't resolve`;
      (target.startsWith(BOARD) || target === INDEX ? errors : warnings).push(msg);
    }
  }
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(`${tasks.length} tasks checked: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) process.exit(1);
}

const [cmd = 'board', ...args] = process.argv.slice(2);
if (cmd === 'board' || cmd === 'list') showBoard(false);
else if (cmd === 'all') showBoard(true);
else if (cmd === 'todo') showTodo(args);
else if (cmd === 'move') move(args[0], args[1]);
else if (cmd === 'new') create(args[0], args[1], args.slice(2));
else if (cmd === 'next') console.log(nextId(load()));
else if (cmd === 'index') index(false);
else if (cmd === 'check') check();
else { console.error(`unknown command "${cmd}"; see the top of tools/board.mjs`); process.exit(1); }
