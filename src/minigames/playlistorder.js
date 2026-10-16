/* playlist.Order — arrange records into slots so the set follows an energy arc.
   Params (all optional):
     records: [recordIds]   the pool (more than slots = some are decoys)     slots: 6-10 (8)
     arc: "warmup" | "peak" | "journey" | "closer"                           difficulty: 1-5   seed   arcade: bool
   Result: { ok, score 0-100, order: [ids], arc, parts: {arc, tempo, genre, flow} }
   Scoring: energy vs the arc's target curve (50%), BPM jumps + direction (22%), genre clashes (18%), flow (10%).
   No musical keys anywhere: we have no verified key data. Controls: drag & drop (mouse), tap-to-swap (touch), keyboard (arrows + Enter). */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { clamp, mulberry, el } = U;
const K = () => RP.setkit;

const lerpPts = (pts, u) => { for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * ((u - a[0]) / (b[0] - a[0] || 1)); } return pts[pts.length - 1][1]; };
const ARCS = {
  warmup: { name: "WARM-UP", blurb: "Start soft, rise gently. Nothing too hard, nothing that belongs at 2 AM.", target: u => lerpPts([[0, 1.5], [1, 3.3]], u), dir: 1, bad: ["peak", "closer", "sunrise"], good: ["warmup", "builder"], first: "warmup" },
  peak: { name: "PEAK TIME", blurb: "Hit the floor hard and keep it there. Build in, then stay on top.", target: u => lerpPts([[0, 3.5], [0.3, 4.4], [0.7, 4.8], [1, 5]], u), dir: 1, bad: ["warmup", "sunrise"], good: ["peak", "builder"] },
  journey: { name: "THE JOURNEY", blurb: "A full night: warm in, build, peak around three quarters, then glide down.", target: u => lerpPts([[0, 1.8], [0.25, 3], [0.55, 4.2], [0.75, 5], [0.9, 3.9], [1, 2.9]], u), dir: 0, bad: [], good: ["warmup", "builder", "peak", "closer", "sunrise"], weirdMid: true },
  closer: { name: "THE CLOSER", blurb: "Bring them home: start high, come down gently, end on THE closing record.", target: u => lerpPts([[0, 4.5], [0.35, 4], [0.7, 2.9], [1, 2]], u), dir: -1, bad: ["warmup"], good: ["closer", "sunrise"], last: ["closer", "sunrise"] }
};
const tolScale = d => 1.25 - 0.125 * (d - 1);
const hasV = (r, v) => (r.vibe || []).indexOf(v) >= 0;

/* ======================================================================
   scoring (partial arrangements allowed: null = empty slot)
   ====================================================================== */
