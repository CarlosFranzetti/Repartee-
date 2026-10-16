/* guest.List — you're at the door with a clipboard. People arrive one at a time with a claim.
   Check the LIST, their ID and their WRISTBAND, watch the capacity, let VIPs in, and keep your
   friend Marcus to his +1 (he will say "plus three". At difficulty 5 he says "plus thirty").
   Params (all optional): { capacity, requests (arrivals), vip: ["Kosmo Delacroix", ...], difficulty 1..5, venue, arcade }
   Result: { ok, score 0..100, admitted (people let in), angry (people you angered), crashers, vipsIn, vipsMissed }
   Never mutates RP.state. */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { el, clamp, R, P, ell, line, poly, mulberry, hashStr, ramp, txt, txtC, txtW, bayer } = U;
const K = ramp;

const CSS = `
.gl-layout { display: grid; gap: 10px; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "stage side" "say side" "acts side"; align-items: start; }
.gl-layout > .sk-stage { grid-area: stage; } .gl-layout > .sk-say { grid-area: say; } .gl-layout > .gl-acts { grid-area: acts; } .gl-layout > .sk-side { grid-area: side; }
@media (max-width: 959px) { .gl-layout { grid-template-columns: minmax(0, 1fr); grid-template-areas: "stage" "meters" "say" "case" "acts" "clip"; } .gl-layout > .sk-side { display: contents; } .gl-layout .gl-meters { grid-area: meters; } .gl-layout .gl-case { grid-area: case; } .gl-layout .gl-clip { grid-area: clip; } }
.gl-meters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.gl-meters .sk-meter { min-width: 0; }
.gl-clip { background: #e8dcb8; color: #2a2030; border: 2px solid #8a7a52; border-top-width: 10px; border-top-color: #4a4660; border-radius: 3px; padding: 6px 10px 8px; font-size: 18px; line-height: 1.06; box-shadow: 3px 3px 0 #000; position: relative; }
.gl-clip::before { content: ""; position: absolute; left: 50%; top: -12px; width: 38px; height: 10px; margin-left: -19px; background: #9a9ab8; border: 1px solid #2a2840; }
.gl-clip h3 { margin: 0 0 3px; font-weight: 400; font-size: 17px; letter-spacing: .1em; color: #6a1a4a; }
.gl-clip ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 1px; }
.gl-clip li::before { content: "- "; color: #a08a52; }
.gl-clip b { font-weight: 400; color: #8a1a3a; }
.gl-clip .tg { position: absolute; right: 8px; top: 4px; }
.gl-case { display: flex; flex-direction: column; gap: 6px; }
.gl-row { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 8px; align-items: center; background: #120e24; border: 1px solid var(--line); padding: 5px; min-height: 70px; }
.gl-row canvas { width: 96px; height: 60px; image-rendering: pixelated; image-rendering: crisp-edges; background: #0a0716; border: 1px solid #2d2456; }
.gl-row .what { font-size: 18px; line-height: 1.04; color: var(--fg); }
.gl-row .what small { display: block; font-size: 15px; letter-spacing: .08em; color: var(--muted); }
.gl-row .hd { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
.gl-row .what .btn { font-size: 16px; padding: 0 8px; }
.gl-row.done .what .btn { display: none; }
.gl-row .what .good { color: var(--ok); } .gl-row .what .warn { color: #ff8a8a; } .gl-row .what .gold { color: var(--amber); }
.gl-acts { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: stretch; }
.gl-step { display: flex; align-items: center; gap: 4px; background: #120e24; border: 2px solid #2d2456; padding: 2px 6px; }
.gl-step b { font-weight: 400; min-width: 60px; text-align: center; font-size: 22px; line-height: 1; }
.gl-step b small { display: block; font-size: 14px; color: var(--muted); letter-spacing: .08em; }
.gl-step .kbtn { min-width: 36px; padding: 4px 8px; touch-action: manipulation; }
.gl-go { font-size: 24px !important; padding: 8px 6px !important; }
.gl-go.yes { border-color: #2a6a46; color: var(--ok); } .gl-go.yes:hover:not(:disabled) { background: #123020; border-color: var(--ok); color: var(--ok); }
.gl-go.no { border-color: #6a2a3a; color: #ff8a8a; } .gl-go.no:hover:not(:disabled) { background: #301018; border-color: #ff6a6a; color: #ff8a8a; }
@media (max-width: 559px) { .gl-row { padding: 4px; min-height: 56px; } .gl-layout { gap: 6px; } .gl-layout .sk-say { min-height: 70px; padding: 6px 10px 8px; } .gl-layout .sk-say .tx { font-size: 21px; } .gl-acts { position: sticky; bottom: 6px; z-index: 4; background: rgba(5, 3, 10, .94); padding: 6px; border: 1px solid var(--line); grid-template-columns: 1fr 1fr; } .gl-step { grid-column: 1 / -1; justify-content: center; } .gl-row { grid-template-columns: 84px minmax(0, 1fr); } .gl-row canvas { width: 80px; height: 50px; } }
@media (max-height: 460px) and (min-width: 560px) {
  .sk-g .gl-layout { grid-template-columns: 330px minmax(0, 1fr); grid-template-areas: "stage side" "say side" "acts side"; gap: 6px 10px; }
  .sk-g .gl-layout > .sk-side { display: flex; grid-area: side; gap: 5px; }
  .sk-g .gl-layout .gl-meters, .sk-g .gl-layout .gl-case, .sk-g .gl-layout .gl-clip { grid-area: auto; }
  .sk-g .gl-row { grid-template-columns: 84px minmax(0, 1fr); padding: 3px 5px; min-height: 52px; } .sk-g .gl-row canvas { width: 80px; height: 50px; } .sk-g .gl-row .what { font-size: 17px; }
  .sk-g .gl-clip { font-size: 16px; padding: 3px 8px 4px; border-top-width: 8px; } .sk-g .gl-clip h3 { margin: 0; cursor: pointer; font-size: 15px; }
  .sk-g .gl-acts { position: static; background: none; padding: 0; border: 0; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); } .sk-g .gl-acts .gl-go { font-size: 21px !important; padding: 6px 4px !important; }
  .sk-g .gl-step { padding: 1px 4px; } .sk-g .gl-step b { font-size: 20px; min-width: 52px; }
}
.gl-clip h3 { cursor: pointer; } .gl-clip.closed ul { display: none; } .gl-clip.closed h3::after { content: " [+]"; } .gl-clip:not(.closed) h3::after { content: " [-]"; }
`;
let cssDone = false;

/* ------------------------------------------------------------------------------------------ names & lines */
const FIRST = ["Rosa", "Jamal", "Priya", "Tommy", "Mei", "Dev", "Sasha", "Luis", "Keisha", "Gus", "Noor", "Beth", "Marcel", "Yuki", "Femi", "Chloe", "Hank", "Imani", "Tariq", "Dolores", "Ines", "Walt", "Anya", "Cleo", "Raj", "Bao", "Nia", "Otis", "Lena", "Mo"];
const LAST = ["Hernandez", "Pierce", "Nair", "Calloway", "Tanaka", "Kapoor", "Volkov", "Ortega", "Boyd", "Papadakis", "Haddad", "Kowalski", "Dubois", "Ito", "Adeyemi", "Park", "Muller", "Cole", "Rahman", "Quinn", "Moreno", "Frye", "Petrov", "Lopez", "Shah", "Tran", "Okafor", "Lindqvist", "Diaz", "Bell"];
const VIP_DEFAULT = ["Kosmo Delacroix", "Twinkie", "Axl Vanta"];
const VIP_CHAR = { kosmo: "kosmo", twinkie: "twinkie", axl: "axl", dante: "dante", eddie: "eddie", lou: "lou", ray: "ray", jess: "jess" };

