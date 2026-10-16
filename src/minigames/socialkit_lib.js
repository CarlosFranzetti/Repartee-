/* socialkit_lib.js — shared helpers for the four "social" mini-games:
   promoter.Talk, guest.List, club.Drama, get.Followers.
   Loaded after the games (alphabetical), so it is only ever touched inside play().
   Everything hangs off RP.social:
     SK.css()                       inject the shared stylesheet once
     SK.session(host)               timers/keys/skip bookkeeping that dies with the overlay
     SK.canvas(parent, w, h, maxK)  pixel canvas, integer-scaled to fit
     SK.meter / SK.say / SK.choices / SK.intro / SK.endCard   shared UI
     SK.P.*                         pixel painters (dithered gradients, glow, brick, skyline, neon...)
     SK.drawChar(c, def, x, y, o)   RP.chars.draw wrapper that never throws
     SK.djName() SK.mangle(name) SK.fmt(str, vars) SK.shuffle(arr, rnd) SK.reduced() */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { el, clamp, R, P, ell, bayer, mulberry, ramp, mix, txt, txtC, txtW } = U;
const SK = RP.social = {};
const pickR = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];

/* ------------------------------------------------------------------ small utils */
SK.reduced = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
SK.djName = () => { const s = RP.state; return (s && s.name) ? String(s.name) : "DJ NOBODY"; };
SK.followers = (p) => { const s = RP.state; const f = s && s.followers; return (p && p.arcade) || !f ? 450 : f; };
SK.fmtNum = n => Math.round(n).toLocaleString("en-US");
SK.pick = pickR;
SK.shuffle = (a, rnd = Math.random) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
SK.fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
SK.mangle = (name, rnd = Math.random) => {
  const n = String(name || "DJ NOBODY");
  const swap = () => { const ch = n.split(""); const idx = []; ch.forEach((c, i) => { if (/[A-Z]/i.test(c) && i + 1 < ch.length && /[A-Z]/i.test(ch[i + 1]) && i > 1) idx.push(i); }); if (!idx.length) return n + "Y"; const i = pickR(idx, rnd); [ch[i], ch[i + 1]] = [ch[i + 1], ch[i]]; return ch.join(""); };
  const V = "AEIOU"; const vow = () => n.replace(/[AEIOU]/i, c => V[(V.indexOf(c.toUpperCase()) + 2) % 5]);
  const opts = [swap, vow, () => "DJ Whatsisname", () => n.replace(/^DJ\s*/i, "") + "-ski", () => "DJ " + (n.replace(/^DJ\s*/i, "")[0] || "X") + "-something"];
  const m = pickR(opts, rnd)();
  return m === n ? "DJ Whatsisname" : m;
};

