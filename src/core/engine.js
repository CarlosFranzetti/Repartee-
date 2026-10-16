/* re:parteé — adventure engine.
   SCUMM-style: verbs + inventory panel, sentence line, click-to-walk rooms with hotspots,
   depth-sorted actors with VGA shading, banded light maps, particle effects, dialog
   with choices, phone menu (messages, subway map, record crate, gear), mini-game host,
   acts with title cards, autosave. Content (acts, rooms, items, mini-games) registers
   through the API documented in docs/ENGINE_API.md. */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { mk, clamp, R, P, ell, bayer, $, el, esc, fmtMoney, store } = U;
const W = RP.W, SH = RP.SH;

/* ======================================================================
   registries & state
   ====================================================================== */
const ROOMS = RP.rooms = {};
const ITEMS = RP.items = {};
const ACTS = RP.acts = {};
const LOCS = RP.locations = {};
const VOICES = {};
const GCOMBOS = [];
RP.walkthroughs = RP.walkthroughs || {};

function baseState() {
  return { v: 2, act: 1, room: null, kx: 320, ky: 230, face: "front", name: "",
    inv: ["phone"], money: 0, followers: 0, records: [], gear: {}, f: {}, msgs: [],
    unlocked: [], clock: "", day: "", stats: { sets: 0, digs: 0 }, done: [] };
}
let S = baseState();
RP.S = () => S;
Object.defineProperty(RP, "state", { get: () => S });

const room = id => ROOMS[id];
RP.room = def => {
  ROOMS[def.id] = Object.assign({ width: W, hotspots: [], actors: [], combos: [], sprites: [] }, def);
  return ROOMS[def.id];
};
RP.item = (id, def) => { ITEMS[id] = Object.assign({ id, name: id, short: id }, def); return ITEMS[id]; };
RP.combo = (a, b, h) => GCOMBOS.push([[a, b], h]);
RP.location = def => { LOCS[def.id] = Object.assign({ fare: 0 }, def); return LOCS[def.id]; };
RP.voice = (id, def) => { VOICES[id] = def; };
RP.defineAct = def => { ACTS[def.n] = def; return def; };

/* ======================================================================
   DOM
   ====================================================================== */
let built = false;
const dom = {};
function buildDom() {
  if (built) return; built = true;
  const app = el("div", { id: "app" }, document.body);
  dom.app = app;
  const frameBox = dom.frameBox = el("div", { id: "frameBox" }, app);
  const frame = dom.frame = el("div", { id: "frame" }, frameBox);
  dom.cv = el("canvas", { id: "cv", width: W, height: SH, "aria-label": "Game scene. Pick a verb, then click something." }, frame);
  dom.talk = el("div", { id: "talk", "aria-live": "polite" }, frame);
  dom.toast = el("div", { id: "toast" }, frame);
  const sent = dom.sentence = el("div", { id: "sentence" }, frame);
  dom.snd = el("button", { cls: "snd", type: "button", "aria-label": "Toggle sound", text: "SND" }, sent);
  dom.menuBtn = el("button", { cls: "menuBtn", type: "button", text: "MENU" }, sent);
  dom.sent = el("span", { id: "sent", text: "Walk to" }, sent);
  dom.hud = el("span", { cls: "hud", id: "hud" }, sent);
  const panel = dom.panel = el("div", { id: "panel" }, frame);
  dom.verbs = el("div", { id: "verbs", role: "toolbar", "aria-label": "Verbs" }, panel);
  dom.inv = el("div", { id: "inv", "aria-label": "Inventory" }, panel);
  dom.choices = el("div", { id: "choices", hidden: "" }, panel);
  dom.below = el("div", { id: "below" }, app);
  dom.hint = el("div", { id: "hint", text: "Turn your phone sideways for the full screen." }, app);
  dom.overlays = el("div", { id: "overlays" }, document.body);
  VERBS.forEach(([id, lab]) => {
    const bt = el("button", { cls: "verb", type: "button", text: lab }, dom.verbs);
    bt.dataset.v = id;
    bt.addEventListener("click", () => { if (busy) { if (skipFn) skipFn(); return; } verb = verb === id ? null : id; pending = null; updateVerbs(); renderInv(); updateSentence(); });
  });
  dom.snd.addEventListener("click", e => { e.stopPropagation(); setMute(!muted()); });
  dom.menuBtn.addEventListener("click", e => { e.stopPropagation(); if (!busy) RP.run(() => phoneMenu()); });
  bindInput();
  window.addEventListener("resize", layout);
  layout();
}

/* ======================================================================
   sound helpers (audio.js may be absent)
   ====================================================================== */
const A = () => RP.audio;
const sfx = (n, o) => { try { const a = A(); if (a && a.sfx && a.sfx[n]) a.sfx[n](o); } catch (e) { /* ignore */ } };
RP.sfx = sfx;
const muted = () => { const a = A(); return a ? !!a.muted : true; };
function setMute(m) { const a = A(); if (a && a.setMute) a.setMute(m); store.set("reparte.muted", m); dom.snd.textContent = m ? "SND OFF" : "SND ON"; }

/* ======================================================================
   verbs, sentence, HUD
   ====================================================================== */
const VERBS = [["look", "Look at"], ["pickup", "Pick up"], ["use", "Use"], ["open", "Open"], ["talk", "Talk to"], ["push", "Push"], ["close", "Close"], ["give", "Give"], ["pull", "Pull"]];
const VLAB = Object.fromEntries(VERBS);
let verb = null, pending = null, hoverName = "";
let busyN = 0;
let busy = false;
function setBusy(on) {
  busyN = Math.max(0, busyN + (on ? 1 : -1));
  busy = busyN > 0;
  if (dom.panel) dom.panel.classList.toggle("busy", busy);
}
function updateVerbs() { dom.verbs.querySelectorAll(".verb").forEach(bt => bt.classList.toggle("on", bt.dataset.v === verb)); }
function nameOf(id) { const it = ITEMS[id]; if (!it) return id; return typeof it.name === "function" ? it.name(S) : it.name; }
function shortOf(id) { const it = ITEMS[id]; if (!it) return id; const s = it.short == null ? it.name : it.short; return typeof s === "function" ? s(S) : s; }
function updateSentence() {
  let s = verb ? VLAB[verb] : "Walk to";
  if (pending) s += " " + nameOf(pending) + (verb === "give" ? " to" : " with");
  if (hoverName) s += " " + hoverName;
  dom.sent.textContent = s;
}
function updateHud() {
  if (!dom.hud) return;
  const parts = [fmtMoney(Math.round(S.money * 100) / 100)];
  if (S.followers || S.act > 1) parts.push(S.followers.toLocaleString("en-US") + " fans");
  if (S.clock) parts.push(S.clock);
  dom.hud.textContent = parts.join(" · ");
}
RP.hud = updateHud;

/* ======================================================================
   inventory
   ====================================================================== */
const iconCache = {};
function iconFor(id) {
  const it = ITEMS[id];
  const key = id + "|" + (it && it.iconKey ? it.iconKey(S) : "");
  if (iconCache[key]) return iconCache[key];
  const c = mk(32, 24), x = c.getContext("2d");
  try { if (it && it.icon) it.icon(x, S); else RP.icons.generic(x, id); } catch (e) { console.error(e); }
  iconCache[key] = c;
  return c;
}
function renderInv() {
  if (!dom.inv) return;
  dom.inv.innerHTML = "";
  const portrait = document.body.classList.contains("p");
  const n = portrait ? Math.max(4, S.inv.length) : Math.max(12, S.inv.length);
  for (let i = 0; i < n; i++) {
    const id = S.inv[i];
    const bt = el("button", { type: "button", cls: "slot" + (id ? "" : " empty") + (id && id === pending ? " sel" : "") }, dom.inv);
    if (id) {
      const ic = iconFor(id), c = mk(32, 24); c.getContext("2d").drawImage(ic, 0, 0);
      bt.appendChild(c); el("span", { text: shortOf(id) }, bt);
      bt.setAttribute("aria-label", nameOf(id));
      bt.addEventListener("click", () => clickItem(id));
      bt.addEventListener("contextmenu", e => { e.preventDefault(); if (!busy) act("look", { inv: id }); });
      bt.addEventListener("pointerenter", () => { hoverName = nameOf(id); updateSentence(); });
      bt.addEventListener("pointerleave", () => { hoverName = ""; updateSentence(); });
    } else { bt.disabled = true; bt.tabIndex = -1; }
  }
}
function clickItem(id) {
  if (busy) { if (skipFn) skipFn(); return; }
  if ((verb === "use" || verb === "give") && !pending) {
    const it = ITEMS[id] || {};
    if (verb === "use" && it.useAlone) { act("use", { inv: id }); return; }
    pending = id; renderInv(); updateSentence(); return;
  }
  if (pending) { if (pending === id) { pending = null; renderInv(); updateSentence(); return; } act(verb, { inv: id }, pending); return; }
  act(verb || "look", { inv: id });
}
const has = id => S.inv.includes(id);
function give(id, quiet) {
  if (!has(id)) { S.inv.push(id); if (!quiet && !fast) sfx("pickup"); }
  renderInv();
}
function take(id) { S.inv = S.inv.filter(x => x !== id); if (pending === id) pending = null; renderInv(); }
RP.has = has; RP.give = give; RP.take = take;
RP.refreshInv = () => { for (const k in iconCache) delete iconCache[k]; renderInv(); };

