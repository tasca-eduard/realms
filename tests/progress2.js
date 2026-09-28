// Session 2: "New journey" asks first; "No" keeps the save; "Yes" starts over.
const out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const btn = (t) => [...document.querySelectorAll('#title .btn')].find((b) => b.textContent.includes(t));
  out.menu = [...document.querySelectorAll('#title .btn')].map((b) => b.textContent);
  btn('New journey').click();
  await wait(200);
  out.asked = document.querySelector('#title .note')?.textContent ?? null;
  out.choices = [...document.querySelectorAll('#title .btn')].map((b) => b.textContent);
  btn('No, keep').click();
  await wait(200);
  out.saveKept = !!localStorage.getItem('realms-save');
  out.back = [...document.querySelectorAll('#title .btn')].map((b) => b.textContent);
  out.kills = window.__game.save.data.kills;
  btn('New journey').click();
  await wait(200);
  btn('Yes, start over').click();
  await wait(300);
  out.afterYes = { saveGone: !localStorage.getItem('realms-save') || JSON.parse(localStorage.getItem('realms-save')).kills === 0, state: window.__game.state };
})();
window.__report = () => out;