const CLAIMS = {
  listed: ["Hi. {first} {last}. I'm on the list.", "{last}. {first} {last}. Should be on there.", "Name's {last}. Be gentle, I've been standing here since the first snow.", "{first} {last}. Yes, with the two Ns."],
  listedPlus: ["{first} {last}, plus {n}. We're all very normal.", "{last}, plus {n}. They're quiet. Mostly.", "It's {last} plus {n}. The {n} are my cousins. They're fine."],
  overplus: ["{first} {last}, plus {n}. That's what I was told.", "It's {last}, plus {n}. A guy said plus {n}. A confident guy."],
  stranger: ["I'm with the DJ.", "I know {dj}. Personally. From the thing.", "I'm on the list. Under... something. Check under 'cool'.", "The bartender said it's fine.", "Do I look like I need to be on a list?", "My cousin knows the guy who knows Dante. I'm basically on the list.", "I'm a friend of a friend of {dj}. Who? The friend. Of the friend.", "I'm with the DJ. The other DJ. The DJ's DJ."],
  strangerPlus: ["I'm with the DJ, plus {n}.", "I'm friends with {dj}. Me and {n} others. Same friend.", "It's a birthday! {n} friends! Mine! Birthday!"],
  imposter: ["{first} {last}. It's on the list. Right there. Under {last}.", "I'm {first} {last}, and I would never lie about that."],
  vip: ["{vip}. You know who I am.", "{vip}. I don't do lists. The list does me.", "{vip}. Obviously. Is there a problem?", "{vip}. Someone's meant to be holding the door."],
  fakevip: ["I'm {vip}'s assistant. He sent me ahead. He's right behind me. Mostly.", "I'm {vip}'s guy. He's parking the jet.", "I'm a VIP. A very important... person. Check the wristband. It's gold. It's mine."],
  reentry: ["I was just in there. I stepped out for air.", "I went to get a slice. Don't make me stand in line again.", "I was inside! Look at my wrist! Stamped!"],
  fakeband: ["I was just inside. I stepped out. Check my wrist.", "I've got the wristband. See the wristband? Wristband."],
  press: ["Brooklyn Beat Weekly. Press. Plus {n}, my photographer.", "Press. Brooklyn Beat. I'm on assignment. It's a very small assignment."],
  bribe: ["Here's twenty. That's a list, right? A twenty-list?", "Hey. Hey. What if I just... said thank you? In cash?"],
  marcus: ["{dj}! It's me! Marcus! Plus three.", "Hey {dj}! Marcus. Plus three. Don't make it weird.", "It's my birthday! Plus three! Just like we said!"],
  marcus5: ["{dj}! It's me! Marcus! Plus thirty.", "Plus thirty. It's a small thirty. Lightweight thirty.", "Marcus. Plus thirty. It was in the contract. Which I wrote on a napkin."]
};
const ADMIT_REPLY = ["Thanks. You're a legend.", "Sweet. Is the bar open?", "Finally. My feet have filed a complaint.", "Appreciated. Don't tell my ex I'm here.", "Cool. Cool cool cool.", "Bless you."];
const ADMIT_CRASH = ["Ha. Nice doing business.", "Wow, that actually worked.", "Don't check my ID. Great. Thanks.", "You're a good doorman. Bad at it, but good."];
const DENY_REPLY = ["Wow. Okay.", "You'll hear about this.", "I'll tell everyone you suck.", "This place is overrated anyway.", "My lawyer will hear about this. My lawyer is also the guy behind me.", "Fine. I didn't want to come in. I wanted to be asked."];
const DENY_FAKE = ["Eh. Worth a shot.", "Whatever. It was a long shot.", "...Is the line for the other door shorter?", "Okay okay. Have a nice night. Don't mention me."];
const DENY_VIP = ["Do you know who I am? ...Never mind. I'll go somewhere else.", "Noted. I will remember this. I have a very good memory.", "Wow. Okay. Tell {dj} I said goodbye."];
const MARCUS_PART = ["It's my BIRTHDAY.", "It's not even my birthday. It's a spiritual birthday. Okay? Fine.", "You're making this weird. I'm being very normal."];