/* ======================================================================
   state helpers
   ====================================================================== */
RP.flag = (k, v) => { if (v === undefined) return S.f[k]; S.f[k] = v; return v; };
RP.money = (delta, quiet) => {
  S.money = Math.round((S.money + delta) * 100) / 100; updateHud();
  if (!quiet && delta) { toast((delta > 0 ? "+" : "-") + fmtMoney(Math.abs(delta)).replace("-", "")); sfx(delta > 0 ? "cash" : "coin"); }
  return S.money;
};
RP.canAfford = n => S.money >= n - 1e-9;
RP.followers = (delta, quiet) => {
  S.followers = Math.max(0, Math.round(S.followers + delta)); updateHud();
  if (!quiet && delta) toast((delta > 0 ? "+" : "") + delta.toLocaleString("en-US") + " fans");
  return S.followers;
};
RP.setClock = s => { S.clock = s; updateHud(); };
RP.rec = id => {
  const all = RP.data.records || [];
  for (const r of all) if (r.id === id) return r;
  return (RP.data.extraRecords || {})[id] || { id, artist: "Unknown Artist", title: id, label: "white label", year: null, genre: "house", bpm: 122, energy: 3, rarity: "common", price: 5, vibe: [], fact: "" };
};
RP.addRecord = (id, quiet) => { if (!S.records.includes(id)) { S.records.push(id); if (!quiet) { const r = RP.rec(id); toast("Crate +1: " + r.artist + " – " + r.title); } } };
RP.removeRecord = id => { S.records = S.records.filter(x => x !== id); };
RP.hasRecord = id => S.records.includes(id);
RP.setGear = (slot, id, quiet) => {
  S.gear[slot] = id;
  if (!quiet) { const g = RP.gearInfo(id); toast("Gear: " + (g ? g.brand + " " + g.model : id)); }
};
RP.gearInfo = id => (RP.data.gear || []).find(g => g.id === id) || (RP.data.extraGear || {})[id] || null;
RP.unlock = (...ids) => { ids.forEach(id => { if (!S.unlocked.includes(id)) S.unlocked.push(id); }); };
RP.text = (from, text, quiet) => { S.msgs.unshift({ from, text, act: S.act }); if (!quiet) { toast("New message: " + from); sfx("ping"); } };

/* ======================================================================
   rooms: instance, caches, actors
   ====================================================================== */
let cur = null;      // current room instance
const kid = { id: "kid", char: "kid", x: 320, y: 230, face: "front", act: "stand", frame: 0, ft: 0, path: [], walking: false, talking: false, mouth: 0, blink: false, nb: 2, onArrive: null, scale: 1, bounds: null };
RP.kid = kid;

function evalv(v, ...a) { return typeof v === "function" ? v(...a) : v; }

function makeInstance(def) {
  const inst = { def, id: def.id, width: def.width || W, bgKey: null, bg: null, lmKey: null, lm: null, halo: null, L: null, emissive: [], actors: [], fx: [], camX: 0, t0: performance.now() };
  // actors
  const list = evalv(def.actors, S) || [];
  list.forEach(a => {
    if (a.crowd) {
      const cr = a.crowd, rnd = U.mulberry(cr.seed || 5);
      for (let i = 0; i < (cr.n || 10); i++) {
        const cid = "crowd_" + def.id + "_" + i + "_" + (cr.seed || 5);
        if (!RP.chars.get(cid)) RP.chars.define(cid, Object.assign(RP.chars.random((cr.seed || 5) * 100 + i, cr.opts || {}), { id: cid }));
        const [rx, ry, rw, rh] = cr.rect;
        inst.actors.push(actorInst({ id: cid, char: cid, x: rx + rnd() * rw, y: ry + rnd() * rh, face: cr.face || "back", act: cr.act || "dance", frame: (rnd() * 4) | 0, scale: cr.scale, clickable: false, crowd: true, vis: cr.vis, speed: 0.8 + rnd() * 0.5, fid: i }));
      }
      return;
    }
    inst.actors.push(actorInst(a));
  });
  const fxs = evalv(def.fx, S) || [];
  inst.fx = fxs.map((f, i) => RP.fx.makeFx(f, i * 17 + 3));
  return inst;
}
function actorInst(a) {
  return Object.assign({ char: a.char || a.id, face: "front", act: "stand", frame: 0, ft: 0, path: [], walking: false, talking: false, mouth: 0, blink: false, nb: 1 + Math.random() * 3, onArrive: null, clickable: true, bounds: null, baseAct: a.act || "stand" }, a);
}
function actorById(id) { if (id === "kid") return kid; return cur && cur.actors.find(a => a.id === id); }
RP.actor = actorById;
function visible(a) { return !a.vis || a.vis(S); }

function roomBg() {
  const def = cur.def;
  const key = def.cacheKey ? String(def.cacheKey(S)) : "";
  if (cur.bg && cur.bgKey === key) return cur.bg;
  const c = mk(cur.width, SH), x = c.getContext("2d");
  let em = [];
  try { em = def.paint ? def.paint(x, S, cur) || [] : []; } catch (e) { console.error("paint " + def.id, e); }
  cur.emissive = Array.isArray(em) ? em : [];
  cur.bg = c; cur.bgKey = key; cur.lmKey = null;
  return c;
}
function roomLight() {
  const def = cur.def;
  if (!def.light) return null;
  const key = cur.bgKey + "|" + (def.lightKey ? String(def.lightKey(S)) : "");
  if (cur.lm !== null && cur.lmKey === key) return cur.lm;
  const L = Object.assign({}, evalv(def.light, S));
  L.emissive = (L.emissive || []).concat(L.noPaintEmissive ? [] : cur.emissive);
  cur.L = L;
  cur.lm = buildLm(L);
  cur.halo = RP.fx.buildHalos(L, cur.width, SH);
  cur.lmKey = key;
  return cur.lm;
}
const lmCache = new Map();
function buildLm(L) {
  const k = JSON.stringify([L.ambient, L.lights, L.emissive, cur.width]);
  if (lmCache.has(k)) return lmCache.get(k);
  const c = RP.fx.buildLightmap(L, cur.width, SH);
  if (lmCache.size > 40) lmCache.clear();
  lmCache.set(k, c);
  return c;
}
RP.relight = () => { if (cur) { cur.lmKey = null; cur.bgKey = null; } };
RP.repaint = RP.relight;

/* ======================================================================
   walk area
   ====================================================================== */
function walkPoly() { const w = cur && evalv(cur.def.walk, S); return w && w.length ? w : [[8, 212], [cur ? cur.width - 8 : 632, 212], [cur ? cur.width - 8 : 632, 252], [8, 252]]; }
function inPoly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function nearestInPoly(x, y, pts) {
  if (inPoly(x, y, pts)) return [x, y];
  let best = null, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
    const px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(px - x, py - y);
    if (d < bd) { bd = d; best = [px, py]; }
  }
  // nudge inside
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const v = [cx - best[0], cy - best[1]], l = Math.hypot(v[0], v[1]) || 1;
  return [best[0] + v[0] / l * 1.5, best[1] + v[1] / l * 1.5];
}
function depthScale(y) {
  const sc = cur && cur.def.scale;
  if (!sc) return 1;
  const [y0, s0, y1, s1] = sc;
  return clamp(s0 + (s1 - s0) * (y - y0) / (y1 - y0), Math.min(s0, s1), Math.max(s0, s1));
}
RP.depthScale = depthScale;

/* ======================================================================
   movement
   ====================================================================== */