function scoreOrder(R, order) {
  const A = ARCS[R.arc], N = order.length, ts = tolScale(R.diff), K_ = K();
  const recs = order.map(id => (id ? RP.rec(id) : null));
  const issues = [];
  let eSum = 0, eN = 0, bonus = 0;
  recs.forEach((r, i) => {
    if (!r) return;
    const t = A.target(N > 1 ? i / (N - 1) : 0), d = (r.energy || 3) - t;
    eSum += Math.max(0, Math.abs(d) - 0.25); eN++;
    if (Math.abs(d) > 1.3) issues.push({ i, w: Math.abs(d), text: "Slot " + (i + 1) + ": " + r.title + " is " + (d > 0 ? "too hot" : "too soft") + " here (energy " + r.energy + ", the arc wants ~" + t.toFixed(1) + ")." });
    const u = N > 1 ? i / (N - 1) : 0;
    if (A.bad.some(v => hasV(r, v)) && !(R.arc === "closer" && i > 0 && false)) { bonus -= 0.05; issues.push({ i, w: 1.1, text: "Slot " + (i + 1) + ": " + r.title + " doesn't belong in a " + A.name.toLowerCase() + "." }); }
    if (A.good.some(v => hasV(r, v)) && R.arc !== "journey") bonus += 0.012;
    if (A.weirdMid && hasV(r, "weird") && u > 0.25 && u < 0.7) bonus += 0.04;
    if (hasV(r, "weird") && (i === 0 || i === N - 1) && R.arc !== "closer") { bonus -= 0.05; issues.push({ i, w: 1, text: "Slot " + (i + 1) + ": a weird record is risky as " + (i === 0 ? "an opener" : "the last record") + "." }); }
    if (R.arc === "journey" && hasV(r, "closer") && u < 0.5) { bonus -= 0.05; issues.push({ i, w: 1.1, text: "Slot " + (i + 1) + ": a closing record too early." }); }
  });
  if (A.first && recs[0]) bonus += hasV(recs[0], A.first) ? 0.08 : -0.03;
  if (A.last && recs[N - 1]) { const ok = A.last.some(v => hasV(recs[N - 1], v)); bonus += ok ? 0.14 : -0.12; if (!ok) issues.push({ i: N - 1, w: 1.8, text: "The last record should be a real closer (try one tagged CLOSER or SUNRISE)." }); }
  if (R.arc === "journey" && recs[N - 1] && (hasV(recs[N - 1], "closer") || hasV(recs[N - 1], "sunrise"))) bonus += 0.06;
  const arc = eN ? clamp(1 - (eSum / eN) / 1.5 + bonus, 0, 1) : 0;
  // tempo + genre + flow over junctions
  let tSum = 0, gSum = 0, fSum = 0, jN = 0;
  for (let i = 0; i + 1 < N; i++) {
    const a = recs[i], b = recs[i + 1]; if (!a || !b) continue;
    jN++;
    const d = b.bpm - a.bpm;
    let tq = K_.bpmJump(d / ts);
    if (A.dir > 0 && d < -3) tq *= 0.75; else if (A.dir < 0 && d > 3) tq *= 0.75;
    tSum += tq;
    const g = K_.compat(a.genre, b.genre); gSum += g;
    let f = 1; const jump = Math.abs((b.energy || 3) - (a.energy || 3));
    if (jump > 2) f -= 0.3; else if (jump > 1.5) f -= 0.1;
    if (a.artist === b.artist) f -= 0.4;
    if (a.title === b.title) f -= 0.4;
    fSum += clamp(f, 0, 1);
    if (Math.abs(d) > 8) issues.push({ i: i + 0.5, w: Math.abs(d) / 8, text: "Slots " + (i + 1) + "→" + (i + 2) + ": a " + (d > 0 ? "+" : "") + d + " BPM jump is hard to mix." });
    if (g < 0.4) issues.push({ i: i + 0.5, w: 1.5 - g, text: "Slots " + (i + 1) + "→" + (i + 2) + ": " + a.genre + " into " + b.genre + " is a genre clash." });
    if (a.artist === b.artist) issues.push({ i: i + 0.5, w: 1, text: "Slots " + (i + 1) + "→" + (i + 2) + ": same artist back to back." });
    if (jump > 2) issues.push({ i: i + 0.5, w: jump / 2, text: "Slots " + (i + 1) + "→" + (i + 2) + ": an energy jump of " + jump + " is too abrupt." });
  }
  // three vocal records in a row
  for (let i = 0; i + 2 < N; i++) if (recs[i] && recs[i + 1] && recs[i + 2] && hasV(recs[i], "vocal") && hasV(recs[i + 1], "vocal") && hasV(recs[i + 2], "vocal")) { fSum -= 0.3; issues.push({ i: i + 1, w: 0.8, text: "Slots " + (i + 1) + "–" + (i + 3) + ": three vocals in a row. Give the room a breather." }); }
  const tempo = jN ? tSum / jN : 0, genre = jN ? gSum / jN : 0, flow = jN ? clamp(fSum / jN, 0, 1) : 0;
  const total = Math.round(100 * (0.5 * arc + 0.22 * tempo + 0.18 * genre + 0.1 * flow));
  issues.sort((a, b) => b.w - a.w);
  const filled = recs.filter(Boolean).length;
  return { score: clamp(total, 0, 100), arc, tempo, genre, flow, issues, filled, bad: new Set(issues.map(x => x.i)) };
}

/* ======================================================================
   defaults + solver
   ====================================================================== */