/* ------------------------------------------------------------------------------------------ people */
function makeCrowd(p, diff, rnd, SK) {
  const vipNames = Array.isArray(p.vip) && p.vip.length ? p.vip.map(String) : VIP_DEFAULT.slice(0, [1, 2, 2, 3, 3][diff - 1]);
  const N = clamp(Math.round(p.requests || [10, 12, 14, 17, 19][diff - 1]), 4, 30);
  const nVip = Math.min(vipNames.length, Math.max(1, N - 6));
  const used = {};
  const nm = () => { let f, l, k; do { f = SK.pick(FIRST, rnd); l = SK.pick(LAST, rnd); k = f + l; } while (used[k]); used[k] = 1; return { first: f, last: l, full: f + " " + l }; };
  const mix = [];
  mix.push("marcus");
  vipNames.slice(0, nVip).forEach((v, i) => mix.push({ vip: v }));
  const rest = N - mix.length;
  const weights = { listed: 6, listedPlus: 3, overplus: 2, reentry: 1.4, fakeband: 1.2, stranger: 3, strangerPlus: 1.6, imposter: 1.8, press: 1, bribe: 0.9, fakevip: nVip ? 1.2 : 0 };
  const keys = Object.keys(weights);
  const guaranteed = ["listed", "stranger", "reentry", "imposter", "listedPlus", "overplus"];
  for (let i = 0; i < rest; i++) {
    if (i < guaranteed.length && i < rest - 2) { mix.push(guaranteed[i]); continue; }
    let tot = keys.reduce((a, k) => a + weights[k], 0), r0 = rnd() * tot, ch = keys[0];
    for (const k of keys) { r0 -= weights[k]; if (r0 <= 0) { ch = k; break; } }
    mix.push(ch);
  }
  // shuffle, then place VIPs late (last 40%), marcus in the middle
  const base = SK.shuffle(mix.filter(m => typeof m === "string" && m !== "marcus"), rnd);
  const vips = mix.filter(m => typeof m === "object");
  const order = base.slice();
  order.splice(Math.floor(order.length / 2), 0, "marcus");
  vips.forEach((v, i) => { const lo = Math.floor(order.length * 0.45); const at = lo + Math.floor(rnd() * (order.length - lo + 1)); order.splice(at, 0, v); });
  const tonight = SK.pick([["PINK", "#ff3fa4", "moon"], ["CYAN", "#39d0ff", "star"], ["LIME", "#9be15d", "bolt"], ["AMBER", "#ffc44d", "moon"]], rnd);
  const band = { name: tonight[0] + " " + tonight[2].toUpperCase(), col: tonight[1], glyph: tonight[2] };
  const people = [], list = [];
  const cast = (seed, name) => {
    const d = RP.chars.random(seed, { name }); d.voice = "#ffffff"; return d;
  };
  let sd = Math.floor(rnd() * 90000) + 100;
  order.forEach((t, idx) => {
    const typeName = typeof t === "object" ? "vip" : t;
    const P0 = { type: typeName, idx, seed: sd++, claim: "", size: 1, allowed: 0, listed: null, idName: null, hasId: true, bandKind: "none", reentry: false, vip: false, label: "", marker: null, extras: [] };
    const n = nm();
    P0.first = n.first; P0.last = n.last; P0.full = n.full;
    const plusN = 1 + Math.floor(rnd() * 3);
    const fillClaim = (key, extra) => SK.fmt(SK.pick(CLAIMS[key], rnd), Object.assign({ first: n.first, last: n.last, n: plusN, dj: SK.djName() }, extra || {}));
    switch (typeName) {
      case "listed": P0.claim = fillClaim("listed"); P0.allowed = 1; P0.listed = { name: n.last.toUpperCase() + ", " + n.first.toUpperCase(), plus: 0 }; P0.idName = n.full; P0.label = n.full; break;
      case "listedPlus": P0.size = 1 + plusN; P0.claim = fillClaim("listedPlus"); P0.allowed = P0.size; P0.listed = { name: n.last.toUpperCase() + ", " + n.first.toUpperCase(), plus: plusN }; P0.idName = n.full; P0.label = n.full; break;
      case "overplus": P0.size = 1 + plusN + 2; P0.claim = fillClaim("overplus", { n: plusN + 2 }); P0.allowed = 1 + 1; P0.listed = { name: n.last.toUpperCase() + ", " + n.first.toUpperCase(), plus: 1 }; P0.idName = n.full; P0.label = n.full; break;
      case "stranger": P0.claim = fillClaim("stranger"); P0.allowed = 0; P0.idName = n.full; P0.label = "???"; P0.size = 1; break;
      case "strangerPlus": P0.size = 1 + plusN; P0.claim = fillClaim("strangerPlus"); P0.allowed = 0; P0.idName = n.full; P0.label = "???"; break;
      case "imposter": { const real = nm(); P0.claim = SK.fmt(SK.pick(CLAIMS.imposter, rnd), { first: real.first, last: real.last }); P0.allowed = 0; P0.listed = { name: real.last.toUpperCase() + ", " + real.first.toUpperCase(), plus: 0 }; P0.idName = n.full; P0.label = real.full; P0.claimedName = real.full; P0.noShow = true; break; }
      case "vip": { const v = t.vip; P0.vip = true; P0.claim = SK.fmt(SK.pick(CLAIMS.vip, rnd), { vip: v }); P0.size = 1; P0.allowed = 1; P0.listed = { name: v.toUpperCase(), plus: 0, vip: true }; P0.idName = null; P0.hasId = false; P0.bandKind = "gold"; P0.label = v; P0.vipName = v; break; }
      case "fakevip": { const v = SK.pick(vipNames, rnd); P0.claim = SK.fmt(SK.pick(CLAIMS.fakevip, rnd), { vip: v }); P0.allowed = 0; P0.idName = n.full; P0.bandKind = "fakegold"; P0.label = "???"; P0.vipName = v; break; }
      case "reentry": P0.claim = fillClaim("reentry"); P0.allowed = 1; P0.reentry = true; P0.idName = n.full; P0.bandKind = "valid"; P0.label = "???"; break;
      case "fakeband": P0.claim = fillClaim("fakeband"); P0.allowed = 0; P0.idName = n.full; P0.bandKind = SK.pick(["wrongcol", "marker", "wrongglyph"], rnd); P0.label = "???"; break;
      case "press": P0.size = 1 + 1; P0.claim = SK.fmt(SK.pick(CLAIMS.press, rnd), { n: 1 }); P0.allowed = 2; P0.listed = { name: "PRESS: BROOKLYN BEAT", plus: 1, press: true }; P0.idName = n.full; P0.label = "Brooklyn Beat"; P0.claimedName = "Brooklyn Beat"; break;
      case "bribe": P0.claim = fillClaim("bribe"); P0.allowed = 0; P0.idName = n.full; P0.label = "???"; break;
      case "marcus": { const big = diff >= 5; P0.size = big ? 31 : 4; P0.claim = SK.fmt(SK.pick(big ? CLAIMS.marcus5 : CLAIMS.marcus, rnd), { dj: SK.djName() }); P0.allowed = 2; P0.listed = { name: "MARCUS (BEST FRIEND)", plus: 1, marcus: true }; P0.idName = "Marcus Bell"; P0.label = "Marcus"; P0.char = "marcus"; P0.claimedName = "Marcus"; P0.big = big; break; }
      default: break;
    }
    if (typeName === "vip") { const key = Object.keys(VIP_CHAR).find(k => P0.vipName.toLowerCase().includes(k)); P0.char = key ? VIP_CHAR[key] : null; }
    if (typeName === "fakevip") P0.fakeFor = P0.vipName;
    P0.def = P0.char && SK.charDef(P0.char) ? P0.char : cast(P0.seed, P0.full);
    if (P0.listed) list.push(P0.listed);
    people.push(P0);
  });
  // no-show list padding (real people who never arrive) so the list looks like a list
  const pad = 3 + Math.floor(rnd() * 5);
  for (let i = 0; i < pad; i++) { const n2 = nm(); list.push({ name: n2.last.toUpperCase() + ", " + n2.first.toUpperCase(), plus: rnd() < 0.3 ? 1 : 0, filler: true }); }
  const legit = people.reduce((a, q) => a + (q.allowed && !q.reentry ? q.allowed : 0), 0);
  const vipCount = people.filter(q => q.vip).length;
  const crashTotal = people.reduce((a, q) => a + (q.allowed ? 0 : q.size), 0) + people.filter(q => q.type === "overplus").reduce((a, q) => a + q.size - q.allowed, 0);
  let cap = p.capacity ? Math.round(p.capacity) : legit + [7, 5, 4, 3, 2][diff - 1];
  if (cap < legit + 1 && !p.capacity) cap = legit + 1;
  return { people, list, band, cap, legit, vipCount, crashTotal, vipNames, venue: String(p.venue || "THE LOFT") };
}