let fast = false;
function walkActor(a, x, y, face) {
  const pts = walkPoly();
  if (a === kid) [x, y] = nearestInPoly(x, y, pts);
  return new Promise(res => {
    if (fast) { a.x = x; a.y = y; if (face) a.face = face; a.walking = false; a.path = []; res(); return; }
    if (a.onArrive) { const cb = a.onArrive; a.onArrive = null; cb(); }
    a.path = [[x, y]];
    a.onArrive = () => { if (face) a.face = face; res(); };
  });
}
RP.walkTo = (x, y, face) => walkActor(kid, x, y, face);
RP.npcWalk = (id, x, y, face) => { const a = actorById(id); return a ? walkActor(a, x, y, face) : Promise.resolve(); };
RP.place = (id, x, y, face) => { const a = actorById(id); if (a) { a.x = x; a.y = y; if (face) a.face = face; a.path = []; } };
function updateActor(a, dt) {
  if (a.path.length) {
    const [tx, ty] = a.path[0];
    const dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy);
    const sp = (a.speedPx || 68) * dt * depthScale(a.y);
    if (dist <= sp) { a.x = tx; a.y = ty; a.path.shift(); }
    else { a.x += dx / dist * sp; a.y += dy / dist * sp; }
    if (Math.abs(dx) > Math.abs(dy) * 0.6) a.face = dx > 0 ? "right" : "left"; else if (dist > 0.5) a.face = dy > 0 ? "front" : "back";
    a.walking = true; a.act = "walk";
    a.ft += dt; if (a.ft > 0.13) { a.ft = 0; a.frame = (a.frame + 1) % 4; }
    if (!a.path.length) { a.walking = false; a.act = a.baseAct === "walk" ? "stand" : (a === kid ? "stand" : a.baseAct || "stand"); a.frame = 0; const cb = a.onArrive; a.onArrive = null; if (cb) cb(); }
  } else {
    const ac = a.act;
    if (ac === "dance" || ac === "dj") { a.ft += dt * (a.speed || 1); if (a.ft > (ac === "dj" ? 0.48 : 0.24)) { a.ft = 0; a.frame = (a.frame + 1) % 4; } }
  }
  if (a.talking) { a.mt = (a.mt || 0) + dt; if (a.mt > 0.12) { a.mt = 0; a.mouth = a.mouth ? 0 : 1; } } else a.mouth = 0;
  a.nb -= dt;
  if (a.nb <= 0) { if (a.blink) { a.blink = false; a.nb = 2 + Math.random() * 4; } else { a.blink = true; a.nb = 0.12; } }
}

/* ======================================================================
   rendering
   ====================================================================== */
let buf = null, bctx = null, k = 1, fade = 0, shakeT = 0, flashT = 0, flashCol = "#fff";
const fadePats = [];
function ensureBuf(w) {
  if (!buf || buf.width !== w) { buf = mk(w, SH); bctx = buf.getContext("2d"); }
  if (!fadePats.length) for (let lvl = 0; lvl <= 16; lvl++) {
    const t = mk(4, 4), tc = t.getContext("2d");
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (U.BAYER[y * 4 + x] < lvl) { tc.fillStyle = "#000"; tc.fillRect(x, y, 1, 1); }
    fadePats.push(bctx.createPattern(t, "repeat"));
  }
}
function drawActor(a, b, L) {
  const lt = RP.fx.actorLight(L, a.x, a.y);
  const sc = (a.scale || 1) * depthScale(a.y);
  a.bounds = RP.chars.draw(b, { id: a.char, def: a.def, x: a.x, y: a.y, face: a.face, act: a.act, frame: a.frame, mouth: a.talking ? a.mouth : 0, blink: a.blink, expr: a.expr, scale: sc, noShadow: a.noShadow, noCast: a.crowd || a.noCast, alpha: a.alpha }, lt);
}
let lastT = 0;
function render(now) {
  if (!cur) return;
  const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
  const t = now - cur.t0;
  const width = cur.width;
  ensureBuf(width);
  const b = bctx;
  b.globalCompositeOperation = "source-over"; b.globalAlpha = 1;
  b.drawImage(roomBg(), 0, 0);
  const L = (roomLight(), cur.L);
  try { if (cur.def.draw) cur.def.draw(b, S, t, cur); } catch (e) { console.error(e); }
  // depth sorted sprites + actors
  const items = [];
  (cur.def.sprites || []).forEach(s => { if (!s.vis || s.vis(S)) items.push({ y: evalv(s.y, S), d: () => s.draw(b, S, t, cur) }); });
  cur.actors.forEach(a => { if (visible(a)) items.push({ y: a.y + (a.z || 0), d: () => drawActor(a, b, L) }); });
  if (!cur.def.noKid && !S.f.__hideKid) items.push({ y: kid.y + (kid.z || 0), d: () => drawActor(kid, b, L) });
  items.sort((p, q) => p.y - q.y).forEach(i => { try { i.d(); } catch (e) { console.error(e); } });
  try { if (cur.def.drawFront) cur.def.drawFront(b, S, t, cur); } catch (e) { console.error(e); }
  // light
  if (cur.lm) {
    b.globalCompositeOperation = "multiply"; b.drawImage(cur.lm, 0, 0);
    if (cur.halo) { b.globalCompositeOperation = "lighter"; b.drawImage(cur.halo, 0, 0); }
    b.globalCompositeOperation = "source-over";
  }
  cur.fx.forEach(f => { try { RP.fx.stepAndDraw(f, b, dt, t, cur.camX); } catch (e) { console.error(e); } });
  try { if (cur.def.drawTop) cur.def.drawTop(b, S, t, cur); } catch (e) { console.error(e); }
  b.globalCompositeOperation = "source-over"; b.globalAlpha = 1;
  if (flashT > now) { b.save(); b.globalAlpha = clamp((flashT - now) / 300, 0, 0.8); b.fillStyle = flashCol; b.fillRect(cur.camX, 0, W, SH); b.restore(); }
  if (fade > 0) { b.fillStyle = fadePats[clamp(Math.round(fade * 16), 0, 16)]; b.fillRect(cur.camX, 0, W, SH); }
  // camera
  if (width > W) {
    const target = clamp(kid.x - W / 2, 0, width - W);
    cur.camX = cur.camLock != null ? cur.camLock : (fast ? target : cur.camX + (target - cur.camX) * Math.min(1, dt * 4));
    cur.camX = clamp(cur.camX, 0, width - W);
  } else cur.camX = 0;
  let ox = 0, oy = 0;
  if (shakeT > now) { ox = (Math.random() * 4 - 2) | 0; oy = (Math.random() * 3 - 1) | 0; }
  const ctx = dom.cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, dom.cv.width, dom.cv.height);
  ctx.drawImage(buf, Math.round(cur.camX), 0, W, SH, ox * k, oy * k, W * k, SH * k);
  repositionSpeech();
}

/* ======================================================================
   speech
   ====================================================================== */
let skipFn = null, speechScale = 1, curSpeech = null;
const wait = ms => new Promise(r => setTimeout(r, fast ? 0 : ms));
RP.wait = wait;
function speakerAnchor(who) {
  const v = VOICES[who];
  const inRoom = who !== "nar" && actorById(who === "kid" ? "kid" : who);
  if (v && v.anchor && !(inRoom && visible(inRoom))) { const a = evalv(v.anchor, S); return [a[0], a[1]]; }
  if (who === "nar") return [(cur ? cur.camX : 0) + W / 2, 70];
  const a = actorById(who === "kid" ? "kid" : who);
  if (a) { const sc = (a.scale || 1) * depthScale(a.y); return [a.x, a.y - RP.chars.headTop(a.char, sc, a.act) - 2]; }
  return [(cur ? cur.camX : 0) + W / 2, 60];
}
function speakerColor(who) {
  if (VOICES[who] && VOICES[who].color) return VOICES[who].color;
  if (who === "nar") return "#ffc44d";
  if (who === "kid") return "#ffffff";
  const a = actorById(who);
  const d = a && RP.chars.get(a.char);
  return d && d.voice ? d.voice : "#ffffff";
}
function repositionSpeech() {
  if (!curSpeech) return;
  const { el: e, who } = curSpeech;
  const [ax, ay] = speakerAnchor(who);
  const w = e.offsetWidth, h = e.offsetHeight;
  const sx = ax - (cur ? cur.camX : 0);
  e.style.left = clamp(sx - w / 2, 4, W - w - 4) + "px";
  e.style.top = clamp(ay - h, 4, SH - h - 4) + "px";
}
function say(text, who = "kid") {
  return new Promise(res => {
    dom.talk.innerHTML = "";
    if (fast) { RP.test.log.push((who || "kid") + ": " + text); res(); return; }
    const e = el("div", { cls: "line" + (who === "nar" ? " nar" : "") }, dom.talk);
    const v = VOICES[who];
    e.textContent = (v && v.prefix ? v.prefix : "") + text;
    e.style.color = speakerColor(who);
    e.style.fontSize = (who === "nar" ? 24 : 20) * speechScale + "px";
    e.style.maxWidth = Math.min(600, (who === "nar" ? 440 : 300) * Math.max(1, speechScale * 0.9)) + "px";
    curSpeech = { el: e, who };
    repositionSpeech();
    const a = actorById(who === "kid" ? "kid" : who);
    if (a) a.talking = true;
    let done = false;
    const dur = Math.max(1500, 650 + text.length * 48);
    const finish = () => { if (done) return; done = true; clearTimeout(tm); e.remove(); curSpeech = null; if (a) a.talking = false; skipFn = null; res(); };
    const tm = setTimeout(finish, dur);
    skipFn = finish;
  });
}
async function lines(arr) {
  for (const l of arr) {
    if (typeof l === "function") { await l(); continue; }
    const m = /^@([\w-]+) ([\s\S]*)$/.exec(l);
    if (m) await say(m[2], m[1]); else await say(l, "kid");
  }
}
RP.say = say; RP.lines = lines;