const okAt = d => 60 + 3 * (d - 1);
function resolveP(p) {
  p = p || {};
  const rnd = mulberry(Math.floor(p.seed != null ? +p.seed : Math.random() * 1e9) + 9);
  const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
  const arc = ARCS[p.arc] ? p.arc : (p.arcade ? Object.keys(ARCS)[Math.floor(rnd() * 4)] : "journey");
  let ids = Array.isArray(p.records) ? p.records.filter((x, i, a) => x && a.indexOf(x) === i) : [];
  let slots = clamp(Math.round(p.slots || 8), 6, 10);
  if (ids.length && ids.length < slots) slots = Math.max(3, ids.length);
  const R = { arc, diff, rnd, slots, ids };
  if (!ids.length) R.ids = defaultPool(R);
  return R;
}
function defaultPool(R) {
  const A = ARCS[R.arc], N = R.slots, rnd = R.rnd, K_ = K();
  const all = K_.allRecords().filter(r => r.bpm && r.energy);
  const good = all.filter(r => r.bpm >= 100 && r.bpm <= 134 && !(A.bad.some(v => hasV(r, v))));
  // pick a clean base genre so that clashes are the player's choice
  const fams = ["house", "disco", "techno"], famPick = fams[Math.floor(rnd() * 3)];
  const pickBase = R.arc === "closer" || R.arc === "journey" || R.arc === "warmup" ? (rnd() < 0.5 ? "house" : "disco") : famPick;
  const base = good.filter(r => K_.compat(r.genre, pickBase === "techno" ? "techno" : pickBase) >= 0.75 || K_.family(r.genre) === "house");
  const chosen = []; let prev = null;
  for (let i = 0; i < N; i++) {
    const t = A.target(N > 1 ? i / (N - 1) : 0);
    let best = null, bs = -99;
    K_.shuffle(base, rnd).forEach(r => {
      if (chosen.indexOf(r) >= 0 || chosen.some(c => c.artist === r.artist)) return;
      let s = -Math.abs(r.energy - t) - (prev ? Math.max(0, Math.abs(r.bpm - prev.bpm) - 4) * 0.12 : 0) + rnd() * 0.3;
      if (A.last && i === N - 1) s += A.last.some(v => hasV(r, v)) ? 1.5 : -1;
      else if (R.arc === "closer" && (hasV(r, "closer") || hasV(r, "sunrise"))) s -= 0.6;
      if (A.first && i === 0 && hasV(r, A.first)) s += 0.5;
      if (s > bs) { bs = s; best = r; }
    });
    if (best) { chosen.push(best); prev = best; }
  }
  const rest = K_.shuffle(all.filter(r => chosen.indexOf(r) < 0 && !chosen.some(c => c.artist === r.artist)), rnd);
  const decoys = [];
  const mid = A.target(0.5);
  const d1 = rest.find(r => Math.abs(r.energy - mid) >= 2 && K_.compat(r.genre, pickBase) >= 0.4);
  const d2 = rest.find(r => K_.compat(r.genre, pickBase) < 0.3 && r !== d1);
  const d3 = rest.find(r => (r.bpm < 100 || r.bpm > 134) && r !== d1 && r !== d2);
  [d1, d2, d3].forEach(r => { if (r) decoys.push(r); });
  return K_.shuffle(chosen.concat(decoys), rnd).map(r => r.id);
}
function solve(R) {
  const N = R.slots, ids = R.ids, rnd = mulberry(5);
  let best = null, bs = -1;
  for (let tries = 0; tries < 6; tries++) {
    let order = K().shuffle(ids, rnd).slice(0, N);
    let cur = scoreOrder(R, order).score;
    for (let it = 0; it < 500; it++) {
      const o = order.slice(), i = Math.floor(rnd() * N);
      if (rnd() < 0.5) { const j = Math.floor(rnd() * N); [o[i], o[j]] = [o[j], o[i]]; }
      else { const un = ids.filter(x => o.indexOf(x) < 0); if (!un.length) continue; o[i] = un[Math.floor(rnd() * un.length)]; }
      const sc = scoreOrder(R, o).score;
      if (sc >= cur) { order = o; cur = sc; }
    }
    if (cur > bs) { bs = cur; best = order; }
  }
  return { order: best, score: bs };
}

/* ======================================================================
   UI
   ====================================================================== */