/* ------------------------------------------------------------------ stylesheet */
const CSS = `
.sk-wrap { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sk-head .sk-leave { font-size: 18px; padding: 2px 12px; margin-left: auto; }
.mg-head.sk-head { align-items: center; }
.sk-grid { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; }
.sk-grid.one { grid-template-columns: minmax(0, 1fr); }
.sk-stage { position: relative; line-height: 0; background: #05030a; border: 2px solid #3a2f78; box-shadow: 0 0 0 2px #120a2c, 0 6px 0 #000; width: fit-content; max-width: 100%; margin: 0 auto; }
.sk-stage canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; max-width: 100%; }
.sk-side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sk-hud { display: flex; flex-wrap: wrap; gap: 8px 14px; }
.sk-meter { flex: 1 1 130px; min-width: 120px; display: flex; flex-direction: column; gap: 3px; }
.sk-meter .lab { display: flex; justify-content: space-between; align-items: baseline; font-size: 18px; color: var(--muted); letter-spacing: .04em; }
.sk-meter .lab b { color: var(--fg); font-weight: 400; font-variant-numeric: tabular-nums; }
.sk-meter .bar { position: relative; height: 16px; background: #0a0716; border: 2px solid #2d2456; overflow: hidden; }
.sk-meter .fill { height: 100%; width: 0; background: var(--c, var(--pink)); transition: width .45s steps(9); box-shadow: inset 0 -4px 0 rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.28); }
.sk-meter .bar::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 6px, #0a0716 6px 8px); pointer-events: none; }
.sk-meter .mark { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #fff; opacity: .55; z-index: 2; }
.sk-meter.pips .bar { display: flex; gap: 3px; padding: 2px; height: 20px; background: transparent; border: 0; overflow: visible; }
.sk-meter.pips .bar::after { display: none; }
.sk-meter.pips i { flex: 1; background: #1a1534; border: 1px solid #2d2456; transition: background .2s steps(2); }
.sk-meter.pips i.on { background: var(--c, var(--pink)); border-color: rgba(255,255,255,.35); box-shadow: inset 0 -4px 0 rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.28); }
.sk-meter.hit .bar { animation: skshake .3s steps(3) 1; }
.sk-meter.good .lab b { color: var(--ok); } .sk-meter.badm .lab b { color: #ff5a5a; }
@keyframes skshake { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
.sk-say { position: relative; background: #0c0919; border: 2px solid #3a3070; box-shadow: inset 0 0 0 2px #120e24; padding: 8px 14px 10px; min-height: 84px; cursor: pointer; }
.sk-say .nm { font-family: var(--logo); font-size: 11px; letter-spacing: .06em; color: var(--c, #ff8fcf); margin-bottom: 5px; text-transform: uppercase; }
.sk-say .tx { font-size: 25px; line-height: 1.04; color: #efeaff; }
.sk-say .more { position: absolute; right: 10px; bottom: 4px; color: var(--amber); font-size: 18px; animation: skblink 1s steps(1) infinite; }
.sk-say.sk-you { border-color: #1f5a78; }
@keyframes skblink { 50% { opacity: 0; } }
.sk-choices { display: flex; flex-direction: column; gap: 6px; }
.sk-choice { display: grid; grid-template-columns: 22px minmax(0, 1fr); column-gap: 8px; align-items: start; text-align: left; background: #120e24; border: 2px solid #2d2456; color: var(--fg); font-family: var(--ui); font-size: 22px; line-height: 1.04; padding: 6px 10px; cursor: pointer; border-radius: 2px; min-height: 38px; }
.sk-choice .k { color: var(--amber); }
.sk-choice .tag { display: inline-block; font-size: 14px; line-height: 1; padding: 2px 5px 1px; margin-right: 7px; border: 1px solid currentColor; letter-spacing: .08em; vertical-align: 2px; }
.sk-choice small { display: block; color: var(--muted); font-size: 16px; margin-top: 2px; }
.sk-choice:hover:not(:disabled), .sk-choice:focus-visible { border-color: var(--pink); background: #1c1030; outline: none; }
.sk-choice:focus-visible { box-shadow: 0 0 0 2px var(--cyan); }
.sk-choice:disabled { opacity: .45; cursor: default; }
.sk-choice.picked { border-color: var(--cyan); background: #12203a; opacity: 1; }
.t-conf { color: #62e6ff; } .t-desp { color: #ff6a6a; } .t-name { color: #ffc44d; } .t-joke { color: #9be15d; } .t-know { color: #ff6cbb; } .t-num { color: #b7aaf0; } .t-take { color: #efeaff; }
.sk-note { background: #120e24; border: 1px solid var(--line); border-radius: 3px; padding: 8px 10px; font-size: 19px; line-height: 1.08; color: #e4ddff; }
.sk-note h3 { margin: 0 0 4px; font-weight: 400; font-size: 17px; letter-spacing: .12em; color: var(--amber); }
.sk-note ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; }
.sk-note li::before { content: "> "; color: var(--pink); }
.sk-note b { font-weight: 400; color: var(--cyan); }
.sk-note { position: relative; } .sk-note .sk-tg { display: none; position: absolute; right: 8px; top: 6px; font-size: 16px; padding: 2px 10px; min-width: 0; }
.sk-note.closed ul { display: none; } .sk-note.closed h3 { margin-bottom: 0; }
@media (max-width: 559px), (max-height: 460px) { .sk-note .sk-tg { display: block; } }
.sk-intro, .sk-end { background: #120e24; border: 2px solid #3a3070; box-shadow: inset 0 0 0 2px #0c0919, 0 6px 0 #000; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; }
.sk-intro { align-items: stretch; text-align: left; }
.sk-intro h2, .sk-end h2 { margin: 0; font-family: var(--logo); font-weight: 400; font-size: clamp(16px, 4vw, 26px); line-height: 1.25; color: #fff; text-shadow: 0 3px 0 #2a0d3a; }
.sk-intro .kick, .sk-end .kick { font-size: 19px; letter-spacing: .14em; color: var(--muted); }
.sk-intro ol { margin: 0; padding-left: 22px; font-size: 22px; line-height: 1.1; display: flex; flex-direction: column; gap: 5px; color: #e4ddff; }
.sk-intro ol li::marker { color: var(--pink); }
.sk-intro b, .sk-end b { color: var(--cyan); font-weight: 400; }
.sk-end .sub { font-size: 23px; color: var(--pink); line-height: 1.1; max-width: 560px; }
.sk-end .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; width: 100%; max-width: 560px; }
.sk-end .stat { background: #0a0716; border: 1px solid var(--line); padding: 6px; font-size: 17px; color: var(--muted); }
.sk-end .stat b { display: block; color: var(--fg); font-size: 28px; line-height: 1; margin-top: 2px; }
.sk-end .score { font-family: var(--logo); font-size: clamp(28px, 7vw, 48px); color: var(--amber); text-shadow: 0 4px 0 #3a1c00; }
.sk-end .score small { font-size: .38em; color: var(--muted); text-shadow: none; }
.sk-end .rank { font-size: 22px; color: var(--lime); letter-spacing: .1em; }
.sk-end canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
.sk-end.lose .score { color: #ff6a6a; text-shadow: 0 4px 0 #3a0000; } .sk-end.lose .rank { color: #ff8a8a; }
.sk-pill { display: inline-block; font-size: 16px; padding: 1px 8px; border: 1px solid var(--line); color: var(--muted); border-radius: 2px; letter-spacing: .06em; }
.sk-tip { font-size: 17px; color: var(--muted); }
@media (max-width: 959px) { .sk-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 480px) {
  .sk-say .tx { font-size: 23px; } .sk-choice { font-size: 21px; padding: 7px 8px; } .sk-intro, .sk-end { padding: 12px; }
  .sk-intro ol { font-size: 21px; }
}
@media (max-height: 460px) {
  .overlay.sk-g { padding-top: 4px; padding-bottom: 4px; }
  .sk-g .mg-wrap { gap: 5px; margin-block: 0; }
  .sk-g .mg-logo { font-size: 15px; } .sk-g .mg-sub { font-size: 16px; }
  .sk-g .sk-wrap { gap: 6px; }
  .sk-g .sk-say { min-height: 50px; padding: 4px 10px 6px; } .sk-g .sk-say .nm { font-size: 10px; margin-bottom: 2px; } .sk-g .sk-say .tx { font-size: 21px; }
  .sk-g .sk-choices { gap: 3px; } .sk-g .sk-choice { min-height: 28px; padding: 2px 8px; font-size: 18px; } .sk-g .sk-choice .tag { font-size: 12px; margin-right: 5px; }
  .sk-g .sk-meter .lab { font-size: 15px; } .sk-g .sk-meter .bar { height: 12px; } .sk-g .sk-meter.pips .bar { height: 16px; }
  .sk-g .sk-note { padding: 4px 8px; font-size: 17px; } .sk-g .sk-note h3 { font-size: 15px; margin-bottom: 2px; }
  .sk-g .sk-intro, .sk-g .sk-end { padding: 8px 12px; gap: 5px; } .sk-g .sk-intro ol { font-size: 18px; gap: 2px; } .sk-g .sk-intro h2, .sk-g .sk-end h2 { font-size: 15px; }
  .sk-g .sk-intro .sk-note ul { display: block; columns: 2; column-gap: 18px; } .sk-g .sk-intro .sk-note li { break-inside: avoid; } .sk-g .sk-intro .kick { font-size: 15px; } .sk-g .sk-intro .mg-msg { font-size: 19px; }
  .sk-g .sk-end .score { font-size: 24px; } .sk-g .sk-end .stat b { font-size: 21px; } .sk-g .sk-end canvas { width: 128px !important; height: 48px !important; } .sk-g .sk-end .sub { font-size: 19px; }
  .sk-g .sk-tip { display: none; }
}
@media (prefers-reduced-motion: reduce) { .sk-say .more { animation: none; } .sk-meter .fill { transition: none; } .sk-meter.hit .bar { animation: none; } }
`;
let cssDone = false;
SK.css = () => { if (cssDone) return; cssDone = true; try { el("style", { text: CSS }, document.head); } catch (e) { /* ignore */ } };