function choose(opts) {
  return new Promise(res => {
    if (fast) {
      const q = RP.test.answers.length ? RP.test.answers.shift() : opts.length - 1;
      const i = typeof q === "string" ? Math.max(0, opts.findIndex(o => o.toLowerCase().includes(q.toLowerCase()))) : q;
      RP.test.log.push("choose[" + i + "]: " + opts[i]);
      res(clamp(i, 0, opts.length - 1)); return;
    }
    const ch = dom.choices;
    ch.innerHTML = ""; ch.hidden = false; dom.verbs.hidden = true; dom.inv.hidden = true;
    dom.panel.classList.add("choosing");
    opts.forEach((o, i) => {
      const bt = el("button", { type: "button", cls: "choice", text: o }, ch);
      bt.addEventListener("click", e => { e.stopPropagation(); ch.hidden = true; dom.verbs.hidden = false; dom.inv.hidden = false; dom.panel.classList.remove("choosing"); res(i); });
    });
    const first = ch.querySelector("button"); if (first) setTimeout(() => first.focus({ preventScroll: true }), 0);
  });
}
RP.choose = choose;

/* conversation helper: options = [{ text, when?:fn, once?:bool, run: async fn (return "end" to leave) }] */
RP.convo = async function (options, opts = {}) {
  const used = new Set();
  for (;;) {
    const avail = options.filter((o, i) => (!o.when || o.when(S)) && !(o.once && used.has(i)));
    if (!avail.length) return;
    const i = await choose(avail.map(o => evalv(o.text, S)));
    const o = avail[i]; used.add(options.indexOf(o));
    if (o.say !== false) await say(evalv(o.text, S));
    const r = o.run ? await o.run() : null;
    if (r === "end" || o.end) return;
    if (opts.once) return;
  }
};

/* ======================================================================
   effects & toasts
   ====================================================================== */
RP.fadeTo = (target, ms = 600) => new Promise(res => {
  if (fast) { fade = target; res(); return; }
  const from = fade, t0 = performance.now();
  (function step(t) { const p = Math.min(1, (t - t0) / ms); fade = from + (target - from) * p; if (p < 1) requestAnimationFrame(step); else res(); })(t0);
});
RP.shake = ms => { shakeT = performance.now() + ms; };
RP.flash = (col = "#fff", ms = 300) => { flashCol = col; flashT = performance.now() + ms; };
let toastQ = [], toastOn = false;
function toast(msg) {
  if (fast) { RP.test.log.push("toast: " + msg); return; }
  toastQ.push(msg);
  if (!toastOn) nextToast();
}
function nextToast() {
  const m = toastQ.shift();
  if (!m) { toastOn = false; return; }
  toastOn = true;
  const t = el("div", { cls: "toastItem", text: m }, dom.toast);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => { t.remove(); nextToast(); }, 300); }, 1700);
}
RP.toast = toast;

/* ======================================================================
   overlays (cards, phone, crate, gear, travel)
   ====================================================================== */
function overlay(cls) {
  const o = el("div", { cls: "overlay " + (cls || "") }, dom.overlays);
  return o;
}
RP.overlay = overlay;

RP.card = function (o) {
  return new Promise(res => {
    if (fast) { RP.test.log.push("card: " + (o.title || "")); res(); return; }
    const ov = overlay("card");
    const box = el("div", { cls: "cardbox" }, ov);
    if (o.kicker) el("div", { cls: "kicker", text: o.kicker }, box);
    if (o.title) el("h2", { html: o.titleHtml || esc(o.title) }, box);
    if (o.sub) el("div", { cls: "sub", text: o.sub }, box);
    (o.body ? [].concat(o.body) : []).forEach(p => el("p", { text: p }, box));
    if (o.checks) { const ul = el("ul", { cls: "checks" }, box); o.checks.forEach(([y, t]) => el("li", { cls: y ? "y" : "", text: t }, ul)); }
    const row = el("div", { cls: "erow" }, box);
    const bt = el("button", { cls: "btn primary", type: "button", text: o.button || "CONTINUE" }, row);
    bt.addEventListener("click", () => { ov.remove(); res(); });
    setTimeout(() => bt.focus({ preventScroll: true }), 30);
  });
};

/* phone: messages list */
RP.phone = function (msgs) {
  return new Promise(res => {
    if (msgs) msgs.slice().reverse().forEach(m => S.msgs.unshift(Object.assign({ act: S.act }, m)));
    if (fast) { res(); return; }
    const ov = overlay("texts");
    const card = el("div", { cls: "phonecard", role: "dialog", "aria-label": "Messages" }, ov);
    const bar = el("div", { cls: "bar" }, card); el("span", { text: "MESSAGES" }, bar); el("span", { text: S.f.battery || "41%" }, bar);
    const list = el("div", { cls: "msgs" }, card);
    const show = msgs || S.msgs.slice(0, 12);
    if (!show.length) el("div", { cls: "msg", text: "No messages. Not even Mom." }, list);
    show.forEach(m => { const d = el("div", { cls: "msg" + (m.hot ? " hot" : "") }, list); el("b", { text: m.from }, d); d.appendChild(document.createTextNode(m.text)); });
    const bt = el("button", { cls: "btn primary", type: "button", text: "CLOSE" }, card);
    bt.addEventListener("click", () => { ov.remove(); res(); });
    setTimeout(() => bt.focus({ preventScroll: true }), 30);
  });
};

/* record sleeve art, deterministic per record */
function sleeve(c, r, x, y, s) {
  const rnd = U.mulberry(U.hashStr(r.id));
  const pal = [["#1b1440", "#ff3fa4", "#39d0ff"], ["#efe6d0", "#c0302c", "#1d1622"], ["#0b0a12", "#ffd23f", "#efeaf6"], ["#2f62b8", "#efeaf6", "#ffd23f"], ["#3a1d5c", "#ff9a5a", "#ffd27a"], ["#e0e0e8", "#1d1622", "#5a8ad8"], ["#1d3a2a", "#9be15d", "#efeaf6"], ["#c0302c", "#17131f", "#efeaf6"]][Math.floor(rnd() * 8)];
  R(c, x, y, s, s, pal[0]);
  const kind = Math.floor(rnd() * 5);
  if (r.label && /white/i.test(r.label)) { R(c, x, y, s, s, "#efeae0"); ell(c, x + s / 2, y + s / 2, s * 0.18, s * 0.18, "#d8d0c0"); return; }
  if (kind === 0) { for (let i = 0; i < 6; i++) R(c, x, y + i * s / 6, s, s / 12, pal[1 + (i % 2)]); }
  else if (kind === 1) { ell(c, x + s / 2, y + s / 2, s * 0.32, s * 0.32, pal[1]); ell(c, x + s / 2, y + s / 2, s * 0.12, s * 0.12, pal[2]); }
  else if (kind === 2) { for (let i = 0; i < s; i += 3) R(c, x + i, y + s - (rnd() * s * 0.7), 2, s, pal[1 + (i % 2)]); }
  else if (kind === 3) { R(c, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.5, pal[1]); R(c, x + s * 0.1, y + s * 0.65, s * 0.5, s * 0.08, pal[2]); }
  else { U.poly(c, [[x, y + s], [x + s / 2, y + s * 0.2], [x + s, y + s]], pal[1]); ell(c, x + s * 0.75, y + s * 0.25, s * 0.1, s * 0.1, pal[2]); }
}
RP.sleeve = sleeve;

