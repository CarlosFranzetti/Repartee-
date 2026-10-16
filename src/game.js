/* re:parteé — title screen, menus, chapter select, arcade, credits, ending, boot. */
(function () {
"use strict";
const RP = window.RP;
const { el, $, esc, mk, R, P, ell, bayer, mulberry, clamp, store } = RP.u;

/* the protagonist */
RP.chars.define("kid", { name: "you", height: 96, skin: "#e0a27a", hair: { style: "messy", color: "#5a3520" },
  top: { style: "tee", color: "#17131f", print: "circle" }, bottom: { style: "jeans", color: "#2f5a96" },
  shoes: { style: "sneakers", color: "#efeaf6" }, acc: [], voice: "#ffffff" });

let titleEl = null;
const DEMO = window.RP_DEMO || null;   // set by the Level 1 build (tools/build.mjs --level1)
function paintTitle(c) {
  const w = 320, h = 180, rnd = mulberry(11);
  const sky = ["#0d0826", "#160c38", "#22104a", "#36155a", "#521d66", "#6e2a6e"];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = y / 130 + (bayer(x, y) / 16 - 0.5) * 0.12; P(c, x, y, sky[clamp(Math.floor(t * 6), 0, 5)]); }
  for (let i = 0; i < 60; i++) P(c, rnd() * w, rnd() * 70, rnd() > 0.6 ? "#ffffff" : "#9c8cff");
  ell(c, 262, 34, 9, 9, "#f2e7c4"); P(c, 259, 31, "#d8cca4"); P(c, 265, 37, "#d8cca4");
  let bx = 0;
  while (bx < w) { const bw = 8 + rnd() * 16 | 0, bh = 30 + rnd() * 50 | 0; R(c, bx, 128 - bh, bw, bh, "#1c1238"); bx += bw; }
  bx = 0;
  while (bx < w) {
    const bw = 10 + rnd() * 18 | 0, bh = 18 + rnd() * 44 | 0, top = 132 - bh;
    R(c, bx, top, bw, bh + 4, "#110a26");
    for (let y = top + 3; y < 130; y += 3) for (let x = bx + 2; x < bx + bw - 1; x += 3) if (rnd() < 0.35) P(c, x, y, ["#ffd27a", "#ffb04a", "#ff9ad5", "#9fe8ff"][rnd() * 4 | 0]);
    bx += bw + 1;
  }
  R(c, 220, 50, 16, 82, "#140c2c"); R(c, 223, 40, 10, 10, "#140c2c"); R(c, 226, 30, 4, 10, "#140c2c"); R(c, 227, 18, 2, 12, "#140c2c"); P(c, 227, 17, "#ff4040");
  for (let y = 54; y < 130; y += 4) for (let x = 222; x < 235; x += 3) if (rnd() < 0.5) P(c, x, y, "#ffe2a0");
  R(c, 0, 128, 200, 3, "#1a1030");
  [[40, 40], [140, 40]].forEach(([x, th]) => { R(c, x, 128 - th, 5, th, "#1a1030"); R(c, x - 1, 128 - th, 7, 3, "#1a1030"); });
  for (let i = 0; i <= 100; i++) { const t = i / 100; P(c, 42 + t * 100, 90 + Math.sin(t * Math.PI) * 30, "#3a2860"); }
  for (let x = 0; x < 200; x += 4) P(c, x, 127, (x / 4) % 2 ? "#ffd27a" : "#ff6cbb");
  for (let y = 132; y < h; y++) for (let x = 0; x < w; x++) P(c, x, y, bayer(x, y) < 6 ? "#0b0720" : "#130b2e");
  for (let i = 0; i < 260; i++) { const x = rnd() * w | 0, y = 134 + rnd() * 44 | 0; R(c, x, y, 2 + rnd() * 4, 1, ["#ffd27a", "#ff6cbb", "#9fe8ff"][rnd() * 3 | 0]); }
  R(c, 0, 168, w, 12, "#2a1c30"); R(c, 0, 168, w, 1, "#4a3450");
}
/* title backdrop at 640x360: the city painted at 320x180 and doubled, the kid drawn at native size */
function paintTitleHi(c2) {
  const lo = mk(320, 180);
  paintTitle(lo.getContext("2d"));
  c2.imageSmoothingEnabled = false;
  c2.drawImage(lo, 0, 0, 640, 360);
  RP.chars.update("kid", { acc: ["headphones"], headphonesOn: true });
  RP.chars.draw(c2, { id: "kid", x: 548, y: 352, face: "back", act: "stand" }, { lx: -0.6, rim: { color: "#ff6cbb", side: 1 }, shadow: 0.4 });
  RP.chars.update("kid", { acc: [], headphonesOn: false });
}

function showTitle() {
  RP.hideGame(true);
  if (titleEl) titleEl.remove();
  const ov = titleEl = el("div", { id: "title", cls: "overlay" }, document.body);
  const cv = el("canvas", { id: "tcv", width: 640, height: 360 }, ov);
  paintTitleHi(cv.getContext("2d"));
  const box = el("div", { cls: "tbox" }, ov);
  el("h1", { cls: "logo", html: 're<span class="c">:</span>parte<span class="e">é</span>' }, box);
  el("p", { cls: "tag", text: "A PIXEL-ART DJ ADVENTURE GAME" }, box);
  el("p", { cls: "tagline", text: "From broke-ass bedroom DJ to festival headliner. One bad decision at a time." }, box);
  const menu = el("div", { cls: "menu" }, box);
  const panel = el("div", { cls: "panelbox", hidden: "" }, box);
  const add = (label, fn) => { const b = el("button", { type: "button", text: label }, menu); b.addEventListener("click", () => { RP.audio.ctx(); fn(); }); return b; };
  const first = [];
  if (RP.hasSave()) first.push(add("CONTINUE", async () => { closeTitle(); if (!(await RP.loadSave())) { showTitle(); } }));
  first.push(add("NEW GAME", () => newGame(panel)));
  if (Object.keys(RP.acts).length > 1) add("CHAPTER SELECT", () => chapters(panel));
  add("MINI-GAME ARCADE", () => arcade(panel));
  add("HOW TO PLAY", () => toggle(panel, howTo));
  add("CREDITS", () => toggle(panel, credits));
  if (DEMO) {
    el("p", { cls: "small", text: "Level 1 of " + DEMO.levels + ": Bedroom DJ, plus all sixteen mini-games in the arcade. Sound on helps." }, box);
    const full = el("a", { cls: "small fullgame", href: DEMO.full, target: "_blank", rel: "noopener", text: "Play the full game (all five levels) \u2192" }, box);
    full.style.color = "var(--cyan)";
  } else el("p", { cls: "small", text: "Five levels. Sixteen mini-games. Sound on helps." }, box);
  setTimeout(() => first[0] && first[0].focus({ preventScroll: true }), 50);
}
function closeTitle() { if (titleEl) { titleEl.remove(); titleEl = null; } RP.hideGame(false); RP.layout(); }
function toggle(panel, fill) { if (!panel.hidden && panel.dataset.k === fill.name) { panel.hidden = true; return; } panel.innerHTML = ""; panel.dataset.k = fill.name; fill(panel); panel.hidden = false; }
function howTo(p) {
  [["Pick a verb", ", then click something in the scene. Click the floor to walk."],
   ["Use or Give an item:", " pick the verb, then the item, then the thing or person."],
   ["Right-click", " (desktop) looks at things. Click or press Space while someone talks to skip ahead."],
   ["MENU", " (or use your phone) opens messages, the subway map, your record crate, your setup, and saving."],
   ["Keys:", " L look, P pick up, U use, O open, T talk, G give, Esc to cancel. H (or Tab) shows what you can click."],
   ["Mini-games", " explain their own controls. You can replay any of them from the Mini-Game Arcade."]].forEach(([b, t]) => { const q = el("p", {}, p); el("b", { text: b }, q); q.appendChild(document.createTextNode(t)); });
}
function credits(p) {
  el("h3", { text: "RE:PARTEÉ" }, p);
  el("p", { text: "Inspired by Maniac Mansion, Zak McKracken and the Alien Mindbenders, and The Secret of Monkey Island." }, p);
  el("p", { text: "All graphics are drawn in code and all music is synthesized live in your browser. No samples, no recordings." }, p);
  el("h3", { text: "REAL RECORDS, REAL PEOPLE" }, p);
  el("p", { text: "Records, labels, artists, DJs, gear and venues named in the game are real and referenced as homage. Release details were checked against Discogs and Wikipedia where possible; BPMs are approximate and in-game prices are game values, not market prices." }, p);
  el("p", { text: "Appearances and dialogue by real DJs are fictional and respectful cameos. They do not imply endorsement or involvement. Every fictional character (promoters, neighbors, bosses, rivals) is invented." }, p);
  const n = (RP.data.records || []).length;
  el("p", { text: n + " real records in the catalog." }, p);
}
async function newGame(panel) {
  panel.innerHTML = ""; panel.hidden = false; panel.dataset.k = "new";
  el("p", { text: "What's your DJ name? (Promoters will spell it wrong anyway.)" }, panel);
  const row = el("div", { cls: "namebox" }, panel);
  const inp = el("input", { type: "text", maxlength: "16", value: store.get("reparte.name") || "", placeholder: "DJ NAME", "aria-label": "DJ name" }, row);
  const go = el("button", { cls: "btn primary", type: "button", text: "START" }, row);
  const start = async () => {
    const name = (inp.value || "").trim().toUpperCase() || "DJ NOBODY";
    store.set("reparte.name", name);
    closeTitle();
    RP.reset();
    RP.state.name = name;
    await RP.startAct(1);
  };
  go.addEventListener("click", start);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") start(); });
  setTimeout(() => inp.focus(), 30);
}
function chapters(panel) {
  panel.innerHTML = ""; panel.hidden = false; panel.dataset.k = "ch";
  el("p", { text: "Jump to any level with a sensible starting setup." }, panel);
  const list = el("div", { cls: "chapters" }, panel);
  Object.values(RP.acts).sort((a, b) => a.n - b.n).forEach(a => {
    const b = el("button", { type: "button" }, list);
    b.appendChild(document.createTextNode("LEVEL " + a.n + ": " + a.title));
    el("small", { text: a.blurb || "" }, b);
    b.addEventListener("click", async () => { closeTitle(); RP.reset(); RP.state.name = store.get("reparte.name") || "DJ NOBODY"; await RP.startAct(a.n); });
  });
}
function arcade(panel) {
  panel.innerHTML = ""; panel.hidden = false; panel.dataset.k = "arc";
  el("p", { text: "Play any mini-game on its own." }, panel);
  const list = el("div", { cls: "chapters" }, panel);
  RP.mg.list().sort((a, b) => (a.order || 99) - (b.order || 99)).forEach(m => {
    const b = el("button", { type: "button" }, list);
    b.appendChild(document.createTextNode(m.title));
    el("small", { text: m.desc || "" }, b);
    b.addEventListener("click", async () => {
      titleEl.hidden = true;
      const r = await RP.mg.play(m.id, { arcade: true, difficulty: 2 });
      titleEl.hidden = false;
      if (r && r.score != null) RP.toast(m.title + ": " + (r.ok ? "cleared" : "failed") + " · score " + Math.round(r.score));
    });
  });
}

RP.onQuit = () => { RP.audio.stopAll(0.3); showTitle(); };
/* Level 1 build: finishing the level leads here instead of into Level 2 */
async function demoEnding() {
  RP.audio.setMusic(null);
  const ov = RP.overlay("card");
  const box = el("div", { cls: "cardbox" }, ov);
  el("div", { cls: "kicker", text: "END OF LEVEL 1" }, box);
  el("h2", { html: "TO BE <span style='color:var(--pink)'>CONTINUED</span>" }, box);
  const S = RP.state;
  el("p", { text: (S.name || "You") + " played Nowhere. The bartenders danced. Dante says he'll pay you next week." }, box);
  el("p", { text: "Still to come: Underground Hustler, Club DJ, Touring DJ and Superstar DJ. Plasma money, a loft party with a dead PA, a residency, a flight to Berlin, and a festival headline set." }, box);
  const row = el("div", { cls: "erow" }, box);
  el("a", { cls: "btn primary", href: DEMO.full, target: "_blank", rel: "noopener", text: "PLAY THE FULL GAME", style: "text-decoration:none" }, row);
  const b = el("button", { cls: "btn", type: "button", text: "BACK TO TITLE" }, row);
  await new Promise(r => b.addEventListener("click", r));
  ov.remove();
  RP.clearSave();
  showTitle();
}
RP.ending = async function () {
  if (DEMO) return demoEnding();
  RP.audio.setMusic(null);
  const ov = RP.overlay("card");
  const box = el("div", { cls: "cardbox" }, ov);
  el("div", { cls: "kicker", text: "THE END" }, box);
  el("h2", { html: "re<span style='color:var(--pink)'>:</span>parte<span style='color:var(--pink)'>é</span>" }, box);
  const S = RP.state;
  el("p", { text: (S.name || "You") + ": from four records and a crackling mixer to a festival headline." }, box);
  el("p", { text: S.records.length + " records in the crate. " + S.followers.toLocaleString("en-US") + " fans. " + RP.u.fmtMoney(S.money) + " in the bank (for now)." }, box);
  el("p", { text: "Thanks for playing. Go dig something." }, box);
  const row = el("div", { cls: "erow" }, box);
  const b = el("button", { cls: "btn primary", type: "button", text: "BACK TO TITLE" }, row);
  await new Promise(r => b.addEventListener("click", r));
  ov.remove();
  RP.clearSave();
  showTitle();
};

/* boot; inside a claude.ai artifact viewer, keep the player's place across republishes */
function boot(data) {
  RP.boot();
  if (data && data.S && data.S.room && !data.title) {
    RP.restore(data.S).then(ok => { if (!ok) showTitle(); });
  } else showTitle();
}
function start() {
  const hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ S: RP.state, title: !!titleEl })); } catch (e) { /* ignore */ }
  if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