const CSS = `
.pl-board { width: 100%; max-width: 820px; margin-inline: auto; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pl-mid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
.pl-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
.pl-top .arc { font-family: var(--logo); font-size: clamp(13px, 3.2vw, 17px); color: var(--pink); }
.pl-top .bl { font-size: 19px; color: var(--muted); flex: 1; min-width: 200px; }
.pl-graph { display: block; width: 100%; height: auto; image-rendering: pixelated; image-rendering: crisp-edges; background: #05030a; border: 1px solid var(--line); }
.pl-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 16px; color: var(--muted); }
.pl-legend i { display: inline-block; width: 14px; height: 6px; margin-right: 5px; vertical-align: middle; }
.pl-slots { display: grid; gap: 3px; }
.pl-slot { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 2px; min-width: 0; min-height: 92px; padding: 4px; background: #0d0a1c; border: 1px dashed #3a3070; color: var(--fg); font-family: var(--ui); text-align: left; cursor: pointer; border-radius: 2px; touch-action: manipulation; }
.pl-slot .n { font-family: var(--logo); font-size: 10px; color: var(--muted); }
.pl-slot canvas { width: 100%; max-width: 40px; aspect-ratio: 1; height: auto; image-rendering: pixelated; border: 1px solid #000; align-self: center; background: #000; }
.pl-slot .t { font-size: 14px; line-height: 1; color: #fff; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.pl-slot .m { font-size: 13px; line-height: 1; color: var(--muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.pl-slot.full { border-style: solid; border-color: #2d2456; background: #120e24; }
.pl-slot.bad { border-color: #ff5a5a; }
.pl-slot.sel, .pl-card.sel { border-color: var(--cyan) !important; box-shadow: 0 0 0 1px var(--cyan) inset; }
.pl-slot.over, .pl-pool.over { border-color: var(--lime) !important; background: #13221c; }
.pl-slot:hover { border-color: var(--pink); }
.pl-slot:focus-visible, .sk-card:focus-visible { outline: 2px solid var(--cyan); outline-offset: 1px; }
.pl-slot.drag, .sk-card.drag { opacity: .35; }
.pl-info { font-size: 19px; line-height: 1.1; min-height: 3.4em; display: flex; flex-direction: column; gap: 3px; }
.pl-info .fact { color: var(--cyan); font-size: 16px; } .pl-info .why { color: #ff8a8a; font-size: 17px; } .pl-info .why.good { color: var(--ok); }
.pl-pool { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 5px; padding: 6px; border: 1px dashed transparent; border-radius: 3px; }
.pl-grade { display: flex; flex-direction: column; gap: 4px; justify-content: center; min-width: 150px; }
.pl-grade .big { font-size: 34px; line-height: 1; }
.pl-grade .mini { display: grid; grid-template-columns: 54px 76px; gap: 6px; align-items: center; font-size: 15px; color: var(--muted); }
.pl-ghost { position: fixed; z-index: 60; pointer-events: none; width: 230px; opacity: .92; }
.pl-act { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pl-act .spacer { flex: 1; }
@media (max-width: 700px) {
  .pl-slot { min-height: 70px; padding: 3px; } .pl-slot .t { display: none; } .pl-slot .m .pips { display: none; }
  .pl-pool { grid-template-columns: minmax(0, 1fr); }
  .pl-mid { grid-template-columns: minmax(0, 1fr); } .pl-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; } .pl-grade .big { grid-column: 1 / -1; } .pl-grade .mini { grid-template-columns: 52px minmax(0, 1fr); }
}

@media (max-height: 460px) {
  .overlay.mg-playlistOrder { padding: 4px 8px; }
  .mg-playlistOrder .mg-wrap { gap: 4px; }
  .mg-playlistOrder .mg-head { flex-wrap: nowrap; align-items: baseline; }
  .mg-playlistOrder .mg-logo { font-size: 13px; } .mg-playlistOrder .mg-sub { font-size: 15px; }
  .pl-board { max-width: none; display: grid; grid-template-columns: minmax(0, 1fr) minmax(230px, 36%); grid-template-rows: auto auto auto auto auto 1fr; grid-template-areas: "top pool" "graph pool" "slots pool" "mid pool" "acts pool" "msg pool"; gap: 4px 8px; align-content: start; }
  .pl-top { grid-area: top; gap: 0 10px; flex-wrap: nowrap; } .pl-top .arc { font-size: 12px; white-space: nowrap; } .pl-top .bl { font-size: 14px; line-height: 1; min-width: 0; max-height: 2em; overflow: hidden; }
  .pl-graph { grid-area: graph; } .pl-legend { display: none; }
  .pl-slots { grid-area: slots; } .pl-slot { min-height: 52px; padding: 2px; } .pl-slot .t, .pl-slot .m .pips { display: none; } .pl-slot canvas { max-width: 28px; } .pl-slot .n { font-size: 9px; }
  .pl-mid { grid-area: mid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; } .pl-info { min-height: 0; max-height: 38px; overflow: hidden; font-size: 14px; padding: 3px 6px; } .pl-info .mg-sub, .pl-info .fact { display: none; }
  .pl-grade { flex-direction: row; align-items: center; gap: 8px; padding: 2px 8px; min-width: 0; display: flex; } .pl-grade .big { font-size: 22px; white-space: nowrap; } .pl-grade .big small { font-size: 11px !important; } .pl-grade .mini { grid-template-columns: auto 44px; font-size: 12px; gap: 3px; } .pl-grade .sk-meter { height: 8px; }
  .pl-act { grid-area: acts; } .pl-act .btn { padding: 3px 10px; font-size: 18px; }
  .pl-msg { grid-area: msg; font-size: 15px; line-height: 1.05; min-height: 0; max-height: 3.2em; overflow: hidden; }
  .pl-pool { grid-area: pool; grid-template-columns: minmax(0, 1fr); max-height: calc(100vh - 44px); overflow-y: auto; padding: 0 2px 0 0; gap: 3px; border: 0; }
}
`;
let cssDone = false;