RP.crateView = function () {
  return new Promise(res => {
    if (fast) { res(); return; }
    const ov = overlay("crate");
    const box = el("div", { cls: "cratebox" }, ov);
    const head = el("div", { cls: "chead" }, box);
    el("h2", { text: "RECORD CRATE" }, head);
    el("span", { cls: "count", text: S.records.length + (S.records.length === 1 ? " record" : " records") }, head);
    const grid = el("div", { cls: "cgrid" }, box);
    const detail = el("div", { cls: "cdetail", text: S.records.length ? "Pick a record." : "Your crate is empty. That's a problem for a DJ." }, box);
    S.records.forEach(id => {
      const r = RP.rec(id);
      const bt = el("button", { type: "button", cls: "rec" }, grid);
      const c = mk(32, 32); sleeve(c.getContext("2d"), r, 0, 0, 32); bt.appendChild(c);
      el("span", { text: r.artist }, bt); el("small", { text: r.title }, bt);
      bt.addEventListener("click", () => {
        detail.innerHTML = "";
        el("b", { text: r.artist + " – " + r.title }, detail);
        el("div", { text: [r.label, r.year, r.format, r.genre].filter(Boolean).join(" · ") }, detail);
        el("div", { cls: "muted", text: "~" + r.bpm + " BPM · energy " + "▮".repeat(r.energy || 1) + (S.f["warped_" + id] ? " · WARPED" : "") }, detail);
        if (r.fact) el("div", { cls: "fact", text: r.fact }, detail);
      });
    });
    const bt = el("button", { cls: "btn primary", type: "button", text: "CLOSE" }, box);
    bt.addEventListener("click", () => { ov.remove(); res(); });
    setTimeout(() => bt.focus({ preventScroll: true }), 30);
  });
};

RP.gearView = function () {
  return new Promise(res => {
    if (fast) { res(); return; }
    const ov = overlay("crate");
    const box = el("div", { cls: "cratebox" }, ov);
    el("h2", { text: "YOUR SETUP" }, box);
    const list = el("div", { cls: "gearlist" }, box);
    const slots = [["decks", "Decks"], ["turntables", "Turntables"], ["mixer", "Mixer"], ["monitors", "Monitors"], ["headphones", "Headphones"], ["cartridge", "Cartridges"]];
    slots.forEach(([k, lab]) => {
      const id = S.gear[k]; if (!id) return;
      const g = RP.gearInfo(id);
      const row = el("div", { cls: "grow" }, list);
      el("span", { cls: "slotname", text: lab }, row);
      el("b", { text: g ? g.brand + " " + g.model : id }, row);
      if (g && g.fact) el("div", { cls: "fact", text: g.fact }, row);
    });
    const bt = el("button", { cls: "btn primary", type: "button", text: "CLOSE" }, box);
    bt.addEventListener("click", () => { ov.remove(); res(); });
    setTimeout(() => bt.focus({ preventScroll: true }), 30);
  });
};

/* subway map travel */
function availableLocations() {
  return Object.values(LOCS).filter(l => (l.act == null || l.act === S.act || (Array.isArray(l.act) && l.act.includes(S.act))) && (S.unlocked.includes(l.id) || (l.open && l.open(S))));
}
RP.travel = function (opts = {}) {
  return new Promise(res => {
    const locs = availableLocations();
    if (fast) {
      const id = RP.test.travelQ.length ? RP.test.travelQ.shift() : null;
      const l = id && LOCS[id];
      if (l) { travelTo(l).then(() => res(l.id)); } else res(null);
      return;
    }
    const ov = overlay("travel");
    const box = el("div", { cls: "travelbox" }, ov);
    el("h2", { text: opts.title || "WHERE TO?" }, box);
    const wrap = el("div", { cls: "mapwrap" }, box);
    const cv = el("canvas", { width: 320, height: 200, cls: "map" }, wrap);
    paintMap(cv.getContext("2d"), locs);
    const pins = el("div", { cls: "pins" }, wrap);
    const list = el("div", { cls: "tlist" }, box);
    const go = async l => {
      if (S.room === l.room && !opts.allowSame) { ov.remove(); await say("I'm already here."); res(null); return; }
      if (l.fare && !RP.canAfford(l.fare)) { ov.remove(); await say("The fare's " + fmtMoney(l.fare) + ". I have " + fmtMoney(S.money) + ". I'm walking nowhere fast."); res(null); return; }
      ov.remove(); await travelTo(l); res(l.id);
    };
    locs.forEach(l => {
      const here = S.room === l.room;
      const bt = el("button", { type: "button", cls: "tloc" + (here ? " here" : "") }, list);
      el("b", { text: l.label }, bt);
      el("span", { text: (l.area || "") + (l.fare ? " · " + fmtMoney(l.fare) : "") + (here ? " · you are here" : "") }, bt);
      bt.addEventListener("click", () => go(l));
      if (l.mx != null) {
        const p = el("button", { type: "button", cls: "pin" + (here ? " here" : ""), "aria-label": l.label, title: l.label }, pins);
        p.style.left = (l.mx / 320 * 100) + "%"; p.style.top = (l.my / 200 * 100) + "%";
        p.addEventListener("click", () => go(l));
      }
    });
    const bt = el("button", { cls: "btn", type: "button", text: "STAY HERE" }, box);
    bt.addEventListener("click", () => { ov.remove(); res(null); });
  });
};
async function travelTo(l) {
  if (l.fare) { RP.money(-l.fare, true); sfx("train"); }
  await RP.goto(l.room, l.x, l.y, l.face, { travel: true });
}
function paintMap(c, locs) {
  const w = 320, h = 200;
  R(c, 0, 0, w, h, "#0d1a2a");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < 2) P(c, x, y, "#12243a");
  // Manhattan
  U.poly(c, [[118, 0], [150, 0], [168, 60], [160, 120], [140, 150], [126, 128], [118, 70]], "#2a2440");
  // Brooklyn / Queens
  U.poly(c, [[170, 70], [320, 50], [320, 200], [150, 200], [146, 160], [168, 120]], "#262036");
  // Jersey
  U.poly(c, [[0, 0], [100, 0], [108, 80], [96, 200], [0, 200]], "#221c30");
  // Bronx
  U.poly(c, [[160, 0], [260, 0], [250, 30], [170, 40]], "#262036");
  // subway lines
  const lineC = ["#ff3fa4", "#39d0ff", "#ffd23f", "#9be15d"];
  [[[130, 10], [140, 60], [146, 120], [170, 150], [230, 170]], [[150, 20], [156, 80], [190, 110], [260, 120], [310, 130]], [[134, 40], [180, 90], [210, 150], [200, 195]]].forEach((pts, i) => {
    for (let j = 0; j + 1 < pts.length; j++) { U.line(c, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], lineC[i]); U.line(c, pts[j][0] + 1, pts[j][1], pts[j + 1][0] + 1, pts[j + 1][1], lineC[i]); }
  });
  U.txt(c, "MANHATTAN", 116, 160, "#8c84b8"); U.txt(c, "BROOKLYN", 212, 186, "#8c84b8"); U.txt(c, "QUEENS", 268, 64, "#8c84b8"); U.txt(c, "NJ", 30, 100, "#5a5480");
}

/* phone menu */
async function phoneMenu() {
  if (fast) return;
  const opts = [["msgs", "Messages (" + S.msgs.length + ")"], ["crate", "Record crate (" + S.records.length + ")"], ["gear", "My setup"]];
  if (!S.f.noTravel && availableLocations().length) opts.splice(1, 0, ["map", "Subway map"]);
  opts.push(["hint", "Show what I can click"], ["save", "Save game"], ["title", "Quit to title"], ["back", "Back"]);
  const i = await choose(opts.map(o => o[1]));
  const k = opts[i][0];
  if (k === "msgs") await RP.phone();
  if (k === "map") await RP.travel();
  if (k === "crate") await RP.crateView();
  if (k === "gear") await RP.gearView();
  if (k === "save") { save(); toast("Saved."); }
  if (k === "hint") setTimeout(revealHotspots, 50);
  if (k === "title") { save(); if (RP.onQuit) RP.onQuit(); }
}
RP.phoneMenu = phoneMenu;

/* ======================================================================
   mini-game host
   ====================================================================== */
