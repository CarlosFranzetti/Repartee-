/* get.Followers — a week planner on a pixel phone. Three slots a day (morning, afternoon, night):
   post a clip, practice, dig records, network at a party, collab, or sleep. Random events: a clip
   goes viral, a hater, the algorithm changes, burnout, a very sketchy offer for 10,000 followers.
   Params (all optional): { days (7), start (followers), goal, difficulty 1..5, arcade }
   Result: { ok, score 0..100, gained (followers gained), followers (final), goal, energy, skill }
   ok = reached the goal. Never mutates RP.state. */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { el, clamp, R, P, ell, line, poly, mulberry, hashStr, ramp, txt, txtC, txtW, bayer } = U;
const K = ramp;

const CSS = `
.gf-grid { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "stage side" "log log"; gap: 12px; align-items: start; }
.gf-grid > .sk-stage { grid-area: stage; } .gf-grid > .gf-side { grid-area: side; } .gf-grid > .gf-log { grid-area: log; }
.gf-grid .sk-stage { margin: 0; }
.gf-side { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.gf-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.gf-stats .sk-meter { min-width: 0; }
.gf-status { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; font-size: 20px; }
.gf-status b { font-weight: 400; color: var(--cyan); }
.gf-status .algo { color: var(--amber); font-size: 17px; }
.gf-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.gf-day { background: #120e24; border: 1px solid var(--line); padding: 3px; display: flex; flex-direction: column; gap: 3px; text-align: center; font-size: 15px; color: var(--muted); letter-spacing: .06em; }
.gf-day.cur { border-color: var(--pink); color: var(--pink); }
.gf-day.past { opacity: .75; }
.gf-cell { height: 20px; display: flex; align-items: center; justify-content: center; font-size: 17px; color: #12061a; background: #0a0716; border: 1px solid #241d48; line-height: 1; }
.gf-cell.now { border-color: var(--pink); box-shadow: 0 0 0 1px var(--pink); }
.gf-acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.gf-act { display: grid; grid-template-columns: 22px minmax(0, 1fr); column-gap: 8px; text-align: left; align-items: start; font-family: var(--ui); font-size: 22px; line-height: 1; color: var(--fg); background: #120e24; border: 2px solid #2d2456; padding: 5px 8px; cursor: pointer; min-height: 52px; border-radius: 2px; }
.gf-act .k { color: var(--amber); }
.gf-act small { display: block; font-size: 15px; color: var(--muted); margin-top: 3px; letter-spacing: .03em; }
.gf-act small i { font-style: normal; color: #ff9a6a; }
.gf-act:hover:not(:disabled), .gf-act:focus-visible { border-color: var(--pink); background: #1c1030; outline: none; }
.gf-act:focus-visible { box-shadow: 0 0 0 2px var(--cyan); }
.gf-act:disabled { opacity: .4; cursor: default; }
.gf-ev { background: #120e24; border: 2px solid var(--amber); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.gf-ev h3 { margin: 0; font-family: var(--logo); font-weight: 400; font-size: 12px; letter-spacing: .04em; color: var(--amber); line-height: 1.5; }
.gf-ev p { margin: 0; font-size: 21px; line-height: 1.06; }
.gf-log { min-height: 1.2em; font-size: 21px; color: #ff8fcf; line-height: 1.05; }
@media (max-width: 959px) { .gf-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "stage" "side" "log"; } .gf-grid .sk-stage { margin: 0 auto; } }
@media (max-height: 460px) and (min-width: 560px) {
  .gf-grid { grid-template-columns: 330px minmax(0, 1fr); grid-template-areas: "stage side" "log side"; gap: 6px 10px; } .gf-grid .sk-stage { margin: 0; }
  .gf-side { gap: 5px; } .gf-status { font-size: 18px; } .gf-day { padding: 2px; font-size: 13px; gap: 2px; } .gf-cell { height: 14px; font-size: 14px; }
  .gf-act { min-height: 38px; font-size: 20px; padding: 3px 8px; } .gf-act small { font-size: 13px; margin-top: 1px; }
  .gf-ev { padding: 5px 8px; gap: 4px; } .gf-ev h3 { font-size: 10px; } .gf-ev p { font-size: 19px; } .gf-log { font-size: 19px; }
}
@media (max-width: 559px) { .gf-act { font-size: 21px; padding: 5px 6px; } .gf-act small { font-size: 14px; } .gf-day { font-size: 13px; } }
`;
let cssDone = false;