/* ------------------------------------------------------------------ session: timers, keys, advance */
SK.session = function (host) {
  const S = { host, dead: false, timers: new Set(), keyFn: null, advFn: null, resolvers: new Set() };
  host.cleanup(() => { S.dead = true; S.timers.forEach(clearTimeout); S.timers.clear(); });
  S.later = (fn, ms) => { const t = setTimeout(() => { S.timers.delete(t); if (!S.dead) { try { fn(); } catch (e) { console.error(e); } } }, ms); S.timers.add(t); return t; };
  /* wait ms, or until the player taps/presses Space/Enter (skippable) */
  S.wait = (ms, skippable = true) => new Promise(res => {
    if (S.dead) return;
    if (SK.reduced()) ms = Math.min(ms, 350);
    let done = false;
    const fin = () => { if (done) return; done = true; if (S.advFn === fin) S.advFn = null; res(); };
    S.later(fin, ms);
    if (skippable) S.advFn = fin;
  });
  host.onKey(e => {
    if (S.dead || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^[1-9]$/.test(k)) { if (S.keyFn) { const r = S.keyFn(parseInt(k, 10) - 1); if (r !== false) e.preventDefault(); } return; }
    const onBtn = e.target && e.target.tagName === "BUTTON";
    if ((k === "Enter" || k === " ") && !onBtn) { if (S.advFn) { e.preventDefault(); S.advFn(); } else if (S.keyFn && S.enterFn) { e.preventDefault(); S.enterFn(); } }
    else if (S.extraKey) S.extraKey(e);
  });
  S.advance = () => { if (S.advFn) S.advFn(); };
  return S;
};

/* ------------------------------------------------------------------ header + leave */
SK.leave = function (host, head, S, onLeave) {
  const b = el("button", { cls: "btn sk-leave", type: "button", text: "LEAVE" }, head);
  b.addEventListener("click", () => { RP.sfx("click"); onLeave(); });
  return b;
};

