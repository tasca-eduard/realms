// On the Thornstag (it leaps twice, 2.3 m, and steps up 0.45 m more at the top of the leap): no way
// out of the world, and nothing the story keeps shut that it could reach before the story opens it,
// compared with the knight on foot. One known exception is allowed: in the Moonlit Keep the stag can
// hop the border hills round the thorn hedge to the thorn road (harmless: the pause menu travels to
// Whisperwood anyway, and the stag is only had after going there).
const ALLOWED = ['border:thornroad'];
const foot = window.__reach(false).unreachable.map((u) => u.what);
const stag = window.__reach(false, 2.75);
const stagMiss = stag.unreachable.map((u) => u.what);
const skips = foot.filter((w) => !stagMiss.includes(w)).filter((w, i, a) => a.indexOf(w) === i);
window.__report = () => ({ escapes: stag.escapes.length, skips, unexpected: skips.filter((w) => !ALLOWED.includes(w)) });