const MG = RP.mg = { reg: {}, active: null };
MG.register = (id, def) => { MG.reg[id] = Object.assign({ id, title: id }, def); };
MG.list = () => Object.values(MG.reg);
MG.play = async function (id, params = {}) {
  const def = MG.reg[id];
  if (!def) {
    console.warn("missing mini-game " + id);
    const q = fast && RP.test.mgQ.length ? RP.test.mgQ.shift() : null;
    return Object.assign({ ok: true, score: 0, missing: true }, q || {});
  }
  if (fast) {
    const q = RP.test.mgQ.length ? RP.test.mgQ.shift() : null;
    const r = q || (def.auto ? def.auto(params, S) : { ok: true, score: 100 });
    RP.test.log.push("mg " + id + " -> " + JSON.stringify(r));
    return Object.assign({ auto: true }, r);
  }
  setBusy(true);
  const ov = overlay("mg mg-" + id);
  const root = el("div", { cls: "mg-wrap" }, ov);
  const cleanups = [];
  let rafs = [];
  const host = {
    root, ov, S, params, el: (t, a, p) => el(t, a, p || root),
    rec: RP.rec, sleeve, sfx, audio: A(), fast,
    onKey(fn) { const h = e => fn(e); document.addEventListener("keydown", h); cleanups.push(() => document.removeEventListener("keydown", h)); },
    onKeyUp(fn) { const h = e => fn(e); document.addEventListener("keyup", h); cleanups.push(() => document.removeEventListener("keyup", h)); },
    raf(fn) { let id; const loop = t => { if (fn(t) === false) return; id = requestAnimationFrame(loop); rafs[0] = id; }; id = requestAnimationFrame(loop); rafs.push(() => cancelAnimationFrame(id)); cleanups.push(() => cancelAnimationFrame(id)); },
    timeout(fn, ms) { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); return t; },
    interval(fn, ms) { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); return t; },
    cleanup(fn) { cleanups.push(fn); },
    header(title, sub) { const h = el("div", { cls: "mg-head" }, root); el("div", { cls: "mg-logo", html: esc(title).replace(".", "<span>.</span>") }, h); if (sub) el("div", { cls: "mg-sub", text: sub }, h); return h; },
    button(text, onClick, cls) { const b = el("button", { cls: "btn " + (cls || ""), type: "button", text }, root); b.addEventListener("click", onClick); return b; }
  };
  MG.active = host;
  let result;
  try { result = await def.play(host, params); }
  catch (e) { console.error("mini-game " + id, e); result = { ok: false, error: String(e) }; }
  cleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  ov.remove();
  MG.active = null;
  setBusy(false);
  return result || { ok: false };
};

/* ======================================================================
   hotspots & hit testing
   ====================================================================== */
function hotspots() { return (cur && cur.def.hotspots) || []; }
function hotDef(id) { return hotspots().find(h => h.id === id); }
function rectsOf(h) {
  if (h.rects) return evalv(h.rects, S);
  if (h.r) return [evalv(h.r, S)];
  return [];
}
function hitTest(x, y, touch) {
  let best = null;
  const cands = hotspots().filter(h => (h.r || h.rects || h.poly) && (!h.vis || h.vis(S)));
  for (const h of cands) {
    const z = h.z == null ? 10 : h.z;
    if (h.poly) { if (inPoly(x, y, evalv(h.poly, S)) && (!best || z > best.z)) best = { id: h.id, z }; continue; }
    for (const [rx, ry, rw, rh] of rectsOf(h)) if (x >= rx && x < rx + rw && y >= ry && y < ry + rh && (!best || z > best.z)) best = { id: h.id, z };
  }
  // actors
  for (const a of cur.actors) {
    if (!a.clickable || !visible(a) || !a.bounds) continue;
    const [bx, by, bw, bh] = a.bounds;
    const z = a.hotZ == null ? 80 : a.hotZ;
    if (x >= bx + 2 && x < bx + bw - 2 && y >= by && y < by + bh && (!best || z > best.z)) best = { id: a.id, z, actor: true };
  }
  if (kid.bounds && !cur.def.noKid) {
    const [bx, by, bw, bh] = kid.bounds;
    if (x >= bx + 3 && x < bx + bw - 3 && y >= by && y < by + bh && (!best || best.floor || best.z <= 15)) best = { id: "self", z: 99 };
  }
  if (best) { const h = hotDef(best.id); if (h && h.floor) best.floor = true; }
  if (!best && touch) {
    let bd = 12;
    for (const h of cands) for (const [rx, ry, rw, rh] of rectsOf(h)) {
      const dx = Math.max(rx - x, 0, x - (rx + rw)), dy = Math.max(ry - y, 0, y - (ry + rh)), dd = Math.hypot(dx, dy);
      if (dd < bd) { bd = dd; best = { id: h.id, z: h.z || 10 }; }
    }
  }
  return best;
}
function hotName(id) {
  if (id === "self") return "yourself";
  const h = hotDef(id);
  if (h && h.name) return evalv(h.name, S);
  const a = actorById(id);
  if (a) { if (a.name) return evalv(a.name, S); const d = RP.chars.get(a.char); return d ? d.name : id; }
  return id;
}

/* ======================================================================
   actions
   ====================================================================== */
const pickr = a => a[Math.floor(Math.random() * a.length)];
const DEFAULT = {
  look: n => "It's " + n + ". Pretty much what it looks like.",
  pickup: () => pickr(["I can't pick that up.", "That stays where it is.", "Not without a hand truck."]),
  use: () => pickr(["I can't figure out how to use that.", "That doesn't do anything.", "Nope."]),
  open: () => "That doesn't open.",
  close: () => "That doesn't close.",
  push: () => pickr(["It won't budge.", "Pushing it won't help."]),
  pull: () => pickr(["Nothing happens. Story of my life.", "It won't budge."]),
  talk: () => pickr(["It's not much of a talker.", "I'm not that lonely. Yet."]),
  talkActor: () => pickr(["They're busy.", "Not now. They look busy.", "They don't seem interested in talking to me."]),
  give: () => "I'd rather keep it.",
  with: () => pickr(["That doesn't work.", "I don't think that's how that works.", "No."])
};
RP.DEFAULT = DEFAULT;

async function runH(h, arg) {
  if (h == null) return false;
  const v = typeof h === "function" ? await h(S, arg) : h;
  if (typeof v === "string") await say(v);
  else if (Array.isArray(v)) await lines(v);
  return true;
}
RP.runH = runH;
function findCombo(a, b) {
  const lists = [(cur && cur.def.combos) || [], ...(S.act && ACTS[S.act] && ACTS[S.act].combos ? [ACTS[S.act].combos] : [])];
  for (const L of lists) for (const c of L) {
    const [x, y, h] = c.length === 3 ? c : [c[0][0], c[0][1], c[1]];
    if ((x === a && y === b) || (x === b && y === a)) return h;
  }
  for (const [[x, y], h] of GCOMBOS) if ((x === a && y === b) || (x === b && y === a)) return h;
  return null;
}
function walkPointFor(id, px, py) {
  const h = hotDef(id);
  if (h && h.walk) { const w = evalv(h.walk, S); if (w) return w; }
  const a = actorById(id);
  if (a && a !== kid) {
    const side = kid.x < a.x ? -1 : 1;
    const dist = h && h.talkDist != null ? h.talkDist : 30;
    return [a.x + side * dist, a.y + 1, side < 0 ? "right" : "left"];
  }
  if (h) {
    const rs = rectsOf(h);
    if (rs.length) {
      let r = rs[0];
      if (rs.length > 1 && px != null) r = rs.reduce((p, q) => Math.abs(q[0] + q[2] / 2 - px) < Math.abs(p[0] + p[2] / 2 - px) ? q : p);
      const [rx, ry, rw, rh] = r;
      const pt = nearestInPoly(rx + rw / 2, Math.max(ry + rh + 6, 0), walkPoly());
      return [pt[0], pt[1], ry + rh < pt[1] - 4 ? "back" : (rx + rw / 2 > kid.x ? "right" : "left")];
    }
  }
  return [px, py];
}
async function goExit(h) {
  let ex = evalv(h.exit, S);
  if (ex && typeof ex.then === "function") ex = await ex;
  if (typeof ex === "string" && ex === "travel") { await RP.travel(); return; }
  if (typeof ex === "string") { await say(ex); return; }
  if (!ex) return;
  if (ex.say) { await say(ex.say); }
  if (ex.room) await RP.goto(ex.room, ex.x, ex.y, ex.face);
}
async function act(v, target, withItem) {
  if (busy) return;
  setBusy(true);
  hoverName = target.hot ? hotName(target.hot) : nameOf(target.inv);
  dom.sent.textContent = (v === "walk" ? "Walk to" : (VLAB[v] || "Walk to")) + (withItem ? " " + nameOf(withItem) + (v === "give" ? " to " : " with ") : " ") + hoverName;
  try {
    if (target.hot) {
      const id = target.hot;
      const hd = id === "self" ? Object.assign({ name: "yourself", look: "Looking good. Looking broke, but good.", talk: "I'd answer, but I'm busy.", pickup: "I've been picking myself up for years." }, (cur.def.self || {})) : (hotDef(id) || {});
      const a = actorById(id);
      const isActor = !!(a && a !== kid);
      if (v === "walk") {
        const [wx, wy, f] = walkPointFor(id, target.x, target.y);
        await RP.walkTo(wx, wy, f);
        if (hd.exit) await goExit(hd);
        else if (hd.walkTo) await runH(hd.walkTo, target);
      } else {
        if (id !== "self" && v !== "look" && !hd.noWalk) { const [wx, wy, f] = walkPointFor(id, target.x, target.y); await RP.walkTo(wx, wy, f); }
        else if (id !== "self") { const [wx] = walkPointFor(id, target.x, target.y); kid.face = Math.abs(wx - kid.x) < 30 && !isActor ? "back" : (wx > kid.x || (isActor && a.x > kid.x) ? "right" : "left"); }
        if (isActor && (v === "talk" || v === "give") && !a.noTurn) a.face = a.x > kid.x ? "left" : "right";
        if (withItem) {
          const h = findCombo(withItem, id);
          if (h) await runH(h, target);
          else if (v === "give" && hd.give) await runH(hd.give, withItem);
          else await say(v === "give" ? (id === "self" ? "I already have it." : isActor ? "They don't want that." : "I'd rather keep it.") : DEFAULT.with());
        } else if (hd.exit && (v === "use" || v === "open")) {
          if (hd[v] != null) await runH(hd[v], target); else await goExit(hd);
        } else {
          const h = hd[v];
          if (h != null) await runH(h, target);
          else await say(v === "look" ? (hd.desc ? evalv(hd.desc, S) : DEFAULT.look(hotName(id))) : v === "talk" && isActor ? DEFAULT.talkActor() : DEFAULT[v] ? DEFAULT[v]() : "Nope.");
        }
      }
    } else {
      const id = target.inv, it = ITEMS[id] || {};
      if (withItem) {
        const h = findCombo(withItem, id);
        if (h) await runH(h);
        else await say(DEFAULT.with());
      } else {
        const h = it[v];
        if (h != null) await runH(h);
        else if (v === "pickup") await say("I already have it.");
        else if (v === "look") await say(it.desc ? evalv(it.desc, S) : "It's " + nameOf(id) + ".");
        else if (v === "give") await say("Give it to who?");
        else await say(DEFAULT[v] ? DEFAULT[v]() : "Nope.");
      }
    }
  } catch (e) { console.error(e); RP.test.errors.push(String(e && e.stack || e)); }
  setBusy(false);
  verb = null; pending = null; hoverName = ""; updateVerbs(); renderInv(); updateSentence(); updateHud();
  save();
}
RP.act = act;