RP.mg.register("playlistOrder", {
  title: "playlist.Order", order: 5,
  desc: "Drag, tap or key records into slots to match an energy arc.",
  model: { ARCS, scoreOrder, resolveP, solve },
  auto(params) {
    try {
      const R = resolveP(Object.assign({ seed: 3 }, params));
      const s = solve(R);
      return { ok: true, score: Math.max(80, s.score), order: s.order.slice(), arc: R.arc, auto: true };
    } catch (e) { return { ok: true, score: 82, order: [], auto: true }; }
  },
  async play(host, params) {
    const kit = K();
    if (!cssDone) { cssDone = true; el("style", { text: CSS }, document.head); }
    kit.css();
    const root = host.root;
    let R = resolveP(params);
    const N = R.slots;
    host.header("playlist.Order", ARCS[R.arc].name + (params && params.arcade ? " · Arcade" : ""));
    const stage = el("div", { cls: "sk-stage" }, root);
    const endBox = el("div", {}, root);
    const sound = kit.sound(host);

    return new Promise(resolve => {
      let finished = false;
      const done = res => { if (finished) return; finished = true; sound.stop(0.3); resolve(res); };
      let slots = Array(N).fill(null), sel = null, focusKey = null, previewTO = null, justDragged = false;
      const A = () => ARCS[R.arc];

      /* ---------- DOM skeleton ---------- */
      const board = el("div", { cls: "pl-board" }, stage);
      const top = el("div", { cls: "pl-top" }, board);
      el("span", { cls: "arc", text: A().name }, top);
      el("span", { cls: "bl", text: A().blurb + " Judge on BPM, energy, genre and vibe." }, top);
      const GW = 320, GH = 76;
      const gcv = el("canvas", { cls: "pl-graph px", width: GW, height: GH, role: "img", "aria-label": "Energy curve of your set against the target arc" }, board);
      const gc = gcv.getContext("2d");
      const legend = el("div", { cls: "pl-legend" }, board);
      legend.innerHTML = "<span><i style='background:#ff3fa4'></i>YOUR ENERGY</span><span><i style='background:#62e6ff'></i>TARGET ARC</span><span><i style='background:#9be15d'></i>BPM</span><span><i style='background:#ff5a5a'></i>PROBLEM</span>";
      const slotsEl = el("div", { cls: "pl-slots", role: "listbox", "aria-label": "Set slots" }, board);
      slotsEl.style.gridTemplateColumns = "repeat(" + N + ", minmax(0, 1fr))";
      const mid = el("div", { cls: "pl-mid" }, board);
      const info = el("div", { cls: "mg-panel pl-info", "aria-live": "polite" }, mid);
      const grade = el("div", { cls: "mg-panel pl-grade" }, mid);
      const poolEl = el("div", { cls: "pl-pool", role: "listbox", "aria-label": "Records not yet placed" }, board);
      const msg = el("div", { cls: "mg-msg pl-msg", "aria-live": "polite" }, board);
      const acts = el("div", { cls: "pl-act" }, board);
      const lockBtn = el("button", { cls: "btn primary", type: "button", text: "LOCK IT IN ▶", disabled: "disabled" }, acts);
      const clearBtn = el("button", { cls: "btn", type: "button", text: "CLEAR" }, acts);
      el("div", { cls: "spacer" }, acts);
      const giveUp = el("button", { cls: "btn", type: "button", text: "GIVE UP" }, acts);
      msg.textContent = "Fill all " + N + " slots. Drag a record (mouse), tap a record then a slot (touch), or use the arrow keys + Enter.";

      /* ---------- helpers ---------- */
      const recOf = id => RP.rec(id);
      const poolIds = () => R.ids.filter(id => slots.indexOf(id) < 0);
      const keyOf = s => (s.kind === "slot" ? "s" + s.i : "p" + s.id);
      const same = (a, b) => a && b && keyOf(a) === keyOf(b);

      function move(a, b) { // a, b: {kind:'slot', i} | {kind:'pool', id?}
        if (a.kind === "pool" && b.kind === "slot") { slots[b.i] = a.id; host.sfx("pickup"); }
        else if (a.kind === "slot" && b.kind === "slot") { const t = slots[a.i]; slots[a.i] = slots[b.i]; slots[b.i] = t; host.sfx("pickup"); }
        else if (a.kind === "slot" && b.kind === "pool") { slots[a.i] = null; host.sfx("drop"); }
        else return false;
        return true;
      }
      function activate(item) {
        if (item.kind === "slot" && slots[item.i] == null && !sel) { sel = item; render(); return; }
        if (!sel) { sel = item; preview(item); render(); return; }
        if (same(sel, item)) { sel = null; render(); return; }
        if (sel.kind === "pool" && item.kind === "pool") { sel = item; preview(item); render(); return; }
        let a = sel, b = item;
        if (a.kind === "pool" && b.kind === "pool") { sel = item; render(); return; }
        if (a.kind === "slot" && b.kind === "pool" && !b.id) { /* pool container */ }
        if (a.kind === "pool" && b.kind === "slot") { /* ok */ }
        else if (a.kind === "slot" && b.kind === "pool") { // selected slot + pool card: put the pool card into that slot
          const t = a; a = b; b = t;
        }
        if (a.kind === "slot" && b.kind === "slot" && slots[a.i] == null && slots[b.i] == null) { sel = b; render(); return; }
        move(a, b); sel = null; focusKey = keyOf(item); render();
      }
      function preview(item) {
        const id = item.kind === "slot" ? slots[item.i] : item.id; if (!id) return;
        const rec = recOf(id);
        sound.play(rec, { vol: 0.45, fade: 0.4 });
        clearTimeout(previewTO); previewTO = setTimeout(() => sound.stop(0.8), 7000);
      }

      /* ---------- drag & drop (mouse / pen) ---------- */
      let ghost = null;
      function wireDrag(node, item) {
        node.addEventListener("pointerdown", e => {
          if (e.pointerType === "touch" || e.button !== 0) return;
          if (item.kind === "slot" && slots[item.i] == null) return;
          const sx = e.clientX, sy = e.clientY; let dragging = false, over = null;
          const hl = t => { if (over) over.classList.remove("over"); over = t; if (over) over.classList.add("over"); };
          const tgt = ev => { const n = document.elementFromPoint(ev.clientX, ev.clientY); return n && n.closest ? n.closest("[data-slot],[data-pool]") : null; };
          const mv = ev => {
            if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
              dragging = true; node.classList.add("drag");
              const id = item.kind === "slot" ? slots[item.i] : item.id;
              ghost = kit.card(host, recOf(id), { compact: true }); ghost.className += " pl-ghost"; ghost.disabled = true; host.root.appendChild(ghost);
              sel = null;
            }
            if (dragging) { ghost.style.left = (ev.clientX - 30) + "px"; ghost.style.top = (ev.clientY - 20) + "px"; hl(tgt(ev)); }
          };
          const up = ev => {
            window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
            if (!dragging) return;
            justDragged = true; setTimeout(() => { justDragged = false; }, 0);
            const t = tgt(ev); hl(null); if (ghost) { ghost.remove(); ghost = null; }
            node.classList.remove("drag");
            if (t) {
              const dest = t.dataset.slot != null ? { kind: "slot", i: +t.dataset.slot } : { kind: "pool", id: t.dataset.pool || null };
              if (move(item, dest)) { focusKey = keyOf(dest.kind === "slot" ? dest : item); }
            }
            render();
          };
          window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
        });
      }

      /* ---------- rendering ---------- */
      function render() {
        const ae = document.activeElement, prevKey = ae && ae.dataset && ae.dataset.key && root.contains(ae) ? ae.dataset.key : null;
        if (!focusKey && prevKey) focusKey = prevKey;
        // slots
        slotsEl.innerHTML = "";
        const sc = scoreOrder(R, slots);
        const badSlot = i => sc.issues.some(x => (x.i === i || x.i === i - 0.5 || x.i === i + 0.5) && x.w >= 1.0);
        slots.forEach((id, i) => {
          const b = el("button", { cls: "pl-slot" + (id ? " full" : "") + (sel && sel.kind === "slot" && sel.i === i ? " sel" : "") + (id && badSlot(i) ? " bad" : ""), type: "button" }, slotsEl);
          b.dataset.slot = i; b.dataset.key = "s" + i; b.setAttribute("role", "option");
          el("span", { cls: "n", text: String(i + 1) }, b);
          if (id) {
            const rec = recOf(id);
            b.appendChild(kit.sleeveCanvas(host, rec, 18));
            el("span", { cls: "t", text: kit.pair(rec) }, b);
            const m = el("span", { cls: "m" }, b); el("span", { text: rec.bpm + (window.innerWidth > 700 ? " BPM" : "") }, m); const pw = kit.pips(rec.energy || 3); pw.classList.add("pips"); m.appendChild(pw);
            b.title = kit.full(rec) + " — slot " + (i + 1); b.setAttribute("aria-label", "Slot " + (i + 1) + ": " + kit.full(rec) + ", " + rec.bpm + " BPM, energy " + rec.energy);
            wireDrag(b, { kind: "slot", i });
          } else { el("span", { cls: "t", text: "empty" }, b); b.setAttribute("aria-label", "Slot " + (i + 1) + ": empty"); }
          b.addEventListener("click", () => { if (justDragged) return; activate({ kind: "slot", i }); });
          b.addEventListener("dblclick", () => { if (slots[i]) { slots[i] = null; sel = null; host.sfx("drop"); render(); } });
          b.addEventListener("focus", () => showInfo({ kind: "slot", i }));
          b.addEventListener("mouseenter", () => showInfo({ kind: "slot", i }));
        });
        // pool
        poolEl.innerHTML = ""; poolEl.dataset.pool = "";
        poolIds().forEach((id, k) => {
          const rec = recOf(id);
          const b = kit.card(host, rec, { compact: true });
          b.dataset.pool = id; b.dataset.key = "p" + id; b.setAttribute("role", "option");
          if (sel && sel.kind === "pool" && sel.id === id) b.classList.add("sel");
          wireDrag(b, { kind: "pool", id });
          b.addEventListener("click", () => { if (justDragged) return; activate({ kind: "pool", id }); });
          b.addEventListener("focus", () => showInfo({ kind: "pool", id }));
          b.addEventListener("mouseenter", () => showInfo({ kind: "pool", id }));
          poolEl.appendChild(b);
        });
        if (!poolIds().length) el("div", { cls: "mg-sub", text: "Every record is placed. Swap them around to tune the set." }, poolEl);
        poolEl.dataset.pool = "";
        // restore focus
        if (focusKey) { const n = root.querySelector('[data-key="' + focusKey + '"]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } focusKey = null; }
        drawGraph(sc);
        // grade strip
        grade.innerHTML = "";
        const full = slots.every(Boolean);
        el("div", { cls: "big " + (sc.filled === 0 ? "" : sc.score >= okAt(R.diff) ? "ok" : sc.score >= 45 ? "" : "bad"), html: sc.filled ? sc.score + "<small style='font-size:18px;color:var(--muted)'>/100" + (full ? "" : " so far") + "</small>" : "—" }, grade);
        [["ENERGY", sc.arc, "#ff3fa4"], ["TEMPO", sc.tempo, "#9be15d"], ["GENRE", sc.genre, "#62e6ff"], ["FLOW", sc.flow, "#ffc44d"]].forEach(([l, v, c]) => {
          const m = el("div", { cls: "mini" }, grade); el("span", { text: l }, m);
          const mt = el("div", { cls: "sk-meter" }, m); mt.style.setProperty("--c", c); for (let i = 0; i < 8; i++) el("i", { cls: i < Math.round(v * 8) && sc.filled ? "on" : "" }, mt);
        });
        lockBtn.disabled = !full; lockBtn.textContent = full ? "LOCK IT IN ▶" : "FILL " + slots.filter(x => !x).length + " MORE";
        if (!info.dataset.keep) showInfo(sel || null, sc);
      }

      function showInfo(item, sc) {
        sc = sc || scoreOrder(R, slots);
        info.innerHTML = "";
        let id = null;
        if (item) id = item.kind === "slot" ? slots[item.i] : item.id;
        if (id) {
          const r = recOf(id);
          el("div", { html: "<b style='color:#fff;font-weight:400'>" + U.esc(kit.full(r)) + "</b>" }, info);
          el("div", { cls: "mg-sub", text: r.bpm + " BPM · energy " + r.energy + "/5 · " + r.genre + (r.vibe && r.vibe.length ? " · " + r.vibe.join(", ") : "") }, info);
          if (r.fact) el("div", { cls: "fact", text: r.fact }, info);
        } else if (sc.issues.length) {
          sc.issues.slice(0, 3).forEach(x => el("div", { cls: "why", text: "! " + x.text }, info));
        } else if (sc.filled === N) el("div", { cls: "why good", text: "No problems found. Lock it in when you like the curve." }, info);
        else el("div", { cls: "mg-sub", text: "Hover or focus a record to see its details. Problems with your arrangement show up here." }, info);
        // always append the top issue under a record preview
        if (id && item.kind === "slot") { const mine = sc.issues.find(x => Math.abs(x.i - item.i) <= 0.5); if (mine) el("div", { cls: "why", text: "! " + mine.text }, info); }
      }

      function drawGraph(sc) {
        const w = GW, h = GH, g = gc, T = A().target, ex = i => Math.round((i + 0.5) * w / N);
        const ey = e => Math.round(h - 8 - clamp((e - 0.5) / 5, 0, 1) * (h - 18));
        kit_bg(g, w, h);
        // target band
        for (let x = 0; x < w; x++) {
          const u = clamp((x - w / (2 * N)) / (w - w / N), 0, 1), t = T(u);
          const y0 = ey(t + 0.55), y1 = ey(t - 0.55);
          g.fillStyle = kit.dpat("#62e6ff", 4); g.fillRect(x, y0, 1, y1 - y0 + 1);
          if ((x >> 1) % 2 === 0) { g.fillStyle = "#62e6ff"; g.fillRect(x, ey(t), 1, 1); }
        }
        // bpm line
        const bps = R.ids.map(id => recOf(id).bpm), lo = Math.min.apply(null, bps) - 2, hi = Math.max.apply(null, bps) + 2;
        const by = b => Math.round(h - 8 - clamp((b - lo) / (hi - lo), 0, 1) * (h - 18));
        let pv = null;
        slots.forEach((id, i) => { if (!id) { pv = null; return; } const r = recOf(id), p = [ex(i), by(r.bpm)]; if (pv) U.line(g, pv[0], pv[1], p[0], p[1], "#9be15d"); pv = p; });
        // energy polyline
        pv = null;
        slots.forEach((id, i) => {
          if (!id) { pv = null; return; }
          const r = recOf(id), p = [ex(i), ey(r.energy || 3)];
          if (pv) { U.line(g, pv[0], pv[1], p[0], p[1], "#ff3fa4"); U.line(g, pv[0], pv[1] + 1, p[0], p[1] + 1, "#ff3fa4"); }
          pv = p;
        });
        slots.forEach((id, i) => {
          if (!id) { g.fillStyle = kit.dpat("#8c84b8", 5); g.fillRect(ex(i) - 1, h - 10, 3, 3); return; }
          const r = recOf(id), x = ex(i), y = ey(r.energy || 3), err = Math.abs((r.energy || 3) - T(N > 1 ? i / (N - 1) : 0));
          const col = err <= 0.6 ? "#9be15d" : err <= 1.2 ? "#ffd23f" : "#ff5a5a";
          U.R(g, x - 2, y - 2, 5, 5, "#0a0410"); U.R(g, x - 1, y - 1, 3, 3, col);
        });
        // junction problems
        sc.issues.forEach(x => { if (x.i % 1 === 0.5) { const cx = Math.round((x.i + 1) * w / N); K().otxtC(g, "X", cx, 3, "#ff5a5a", 1); } });
        // axis labels
        [1, 3, 5].forEach(v => U.txt(g, String(v), 2, ey(v) - 2, "#5a5290"));
      }
      function kit_bg(g, w, h) {
        g.fillStyle = "#08061a"; g.fillRect(0, 0, w, h);
        for (let v = 1; v <= 5; v++) { const y = Math.round(h - 8 - ((v - 0.5) / 5) * (h - 18)); g.fillStyle = kit.dpat("#8c84b8", v === 3 ? 4 : 2); g.fillRect(0, y, w, 1); }
        for (let i = 0; i < N; i++) { g.fillStyle = kit.dpat("#8c84b8", 2); g.fillRect(Math.round(i * w / N), 0, 1, h); }
        g.fillStyle = "#241d48"; g.fillRect(0, h - 1, w, 1);
      }

      /* ---------- keyboard ---------- */
      host.onKey(e => {
        if (finished || e.ctrlKey || e.metaKey || e.altKey) return;
        const a = document.activeElement; if (!a || !a.dataset || (!a.dataset.slot && !a.dataset.pool)) return;
        const isSlot = a.dataset.slot != null;
        const list = isSlot ? [...slotsEl.children] : [...poolEl.querySelectorAll("[data-pool]")];
        const idx = list.indexOf(a);
        const go = n => { if (n) { e.preventDefault(); n.focus({ preventScroll: false }); } };
        if (e.key === "ArrowRight") go(list[idx + 1] || (isSlot ? null : null));
        else if (e.key === "ArrowLeft") go(list[idx - 1]);
        else if (e.key === "ArrowDown") { if (isSlot) go(poolEl.querySelectorAll("[data-pool]")[Math.min(idx, poolEl.querySelectorAll("[data-pool]").length - 1)]); else { const cols = Math.max(1, Math.floor(poolEl.clientWidth / 220)); go(list[idx + cols]); } }
        else if (e.key === "ArrowUp") { if (isSlot) return; const cols = Math.max(1, Math.floor(poolEl.clientWidth / 220)); if (idx - cols >= 0) go(list[idx - cols]); else go(slotsEl.children[Math.min(idx, N - 1)]); }
        else if ((e.key === "Delete" || e.key === "Backspace") && isSlot) { const i = +a.dataset.slot; if (slots[i]) { e.preventDefault(); slots[i] = null; sel = null; host.sfx("drop"); focusKey = "s" + i; render(); } }
        else if (e.key === "Escape" && sel) { e.preventDefault(); sel = null; render(); }
      });

      /* ---------- actions ---------- */
      async function lock() {
        if (!slots.every(Boolean)) return;
        const sc = scoreOrder(R, slots), ok = sc.score >= okAt(R.diff);
        const res = { ok, score: sc.score, order: slots.slice(), arc: R.arc, parts: { arc: Math.round(sc.arc * 100), tempo: Math.round(sc.tempo * 100), genre: Math.round(sc.genre * 100), flow: Math.round(sc.flow * 100) } };
        sound.stop(0.3); host.sfx(ok ? "success" : "fail");
        stage.hidden = true;
        const lines = [ok ? "The arc holds. The floor will follow." : "The curve doesn't match the arc yet."];
        const dim = sc.issues.slice(0, 3).map(x => x.text);
        dim.push("Set: " + slots.map(id => recOf(id).title).join("  ›  "));
        const choice = await kit.endCard(host, endBox, { ok, score: sc.score, kicker: A().name, title: ok ? "THE SET FLOWS" : "BACK TO THE CRATE", parts: [{ label: "ENERGY ARC", v: sc.arc, color: "#ff3fa4" }, { label: "TEMPO", v: sc.tempo, color: "#9be15d" }, { label: "GENRE FIT", v: sc.genre, color: "#62e6ff" }, { label: "FLOW", v: sc.flow, color: "#ffc44d" }], lines, dim, canAgain: !ok, againLabel: "KEEP TUNING" });
        if (finished) return;
        if (choice === "again") { endBox.innerHTML = ""; stage.hidden = false; render(); return; }
        done(res);
      }
      lockBtn.addEventListener("click", lock);
      clearBtn.addEventListener("click", () => { slots = Array(N).fill(null); sel = null; host.sfx("drop"); render(); });
      giveUp.addEventListener("click", () => { host.sfx("click"); done({ ok: false, score: 0, order: slots.filter(Boolean), arc: R.arc }); });
      host.cleanup(() => { finished = true; clearTimeout(previewTO); if (ghost) { try { ghost.remove(); } catch (e) { /* ignore */ } } });
      render();
    });
  }
});
})();