/* ------------------------------------------------------------------------------------------ model */
const ACT = {
  post:     { key: "P", label: "Post a clip", col: "#ff3fa4", cost: 12, note: "Followers. Needs material + skill." },
  practice: { key: "R", label: "Practice", col: "#39d0ff", cost: 15, note: "+Skill." },
  dig:      { key: "D", label: "Dig records", col: "#ffc44d", cost: 10, note: "+Material for clips." },
  network:  { key: "N", label: "Network at a party", col: "#9be15d", cost: 20, note: "+Contacts, some fans." },
  collab:   { key: "C", label: "Collab", col: "#b78aff", cost: 18, note: "Big gains. Needs a contact." },
  sleep:    { key: "Z", label: "Sleep", col: "#8c84b8", cost: -38, note: "+Energy." }
};
const ORDER = ["post", "practice", "dig", "network", "collab", "sleep"];
const SLOTS = ["MORNING", "AFTERNOON", "NIGHT"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const GOALS = [250, 330, 420, 520, 620];

function newGame(p, diffIn) {
  const diff = clamp(Math.round(diffIn || p.difficulty || 2), 1, 5);
  const start = Math.max(0, Math.round(p.start != null ? p.start : ((RP.state && RP.state.followers) || 0) || 120));
  const days = clamp(Math.round(p.days || 7), 3, 14);
  const goal = Math.round(p.goal != null ? p.goal : start + GOALS[diff - 1] * (days / 7));
  return { diff, start, days, goal, F: start, E: 85, K: 15, M: 20, H: 10, C: 0, day: 1, slot: 0, algo: null, bots: 0, botsFlag: false, postsToday: 0, postsYesterday: 0, viral: 0, hung: false, hist: [start], log: [], plan: [], lostSlot: false, posts: 0, today0: start, burned: 0 };
}
function algoMult(G, kind) {
  const a = G.algo; if (!a) return 1;
  if (kind === "post") return a.type === "clips" ? 1.4 : a.type === "studio" ? 0.7 : a.type === "spam" ? (G.postsToday >= 1 ? 0.55 : 1.15) : a.type === "collab" ? 0.8 : 1;
  if (kind === "collab") return a.type === "collab" ? 1.5 : 1;
  return 1;
}
/* resolve one activity; returns { dF, msg, sfx, tag } and mutates G */
function act(G, id, rnd) {
  const a = ACT[id], slot = G.slot;
  let dF = 0, msg = "", sfx = "ping", tired = G.E < 15;
  const rr = (lo, hi) => lo + (hi - lo) * rnd();
  if (id !== "sleep" && tired && rnd() < 0.3) { G.E = Math.min(100, G.E + 8); G.burned++; return { dF: 0, msg: "You stare at the screen. The screen stares back. Nothing happens.", sfx: "error", tag: "wasted" }; }
  const tm = tired && id !== "sleep" ? 0.5 : 1;
  G.E = clamp(G.E - a.cost, 0, 100);
  if (id === "post") {
    const q = 0.12 + 0.88 * Math.min(1, (G.K * 0.6 + G.M * 0.4) / 70);
    const fresh = G.M >= 15, qq = fresh ? q : Math.min(q, 0.3);
    const base = 20 + G.F * 0.05, sm = slot === 2 ? 1.2 : slot === 1 ? 1.05 : 0.95;
    const vir = G.viral > 0 ? 1.4 : 1;
    dF = Math.round(base * qq * (1 + G.H / 100) * algoMult(G, "post") * sm * vir * rr(0.75, 1.3) * tm);
    G.M = Math.max(0, G.M - 15); G.H = clamp(G.H + 6, 0, 100); G.postsToday++; G.posts++;
    msg = !fresh ? "You post an old bit again. People notice. Somewhat." : qq > 0.8 ? "A tight clip. The comments are mostly fire emojis." : "You post a clip. It does what clips do.";
    sfx = "camera";
  } else if (id === "practice") {
    const gain = (6 + (G.E > 50 ? 2 : 0)) * (1 - G.K / 135) * (slot === 0 ? 1.25 : 1) * tm;
    G.K = clamp(G.K + gain, 0, 100); G.H = clamp(G.H - 1, 0, 100);
    msg = G.K > 60 ? "Your blends are clean. Even the cat nods." : "You practice. Fifty minutes on one transition. It's still a little crooked.";
    sfx = "needle";
  } else if (id === "dig") {
    G.M = clamp(G.M + 28 * tm, 0, 100); G.H = clamp(G.H + 1, 0, 100);
    if (rnd() < 0.12) { G.M = clamp(G.M + 15, 0, 100); dF += 8; msg = "A dollar-bin gem: a clean copy of something you've been hunting. Content secured."; sfx = "success"; }
    else msg = "You flip through crates. Dust, mostly. And two heartbreakers.";
    if (sfx !== "success") sfx = "pickup";
  } else if (id === "network") {
    G.C = clamp(G.C + 1, 0, 5);
    dF = Math.round((10 + G.C * 3) * (slot === 2 ? 1.4 : 0.8) * tm * rr(0.8, 1.25)); G.H = clamp(G.H + 4, 0, 100);
    msg = slot === 2 ? "You work the party. Business cards, hugs, one questionable handshake." : "A daytime party. Brunch. Somehow still networking.";
    if (rnd() < 0.2) { G.E = clamp(G.E - 10, 0, 100); msg += " Hangover tomorrow."; }
    sfx = "glass";
  } else if (id === "collab") {
    const s = Math.min(1, G.K / 45);
    dF = Math.round((30 + G.C * 8 + G.F * 0.05) * (0.4 + 0.6 * s) * algoMult(G, "collab") * rr(0.8, 1.25) * tm);
    G.C = Math.max(0, G.C - 1); G.H = clamp(G.H + 10, 0, 100); G.M = clamp(G.M + 10, 0, 100);
    msg = s < 0.6 ? "The collab is... fine. Your partner mouths 'practice' at you." : "A collab clip. Two DJs, one very good loop. It travels.";
    sfx = "success";
  } else { // sleep
    G.E = clamp(G.E + (slot === 2 ? 8 : 0), 0, 100); G.H = clamp(G.H - 3, 0, 100);
    msg = "You sleep. In a bed. Like a person."; sfx = "whoosh";
  }
  G.F = Math.max(0, G.F + dF);
  if (G.E <= 0 && id !== "sleep") { const loss = Math.round(G.F * 0.06); G.F -= loss; G.E = 12; msg += " At 3 AM you post a rant. -" + loss + " followers. You sleep it off."; sfx = "buzz"; }
  return { dF, msg, sfx, tag: id };
}
function endOfDay(G) {
  let note = "";
  const passive = Math.round(G.H * 0.12 + G.F * 0.004);
  G.F += passive;
  if (G.postsToday === 0) { const l = Math.round(G.F * 0.015); G.F -= l; note = "A quiet day: -" + l + "."; }
  if (G.botsFlag && G.bots > 0) { const lost = Math.round(G.bots * 0.7); G.F = Math.max(0, G.F - lost); note += " The bots got purged: -" + lost + "."; G.bots = 0; G.botsFlag = false; G.H = clamp(G.H - 12, 0, 100); }
  G.H = clamp(G.H * 0.92, 0, 100);
  G.postsYesterday = G.postsToday; G.postsToday = 0;
  if (G.algo) { G.algo.days--; if (G.algo.days <= 0) G.algo = null; }
  if (G.viral > 0) G.viral--;
  G.hist.push(G.F);
  return { passive, note: note.trim() };
}

/* events: { id, w, cond(G), title, text, ch: [{ text, run(G, rnd) -> msg }] } */
const EV = [
  { id: "viral", w: 3, cond: G => G.posts > 0 && (G.postsToday + G.postsYesterday) > 0, title: "A CLIP GOES VIRAL", text: "One of your clips escapes into the wild. A stranger in Ohio is dancing to it. He is now your biggest fan.",
    ch: [{ text: "Ride it!", run: (G, r) => { const g = Math.round((50 + r() * 60) * (1 + G.K / 100)); G.F += g; G.H = clamp(G.H + 20, 0, 100); G.viral = 2; return "+" + g + " followers. Posts get a boost for two days."; } }] },
  { id: "hater", w: 3, cond: G => G.F > 80, title: "A HATER APPEARS", text: "\"Your transitions sound like a washing machine in a hurry.\" 14 likes. Several are bots.",
    ch: [{ text: "Reply with a joke (needs skill)", run: (G, r) => { if (G.K >= 30) { G.E = clamp(G.E - 6, 0, 100); G.F += 22; G.H = clamp(G.H + 6, 0, 100); return "Your reply is a banger. The hater deletes his account. +22."; } G.E = clamp(G.E - 6, 0, 100); G.F -= 10; return "The joke flops. The hater has a better one. -10."; } },
         { text: "Block, mute, breathe", run: (G) => { G.H = clamp(G.H - 2, 0, 100); return "You mute him. Your skin gets thicker by a micron."; } },
         { text: "Reply in all caps", run: (G, r) => { G.E = clamp(G.E - 10, 0, 100); if (r() < 0.5) { G.F += 30; return "It goes viral for the wrong reasons. +30. Don't do it again."; } G.F -= 14; return "A pile-on. -14. You regret everything."; } }] },
  { id: "algoGood", w: 2.4, cond: G => !G.algo, title: "THE ALGORITHM CHANGED", text: "The feed now LOVES short clips. For two days, posting is boosted. (It will change again. It always does.)",
    ch: [{ text: "Noted.", run: (G) => { G.algo = { type: "clips", days: 2, label: "CLIPS +40%" }; return "Posting is boosted for two days."; } }] },
  { id: "algoBad", w: 2.2, cond: G => !G.algo, title: "THE ALGORITHM CHANGED", text: "The feed now LOVES studio setups and hates everything else. Posting is weaker for two days. Time to network, dig and practice.",
    ch: [{ text: "Adapt.", run: (G) => { G.algo = { type: "studio", days: 2, label: "STUDIO POSTS -30%" }; return "Posting is weaker for two days."; } }] },
  { id: "algoSpam", w: 1.6, cond: G => !G.algo, title: "THE ALGORITHM CHANGED", text: "New rule: the feed punishes spam. The first post of a day is boosted. More than one a day is mud.",
    ch: [{ text: "One a day, then.", run: (G) => { G.algo = { type: "spam", days: 2, label: "1 POST/DAY" }; return "One good post a day. Two is a crime."; } }] },
  { id: "algoCollab", w: 1.4, cond: G => !G.algo, title: "THE ALGORITHM CHANGED", text: "The feed now loves collabs. Solo clips are out. Bring a friend.",
    ch: [{ text: "Call somebody.", run: (G) => { G.algo = { type: "collab", days: 2, label: "COLLABS +50%" }; return "Collabs are boosted for two days."; } }] },
  { id: "cat", w: 2, cond: G => true, title: "THE CAT CLIP", text: "Someone's cat walked across your keyboard mid-mix. The clip has 4,000 likes. You didn't make the clip. The cat did.",
    ch: [{ text: "Take the credit", run: (G) => { G.F += 24; return "+24 followers. The cat does not need credit."; } }] },
  { id: "lou", w: 1.5, cond: G => true, title: "LOU BANGS THE PIPE", text: "\"In 1993 we had one algorithm,\" Lou shouts through the wall. \"It was called Gary.\" It's weirdly useful.",
    ch: [{ text: "Thanks, Lou.", run: (G) => { G.K = clamp(G.K + 4, 0, 100); return "+4 skill. Gary is a role model now."; } }] },
  { id: "find", w: 2, cond: G => G.M < 70, title: "FREE CRATE ON THE CURB", text: "A milk crate of records, on a stoop, with a sign: \"FREE.\" The best kind of price.",
    ch: [{ text: "Grab it", run: (G) => { G.M = clamp(G.M + 30, 0, 100); return "+30 material. Half of it is gospel and half is regret."; } }] },
  { id: "shout", w: 2, cond: G => G.F > 60, title: "TWINKIE TAGGED YOU", text: "Twinkie shared your clip. Twinkie knows everyone. Everyone now knows you.",
    ch: [{ text: "Say thanks", run: (G) => { G.F += 40; G.C = clamp(G.C + 1, 0, 5); return "+40 followers, +1 contact."; } }] },
  { id: "bots", w: 1.8, cond: G => G.F > 0, title: "A VERY SKETCHY DM", text: "\"10,000 FOLLOWERS FOR $5!!!\" The sender's name is a string of numbers. Tempting, in a bad way.",
    ch: [{ text: "Buy 260 followers ($5)", run: (G) => { G.F += 260; G.bots = 260; G.botsFlag = true; return "+260 followers. For now. Bots don't stay."; } },
         { text: "Delete and report", run: (G) => { G.H = clamp(G.H + 6, 0, 100); return "You report the bot. Integrity is its own follower. (+hype)"; } }] },
  { id: "gig", w: 1.6, cond: G => G.K >= 35, title: "A FREE OPENING SLOT", text: "A venue needs an opener tonight. Twenty minutes. Free beer. The crowd is mostly the bar staff.",
    ch: [{ text: "Take it (-25 energy)", run: (G) => { G.E = clamp(G.E - 25, 0, 100); const g = Math.round(40 + G.K * 0.4); G.F += g; G.C = clamp(G.C + 1, 0, 5); G.H = clamp(G.H + 8, 0, 100); return "+" + g + " followers, +1 contact. The bartender claps once."; } },
         { text: "Pass. Sleep is a gig too.", run: (G) => { G.E = clamp(G.E + 8, 0, 100); return "You stay in. +8 energy."; } }] },
  { id: "rent", w: 1, cond: G => true, title: "THE LANDLORD TEXTS", text: "\"Re: the thing.\" You spend an hour on hold with a man who is also the landlord's cousin.",
    ch: [{ text: "Ugh.", run: (G) => { G.E = clamp(G.E - 10, 0, 100); return "-10 energy. Rent is a lifestyle."; } }] }
];
function rollEvents(G, rnd) {
  const out = [];
  if (G.E < 22) out.push({ id: "burnout", forced: true, title: "BURNOUT", text: "You wake up and stare at the ceiling for two hours. A pigeon judges you. Your morning slot is gone.", ch: [{ text: "Fine.", run: (G) => { G.E = clamp(G.E + 18, 0, 100); G.lostSlot = true; return "Morning lost. +18 energy. Plan some sleep."; } }] });
  const n = rnd() < 0.7 ? (rnd() < 0.25 ? 2 : 1) : 0;
  for (let i = 0; i < n; i++) {
    const pool = EV.filter(e => e.cond(G) && !out.find(o => o.id === e.id) && !(e.id.startsWith("algo") && out.find(o => o.id.startsWith("algo"))));
    const tot = pool.reduce((a, e) => a + e.w, 0); if (!pool.length) break;
    let r0 = rnd() * tot, pickE = pool[0];
    for (const e of pool) { r0 -= e.w; if (r0 <= 0) { pickE = e; break; } }
    out.push(pickE);
  }
  return out;
}
function score(G) {
  const progress = (G.F - G.start) / Math.max(1, G.goal - G.start);
  const sc = 80 * Math.min(1.25, Math.max(0, progress)) + (G.E >= 40 ? 4 : 0) + Math.min(6, G.K / 12) + (G.botsFlag ? -6 : 0);
  return clamp(Math.round(sc), 0, 100);
}

/* ------------------------------------------------------------------------------------------ phone drawing */
function fmtNum(n) { return Math.round(n).toLocaleString("en-US"); }
function phoneBg(W, H) {
  const cv = U.mk(W, H), c = cv.getContext("2d");
  c.fillStyle = "#07040f"; c.fillRect(0, 0, W, H);
  const k = K("#2a2640");
  U.R(c, 2, 1, W - 4, H - 2, "#0a0716"); U.R(c, 3, 2, W - 6, H - 4, k[2]); U.R(c, 3, 2, W - 6, 1, k[4]); U.R(c, 3, 2, 1, H - 4, k[3]); U.R(c, W - 4, 3, 1, H - 6, k[0]); U.R(c, 3, H - 3, W - 6, 1, k[0]);
  const sx = 7, sy = 7, sw = W - 14, sh = H - 14;
  U.R(c, sx, sy, sw, sh, "#120a2c");
  c.fillStyle = "#2a1450";
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if ((bayer(sx + x, sy + y) + 0.5) / 16 < y / sh * 0.6) c.fillRect(sx + x, sy + y, 1, 1);
  return cv;
}
function drawPhone(c, W, H, G, shown, ui, name) {
  if (!ui.bg) { ui.bg = phoneBg(W, H); try { ui.portrait = RP.chars.portrait("kid", 32); } catch (e) { ui.portrait = null; } }
  c.drawImage(ui.bg, 0, 0);
  const compact = W > H;
  const sx = 7, sy = 7, sw = W - 14, sh = H - 14;
  const flash = ui.flash > 0 ? Math.floor(performance.now() / 120) % 2 : 0;
  if (flash && !ui.reduced) { c.globalAlpha = 0.22; U.R(c, sx, sy, sw, sh, "#ff3fa4"); c.globalAlpha = 1; }
  // status bar
  txt(c, "9:41", sx + 2, sy + 2, "#c8c0e8", 1, 1);
  const bx = sx + sw - 16; U.R(c, bx, sy + 2, 12, 5, "#c8c0e8"); U.R(c, bx + 1, sy + 3, 10, 3, "#0a0716"); const bw = Math.round(10 * G.E / 100); U.R(c, bx + 1, sy + 3, bw, 3, G.E < 25 ? "#ff5a5a" : "#9be15d"); U.R(c, bx + 12, sy + 3, 1, 3, "#c8c0e8");
  if (compact) {
    // left: counter
    if (ui.portrait) { c.imageSmoothingEnabled = false; c.drawImage(ui.portrait, 0, 0, 32, 32, sx + 3, sy + 12, 16, 16); }
    txt(c, String(name).slice(0, 14), sx + 22, sy + 14, "#ffffff", 1, 1); txt(c, "@" + String(name).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12), sx + 22, sy + 21, "#8c84b8", 1, 1);
    txtC(c, fmtNum(shown), sx + 44, sy + 32, "#ffffff", 3, 1); txtC(c, "FOLLOWERS", sx + 44, sy + 50, "#8c84b8", 1, 1);
    // goal bar
    U.R(c, sx + 3, sy + 58, 82, 4, "#0a0716"); U.R(c, sx + 3, sy + 58, Math.round(82 * clamp(shown / G.goal, 0, 1)), 4, shown >= G.goal ? "#9be15d" : "#ff3fa4");
    sparkline(c, G, sx + 92, sy + 14, sw - 96, 38);
    if (ui.delta) txt(c, (ui.delta > 0 ? "+" : "") + ui.delta, sx + 92, sy + 54, ui.delta > 0 ? "#9be15d" : "#ff6a6a", 1, 1);
    txt(c, "GOAL " + fmtNum(G.goal), sx + 92, sy + 62, "#ffc44d", 1, 1);
  } else {
    if (ui.portrait) { c.imageSmoothingEnabled = false; c.drawImage(ui.portrait, 0, 0, 32, 32, sx + 3, sy + 12, 18, 18); }
    txt(c, String(name).slice(0, 12), sx + 24, sy + 15, "#ffffff", 1, 1); txt(c, "@" + String(name).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 11), sx + 24, sy + 22, "#8c84b8", 1, 1);
    txtC(c, fmtNum(shown), sx + sw / 2, sy + 40, "#ffffff", 3, 1); txtC(c, "FOLLOWERS", sx + sw / 2, sy + 58, "#8c84b8", 1, 1);
    if (ui.delta) txtC(c, (ui.delta > 0 ? "+" : "") + ui.delta, sx + sw / 2, sy + 66, ui.delta > 0 ? "#9be15d" : "#ff6a6a", 1, 1);
    // goal
    U.R(c, sx + 4, sy + 76, sw - 8, 5, "#0a0716"); U.R(c, sx + 4, sy + 76, Math.round((sw - 8) * clamp(shown / G.goal, 0, 1)), 5, shown >= G.goal ? "#9be15d" : "#ff3fa4"); txt(c, "GOAL " + fmtNum(G.goal), sx + 4, sy + 84, "#ffc44d", 1, 1);
    sparkline(c, G, sx + 4, sy + 94, sw - 8, 30);
    // posts grid
    const cols = ["#ff3fa4", "#39d0ff", "#ffc44d", "#9be15d", "#b78aff", "#ff8a3a"];
    for (let i = 0; i < 3; i++) { const tx = sx + 4 + i * 31, ty = sy + 130; const ci = (G.posts + i * 2) % cols.length, kk = K(cols[ci]); U.R(c, tx, ty, 28, 20, G.posts > i ? kk[2] : "#1a1236"); if (G.posts > i) { U.R(c, tx, ty, 28, 1, kk[4]); ell(c, tx + 14, ty + 9, 5, 5, kk[4]); U.R(c, tx + 3, ty + 15, 12, 1, kk[0]); } else txtC(c, "?", tx + 14, ty + 7, "#3a3070", 1, 1); }
    // algo chip
    if (G.algo) { U.R(c, sx + 3, sy + 154, sw - 6, 9, "#3a2a08"); txtC(c, G.algo.label.slice(0, 20), sx + sw / 2, sy + 156, "#ffc44d", 1, 1); }
    // nav
    for (let i = 0; i < 4; i++) U.R(c, sx + 12 + i * 22, sy + sh - 9, 8, 5, i === 0 ? "#ff3fa4" : "#3a3070");
  }
  // notification banner
  if (ui.note) {
    const t = ui.noteT, y = sy + (compact ? H - 24 : 10) + (t < 0.25 ? -(1 - t / 0.25) * 16 : 0);
    U.R(c, sx + 2, y, sw - 4, 15, "#0a0716"); U.R(c, sx + 2, y, sw - 4, 1, ui.noteCol || "#ff3fa4"); U.R(c, sx + 2, y + 14, sw - 4, 1, ui.noteCol || "#ff3fa4");
    const txts = ui.note.split("|");
    txt(c, txts[0].slice(0, Math.floor((sw - 8) / 4)), sx + 4, y + 3, "#ffffff", 1, 1); if (txts[1]) txt(c, txts[1].slice(0, Math.floor((sw - 8) / 4)), sx + 4, y + 9, ui.noteCol || "#ff8fcf", 1, 1);
  }
  // floating numbers
  ui.floats.draw(c, ui.dt || 0.016);
}
function sparkline(c, G, x, y, w, h) {
  U.R(c, x, y, w, h, "#0a0716");
  for (let g = 1; g < 4; g++) for (let xx = x; xx < x + w; xx += 3) U.P(c, xx, y + Math.round(h * g / 4), "#1c1438");
  const pts = G.hist.slice(); const lo = Math.min(G.start, ...pts), hi = Math.max(G.goal, ...pts), rngV = Math.max(1, hi - lo);
  const n = Math.max(2, G.days + 1);
  let prev = null;
  pts.forEach((v, i) => { const px = x + 2 + Math.round((w - 5) * i / (n - 1)), py = y + h - 3 - Math.round((h - 6) * (v - lo) / rngV); if (prev) U.line(c, prev[0], prev[1], px, py, "#ff3fa4"); prev = [px, py]; U.R(c, px - 1, py - 1, 3, 3, "#ffd6ef"); });
  const gy = y + h - 3 - Math.round((h - 6) * (G.goal - lo) / rngV); for (let xx = x; xx < x + w; xx += 4) U.P(c, xx, gy, "#ffc44d");
}

