/* last.Train — after the gig, the last trains are running thin, the phone is dying and the gear is heavy.
   Read the map, pick the route, choose stairs or elevator, and get home before the night runs out.
   Params (all optional):
     { from, to: labels (a station name, or a venue label that gets pinned to a station), mode: "subway" | "airport",
       battery: phone % (default by difficulty), money: dollars (default by difficulty),
       carrying: "records" | "turntables" | "suitcase", difficulty: 1..5,
       start: minutes after midnight (default ~1:35 AM), deadline: minutes after midnight, cab: cab price }
   Result: { ok, score (0..100), minutesLate } — ok means you got to the destination (a cab or a long walk counts).
   The stations and lines are fictional; real-sounding names are just names. */
(function () {
"use strict";
const RP = window.RP;
const { R, P, ell, line, poly, txt, txtC, bayer, ramp, mulberry, clamp, el } = RP.u;

const CSS = `
.lt-main { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "hud" "map" "info" "panel" "acts"; gap: 8px 10px; align-items: start; }
.lt-main.wide { grid-template-columns: 640px minmax(0, 1fr); grid-template-areas: "hud panel" "map panel" "info panel" "acts panel"; grid-template-rows: auto auto auto 1fr; }
.lt-main > * { min-width: 0; }
.lt-hud { grid-area: hud; display: flex; flex-wrap: wrap; gap: 6px; } .lt-mapbox { grid-area: map; } .lt-info { grid-area: info; } .lt-panel { grid-area: panel; } .lt-acts { grid-area: acts; }
.lt-chip { background: #120e24; border: 1px solid var(--line); border-radius: 3px; padding: 2px 8px; font-size: 19px; color: var(--fg); display: flex; align-items: center; gap: 6px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.lt-chip small { font-size: 15px; color: var(--muted); letter-spacing: .06em; }
.lt-chip.low { border-color: #ff6a6a; color: #ff8a8a; } .lt-chip.due { border-color: var(--amber); color: var(--amber); }
.lt-bar { width: 38px; height: 10px; border: 1px solid currentColor; box-sizing: border-box; position: relative; } .lt-bar i { display: block; height: 100%; background: currentColor; }
.lt-mapbox { position: relative; width: fit-content; max-width: 100%; margin-inline: auto; background: #000; border: 1px solid var(--line); line-height: 0; }
.lt-main.wide .lt-mapbox { margin-inline: 0; }
.lt-map { display: block; }
.lt-labels { position: absolute; inset: 0; pointer-events: none; }
.lt-st { position: absolute; width: 28px; height: 28px; margin: -14px 0 0 -14px; padding: 0; background: none; border: 0; cursor: pointer; pointer-events: auto; border-radius: 50%; }
.lt-st:focus-visible { outline: 2px solid var(--cyan); outline-offset: -4px; }
.lt-lab { position: absolute; font-family: var(--ui); font-size: var(--lfs, 13px); line-height: 1; color: #d8d0f8; text-shadow: 0 1px 0 #05030c, 1px 0 0 #05030c, -1px 0 0 #05030c, 0 -1px 0 #05030c; white-space: nowrap; pointer-events: none; }
.lt-lab.sel { color: #fff; } .lt-lab.dest { color: var(--lime); } .lt-lab.here { color: var(--pink); }
.lt-badge { position: absolute; right: 6px; top: 6px; font-size: 17px; padding: 1px 8px; border-radius: 2px; background: rgba(5, 3, 12, .85); border: 1px solid var(--line); color: var(--muted); line-height: 1.1; }
.lt-badge.live { border-color: var(--pink); color: var(--pink); }
.lt-info { font-size: 19px; line-height: 1.08; color: #e4ddff; min-height: 2.3em; }
.lt-info b { font-weight: 400; color: var(--cyan); }
.lt-panel { display: flex; flex-direction: column; gap: 8px; }
.lt-card { background: #0f0b20; border: 1px solid #241d48; border-radius: 3px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.lt-card h3 { margin: 0; font-weight: 400; font-size: 20px; letter-spacing: .06em; color: var(--pink); display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.lt-card h3 small { font-size: 16px; color: var(--muted); letter-spacing: 0; }
.lt-card p { margin: 0; font-size: 18px; line-height: 1.08; color: var(--muted); }
.lt-ann { border-color: var(--amber); background: #1d1608; color: #ffe2a0; font-size: 20px; line-height: 1.08; padding: 7px 10px; border: 1px solid var(--amber); border-radius: 3px; }
.lt-ann b { font-weight: 400; letter-spacing: .1em; font-size: 16px; display: block; color: var(--amber); }
.lt-opt { display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; font-family: var(--ui); font-size: 20px; line-height: 1.05; background: #1a1534; color: var(--fg); border: 1px solid #3a3070; border-radius: 3px; padding: 6px 9px; cursor: pointer; width: 100%; }
.lt-opt:hover:not(:disabled) { border-color: var(--cyan); color: var(--cyan); } .lt-opt:disabled { opacity: .45; cursor: default; }
.lt-opt .c { font-size: 15px; color: var(--muted); text-align: right; white-space: nowrap; } .lt-opt .why { display: block; font-size: 15px; color: var(--amber); }
.lt-opt.go { border-color: #2a6a46; } .lt-opt.go:hover:not(:disabled) { border-color: var(--ok); color: var(--ok); }
.lt-opt.cab { border-style: dashed; }
.lt-line { display: inline-block; min-width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; border-radius: 2px; border: 1px solid #05030c; }
.lt-row2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; }
.lt-opt.mv { flex-direction: column; align-items: flex-start; gap: 1px; } .lt-opt.mv .c { text-align: left; white-space: normal; }
.lt-lines { display: flex; gap: 6px; flex-wrap: wrap; font-size: 16px; color: var(--muted); }
.lt-lines span { display: inline-flex; align-items: center; }
.lt-log { font-size: 16px; color: var(--muted); line-height: 1.1; max-height: 4.6em; overflow: hidden; }
.lt-log div:first-child { color: var(--fg); }
.lt-alerts { display: flex; flex-direction: column; gap: 4px; font-size: 17px; line-height: 1.07; color: #ffc9e6; }
.lt-alerts div { border-left: 3px solid var(--pink); padding-left: 6px; }
.lt-gear { display: flex; align-items: center; gap: 6px; font-size: 18px; color: var(--fg); }
.lt-main.compact { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "hud panel" "map panel" "info panel" "acts panel"; grid-template-rows: auto auto auto 1fr; gap: 4px 8px; }
.lt-main.compact .lt-mapbox { margin: 0; } .lt-main.compact .lt-hud { gap: 3px; flex-wrap: wrap; } .lt-main.compact .lt-chip { padding: 1px 5px; font-size: 16px; gap: 3px; white-space: nowrap; } .lt-main.compact .lt-chip small { font-size: 12px; } .lt-main.compact .lt-chip.due small:last-child { display: none; } .lt-main.compact .lt-bar { width: 24px; height: 8px; }
.lt-main.compact .lt-info { font-size: 16px; min-height: 0; line-height: 1.02; } .lt-main.compact .lt-panel { overflow-y: auto; gap: 4px; padding-right: 2px; } .lt-main.compact .lt-card { padding: 5px 7px; gap: 4px; } .lt-main.compact .lt-card h3 { font-size: 17px; } .lt-main.compact .lt-card p { display: none; } .lt-main.compact .lt-phonecard p { display: block; font-size: 15px; } .lt-main.compact .lt-opt .c { font-size: 13px; } .lt-main.compact .lt-opt { padding: 3px 7px; font-size: 18px; } .lt-main.compact .lt-opt.mv { padding: 2px 6px; } .lt-main.compact .lt-row2 { grid-template-columns: 1fr 1fr; gap: 4px; } .lt-main.compact .lt-ann { font-size: 17px; padding: 4px 8px; } .lt-main.compact .lt-log { display: none; } .lt-main.compact .lt-phonecard { flex-direction: row; flex-wrap: wrap; align-items: center; } .lt-main.compact .lt-phonecard .lt-opt { width: auto; flex: 1 1 130px; } .lt-main.compact .lt-phonecard p, .lt-main.compact .lt-phonecard .lt-alerts { flex: 1 1 100%; } .lt-main.compact .lt-phonecard h3 { flex: 1 1 100%; } .lt-main.compact .lt-lab { }
@media (max-width: 860px) { .lt-info { font-size: 18px; } .lt-opt { font-size: 19px; } }
@media (prefers-reduced-motion: reduce) { .lt-map { } }
`;

/* ------------------------------------------------------------------ maps (fictional network) */
const S = (id, n, s, x, y, fl, xf, el, lab) => ({ id, n, s, x, y, fl, xf, el, lab: lab || "r" });
const MAPS = {
  subway: {
    key: "subway", name: "Night service map", river: true, fare: 3, cab: 38, startMin: 94, maxPairs: [["jkh", "atl"], ["fls", "hew"], ["eny", "gre"], ["gre", "flt"], ["nvy", "jam"], ["jam", "atl"], ["fls", "flt"], ["crt", "eny"]],
    stations: [
      S("gre", "Greenpoint Ave", "Greenpoint", 30, 45, 2, 0, true, "b"), S("crt", "Court Sq", "Court Sq", 100, 45, 3, 3, true, "t"), S("qbp", "Queensboro Plz", "Queensboro", 180, 45, 3, 3, false, "t"),
      S("jkh", "Jackson Hts", "Jackson Hts", 245, 45, 2, 0, true, "t"), S("fls", "Flushing–Main St", "Flushing", 295, 45, 3, 0, true, "bl"),
      S("nvy", "Navy Yard", "Navy Yard", 20, 100, 1, 0, false, "b"), S("lor", "Lorimer St", "Lorimer", 58, 100, 2, 0, false, "b"), S("met", "Metropolitan Av", "Metropolitan", 100, 100, 3, 2, true, "tl"),
      S("hal", "Halsey St", "Halsey", 140, 100, 2, 0, false, "b"), S("myr", "Myrtle–Wyckoff", "Myrtle–Wyck.", 180, 100, 3, 2, true, "br"), S("brj", "Broadway Jct", "Broadway Jct", 250, 100, 3, 3, false, "t"),
      S("jam", "Jamaica Av", "Jamaica Av", 295, 100, 2, 0, true, "b"),
      S("hew", "Hewes St", "Hewes St", 100, 150, 3, 2, false, "l"), S("atl", "Atlantic Av", "Atlantic Av", 100, 185, 3, 0, true, "r"),
      S("jay", "Jay St", "Jay St", 180, 150, 2, 2, true, "tr"), S("flt", "Flatbush Jct", "Flatbush", 180, 185, 2, 0, false, "r"), S("eny", "East New York", "E New York", 250, 150, 3, 0, true, "r")
    ],
    lines: [
      { id: "teal", n: "TEAL", col: "#2fd0c0", st: ["gre", "crt", "qbp", "jkh", "fls"], rt: [3, 4, 3, 3], head: 12, last: 185 },
      { id: "amber", n: "AMBER", col: "#ffb030", st: ["nvy", "lor", "met", "hal", "myr", "brj", "jam"], rt: [2, 2, 2, 2, 3, 2], head: 10, last: 180 },
      { id: "violet", n: "VIOLET", col: "#a070ff", st: ["crt", "met", "hew", "atl"], rt: [4, 4, 3], head: 15, last: 190 },
      { id: "coral", n: "CORAL", col: "#ff6a7a", st: ["qbp", "myr", "jay", "flt"], rt: [4, 4, 3], head: 13, last: 180 },
      { id: "lime", n: "LIME", col: "#9be15d", st: ["hew", "jay", "eny", "brj"], rt: [4, 4, 3], head: 18, last: 175 }
    ]
  },
  airport: {
    key: "airport", name: "Airport + rail map", river: false, fare: 4, cab: 55, startMin: 100, maxPairs: [["t1", "hal9"], ["t2", "war"], ["prk", "mit"], ["t1", "war"], ["t2", "hal9"]],
    stations: [
      S("t1", "Terminal 1", "Terminal 1", 30, 40, 2, 0, true, "r"), S("t2", "Terminal 2", "Terminal 2", 30, 92, 2, 0, true, "r"), S("prk", "Long-Term Parking", "Parking", 30, 144, 1, 0, false, "b"),
      S("rail", "Airport Rail", "Airport Rail", 96, 120, 3, 3, true, "tl"), S("mes", "Messe Nord", "Messe Nord", 146, 70, 2, 0, false, "t"), S("hbf", "Hauptbahnhof", "Hauptbahnhof", 230, 70, 3, 3, true, "t"),
      S("ost", "Ostkreuz", "Ostkreuz", 290, 40, 2, 0, false, "b"), S("sue", "Südkreuz", "Südkreuz", 146, 170, 2, 0, false, "b"), S("neu", "Neukölln", "Neukölln", 230, 170, 3, 3, true, "bl"),
      S("war", "Warschauer Str", "Warschauer", 290, 140, 2, 0, true, "t"), S("mit", "Mitte", "Mitte", 230, 120, 2, 0, false, "r"), S("hal9", "Halle Neun", "Halle Neun", 290, 185, 1, 0, false, "t")
    ],
    lines: [
      { id: "sky", n: "SKYTRAIN", col: "#ffc44d", st: ["t1", "t2", "prk", "rail"], rt: [3, 3, 4], head: 6, last: 235, fare: 0, path: [[30, 40], [30, 92], [30, 144], [64, 144], [96, 120]] },
      { id: "rex", n: "AIRPORT EXPRESS", col: "#ff5a7a", st: ["rail", "mes", "hbf", "ost"], rt: [6, 5, 6], head: 15, last: 200, path: [[96, 120], [146, 70], [230, 70], [260, 40], [290, 40]] },
      { id: "sbahn", n: "S-BAHN", col: "#3fd07a", st: ["rail", "sue", "neu", "war"], rt: [7, 5, 6], head: 20, last: 185, path: [[96, 120], [146, 170], [230, 170], [260, 140], [290, 140]] },
      { id: "ubahn", n: "U-BAHN", col: "#a080ff", st: ["hbf", "mit", "neu", "hal9"], rt: [4, 4, 5], head: 12, last: 180, path: [[230, 70], [230, 120], [230, 170], [245, 185], [290, 185]] }
    ]
  }
};
MAPS.subway.lines.forEach(l => { l.fare = l.fare == null ? 3 : l.fare; });
MAPS.airport.lines.forEach(l => { l.fare = l.fare == null ? 4 : l.fare; });

const GEAR = {
  records: { name: "two crates of records", w: 2.0, desc: "heavy", icon: "crate" },
  turntables: { name: "a pair of turntables in a flight case", w: 2.7, desc: "very heavy", icon: "case" },
  suitcase: { name: "a suitcase with one bad wheel", w: 1.3, desc: "medium", icon: "bag" }
};

const hN = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const clk = m => RP.nightkit.clock(m);

/* ------------------------------------------------------------------ schedule + planner */
function prep(MAP) {
  MAP.by = {}; MAP.stations.forEach(s => { MAP.by[s.id] = s; s.lines = []; });
  MAP.lineBy = {}; MAP.lines.forEach(L => {
    MAP.lineBy[L.id] = L;
    L.st.forEach(id => MAP.by[id].lines.push(L.id));
    if (!L.path) L.path = L.st.map(id => [MAP.by[id].x, MAP.by[id].y]);
    /* arc length of each station along the path */
    const pts = L.path; L.arc = []; let acc = 0; const cum = [0];
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(acc); }
    L.len = acc;
    L.st.forEach(id => { const s = MAP.by[id]; let k = pts.findIndex(p => p[0] === s.x && p[1] === s.y); L.arc.push(k >= 0 ? cum[k] : 0); });
    L.cum = cum;
  });
  MAP.nbr = {}; MAP.stations.forEach(s => { MAP.nbr[s.id] = []; });
  MAP.lines.forEach(L => L.st.forEach((id, i) => { if (i > 0) { const a = L.st[i - 1], rt = L.rt[i - 1]; if (!MAP.nbr[a].some(q => q.id === id)) { MAP.nbr[a].push({ id, rt }); MAP.nbr[id].push({ id: a, rt }); } } }));
  return MAP;
}
const pathPoint = (L, a) => {
  const pts = L.path, cum = L.cum; a = clamp(a, 0, L.len);
  for (let i = 1; i < pts.length; i++) if (a <= cum[i] || i === pts.length - 1) { const seg = cum[i] - cum[i - 1], t = seg ? (a - cum[i - 1]) / seg : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
  return pts[pts.length - 1];
};

function genTrains(MAP, t0, rnd, diff) {
  const trains = []; let id = 1; const hm = diff >= 4 ? 1.15 : 1;
  MAP.lines.forEach(L => {
    const n = L.st.length, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + L.rt[i - 1]);
    const H = Math.max(4, Math.round(L.head * hm));
    [0, 1].forEach(dir => {
      const order = dir === 0 ? L.st : L.st.slice().reverse();
      const off = dir === 0 ? cum : cum.map((c, i) => cum[n - 1] - cum[n - 1 - i]);
      const phase = Math.floor(rnd() * H);
      for (let dep = t0 - 60 + phase; dep <= L.last + (dir === 1 ? 2 : 0); dep += H) {
        if (dep + off[n - 1] < t0 - 5) continue;
        trains.push({ id: id++, line: L.id, dir, term: order[n - 1], stops: order.map((s, i) => ({ st: s, t0: dep + off[i] })), trig: [], dyn: { delays: [], skip: {}, term: null } });
      }
    });
  });
  return trains;
}
const tmD = (T, d, i) => { let t = T.stops[i].t0; d.delays.forEach(x => { if (x.idx < i) t += x.n; }); return t; };
const actD = (T, d, i) => !d.skip[i] && (d.term == null || i <= d.term);
const tm = (T, i) => tmD(T, T.dyn, i);
const act = (T, i) => actD(T, T.dyn, i);
const fullDyn = T => { const d = { delays: [], skip: {}, term: null }; T.trig.forEach(g => applyG(d, g)); return d; };
function applyG(d, g) {
  if (g.kind === "delay") d.delays.push({ idx: g.idx, n: g.n });
  else if (g.kind === "express") { for (let k = g.idx + 1; k < g.to; k++) d.skip[k] = true; }
  else if (g.kind === "term") d.term = g.idx;
}
function csa(trains, A, tStart, applied, xfer) {
  const conns = [];
  trains.forEach(T => {
    const d = applied ? fullDyn(T) : { delays: [], skip: {}, term: null }, n = T.stops.length;
    let i = 0;
    while (i < n) {
      if (!actD(T, d, i)) { i++; continue; }
      let j = i + 1; while (j < n && !actD(T, d, j)) j++;
      if (j >= n) break;
      conns.push({ from: T.stops[i].st, to: T.stops[j].st, dep: tmD(T, d, i), arr: tmD(T, d, j), train: T.id, i, j });
      i = j;
    }
  });
  conns.sort((a, b) => a.dep - b.dep);
  const best = {}, par = {}, reached = {}; best[A] = tStart - xfer;
  conns.forEach(c => {
    const b = best[c.from];
    if (!(reached[c.train] || (b !== undefined && b + xfer <= c.dep))) return;
    reached[c.train] = true;
    if (best[c.to] === undefined || c.arr < best[c.to]) { best[c.to] = c.arr; par[c.to] = c; }
  });
  return { best, par };
}
function route(res, A, B, trains) {
  if (res.best[B] === undefined || B === A) return [];
  const legs = []; let st = B, guard = 0;
  while (st !== A && res.par[st] && guard++ < 30) { const c = res.par[st]; legs.unshift(c); st = c.from; }
  const merged = [];
  legs.forEach(c => { const l = merged[merged.length - 1]; if (l && l.train === c.train && l.j === c.i) { l.j = c.j; l.to = c.to; l.arr = c.arr; } else merged.push(Object.assign({}, c)); });
  return merged;
}

RP.mg.register("lastTrain", {
  title: "last.Train", order: 15,
  desc: "Subway or airport at night: route, transfers, stairs, a dying phone and a heavy bag.",
  auto(p) { return { ok: true, score: 74, minutesLate: 4 }; },
  async play(host, p) {
    const NK = RP.nightkit;
    NK.css("lt-css", CSS);
    p = p || {};
    const reduced = NK.reduced();
    const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
    const rnd = Math.random;
    const mode = p.mode === "airport" ? "airport" : "subway";
    const MAP = prep(MAPS[mode]);
    const GE = GEAR[p.carrying] || GEAR.records;
    const FARE = MAP.fare;

    /* ---------------- from / to ---------------- */
    const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const findSt = label => { const q = norm(label); if (!q) return null; return MAP.stations.find(s => norm(s.n) === q || norm(s.s) === q) || MAP.stations.find(s => norm(s.n).includes(q) || q.includes(norm(s.n)) || norm(s.s).includes(q)); };
    let A = findSt(p.from), B = findSt(p.to);
    const pairOK = (a, b) => a && b && a.id !== b.id;
    if (!pairOK(A, B)) {
      const seed = hN(norm((p.from || "") + (p.to || "")).length + 7, norm(p.to || "x").length + 3);
      let pair;
      if (p.from || p.to) pair = MAP.maxPairs[seed % MAP.maxPairs.length]; else pair = MAP.maxPairs[Math.floor(rnd() * MAP.maxPairs.length)];
      const a2 = MAP.by[pair[0]], b2 = MAP.by[pair[1]];
      if (!A) A = a2; if (!B || B.id === A.id) B = b2.id === A.id ? a2 : b2;
      if (A.id === B.id) B = MAP.stations.find(s => s.id !== A.id);
    }
    const fromLabel = p.from ? String(p.from) : A.n, toLabel = p.to ? String(p.to) : B.n;

    /* ---------------- world: trains, changes, deadline ---------------- */
    const t0 = Math.round(Number(p.start) > 0 ? Number(p.start) : MAP.startMin + Math.floor(rnd() * 12) - 4);
    let world = null;
    const stName = id => MAP.by[id].n;
    for (let attempt = 0; attempt < 30 && !world; attempt++) {
      const trains = genTrains(MAP, t0, rnd, diff);
      const base = csa(trains, A.id, t0 + 2, false, 2);
      if (base.best[B.id] === undefined) continue;
      const legs = route(base, A.id, B.id, trains), tBase = base.best[B.id];
      const byId = {}; trains.forEach(T => { byId[T.id] = T; });
      const cands = [];
      legs.forEach(L => {
        const T = byId[L.train], n = T.stops.length;
        if (L.j - L.i >= 2 && L.j + 1 <= n - 1) cands.push({ T, g: { kind: "express", idx: L.i + 1, to: L.j + 1 }, ref: L.i });
        if (L.j - L.i >= 2) cands.push({ T, g: { kind: "term", idx: L.j - 1 }, ref: L.i });
        if (L.i + 1 <= n - 2) cands.push({ T, g: { kind: "delay", idx: L.i + 1, n: 5 + Math.floor(rnd() * 4) }, ref: L.i });
      });
      const want = [2, 2, 3, 3, 4][diff - 1], chosen = [], usedT = new Set();
      NK.shuffle(cands, rnd).forEach(c => { if (chosen.length < Math.min(want, legs.length + 1) && !usedT.has(c.T.id)) { chosen.push(c); usedT.add(c.T.id); } });
      /* decoys: changes on trains the best route does not use */
      const others = NK.shuffle(trains.filter(T => !usedT.has(T.id) && T.stops.length >= 4 && T.stops[0].t0 > t0 - 10 && T.stops[0].t0 < t0 + 70), rnd);
      for (let k = 0; k < Math.min(others.length, want - chosen.length + 1); k++) {
        const T = others[k], n = T.stops.length, kind = pickKind(rnd);
        const g = kind === "express" && n >= 4 ? { kind: "express", idx: 1, to: Math.min(n - 1, 3) } : kind === "term" ? { kind: "term", idx: n - 2 } : { kind: "delay", idx: 1, n: 5 + Math.floor(rnd() * 4) };
        chosen.push({ T, g, ref: 0 });
      }
      chosen.forEach(c => { c.T.trig.push(Object.assign({ fired: false }, c.g)); c.T.refIdx = c.ref; });
      const fin = csa(trains, A.id, t0 + 2, true, 2);
      if (fin.best[B.id] === undefined || fin.best[B.id] > tBase + 38) continue;
      /* elevator outages on hubs of the best route */
      const hubs = []; legs.forEach(L => { hubs.push(L.from); hubs.push(L.to); });
      const elevOut = new Set(); NK.shuffle(hubs.filter(h => MAP.by[h].el && h !== A.id), rnd).slice(0, [0, 1, 1, 2, 2][diff - 1]).forEach(h => elevOut.add(h));
      const dl = Number(p.deadline) > 0 ? Number(p.deadline) : fin.best[B.id] + 8 + [10, 7, 5, 3, 1][diff - 1];
      world = { trains, byId, tBase, tFeas: fin.best[B.id], deadline: Math.round(dl), elevOut, legs };
    }
    if (!world) { /* extremely unlikely: fall back to a plain schedule with no trouble */
      const trains = genTrains(MAP, t0, rnd, 1), byId = {}; trains.forEach(T => { byId[T.id] = T; });
      const base = csa(trains, A.id, t0 + 2, false, 2);
      world = { trains, byId, tBase: base.best[B.id] || t0 + 60, tFeas: base.best[B.id] || t0 + 60, deadline: Number(p.deadline) || (base.best[B.id] || t0 + 60) + 20, elevOut: new Set(), legs: [] };
    }
    function pickKind(r) { const x = r(); return x < 0.4 ? "delay" : x < 0.75 ? "express" : "term"; }

    /* ---------------- player state ---------------- */
    const Pl = {
      t: t0, loc: "street", st: A.id, line: null, train: null, idx: 0, seg: null,
      bat: clamp(Number(p.battery) >= 0 ? Number(p.battery) : [28, 22, 18, 15, 12][diff - 1], 0, 100),
      money: Number(p.money) >= 0 ? Number(p.money) : (mode === "airport" ? [12, 9, 6, 5, 4] : [9, 6, 3, 3, 3])[diff - 1],
      stam: 100, elKnown: new Set(), paid: false, liveUntil: -1, checks: 0, collapses: 0, cab: false, walk: 0, swipeFails: 0, done: false, arrived: false, late: 0, stairsFlights: 0, announce: null, log: [], bump: 0
    };
    const startBat = Pl.bat, startMoney = Pl.money;
    const CAB = Number(p.cab) > 0 ? Number(p.cab) : MAP.cab;
    const W = 320, H = 200;
    let tDisp = t0, sel = A.id;
    const logAdd = t => { Pl.log.unshift(clk(Pl.t) + "  " + t); Pl.log.length = Math.min(Pl.log.length, 6); };

    /* ---------------- DOM ---------------- */
    const root = host.root;
    host.header("last.Train", MAP.name);
    const main = el("div", { cls: "lt-main" }, root);
    const hud = el("div", { cls: "lt-hud", role: "status" }, main);
    const cNow = el("div", { cls: "lt-chip" }, hud), cDue = el("div", { cls: "lt-chip due" }, hud), cBat = el("div", { cls: "lt-chip" }, hud), cMoney = el("div", { cls: "lt-chip" }, hud), cStam = el("div", { cls: "lt-chip" }, hud);
    const mapBox = el("div", { cls: "lt-mapbox" }, main);
    const map = NK.canvas(mapBox, W, H, "lt-map");
    const labs = el("div", { cls: "lt-labels" }, mapBox);
    const badge = el("div", { cls: "lt-badge", text: "PHONE: SCREEN OFF" }, mapBox);
    const info = el("div", { cls: "lt-info", "aria-live": "polite" }, main);
    const panel = el("div", { cls: "lt-panel" }, main);
    const acts = el("div", { cls: "row lt-acts" }, main);
    const bHow = el("button", { cls: "btn", type: "button", text: "?" }, acts);
    el("div", { cls: "spacer" }, acts);
    const bLeave = el("button", { cls: "btn", type: "button", text: "GIVE UP" }, acts);

    /* ---------------- audio ---------------- */
    const sfx = n => RP.sfx(n);

    /* ---------------- art ---------------- */
    const base = NK.offscreen(W, H);
    function thick(c, x0, y0, x1, y1, col, w) {
      const h = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
      for (let k = 0; k < w; k++) { const o = k - Math.floor(w / 2); if (h) line(c, x0, y0 + o, x1, y1 + o, col); else line(c, x0 + o, y0, x1 + o, y1, col); }
    }
    function paintBase() {
      const c = base.c, r = mulberry(11);
      const isA = mode === "airport";
      NK.dgrad(c, 0, 0, W, H, isA ? ["#061628", "#0a1e34", "#08142a"] : ["#0b0824", "#0f0a2c", "#090620"]);
      for (let y = 0; y < H; y += 10) for (let x = 0; x < W; x += 10) P(c, x, y, isA ? "#12304a" : "#1a1440");
      /* blocks / parks */
      for (let i = 0; i < 46; i++) { const x = Math.floor(r() * 300) + 4, y = Math.floor(r() * 180) + 4, w = 12 + Math.floor(r() * 26), h = 8 + Math.floor(r() * 14); R(c, x, y, w, h, isA ? "#0c2038" : "#120c32"); R(c, x, y, w, 1, isA ? "#14304c" : "#1c1442"); }
      for (let i = 0; i < 5; i++) { const x = 20 + Math.floor(r() * 270), y = 20 + Math.floor(r() * 160); R(c, x, y, 18, 12, isA ? "#0a2a30" : "#0c2a22"); NK.dither(c, x, y, 18, 12, "#12462f", 5, 0); }
      if (MAP.river) { for (let y = 0; y < H; y++) { const x = Math.round(8 + Math.sin(y / 18) * 4); R(c, 0, y, x, 1, "#0a1a48"); R(c, x, y, 1, 1, "#1a3a8a"); if (y % 7 === 0) R(c, Math.max(0, x - 4), y, 2, 1, "#2a56b0"); } }
      if (isA) { /* runways */
        R(c, 150, 118, 130, 6, "#1b2a3a"); for (let x = 154; x < 276; x += 10) R(c, x, 120, 5, 1, "#8aa0b4"); R(c, 60, 176, 6, 20, "#1b2a3a"); for (let y = 178; y < 194; y += 6) R(c, 62, y, 1, 3, "#8aa0b4");
        R(c, 8, 20, 44, 140, "#0c2038"); NK.dither(c, 8, 20, 44, 140, "#14304c", 4, 0); R(c, 8, 20, 44, 1, "#2a5a7a"); R(c, 8, 159, 44, 1, "#2a5a7a"); R(c, 8, 20, 1, 140, "#2a5a7a"); R(c, 51, 20, 1, 140, "#2a5a7a");
      }
      /* lines: glow, body, highlight */
      MAP.lines.forEach(L => {
        const pts = L.path;
        [[9, 0.08], [5, 0.2]].forEach(([w, a]) => { c.globalAlpha = a; for (let i = 1; i < pts.length; i++) thick(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], L.col, w); c.globalAlpha = 1; });
        for (let i = 1; i < pts.length; i++) thick(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], L.col, 3);
        const rr = ramp(L.col);
        for (let i = 1; i < pts.length; i++) { const h = Math.abs(pts[i][0] - pts[i - 1][0]) >= Math.abs(pts[i][1] - pts[i - 1][1]); if (h) line(c, pts[i - 1][0], pts[i - 1][1] - 1, pts[i][0], pts[i][1] - 1, rr[4]); else line(c, pts[i - 1][0] - 1, pts[i - 1][1], pts[i][0] - 1, pts[i][1], rr[4]); }
        /* edge minutes */
        for (let i = 1; i < L.st.length; i++) { const a = MAP.by[L.st[i - 1]], b = MAP.by[L.st[i]]; const mx = Math.round((a.x + b.x) / 2), my = Math.round((a.y + b.y) / 2); const hz = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y); R(c, hz ? mx - 2 : mx + 3, hz ? my + 3 : my - 2, 5, 7, "#05030c"); txt(c, String(L.rt[i - 1]), hz ? mx - 1 : mx + 4, hz ? my + 4 : my - 1, "#b8b0e0", 1, 1); }
      });
      /* stations */
      MAP.stations.forEach(s => {
        const hub = s.lines.length > 1;
        ell(c, s.x, s.y, hub ? 5 : 4, hub ? 5 : 4, "#05030c"); ell(c, s.x, s.y, hub ? 4 : 3, hub ? 4 : 3, "#efeaff"); ell(c, s.x, s.y, hub ? 2 : 1, hub ? 2 : 1, "#14102e");
        if (hub) s.lines.forEach((lid, k) => { P(c, s.x - 3 + k * 2, s.y - 6, MAP.lineBy[lid].col); P(c, s.x - 3 + k * 2, s.y + 6, MAP.lineBy[lid].col); });
      });
    }
    paintBase();

    /* ---------------- labels (HTML, readable at any scale) ---------------- */
    const stBtn = {}, stLab = {};
    function buildLabels() {
      MAP.stations.forEach(s => {
        const b = el("button", { cls: "lt-st", type: "button", "aria-label": s.n + ", " + s.lines.map(l => MAP.lineBy[l].n).join(" and ") }, labs);
        b.style.left = (s.x / W * 100) + "%"; b.style.top = (s.y / H * 100) + "%";
        b.addEventListener("click", () => { sel = s.id; sfx("blip"); renderInfo(); });
        b.addEventListener("keydown", e => {
          const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
          e.preventDefault(); const cur = MAP.by[sel]; let best = null, bs = 1e9;
          MAP.stations.forEach(o => { if (o.id === cur.id) return; const dx = o.x - cur.x, dy = o.y - cur.y, along = dx * d[0] + dy * d[1]; if (along <= 0) return; const cross = Math.abs(dx * d[1] + dy * d[0]), sc = along + cross * 2.2; if (sc < bs) { bs = sc; best = o; } });
          if (best) { sel = best.id; renderInfo(); try { stBtn[best.id].focus(); } catch (er) { /* ignore */ } }
        });
        stBtn[s.id] = b;
        const l = el("div", { cls: "lt-lab", text: s.s }, labs); stLab[s.id] = l;
      });
    }
    buildLabels();
    let narrow = false;
    function placeLabels(scale) {
      narrow = scale < 1.5;
      labs.style.setProperty("--lfs", Math.max(11, Math.min(22, 6.8 * scale + 2)) + "px");
      MAP.stations.forEach(s => {
        const l = stLab[s.id]; l.textContent = narrow ? s.s : s.n; l.style.transform = "none";
        const px = s.x / W * 100, py = s.y / H * 100;
        l.style.left = px + "%"; l.style.top = py + "%";
        const m = 9 * scale / 2 + 2; // gap in px
        const t = { r: `translate(${m}px,-50%)`, l: `translate(calc(-100% - ${m}px),-50%)`, t: `translate(-50%,calc(-100% - ${m - 1}px))`, b: `translate(-50%,${m - 1}px)`, tl: `translate(calc(-100% - ${m - 2}px),calc(-100% - ${m - 2}px))`, tr: `translate(${m - 2}px,calc(-100% - ${m - 2}px))`, bl: `translate(calc(-100% - ${m - 2}px),${m - 2}px)`, br: `translate(${m - 2}px,${m - 2}px)` }[s.lab];
        l.style.transform = t;
      });
    }

    /* ---------------- helpers (game logic) ---------------- */
    const stairsMin = (fl, tired) => Math.ceil((1 + fl * 0.7) * (tired ? 1.5 : 1));
    const stamCost = fl => Math.round(GE.w * fl * 3.2);
    const lineOf = id => MAP.lineBy[id];
    const lineChip = id => "<span class='lt-line' style='background:" + lineOf(id).col + "'></span>" + lineOf(id).n;
    const nextActive = (T, i) => { let j = i + 1; while (j < T.stops.length && !act(T, j)) j++; return j < T.stops.length ? j : -1; };
    const idxOf = (T, st) => T.stops.findIndex(s => s.st === st);
    function fireTo(now) {
      let again = true;
      while (again) {
        again = false;
        for (const T of world.trains) for (const g of T.trig) {
          if (g.fired) continue;
          if (now >= tm(T, g.idx)) {
            g.fired = true; again = true; applyG(T.dyn, g);
            if (Pl.train === T.id) {
              const nm = stName(T.stops[g.idx].st);
              if (g.kind === "express") { const to = stName(T.stops[g.to].st), sk = []; for (let k = g.idx + 1; k < g.to; k++) sk.push(stName(T.stops[k].st)); Pl.announce = "This train is now running express to " + to + ". Please enjoy the view of " + sk.join(" and ") + " going by."; }
              else if (g.kind === "delay") Pl.announce = "We are being held momentarily by the train's dispatcher. Thank you for your patience. (+" + g.n + " min)";
              else Pl.announce = "This train is going out of service at " + nm + ". All passengers must leave the train.";
              sfx("alarm"); logAdd(g.kind === "express" ? "Announcement: express, skipping stops" : g.kind === "delay" ? "Announcement: held " + g.n + " min" : "Announcement: out of service at " + nm);
            }
          }
        }
      }
    }
    const tiredNow = () => Pl.stam < 35;
    function advance(to) {
      if (to <= Pl.t) return;
      const dt = to - Pl.t;
      if (Pl.loc === "train") Pl.stam = Math.min(100, Pl.stam + dt * 2); else if (Pl.loc === "platform") Pl.stam = Math.min(100, Pl.stam + dt * 0.8);
      Pl.bat = Math.max(0, Pl.bat - dt / 28);
      Pl.t = to; fireTo(Pl.t);
      if (Pl.liveUntil >= 0 && Pl.t > Pl.liveUntil) Pl.liveUntil = -1;
    }
    function spendStam(v) {
      Pl.stam -= v;
      if (Pl.stam <= 0) { Pl.stam = 30; Pl.collapses++; advance(Pl.t + 8); logAdd("Your legs quit. You sit on the gear for 8 minutes."); setInfoNote("You sat down on your gear for eight minutes. Your legs filed a complaint."); }
    }
    let infoNote = "";
    const setInfoNote = t => { infoNote = t; };

    /* trains at a platform: next arrivals */
    function boardList(stId, lineId, limit) {
      const out = [];
      world.trains.forEach(T => {
        if (lineId && T.line !== lineId) return;
        const i = idxOf(T, stId); if (i < 0 || !act(T, i)) return;
        if (nextActive(T, i) < 0) return; // terminates here
        const t = tm(T, i); if (t < Pl.t) return;
        out.push({ T, i, t });
      });
      out.sort((a, b) => a.t - b.t);
      return out.slice(0, limit || 4);
    }

    /* ---------------- actions ---------------- */
    function moveFlights(fl, how, then) {
      const tired = tiredNow();
      if (how === "stairs") {
        const mins = stairsMin(fl, tired); advance(Pl.t + mins); Pl.stairsFlights += fl; sfx("footstep");
        const cost = stamCost(fl); then(); spendStam(cost);
      } else {
        const stn = MAP.by[Pl.st];
        if (world.elevOut.has(Pl.st)) { Pl.elKnown.add(Pl.st); advance(Pl.t + 2); sfx("buzz"); setInfoNote("The elevator at " + stn.n + " is OUT OF SERVICE. Two minutes gone, a sign taped to the door."); logAdd("Elevator out at " + stn.n); renderAll(); return; }
        advance(Pl.t + 2 + (hN(Math.floor(Pl.t), stn.fl) % 3) + 1); sfx("door"); then();
      }
      renderAll();
    }
    function enterPlatform(lineId, how) {
      const stn = MAP.by[Pl.st], L = lineOf(lineId);
      const fl = Pl.loc === "street" ? stn.fl : stn.xf;
      const needPay = L.fare > 0 && !Pl.paid;
      if (needPay && Pl.money < L.fare && !Pl.swipeOK) { setInfoNote("You need $" + L.fare + " for the " + (mode === "airport" ? "ticket" : "turnstile") + " and you have $" + Pl.money.toFixed(2).replace(/\.00$/, "") + ". Ask a stranger for a swipe?"); sfx("error"); renderAll(); return; }
      moveFlights(fl, how, () => {
        if (needPay) { if (Pl.swipeOK) { Pl.swipeOK = false; } else { Pl.money = Math.round((Pl.money - L.fare) * 100) / 100; sfx("coin"); } Pl.paid = true; }
        Pl.loc = "platform"; Pl.line = lineId; Pl.train = null;
        logAdd("On the " + L.n + " platform at " + stn.n);
        setInfoNote("");
      });
    }
    function askSwipe() {
      const ok = Pl.swipeFails >= 1 || rnd() < 0.55;
      advance(Pl.t + 3);
      if (ok) { Pl.swipeOK = true; setInfoNote("A stranger in a very large coat swipes you through and says nothing. This city."); sfx("success"); logAdd("A stranger swiped you in."); }
      else { Pl.swipeFails++; setInfoNote("Three people look at their phones. Nobody swipes. Three minutes gone."); sfx("error"); }
      renderAll();
    }
    function board(item) {
      const T = item.T, L = lineOf(T.line);
      if (!act(T, item.i) || tm(T, item.i) < Pl.t) { setInfoNote("That one just left. Check the board again."); renderAll(); return; }
      advance(tm(T, item.i)); sfx("train");
      Pl.loc = "train"; Pl.train = T.id; Pl.idx = item.i; Pl.line = T.line; Pl.seg = null; Pl.announce = null;
      logAdd("Boarded the " + L.n + " toward " + stName(T.term));
      setInfoNote("");
      renderAll();
    }
    function stay() {
      const T = world.byId[Pl.train], j = nextActive(T, Pl.idx);
      if (j < 0) return;
      const i0 = Pl.idx, ta = tm(T, j);
      Pl.announce = null;
      advance(ta); Pl.seg = { i: i0, j, t0: tm(T, i0), t1: ta }; Pl.idx = j; sfx("whoosh");
      /* trigger may have changed the future; also the stop itself might now be terminal */
      const nj = nextActive(T, j), isEnd = nj < 0 || (T.dyn.term != null && j >= T.dyn.term);
      if (isEnd && T.dyn.term != null && j === T.dyn.term) { /* forced exit handled in render */ }
      logAdd("Arrived at " + stName(T.stops[j].st));
      renderAll();
    }
    function getOff() {
      const T = world.byId[Pl.train], stId = T.stops[Pl.idx].st;
      Pl.loc = "platform"; Pl.st = stId; Pl.line = T.line; Pl.train = null; Pl.seg = null; sel = stId;
      logAdd("Got off at " + stName(stId));
      setInfoNote("");
      if (stId === B.id) { /* still need to exit */ }
      renderAll();
    }
    function exitStation(how) {
      const stn = MAP.by[Pl.st];
      moveFlights(stn.fl, how, () => {
        Pl.loc = "street"; Pl.paid = false; Pl.line = null; Pl.train = null;
        logAdd("Out on the street at " + stn.n);
        if (Pl.st === B.id) { arrive(); return; }
      });
    }
    function walkTo(nid, rt) {
      const mins = Math.max(10, rt * 5 + 2), cost = Math.round(GE.w * rt * 4.5);
      advance(Pl.t + mins); Pl.st = nid; Pl.walk += mins; sel = nid; sfx("footstep");
      logAdd("Walked to " + stName(nid) + " (" + mins + " min)");
      spendStam(cost);
      if (nid === B.id) { arrive(); return; }
      setInfoNote("You walked to " + stName(nid) + ". Everything hurts, but it counts.");
      renderAll();
    }
    function checkPhone() {
      if (Pl.bat < 3) { sfx("error"); setInfoNote("The phone gives you one sad vibration and dies."); renderAll(); return; }
      Pl.bat = Math.max(0, Pl.bat - (diff >= 4 ? 4 : 3)); Pl.checks++; Pl.liveUntil = Pl.t + 8; sfx("ping");
      logAdd("Checked the phone (" + Math.round(Pl.bat) + "%)");
      renderAll();
    }
    function takeCab() {
      if (Pl.money < CAB) { sfx("error"); setInfoNote("A cab is $" + CAB + ". You have $" + Pl.money.toFixed(2).replace(/\.00$/, "") + ". The cab driver laughs for you."); renderAll(); return; }
      Pl.money = Math.round((Pl.money - CAB) * 100) / 100; Pl.cab = true;
      advance(Pl.t + 14 + Math.round(rnd() * 8)); sfx("horn"); Pl.loc = "street"; Pl.st = B.id;
      logAdd("Took a cab: -$" + CAB);
      arrive();
    }
    function arrive() {
      if (Pl.done) return;
      Pl.done = true; Pl.arrived = true; Pl.late = Math.max(0, Math.round(Pl.t - world.deadline));
      sfx("success"); renderAll();
      host.timeout(finish, 900);
    }

    /* ---------------- rendering: panel ---------------- */
    function costTxt(parts) { return parts.filter(Boolean).join(" · "); }
    function optBtn(parent, label, cost, fn, why, cls) {
      const b = el("button", { cls: "lt-opt " + (cls || ""), type: "button" }, parent);
      el("span", { html: label + (why ? "<span class='why'>" + why + "</span>" : "") }, b); el("span", { cls: "c", text: cost || "" }, b);
      if (why) b.disabled = true; else b.addEventListener("click", () => { if (Pl.done) return; fn(); });
      return b;
    }
    const money = v => "$" + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, "");
    function moveButtons(parent, fl, labelPrefix, fn, stId) {
      const stn = MAP.by[stId || Pl.st], tired = tiredNow();
      const row = el("div", { cls: "lt-row2" }, parent);
      optBtn(row, labelPrefix + "STAIRS", costTxt([fl + (fl === 1 ? " flight" : " flights"), stairsMin(fl, tired) + " min", "-" + stamCost(fl) + " breath"]), () => fn("stairs"), null, "mv");
      const out = world.elevOut.has(stn.id) && (Pl.elKnown.has(stn.id) || Pl.liveUntil >= 0);
      optBtn(row, labelPrefix + "ELEVATOR", stn.el ? "about 4 min, no breath" : "", () => fn("elev"), !stn.el ? "none here" : out ? "out of service" : null, "mv");
    }
    function renderPanel() {
      panel.textContent = "";
      const stn = MAP.by[Pl.st];
      if (Pl.done) {
        const c = el("div", { cls: "lt-card" }, panel); el("h3", { html: "<span>YOU MADE IT</span>" }, c); el("p", { text: "You arrived at " + toLabel + " at " + clk(Pl.t) + "." }, c); return;
      }
      if (Pl.announce) el("div", { cls: "lt-ann", html: "<b>ANNOUNCEMENT</b>" + Pl.announce }, panel);
      if (infoNote) el("div", { cls: "lt-card" }, panel).appendChild(document.createTextNode(infoNote));
      const c = el("div", { cls: "lt-card" }, panel);
      if (Pl.loc === "street") {
        el("h3", { html: "<span>ON THE STREET</span><small>" + stn.n + "</small>" }, c);
        el("p", { text: Pl.st === A.id && Pl.log.length <= 1 ? "The gig is over. You are carrying " + GE.name + ". Pick a line and go down." : "Pick a line and go down." }, c);
        stn.lines.forEach(lid => {
          const L = lineOf(lid), pay = L.fare > 0 && !Pl.paid;
          const card = el("div", { cls: "lt-card", style: "padding:6px 8px;border-style:dashed" }, c);
          el("div", { html: lineChip(lid) + (pay ? " <span style='color:var(--muted);font-size:16px'>(" + (mode === "airport" ? "ticket " : "fare ") + money(L.fare) + ")</span>" : "") }, card);
          moveButtons(card, stn.fl, "", how => enterPlatform(lid, how));
        });
        if (Pl.money < FARE && !Pl.paid && stn.lines.some(l => lineOf(l).fare > 0)) optBtn(c, "Ask a stranger for a swipe", "3 min", askSwipe, Pl.swipeOK ? "a swipe is ready: go down" : null);
        const walkBox = el("div", { cls: "lt-card", style: "padding:6px 8px;border-style:dashed" }, c);
        el("p", { text: "Or walk. Slow, and it eats your breath." }, walkBox);
        const wr = el("div", { cls: "lt-row2" }, walkBox);
        MAP.nbr[Pl.st].slice(0, 4).forEach(n => optBtn(wr, "Walk to " + MAP.by[n.id].s, Math.max(10, n.rt * 5 + 2) + " min", () => walkTo(n.id, n.rt)));
      } else if (Pl.loc === "platform") {
        const L = lineOf(Pl.line);
        el("h3", { html: "<span>PLATFORM</span><small>" + stn.n + "</small>" }, c);
        el("div", { html: lineChip(L.id) }, c);
        const list = boardList(Pl.st, Pl.line, 4);
        if (!list.length) el("p", { text: "The board is blank. No more trains on this line tonight." }, c);
        else el("p", { text: "The board over your head:" }, c);
        list.forEach(it => {
          const dest = stName(it.T.term), min = Math.max(0, Math.round(it.t - Pl.t));
          const why = (L.fare > 0 && !Pl.paid && Pl.money < L.fare) ? "need " + money(L.fare) : null;
          optBtn(c, "<span style='color:" + L.col + "'>▶</span> to " + dest, "in " + min + " min (" + clk(it.t) + ")", () => board(it), why, "go");
        });
        if (Pl.money < FARE && !Pl.paid && stn.lines.some(l => l !== Pl.line && lineOf(l).fare > 0)) optBtn(c, "Ask a stranger for a ticket", "3 min", askSwipe, Pl.swipeOK ? "a ticket is ready: change lines" : null);
        const others = stn.lines.filter(l => l !== Pl.line);
        others.forEach(lid => {
          const card = el("div", { cls: "lt-card", style: "padding:6px 8px;border-style:dashed" }, c);
          el("div", { html: "Change to " + lineChip(lid) }, card);
          moveButtons(card, stn.xf || 1, "", how => enterPlatform(lid, how));
        });
        const exitCard = el("div", { cls: "lt-card", style: "padding:6px 8px;border-style:dashed" }, c);
        el("div", { text: "Leave the station" }, exitCard);
        moveButtons(exitCard, stn.fl, "", how => exitStation(how));
      } else {
        const T = world.byId[Pl.train], L = lineOf(T.line), cur = T.stops[Pl.idx].st, j = nextActive(T, Pl.idx);
        const ending = j < 0 || (T.dyn.term != null && Pl.idx >= T.dyn.term);
        el("h3", { html: "<span>ON THE TRAIN</span><small>" + L.n + " to " + stName(T.term) + "</small>" }, c);
        el("p", { text: "Doors open at " + stName(cur) + ". " + (ending ? "This is the last stop." : "Next stop " + stName(T.stops[j].st) + " in " + Math.max(1, Math.round(tm(T, j) - Pl.t)) + " min.") }, c);
        if (!ending) optBtn(c, "Stay on to " + stName(T.stops[j].st), Math.max(1, Math.round(tm(T, j) - Pl.t)) + " min", stay, null, "go");
        optBtn(c, ending ? "Get off (the train is done)" : "Get off here", "", getOff);
      }
      /* phone */
      const pc = el("div", { cls: "lt-card lt-phonecard" }, panel);
      el("h3", { html: "<span>PHONE</span><small>" + Math.round(Pl.bat) + "%</small>" }, pc);
      if (Pl.liveUntil >= 0) {
        el("p", { text: "Live until " + clk(Pl.liveUntil) + ". Train positions are on the map. Alerts:" }, pc);
        const al = alerts(); const box = el("div", { cls: "lt-alerts" }, pc);
        if (!al.length) el("div", { text: "No service alerts in the next 40 minutes." }, box);
        al.forEach(t => el("div", { text: t }, box));
      } else optBtn(pc, "Check the phone", (diff >= 4 ? 4 : 3) + "% battery", checkPhone, Pl.bat < 3 ? "the phone is dead" : null);
      optBtn(pc, "Take a cab", money(CAB), takeCab, null, "cab");
      const lg = el("div", { cls: "lt-log" }, panel); Pl.log.slice(0, 4).forEach(t => el("div", { text: t }, lg));
    }
    function alerts() {
      const out = [];
      world.trains.forEach(T => T.trig.forEach(g => {
        const ref = T.refIdx != null ? T.refIdx : 0, tr = tm(T, ref);
        if (tr - 40 > Pl.t || tm(T, T.stops.length - 1) < Pl.t) return;
        const who = lineOf(T.line).n + " to " + stName(T.term) + ", " + clk(tr) + " at " + stName(T.stops[ref].st);
        if (g.kind === "express") { const sk = []; for (let k = g.idx + 1; k < g.to; k++) sk.push(stName(T.stops[k].st)); out.push(who + ": runs EXPRESS after " + stName(T.stops[g.idx].st) + ", skipping " + sk.join(" and ") + "."); }
        else if (g.kind === "delay") out.push(who + ": held ~" + g.n + " min after " + stName(T.stops[g.idx].st) + " (signal problem).");
        else out.push(who + ": goes out of service at " + stName(T.stops[g.idx].st) + ". Wait for the next one.");
      }));
      world.elevOut.forEach(id => out.push("Elevator out of service at " + stName(id) + "."));
      return out;
    }
    function renderInfo() {
      const s = MAP.by[sel], lines = s.lines.map(l => lineChip(l)).join("  ");
      let h = "<b>" + s.n + "</b> &nbsp;" + lines + " &nbsp;<span style='color:var(--muted)'>" + s.fl + (s.fl === 1 ? " flight down, " : " flights down, ") + (s.el ? "elevator" : "no elevator") + (s.id === B.id ? ", <span style='color:var(--lime)'>YOUR STOP</span>" : "") + "</span>";
      if (Pl.liveUntil >= 0) {
        const list = s.lines.flatMap(l => boardList(s.id, l, 2).map(it => lineOf(l).n + " to " + stName(it.T.term) + " " + clk(it.t))).slice(0, 4);
        if (list.length) h += "<br><span style='color:var(--pink)'>LIVE: " + list.join(" | ") + "</span>";
      }
      info.innerHTML = h;
      MAP.stations.forEach(q => { stBtn[q.id].tabIndex = q.id === sel ? 0 : -1; });
    }
    function renderHud() {
      cNow.innerHTML = "<small>NOW</small>" + clk(Pl.t);
      const left = Math.round(world.deadline - Pl.t);
      cDue.innerHTML = "<small>DUE</small>" + clk(world.deadline) + " <small>(" + (left >= 0 ? left + " min" : (-left) + " late") + ")</small>"; cDue.classList.toggle("low", left < 0);
      cBat.innerHTML = "<small>PHONE</small><span class='lt-bar'><i style='width:" + clamp(Pl.bat, 0, 100) + "%'></i></span>" + Math.round(Pl.bat) + "%"; cBat.classList.toggle("low", Pl.bat < 8);
      cMoney.innerHTML = "<small>CASH</small>" + money(Pl.money);
      cStam.innerHTML = "<small>BREATH</small><span class='lt-bar'><i style='width:" + clamp(Pl.stam, 0, 100) + "%'></i></span>"; cStam.classList.toggle("low", Pl.stam < 30);
      badge.textContent = Pl.liveUntil >= 0 ? "LIVE until " + clk(Pl.liveUntil) : (Pl.bat >= 3 ? "PHONE: SCREEN OFF" : "PHONE: DEAD"); badge.classList.toggle("live", Pl.liveUntil >= 0);
      MAP.stations.forEach(s => { stLab[s.id].classList.toggle("sel", s.id === sel); stLab[s.id].classList.toggle("dest", s.id === B.id); stLab[s.id].classList.toggle("here", s.id === Pl.st && Pl.loc !== "train"); });
    }
    function renderAll() { renderHud(); renderInfo(); renderPanel(); }

    /* ---------------- map dynamics ---------------- */
    function trainPos(T, tt) {
      const L = lineOf(T.line), n = T.stops.length; if (tt < tm(T, 0) || tt > tm(T, n - 1)) return null;
      let i = 0; while (i < n - 1) { const j = nextActive(T, i); if (j < 0) return null; if (tt <= tm(T, j)) break; i = j; }
      const j = nextActive(T, i); if (j < 0) return null;
      const a = tm(T, i), b = tm(T, j), f = b > a ? clamp((tt - a) / (b - a), 0, 1) : 0;
      const ia = L.st.indexOf(T.stops[i].st), ib = L.st.indexOf(T.stops[j].st);
      return pathPoint(L, L.arc[ia] + (L.arc[ib] - L.arc[ia]) * f);
    }
    function drawMap(now) {
      const c = map.c;
      c.drawImage(base.cv, 0, 0);
      /* origin / destination markers */
      const flag = (s, col, t) => { const x = s.x, y = s.y; R(c, x - 1, y - 16, 2, 14, "#05030c"); R(c, x, y - 16, 1, 13, "#d8d0e8"); R(c, x + 1, y - 16, 8, 6, col); R(c, x + 1, y - 16, 8, 1, "#ffffff55"); txt(c, t, x + 3, y - 15, "#05030c", 1, 1); };
      flag(B, "#9be15d", "B"); if (Pl.st !== A.id || Pl.loc === "train") flag(A, "#8c84b8", "A");
      /* live trains */
      if (Pl.liveUntil >= 0 && !Pl.done) world.trains.forEach(T => {
        const pos = trainPos(T, tDisp); if (!pos) return; const col = lineOf(T.line).col;
        R(c, pos[0] - 3, pos[1] - 3, 7, 7, "#05030c"); R(c, pos[0] - 2, pos[1] - 2, 5, 5, col); R(c, pos[0] - 1, pos[1] - 1, 3, 3, "#ffffff");
      });
      /* player */
      let pp = null;
      if (Pl.loc === "train") {
        const T = world.byId[Pl.train];
        if (Pl.seg) { const seg = Pl.seg, f = seg.t1 > seg.t0 ? clamp((tDisp - seg.t0) / (seg.t1 - seg.t0), 0, 1) : 1, L = lineOf(T.line), ia = L.st.indexOf(T.stops[seg.i].st), ib = L.st.indexOf(T.stops[seg.j].st); pp = pathPoint(L, L.arc[ia] + (L.arc[ib] - L.arc[ia]) * f); }
        else { const s = MAP.by[T.stops[Pl.idx].st]; pp = [s.x, s.y]; }
      } else { const s = MAP.by[Pl.st]; pp = [s.x, s.y]; }
      const pul = reduced ? 0 : Math.round(Math.abs(Math.sin(now * 3)) * 2);
      const rr = 7 + pul;
      for (let a = 0; a < 6.283; a += 0.18) P(c, pp[0] + Math.cos(a) * rr, pp[1] + Math.sin(a) * rr, "#ff3fa4");
      ell(c, pp[0], pp[1], 3, 3, "#05030c"); ell(c, pp[0], pp[1], 2, 2, "#ff3fa4"); P(c, pp[0], pp[1], "#ffffff");
      if (sel && sel !== Pl.st) { const s = MAP.by[sel]; for (let a = 0; a < 6.283; a += 0.5) P(c, s.x + Math.cos(a) * 8, s.y + Math.sin(a) * 8, "#62e6ff"); }
    }

    /* ---------------- finish ---------------- */
    let resolveFn = () => {};
    function finish() {
      const late = Pl.late;
      let score = 100 - Math.min(70, late * 2.2) - (Pl.cab ? 18 : 0) - Pl.collapses * 4;
      score = Math.round(clamp(score, 0, 100));
      const lines = [["Arrived", clk(Pl.t), ""], ["Due", clk(world.deadline), ""], ["Minutes late", String(late), late ? "n" : "y"], ["Phone checks", Pl.checks + " (" + Math.round(Pl.bat) + "% left)", ""], ["Cash left", money(Pl.money), ""], ["Stairs climbed", Pl.stairsFlights + " flights" + (Pl.collapses ? ", " + Pl.collapses + " collapse(s)" : ""), ""]];
      if (Pl.cab) lines.push(["Took a cab", "-18", "n"]); if (Pl.walk) lines.push(["Walked", Pl.walk + " min", ""]);
      const blurb = Pl.cab ? "You paid for a cab, which is a type of defeat. You are home, the records are home, and the money is gone." : late === 0 ? "On time, gear intact, phone alive enough to text 'home'. The night train gods are satisfied." : late < 10 ? "A little late, but you made it. Nobody remembers who was late, only who showed up." : "You made it, eventually. The sun is considering coming up. Your back is considering unionizing.";
      NK.endCard(host, { kicker: mode === "airport" ? "last.Train | airport" : "last.Train | subway", title: late === 0 ? "RIGHT ON TIME" : late < 10 ? "MADE IT, SORT OF ON TIME" : "MADE IT, LATE", ok: true, score, lines, blurb }).then(() => resolveFn({ ok: true, score, minutesLate: late }));
    }
    bLeave.addEventListener("click", () => { if (Pl.done) return; Pl.done = true; resolveFn({ ok: false, score: 0, minutesLate: Math.max(0, Math.round(Pl.t - world.deadline)) }); });
    bHow.addEventListener("click", () => { setInfoNote("Tap stations for info. Numbers on the lines are minutes. Pick stairs or elevator: stairs are fast but cost breath with heavy gear. The phone shows alerts and live trains for 8 minutes, and costs battery. At the platform, the board is free."); renderAll(); });

    /* ---------------- run ---------------- */
    return new Promise(resolve => {
      resolveFn = resolve;
      NK.onResize(host, layout);
      function layout() {
        const compact = NK.isCompact();
        NK.setCompact(host, compact);
        const avail = root.clientWidth || 700, wide = !compact && avail >= 940;
        main.classList.toggle("wide", wide); main.classList.toggle("compact", compact);
        let sc;
        if (compact) {
          const w = Math.max(280, Math.min(avail * 0.52, (window.innerHeight - 150) * (W / H)));
          sc = w / W; main.style.gridTemplateColumns = Math.round(w) + "px minmax(0, 1fr)"; map.cv.style.width = Math.round(w) + "px"; map.cv.style.height = Math.round(H * sc) + "px";
          panel.style.maxHeight = Math.max(160, window.innerHeight - 52) + "px";
        } else { panel.style.maxHeight = ""; main.style.gridTemplateColumns = ""; sc = NK.fit(map.cv, { clientWidth: wide ? 640 : avail }, W, H, wide ? 640 : 760); }
        placeLabels(sc);
      }
      layout();
      logAdd("Left " + fromLabel + " for " + A.n);
      setInfoNote(GE.name.charAt(0).toUpperCase() + GE.name.slice(1) + " (" + GE.desc + "). " + (Pl.bat < 20 ? "Phone at " + Math.round(Pl.bat) + "%. " : "") + "Get from " + (fromLabel !== A.n ? fromLabel + " (" + A.n + ")" : A.n) + " to " + (toLabel !== B.n ? toLabel + " (" + B.n + ")" : B.n) + " by " + clk(world.deadline) + ".");
      renderAll();
      let last = null;
      host.raf(tm2 => {
        if (Pl.done && !host.root.isConnected) return false;
        const now = tm2 / 1000, dt = last == null ? 0 : Math.min(0.1, now - last); last = now;
        if (reduced) tDisp = Pl.t; else if (tDisp < Pl.t) tDisp = Math.min(Pl.t, tDisp + Math.max(10, (Pl.t - tDisp) * 2.5) * dt); else tDisp = Pl.t;
        try { drawMap(now); } catch (e) { /* ignore */ }
      });
      try { host.root.__lt = { Pl, world, MAP, A, B, renderAll, board, stay, getOff, enterPlatform, exitStation, checkPhone, takeCab, walkTo, boardList, advance, alerts, csa }; } catch (e) { /* ignore */ }
    });
  }
});
})();