/* ------------------------------------------------------------------------------------------ painting */
function paintDoor(venue, seed, SK) {
  const T = SK.P, W = 320, H = 176;
  const far = U.mk(W, H), near = U.mk(W, H);
  let c = far.getContext("2d");
  const r = mulberry(seed);
  // night sky strip + brick facade
  T.brick(c, 0, 0, W, 124, "#33193a", seed + 2, 14, 6);
  T.shade(c, 0, 0, W, 124, (x, y) => Math.max(0, (1 - y / 50) * 0.9, Math.abs(x - 160) > 120 ? (Math.abs(x - 160) - 120) / 60 : 0), "#06030c", 0.75);
  // string lights along the top
  for (let x = 4; x < W; x += 14) { const yy = 6 + Math.round(Math.sin(x / 22) * 2); P(c, x, yy - 1, "#4a3a2a"); R(c, x, yy, 2, 2, "#ffd27a"); P(c, x, yy, "#fff6d6"); T.glow(c, x + 1, yy + 1, 6, 5, "#ffb04a", 0.8, 0.25); }
  // door
  const dx = 120, dw = 80, dy = 34, dh = 90;
  R(c, dx - 5, dy - 5, dw + 10, dh + 5, "#1a1626"); R(c, dx - 5, dy - 5, dw + 10, 1, "#5a5678"); R(c, dx - 5, dy - 5, 1, dh + 5, "#3a3650");
  T.vgrad(c, dx, dy, dw, dh, ["#1a0c34", "#4a1a6a", "#8a2a7a", "#c0386e"]);
  // dancing silhouettes inside
  for (let i = 0; i < 9; i++) { const sx = dx + 6 + i * 8 + (r() * 3 | 0), sh = 22 + (r() * 14 | 0); R(c, sx, dy + dh - sh, 6, sh, "#0c0618"); ell(c, sx + 3, dy + dh - sh - 3, 3, 3, "#0c0618"); if (i % 3 === 0) R(c, sx + 5, dy + dh - sh - 6, 1, 6, "#0c0618"); }
  for (let i = 0; i < 4; i++) { T.glow(c, dx + 10 + i * 20, dy + 8, 14, 8, i % 2 ? "#39d0ff" : "#ff3fa4", 0.9, 0.35); }
  // light beams
  c.globalAlpha = 0.14; for (let i = 0; i < 4; i++) { poly(c, [[dx + 10 + i * 20, dy + 4], [dx + 4 + i * 20, dy + dh], [dx + 20 + i * 20, dy + dh]], i % 2 ? "#39d0ff" : "#ff8fcf"); } c.globalAlpha = 1;
  R(c, dx, dy, dw, 3, "#0a0614");
  // awning + sign
  R(c, dx - 14, 24, dw + 28, 7, "#14101e"); R(c, dx - 14, 24, dw + 28, 1, "#6a6690"); for (let x = dx - 14; x < dx + dw + 14; x += 6) R(c, x, 28, 3, 3, "#2a2640");
  const v = venue.toUpperCase();
  const sc = txtW(v, 2, 2) <= 140 ? 2 : 1;
  T.neon(c, v, 160, 10, "#ff3fa4", sc);
  T.neon(c, "GUEST LIST ONLY", 160, 33 + 0, "#39d0ff", 1, { glow: false });
  // left: poster wall, hydrant ; right: pipe, ladder
  T.poster(c, 12, 44, 20, 28, seed + 21, "LIVE"); T.poster(c, 38, 52, 20, 26, seed + 22, "", { torn: true }); T.poster(c, 64, 42, 22, 30, seed + 23, "DJS"); T.poster(c, 90, 58, 18, 24, seed + 24, "");
  R(c, 308, 0, 5, 124, "#2a2638"); R(c, 308, 0, 1, 124, "#6a6690"); for (let y = 14; y < 124; y += 22) R(c, 306, y, 9, 3, "#3a3650");
  // LED counter panel frame
  R(c, 226, 22, 74, 28, "#0a0810"); R(c, 225, 21, 76, 1, "#5a5678"); R(c, 225, 21, 1, 30, "#3a3650"); R(c, 301, 21, 1, 30, "#1a1626"); R(c, 225, 50, 76, 1, "#1a1626");
  // sidewalk
  R(c, 0, 124, W, 4, "#4a4668"); R(c, 0, 124, W, 1, "#8a86b0"); R(c, 0, 127, W, 1, "#1a1630");
  T.dith(c, 0, 128, W, H - 128, "#2a2640", "#363252", 0.5);
  for (let y = 134, gap = 8; y < H; y += gap, gap += 3) R(c, 0, y, W, 1, "#1a1630");
  for (let i = 0; i < 70; i++) P(c, r() * W | 0, 128 + r() * 48 | 0, r() < 0.5 ? "#1c1830" : "#4a4668");
  [[30, 160], [180, 156], [276, 170], [110, 145]].forEach(([gx, gy]) => { R(c, gx, gy, 3, 2, "#6a5a80"); });
  // hydrant
  R(c, 6, 108, 10, 16, "#b0302c"); R(c, 6, 108, 10, 2, "#e0605a"); R(c, 4, 113, 14, 3, "#8a2420"); R(c, 7, 105, 8, 3, "#b0302c"); P(c, 14, 112, "#ffd27a");
  // puddle + glow
  ell(c, 248, 156, 34, 6, "#1a1c3a"); T.dith(c, 214, 151, 68, 10, "#1a1c3a", "#39d0ff", 0.2); ell(c, 248, 156, 20, 2, "#2a5a8a"); ell(c, 230, 154, 6, 1, "#ff3fa4");
  T.glow(c, 160, 132, 90, 20, "#ff3fa4", 0.8, 0.22); T.glow(c, 160, 134, 60, 16, "#39d0ff", 0.6, 0.15);
  // ---------- near: velvet rope + stanchions
  c = near.getContext("2d");
  const post = (x) => {
    ell(c, x, 172, 7, 2, "#0a0612"); R(c, x - 6, 168, 12, 3, "#8a6a28"); R(c, x - 6, 168, 12, 1, "#e0c068"); R(c, x - 2, 138, 4, 30, "#b8924a"); R(c, x - 2, 138, 1, 30, "#f0d898"); R(c, x + 1, 138, 1, 30, "#6a4a1c");
    ell(c, x, 136, 4, 4, "#d8b868"); P(c, x - 1, 135, "#fff6d6"); P(c, x + 1, 138, "#8a6a28");
  };
  const ropeY = (x) => 144 + Math.round(Math.sin((x - 18) / (300 - 18) * Math.PI) * 14);
  for (let x = 20; x <= 298; x++) { const y = ropeY(x); R(c, x, y, 1, 3, "#c0302c"); P(c, x, y, "#ff6a5a"); P(c, x, y + 3, "#6a1418"); }
  post(18); post(300);
  return { far, near };
}