/* ------------------------------------------------------------------------------------------ the game */
RP.mg.register("getFollowers", {
  title: "get.Followers", order: 10,
  desc: "Plan the week: post, practice, dig, network, collab, sleep. Don't burn out.",
  sim: { newGame, act, endOfDay, rollEvents, score, EV },
  auto(p) { const G = newGame(p || {}); return { ok: true, score: 82, gained: Math.round(G.goal - G.start), followers: G.goal, goal: G.goal }; },
  async play(host, p) {
    const SK = RP.social;
    if (!SK) return { ok: false, score: 0, gained: 0, error: "socialkit_lib missing" };
    try { return await run(host, p || {}, SK); }
    catch (e) { console.error("getFollowers", e); return { ok: false, score: 0, gained: 0, error: String(e) }; }
  }
});

async function run(host, p, SK) {
  if (!cssDone) { el("style", { text: CSS }, document.head); cssDone = true; }
  SK.css();
  const S = SK.session(host), root = host.root;
  try { host.ov.classList.add("sk-g"); } catch (e) { /* ignore */ }
  const G = newGame(p);
  const rnd = Math.random;
  const name = SK.djName();
  const head = host.header("get.Followers", (p.arcade ? "Arcade · " : "") + G.days + " days");
  head.classList.add("sk-head");
  let leaveRes = null;
  const leaveP = new Promise(res => { leaveRes = res; });
  SK.leave(host, head, S, () => leaveRes({ ok: false, score: 0, gained: G.F - G.start, followers: G.F, goal: G.goal, left: true }));
  const wrap = el("div", { cls: "sk-wrap" }, root);
  return Promise.race([leaveP, flow()]);

  async function flow() {
    await SK.intro(S, wrap, {
      kicker: "THE WEEK AHEAD",
      title: "Go get followers",
      lead: "You have " + G.days + " days and " + fmtNum(G.start) + " followers. The goal: " + fmtNum(G.goal) + ".",
      steps: [
        "Every day has <b>three slots</b>: morning, afternoon, night. Pick an activity for each (click, or press <b>1</b>–<b>6</b>).",
        "<b>Posting</b> brings followers but needs <b>material</b> (dig) and <b>skill</b> (practice). Night posts do best.",
        "<b>Networking</b> earns contacts; <b>collabs</b> spend them for big gains. <b>Sleep</b> or burn out.",
        "Events happen: viral clips, haters, algorithm changes, a very sketchy offer. Adapt."
      ],
      pill: "DIFFICULTY " + G.diff,
      button: "START THE WEEK"
    });
    const wide = (document.documentElement.clientWidth || 800) >= 960;
    const grid = el("div", { cls: "gf-grid" }, wrap);
    const cvApi = wide ? SK.canvas(grid, 120, 176, 2) : SK.canvas(grid, 160, 76, 2, 2);
    cvApi.noSide = true; cvApi.fit();
    const side = el("div", { cls: "gf-side" }, grid);
    const stats = el("div", { cls: "gf-stats" }, side);
    const mE = SK.meter(stats, { label: "ENERGY", color: "#9be15d", max: 100, value: G.E });
    const mK = SK.meter(stats, { label: "SKILL", color: "#39d0ff", max: 100, value: G.K });
    const mM = SK.meter(stats, { label: "MATERIAL", color: "#ffc44d", max: 100, value: G.M });
    const status = el("div", { cls: "gf-status" }, side);
    const week = el("div", { cls: "gf-week" }, side);
    const cells = [];
    for (let d = 0; d < G.days; d++) { const col = el("div", { cls: "gf-day" }, week); el("span", { text: DAYS[d % 7] }, col); const cs = []; for (let s = 0; s < 3; s++) cs.push(el("div", { cls: "gf-cell", text: "" }, col)); cells.push({ col, cs }); }
    const panel = el("div", {}, side);
    const logEl = el("div", { cls: "gf-log" }, grid);
    el("div", { cls: "sk-tip", text: "Keys 1-6 pick an activity · each day: morning, afternoon, night" }, wrap);
    // ---------- phone
    const c = cvApi.c, W = cvApi.w, H = cvApi.h;
    const ui = { flash: 0, note: "", noteT: 0, noteCol: "#ff3fa4", delta: 0, deltaT: 0, floats: SK.floats(), reduced: SK.reduced(), dt: 0.016 };
    let shown = G.F, last = performance.now(), tickAcc = 0;
    host.raf(t => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t; ui.dt = dt;
      try {
        if (shown !== G.F) { const diff = G.F - shown, stepN = Math.max(1, Math.round(Math.abs(diff) * Math.min(1, dt * 3.5))); shown += Math.sign(diff) * Math.min(Math.abs(diff), stepN); tickAcc += dt; if (tickAcc > 0.07 && !SK.reduced()) { tickAcc = 0; if (diff > 0) RP.audio.tone(900 + Math.min(600, shown % 40 * 15), 0.02, "square", 0.01); } if (SK.reduced()) shown = G.F; }
        if (ui.flash > 0) ui.flash -= dt;
        if (ui.note) { ui.noteT += dt; if (ui.noteT > 2.6) ui.note = ""; }
        if (ui.delta && (ui.deltaT -= dt) < 0) ui.delta = 0;
        drawPhone(c, W, H, G, shown, ui, name);
      } catch (e) { /* never throw */ }
    });
    const notify = (text, col) => { ui.note = text; ui.noteT = 0; ui.noteCol = col || "#ff3fa4"; };
    const setStats = () => { mE.set(G.E); mK.set(G.K); mM.set(G.M); };
    const GLYPH = { post: "P", practice: "R", dig: "D", network: "N", collab: "C", sleep: "Z", skip: "-" };
    const paintStatus = () => {
      status.textContent = "";
      el("span", { html: "DAY <b>" + G.day + "/" + G.days + "</b> · <b>" + SLOTS[G.slot] + "</b>" }, status);
      el("span", { html: "CONTACTS <b>" + G.C + "</b>" }, status);
      if (G.algo) el("span", { cls: "algo", text: "ALGO: " + G.algo.label + " (" + G.algo.days + "d)" }, status);
      cells.forEach((cc, d) => { cc.col.classList.toggle("cur", d === G.day - 1); cc.col.classList.toggle("past", d < G.day - 1); cc.cs.forEach((cel, s) => { cel.classList.toggle("now", d === G.day - 1 && s === G.slot); }); });
    };
    const paintCell = (d, s, id) => { const cel = cells[d].cs[s]; cel.textContent = GLYPH[id] || ""; cel.style.background = id === "skip" ? "#3a1818" : ACT[id] ? ACT[id].col : "#0a0716"; };
    const addF = (n) => { ui.delta = n; ui.deltaT = 2.2; if (n) ui.floats.add((n > 0 ? "+" : "") + n, W / 2, wide ? 44 : 28, n > 0 ? "#9be15d" : "#ff6a6a", { sc: 1, life: 1.4, rise: 10 }); };
    const say = (t) => { logEl.textContent = t; };

    // ---------- choose an activity for the current slot
    const pickActivity = () => new Promise(res => {
      panel.textContent = "";
      const box = el("div", { cls: "gf-acts" }, panel);
      const btns = ORDER.map((id, i) => {
        const a = ACT[id], b = el("button", { cls: "gf-act", type: "button" }, box);
        el("span", { cls: "k", text: String(i + 1) }, b);
        const t = el("span", {}, b); t.appendChild(document.createTextNode(a.label));
        const sm = el("small", { html: a.note + " <i>" + (a.cost > 0 ? "-" + a.cost : "+" + (G.slot === 2 ? 46 : 38)) + " energy</i>" }, t);
        if (id === "collab" && G.C < 1) { b.disabled = true; sm.textContent = "Needs a contact. Go network first."; }
        b.addEventListener("click", () => choose(i));
        return b;
      });
      let done = false;
      const choose = i => { if (done || btns[i].disabled) return false; done = true; S.keyFn = null; RP.sfx("select"); res(ORDER[i]); return true; };
      S.keyFn = choose;
      try { btns.find(b => !b.disabled).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    });
    const showEvent = async (ev) => {
      panel.textContent = "";
      const box = el("div", { cls: "gf-ev" }, panel);
      el("h3", { text: ev.title }, box); el("p", { text: ev.text }, box);
      const choices = el("div", {}, box);
      RP.sfx(ev.id === "viral" ? "cheer" : ev.id === "hater" || ev.id === "bots" ? "buzz" : ev.id === "burnout" ? "fail" : "ping");
      if (ev.id === "viral") ui.flash = 1.4;
      notify(ev.title.slice(0, 26) + "|" + (ev.id === "viral" ? "WOW" : "NEW EVENT"), ev.id === "viral" ? "#9be15d" : "#ffc44d");
      const r = await SK.choices(S, choices, ev.ch.map(c0 => ({ text: c0.text })), { label: ev.title });
      const before = G.F;
      const msg = ev.ch[r.index].run(G, rnd);
      addF(G.F - before); setStats();
      say(msg);
      panel.textContent = "";
      await S.wait(900);
    };

    // ---------- the week
    for (G.day = 1; G.day <= G.days; G.day++) {
      G.today0 = G.F; G.lostSlot = false;
      const evs = rollEvents(G, rnd);
      paintStatus();
      for (const ev of evs) { G.slot = 0; paintStatus(); await showEvent(ev); }
      for (G.slot = 0; G.slot < 3; G.slot++) {
        paintStatus(); setStats();
        if (G.lostSlot && G.slot === 0) { paintCell(G.day - 1, 0, "skip"); say("Slot lost to the ceiling."); await S.wait(500); continue; }
        say(G.E < 15 ? "You're running on fumes. Everything works at half strength." : "What's the plan for the " + SLOTS[G.slot].toLowerCase() + "?");
        const choiceId = await pickActivity();
        panel.textContent = "";
        const r = act(G, choiceId, rnd);
        paintCell(G.day - 1, G.slot, r.tag === "wasted" ? "skip" : choiceId);
        setStats(); addF(r.dF);
        RP.sfx(r.sfx);
        notify((choiceId === "post" ? "NEW POST" : ACT[choiceId].label.toUpperCase()).slice(0, 26) + "|" + (r.dF ? (r.dF > 0 ? "+" : "") + r.dF + " FOLLOWERS" : "ENERGY " + Math.round(G.E)), r.dF < 0 ? "#ff6a6a" : "#ff3fa4");
        say(r.msg + (r.dF ? " (" + (r.dF > 0 ? "+" : "") + r.dF + ")" : ""));
        await S.wait(1100);
      }
      G.slot = 2;
      const eod = endOfDay(G);
      shown = shown; paintStatus(); setStats();
      if (eod.passive || eod.note) { addF(eod.passive); say("Day " + G.day + " done. " + (eod.passive ? "Passive growth: +" + eod.passive + ". " : "") + eod.note); notify("DAY " + G.day + " DONE|+" + eod.passive + " PASSIVE", "#39d0ff"); await S.wait(1000); }
      if (G.F >= G.goal * 1.6 && G.day < G.days) { /* way ahead: keep playing, no early exit */ }
    }
    panel.textContent = "";
    await S.wait(600);
    const gained = G.F - G.start, ok = G.F >= G.goal, sc = score(G);
    grid.style.display = "none"; wrap.querySelectorAll(".sk-tip").forEach(n => { n.style.display = "none"; });
    const burned = G.E < 15;
    const title = ok ? (G.F >= G.goal * 1.3 ? "You blew up (a little)" : "Goal reached") : burned ? "Burned out" : "So close";
    const lines = [ok ? "You made it to " + fmtNum(G.F) + " followers. Lou asks what a follower is. You explain. He says, \"So, a regular.\"" : "You ended the week at " + fmtNum(G.F) + ". The goal was " + fmtNum(G.goal) + ". The algorithm sends its regards."];
    const stamp = { w: 64, h: 24, k: 4, draw(g) { const col = ok ? "#9be15d" : "#ff6a6a"; R(g, 0, 0, 64, 24, "#0a0716"); R(g, 1, 1, 62, 22, col); R(g, 3, 3, 58, 18, "#0a0716"); txtC(g, ok ? "GOAL MET" : "MISSED", 32, 8, col, 2, 1); } };
    await SK.endCard(S, wrap, { kicker: "WEEK IN REVIEW", title, lines, stats: [["FOLLOWERS", fmtNum(G.F), ok ? "ok" : ""], ["GAINED", (gained >= 0 ? "+" : "") + fmtNum(gained), gained > 0 ? "ok" : "bad"], ["SKILL", Math.round(G.K)], ["ENERGY", Math.round(G.E), G.E < 15 ? "bad" : ""]], score: sc, ok, stamp, rank: sc >= 90 ? "INFLUENCER" : sc >= 75 ? "RISING" : sc >= 55 ? "GROWING" : sc >= 35 ? "LOCAL" : "LURKER" });
    return { ok, score: sc, gained, followers: G.F, goal: G.goal, energy: Math.round(G.E), skill: Math.round(G.K) };
  }
}
})();