/* ------------------------------------------------------------------ canvas */
SK.canvas = function (parent, w, h, maxK = 2, shortK = 1) {
  const stage = el("div", { cls: "sk-stage" }, parent);
  const cv = el("canvas", { cls: "px", width: w, height: h, role: "img" }, stage);
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  const api = { stage, cv, c, w, h, k: 1 };
  api.fit = () => {
    const vw = document.documentElement.clientWidth || window.innerWidth || 800, vh = document.documentElement.clientHeight || window.innerHeight || 600;
    const availW = Math.min(vw - 32, 980) - (vw >= 960 && !api.noSide ? 326 : 0);
    let k = Math.floor((availW - 4) / w);
    if (vh < 600) k = Math.min(k, shortK);
    k = clamp(k, 1, maxK);
    api.k = k;
    cv.style.width = w * k + "px"; cv.style.height = h * k + "px";
    if (w * k > vw - 36) { cv.style.width = "100%"; cv.style.height = "auto"; }
  };
  api.fit();
  const onR = () => api.fit();
  window.addEventListener("resize", onR);
  return api;
};

/* ------------------------------------------------------------------ meters */
SK.meter = function (parent, o) {
  const box = el("div", { cls: "sk-meter" + (o.pips ? " pips" : ""), style: "--c:" + (o.color || "#ff3fa4") }, parent);
  box.style.setProperty("--c", o.color || "#ff3fa4");
  const lab = el("div", { cls: "lab" }, box);
  el("span", { text: o.label }, lab);
  const val = el("b", { text: "" }, lab);
  const bar = el("div", { cls: "bar" }, box);
  const max = o.max || 100;
  let fill = null, pips = [];
  if (o.pips) for (let i = 0; i < o.pips; i++) pips.push(el("i", {}, bar));
  else fill = el("div", { cls: "fill" }, bar);
  (o.marks || []).forEach(m => { const mk = el("span", { cls: "mark" }, bar); mk.style.left = (m / max * 100) + "%"; });
  const api = { box, value: 0 };
  api.set = (v, text) => {
    const prev = api.value; api.value = v;
    if (o.pips) pips.forEach((p, i) => p.classList.toggle("on", i < Math.ceil(v)));
    else fill.style.width = clamp(v / max * 100, 0, 100) + "%";
    val.textContent = text != null ? text : (o.pips ? Math.max(0, Math.ceil(v)) + "/" + o.pips : Math.round(v));
    if (v !== prev && prev !== undefined) {
      box.classList.remove("hit", "good", "badm"); void box.offsetWidth;
      box.classList.add(v < prev ? "badm" : "good"); if (v < prev) box.classList.add("hit");
      setTimeout(() => box.classList.remove("good", "badm"), 700);
    }
  };
  api.value = undefined; api.set(o.value != null ? o.value : max);
  return api;
};

/* ------------------------------------------------------------------ dialogue box with typewriter */
SK.say = function (S, parent, opts = {}) {
  const box = el("div", { cls: "sk-say", tabindex: "0", role: "log", "aria-live": "polite" }, parent);
  const nm = el("div", { cls: "nm" }, box), tx = el("div", { cls: "tx" }, box), more = el("span", { cls: "more", text: "▼" }, box);
  more.style.display = "none";
  const api = { box, talking: false, last: "" };
  let cur = null;
  const blip = (pitch) => { try { RP.audio.tone(pitch + Math.random() * 40, 0.025, "square", 0.012); } catch (e) { /* ignore */ } };
  api.skip = () => { if (cur) cur.finish(true); };
  box.addEventListener("click", () => { if (cur) cur.finish(true); else S.advance(); });
  api.clear = () => { tx.textContent = ""; nm.textContent = ""; more.style.display = "none"; api.talking = false; };
  /* say(name, text, {color, pitch, speed, you}) resolves when fully typed */
  api.say = (name, text, o = {}) => new Promise(res => {
    if (S.dead) return;
    if (cur) cur.finish(true);
    box.style.setProperty("--c", o.color || "#ff8fcf");
    box.classList.toggle("sk-you", !!o.you);
    nm.textContent = name || ""; tx.textContent = ""; more.style.display = "none"; api.last = text;
    const chars = [...String(text)];
    if (SK.reduced() || o.instant || !chars.length) { tx.textContent = text; api.talking = false; res(); return; }
    const t0 = performance.now(), speed = o.speed || 56, pitch = o.pitch || 420;
    let i = 0, timer = 0, done = false;
    api.talking = true;
    const finish = (skipped) => {
      if (done) return; done = true; clearTimeout(timer); S.timers.delete(timer);
      tx.textContent = String(text); api.talking = false; cur = null; res();
    };
    cur = { finish };
    const tick = () => {
      if (S.dead || done) return;
      const n = Math.min(chars.length, Math.floor((performance.now() - t0) / 1000 * speed));
      if (n !== i) { i = n; tx.textContent = chars.slice(0, i).join(""); if (i % 2 === 0 && chars[i - 1] !== " ") blip(pitch); }
      if (i >= chars.length) finish(false); else { timer = setTimeout(tick, 16); S.timers.add(timer); }
    };
    tick();
  });
  api.more = on => { more.style.display = on ? "" : "none"; };
  return api;
};