/* run a scripted sequence with the panel locked */
RP.run = async function (fn) {
  setBusy(true);
  try { return await fn(); } catch (e) { console.error(e); RP.test.errors.push(String(e && e.stack || e)); } finally { setBusy(false); updateHud(); renderInv(); }
};

/* ======================================================================
   room transitions
   ====================================================================== */
let entering = false;
RP.goto = async function (id, x, y, face, opts = {}) {
  const def = ROOMS[id];
  if (!def) { console.error("no room " + id); RP.test.errors.push("no room " + id); return; }
  if (cur && !opts.instant) await RP.fadeTo(1, opts.travel ? 500 : 300);
  const from = cur ? cur.id : null;
  try { if (cur && cur.def.leave) await cur.def.leave(S, id); } catch (e) { console.error(e); }
  cur = makeInstance(def);
  S.room = id;
  const st = def.start || {};
  kid.x = x != null ? x : st.x != null ? st.x : 320; kid.y = y != null ? y : st.y != null ? st.y : 232;
  kid.face = face || st.face || "front"; kid.path = []; kid.walking = false; kid.act = "stand"; kid.onArrive = null;
  if (def.width > W) cur.camX = clamp(kid.x - W / 2, 0, def.width - W);
  try { const a = A(); if (a && a.setAmbience) a.setAmbience(evalv(def.ambience, S) || null, 1); } catch (e) { /* ignore */ }
  try { if (def.music !== undefined && RP.setMusic) RP.setMusic(evalv(def.music, S)); } catch (e) { /* ignore */ }
  hoverName = ""; updateSentence(); updateHud();
  roomBg(); roomLight();
  if (!opts.instant) await RP.fadeTo(0, 300); else fade = 0;
  save();
  if (def.enter) { entering = true; await RP.run(() => def.enter(S, from)); entering = false; }
};
RP.curRoom = () => cur;

/* ======================================================================
   input
   ====================================================================== */
function toLogical(e) { const r = dom.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W + (cur ? cur.camX : 0), (e.clientY - r.top) / r.height * SH]; }
function bindInput() {
  const cv = dom.cv;
  cv.addEventListener("pointermove", e => {
    if (busy || e.pointerType === "touch" || !cur) return;
    const [x, y] = toLogical(e); const h = hitTest(x, y, false);
    const hd = h && hotDef(h.id);
    const n = h && !(h.floor && !verb) ? hotName(h.id) : "";
    if (n !== hoverName) { hoverName = n; updateSentence(); }
    cv.classList.toggle("exit", !!(hd && hd.exit && !verb));
  });
  cv.addEventListener("pointerleave", () => { if (!busy) { hoverName = ""; updateSentence(); } });
  cv.addEventListener("contextmenu", e => {
    e.preventDefault();
    if (busy) { if (skipFn) skipFn(); return; }
    const [x, y] = toLogical(e); const h = hitTest(x, y, false);
    if (h) act("look", { hot: h.id, x, y });
  });
  cv.addEventListener("pointerdown", e => {
    if (e.button === 2 || !cur) return;
    const a = A(); if (a && a.ctx) a.ctx();
    if (busy) { if (skipFn) skipFn(); return; }
    const [x, y] = toLogical(e);
    const h = hitTest(x, y, e.pointerType === "touch");
    if (!h || (h.floor && !verb && !pending)) {
      hoverName = ""; verb = null; pending = null; updateVerbs(); renderInv(); updateSentence();
      RP.walkTo(x, y);
      return;
    }
    if (!verb && !pending) { act("walk", { hot: h.id, x, y }); return; }
    act(verb, { hot: h.id, x, y }, pending);
  });
  document.addEventListener("keydown", e => {
    if (MG.active) return;
    if (e.key === "Escape") { if (busy && skipFn) { skipFn(); return; } verb = null; pending = null; updateVerbs(); renderInv(); updateSentence(); }
    if ((e.key === " " || e.key === "Enter" || e.key === ".") && busy && skipFn) { e.preventDefault(); skipFn(); }
    if (!busy && !e.ctrlKey && !e.metaKey && !e.altKey && dom.overlays.childElementCount === 0 && (e.key === "h" || e.key === "H" || e.key === "Tab")) { e.preventDefault(); revealHotspots(); return; }
    if (!busy && !e.ctrlKey && !e.metaKey && !e.altKey && dom.overlays.childElementCount === 0) {
      const map = { l: "look", p: "pickup", u: "use", o: "open", t: "talk", s: "push", c: "close", g: "give", y: "pull" };
      const vb = map[e.key.toLowerCase()];
      if (vb && document.activeElement && document.activeElement.tagName !== "INPUT") { verb = verb === vb ? null : vb; pending = null; updateVerbs(); renderInv(); updateSentence(); }
    }
  });
}

/* ======================================================================
   hotspot reveal (H key / menu): label everything clickable for a moment
   ====================================================================== */
let revealT = null;
function revealHotspots() {
  if (!cur || fast) return;
  dom.talk.querySelectorAll(".hs").forEach(e => e.remove());
  const camX = cur.camX, placed = [];
  const put = (name, x, y) => {
    if (x - camX < -10 || x - camX > W + 10) return;
    const e = el("div", { cls: "hs", text: name }, dom.talk);
    const w = e.offsetWidth, h = e.offsetHeight;
    let lx = clamp(x - camX - w / 2, 2, W - w - 2), ly = clamp(y - h / 2, 2, SH - h - 2);
    for (let k = 0; k < 6; k++) {
      const hit = placed.find(p => lx < p[0] + p[2] + 2 && lx + w + 2 > p[0] && ly < p[1] + p[3] + 1 && ly + h + 1 > p[1]);
      if (!hit) break;
      ly = clamp(k % 2 ? hit[1] - h - 2 : hit[1] + hit[3] + 2, 2, SH - h - 2);
    }
    placed.push([lx, ly, w, h]);
    e.style.left = lx + "px"; e.style.top = ly + "px";
  };
  hotspots().forEach(h => {
    if (h.vis && !h.vis(S)) return;
    if (!h.r && !h.rects && !h.poly) return;
    const rs = h.poly ? [(() => { const p = evalv(h.poly, S); const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; })()] : rectsOf(h);
    const r = rs[0]; if (!r) return;
    put(hotName(h.id) + (h.exit ? " →" : ""), r[0] + r[2] / 2, r[1] + r[3] / 2);
  });
  cur.actors.forEach(a => { if (a.clickable && visible(a) && a.bounds) put(hotName(a.id), a.bounds[0] + a.bounds[2] / 2, a.bounds[1] + 6); });
  clearTimeout(revealT);
  revealT = setTimeout(() => dom.talk.querySelectorAll(".hs").forEach(e => e.remove()), 2600);
}
RP.revealHotspots = revealHotspots;