/* pixel cards for the case file */
function drawIdCard(g, person, SK) {
  const W = 64, H = 40;
  g.clearRect(0, 0, W, H);
  if (!person.hasId) {
    R(g, 0, 0, W, H, "#1a1630"); for (let y = 0; y < H; y += 4) R(g, 0, y, W, 1, "#241d48");
    txtC(g, "NO ID", 32, 10, "#ff8a8a", 2, 2); txtC(g, "LEFT IT AT", 32, 24, "#8c84b8", 1, 1); txtC(g, "THE HOTEL", 32, 30, "#8c84b8", 1, 1);
    return;
  }
  R(g, 0, 0, W, H, "#c8d4e8"); R(g, 0, 0, W, 1, "#eaf0ff"); R(g, 0, H - 1, W, 1, "#8a98b8"); R(g, 0, 0, W, 8, "#2a4a8a"); txt(g, "PHOTO ID", 3, 2, "#e8f0ff", 1, 1);
  R(g, 3, 11, 22, 26, "#7a96b8"); R(g, 3, 11, 22, 1, "#a8c0d8");
  // face crop
  try {
    const tmp = U.mk(72, 120), tc = tmp.getContext("2d"); tc.imageSmoothingEnabled = false;
    const def = typeof person.def === "string" ? RP.chars.get(person.def) : person.def;
    RP.chars.draw(tc, { def, x: 36, y: 110, face: "front", act: "stand", scale: 1 }, { lx: -0.3, shadow: 0 });
    const m = RP.chars.metrics(def), cy = 110 + m.headCy;
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 36 - 11, cy - m.ry - 4, 22, 26, 3, 11, 22, 26);
  } catch (e) { /* ignore */ }
  const nm = String(person.idName || "").toUpperCase().split(" ");
  txt(g, (nm[0] || "").slice(0, 8), 28, 13, "#16264a", 1, 1);
  txt(g, (nm.slice(1).join(" ") || "").slice(0, 8), 28, 20, "#16264a", 1, 1);
  R(g, 28, 28, 33, 1, "#8a98b8"); R(g, 28, 31, 24, 1, "#8a98b8"); txt(g, "NO." + (1000 + (person.seed * 37) % 9000), 28, 33, "#5a6a8a", 1, 1);
}
function glyph(g, kind, cx, cy, col, bg, rough) {
  if (kind === "moon") { ell(g, cx, cy, 5, 5, col); ell(g, cx + 2, cy - 1, 4, 4, bg); }
  else if (kind === "star") { R(g, cx - 1, cy - 5, 3, 11, col); R(g, cx - 5, cy - 1, 11, 3, col); R(g, cx - 3, cy - 3, 7, 7, col); }
  else { poly(g, [[cx + 2, cy - 6], [cx - 3, cy + 1], [cx, cy + 1], [cx - 2, cy + 6], [cx + 4, cy - 2], [cx + 1, cy - 2]], col); }
}
function drawBand(g, person, tonight, SK) {
  const W = 64, H = 40;
  g.clearRect(0, 0, W, H);
  R(g, 0, 0, W, H, "#14102a");
  const skin = (RP.chars.get(typeof person.def === "string" ? person.def : "kid") || { skin: "#e0a27a" }).skin || "#e0a27a";
  const sk = (typeof person.def === "object" && person.def.skin) || skin;
  const k = K(sk);
  R(g, 0, 10, W, 20, k[2]); R(g, 0, 10, W, 2, k[3]); R(g, 0, 28, W, 2, k[1]); R(g, 0, 29, W, 1, k[0]);
  for (let i = 0; i < 6; i++) P(g, 4 + i * 10, 18 + (i % 3) * 3, k[1]);
  const bk = person.bandKind;
  if (bk === "none") { txtC(g, "NO BAND", 32, 17, k[0], 1, 1); R(g, 0, 33, W, 1, "#14102a"); return; }
  const bx = 22, bw = 22;
  if (bk === "gold") { R(g, bx, 8, bw, 24, "#d8a830"); R(g, bx, 8, bw, 2, "#fff0a0"); R(g, bx, 30, bw, 2, "#8a6410"); txtC(g, "VIP", bx + 11, 16, "#4a3200", 1, 1); R(g, bx + 3, 23, bw - 6, 1, "#8a6410"); return; }
  if (bk === "fakegold") { R(g, bx, 8, bw, 24, "#e8c850"); R(g, bx, 8, bw, 1, "#fff6b0"); txtC(g, "VIP", bx + 11, 15, "#7a6a20", 1, 1); R(g, bx + 2, 22, 5, 1, "#6a5a10"); R(g, bx + 5, 24, 8, 1, "#6a5a10"); P(g, bx + 18, 31, "#c8a820"); R(g, bx + 17, 30, 1, 3, "#c8a820"); return; }
  if (bk === "valid") { const col = tonight.col, kk = K(col); R(g, bx, 8, bw, 24, col); R(g, bx, 8, bw, 2, kk[4]); R(g, bx, 30, bw, 2, kk[1]); glyph(g, tonight.glyph, bx + 11, 20, "#fff6f0", col); return; }
  if (bk === "wrongcol") { const alt = tonight.col === "#39d0ff" ? "#ff3fa4" : "#39d0ff", kk = K(alt); R(g, bx, 8, bw, 24, alt); R(g, bx, 8, bw, 2, kk[4]); R(g, bx, 30, bw, 2, kk[1]); glyph(g, tonight.glyph, bx + 11, 20, "#fff6f0", alt); return; }
  if (bk === "wrongglyph") { const col = tonight.col, kk = K(col), alt = tonight.glyph === "bolt" ? "star" : "bolt"; R(g, bx, 8, bw, 24, col); R(g, bx, 8, bw, 2, kk[4]); R(g, bx, 30, bw, 2, kk[1]); glyph(g, alt, bx + 11, 20, "#fff6f0", col); return; }
  /* marker: no band, just a smudgy drawing on the wrist */
  R(g, bx, 10, bw, 20, k[2]); const col = tonight.col;
  for (let a = 0; a < 18; a++) { const x = bx + 11 + Math.round(Math.cos(a / 18 * 6.28) * 6), y = 20 + Math.round(Math.sin(a / 18 * 6.28) * 6) + ((a % 3) - 1) * 0; P(g, x, y, col); if (a % 4 === 0) P(g, x + 1, y, col); }
  P(g, bx + 17, 26, col); P(g, bx + 18, 28, col); P(g, bx + 18, 31, col); R(g, bx + 4, 23, 5, 1, k[1]);
}

/* ------------------------------------------------------------------------------------------ the game */
RP.mg.register("guestList", {
  title: "guest.List", order: 12,
  desc: "The door. A clipboard. Capacity limits. Marcus says plus three.",
  auto(p) { const cap = (p && p.capacity) || 30; return { ok: true, score: 82, admitted: Math.max(0, cap - 3), angry: 1, crashers: 0, vipsIn: (p && Array.isArray(p.vip) ? p.vip.length : 2), vipsMissed: 0 }; },
  async play(host, p) {
    const SK = RP.social;
    if (!SK) return { ok: false, score: 0, admitted: 0, angry: 0, error: "socialkit_lib missing" };
    try { return await run(host, p || {}, SK); }
    catch (e) { console.error("guestList", e); return { ok: false, score: 0, admitted: 0, angry: 0, error: String(e) }; }
  }
});