/* ------------------------------------------------------------------ choice menu (mouse + number keys) */
SK.choices = function (S, parent, items, o = {}) {
  const wrap = el("div", { cls: "sk-choices", role: "group", "aria-label": o.label || "Your options" }, parent);
  return new Promise(res => {
    if (S.dead) return;
    let done = false;
    const btns = items.map((it, i) => {
      const b = el("button", { cls: "sk-choice", type: "button" }, wrap);
      el("span", { cls: "k", text: String(i + 1) }, b);
      const t = el("span", { cls: "t" }, b);
      if (it.tag) el("span", { cls: "tag " + (it.tagCls || ""), text: it.tag }, t);
      t.appendChild(document.createTextNode(it.text));
      if (it.sub) el("small", { text: it.sub }, t);
      if (it.disabled) b.disabled = true;
      b.addEventListener("click", () => pick(i));
      return b;
    });
    const pick = (i) => {
      if (done || !items[i] || items[i].disabled) return false;
      done = true; S.keyFn = null;
      btns.forEach((b, j) => { b.disabled = true; if (j === i) b.classList.add("picked"); });
      RP.sfx("select");
      res({ index: i, item: items[i], wrap, btns });
      return true;
    };
    S.keyFn = pick;
    if (o.focus !== false && btns[0] && !SK.reduced()) { /* focus first for keyboard users without stealing scroll */ try { btns.find(b => !b.disabled).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  });
};

/* ------------------------------------------------------------------ intro (how to play) */
SK.intro = function (S, root, o) {
  return new Promise(res => {
    const box = el("section", { cls: "sk-intro" }, root);
    if (o.kicker) el("div", { cls: "kick", text: o.kicker }, box);
    el("h2", { text: o.title }, box);
    if (o.lead) el("div", { cls: "mg-msg", text: o.lead }, box);
    const ol = el("ol", {}, box);
    o.steps.forEach(s => el("li", { html: s }, ol));
    if (o.extra) o.extra(box);
    const row = el("div", { cls: "row" }, box);
    if (o.pill) el("span", { cls: "sk-pill", text: o.pill }, row);
    el("div", { cls: "spacer" }, row);
    const go = el("button", { cls: "btn primary", type: "button", text: o.button || "START" }, row);
    const start = () => { if (box.__done) return; box.__done = true; S.keyFn = null; S.enterFn = null; RP.sfx("select"); box.remove(); res(); };
    go.addEventListener("click", start);
    S.keyFn = i => { if (i === 0) { start(); return true; } return false; };
    S.enterFn = start;
    try { go.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  });
};

/* ------------------------------------------------------------------ end card */
SK.rank = score => score >= 90 ? "HEADLINER" : score >= 75 ? "SOLD OUT" : score >= 55 ? "SOLID" : score >= 35 ? "OPENER" : "WALK-IN";
SK.endCard = function (S, root, o) {
  return new Promise(res => {
    const box = el("section", { cls: "sk-end" + (o.ok ? "" : " lose") }, root);
    if (o.kicker) el("div", { cls: "kick", text: o.kicker }, box);
    if (o.stamp) { const cv = el("canvas", { cls: "px", width: o.stamp.w, height: o.stamp.h }, box); cv.style.width = o.stamp.w * (o.stamp.k || 4) + "px"; cv.style.height = o.stamp.h * (o.stamp.k || 4) + "px"; cv.style.maxWidth = "100%"; o.stamp.draw(cv.getContext("2d")); }
    el("h2", { text: o.title }, box);
    (o.lines || []).forEach(l => el("div", { cls: "sub", text: l }, box));
    if (o.stats && o.stats.length) { const st = el("div", { cls: "stats" }, box); o.stats.forEach(([k, v, cls]) => { const d = el("div", { cls: "stat", text: k }, st); el("b", { text: String(v), cls: cls || "" }, d); }); }
    el("div", { cls: "score", html: o.score + "<small> / 100</small>" }, box);
    el("div", { cls: "rank", text: o.rank || SK.rank(o.score) }, box);
    const go = el("button", { cls: "btn primary", type: "button", text: o.button || "CONTINUE" }, box);
    const fin = () => { if (box.__done) return; box.__done = true; S.keyFn = null; S.enterFn = null; RP.sfx("select"); res(); };
    go.addEventListener("click", fin);
    S.keyFn = i => { if (i === 0) { fin(); return true; } return false; };
    S.enterFn = fin;
    try { go.focus({ preventScroll: true }); box.scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ }
  });
};

/* ------------------------------------------------------------------ notes panel (collapsible on phones) */
SK.noteBox = function (parent, title, items, o = {}) {
  const box = el("div", { cls: "sk-note" }, parent);
  const h = el("h3", { text: title }, box);
  const narrow = (document.documentElement.clientWidth || window.innerWidth) < 560 || (window.innerHeight || 800) < 460;
  const ul = el("ul", {}, box);
  items.forEach(t => el("li", { text: t }, ul));
  const tg = el("button", { cls: "kbtn sk-tg", type: "button", text: "SHOW" }, box);
  const api = { box, ul, toggle: null };
  const set = open => { box.classList.toggle("closed", !open); tg.textContent = open ? "HIDE" : "SHOW"; };
  tg.addEventListener("click", () => set(box.classList.contains("closed")));
  api.set = set; api.toggle = () => set(box.classList.contains("closed"));
  set(!(narrow && o.collapseOnPhone !== false));
  return api;
};

/* ------------------------------------------------------------------ characters */
SK.drawChar = function (c, def, x, y, o = {}, light = {}) {
  try {
    if (!def) return null;
    const inst = Object.assign({ x, y, face: "front", act: "stand", frame: 0, scale: 2 }, o);
    if (typeof def === "string") inst.id = def; else inst.def = def;
    return RP.chars.draw(c, inst, Object.assign({ lx: -0.5, shadow: 0, cast: false }, light));
  } catch (e) { return null; }
};
/* pre-build character sprites in the background so the first draw of a pose never spikes a frame */
SK.warm = function (def, o, light) {
  try {
    const d = typeof def === "string" ? RP.chars.get(def) : def; if (!d) return;
    const face = o.face || "front", view = face === "left" || face === "right" ? "side" : face;
    const pose = { view, act: o.act || "stand", frame: o.frame || 0, mouth: o.mouth, blink: o.blink, expr: o.expr || undefined, flip: face === "left" };
    RP.chars.sprite(d, pose, (light && light.lx) || 0, light && light.rim ? { color: light.rim.color, side: light.rim.side } : null);
  } catch (e) { /* ignore */ }
};
/* run jobs (functions) one at a time, gap ms apart, until the session ends */
SK.warmQueue = function (S, jobs, gap = 45) {
  let i = 0;
  const step = () => { if (S.dead || i >= jobs.length) return; try { jobs[i++](); } catch (e) { /* ignore */ } S.later(step, gap); };
  S.later(step, 60);
};
/* the usual pose set for a talking head: expressions x mouth, a blink, optional extra acts */
SK.headJobs = function (def, face, light, exprs, extraActs) {
  const jobs = [];
  (exprs || ["", "happy", "angry", "sad", "surprised", "worried"]).forEach(e => { [false, true].forEach(m => jobs.push(() => SK.warm(def, { face, expr: e, mouth: m }, light))); });
  jobs.push(() => SK.warm(def, { face, blink: true }, light));
  (extraActs || []).forEach(a => [false, true].forEach(m => jobs.push(() => SK.warm(def, { face, act: a, mouth: m }, light))));
  return jobs;
};
SK.charDef = (id) => { try { return RP.chars.get(id) || null; } catch (e) { return null; } };
SK.voiceOf = (def, fallback) => { const d = typeof def === "string" ? SK.charDef(def) : def; return (d && d.voice && d.voice !== "#ffffff") ? d.voice : (fallback || "#ffd27a"); };

/* ------------------------------------------------------------------ pixel painters */
const PT = SK.P = {};
const K = ramp;
/* dithered fill between two colors; level = share of colB (0..1) */
PT.dith = (c, x, y, w, h, a, b, level) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { c.fillStyle = (bayer(x + i, y + j) + 0.5) / 16 < level ? b : a; c.fillRect(x + i, y + j, 1, 1); }
};
/* dithered vertical gradient through any number of colors */
PT.vgrad = (c, x, y, w, h, cols) => {
  const n = cols.length - 1;
  for (let j = 0; j < h; j++) {
    const t = h <= 1 ? 0 : j / (h - 1) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
    for (let k = 0; k < w; k++) { c.fillStyle = (bayer(x + k, y + j) + 0.5) / 16 < f ? cols[i + 1] : cols[i]; c.fillRect(x + k, y + j, 1, 1); }
  }
};
/* dithered radial glow (alpha pixels) */
PT.glow = (c, cx, cy, rx, ry, col, str = 1, alpha = 0.5) => {
  const pa = c.globalAlpha; c.globalAlpha = alpha; c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry)); if (d >= 1) continue;
    const v = (1 - d) * (1 - d) * str;
    if ((bayer(cx + x, cy + y) + 0.5) / 16 < v) c.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
  }
  c.globalAlpha = pa;
};
PT.speckle = (c, x, y, w, h, cols, n, seed) => { const r = mulberry(seed || 1); for (let i = 0; i < n; i++) P(c, x + r() * w | 0, y + r() * h | 0, cols[r() * cols.length | 0]); };
PT.brick = (c, x, y, w, h, base, seed, bw = 14, bh = 6) => {
  const r = mulberry(seed || 7), k = K(base);
  R(c, x, y, w, h, k[0]);
  for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
    const off = (row % 2) ? -bw / 2 : 0;
    for (let xx = x + off; xx < x + w; xx += bw) {
      const v = r(), col = v < 0.18 ? k[1] : v < 0.78 ? k[2] : k[3];
      const bx = Math.max(x, Math.round(xx) + 1), ex = Math.min(x + w, Math.round(xx) + bw - 1), eh = Math.min(bh - 1, y + h - yy);
      if (ex <= bx || eh <= 0) continue;
      R(c, bx, yy, ex - bx, eh, col); R(c, bx, yy, ex - bx, 1, k[3]); if (eh > 2) R(c, bx, yy + eh - 1, ex - bx, 1, k[1]);
      if (r() < 0.25) P(c, bx + (r() * (ex - bx) | 0), yy + 1 + (r() * Math.max(1, eh - 2) | 0), k[4]);
    }
  }
};
PT.planks = (c, x, y, w, h, base, seed, ph = 7) => {
  const r = mulberry(seed || 3), k = K(base);
  for (let yy = y, i = 0; yy < y + h; yy += ph, i++) {
    R(c, x, yy, w, ph, k[2 - (i % 2)]); R(c, x, yy, w, 1, k[3]); R(c, x, yy + ph - 1, w, 1, k[0]);
    for (let xx = x + ((i * 37) % 53); xx < x + w; xx += 38 + (r() * 30 | 0)) R(c, xx, yy, 1, ph, k[0]);
    for (let g = 0; g < 4; g++) { const gx = x + r() * w | 0; R(c, gx, yy + 1 + (r() * (ph - 3) | 0), 3 + (r() * 6 | 0), 1, k[1]); }
  }
};
/* little night window with a skyline, stars and lit windows */
PT.cityWindow = (c, x, y, w, h, seed, opts = {}) => {
  const r = mulberry(seed || 5);
  PT.vgrad(c, x, y, w, h, opts.sky || ["#0d0826", "#1d1046", "#36155a", "#6e2a6e", "#b3446e"]);
  for (let i = 0; i < w * h / 160; i++) P(c, x + r() * w | 0, y + r() * h * 0.5 | 0, r() < 0.3 ? "#ffffff" : "#9c8cff");
  let bx = x - 2;
  while (bx < x + w) { const bw = 8 + r() * 14 | 0, bh = 14 + r() * (h * 0.5) | 0; R(c, bx, y + h - bh, bw, bh, "#1a1038"); bx += bw; }
  bx = x - 3;
  while (bx < x + w) {
    const bw = 9 + r() * 15 | 0, bh = 8 + r() * (h * 0.4) | 0, top = y + h - bh;
    R(c, bx, top, bw, bh, "#0e0824"); R(c, bx, top, bw, 1, "#2a1850");
    for (let yy = top + 3; yy < y + h - 2; yy += 3) for (let xx = bx + 2; xx < bx + bw - 1; xx += 3) if (r() < 0.38) P(c, xx, yy, ["#ffd27a", "#ffb04a", "#ff9ad5", "#9fe8ff"][r() * 4 | 0]);
    bx += bw + 1;
  }
  if (opts.tower) { const tx = x + (opts.tower | 0), ty = y + h - 22; R(c, tx, ty, 9, 6, "#0a0618"); R(c, tx - 1, ty - 1, 11, 1, "#0a0618"); R(c, tx + 1, ty + 6, 1, 12, "#0a0618"); R(c, tx + 7, ty + 6, 1, 12, "#0a0618"); }
  if (opts.moon) ell(c, x + opts.moon[0], y + opts.moon[1], 4, 4, "#f2e7c4");
};
PT.glassFrame = (c, x, y, w, h, base = "#2a1c3a", cols = 2) => {
  const k = K(base);
  R(c, x - 3, y - 3, w + 6, 3, k[2]); R(c, x - 3, y + h, w + 6, 4, k[1]); R(c, x - 3, y - 3, 3, h + 7, k[2]); R(c, x + w, y - 3, 3, h + 7, k[1]);
  R(c, x - 3, y - 3, w + 6, 1, k[3]);
  for (let i = 1; i < cols; i++) R(c, x + Math.round(w * i / cols) - 1, y, 2, h, k[1]);
  /* glass sheen */
  for (let i = 0; i < 6; i++) { c.globalAlpha = 0.12; R(c, x + 8 + i * 3, y + i, 2, h - i * 2, "#ffffff"); c.globalAlpha = 1; }
};
/* glowing 3x5-font sign */
PT.neon = (c, text, cx, y, col, sc = 1, o = {}) => {
  const w = txtW(text, sc, sc), k = K(col);
  if (o.glow !== false) PT.glow(c, Math.round(cx), y + 3 * sc, Math.round(w / 2 + 10 * sc), 8 * sc, col, 0.9, 0.35);
  txt(c, text, Math.round(cx - w / 2) + 1, y + 1, k[0], sc, sc);
  txt(c, text, Math.round(cx - w / 2), y, k[3], sc, sc);
  if (sc > 1) { c.save(); c.beginPath(); c.rect(Math.round(cx - w / 2), y, w, Math.ceil(sc * 1.5)); c.clip(); txt(c, text, Math.round(cx - w / 2), y, k[4], sc, sc); c.restore(); }
};
PT.poster = (c, x, y, w, h, seed, title, o = {}) => {
  const r = mulberry(seed || 9), cols = ["#ff3fa4", "#39d0ff", "#ffc44d", "#9be15d", "#7a3fb0", "#e07a2a", "#efeaf6"];
  const a = cols[r() * cols.length | 0], b = cols[r() * cols.length | 0], base = o.paper || "#1c1238";
  R(c, x + 1, y + 1, w, h, "#0a0618"); R(c, x, y, w, h, base);
  PT.vgrad(c, x, y, w, Math.round(h * 0.55), [K(a)[2], K(b)[1]]);
  ell(c, x + w / 2, y + h * 0.4, Math.max(3, w * 0.22), Math.max(3, w * 0.22), K(b)[3]);
  for (let i = 0; i < 3; i++) R(c, x + 3, y + h * 0.62 + i * 3, w - 6 - (r() * 8 | 0), 1, i ? K(a)[3] : "#ffffff");
  if (title) txtC(c, title, x + w / 2, y + 2, "#fff6d6", 1, 1);
  R(c, x, y, w, 1, K(a)[4]);
  R(c, x + w / 2 - 3, y - 1, 6, 2, "#d8caa0");
  if (o.torn) { for (let i = 0; i < 3; i++) R(c, x + w - 2 - i, y + h - 3 + i, 3, 1, "#0a0618"); }
};
PT.speaker = (c, x, y, w, h, base = "#1a1626") => {
  const k = K(base); R(c, x, y, w, h, k[2]); R(c, x, y, w, 1, k[3]); R(c, x, y + h - 1, w, 1, k[0]); R(c, x, y, 1, h, k[1]);
  const cy1 = y + h * 0.3, cy2 = y + h * 0.72;
  [[cy1, Math.min(w, h) * 0.2], [cy2, Math.min(w, h) * 0.3]].forEach(([cy, rr]) => { ell(c, x + w / 2, cy, Math.round(rr), Math.round(rr), k[0]); ell(c, x + w / 2, cy, Math.round(rr * 0.6), Math.round(rr * 0.6), k[1]); P(c, x + w / 2 - 1, cy - 1, k[3]); });
};
PT.vignette = (c, w, h, strength = 1, col = "#05030a") => {
  c.fillStyle = col;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.abs(x - w / 2) / (w / 2), dy = Math.abs(y - h / 2) / (h / 2), d = Math.max(0, (dx * dx + dy * dy) / 2 - 0.35);
    if ((bayer(x, y) + 0.5) / 16 < d * 0.9 * strength) c.fillRect(x, y, 1, 1);
  }
};
/* darken (or tint) pixels by a per-pixel strength function fn(x,y)->0..1, dithered */
PT.shade = (c, x, y, w, h, fn, col = "#0a0414", alpha = 0.6) => {
  const pa = c.globalAlpha; c.globalAlpha = alpha; c.fillStyle = col;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = fn(x + i, y + j); if (v > 0 && (bayer(x + i, y + j) + 0.5) / 16 < v) c.fillRect(x + i, y + j, 1, 1); }
  c.globalAlpha = pa;
};
/* tiny pixel icons (9x9-ish) drawn from strings: '#' = col, 'o' = col2, '.' = empty */
PT.icon = (c, x, y, rows, col, col2) => { rows.forEach((s, j) => { for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === "#") P(c, x + i, y + j, col); else if (ch === "o") P(c, x + i, y + j, col2 || "#fff"); } }); };
PT.ICON = {
  heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
  bang: ["..##..", "..##..", "..##..", "..##..", "......", "..##.."],
  ques: [".####.", "##..##", "...##.", "..##..", "......", "..##.."],
  dollar: ["..#...", ".####.", "#.#...", ".###..", "..#.#.", "####..", "..#..."],
  zzz: ["#####.", "...#..", "..#...", ".#....", "#####."],
  star: ["..#..", "..#..", "#####", ".###.", "##.##"],
  check: ["......#", ".....#.", "#...#..", ".#.#...", "..#...."],
  cross: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  note: ["..####", "..#..#", "..#..#", "###.##", "###.##"],
  skull: [".#####.", "#######", "#.###.#", "#######", ".#.#.#.", ".#####."]
};
/* floating feedback texts drawn on the canvas */
SK.floats = function () {
  const list = [];
  return {
    add(text, x, y, col, o = {}) { list.push({ text: String(text), x, y, col: col || "#fff", t: 0, life: o.life || 1.4, rise: o.rise == null ? 14 : o.rise, sc: o.sc || 1, icon: o.icon || null }); },
    draw(c, dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i]; f.t += dt; if (f.t > f.life) { list.splice(i, 1); continue; }
        const y = Math.round(f.y - Math.min(1, f.t / 0.6) * f.rise), x = Math.round(f.x);
        if (f.t > f.life - 0.35 && Math.floor(f.t * 20) % 2) continue;
        const w = txtW(f.text, f.sc, 1);
        txt(c, f.text, x - Math.round(w / 2) + 1, y + 1, "#0a0414", f.sc, 1); txt(c, f.text, x - Math.round(w / 2), y, f.col, f.sc, 1);
        if (f.icon) PT.icon(c, x - Math.round(w / 2) - 9, y - 1, PT.ICON[f.icon] || PT.ICON.star, f.col);
      }
    },
    get busy() { return list.length > 0; }
  };
};
/* a blink every 2-5 s */
SK.blinker = function () { let next = 1.5 + Math.random() * 3, t = 0, until = 0; return dt => { t += dt; if (t > next) { until = t + 0.14; next = t + 2 + Math.random() * 3.5; } return t < until; }; };
})();
