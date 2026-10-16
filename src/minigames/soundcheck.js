/* sound.Check — doors open soon and the PA is not right. Trace the signal chain
   (decks -> mixer -> DI/EQ -> amp -> speakers), listen, read the meters, re-patch the cables and fix it.
   Params (all optional):
     { faults: ["ground-hum","dead-channel","feedback","blown-tweeter","wrong-input"],
       time: seconds until doors (default scales with faults and difficulty),
       stage: "loft" | "festival", difficulty: 1..5 }
   Result: { ok, score (0..100), fixed } — ok means every fault is fixed and nothing new is broken. */
(function () {
"use strict";
const RP = window.RP;
const { R, P, ell, line, txt, txtC, bayer, ramp, clamp, el, mulberry } = RP.u;

const FAULTS = ["ground-hum", "dead-channel", "feedback", "blown-tweeter", "wrong-input"];
const FNAME = { "ground-hum": "Ground hum", "dead-channel": "Dead channel", "feedback": "Feedback", "blown-tweeter": "Blown tweeter", "wrong-input": "Wrong input" };
const FFIXED = {
  "ground-hum": "Mixer and amp share one circuit now, or the ground is lifted. Silence.",
  "dead-channel": "Signal makes it through the strip again.",
  "feedback": "The loop is broken. No more howl.",
  "blown-tweeter": "Every box has a working tweeter now.",
  "wrong-input": "Every deck is on the right input."
};
const FOPEN = {
  "ground-hum": "A 60 Hz hum is still under the music.",
  "dead-channel": "A deck is still going through a dead channel.",
  "feedback": "The mic still rings out at the monitor.",
  "blown-tweeter": "One speaker still has no top end.",
  "wrong-input": "A deck is on the wrong input."
};
const HINTS = {
  "ground-hum": [
    "There is a low buzz under everything, even with both decks stopped. Records do not do that.",
    "With nothing playing, watch the 62 Hz bar on the analyzer. That is 60 Hz mains hum: two boxes plugged into different circuits.",
    "Plug the mixer and the amp rack into the same wall outlet, or flip the GROUND LIFT on the DI box in the rack."
  ],
  "dead-channel": [
    "One deck lights its signal LED but nothing comes out the other side of the mixer. Check the channel meters.",
    "That channel strip is dirty or dead. Try the cable on a free channel (match PHONO or LINE), or work the fader.",
    "Patch the deck into a spare channel, or spray the contact cleaner and scrub the fader end to end."
  ],
  "feedback": [
    "That howl is the mic and the monitor feeding each other. The analyzer shows one spike that keeps growing.",
    "Two ways out: move the monitor away from the mic and turn it off-axis, or pull down the band under the spike.",
    "Cut the spiking band by about 8 dB. Or push the monitor 2 m from the mic and turn it 40 degrees away."
  ],
  "blown-tweeter": [
    "Solo each side of the PA. One of them sounds dull, like it has a pillow on its face.",
    "Solo L, then R, and watch the analyzer: the bad side has no top end (4k, 8k, 16k).",
    "Patch that amp output into the spare cab."
  ],
  "wrong-input": [
    "One deck is thin and far too quiet, or hot and crunchy. Watch the channel meter.",
    "Turntables put out a tiny signal and need PHONO. CDJs are line level and want LINE.",
    "Flip the input switch on that channel strip to match the deck."
  ]
};
const BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const BLAB = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
const SHAPE = [0.7, 0.95, 1.0, 0.8, 0.62, 0.52, 0.45, 0.38, 0.27, 0.14];
const THIN = [0.04, 0.06, 0.12, 0.3, 0.55, 0.9, 1, 1, 0.9, 0.8];
const HOT = [1.5, 1.45, 1.3, 1.1, 1, 1.05, 1.2, 1.4, 1.5, 1.25];

const STAGES = {
  loft: { name: "The Loft", sub: "Bushwick, 2nd floor, no elevator", nch: 3, tech: "SKYE", power: ["WALL A", "WALL B"], powerNote: "Wall A is by the bar. Wall B is by the door. They are on different breakers.", amp: "House PA amp", pa: "Borrowed cabs on milk crates" },
  festival: { name: "Harbor Lights, main stage", sub: "Front of house is a long way from the stage", nch: 4, tech: "NADIA (FOH)", power: ["DISTRO 1", "DISTRO 2"], powerNote: "Distro 1 feeds FOH. Distro 2 feeds the stage. Different phases, different grounds.", amp: "Amp racks + system processor", pa: "Line array hangs" }
};
const TECH_START = {
  loft: ["It worked fine last Saturday. Probably.", "The PA is... borrowed. Do not ask whose.", "People are on the stairs already. No pressure."],
  festival: ["Doors in a few. Everything was fine at the line check.", "The headliner's rider says 'no feedback'. Cute.", "I have a radio and no patience. Go."]
};

const gearLabel = (id, fb) => { try { const g = RP.gearInfo(id); return g ? g.brand + " " + g.model : fb; } catch (e) { return fb; } };
const gearType = (id, fb) => { try { const g = RP.gearInfo(id); if (g) return g.kind === "turntable" ? "tt" : "cdj"; } catch (e) { /* ignore */ } return fb; };

const CSS = `
.sc-clock { font-size: 24px; color: var(--amber); font-variant-numeric: tabular-nums; } .sc-clock.low { color: #ff6a6a; }
.sc-clock small { color: var(--muted); font-size: 17px; margin-right: 6px; }
.sc-main { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "stage" "info" "acts" "right"; gap: 8px 10px; align-items: start; }
.sc-main.wide { grid-template-columns: 640px minmax(0, 1fr); grid-template-areas: "stage right" "info right" "acts right"; grid-template-rows: auto auto 1fr; }
.sc-left, .sc-right, .sc-info { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sc-left { grid-area: stage; gap: 3px; } .sc-info { grid-area: info; gap: 4px; } .sc-right { grid-area: right; } .sc-acts { grid-area: acts; }
.sc-stage { position: relative; background: #000; border: 1px solid var(--line); line-height: 0; width: fit-content; max-width: 100%; margin-inline: auto; }
.sc-main.wide .sc-stage { margin-inline: 0; }
.sc-scene { display: block; cursor: crosshair; touch-action: manipulation; }
.sc-queue { display: block; margin-inline: auto; background: #07050f; border: 1px solid #1b1538; }
.sc-main.wide .sc-queue { margin-inline: 0; }
.sc-qlabel { font-size: 15px; color: var(--muted); line-height: 1; display: flex; justify-content: space-between; margin-top: -2px; }
.sc-test { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.sc-test .kbtn { touch-action: manipulation; min-width: 0; padding: 7px 4px; font-size: 18px; white-space: nowrap; }
.sc-test .kbtn[aria-pressed="true"] { background: #2a2050; border-color: var(--cyan); color: var(--cyan); }
.sc-test .kbtn.pa[aria-pressed="true"] { background: #14301f; border-color: var(--ok); color: var(--ok); }
.sc-test .kbtn.warn[aria-pressed="true"] { background: #3a1626; border-color: var(--pink); color: var(--pink); }
.sc-listen { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; font-size: 18px; color: var(--muted); }
.sc-listen .kbtn { flex: 1; }
.sc-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.sc-tab { font-family: var(--ui); font-size: 18px; background: #110d24; color: var(--muted); border: 1px solid var(--line); border-bottom: 3px solid var(--line); padding: 5px 2px; cursor: pointer; border-radius: 2px; letter-spacing: .04em; }
.sc-tab[aria-selected="true"] { color: var(--fg); border-color: var(--pink); border-bottom-color: var(--pink); background: #1c0f2c; }
.sc-tab:hover { color: var(--fg); }
.sc-tab:focus-visible, .kbtn:focus-visible, .btn:focus-visible, .sc-seg button:focus-visible, .sc-scene:focus-visible { outline: 2px solid var(--cyan); outline-offset: 1px; }
.sc-panel { min-height: 232px; display: flex; flex-direction: column; gap: 8px; }
.sc-panel h3 { margin: 0; font-weight: 400; font-size: 20px; color: var(--pink); letter-spacing: .06em; }
.sc-panel p { margin: 0; font-size: 18px; color: var(--muted); line-height: 1.05; }
.sc-card { background: #0f0b20; border: 1px solid #241d48; border-radius: 3px; padding: 6px 8px; display: flex; flex-direction: column; gap: 5px; }
.sc-card .t { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; font-size: 19px; color: var(--fg); }
.sc-card .t small { font-size: 16px; color: var(--muted); text-align: right; }
.sc-seg { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; font-size: 17px; color: var(--muted); }
.sc-seg > span { min-width: 64px; }
.sc-seg button { font-family: var(--ui); font-size: 18px; background: #1a1534; color: var(--fg); border: 1px solid #3a3070; border-radius: 2px; padding: 4px 9px; cursor: pointer; min-width: 44px; }
.sc-seg button[aria-pressed="true"] { background: #2a2050; border-color: var(--cyan); color: var(--cyan); }
.sc-seg button.on-pink[aria-pressed="true"] { border-color: var(--pink); color: var(--pink); background: #2a1040; }
.sc-seg button:disabled { opacity: .4; cursor: default; }
.sc-strips { display: grid; gap: 6px; }
.sc-strip { background: #0f0b20; border: 1px solid #241d48; border-radius: 3px; padding: 6px; display: flex; flex-direction: column; gap: 5px; align-items: stretch; min-width: 0; }
.sc-strip .t { font-size: 19px; color: var(--fg); display: flex; flex-direction: column; line-height: 1; }
.sc-strip .t small { color: var(--muted); font-size: 15px; }
.sc-ladder { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; height: 9px; }
.sc-ladder i { background: #241d48; } .sc-ladder i.g { background: #3fd07a; } .sc-ladder i.a { background: #ffc44d; } .sc-ladder i.r { background: #ff4a5a; }
.sc-fader { display: flex; align-items: center; gap: 6px; font-size: 16px; color: var(--muted); }
.sc-fader input { flex: 1; min-width: 0; accent-color: var(--cyan); height: 28px; }
.sc-eq { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; align-items: end; }
.sc-eq label { display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 14px; color: var(--muted); }
.sc-eq input { writing-mode: vertical-lr; direction: rtl; width: 100%; height: 86px; margin: 0; accent-color: var(--lime); min-width: 0; }
.sc-eq output { font-size: 13px; color: var(--fg); font-variant-numeric: tabular-nums; min-height: 1em; }
.sc-rta { display: block; width: 100%; image-rendering: pixelated; background: #07050f; border: 1px solid #241d48; }
.sc-two { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.sc-note { font-size: 16px !important; }
.sc-over { position: relative; }
.sc-main.compact { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "stage right" "info right" "acts right"; grid-template-rows: auto auto 1fr; gap: 4px 8px; }
.sc-main.compact .sc-stage { margin: 0; } .sc-main.compact .sc-queue, .sc-main.compact .sc-qlabel { display: none; }
.sc-main.compact .sc-panel { min-height: 0; overflow-y: auto; padding: 6px; gap: 5px; } .sc-main.compact .sc-panel > p, .sc-main.compact .sc-panel .sc-note { display: none; } .sc-main.compact .sc-panel h3 { font-size: 17px; }
.sc-main.compact .sc-right { gap: 4px; } .sc-main.compact .sc-test { padding: 4px; gap: 4px; } .sc-main.compact .sc-test .kbtn { padding: 3px 2px; font-size: 16px; }
.sc-main.compact .sc-tabs { gap: 3px; } .sc-main.compact .sc-tab { padding: 2px 1px; font-size: 15px; border-bottom-width: 2px; }
.sc-main.compact .sc-eq input { height: 52px; } .sc-main.compact .sc-card { padding: 4px 6px; gap: 3px; } .sc-main.compact .sc-card .t { font-size: 17px; } .sc-main.compact .sc-strip { padding: 4px; gap: 3px; }
.sc-main.compact .sc-card { flex-direction: row; flex-wrap: wrap; align-items: center; } .sc-main.compact .sc-card .t { flex: 1 1 100%; } .sc-main.compact .sc-info { gap: 2px; } .sc-main.compact .sc-clock { font-size: 18px; } .sc-main.compact .sc-acts { gap: 6px; }
@media (max-width: 860px) { .sc-clock { font-size: 20px; } .sc-panel { min-height: 0; } .sc-info .mg-msg { font-size: 20px; } .sc-acts .btn { padding: 6px 12px; } }
@media (max-width: 420px) { .sc-test .kbtn { font-size: 16px; } .sc-tab { font-size: 16px; } .sc-eq input { height: 74px; } }
@media (prefers-reduced-motion: reduce) { .sc-scene { cursor: pointer; } }
`;

/* ------------------------------------------------------------------ scene geometry (logical px) */
const W = 320, H = 200;
const DECK = [[91, 70, 36, 22], [199, 70, 36, 22]];
const MIX = [130, 66, 66, 30];
const TABLE = [86, 90, 154, 46];
const RACK = [24, 120, 86, 78];
const U_DI = [26, 122, 82, 17], U_EQ = [26, 141, 82, 30], U_AMP = [26, 173, 82, 23];
const CABL = [6, 20, 50, 84], CABR = [264, 20, 50, 84], CABS = [122, 140, 34, 46];
const MIC = [262, 128];
const OUTLET = { outA: [14, 132], outB: [306, 132] };
const JACK = {
  ch0: [0, 0], ch1: [0, 0], ch2: [0, 0], ch3: [0, 0],
  cabA: [58, 111], cabB: [262, 111], cabS: [120, 182],
  outA: OUTLET.outA, outB: OUTLET.outB
};
const CABLES = {
  deckA: { fam: "in", label: "Deck A out", from: [126, 84], opts: ["ch0", "ch1", "ch2", "ch3"], cols: ["#ff4a6a", "#efeaff"], sag: 7 },
  deckB: { fam: "in", label: "Deck B out", from: [200, 84], opts: ["ch0", "ch1", "ch2", "ch3"], cols: ["#ff4a6a", "#efeaff"], sag: 7 },
  ampL: { fam: "spk", label: "Amp L out", from: [110, 184], opts: ["cabA", "cabB", "cabS"], cols: ["#7ae08a"], thick: 2, sag: 12 },
  ampR: { fam: "spk", label: "Amp R out", from: [110, 191], opts: ["cabA", "cabB", "cabS"], cols: ["#b8f070"], thick: 2, sag: 12 },
  pwrMix: { fam: "pwr", label: "Mixer + decks power", from: [90, 98], opts: ["outA", "outB"], cols: ["#ff8a2a"], thick: 2, sag: 14, multi: true },
  pwrAmp: { fam: "pwr", label: "Amp rack power", from: [24, 190], opts: ["outA", "outB"], cols: ["#ff8a2a"], thick: 2, sag: 16, multi: true }
};
const JNAME = { ch0: "CH1", ch1: "CH2", ch2: "CH3", ch3: "CH4", cabA: "left stack", cabB: "right stack", cabS: "spare cab", outA: "WALL A", outB: "WALL B" };

function bez(x0, y0, cx, cy, x1, y1, n) {
  n = n || Math.max(12, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); }
  return pts;
}
const plen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function along(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) { const t = seg ? clamp(d / seg, 0, 1) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
    d -= seg;
  }
  return pts[pts.length - 1];
}
const hN = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