async function run(host, p, SK) {
  if (!cssDone) { el("style", { text: CSS }, document.head); cssDone = true; }
  SK.css();
  const S = SK.session(host), root = host.root;
  try { host.ov.classList.add("sk-g"); } catch (e) { /* ignore */ }
  const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
  const rnd = Math.random;
  const G = makeCrowd(p, diff, rnd, SK);
  const { people, list, band, cap, venue } = G;
  const myName = SK.djName();
  const head = host.header("guest.List", (p.arcade ? "Arcade · " : "") + venue);
  head.classList.add("sk-head");
  let leaveRes = null;
  const leaveP = new Promise(res => { leaveRes = res; });
  SK.leave(host, head, S, () => leaveRes({ ok: false, score: 0, admitted: 0, angry: 0, left: true }));
  const wrap = el("div", { cls: "sk-wrap" }, root);
  return Promise.race([leaveP, flow()]);

  async function flow() {
    await SK.intro(S, wrap, {
      kicker: "THE DOOR · " + venue.toUpperCase(),
      title: "You've got the clipboard",
      lead: people.length + " people are in line. Room for " + cap + ". " + (G.vipNames.slice(0, G.vipCount || 1).join(" and ")) + " must get in.",
      steps: [
        "People arrive one at a time. Decide who gets in, <b>and how many</b>: use the <b>+</b> / <b>-</b> counter, then <b>LET IN</b> or <b>TURN AWAY</b>.",
        "Check the <b>LIST</b> (<b>1</b>), the <b>ID</b> (<b>2</b>) and the <b>WRISTBAND</b> (<b>3</b>). The name must be on the list <i>and</i> match the ID.",
        "<b>Capacity is real.</b> Hold spots for the VIPs still to come. Crashers eat your room.",
        "Marcus is <b>+1</b>. He will say plus three" + (diff >= 5 ? " (today, plus thirty)" : "") + ". It is still +1."
      ],
      pill: "DIFFICULTY " + diff,
      button: "OPEN THE DOOR"
    });
    const grid = el("div", { cls: "gl-layout" }, wrap);
    const stageApi = SK.canvas(grid, 320, 176, 2);
    const side = el("div", { cls: "sk-side" }, grid);
    const hud = el("div", { cls: "gl-meters" }, side);
    const mIn = SK.meter(hud, { label: "INSIDE", color: "#39d0ff", max: cap, value: 0, marks: [] }); mIn.set(0, "0/" + cap);
    const mHeat = SK.meter(hud, { label: "LINE", color: "#ff6a3a", max: 100, value: 0 });
    const mAng = SK.meter(hud, { label: "ANGRY", color: "#ff3fa4", max: 10, value: 0 }); mAng.set(0, "0/10");
    // clipboard
    const clip = el("div", { cls: "gl-clip" }, side);
    const clipH = el("h3", { text: "CLIPBOARD \u2014 " + venue.toUpperCase() }, clip);
    clipH.addEventListener("click", () => clip.classList.toggle("closed"));
    if ((window.innerHeight || 800) < 460) clip.classList.add("closed");
    const cul = el("ul", {}, clip);
    el("li", { html: "Capacity <b>" + cap + "</b>. List: <b>" + list.length + "</b> names." }, cul);
    el("li", { html: "VIPs: <b>" + G.vipNames.slice(0, Math.max(1, G.vipCount)).join(", ") + "</b>. Gold band. No ID needed." }, cul);
    el("li", { html: "Tonight's band: <b>" + band.name + "</b>. Re-entry only." }, cul);
    el("li", { html: "Name on list = name on ID. \"I'm with the DJ\" is not a name." }, cul);
    el("li", { html: "Marcus: <b>+1</b>. Always +1." }, cul);
    // case file
    const caseBox = el("div", { cls: "gl-case" }, side);
    const rows = {};
    const mkRow = (key, label, w) => {
      const rw = el("div", { cls: "gl-row" }, caseBox);
      const cv = el("canvas", { cls: "px", width: 64, height: 40 }, rw);
      const what = el("div", { cls: "what" }, rw);
      const hd = el("div", { cls: "hd" }, what);
      el("small", { text: label }, hd);
      const b = el("button", { cls: "btn", type: "button", text: "CHECK [" + w + "]" }, hd);
      const txtEl = el("div", { text: "Not checked." }, what);
      rows[key] = { rw, cv, g: cv.getContext("2d"), txt: txtEl, btn: b };
      return rows[key];
    };
    mkRow("list", "THE LIST", 1); mkRow("id", "PHOTO ID", 2); mkRow("band", "WRISTBAND", 3);
    const say = SK.say(S, grid);
    const acts = el("div", { cls: "gl-acts" }, grid);
    const step = el("div", { cls: "gl-step" }, acts);
    const bMinus = el("button", { cls: "kbtn", type: "button", text: "-", "aria-label": "One fewer" }, step);
    const cntEl = el("b", { html: "1<small>PEOPLE</small>" }, step);
    const bPlus = el("button", { cls: "kbtn", type: "button", text: "+", "aria-label": "One more" }, step);
    const bAll = el("button", { cls: "kbtn", type: "button", text: "ALL" }, step);
    const bYes = el("button", { cls: "btn gl-go yes", type: "button", text: "LET IN [4]" }, acts);
    const bNo = el("button", { cls: "btn gl-go no", type: "button", text: "TURN AWAY [5]" }, acts);
    el("div", { cls: "sk-tip", text: "Keys: 1 list · 2 ID · 3 wristband · 4 let in · 5 turn away · +/- or arrows change the number" }, wrap);

    // ---------- scene state
    const scene = paintDoor(venue, hashStr(venue) % 9999, SK);
    const c = stageApi.c;
    const floats = SK.floats();
    const blinkQ = {};
    const anim = { front: null, fx: 160, fy: 226, fs: 2, fa: 1, mode: "idle", t: 0, dur: 0.6, from: null, to: null, exitKind: null, walk: 0, expr: "", talking: false };
    const queue = []; // upcoming people (for drawing)
    let inside = 0, angry = 0, crashers = 0, vipsIn = 0, vipsMissed = 0, correct = 0, total = 0, admittedTotal = 0, held = G.vipCount;
    let heat = 0, awaiting = false, cur = null, count = 1, doneAll = false;
    const heatRate = [0, 1.5, 2.3, 3.1, 4.0][diff - 1];
    const lightFront = { lx: -0.45, rim: { color: "#ff3fa4", side: 1 }, shadow: 0, cast: false };
    const lightQ = { lx: -0.3, rim: { color: "#39d0ff", side: -1 }, shadow: 0, cast: false };
    const QX = i => 178 + i * 34;
    function drawLed(g) {
      const full = inside >= cap;
      R(g, 227, 23, 72, 26, "#0c0a10");
      txt(g, "INSIDE", 231, 26, "#ff8a3a", 1, 1);
      if (full && !(SK.reduced() || Math.floor(performance.now() / 500) % 2)) txt(g, "FULL", 262, 26, "#ff4040", 1, 1); else txt(g, "VIP " + Math.max(0, held), 266, 26, "#a05a1a", 1, 1);
      txt(g, inside + "/" + cap, 231, 34, full ? "#ff4040" : "#ff8a3a", 2, 1);
    }
    function drawPerson(pr, x, y, scale, o, lt) {
      if (!pr) return;
      let bl = false;
      if (o.idle) { const b = (blinkQ[pr.idx] = blinkQ[pr.idx] || SK.blinker()); bl = b(0.016); }
      SK.drawChar(c, pr.def, x, y, { face: o.face || "front", act: o.act || "stand", frame: o.frame || 0, scale, blink: bl, expr: o.expr || undefined, mouth: o.mouth, alpha: o.alpha }, lt || lightQ);
    }
    function draw(dt) {
      c.drawImage(scene.far, 0, 0);
      drawLed(c);
      // queue: the people still waiting (1x), far end first
      const waiting = queue.filter(q => q !== anim.front);
      const ek = anim.mode === "arrive" ? (() => { const k = Math.min(1, anim.t / anim.dur); return k * k * (3 - 2 * k); })() : 1;
      for (let i = Math.min(waiting.length, 4) - 1; i >= 0; i--) {
        const x = QX(i) + (1 - ek) * 34;
        drawPerson(waiting[i], x, 150 - (i % 2) * 2, 1, { face: "front", act: (i % 3 === 2 ? "phone" : "stand") }, lightQ);
      }
      // companions
      if (anim.front && (anim.mode === "idle" || anim.mode === "arrive") && anim.front.size > 1) {
        const n = Math.min(anim.front.size - 1, anim.front.big ? 7 : 5);
        for (let i = n - 1; i >= 0; i--) {
          anim.front.comps = anim.front.comps || [];
          const cp = anim.front.comps[i] = anim.front.comps[i] || { idx: 900 + anim.front.idx * 10 + i, def: RP.chars.random(anim.front.seed * 7 + i + 1, { name: "friend" }) };
          const cx = 132 + (i % 4) * 20 + (i >= 4 ? 10 : 0), cy = 142 - (i >= 4 ? 5 : 0) + (i % 2) * 2;
          const slide = anim.mode === "arrive" ? (1 - Math.min(1, anim.t / anim.dur)) * 200 : 0;
          drawPerson(cp, cx + slide, cy, 1, { face: "front" }, lightQ);
        }
      }
      // front
      if (anim.front) {
        const f = anim.front;
        let x = 84, y = 226, sc = 2, alpha = 1, face = "front", act = "stand", frame = 0;
        if (anim.mode === "arrive") { const k = Math.min(1, anim.t / anim.dur), e = k * k * (3 - 2 * k); x = 178 + (84 - 178) * e; y = 150 + (226 - 150) * e; sc = 1 + e; act = "walk"; frame = Math.floor(anim.t * 10) % 4; }
        else if (anim.mode === "exit") {
          const k = Math.min(1, anim.t / anim.dur), e = k * k;
          if (anim.exitKind === "in") { x = 84 + (160 - 84) * e; y = 226 + (128 - 226) * e; sc = 2 - e; face = "back"; act = "walk"; frame = Math.floor(anim.t * 10) % 4; alpha = 1 - e * 0.7; }
          else { x = 84 - 150 * e; sc = 2; face = "left"; act = "walk"; frame = Math.floor(anim.t * 10) % 4; }
        }
        const talking = anim.talking && say.talking;
        drawPerson(f, x, y, sc, { face, act, frame, mouth: talking && Math.floor(performance.now() / 110) % 2 === 0, expr: anim.expr, alpha, idle: anim.mode === "idle" }, lightFront);
      }
      c.drawImage(scene.near, 0, 0);
      floats.draw(c, dt);
    }
    let last = performance.now();
    host.raf(t => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      try {
        if (anim.mode === "arrive" || anim.mode === "exit") { anim.t += dt; if (anim.t >= anim.dur && anim.onDone) { const f = anim.onDone; anim.onDone = null; f(); } }
        if (awaiting && heatRate) { heat += heatRate * dt; if (heat >= 100) { heat = 45; angry++; mAng.set(angry); floats.add("THE LINE IS FURIOUS", 160, 120, "#ff6a6a", { life: 1.8 }); RP.sfx("boo"); setAngry(); } mHeat.set(heat); }
        draw(dt);
      } catch (e) { /* never throw */ }
    });
    const setAngry = () => { anim.expr = "angry"; S.later(() => { if (cur && anim.mode === "idle") anim.expr = ""; }, 900); };
    const runAnim = (mode, dur, kind) => new Promise(res => { anim.mode = mode; anim.t = 0; anim.dur = SK.reduced() ? 0.05 : dur; anim.exitKind = kind || null; anim.onDone = () => { res(); }; });
    draw(0);

    // ---------- case file helpers
    const resetRows = () => {
      Object.keys(rows).forEach(k => { const r0 = rows[k]; r0.rw.classList.remove("done"); r0.txt.textContent = "Not checked."; r0.txt.className = ""; r0.g.clearRect(0, 0, 64, 40); R(r0.g, 0, 0, 64, 40, "#14102a"); txtC(r0.g, "?", 32, 12, "#3a3070", 3, 3); });
    };
    const checks = { list: false, id: false, band: false };
    const findList = (pr) => {
      const cl = (pr.claimedName || pr.full || "").toUpperCase();
      return list.find(e => { const nm = e.name.replace(",", ""); const [last, first] = e.name.split(", "); const norm = ((first || "") + " " + (last || "")).trim(); return norm === cl || e.name === cl || (pr.vip && e.name === pr.vipName.toUpperCase()) || (pr.listed && e === pr.listed && !pr.claimedName); });
    };
    const doCheck = (kind) => {
      if (!cur || !awaiting || checks[kind]) return;
      checks[kind] = true; RP.sfx("click");
      const r0 = rows[kind]; r0.rw.classList.add("done");
      const pr = cur;
      if (kind === "list") {
        R(r0.g, 0, 0, 64, 40, "#e8dcb8"); R(r0.g, 0, 0, 64, 5, "#4a4660");
        for (let i = 0; i < 6; i++) R(r0.g, 5, 9 + i * 5, 54 - (i % 3) * 8, 1, "#a08a52");
        const found = pr.listed;
        if (found) {
          R(r0.g, 3, 18, 58, 7, "#ffe85a"); txt(r0.g, found.name.slice(0, 14), 5, 19, "#6a1a4a", 1, 1);
          const pl = found.plus ? "PLUS " + found.plus : "NO PLUS";
          r0.txt.innerHTML = "FOUND: <b class='good'>" + found.name + "</b><br>" + (found.vip ? "<span class='gold'>VIP</span> \u00B7 " : "") + pl + (found.marcus ? " <span class='warn'>(not 3)</span>" : "");
        } else {
          txtC(r0.g, "NO MATCH", 32, 17, "#a02020", 2, 1);
          r0.txt.innerHTML = "<span class='warn'>NO MATCH.</span><br>" + (pr.type === "fakevip" ? "\"" + pr.vipName + "'s assistant\" isn't a name." : pr.type === "reentry" || pr.type === "fakeband" ? "No name given." : pr.type === "bribe" ? "Twenty dollars isn't a name." : "\"With the DJ\" isn't a name.");
        }
      } else if (kind === "id") {
        drawIdCard(r0.g, pr, SK);
        if (!pr.hasId) r0.txt.innerHTML = "<span class='gold'>No ID.</span> \"It's in the jet.\"";
        else {
          r0.txt.innerHTML = "NAME ON ID:<br><b>" + pr.idName + "</b>";
        }
      } else {
        drawBand(r0.g, pr, band, SK);
        const bk = pr.bandKind;
        const msg = { none: "No band. Bare wrist.", gold: "<span class='gold'>Gold VIP band.</span>", fakegold: "Gold band. A bit yellow. A bit crooked.", valid: "<b>" + band.name + "</b> stamp.", wrongcol: "A " + (band.col === "#39d0ff" ? "PINK" : "CYAN") + " " + band.glyph.toUpperCase() + " band.", wrongglyph: "A " + band.name.split(" ")[0] + " " + (band.glyph === "bolt" ? "STAR" : "BOLT") + " band.", marker: "A moon. In marker. Smudged." }[bk];
        r0.txt.innerHTML = msg;
      }
    };
    rows.list.btn.addEventListener("click", () => doCheck("list"));
    rows.id.btn.addEventListener("click", () => doCheck("id"));
    rows.band.btn.addEventListener("click", () => doCheck("band"));

    // ---------- decisions
    const setCount = n => { count = clamp(n, 1, cur ? Math.max(1, cur.size) : 1); cntEl.innerHTML = count + "<small>" + (count === 1 ? "PERSON" : "PEOPLE") + "</small>"; };
    bMinus.addEventListener("click", () => setCount(count - 1)); bPlus.addEventListener("click", () => setCount(count + 1));
    bAll.addEventListener("click", () => setCount(cur ? cur.size : 1));
    let decide = null;
    const yes = () => { if (decide && awaiting) decide("in"); }, no = () => { if (decide && awaiting) decide("out"); };
    bYes.addEventListener("click", yes); bNo.addEventListener("click", no);
    const keyHandler = (i) => { if (i === 0) doCheck("list"); else if (i === 1) doCheck("id"); else if (i === 2) doCheck("band"); else if (i === 3) yes(); else if (i === 4) no(); return true; };
    S.keyFn = keyHandler;
    S.extraKey = e => { if (e.key === "+" || e.key === "=" || e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setCount(count + 1); } else if (e.key === "-" || e.key === "_" || e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setCount(count - 1); } else if (e.key === "a" || e.key === "A") setCount(cur ? cur.size : 1); };
    const lockActs = on => { [bMinus, bPlus, bAll, bYes, bNo].forEach(b => { b.disabled = !on; }); Object.keys(rows).forEach(k => { rows[k].btn.disabled = !on; }); };
    lockActs(false);
    const speak = (pr, text, o = {}) => say.say(pr.label === "???" ? "STRANGER" : pr.label, text, Object.assign({ color: pr.vip ? "#ffd27a" : "#ffffff", pitch: 300 + (pr.seed % 250), speed: 75 }, o));

    // warm the sprites of whoever is next so arrivals/exits never hitch a frame
    const warmPerson = (pr) => {
      if (!pr) return;
      const jobs = [];
      [false, true].forEach(m => jobs.push(() => SK.warm(pr.def, { face: "front", mouth: m }, lightFront)));
      [0, 1, 2, 3].forEach(f => jobs.push(() => SK.warm(pr.def, { face: "front", act: "walk", frame: f }, lightFront)));
      [0, 1, 2, 3].forEach(f => jobs.push(() => SK.warm(pr.def, { face: "back", act: "walk", frame: f }, lightFront)));
      [0, 1, 2, 3].forEach(f => jobs.push(() => SK.warm(pr.def, { face: "left", act: "walk", frame: f }, lightFront)));
      ["happy", "sad", "angry"].forEach(e => jobs.push(() => SK.warm(pr.def, { face: "front", expr: e }, lightFront)));
      jobs.push(() => SK.warm(pr.def, { face: "front", blink: true }, lightFront));
      SK.warmQueue(S, jobs, 55);
    };
    // ---------- main loop
    people.forEach(q => queue.push(q));
    warmPerson(queue[0]);
    let decided = 0;
    while (queue.length && !S.dead) {
      const pr = queue[0];
      cur = pr; resetRows(); checks.list = checks.id = checks.band = false;
      anim.front = pr; anim.expr = ""; anim.talking = false;
      setCount(1);
      await runAnim("arrive", 0.7);
      anim.mode = "idle"; anim.talking = true;
      awaiting = true; lockActs(true);
      if (inside >= cap && !pr.reentry) bYes.disabled = true;
      SK.__last = { cur: { allowed: pr.allowed, size: pr.size, type: pr.type, vip: pr.vip, reentry: pr.reentry }, room: cap - inside, held };
      warmPerson(queue[1]);
      [queue[5], queue[6]].forEach(q => { if (q) SK.warmQueue(S, [() => SK.warm(q.def, { face: "front", act: "stand" }, lightQ), () => SK.warm(q.def, { face: "front", act: "phone" }, lightQ)], 70); });
      speak(pr, pr.claim);
      const choice = await new Promise(res => { decide = res; });
      decide = null; awaiting = false; lockActs(false); say.skip();
      heat = Math.max(0, heat - 55); mHeat.set(heat);
      // ----- evaluate
      total++;
      const room = cap - inside, n = count;
      let adm = 0;
      if (choice === "in") adm = pr.reentry ? n : Math.min(n, Math.max(0, room));
      if (choice === "in" && !pr.reentry && n > room) { floats.add("FULL!", 84, 60, "#ff6a6a", { sc: 2, life: 1.6 }); RP.sfx("error"); }
      if (!pr.reentry) { inside += adm; admittedTotal += adm; }
      if (pr.vip) held--;
      let verdict = "", reply = "";
      if (pr.allowed === 0) {
        if (adm === 0) { verdict = "good"; correct += 1; }
        else { verdict = "crash"; crashers += adm; }
      } else if (adm >= pr.allowed) {
        verdict = adm === pr.allowed ? "good" : "extra"; correct += adm === pr.allowed ? 1 : 0.6; if (adm > pr.allowed) crashers += adm - pr.allowed;
        if (pr.vip) vipsIn++;
      } else if (adm > 0) { verdict = "short"; correct += 0.4; angry++; }
      else { verdict = "miss"; angry += pr.vip ? 2 : 1; if (pr.vip) vipsMissed++; }
      const fakeish = ["fakevip", "imposter", "fakeband", "bribe", "stranger", "strangerPlus"].includes(pr.type);
      if (verdict === "good" && choice === "in") { reply = pr.type === "marcus" ? (diff >= 5 ? "THIRTY? We said... okay. Plus one. I'll tell them. They won't understand." : SK.pick(MARCUS_PART, rnd)) : SK.pick(ADMIT_REPLY, rnd); floats.add("+" + adm, 84, 58, "#9be15d", { sc: 2, life: 1.3, icon: "check" }); RP.sfx(pr.vip ? "cheer" : "ping"); anim.expr = "happy"; }
      else if (verdict === "good") { reply = fakeish ? SK.pick(DENY_FAKE, rnd) : SK.pick(DENY_REPLY, rnd); floats.add("GOOD CALL", 84, 58, "#9be15d", { sc: 2, life: 1.3, icon: "check" }); RP.sfx("ping"); anim.expr = "sad"; }
      else if (verdict === "crash") { reply = SK.pick(ADMIT_CRASH, rnd); floats.add("CRASHER IN!", 84, 58, "#ff6a6a", { sc: 2, life: 1.5, icon: "skull" }); RP.sfx("buzz"); anim.expr = "happy"; }
      else if (verdict === "extra") { reply = pr.type === "marcus" ? "Plus three! Thank you! ...Wait, what did the list say? Forget it. Thank you!" : SK.pick(ADMIT_CRASH, rnd); floats.add((adm - pr.allowed) + " TOO MANY", 84, 58, "#ffc44d", { sc: 2, life: 1.5 }); RP.sfx("buzz"); anim.expr = "happy"; }
      else if (verdict === "short") { reply = pr.type === "marcus" ? "It's my BIRTHDAY." : "Wait, what about my friends? They were right here. ...Fine."; floats.add("SHORT", 84, 58, "#ffc44d", { sc: 2, life: 1.3 }); RP.sfx("buzz"); anim.expr = "sad"; }
      else { // miss
        reply = pr.reentry ? "I was INSIDE. I have the stamp. This is the worst night of my life." : pr.vip ? SK.fmt(SK.pick(DENY_VIP, rnd), { dj: myName }) : SK.pick(DENY_REPLY, rnd);
        floats.add(pr.vip ? "VIP TURNED AWAY!" : "WRONG!", 84, 58, "#ff6a6a", { sc: 2, life: 1.6, icon: "cross" }); RP.sfx(pr.vip ? "boo" : "buzz"); anim.expr = "angry";
      }
      if (angry > 10) angry = 10;
      mIn.set(inside, inside + "/" + cap); mAng.set(angry, angry + "/10");
      anim.talking = true;
      await speak(pr, reply, { speed: 85 });
      await S.wait(380);
      anim.talking = false;
      await runAnim("exit", 0.55, adm > 0 ? "in" : "out");
      queue.shift(); anim.mode = "idle"; anim.front = null; cur = null; decided++;
      await S.wait(120, false);
    }
    // ---------- results
    const totalLegit = people.filter(q => q.allowed).length;
    const acc = total ? correct / total : 0;
    let score = Math.round(100 * acc - crashers * 3.2 - angry * 2 - vipsMissed * 22);
    score = clamp(score, 0, 100);
    const crashLimit = [4, 3, 3, 2, 2][diff - 1];
    const ok = vipsMissed === 0 && score >= 55 && crashers <= crashLimit + 3;
    if (!ok) score = Math.min(score, vipsMissed ? 49 : 74);
    const sc = score;
    anim.front = null; anim.mode = "idle";
    await S.wait(300);
    grid.style.display = "none"; wrap.querySelectorAll(".sk-tip").forEach(n => { n.style.display = "none"; });
    const title = vipsMissed ? "You bounced a VIP" : crashers > crashLimit ? "The room is... festive" : angry >= 5 ? "Door's closed. Reviews are mixed." : sc >= 85 ? "Immaculate door" : "Doors closed";
    const lines = [vipsMissed ? "A VIP stood outside in the cold. The fire marshal was less of a problem than the group chat." : crashers ? crashers + " crashers slipped through. \"I know the DJ\" worked " + crashers + " time" + (crashers > 1 ? "s" : "") + "." : "Nobody got in who shouldn't have. Marcus is still sulking."];
    const stats = [["INSIDE", inside + "/" + cap], ["VIPS IN", vipsIn + "/" + G.vipCount, vipsMissed ? "bad" : "ok"], ["CRASHERS", crashers, crashers ? "bad" : "ok"], ["ANGRY", angry, angry > 3 ? "bad" : ""]];
    const stamp = { w: 64, h: 24, k: 4, draw(g) { const col = ok ? "#9be15d" : "#ff6a6a"; R(g, 0, 0, 64, 24, "#0a0716"); R(g, 1, 1, 62, 22, col); R(g, 3, 3, 58, 18, "#0a0716"); txtC(g, ok ? "DOORS OK" : "DOORS SHUT", 32, 8, col, 2, 1); } };
    await SK.endCard(S, wrap, { kicker: venue.toUpperCase() + " · DOOR REPORT", title, lines, stats, score: sc, ok, stamp, rank: sc >= 90 ? "BEST BOUNCER" : sc >= 75 ? "SHARP DOOR" : sc >= 55 ? "ACCEPTABLE" : sc >= 35 ? "LEAKY" : "WIDE OPEN" });
    return { ok, score: sc, admitted: admittedTotal, angry, crashers, vipsIn, vipsMissed };
  }
}
})();