/* ======================================================================
   save / load
   ====================================================================== */
const SAVE_KEY = "reparte.save.v2";
function save() {
  if (!cur || RP.test.noSave) return;
  S.kx = Math.round(kid.x); S.ky = Math.round(kid.y); S.face = kid.face;
  store.set(SAVE_KEY, S);
}
RP.save = save;
RP.hasSave = () => { const d = store.get(SAVE_KEY); return !!(d && ROOMS[d.room]); };   // a save from a level this build lacks does not count
RP.loadSave = async function () {
  const d = store.get(SAVE_KEY);
  if (!d || !ROOMS[d.room]) return false;
  S = Object.assign(baseState(), d);
  applyWardrobe();
  renderInv(); updateHud();
  await RP.goto(S.room, S.kx, S.ky, S.face, { instant: true });
  return true;
};
RP.clearSave = () => store.del(SAVE_KEY);
RP.restore = async function (d) {
  if (!d || !ROOMS[d.room]) return false;
  S = Object.assign(baseState(), JSON.parse(JSON.stringify(d)));
  applyWardrobe(); renderInv(); updateHud();
  await RP.goto(S.room, S.kx, S.ky, S.face, { instant: true });
  return true;
};

/* ======================================================================
   acts
   ====================================================================== */
function applyWardrobe() {
  const a = ACTS[S.act];
  if (a && a.wardrobe && RP.chars.get("kid")) RP.chars.update("kid", a.wardrobe);
}
RP.startAct = async function (n, opts = {}) {
  const a = ACTS[n];
  if (!a) { console.error("no act " + n); return; }
  if (!opts.carry) { const name = S.name; S = baseState(); S.name = name || ""; }
  S.act = n; S.f.__hideKid = false;
  if (a.setup) a.setup(S, !!opts.carry);
  applyWardrobe();
  renderInv(); updateHud();
  if (!opts.noCard) await RP.card({ kicker: "LEVEL " + n, title: a.title, sub: a.sub || "", body: a.blurb ? [a.blurb] : [] });
  const st = a.start;
  await RP.goto(st.room, st.x, st.y, st.face, { instant: true });
  if (a.intro && !opts.noIntro) await RP.run(() => a.intro(S));
};
RP.completeAct = async function (checks) {
  const n = S.act, a = ACTS[n];
  if (!S.done.includes(n)) S.done.push(n);
  const unlocked = store.get("reparte.unlocked") || [];
  if (!unlocked.includes(n + 1)) { unlocked.push(n + 1); store.set("reparte.unlocked", unlocked); }
  await RP.card({ kicker: "LEVEL " + n + " COMPLETE", title: a.doneTitle || a.title, body: a.doneText ? [evalv(a.doneText, S)] : [], checks, button: ACTS[n + 1] ? "NEXT: " + ACTS[n + 1].title : "CONTINUE" });
  if (ACTS[n + 1]) await RP.startAct(n + 1, { carry: true });
  else if (RP.ending && !fast) await RP.ending();
};

/* ======================================================================
   layout
   ====================================================================== */
let s = 1;
function layout() {
  if (!dom.frame) return;
  const vw = document.documentElement.clientWidth || window.innerWidth, vh = document.documentElement.clientHeight || window.innerHeight;
  const portrait = vw < 600 && vh > vw;
  document.body.classList.toggle("p", portrait);
  const cs = getComputedStyle(dom.app), gut = (parseFloat(cs.paddingLeft) || 16) + (parseFloat(cs.paddingRight) || 16);
  const below = dom.below;
  if (portrait) {
    if (dom.sentence.parentNode !== below) { below.appendChild(dom.sentence); below.appendChild(dom.panel); }
    s = (vw - gut) / W;
    dom.frame.style.height = SH + "px";
    dom.frameBox.style.width = W * s + "px"; dom.frameBox.style.height = SH * s + "px";
    speechScale = clamp(15 / (20 * s), 1, 2.2);
  } else {
    if (dom.sentence.parentNode !== dom.frame) { dom.frame.appendChild(dom.sentence); dom.frame.appendChild(dom.panel); }
    s = Math.min((vw - gut) / W, (vh - 20) / 360);
    dom.frame.style.height = "360px";
    dom.frameBox.style.width = W * s + "px"; dom.frameBox.style.height = 360 * s + "px";
    speechScale = clamp(14 / (20 * s), 1, 1.8);
  }
  dom.frame.style.transform = "scale(" + s + ")";
  k = clamp(Math.ceil(s * (window.devicePixelRatio || 1)), 1, 4);
  dom.cv.width = W * k; dom.cv.height = SH * k;
  renderInv();
}
RP.layout = layout;

/* ======================================================================
   loop & boot
   ====================================================================== */
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (cur) {
    updateActor(kid, dt);
    cur.actors.forEach(a => updateActor(a, dt));
    try { if (cur.def.update) cur.def.update(dt, S, t - cur.t0, cur); } catch (e) { console.error(e); }
    S.kx = kid.x; S.ky = kid.y;
    render(t);
  }
  requestAnimationFrame(loop);
}
RP.boot = function () {
  buildDom();
  const m = store.get("reparte.muted");
  setMute(m == null ? false : !!m);
  updateVerbs(); renderInv(); updateSentence(); updateHud();
  requestAnimationFrame(loop);
};
RP.reset = () => { S = baseState(); kid.path = []; renderInv(); updateHud(); };
RP.hideGame = on => { if (dom.app) dom.app.style.visibility = on ? "hidden" : ""; };

/* ======================================================================
   test hooks
   ====================================================================== */
RP.test = {
  log: [], errors: [], answers: [], mgQ: [], travelQ: [], noSave: false,
  /* average cost in ms of one simulated frame (actor updates + full render) in the current room */
  frameCost(n = 60) {
    if (!cur) return null;
    const t0 = performance.now();
    let t = t0;
    for (let i = 0; i < n; i++) { t += 16.7; updateActor(kid, 1 / 60); cur.actors.forEach(a => updateActor(a, 1 / 60)); render(t); }
    return (performance.now() - t0) / n;
  },
  setFast(f) { fast = !!f; RP.fast = fast; },
  isBusy: () => busy,
  skip() { if (skipFn) skipFn(); },
  act: (v, target, item) => act(v, target, item),
  /* run a walkthrough: steps = [ [verb, "hot:id"|"inv:id", withItem?], ["answers", [..]], ["mg", result], ["travel", locId], ["goto", room, x, y], ["expect", fnOrString, msg], ["wait", ms] ] */
  async run(steps, opts = {}) {
    const res = { ok: true, failed: null, step: -1 };
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      res.step = i;
      try {
        const [k0] = st;
        if (k0 === "answers") RP.test.answers.push(...st[1]);
        else if (k0 === "mg") RP.test.mgQ.push(st[1]);
        else if (k0 === "travel") { RP.test.travelQ.push(st[1]); await RP.run(() => RP.travel()); }
        else if (k0 === "goto") await RP.goto(st[1], st[2], st[3], st[4], { instant: true });
        else if (k0 === "wait") await new Promise(r => setTimeout(r, st[1]));
        else if (k0 === "expect") {
          const ok = typeof st[1] === "function" ? st[1](S, RP) : new Function("S", "RP", "return (" + st[1] + ")")(S, RP);
          if (!ok) { res.ok = false; res.failed = "expect failed at step " + i + ": " + (st[2] || String(st[1])); break; }
        } else if (k0 === "run") { await RP.run(() => st[1](S, RP)); }
        else {
          const [vb, tgt, item] = st;
          const [kind, id] = tgt.split(":");
          if (kind === "inv" && !S.inv.includes(id)) { res.ok = false; res.failed = "step " + i + ": item not in inventory: " + id; break; }
          if (item && !S.inv.includes(item)) { res.ok = false; res.failed = "step " + i + ": item not in inventory: " + item; break; }
          await act(vb, kind === "inv" ? { inv: id } : { hot: id, x: kid.x, y: kid.y }, item || null);
        }
        while (busy) await new Promise(r => setTimeout(r, 0));
        if (RP.test.errors.length) { res.ok = false; res.failed = "error at step " + i + ": " + RP.test.errors[0]; break; }
      } catch (e) { res.ok = false; res.failed = "exception at step " + i + ": " + e; break; }
      if (opts.onStep) opts.onStep(i, S);
    }
    return res;
  }
};
window.__rp = RP;
})();