RP.mg.register("soundCheck", {
  title: "sound.Check", order: 13,
  desc: "Doors in a few minutes. Trace the signal, find the fault, fix the PA.",
  auto(p) {
    const n = Array.isArray(p && p.faults) && p.faults.length ? p.faults.filter(f => FAULTS.includes(f)).length : 2;
    return { ok: true, score: 82, fixed: n };
  },
  async play(host, p) {
    const NK = RP.nightkit;
    NK.css("sc-css", CSS);
    p = p || {};
    const reduced = NK.reduced();
    const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
    const stageId = p.stage === "festival" ? "festival" : "loft";
    const ST = STAGES[stageId];
    const rnd = Math.random;
    let faults = Array.isArray(p.faults) ? [...new Set(p.faults.filter(f => FAULTS.includes(f)))] : [];
    if (!faults.length) faults = NK.shuffle(FAULTS).slice(0, [2, 2, 3, 3, 4][diff - 1]);
    let secs = Number(p.time);
    if (!isFinite(secs) || secs <= 0) secs = Math.round((60 + faults.length * 58) * [1.7, 1.35, 1.05, 0.88, 0.74][diff - 1]);
    else if (secs <= 20) secs *= 60;
    const TOTAL = secs;

    /* ---------------- gear and state ---------------- */
    const G = (host.S && host.S.gear) || {};
    const ttFirst = rnd() < 0.5;
    const A0 = stageId === "festival"
      ? { type: "cdj", gear: G.decks && gearType(G.decks, "cdj") === "cdj" ? G.decks : "pioneer_cdj_3000", fb: "Pioneer DJ CDJ-3000" }
      : { type: "tt", gear: G.turntables && gearType(G.turntables, "tt") === "tt" ? G.turntables : "at_lp120_usb", fb: "Audio-Technica AT-LP120-USB" };
    const B0 = stageId === "festival"
      ? { type: "tt", gear: G.turntables && gearType(G.turntables, "tt") === "tt" ? G.turntables : "technics_sl_1210mk7", fb: "Technics SL-1210MK7" }
      : { type: "cdj", gear: G.decks && gearType(G.decks, "cdj") === "cdj" ? G.decks : "pioneer_cdj_350", fb: "Pioneer CDJ-350" };
    const decks = (ttFirst ? [A0, B0] : [B0, A0]).map((d, i) => ({ id: "AB"[i], type: d.type, name: gearLabel(d.gear, d.fb), out: i, play: false, loop: null }));
    const mixName = stageId === "festival"
      ? (G.mixer && RP.gearInfo && RP.gearInfo(G.mixer) && /rotary|mixer_4ch/.test(RP.gearInfo(G.mixer).kind) ? gearLabel(G.mixer, "Pioneer DJM-900NXS2") : gearLabel("pioneer_djm_900nxs2", "Pioneer DJM-900NXS2"))
      : gearLabel("behringer_djx750", "Behringer DJX750");
    const monName = gearLabel(G.monitors || (stageId === "festival" ? "dynaudio_core_47" : "krk_rokit_5_g4"), "Booth monitor");
    const NCH = ST.nch;
    const S = {
      stage: stageId, deck: decks,
      ch: Array.from({ length: NCH }, () => ({ input: "line", fader: 0.8, dirt: 0, last: null, sw: 0 })),
      mic: { live: true }, eq: Array(10).fill(0), gnd: false,
      pwr: { pwrMix: "outA", pwrAmp: "outA" },
      jack: { deckA: "ch0", deckB: "ch1", ampL: "cabA", ampR: "cabB" },
      cabBlown: { cabA: false, cabB: false, cabS: false },
      mon: { dist: 2.6, ang: 55 },
      fbBand: [4, 5, 5, 6, 6, 7][Math.floor(rnd() * 6)],
      muted: true, pink: false, listen: "lr"
    };
    decks.forEach((d, i) => { S.ch[i].input = d.type === "tt" ? "phono" : "line"; });
    const FBG0 = 2.0 + rnd() * 0.5 + diff * 0.06;
    /* inject the faults */
    const fi = {};
    if (faults.includes("ground-hum")) { S.pwr.pwrMix = rnd() < 0.5 ? "outA" : "outB"; S.pwr.pwrAmp = S.pwr.pwrMix === "outA" ? "outB" : "outA"; }
    if (faults.includes("wrong-input")) { const di = Math.floor(rnd() * 2); fi.wrongDeck = di; S.ch[di].input = decks[di].type === "tt" ? "line" : "phono"; }
    if (faults.includes("dead-channel")) { const di = faults.includes("wrong-input") ? 1 - fi.wrongDeck : Math.floor(rnd() * 2); fi.deadDeck = di; S.ch[di].dirt = diff >= 4 ? 3 : 2; }
    if (faults.includes("feedback")) { S.mon.dist = 0.6 + rnd() * 0.3; S.mon.ang = 6 + rnd() * 14; }
    if (faults.includes("blown-tweeter")) { fi.blownSide = rnd() < 0.5 ? "ampL" : "ampR"; S.cabBlown[S.jack[fi.blownSide]] = true; }
    const startFaults = faults.slice();

    /* ---------------- helpers: model ---------------- */
    const chIdx = jid => parseInt(jid.slice(2), 10);
    const deckCh = i => chIdx(S.jack[i === 0 ? "deckA" : "deckB"]);
    const eqDbAt = b => (S.eq[b] || 0) + 0.35 * ((S.eq[b - 1] || 0) + (S.eq[b + 1] || 0));
    const loopGain = () => FBG0 * (1 / (0.35 + S.mon.dist * 0.9)) * (0.3 + 0.7 * Math.pow(Math.cos(S.mon.ang * Math.PI / 180), 2)) * Math.pow(10, eqDbAt(S.fbBand) / 20);
    const humOn = () => S.pwr.pwrMix !== S.pwr.pwrAmp && !S.gnd;
    function problems() {
      const out = [];
      if (humOn()) out.push("ground-hum");
      S.deck.forEach((d, i) => { const ch = S.ch[deckCh(i)]; if ((d.type === "tt" && ch.input !== "phono") || (d.type === "cdj" && ch.input !== "line")) if (!out.includes("wrong-input")) out.push("wrong-input"); });
      S.deck.forEach((d, i) => { if (S.ch[deckCh(i)].dirt > 0 && !out.includes("dead-channel")) out.push("dead-channel"); });
      if (S.cabBlown[S.jack.ampL] || S.cabBlown[S.jack.ampR]) out.push("blown-tweeter");
      if (loopGain() >= 0.97) out.push("feedback");
      if (!S.mic.live) out.push("mic-muted");
      return out;
    }
    const chain = i => {
      const d = S.deck[i], ci = deckCh(i), ch = S.ch[ci], tt = d.type === "tt";
      let g = 1, thin = false, hot = false;
      if (tt) { if (ch.input !== "phono") { g = 0.13; thin = true; } } else if (ch.input !== "line") { g = 3.2; hot = true; }
      return { ci, ch, g, thin, hot };
    };

    /* ---------------- DOM ---------------- */
    const root = host.root;
    const head = host.header("sound.Check", ST.name);
    const clockEl = el("span", { cls: "sc-clock", html: "<small>DOORS IN</small>0:00" }, head);
    const main = el("div", { cls: "sc-main" }, root);
    const left = el("div", { cls: "sc-left" }, main);
    const right = el("div", { cls: "sc-right" }, main);
    const stageBox = el("div", { cls: "sc-stage" }, left);
    const scene = NK.canvas(stageBox, W, H, "sc-scene");
    scene.cv.setAttribute("aria-label", "Stage view. Tap a device to open its controls, tap a plug to move its cable.");
    const queue = NK.canvas(left, 320, 14, "sc-queue");
    const ql = el("div", { cls: "sc-qlabel" }, left); el("span", { text: "THE LINE OUTSIDE" }, ql); const qcount = el("span", { text: "0 waiting" }, ql);

    const test = el("div", { cls: "sc-test mg-panel" }, right);
    const bPA = el("button", { cls: "kbtn pa", type: "button", "aria-pressed": "false", text: "PA: MUTED" }, test);
    const bA = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: "DECK A" }, test);
    const bB = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: "DECK B" }, test);
    const bPink = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: "PINK NOISE" }, test);
    const bMic = el("button", { cls: "kbtn warn", type: "button", "aria-pressed": "true", text: "MIC LIVE" }, test);
    const bTip = el("button", { cls: "kbtn", type: "button", text: "TIP (-" + (diff >= 4 ? 5 : 3) + ")" }, test);
    const lis = el("div", { cls: "sc-listen" }, test); el("span", { text: "LISTEN" }, lis);
    const bLis = ["lr", "l", "r"].map(k => el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: k === "lr" ? "BOTH" : k === "l" ? "L ONLY" : "R ONLY", "data-k": k }, lis));

    const tabsEl = el("div", { cls: "sc-tabs", role: "tablist" }, right);
    const TABS = [["decks", "DECKS"], ["mixer", "MIXER"], ["eq", "EQ + AMP"], ["spk", "SPEAKERS"], ["mon", "MON + MIC"], ["pwr", "POWER"]];
    const tabBtns = {};
    TABS.forEach(([k, label]) => { tabBtns[k] = el("button", { cls: "sc-tab", type: "button", role: "tab", "aria-selected": "false", text: label, "data-k": k }, tabsEl); });
    const panel = el("div", { cls: "sc-panel mg-panel", role: "tabpanel" }, right);

    const info = el("div", { cls: "sc-info" }, main);
    const msg = el("div", { cls: "mg-msg", "aria-live": "polite" }, info), say = el("div", { cls: "mg-say" }, info);
    const acts = el("div", { cls: "row sc-acts" }, main);
    const bHow = el("button", { cls: "btn", type: "button", text: "?" }, acts);
    el("div", { cls: "spacer" }, acts);
    const bOpen = el("button", { cls: "btn primary", type: "button", text: "OPEN DOORS" }, acts);
    const bLeave = el("button", { cls: "btn", type: "button", text: "LEAVE" }, acts);

    /* ---------------- audio graph ---------------- */
    const AC = RP.audio.ctx && RP.audio.ctx();
    let aud = null;
    function buildAudio() {
      if (!AC) return null;
      try {
        const a = { nodes: [], loops: [null, null] };
        const track = n => { a.nodes.push(n); return n; };
        a.out = track(AC.createGain()); a.out.gain.value = 0.0001;
        const lim = track(AC.createDynamicsCompressor()); lim.threshold.value = -12; lim.knee.value = 8; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15;
        a.out.connect(lim); lim.connect(AC.destination);
        a.sum = track(AC.createGain());
        a.dk = [0, 1].map(() => {
          const input = track(AC.createGain()), drive = track(AC.createGain()), sh = track(AC.createWaveShaper()), hp = track(AC.createBiquadFilter()), shelf = track(AC.createBiquadFilter()), g = track(AC.createGain());
          const curve = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
          sh.curve = curve; hp.type = "highpass"; hp.frequency.value = 20; shelf.type = "lowshelf"; shelf.frequency.value = 220; shelf.gain.value = 0;
          input.connect(drive); drive.connect(sh); sh.connect(hp); hp.connect(shelf); shelf.connect(g); g.connect(a.sum);
          return { input, drive, hp, shelf, g };
        });
        /* pink noise injected after the channels (PA only test) */
        const nb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = nb.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
        const ns = track(AC.createBufferSource()); ns.buffer = nb; ns.loop = true; a.pinkG = track(AC.createGain()); a.pinkG.gain.value = 0; ns.connect(a.pinkG); a.pinkG.connect(a.sum); ns.start();
        a.src = [ns];
        /* hum + feedback oscillators feed the EQ input */
        a.eqIn = track(AC.createGain()); a.sum.connect(a.eqIn);
        const hum = track(AC.createOscillator()); hum.type = "sawtooth"; hum.frequency.value = 60;
        const hum2 = track(AC.createOscillator()); hum2.type = "square"; hum2.frequency.value = 120;
        const hlp = track(AC.createBiquadFilter()); hlp.type = "lowpass"; hlp.frequency.value = 420;
        a.humG = track(AC.createGain()); a.humG.gain.value = 0; const h2g = track(AC.createGain()); h2g.gain.value = 0.35;
        hum.connect(hlp); hum2.connect(h2g); h2g.connect(hlp); hlp.connect(a.humG); a.humG.connect(a.eqIn); hum.start(); hum2.start(); a.src.push(hum, hum2);
        a.fb = track(AC.createOscillator()); a.fb.type = "sine"; a.fb.frequency.value = BANDS[S.fbBand];
        const fb2 = track(AC.createOscillator()); fb2.type = "sine"; fb2.frequency.value = BANDS[S.fbBand] * 2.01;
        a.fbG = track(AC.createGain()); a.fbG.gain.value = 0; const f2g = track(AC.createGain()); f2g.gain.value = 0.25;
        a.fb.connect(a.fbG); fb2.connect(f2g); f2g.connect(a.fbG); a.fbG.connect(a.eqIn); a.fb.start(); fb2.start(); a.src.push(a.fb, fb2);
        /* graphic EQ, 10 peaking filters in series */
        let prev = a.eqIn; a.eqF = BANDS.map(f => { const b = track(AC.createBiquadFilter()); b.type = "peaking"; b.frequency.value = f; b.Q.value = 1.3; b.gain.value = 0; prev.connect(b); prev = b; return b; });
        a.sides = ["l", "r"].map((k, i) => {
          const g = track(AC.createGain()), lp = track(AC.createBiquadFilter()), pan = AC.createStereoPanner ? track(AC.createStereoPanner()) : null, solo = track(AC.createGain());
          lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 0.7;
          prev.connect(g); g.connect(lp);
          if (pan) { pan.pan.value = i === 0 ? -0.9 : 0.9; lp.connect(pan); pan.connect(solo); } else lp.connect(solo);
          solo.connect(a.out);
          return { g, lp, solo };
        });
        return a;
      } catch (e) { console.warn("sound.Check audio", e); return null; }
    }
    aud = buildAudio();
    const setP = (prm, v, tc) => { try { prm.setTargetAtTime(v, AC.currentTime, tc || 0.04); } catch (e) { /* ignore */ } };
    function startDeck(i) {
      const d = S.deck[i];
      if (d.loop || !aud) { d.loop = d.loop || { silent: true, phase: () => (performance.now() / 1000) * 2.03, stop() {} }; return; }
      try {
        d.loop = RP.audio.loop({ genre: i === 0 ? "house" : "deep house", bpm: 122, seed: 7 + i * 5, energy: 3, volume: 0.62, dest: aud.dk[i].input });
        d.loop.start();
      } catch (e) { d.loop = { silent: true, phase: () => (performance.now() / 1000) * 2.03, stop() {} }; }
    }
    function stopDeck(i) { const d = S.deck[i]; if (d.loop) { try { d.loop.stop(0.12); } catch (e) { /* ignore */ } d.loop = null; } }
    host.cleanup(() => {
      S.deck.forEach((d, i) => stopDeck(i));
      if (aud) {
        try { aud.out.gain.cancelScheduledValues(AC.currentTime); aud.out.gain.setValueAtTime(0.0001, AC.currentTime); } catch (e) { /* ignore */ }
        aud.src.forEach(s => { try { s.stop(); } catch (e) { /* ignore */ } });
        setTimeout(() => aud && aud.nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* ignore */ } }), 250);
      }
    });

    /* ---------------- live model ---------------- */
    const M = { t: 0, lvl: [0, 0], chLvl: new Array(NCH).fill(0), master: 0, ampL: 0, ampR: 0, fb: 0, bars: [Array(10).fill(0), Array(10).fill(0)], peak: Array(10).fill(0), dots: 0, gate: [1, 1], gateT: [0, 0], crackleT: 0, beat: 0, hat: 0, protect: 0 };
    const rndn = mulberry(11);
    function stepModel(dt) {
      M.t += dt;
      const live = !S.muted && !RP.audio.muted;
      /* decks */
      let beatSum = 0, hatSum = 0, nb = 0;
      S.deck.forEach((d, i) => {
        let ph = 0; if (d.loop) { try { ph = d.loop.phase(); } catch (e) { ph = M.t * 2.03; } }
        const fr = ph - Math.floor(ph), fr2 = (ph * 2 + 0.5) - Math.floor(ph * 2 + 0.5);
        const pulse = Math.exp(-5 * fr), hat = Math.exp(-7 * fr2);
        d.pulse = d.play ? pulse : 0; d.hatp = d.play ? hat : 0;
        const sig = d.play ? 0.52 + 0.4 * pulse + 0.05 * (rndn() - 0.5) : 0;
        d.sig = sig;
        const c = chain(i), ch = c.ch;
        let lvl = sig * c.g * ch.fader;
        if (ch.dirt >= 2) lvl = 0;
        else if (ch.dirt === 1) { M.gateT[i] -= dt; if (M.gateT[i] <= 0) { M.gate[i] = rndn() < 0.5 ? 0 : 1; M.gateT[i] = 0.06 + rndn() * 0.2; } lvl *= M.gate[i]; }
        M.lvl[i] = lvl; d.chLvl = lvl;
        if (d.play) { beatSum += pulse; hatSum += hat; nb++; }
      });
      M.beat = nb ? beatSum / nb : 0; M.hat = nb ? hatSum / nb : 0;
      S.ch.forEach((ch, ci) => { let v = 0; S.deck.forEach((d, i) => { if (deckCh(i) === ci) v = M.lvl[i]; }); M.chLvl[ci] += (v - M.chLvl[ci]) * Math.min(1, dt * (v > M.chLvl[ci] ? 22 : 7)); });
      const pinkL = S.pink ? 0.5 : 0;
      const rawMaster = (M.lvl[0] + M.lvl[1]) * 0.66 + pinkL;
      M.master += (rawMaster - M.master) * Math.min(1, dt * 18);
      /* feedback state */
      const lg = loopGain();
      if (S.mic.live && live) M.fb += dt * (lg > 1 ? Math.min(1.6, (lg - 1) * 1.1 + 0.18) : -(1 - lg) * 3 - 0.3); else M.fb -= dt * 3;
      M.fb = clamp(M.fb, 0, 1);
      const hum = humOn() ? 1 : 0;
      /* spectrum, per side */
      [0, 1].forEach(side => {
        const blown = S.cabBlown[S.jack[side === 0 ? "ampL" : "ampR"]];
        const bars = M.bars[side];
        for (let b = 0; b < 10; b++) {
          let v = pinkL * 0.55;
          S.deck.forEach((d, i) => {
            if (!d.play) return;
            const c = chain(i), lvl = M.lvl[i]; if (lvl <= 0) return;
            let s = SHAPE[b] * (c.thin ? THIN[b] : c.hot ? HOT[b] : 1);
            const mod = b <= 2 ? 0.55 + 0.45 * d.pulse : b >= 6 ? 0.6 + 0.4 * d.hatp : 0.8 + 0.2 * d.pulse;
            v += lvl * s * mod * 0.95;
          });
          if (hum) v += [0, 0.6, 0.34, 0.12, 0.04, 0, 0, 0, 0, 0][b];
          if (M.fb > 0.02 && b === S.fbBand) v += M.fb * 1.25;
          v *= Math.pow(10, (S.eq[b] || 0) / 20);
          if (b === S.fbBand && M.fb > 0.02) v = Math.max(v, M.fb * 1.1);
          if (blown) v *= b >= 7 ? 0.03 : b === 6 ? 0.35 : b === 5 ? 0.8 : 1;
          v = clamp(v + (v > 0.02 ? (rndn() - 0.5) * 0.04 : 0), 0, 1.15);
          bars[b] += (v - bars[b]) * Math.min(1, dt * (v > bars[b] ? 24 : 6));
          if (side === 0 || true) M.peak[b] = Math.max(M.peak[b] - dt * 0.35, Math.max(bars[b], M.bars[0][b], M.bars[1][b]));
        }
      });
      let mx = 0; M.bars[0].forEach(v => { mx = Math.max(mx, v); });
      M.ampL += ((M.master * (S.cabBlown[S.jack.ampL] ? 0.97 : 1) + M.fb * 0.7 + (hum ? 0.05 : 0)) - M.ampL) * Math.min(1, dt * 14);
      M.ampR += ((M.master * (S.cabBlown[S.jack.ampR] ? 0.97 : 1) + M.fb * 0.7 + (hum ? 0.05 : 0)) - M.ampR) * Math.min(1, dt * 14);
      M.protect = Math.max(M.protect - dt * 2, M.master > 1.3 || M.fb > 0.85 ? 1 : 0);
      M.dots += dt * 46;
      /* crackle on a dirty channel */
      S.deck.forEach((d, i) => { const ch = S.ch[deckCh(i)]; if (ch.dirt > 0 && d.play && live) { M.crackleT -= dt; if (M.crackleT <= 0) { M.crackleT = ch.dirt >= 2 ? 1.5 : 0.7; RP.sfx("crackle"); } } });
    }
    function applyAudio() {
      if (!aud) return;
      try {
        const live = !S.muted && !RP.audio.muted;
        setP(aud.out.gain, live ? 0.65 : 0.0001, 0.03);
        S.deck.forEach((d, i) => {
          const c = chain(i), k = aud.dk[i], ch = c.ch;
          let gain = c.g * ch.fader * 0.9;
          if (ch.dirt >= 2) gain = 0; else if (ch.dirt === 1) gain *= M.gate[i];
          setP(k.g.gain, gain, 0.02);
          setP(k.drive.gain, c.hot ? 3.5 : 1, 0.05);
          setP(k.hp.frequency, c.thin ? 1100 : 20, 0.05);
          setP(k.shelf.gain, c.thin ? -14 : c.hot ? 7 : 0, 0.05);
        });
        setP(aud.pinkG.gain, S.pink ? 0.2 : 0, 0.05);
        setP(aud.humG.gain, humOn() ? 0.26 : 0, 0.08);
        setP(aud.fbG.gain, M.fb > 0.01 ? Math.pow(M.fb, 1.4) * 0.2 : 0, 0.05);
        aud.fb.frequency.value = BANDS[S.fbBand] * (1 + 0.006 * Math.sin(M.t * 3));
        aud.eqF.forEach((f, i) => setP(f.gain, S.eq[i] || 0, 0.04));
        ["ampL", "ampR"].forEach((k, i) => {
          const sd = aud.sides[i], blown = S.cabBlown[S.jack[k]];
          setP(sd.lp.frequency, blown ? 1900 : 20000, 0.05);
          setP(sd.g.gain, blown ? 0.9 : 1, 0.05);
          setP(sd.solo.gain, S.listen === "lr" || S.listen === (i === 0 ? "l" : "r") ? 1 : 0.0001, 0.04);
        });
      } catch (e) { /* ignore */ }
    }

    /* ---------------- messages, hints ---------------- */
    let msgTimer = null, hintN = {}, hintsUsed = 0, finished = false;
    const setMsg = t => { msg.textContent = t; };
    const techSay = t => { say.textContent = ST.tech + ": \"" + t + "\""; };
    setMsg("The PA is not right and doors open soon. UNMUTE it, play a deck, and listen. Then follow the signal: decks, mixer, DI, EQ, amp, speakers.");
    techSay(NK.pick(TECH_START[stageId]));

    /* ---------------- stage painting ---------------- */
    const bg = NK.offscreen(W, H);
    const brick = ramp("#8a3a2a");
    function paintCab(c, x, y, w, h, spare) {
      NK.bevel(c, x, y, w, h, "#1d1a28");
      NK.speckle(c, x + 1, y + 1, w - 2, h - 2, ["#26222f", "#14111c"], rndn, 0.12);
      R(c, x + 3, y + 3, w - 6, h - 6, "#0c0a12");
      for (let j = 0; j < h - 6; j++) for (let i = 0; i < w - 6; i++) if (((i + j) & 1) === 0 && ((i >> 1) + (j >> 1)) % 2 === 0) P(c, x + 3 + i, y + 3 + j, "#171321");
      const cx = x + Math.floor(w / 2);
      if (spare) {
        const cy = y + Math.round(h * 0.62), r = Math.round(w * 0.3);
        ell(c, cx, cy, r + 1, r + 1, "#2a2638"); ell(c, cx, cy, r, r, "#15121d"); ell(c, cx, cy, r - 3, r - 3, "#3a364a"); ell(c, cx, cy, 3, 3, "#0b0910"); P(c, cx - r + 3, cy - r + 4, "#6a6480");
        R(c, cx - 7, y + 7, 14, 9, "#2a2638"); R(c, cx - 5, y + 9, 10, 5, "#0c0a12"); ell(c, cx, y + 12, 2, 2, "#8a84a0");
        R(c, x + 3, y + h - 9, 28, 6, "#e8e0c0"); txt(c, "SPARE", x + 5, y + h - 8, "#a02828", 1, 1);
      } else if (stageId === "festival") {
        const n = 5, bh = Math.floor((h - 4) / n);
        for (let k = 0; k < n; k++) {
          const yy = y + 2 + k * bh, inset = Math.round(k * 0.6);
          NK.bevel(c, x + 2 + inset, yy, w - 4 - inset * 2, bh - 1, "#24202e");
          R(c, x + 5 + inset, yy + 3, w - 10 - inset * 2, 3, "#0c0a12"); R(c, x + 5 + inset, yy + bh - 7, w - 10 - inset * 2, 3, "#0c0a12");
          ell(c, x + 14 + inset, yy + Math.floor(bh / 2), 4, 3, "#3a364a"); ell(c, x + w - 15 - inset, yy + Math.floor(bh / 2), 4, 3, "#3a364a");
          R(c, cx - 1, yy + 1, 2, bh - 3, "#4a465c");
        }
      } else {
        const cy = y + Math.round(h * 0.68), r = 17;
        ell(c, cx, cy, r + 2, r + 2, "#2c2840"); ell(c, cx, cy, r, r, "#15121d"); ell(c, cx, cy, r - 3, r - 3, "#3a364a"); ell(c, cx, cy, r - 7, r - 7, "#26223a");
        ell(c, cx, cy, 5, 5, "#0b0910"); P(c, cx - 5, cy - 11, "#7a7494"); P(c, cx - 6, cy - 10, "#7a7494"); P(c, cx - 7, cy - 8, "#5a5470");
        poly3(c, [[cx - 12, y + 8], [cx + 12, y + 8], [cx + 8, y + 26], [cx - 8, y + 26]], "#34304a");
        poly3(c, [[cx - 10, y + 10], [cx + 10, y + 10], [cx + 6, y + 24], [cx - 6, y + 24]], "#0c0a12");
        ell(c, cx, y + 17, 3, 3, "#9a94b4"); ell(c, cx, y + 17, 1, 1, "#e8e0ff");
        R(c, x + 4, y + 4, 4, 1, "#8a84a0");
      }
      R(c, x, y, 3, 3, "#8a84a0"); R(c, x + w - 3, y, 3, 3, "#8a84a0"); R(c, x, y + h - 3, 3, 3, "#8a84a0"); R(c, x + w - 3, y + h - 3, 3, 3, "#8a84a0");
    }
    function poly3(c, pts, col) { RP.u.poly(c, pts, col); }
    function paintBg() {
      const c = bg.c;
      if (stageId === "loft") {
        R(c, 0, 0, W, 120, "#2a1230");
        for (let row = 0; row < 20; row++) {
          const y = row * 6, off = (row % 2) * 7;
          for (let x = -off; x < W; x += 14) {
            const v = hN(x, row) % 5, col = [brick[1], brick[2], brick[2], brick[3], brick[1]][v];
            R(c, x + 1, y + 1, 13, 5, col); R(c, x + 1, y + 1, 13, 1, brick[3]); R(c, x + 1, y + 5, 13, 1, brick[0]);
            if (v === 3) P(c, x + 5, y + 3, brick[4]);
          }
          R(c, 0, y, W, 1, "#2e1626");
        }
        NK.dither(c, 0, 0, W, 64, "#12081e", 9, 0);
        for (let y = 0; y < 40; y++) NK.dither(c, 0, y, W, 1, "#12081e", Math.round((1 - y / 40) * 12), 0);
        /* window */
        R(c, 108, 6, 108, 58, "#1a1424"); NK.dgrad(c, 111, 9, 102, 52, ["#101a3a", "#1d2c6a", "#3a3a86", "#7a4a8a"]);
        for (let i = 0; i < 26; i++) P(c, 112 + Math.floor(rndn() * 100), 10 + Math.floor(rndn() * 28), i % 3 ? "#9aa8e0" : "#fff0c0");
        for (let i = 0; i < 14; i++) { const bx = 112 + i * 7, bh = 8 + (hN(i, 3) % 14); R(c, bx, 61 - bh, 6, bh, "#0c0a1c"); for (let k = 0; k < 3; k++) if (hN(i, k + 9) % 3 === 0) P(c, bx + 1 + (k % 2) * 3, 61 - bh + 2 + k * 4, "#ffd27a"); }
        ell(c, 196, 20, 5, 5, "#f4ecc8"); ell(c, 198, 19, 4, 4, "#1d2c6a");
        R(c, 108, 33, 108, 2, "#1a1424"); R(c, 160, 6, 2, 58, "#1a1424"); R(c, 108, 6, 108, 1, "#3a3250"); R(c, 108, 63, 108, 1, "#0c0814");
        /* flyers */
        R(c, 66, 24, 24, 30, "#e8e0c0"); R(c, 66, 24, 24, 3, "#c0302c"); txt(c, "LOFT", 69, 30, "#1d1622", 1, 1); txt(c, "SESH", 69, 36, "#1d1622", 1, 1); txt(c, "12AM", 69, 46, "#2f62b8", 1, 1);
        R(c, 232, 30, 22, 26, "#39d0ff"); txt(c, "NO", 236, 36, "#12061a", 2, 1); txt(c, "FLASH", 235, 48, "#12061a", 1, 1);
        /* floor */
        R(c, 0, 120, W, 80, "#4a2a30");
        for (let row = 0; row < 12; row++) {
          const y = 120 + row * 7;
          for (let x = -(row * 13) % 60; x < W; x += 60) { const v = hN(x, row); const col = ["#5a3a38", "#4e3032", "#623e3a", "#563638"][v % 4]; R(c, x, y, 59, 6, col); R(c, x, y, 59, 1, "#7a5048"); R(c, x, y + 6, 59, 1, "#2a1620"); R(c, x + 59, y, 1, 7, "#2a1620"); }
        }
        for (let y = 0; y < 80; y++) NK.dither(c, 0, 120 + y, W, 1, "#12081e", Math.round(y / 80 * 6), 1);
        R(c, 0, 118, W, 3, "#241420"); R(c, 0, 118, W, 1, "#4a2a36");
        /* crates under the cabs */
        [[10, 104], [264, 104]].forEach(([x, y]) => { for (let k = 0; k < 2; k++) { const xx = x + k * 24; NK.bevel(c, xx, y, 24, 14, "#2f5a96"); for (let q = 0; q < 3; q++) R(c, xx + 3 + q * 7, y + 3, 5, 7, "#14284a"); } });
      } else {
        NK.dgrad(c, 0, 0, W, 120, ["#080420", "#14083a", "#2a0e54", "#5a1a6a", "#a03a6a"]);
        for (let i = 0; i < 40; i++) P(c, Math.floor(rndn() * W), Math.floor(rndn() * 60), i % 3 ? "#8a84c0" : "#ffffff");
        /* harbor skyline + water */
        for (let i = 0; i < 26; i++) { const bx = i * 13 - 4, bh = 14 + (hN(i, 1) % 30); R(c, bx, 104 - bh, 11, bh, "#0a0620"); for (let k = 0; k < 6; k++) if (hN(i, k + 4) % 3 === 0) P(c, bx + 2 + (k % 3) * 3, 104 - bh + 3 + Math.floor(k / 3) * 5, "#ffd27a"); }
        R(c, 0, 104, W, 16, "#12082c"); for (let x = 0; x < W; x += 4) { const hh = hN(x, 2) % 3; R(c, x, 106 + (x % 3) * 3, 3, 1, hh ? "#5a3a8a" : "#a0508a"); }
        /* truss + LED wall */
        R(c, 0, 0, W, 5, "#26223a"); for (let x = 0; x < W; x += 6) { R(c, x, 0, 3, 1, "#5a5470"); R(c, x + 3, 4, 3, 1, "#0c0a14"); }
        R(c, 70, 8, 180, 56, "#0a0818"); R(c, 71, 9, 178, 54, "#120c26");
        R(c, 0, 118, W, 82, "#0c0818"); NK.dgrad(c, 0, 118, W, 82, ["#1a1030", "#0a0618", "#06040e"]);
        for (let x = 0; x < W; x += 16) R(c, x, 120, 1, 80, "#1a1232");
        R(c, 0, 118, W, 2, "#2a2048");
        /* DJ riser front */
        NK.bevel(c, 84, 116, 156, 20, "#14102a"); for (let x = 86; x < 238; x += 8) R(c, x, 120, 6, 12, x % 16 === 6 ? "#1a1640" : "#0e0a20");
        [[8, 100], [262, 100]].forEach(([x, y]) => { NK.bevel(c, x, y, 50, 16, "#1a1530"); R(c, x + 3, y + 4, 44, 2, "#ffc44d"); R(c, x + 3, y + 9, 44, 2, "#ffc44d"); });
        NK.bevel(c, 128, 184, 192, 16, "#14102a", true); R(c, 128, 184, 192, 2, "#3a3460");
        for (let x = 132; x < 316; x += 6) { R(c, x + 1, 188, 1, 9, "#06040e"); R(c, x - 1, 190 + (hN(x, 7) % 5), 5, 2, hN(x, 8) % 4 ? "#d8d0e8" : "#ff3fa4"); }
        for (let k = 0; k < 14; k++) R(c, 134 + k * 13, 187, 8, 1, ["#3fd07a", "#ffc44d", "#39d0ff"][k % 3]);
        txt(c, "FOH", 292, 177, "#a8a2c8", 1, 1);
        [[98, 148], [228, 148]].forEach(([x, y]) => { RP.u.poly(c, [[x - 12, y + 6], [x + 12, y + 6], [x + 8, y - 5], [x - 8, y - 1]], "#2a2634"); RP.u.poly(c, [[x - 9, y + 4], [x + 9, y + 4], [x + 6, y - 3], [x - 6, y - 1]], "#100e18"); ell(c, x, y + 1, 3, 2, "#3a364a"); });
      }
      /* DJ table / riser top and cloth */
      if (stageId === "loft") {
        NK.bevel(c, TABLE[0], TABLE[1], TABLE[2], 4, "#6a6480");
        R(c, TABLE[0], TABLE[1] + 4, TABLE[2], 42, "#1c1a2c");
        for (let x = TABLE[0] + 6; x < TABLE[0] + TABLE[2] - 4; x += 9) { R(c, x, TABLE[1] + 5, 1, 40, "#13111f"); R(c, x + 1, TABLE[1] + 5, 1, 38, "#2a2640"); }
        R(c, TABLE[0], TABLE[1] + 44, TABLE[2], 2, "#0a0814"); R(c, TABLE[0], TABLE[1] + 4, TABLE[2], 1, "#2a2640");
        NK.dither(c, TABLE[0] - 2, TABLE[1] + 46, TABLE[2] + 4, 10, "#0a0414", 8, 0);
        R(c, TABLE[0] + TABLE[2] - 34, TABLE[1] + 30, 30, 8, "#e8e0c0"); txt(c, "DJ", TABLE[0] + TABLE[2] - 32, TABLE[1] + 32, "#c0302c", 1, 1); txt(c, "TABLE", TABLE[0] + TABLE[2] - 24, TABLE[1] + 32, "#1d1622", 1, 1);
      } else {
        NK.bevel(c, TABLE[0], TABLE[1], TABLE[2], 5, "#3a3658");
        R(c, TABLE[0], TABLE[1] + 5, TABLE[2], 26, "#0c0a1c");
        for (let x = TABLE[0] + 3; x < TABLE[0] + TABLE[2] - 2; x += 6) R(c, x, TABLE[1] + 8, 4, 20, hN(x, 4) % 3 ? "#16123a" : "#1d1a50");
        R(c, TABLE[0], TABLE[1] + 31, TABLE[2], 1, "#5a5470");
      }
      /* rack */
      NK.bevel(c, RACK[0], RACK[1], RACK[2], RACK[3], "#2a2838");
      for (let y = RACK[1] + 4; y < RACK[1] + RACK[3] - 2; y += 9) { P(c, RACK[0] + 1, y, "#0a0814"); P(c, RACK[0] + RACK[2] - 2, y, "#0a0814"); }
      const unit = (u, col) => { NK.bevel(c, u[0], u[1], u[2], u[3], col, true); R(c, u[0] + 1, u[1] + 1, 2, 2, "#8a84a0"); R(c, u[0] + u[2] - 3, u[1] + 1, 2, 2, "#8a84a0"); R(c, u[0] + 1, u[1] + u[3] - 3, 2, 2, "#8a84a0"); R(c, u[0] + u[2] - 3, u[1] + u[3] - 3, 2, 2, "#8a84a0"); };
      unit(U_DI, "#3a4a62"); unit(U_EQ, "#34324a"); unit(U_AMP, "#2e2c40");
      txt(c, stageId === "festival" ? "STAGE BOX" : "DI BOX", U_DI[0] + 5, U_DI[1] + 4, "#c8c4e0", 1, 1);
      if (stageId === "festival") for (let k = 0; k < 6; k++) { ell(c, U_DI[0] + 20 + k * 5, U_DI[1] + 12, 1, 1, "#06040e"); P(c, U_DI[0] + 20 + k * 5, U_DI[1] + 12, k % 2 ? "#8a84a0" : "#4a465c"); }
      txt(c, "GND", U_DI[0] + 44, U_DI[1] + 4, "#8a84a8", 1, 1); txt(c, "LIFT", U_DI[0] + 44, U_DI[1] + 10, "#8a84a8", 1, 1);
      txt(c, stageId === "festival" ? "FOH MASTER EQ" : "GRAPHIC EQ", U_EQ[0] + 5, U_EQ[1] + 3, "#c8c4e0", 1, 1);
      txt(c, stageId === "festival" ? "AMP RACK" : "POWER AMP", U_AMP[0] + 5, U_AMP[1] + 3, "#c8c4e0", 1, 1);
      for (let x = U_AMP[0] + 5; x < U_AMP[0] + 46; x += 2) R(c, x, U_AMP[1] + 16, 1, 4, "#14121e");
      /* spare cab + cab bodies */
      paintCab(c, CABL[0], CABL[1], CABL[2], CABL[3], false); paintCab(c, CABR[0], CABR[1], CABR[2], CABR[3], false); paintCab(c, CABS[0], CABS[1], CABS[2], CABS[3], true);
      NK.dither(c, CABS[0] - 2, CABS[1] + CABS[3] - 3, CABS[2] + 8, 6, "#0a0414", 8, 0);
      /* outlets */
      [["outA", "A"], ["outB", "B"]].forEach(([k, l]) => { const [x, y] = OUTLET[k]; NK.bevel(c, x - 6, y - 9, 12, 18, stageId === "festival" ? "#d8a82a" : "#cfc8bc"); if (stageId === "festival") { R(c, x - 4, y - 7, 8, 4, "#12061a"); } R(c, x - 2, y - 5, 1, 3, "#1a1424"); R(c, x + 1, y - 5, 1, 3, "#1a1424"); R(c, x - 2, y + 1, 1, 3, "#1a1424"); R(c, x + 1, y + 1, 1, 3, "#1a1424"); txt(c, l, x - 1, y + 5, "#2a2438", 1, 1); });
    }
    function mixerLayout() {
      const sw = Math.floor(50 / NCH), x0 = MIX[0] + 3;
      const jx = i => x0 + i * sw + Math.floor(sw / 2);
      for (let i = 0; i < 4; i++) JACK["ch" + i] = [i < NCH ? jx(i) : -20, MIX[1] - 1];
      return { sw, x0 };
    }
    const MXL = mixerLayout();
    paintBg();

    /* ---------------- dynamic painting ---------------- */
    const ledCol = (i, n) => i / n < 0.6 ? "#3fd07a" : i / n < 0.85 ? "#ffc44d" : "#ff4a5a";
    function ladder(c, x, y, n, lvl, vertical, sz, gap) {
      const on = Math.round(clamp(lvl, 0, 1.2) / 1.0 * n);
      for (let i = 0; i < n; i++) {
        const lit = i < on, col = lit ? ledCol(i, n) : "#1d1830";
        if (vertical) R(c, x, y - i * (sz + gap), 3, sz, col); else R(c, x + i * (sz + gap), y, sz, 3, col);
      }
    }
    const held = { id: null, mx: 0, my: 0 };
    const cableEnd = id => held.id === id ? [held.mx, held.my] : JACK[S.jack[id] || S.pwr[id]];
    function cablePts(id) {
      const cb = CABLES[id], e = cableEnd(id), f = cb.from;
      return bez(f[0], f[1], (f[0] + e[0]) / 2, Math.max(f[1], e[1]) + cb.sag * 1.6, e[0], e[1]);
    }
    function paintCable(c, pts, cols, thick) {
      if (cols.length === 2) { NK.stroke(c, pts, cols[0], 1); NK.stroke(c, pts.map(q => [q[0], q[1] + 1]), cols[1], 1); }
      else { NK.stroke(c, pts, cols[0], thick || 1); if (thick > 1) NK.stroke(c, pts.map(q => [q[0], q[1] - 1]), "#ffffff22", 1); }
    }
    function plug(c, x, y, col) { R(c, x - 3, y - 2, 6, 5, "#b8b4cc"); R(c, x - 3, y - 2, 6, 1, "#efeaff"); R(c, x - 3, y + 2, 6, 1, "#5a5470"); R(c, x - 1, y - 4, 2, 2, col || "#ffb04a"); }
    function jackSock(c, x, y, state) {
      R(c, x - 3, y - 3, 7, 7, "#0a0814"); R(c, x - 2, y - 2, 5, 5, "#3a3650"); R(c, x - 1, y - 1, 3, 3, "#0a0814");
      if (state === "target") { const on = reduced || Math.floor(M.t * 4) % 2 === 0; if (on) { R(c, x - 5, y - 5, 11, 1, "#ffc44d"); R(c, x - 5, y + 5, 11, 1, "#ffc44d"); R(c, x - 5, y - 5, 1, 11, "#ffc44d"); R(c, x + 5, y - 5, 1, 11, "#ffc44d"); } }
    }
    const floaters = [];
    function burst(x, y, col) { for (let i = 0; i < 12; i++) floaters.push({ x, y, vx: (rndn() - 0.5) * 60, vy: -20 - rndn() * 40, life: 0.8 + rndn() * 0.4, col }); }
    let sel = "decks";
    const hot = [];
    function rebuildHot() {
      hot.length = 0;
      DECK.forEach(r => hot.push({ tab: "decks", r }));
      hot.push({ tab: "mixer", r: MIX });
      hot.push({ tab: "eq", r: RACK });
      hot.push({ tab: "spk", r: CABL }); hot.push({ tab: "spk", r: CABR }); hot.push({ tab: "spk", r: CABS });
      hot.push({ tab: "mon", r: [monX() - 16, wy0 - 12, 36, 24] }); hot.push({ tab: "mon", r: [MIC[0] - 14, MIC[1] - 4, 28, 70] });
      hot.push({ tab: "pwr", r: [OUTLET.outA[0] - 8, OUTLET.outA[1] - 10, 16, 22] }); hot.push({ tab: "pwr", r: [OUTLET.outB[0] - 8, OUTLET.outB[1] - 10, 16, 22] });
    }
    const wy0 = 172;
    const monX = () => MIC[0] - 20 - S.mon.dist * 20;
    function drawFrame(t, dt) {
      const c = scene.c;
      c.drawImage(bg.cv, 0, 0);
      const live = !S.muted && !RP.audio.muted;
      const mv = reduced ? 0 : 1;
      /* ambience: string lights / lasers */
      if (stageId === "loft") {
        const pts = NK.sag(0, 4, W, 4, 18, 40);
        NK.stroke(c, pts, "#14101c", 1);
        for (let i = 0; i <= 18; i++) { const q = NK.along(pts, (i / 18) * plen(pts)), tw = reduced ? 1 : (Math.sin(t * 2 + i * 1.7) * 0.5 + 0.5), cols = ["#ffd27a", "#ff8fcf", "#9be15d", "#7ad8ff"]; const col = cols[i % 4]; R(c, q[0] - 1, q[1] + 1, 3, 3, col); if (tw > 0.45) NK.glow(c, Math.round(q[0]), Math.round(q[1] + 2), 4, col, 0.35); }
        /* fan */
        const fx = 296, fy = 158;
        R(c, fx - 1, fy + 10, 3, 28, "#5a5470"); R(c, fx - 8, fy + 36, 17, 3, "#3a364a"); ell(c, fx, fy, 13, 13, "#6a6488"); ell(c, fx, fy, 12, 12, "#1a1626"); for (let a2 = 0; a2 < 6.28; a2 += 0.5) P(c, fx + Math.cos(a2) * 12, fy + Math.sin(a2) * 12, "#a8a2c8");
        const ang = reduced ? 0.4 : t * 9;
        for (let b = 0; b < 3; b++) { const a = ang + b * 2.094; line(c, fx, fy, fx + Math.cos(a) * 10, fy + Math.sin(a) * 10, "#d8d0e8"); line(c, fx + 1, fy, fx + 1 + Math.cos(a) * 9, fy + Math.sin(a) * 9, "#8a84a8"); line(c, fx - 1, fy, fx - 1 + Math.cos(a + 0.2) * 8, fy + Math.sin(a + 0.2) * 8, "#6a6488"); }
        ell(c, fx, fy, 2, 2, "#ffc44d");
      } else {
        for (let k = 0; k < 6; k++) { const bx = 40 + k * 48; R(c, bx - 3, 5, 6, 4, "#3a3658"); R(c, bx - 1, 9, 2, 2, "#ffffff"); }
        if (!reduced) for (let k = 0; k < 6; k++) { const bx = 40 + k * 48, sw = Math.sin(t * 0.8 + k) * 40, cols = ["#ff3fa4", "#39d0ff", "#9be15d", "#ffc44d", "#a080ff", "#ff3fa4"]; c.fillStyle = cols[k]; for (let j = 0; j < 46; j++) { const xx = bx + sw * (j / 46), yy = 10 + j * 1.9; if (bayer(Math.round(xx), Math.round(yy)) < 3) c.fillRect(Math.round(xx), Math.round(yy), 1, 1); } }
        /* LED wall */
        for (let y = 0; y < 13; y++) for (let x = 0; x < 44; x++) { const v = reduced ? 0.4 : Math.sin(x * 0.4 + t * 1.6) + Math.cos(y * 0.5 - t * 1.1); const k = (v + 2) / 4; c.fillStyle = k > 0.75 ? "#ff3fa4" : k > 0.5 ? "#7a3fd0" : k > 0.3 ? "#2a1a6a" : "#150d3a"; c.fillRect(72 + x * 4, 11 + y * 4, 3, 3); }
        txtC(c, "HARBOR LIGHTS", 160, 28, "#ffffff", 2, 1);
      }
      /* cabs: woofer pump */
      const pumps = [["ampL", CABL], ["ampR", CABR]];
      pumps.forEach(([k, r]) => {
        const jid = S.jack[k], cab = jid === "cabA" ? CABL : jid === "cabB" ? CABR : CABS, lvl = live ? (k === "ampL" ? M.ampL : M.ampR) : 0;
        if (cab === CABS) { const cx = CABS[0] + 17, cy = CABS[1] + Math.round(CABS[3] * 0.62); ell(c, cx, cy, 3 + Math.round(lvl * 2), 3 + Math.round(lvl * 2), lvl > 0.1 ? "#8a84a8" : "#3a364a"); }
        else if (stageId === "loft") { const cx = cab[0] + 25, cy = cab[1] + Math.round(cab[3] * 0.68), rr = 6 + Math.round(clamp(lvl, 0, 1) * 4 * mv); ell(c, cx, cy, rr, rr, "#4a4668"); ell(c, cx, cy, Math.max(2, rr - 3), Math.max(2, rr - 3), "#2a2640"); ell(c, cx, cy, 3, 3, "#0b0910"); if (lvl > 0.5) NK.glow(c, cx, cy, 20, "#ff3fa4", 0.14); }
        else if (lvl > 0.15) R(c, cab[0] + 24, cab[1] + 3, 2, cab[3] - 6, "#6a6490");
      });
      /* table clutter + decks */
      DECK.forEach((r, i) => {
        const d = S.deck[i], [x, y, w, h] = r;
        if (d.type === "tt") {
          NK.bevel(c, x, y, w, h, "#2a2834"); const cx = x + 15, cy = y + 11;
          ell(c, cx, cy, 14, 8, "#0b0a12"); ell(c, cx, cy, 13, 7, "#17151f");
          ell(c, cx, cy, 5, 3, ["#ff3fa4", "#39d0ff"][i]);
          const a = reduced ? 0.5 : (d.play ? t * 3.4 : 0.5);
          R(c, Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 5), 2, 1, "#efeaff");
          line(c, x + 32, y + 3, x + 24, y + 11, "#b8b4cc"); R(c, x + 31, y + 2, 3, 3, "#8a84a0");
          R(c, x + 3, y + h - 4, 4, 2, "#5a5470"); R(c, x + 32, y + 8, 3, 10, "#0a0814"); R(c, x + 32, y + 8 + Math.round((1 - 0.5) * 7), 3, 2, "#d8d0e8");
        } else {
          NK.bevel(c, x, y, w, h, "#2a2c3c", true);
          const cx = x + 17, cy = y + 11;
          ell(c, cx, cy, 11, 7, "#0b0a14"); ell(c, cx, cy, 10, 6, "#1a1a2a"); ell(c, cx, cy, 3, 2, d.play ? ["#ff3fa4", "#39d0ff"][i] : "#4a4a60");
          if (d.play && !reduced) { const a = t * 4; R(c, Math.round(cx + Math.cos(a) * 8), Math.round(cy + Math.sin(a) * 4), 2, 1, "#efeaff"); }
          R(c, x + 30, y + 4, 6, 14, "#0e0e18"); R(c, x + 31, y + 5 + Math.round(clamp(d.sig || 0, 0, 1) * 0), 4, 2, d.play ? "#39d0ff" : "#3a3a50");
          R(c, x + 3, y + 3, 14, 2, "#0e0e18"); if (d.play) { R(c, x + 4, y + 3, 4 + Math.round(((t * 0.08) % 1) * 9), 1, "#9be15d"); }
        }
        txt(c, "DECK " + d.id, x + 1, y - 6, "#a8a2c8", 1, 1);
        /* deck signal LED */
        const on = d.play && d.sig > 0.1; R(c, x + (i === 0 ? w - 7 : 3), y + h - 4, 4, 2, on ? "#9be15d" : "#2a3a30");
      });
      /* mixer */
      NK.bevel(c, MIX[0], MIX[1], MIX[2], MIX[3], "#3a3a4c", true);
      R(c, MIX[0] + 1, MIX[1] + 1, MIX[2] - 2, 3, "#14121e");
      for (let i = 0; i < NCH; i++) {
        const x = MXL.x0 + i * MXL.sw, sw = MXL.sw, ch = S.ch[i], lv = M.chLvl[i];
        R(c, x, MIX[1] + 6, sw - 1, MIX[3] - 8, "#272636"); R(c, x, MIX[1] + 6, sw - 1, 1, "#3a3850");
        R(c, x + 1, MIX[1] + 7, 4, 1, ch.input === "phono" ? "#ffc44d" : "#39d0ff");
        ladder(c, x + 2, MIX[1] + 25, 9, lv, true, 1, 1);
        R(c, x + 2, MIX[1] + 9, 3, 1, lv > 1.02 ? "#ff4a5a" : "#3a1a22");
        const kx = x + sw - 9; R(c, kx, MIX[1] + 9, 3, 3, "#8a84a8"); R(c, kx + 1, MIX[1] + 9, 1, 1, "#efeaff"); R(c, kx, MIX[1] + 14, 3, 3, "#8a84a8"); R(c, kx + 1, MIX[1] + 14, 1, 1, "#efeaff");
        const fy = MIX[1] + 19 + Math.round((1 - ch.fader) * 6); R(c, x + sw - 5, MIX[1] + 18, 1, 9, "#0a0814"); R(c, x + sw - 7, fy, 5, 2, "#d8d0e8");
      }
      const mx = MIX[0] + MIX[2] - 12; R(c, mx - 1, MIX[1] + 6, 11, MIX[3] - 8, "#1d1c2a"); ladder(c, mx + 1, MIX[1] + 27, 9, M.master, true, 1, 1); ladder(c, mx + 6, MIX[1] + 27, 9, M.master, true, 1, 1);
      txt(c, "MIXER", MIX[0] + 2, MIX[1] - 8, "#a8a2c8", 1, 1);
      /* rack: DI */
      const gx = U_DI[0] + 66, gy = U_DI[1] + 4;
      R(c, gx, gy, 7, 8, "#0a0814"); R(c, gx + 2, S.gnd ? gy + 5 : gy, 3, 3, S.gnd ? "#ffc44d" : "#d8d0e8"); R(c, gx + 2, S.gnd ? gy + 6 : gy + 1, 3, 1, "#14121e");
      R(c, U_DI[0] + 6, U_DI[1] + 11, 3, 2, M.master > 0.05 ? "#3fd07a" : "#2a3a30"); R(c, U_DI[0] + 11, U_DI[1] + 11, 3, 2, S.gnd ? "#ffc44d" : "#3a3020");
      /* rack: EQ + RTA */
      const rx = U_EQ[0] + 5, ry = U_EQ[1] + 10;
      R(c, rx - 1, ry - 1, 72, 12, "#06040e");
      const side = S.listen === "l" ? [M.bars[0]] : S.listen === "r" ? [M.bars[1]] : [M.bars[0], M.bars[1]];
      for (let b = 0; b < 10; b++) {
        let v = 0; side.forEach(a => { v = Math.max(v, a[b]); });
        const hh = Math.round(clamp(v, 0, 1.1) * 10);
        for (let k = 0; k < hh; k++) R(c, rx + b * 7, ry + 9 - k, 5, 1, k < 6 ? "#3fd07a" : k < 8 ? "#ffc44d" : "#ff4a5a");
        const pk = Math.round(clamp(M.peak[b], 0, 1.1) * 10); if (pk > 0) R(c, rx + b * 7, ry + 9 - pk, 5, 1, "#efeaff");
        const sy = U_EQ[1] + 23 - Math.round((S.eq[b] || 0) / 12 * 3); R(c, rx + b * 7 + 2, U_EQ[1] + 21, 1, 6, "#0a0814"); R(c, rx + b * 7, sy, 5, 2, b === S.fbBand && M.fb > 0.1 ? "#ff8a9a" : "#d8d0e8");
      }
      /* rack: amp */
      ladder(c, U_AMP[0] + 52, U_AMP[1] + 18, 12, live ? M.ampL : 0, false, 2, 1); ladder(c, U_AMP[0] + 52, U_AMP[1] + 13, 12, live ? M.ampR : 0, false, 2, 1);
      R(c, U_AMP[0] + 50, U_AMP[1] + 5, 4, 3, M.protect > 0.1 ? "#ff4a5a" : "#3a1a22"); R(c, U_AMP[0] + 56, U_AMP[1] + 5, 4, 3, live ? "#3fd07a" : "#2a3a30");
      /* mic + monitor */
      const mxp = MIC[0], myp = MIC[1];
      R(c, mxp - 1, myp + 8, 3, 56, "#4a465c"); R(c, mxp - 9, myp + 64, 19, 3, "#2a2638"); line(c, mxp, myp + 8, mxp - 8, myp, "#4a465c");
      ell(c, mxp - 10, myp - 1, 3, 3, S.mic.live ? "#d8d0e8" : "#6a6480"); ell(c, mxp - 10, myp - 1, 1, 1, S.mic.live ? "#ff4a5a" : "#2a2638");
      const wx = Math.round(monX()), wy = 172;
      NK.dither(c, wx - 15, wy + 4, 32, 4, "#0a0414", 8, 0);
      RP.u.poly(c, [[wx - 14, wy + 4], [wx + 14, wy + 4], [wx + 10, wy - 8], [wx - 10, wy - 2]], "#2a2634"); RP.u.poly(c, [[wx - 11, wy + 2], [wx + 11, wy + 2], [wx + 8, wy - 6], [wx - 8, wy - 2]], "#14121c");
      ell(c, wx, wy - 1, 3, 2, "#4a465c"); R(c, wx - 14, wy + 3, 28, 1, "#5a5470");
      /* sound cone */
      const toM = Math.atan2((myp - 1) - (wy - 6), (mxp - 10) - wx), ca = toM - S.mon.ang * Math.PI / 180;
      c.fillStyle = M.fb > 0.15 ? "#ff6a7a" : "#8a84c8";
      for (let k = 0; k < 3; k++) for (let j = 6; j < 46; j += 3) { const a = ca + (k - 1) * 0.2; const xx = Math.round(wx + Math.cos(a) * j), yy = Math.round(wy - 6 + Math.sin(a) * j); if (bayer(xx, yy) < 7 - j / 8 && xx > 0 && xx < W && yy > 120) c.fillRect(xx, yy, 1, 1); }
      txt(c, "MON", wx - 5, wy + 7, "#a8a2c8", 1, 1);
      /* cables */
      Object.keys(CABLES).forEach(id => {
        const cb = CABLES[id], pts = cablePts(id), L = plen(pts);
        paintCable(c, pts, cb.cols, cb.thick);
        let flow = 0;
        if (id === "deckA") flow = S.deck[0].play ? S.deck[0].sig : 0; if (id === "deckB") flow = S.deck[1].play ? S.deck[1].sig : 0;
        if (id === "ampL") flow = M.ampL * (live ? 1 : 0.4); if (id === "ampR") flow = M.ampR * (live ? 1 : 0.4);
        if (flow > 0.08) for (let k = 0; k < Math.max(2, Math.round(L / 14)); k++) { const q = along(pts, ((k * 14 + (reduced ? 0 : M.dots)) % L)); R(c, q[0] - 1, q[1] - 1, 2, 2, id.startsWith("deck") ? "#ff9ad0" : "#d8ffa0"); }
      });
      /* fixed cables: mixer -> DI -> EQ -> AMP */
      const fx = [[[MIX[0] + 25, MIX[1] + MIX[3]], [U_DI[0] + U_DI[2], U_DI[1] + 6], "#8a7ae0", 14], [[U_DI[0] + U_DI[2], U_DI[1] + 12], [U_EQ[0] + U_EQ[2], U_EQ[1] + 7], "#39d0ff", 0], [[U_EQ[0] + U_EQ[2], U_EQ[1] + 23], [U_AMP[0] + U_AMP[2], U_AMP[1] + 4], "#39d0ff", 0]];
      fx.forEach(([a, b, col, sg], k) => {
        const pts = k === 0 ? bez(a[0], a[1], (a[0] + b[0]) / 2, b[1] + 10 + sg, b[0] + 2, b[1]) : bez(a[0], a[1], a[0] + 10, (a[1] + b[1]) / 2, b[0], b[1]);
        NK.stroke(c, pts, col, 1); R(c, b[0] - 2, b[1] - 1, 3, 3, "#b8b4cc"); R(c, a[0] - 2, a[1] - 1, 3, 3, "#b8b4cc");
        if (M.master > 0.08 && k < 3) { const L = plen(pts); for (let q = 0; q < Math.max(2, Math.round(L / 14)); q++) { const pp = along(pts, (q * 14 + (reduced ? 0 : M.dots)) % L); R(c, pp[0] - 1, pp[1] - 1, 2, 2, "#c8f0ff"); } }
      });
      /* jacks */
      const targets = held.id ? CABLES[held.id].opts : [];
      Object.keys(JACK).forEach(j => { const [x, y] = JACK[j]; if (x < 0) return; jackSock(c, x, y, targets.includes(j) ? "target" : ""); });
      /* ends: plugs */
      Object.keys(CABLES).forEach(id => { const e = cableEnd(id); plug(c, Math.round(e[0]), Math.round(e[1]), CABLES[id].cols[0]); });
      Object.keys(CABLES).forEach(id => { const f = CABLES[id].from; R(c, f[0] - 2, f[1] - 1, 4, 3, "#b8b4cc"); });
      /* selection outline */
      const outl = { decks: DECK, mixer: [MIX], eq: [RACK], spk: [CABL, CABR, CABS], mon: [[monX() - 16, wy0 - 12, 34, 24], [MIC[0] - 14, MIC[1] - 4, 28, 70]], pwr: [[OUTLET.outA[0] - 8, OUTLET.outA[1] - 10, 16, 22], [OUTLET.outB[0] - 8, OUTLET.outB[1] - 10, 16, 22]] }[sel];
      if (outl) { const on = reduced || Math.floor(t * 2) % 2 === 0; if (on) outl.forEach(r => { const [x, y, w, h] = r.map(Math.round); R(c, x - 1, y - 1, w + 2, 1, "#ff3fa4"); R(c, x - 1, y + h, w + 2, 1, "#ff3fa4"); R(c, x - 1, y - 1, 1, h + 2, "#ff3fa4"); R(c, x + w, y - 1, 1, h + 2, "#ff3fa4"); }); }
      /* floaters */
      for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 90 * dt; if (f.life <= 0) { floaters.splice(i, 1); continue; } R(c, f.x, f.y, 2, 2, f.col); }
      /* dim everything a touch when the doors are open / over */
    }
    function drawQueue(frac) {
      const c = queue.c; R(c, 0, 0, 320, 14, "#07050f");
      R(c, 0, 12, 320, 2, "#1d1440"); R(c, 306, 2, 8, 12, "#2a2048"); R(c, 308, 4, 4, 8, "#ffc44d");
      const n = Math.round(frac * 48), rq = mulberry(5);
      for (let i = 0; i < n; i++) { const x = 296 - i * 6 - (i % 2) * 1, h = 6 + Math.floor(rq() * 4), cols = ["#ff3fa4", "#39d0ff", "#ffc44d", "#9be15d", "#a080ff", "#efeaf6"]; const col = cols[Math.floor(rq() * 6)]; if (x < 2) break; R(c, x, 12 - h, 4, h - 3, col); R(c, x + 1, 12 - h - 2, 2, 2, "#e0a27a"); }
      qcount.textContent = n + " waiting";
    }

    /* ---------------- controls / panels ---------------- */
    const synced = [];
    function seg(parent, label, buttons, onPick, getVal, cls) {
      const row = el("div", { cls: "sc-seg" }, parent); el("span", { text: label }, row);
      const bs = buttons.map(([val, text, extra]) => {
        const b = el("button", { type: "button", "aria-pressed": "false", text, cls: cls || "" }, row);
        if (extra) b.title = extra;
        b.addEventListener("click", () => onPick(val));
        return [val, b];
      });
      synced.push(() => bs.forEach(([val, b]) => b.setAttribute("aria-pressed", String(getVal() === val))));
      return row;
    }
    const jackList = id => CABLES[id].opts.filter(j => JACK[j][0] >= 0 && (CABLES[id].fam !== "in" || chIdx(j) < NCH));
    function doPlug(id, jid) {
      const cb = CABLES[id];
      if (cb.fam === "pwr") {
        if (S.pwr[id] === jid) return;
        S.pwr[id] = jid; RP.sfx("unlock");
        setMsg(cb.label + " is now on " + JNAME[jid] + ".");
      } else {
        const cur = S.jack[id]; if (cur === jid) return;
        const other = Object.keys(S.jack).find(k => k !== id && CABLES[k].fam === cb.fam && S.jack[k] === jid);
        if (other) S.jack[other] = cur;
        S.jack[id] = jid; RP.sfx("unlock");
        setMsg(cb.label + " is now plugged into " + JNAME[jid] + (other ? " (swapped with " + CABLES[other].label + ")" : "") + ".");
        if (cb.fam === "in") { const ci = chIdx(jid); const di = id === "deckA" ? 0 : 1; const d = S.deck[di], ch = S.ch[ci]; if ((d.type === "tt" && ch.input !== "phono") || (d.type === "cdj" && ch.input !== "line")) techSay(d.type === "tt" ? "Turntable on a LINE channel? Check that input switch." : "CDJs are line level. Check that input switch."); }
      }
      checkFixes(); syncAll();
    }
    const known = new Set(problems());
    function checkFixes() {
      const now = problems();
      startFaults.forEach(f => { if (!now.includes(f) && known.has(f)) { known.delete(f); RP.sfx("success"); const pos = { "ground-hum": [60, 150], "dead-channel": [160, 80], "feedback": [MIC[0] - 20, 150], "blown-tweeter": [160, 150], "wrong-input": [160, 76] }[f]; burst(pos[0], pos[1], "#9be15d"); techSay(fixLine(f)); hintN[f] = 0; } });
      now.forEach(f => { if (!known.has(f) && FAULTS.includes(f)) known.add(f); });
      if (startFaults.every(f => !now.includes(f)) && !now.length) setMsg("The system sounds clean. Check each deck once more, then OPEN DOORS.");
    }
    const FIXL = {
      "ground-hum": ["The hum is gone. That was two circuits fighting.", "Quiet. Real quiet. I like that."],
      "dead-channel": ["There it is. Signal on that strip.", "Dead channel? Not anymore."],
      "feedback": ["No more howl. Mic's alive and nothing rings.", "That monitor was singing to the mic. Rude."],
      "blown-tweeter": ["That spare cab has all its highs. Beautiful.", "Throw the blown one in the van. We never speak of it."],
      "wrong-input": ["Proper input. Now it has some body.", "That's what a record is supposed to sound like."]
    };
    const fixLine = f => NK.pick(FIXL[f]);
    function togglePlay(i) {
      const d = S.deck[i]; d.play = !d.play;
      if (d.play) startDeck(i); else stopDeck(i);
      RP.sfx("click");
      if (d.play && S.muted) setMsg("Deck " + d.id + " is playing, but the PA is muted. Hit PA: MUTED to hear it.");
      syncAll();
    }
    bPA.addEventListener("click", () => {
      S.muted = !S.muted; RP.sfx(S.muted ? "click" : "blip");
      if (!S.muted) { setMsg("The PA is live. Play a deck or pink noise and listen to both sides."); if (faults.includes("feedback") && S.mic.live) techSay("Careful, the mic is hot."); }
      syncAll();
    });
    bA.addEventListener("click", () => togglePlay(0)); bB.addEventListener("click", () => togglePlay(1));
    bPink.addEventListener("click", () => { S.pink = !S.pink; RP.sfx("click"); if (S.pink) setMsg("Pink noise goes in after the channels: it tests the amp and speakers on their own, skipping the decks and the mixer strips."); syncAll(); });
    bMic.addEventListener("click", () => { S.mic.live = !S.mic.live; RP.sfx("click"); if (!S.mic.live) setMsg("Mic muted. Fine for testing, but the MC needs it live at doors."); syncAll(); });
    bLis.forEach(b => b.addEventListener("click", () => { S.listen = b.getAttribute("data-k"); RP.sfx("click"); syncAll(); }));
    bTip.addEventListener("click", () => {
      const now = problems().filter(f => FAULTS.includes(f));
      const f = startFaults.find(x => now.includes(x)) || now[0];
      if (!f) { techSay("Honestly? I can't hear anything wrong. Go open the doors."); return; }
      const n = Math.min(2, hintN[f] || 0); hintN[f] = n + 1; hintsUsed++;
      techSay(HINTS[f][n]); RP.sfx("ping"); S.tipTimes = (S.tipTimes || 0) + 1;
    });
    bHow.addEventListener("click", () => { setMsg("Listen first. Mute the PA when it hurts. Tap a device (or a tab) to open its controls; tap a plug on a cable, then a glowing socket, to re-patch. The analyzer bars are 10 EQ bands. TIPS cost points."); });

    function tabSelect(k) {
      sel = k;
      TABS.forEach(([key]) => tabBtns[key].setAttribute("aria-selected", String(key === k)));
      buildPanel(k);
    }
    TABS.forEach(([k]) => tabBtns[k].addEventListener("click", () => { RP.sfx("blip"); tabSelect(k); }));
    tabsEl.addEventListener("keydown", e => {
      const ks = TABS.map(t => t[0]), i = ks.indexOf(sel);
      if (e.key === "ArrowRight") { tabSelect(ks[(i + 1) % ks.length]); tabBtns[sel].focus(); e.preventDefault(); }
      if (e.key === "ArrowLeft") { tabSelect(ks[(i + ks.length - 1) % ks.length]); tabBtns[sel].focus(); e.preventDefault(); }
    });

    let rtaP = null;
    function drawRTA(c, w, h) {
      R(c, 0, 0, w, h, "#07050f");
      const bw = Math.floor(w / 10);
      for (let y = 0; y < h; y += 6) R(c, 0, y, w, 1, "#120e26");
      const side = S.listen === "l" ? [M.bars[0]] : S.listen === "r" ? [M.bars[1]] : [M.bars[0], M.bars[1]];
      for (let b = 0; b < 10; b++) {
        let v = 0; side.forEach(a => { v = Math.max(v, a[b]); });
        const hh = Math.round(clamp(v, 0, 1.15) * (h - 10)), x = b * bw + 2;
        for (let k = 0; k < hh; k += 2) R(c, x, h - 8 - k, bw - 4, 1, k < (h - 10) * 0.6 ? "#3fd07a" : k < (h - 10) * 0.85 ? "#ffc44d" : "#ff4a5a");
        const pk = Math.round(clamp(M.peak[b], 0, 1.15) * (h - 10)); if (pk > 1) R(c, x, h - 8 - pk, bw - 4, 1, "#efeaff");
        txtC(c, BLAB[b], x + (bw - 4) / 2, h - 6, b === 1 && humOn() && v > 0.2 ? "#ff8a9a" : "#6a64a0", 1, 1);
      }
    }
    let panelSync = [];
    function buildPanel(k) {
      panel.textContent = ""; synced.length = 0; panelSync = []; rtaP = null;
      const B = {
        decks() {
          el("h3", { text: "DECKS" }, panel);
          el("p", { text: "Each deck cable goes into one mixer channel. Turntables put out a tiny phono signal; CDJs put out hot line level." }, panel);
          S.deck.forEach((d, i) => {
            const id = i === 0 ? "deckA" : "deckB", card = el("div", { cls: "sc-card" }, panel);
            const t = el("div", { cls: "t" }, card); el("span", { text: "DECK " + d.id + ": " + d.name }, t); el("small", { text: d.type === "tt" ? "turntable, phono level" : "digital deck, line level" }, t);
            const row = el("div", { cls: "row" }, card);
            const pb = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: "PLAY" }, row); pb.addEventListener("click", () => togglePlay(i));
            synced.push(() => { pb.setAttribute("aria-pressed", String(d.play)); pb.textContent = d.play ? "STOP" : "PLAY"; });
            seg(card, "OUT CABLE", jackList(id).map(j => [j, JNAME[j]]), jid => doPlug(id, jid), () => S.jack[id]);
          });
        },
        mixer() {
          el("h3", { text: "MIXER: " + mixName }, panel);
          el("p", { text: "Set each channel to the input that matches its deck. Watch the ladders to see where the signal dies." }, panel);
          const wrap = el("div", { cls: "sc-strips" }, panel); wrap.style.gridTemplateColumns = "repeat(" + NCH + ", minmax(0, 1fr))";
          S.ch.forEach((ch, i) => {
            const card = el("div", { cls: "sc-strip" }, wrap);
            const feeds = S.deck.findIndex((d, di) => deckCh(di) === i);
            const t = el("div", { cls: "t" }, card); el("span", { text: "CH" + (i + 1) }, t); const sm = el("small", { text: "" }, t);
            const lad = el("div", { cls: "sc-ladder" }, card); const cells = []; for (let n = 0; n < 10; n++) cells.push(el("i", {}, lad));
            const sg = el("div", { cls: "sc-seg" }, card);
            const bp = el("button", { type: "button", "aria-pressed": "false", text: "PHONO", cls: "on-pink" }, sg), bl = el("button", { type: "button", "aria-pressed": "false", text: "LINE" }, sg);
            bp.addEventListener("click", () => { ch.input = "phono"; RP.sfx("blip"); checkFixes(); syncAll(); }); bl.addEventListener("click", () => { ch.input = "line"; RP.sfx("blip"); checkFixes(); syncAll(); });
            const fd = el("div", { cls: "sc-fader" }, card); el("span", { text: stageId === "festival" ? "GAIN" : "FADER" }, fd);
            const inp = el("input", { type: "range", min: "0", max: "100", step: "1", value: String(Math.round(ch.fader * 100)), "aria-label": "Channel " + (i + 1) + " fader" }, fd);
            inp.addEventListener("input", () => {
              const v = parseInt(inp.value, 10) / 100; ch.fader = v;
              if (ch.dirt > 0) { const zone = v < 0.12 ? "lo" : v > 0.88 ? "hi" : null; if (zone && zone !== ch.last) { if (ch.last) { ch.sw++; RP.sfx("scratch"); if (ch.sw % 2 === 0) { ch.dirt--; if (ch.dirt === 0) { checkFixes(); setMsg("CH" + (i + 1) + " is clean."); } else setMsg("It is crackling less. Keep scrubbing CH" + (i + 1) + "."); } } ch.last = zone; } }
              syncAll(true);
            });
            const sp = el("button", { cls: "kbtn", type: "button", text: "SPRAY CLEANER" }, card); sp.style.fontSize = "16px";
            sp.addEventListener("click", () => { RP.sfx("spray"); if (ch.dirt > 0) { ch.dirt = Math.max(0, ch.dirt - 1); setMsg(ch.dirt ? "Sprayed CH" + (i + 1) + ". Now scrub the fader end to end." : "CH" + (i + 1) + " is clean."); if (!ch.dirt) checkFixes(); } else setMsg("CH" + (i + 1) + " smells like a hardware store now. Nothing was dirty."); syncAll(); });
            panelSync.push(() => {
              const dk = S.deck[feeds]; sm.textContent = feeds >= 0 ? "from deck " + dk.id : "free";
              bp.setAttribute("aria-pressed", String(ch.input === "phono")); bl.setAttribute("aria-pressed", String(ch.input === "line"));
              const lv = M.chLvl[i], on = Math.round(clamp(lv, 0, 1.2) * 10); cells.forEach((cl, n) => { cl.className = n < on ? (n < 6 ? "g" : n < 8 ? "a" : "r") : ""; });
            });
          });
          const mrow = el("div", { cls: "sc-card" }, panel);
          el("div", { cls: "t" }, mrow).innerHTML = "<span>MASTER OUT</span><small>into the DI box, EQ, amp</small>";
          const ml = el("div", { cls: "sc-ladder" }, mrow); const mcells = []; for (let n = 0; n < 10; n++) mcells.push(el("i", {}, ml));
          panelSync.push(() => { const on = Math.round(clamp(M.master, 0, 1.2) * 10); mcells.forEach((cl, n) => { cl.className = n < on ? (n < 6 ? "g" : n < 8 ? "a" : "r") : ""; }); });
        },
        eq() {
          el("h3", { text: (stageId === "festival" ? "SYSTEM EQ + AMP RACK" : "EQ + AMP RACK") }, panel);
          const cv = NK.canvas(panel, 200, 44, "sc-rta"); rtaP = cv;
          cv.cv.style.height = "auto"; cv.cv.style.aspectRatio = "200 / 44"; cv.cv.style.width = "100%";
          const eqw = el("div", { cls: "sc-eq" }, panel); const outs = [];
          BANDS.forEach((f, b) => {
            const lab = el("label", {}, eqw); const o = el("output", { text: "0" }, lab);
            const inp = el("input", { type: "range", min: "-12", max: "12", step: "1", value: String(S.eq[b]), "aria-label": BLAB[b] + " hertz" }, lab);
            el("span", { text: BLAB[b] }, lab);
            inp.addEventListener("input", () => { S.eq[b] = parseInt(inp.value, 10); syncAll(true); checkFixes(); });
            outs.push([o, inp, b]);
          });
          panelSync.push(() => outs.forEach(([o, inp, b]) => { o.textContent = (S.eq[b] > 0 ? "+" : "") + S.eq[b]; if (parseInt(inp.value, 10) !== S.eq[b]) inp.value = String(S.eq[b]); }));
          const row = el("div", { cls: "row" }, panel);
          const flat = el("button", { cls: "kbtn", type: "button", text: "FLAT" }, row); flat.addEventListener("click", () => { S.eq.fill(0); RP.sfx("click"); syncAll(); checkFixes(); });
          const gl = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: "GROUND LIFT: OFF" }, row);
          gl.addEventListener("click", () => { S.gnd = !S.gnd; RP.sfx("click"); checkFixes(); syncAll(); setMsg(S.gnd ? "Ground lift on. The shield is no longer a path between the two circuits." : "Ground lift off."); });
          synced.push(() => { gl.setAttribute("aria-pressed", String(S.gnd)); gl.textContent = "GROUND LIFT: " + (S.gnd ? "ON" : "OFF"); });
          el("p", { cls: "sc-note", text: "The analyzer bars line up with the sliders. Pulling one band down is a scalpel; flattening the whole bass is a shovel." }, panel);
        },
        spk() {
          el("h3", { text: "SPEAKERS: " + ST.pa }, panel);
          el("p", { text: "Each amp output feeds one box. There is a spare cab on the floor. LISTEN solos one side so you can compare." }, panel);
          ["ampL", "ampR"].forEach(id => {
            const card = el("div", { cls: "sc-card" }, panel);
            const t = el("div", { cls: "t" }, card); el("span", { text: CABLES[id].label.toUpperCase() + " into" }, t);
            seg(card, "CAB", ["cabA", "cabB", "cabS"].map(j => [j, j === "cabS" ? "SPARE" : j === "cabA" ? "LEFT" : "RIGHT"]), jid => doPlug(id, jid), () => S.jack[id]);
          });
          const row = el("div", { cls: "row" }, panel); el("span", { text: "Listen to:" }, row);
          const lb = ["lr", "l", "r"].map(k => { const b = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: k === "lr" ? "BOTH" : k === "l" ? "L ONLY" : "R ONLY" }, row); b.addEventListener("click", () => { S.listen = k; RP.sfx("click"); syncAll(); }); return [k, b]; });
          synced.push(() => lb.forEach(([k, b]) => b.setAttribute("aria-pressed", String(S.listen === k))));
        },
        mon() {
          el("h3", { text: "MONITOR + MIC" }, panel);
          el("p", { text: "Booth monitor: " + monName + ". The MC's mic sits in front of it. A monitor that aims at the mic will howl." }, panel);
          const card = el("div", { cls: "sc-card" }, panel);
          const mk = (label, min, max, step, get, set, fmt) => {
            const r = el("div", { cls: "sc-fader" }, card); el("span", { text: label, style: "min-width:70px" }, r);
            const inp = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(get()), "aria-label": label }, r); const o = el("span", { text: fmt(get()), style: "min-width:54px;text-align:right;color:var(--fg)" }, r);
            inp.addEventListener("input", () => { set(parseFloat(inp.value)); o.textContent = fmt(get()); rebuildHot(); checkFixes(); syncAll(true); });
          };
          mk("DISTANCE", 0.3, 4, 0.1, () => S.mon.dist, v => { S.mon.dist = v; }, v => v.toFixed(1) + " m");
          mk("AIM OFF MIC", 0, 90, 5, () => S.mon.ang, v => { S.mon.ang = v; }, v => Math.round(v) + "°");
          const mb = el("button", { cls: "kbtn", type: "button", "aria-pressed": "true", text: "MIC LIVE" }, card);
          mb.addEventListener("click", () => bMic.click());
          synced.push(() => { mb.setAttribute("aria-pressed", String(S.mic.live)); mb.textContent = S.mic.live ? "MIC LIVE" : "MIC MUTED"; });
          el("p", { cls: "sc-note", text: "Shortcut: you can also cut the ringing band on the EQ tab." }, panel);
        },
        pwr() {
          el("h3", { text: "POWER" }, panel);
          el("p", { text: ST.powerNote }, panel);
          [["pwrMix", "MIXER + DECKS"], ["pwrAmp", "AMP RACK"]].forEach(([id, label]) => {
            const card = el("div", { cls: "sc-card" }, panel); const t = el("div", { cls: "t" }, card); el("span", { text: label }, t);
            seg(card, "PLUGGED INTO", ["outA", "outB"].map((j, n) => [j, ST.power[n]]), jid => doPlug(id, jid), () => S.pwr[id]);
          });
          const row = el("div", { cls: "row" }, panel);
          const gl = el("button", { cls: "kbtn", type: "button", "aria-pressed": "false", text: "GROUND LIFT: OFF" }, row);
          gl.addEventListener("click", () => { S.gnd = !S.gnd; RP.sfx("click"); checkFixes(); syncAll(); });
          synced.push(() => { gl.setAttribute("aria-pressed", String(S.gnd)); gl.textContent = "GROUND LIFT: " + (S.gnd ? "ON" : "OFF"); });
          el("p", { cls: "sc-note", text: "The ground lift switch lives on the DI box in the rack." }, panel);
        }
      };
      try { B[k](); } catch (e) { console.warn(e); }
      syncAll();
    }
    function syncAll(light) {
      synced.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
      panelSync.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
      if (light) return;
      bPA.setAttribute("aria-pressed", String(!S.muted)); bPA.textContent = S.muted ? "PA: MUTED" : "PA: LIVE";
      bA.setAttribute("aria-pressed", String(S.deck[0].play)); bB.setAttribute("aria-pressed", String(S.deck[1].play));
      bA.textContent = (S.deck[0].play ? "STOP " : "") + "DECK A"; bB.textContent = (S.deck[1].play ? "STOP " : "") + "DECK B";
      bPink.setAttribute("aria-pressed", String(S.pink)); bMic.setAttribute("aria-pressed", String(S.mic.live)); bMic.textContent = S.mic.live ? "MIC LIVE" : "MIC MUTED";
      bLis.forEach(b => b.setAttribute("aria-pressed", String(S.listen === b.getAttribute("data-k"))));
      applyAudio();
    }

    /* ---------------- canvas pointer ---------------- */
    function jackAt(x, y, r) {
      let best = null, bd = r;
      Object.keys(JACK).forEach(j => { const [jx, jy] = JACK[j]; if (jx < 0) return; const d = Math.hypot(jx - x, jy - y); if (d < bd) { bd = d; best = j; } });
      return best;
    }
    const coarse = (() => { try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } })();
    scene.cv.addEventListener("pointermove", e => { const q = NK.pt(scene.cv, e); held.mx = q.x; held.my = q.y; });
    scene.cv.addEventListener("pointerdown", e => {
      if (finished) return;
      const q = NK.pt(scene.cv, e); held.mx = q.x; held.my = q.y;
      const rr = coarse ? 12 : 8;
      if (held.id) {
        const j = jackAt(q.x, q.y, rr + 3);
        if (j && CABLES[held.id].opts.includes(j) && JACK[j][0] >= 0) { const id = held.id; held.id = null; doPlug(id, j); return; }
        held.id = null; setMsg("Cable put back."); return;
      }
      /* pick up a plug */
      let pick = null, pd = rr + 2;
      Object.keys(CABLES).forEach(id => { const e2 = JACK[S.jack[id] || S.pwr[id]]; const d = Math.hypot(e2[0] - q.x, e2[1] - q.y); if (d < pd) { pd = d; pick = id; } });
      if (pick) { held.id = pick; RP.sfx("pickup"); setMsg("Holding " + CABLES[pick].label + ". Tap a glowing socket to plug it in, or tap anywhere else to put it back."); const fam = CABLES[pick].fam; tabSelect(fam === "in" ? "decks" : fam === "spk" ? "spk" : "pwr"); return; }
      const h = hot.filter(z => q.x >= z.r[0] - 2 && q.x < z.r[0] + z.r[2] + 2 && q.y >= z.r[1] - 2 && q.y < z.r[1] + z.r[3] + 2).pop();
      if (h) { RP.sfx("blip"); tabSelect(h.tab); }
    });
    host.onKey(e => { if (e.key === "Escape" && held.id) { held.id = null; setMsg("Cable put back."); } });

    /* ---------------- finish ---------------- */
    let timeLeft = TOTAL, armed = false, armT = 0;
    function evaluate(reason) {
      if (finished) return; finished = true;
      const now = problems();
      const fixedN = startFaults.filter(f => !now.includes(f)).length;
      const healthy = !now.length;
      const frac = timeLeft / TOTAL;
      let score = Math.round(clamp(fixedN / startFaults.length * 72 + (healthy ? 14 + 14 * frac : 0) - hintsUsed * (diff >= 4 ? 5 : 3), 0, 100));
      if (!healthy) score = Math.min(score, 72);
      const lines = startFaults.map(f => [FNAME[f], now.includes(f) ? "still there" : "fixed", now.includes(f) ? "n" : "y"]);
      const extra = now.filter(f => !startFaults.includes(f));
      extra.forEach(f => lines.push([f === "mic-muted" ? "Mic left muted" : "New problem: " + (FNAME[f] || f), "oops", "n"]));
      lines.push(["Time left", NK.mmss(timeLeft), ""]); if (hintsUsed) lines.push(["Tips used", hintsUsed + " (-" + hintsUsed * (diff >= 4 ? 5 : 3) + ")", ""]);
      const blurb = healthy ? (reason === "time" ? "You got it clean right at the buzzer. The first people up the stairs don't notice a thing. That is the best compliment a sound tech gets." : "Doors open. Clean signal, no hum, no howl. " + ST.tech.split(" ")[0] + " nods once. That is a standing ovation.")
        : (reason === "time" ? "Time's up and the doors open on a PA with problems. " : "You opened the doors early. ") + (now.includes("feedback") ? "The first announcement ends in a scream. " : now.includes("ground-hum") ? "Everyone can hear that 60 Hz hum under the intro. " : "") + "The crowd notices.";
      if (aud) { try { aud.out.gain.setTargetAtTime(0.0001, AC.currentTime, 0.05); } catch (e) { /* ignore */ } }
      S.deck.forEach((d, i) => stopDeck(i));
      const result = { ok: healthy, score, fixed: fixedN };
      if (healthy) RP.sfx("cheer"); else RP.sfx("boo");
      host.timeout(() => {
        NK.endCard(host, { kicker: ST.name + " | doors open", title: healthy ? "CLEAN SOUND CHECK" : "SOUND CHECK: ROUGH", ok: healthy, score, lines, blurb, button: "CONTINUE" }).then(() => resolveFn(result));
      }, 600);
    }
    let resolveFn = () => {};
    bOpen.addEventListener("click", () => {
      if (finished) return;
      const now = problems();
      if (now.length && !armed) { armed = true; armT = M.t; bOpen.textContent = "SURE? PROBLEMS LEFT"; setMsg("There may still be problems. Click again to open the doors anyway."); return; }
      evaluate("open");
    });
    bLeave.addEventListener("click", () => { if (finished) return; finished = true; S.deck.forEach((d, i) => stopDeck(i)); resolveFn({ ok: false, score: 0, fixed: startFaults.filter(f => !problems().includes(f)).length }); });

    /* ---------------- run ---------------- */
    return new Promise(resolve => {
      resolveFn = resolve;
      rebuildHot(); tabSelect("decks"); syncAll();
      NK.onResize(host, layout);
      function layout() {
        const compact = NK.isCompact();
        NK.setCompact(host, compact);
        const avail = root.clientWidth || 700;
        const wide = !compact && avail >= 940;
        main.classList.toggle("wide", wide); main.classList.toggle("compact", compact);
        let sc;
        if (compact) {
          const w = Math.max(280, Math.min(avail * 0.5, (window.innerHeight - 170) * 1.6));
          sc = w / W; main.style.gridTemplateColumns = Math.round(w) + "px minmax(0, 1fr)"; scene.cv.style.width = Math.round(w) + "px"; scene.cv.style.height = Math.round(H * sc) + "px";
          panel.style.maxHeight = Math.max(120, window.innerHeight - 24 - (test.offsetHeight || 64) - (tabsEl.offsetHeight || 52) - 36) + "px";
        } else {
          panel.style.maxHeight = ""; main.style.gridTemplateColumns = "";
          const boxW = wide ? 640 : avail;
          sc = NK.fit(scene.cv, { clientWidth: boxW }, W, H, wide ? 640 : 820);
        }
        queue.cv.style.width = scene.cv.style.width; queue.cv.style.height = Math.round(14 * sc) + "px";
        ql.style.width = scene.cv.style.width; ql.style.marginInline = wide || compact ? "0" : "auto";
      }
      layout();
      let last = null, accSync = 0, lastLeft = -1;
      host.raf(tm => {
        if (finished && !host.root.isConnected) return false;
        const now = tm / 1000; let dt = last == null ? 0 : now - last; last = now; dt = clamp(dt, 0, 0.1);
        if (!finished) {
          timeLeft -= dt;
          if (timeLeft <= 0) { timeLeft = 0; evaluate("time"); }
          if (armed && M.t - armT > 4) { armed = false; bOpen.textContent = "OPEN DOORS"; }
          const tl = Math.ceil(timeLeft);
          if (tl !== lastLeft) { lastLeft = tl; clockEl.innerHTML = "<small>DOORS IN</small>" + NK.mmss(timeLeft); clockEl.classList.toggle("low", timeLeft < 30); }
        }
        stepModel(dt);
        accSync += dt; if (accSync > 0.08) { accSync = 0; applyAudio(); panelSync.forEach(f => f()); if (rtaP) drawRTA(rtaP.c, 200, 44); }
        drawFrame(M.t, dt);
        drawQueue(1 - timeLeft / TOTAL);
      });
      /* expose a tiny debug handle for tests */
      try { host.root.__sc = { S, aud, M, AC, JACK, held, faults: startFaults, problems, doPlug, tabSelect, evaluate, get timeLeft() { return timeLeft; }, setTime(v) { timeLeft = v; } }; } catch (e) { /* ignore */ }
    });
  }
});
})();
