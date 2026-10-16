/* after.Party — 4 AM, the party is dying, sunrise is coming. Use your dying phone to recruit people,
   lock down a location and borrow a sound system, then get everyone there before the sun is up.
   Params (all optional):
     { needs: { people: guests needed (default by difficulty), location: true | "roof"|"laundromat"|"loft"|"bodega" (preferred),
                sound: true | "speaker"|"boombox"|"car"|"pa" (preferred) },
       contacts: ["Twinkie","Marcus", ...] names that start visible on the phone (unknown names become friends who bring people),
       time: minutes until sunrise (default by difficulty), difficulty: 1..5 }
   Result: { ok, score (0..100), guests }
   Resources: battery %, cash, favors, minutes. ok = place + sound + enough guests, before sunrise. */
(function () {
"use strict";
const RP = window.RP;
const { R, P, ell, line, poly, txt, txtC, bayer, ramp, mulberry, clamp, el, mix } = RP.u;

const CSS = `
.ap-main { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "hud" "stage" "plan" "phone" "msg" "acts"; gap: 8px 10px; align-items: start; }
.ap-main.wide { grid-template-columns: 640px minmax(0, 1fr); grid-template-areas: "hud phone" "stage phone" "plan phone" "msg phone" "acts phone"; grid-template-rows: auto auto auto auto 1fr; }
.ap-main > * { min-width: 0; }
.ap-hud { grid-area: hud; } .ap-stage { grid-area: stage; } .ap-plan { grid-area: plan; } .ap-phone { grid-area: phone; } .ap-msg { grid-area: msg; } .ap-acts { grid-area: acts; }
.ap-hud { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-chip { background: #120e24; border: 1px solid var(--line); border-radius: 3px; padding: 2px 8px; font-size: 19px; color: var(--fg); display: flex; align-items: center; gap: 6px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.ap-chip small { font-size: 15px; color: var(--muted); letter-spacing: .06em; }
.ap-chip.low { border-color: #ff6a6a; color: #ff8a8a; }
.ap-chip.sun { border-color: var(--amber); color: var(--amber); }
.ap-bat { width: 30px; height: 12px; border: 2px solid currentColor; position: relative; box-sizing: border-box; }
.ap-bat::after { content: ""; position: absolute; right: -5px; top: 2px; width: 3px; height: 4px; background: currentColor; }
.ap-bat i { display: block; height: 100%; background: currentColor; }
.ap-stage { background: #000; border: 1px solid var(--line); line-height: 0; width: fit-content; max-width: 100%; margin-inline: auto; justify-self: center; }
.ap-main.wide .ap-stage { margin-inline: 0; justify-self: start; }
.ap-scene { display: block; }
.ap-plan { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.ap-slot { background: #0f0b20; border: 1px solid #241d48; border-radius: 3px; padding: 5px 8px; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ap-slot b { font-weight: 400; font-size: 15px; letter-spacing: .1em; color: var(--muted); display: flex; justify-content: space-between; }
.ap-slot span { font-size: 19px; line-height: 1.05; color: var(--fg); min-height: 1.1em; overflow-wrap: anywhere; }
.ap-slot small { font-size: 15px; color: var(--muted); line-height: 1; }
.ap-slot.done { border-color: #2a6a46; } .ap-slot.done b { color: var(--ok); }
.ap-slot.warn { border-color: #6a4a1a; } .ap-slot.warn small { color: var(--amber); }
.ap-go { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ap-go .btn { font-size: 22px; }
.ap-phone { box-sizing: border-box; background: #05030c; border: 3px solid #2a2450; border-radius: 22px; padding: 8px 8px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 0 0 1px #0a0716, 0 0 28px rgba(98, 230, 255, .06); max-width: 380px; width: 100%; margin-inline: auto; }
.ap-phone::before { content: ""; align-self: center; width: 46px; height: 5px; border-radius: 3px; background: #1a1536; }
.ap-status { display: flex; justify-content: space-between; align-items: center; font-size: 17px; color: var(--muted); padding: 0 6px; }
.ap-status .ap-bat { width: 22px; height: 10px; border-width: 1px; } .ap-status .ap-bat::after { top: 2px; height: 3px; right: -4px; }
.ap-status .sig { letter-spacing: 1px; color: var(--cyan); }
.ap-screen { background: linear-gradient(#0e0a22, #0a0718); border: 1px solid #1d1740; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 330px; max-height: 440px; overflow-y: auto; }
.ap-main.wide .ap-screen { height: 430px; max-height: none; }
.ap-screen h3 { margin: 0; font-weight: 400; font-size: 18px; letter-spacing: .12em; color: var(--muted); display: flex; justify-content: space-between; align-items: baseline; }
.ap-list { display: flex; flex-direction: column; gap: 4px; }
.ap-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 8px; align-items: center; text-align: left; font-family: var(--ui); background: #120e24; border: 1px solid #241d48; color: var(--fg); padding: 3px 8px 3px 4px; cursor: pointer; border-radius: 3px; min-height: 38px; }
.ap-row:hover { border-color: var(--pink); }
.ap-row canvas { width: 30px; height: 30px; image-rendering: pixelated; background: #1a1536; border-radius: 2px; }
.ap-row .n { font-size: 20px; line-height: 1; } .ap-row .t { font-size: 15px; color: var(--muted); line-height: 1; display: block; }
.ap-row .s { font-size: 15px; color: var(--cyan); }
.ap-row.act { grid-template-columns: minmax(0, 1fr) auto; background: #151030; border-style: dashed; }
.ap-row.act.go { background: #2a0f2e; border-color: var(--pink); }
.ap-row:disabled { opacity: .45; cursor: default; } .ap-row:disabled:hover { border-color: #241d48; }
.ap-quick { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
.ap-q { font-family: var(--ui); background: #151030; border: 1px dashed #3a3070; border-radius: 3px; color: var(--fg); padding: 4px 4px 3px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; text-align: center; line-height: 1; min-width: 0; }
.ap-q b { font-weight: 400; font-size: 17px; } .ap-q .c { font-size: 14px; display: flex; gap: 5px; justify-content: center; min-height: 1em; } .ap-q .c i { font-style: normal; } .ap-q .why { font-size: 14px; color: var(--amber); }
.ap-q:hover:not(:disabled) { border-color: var(--cyan); color: var(--cyan); } .ap-q:disabled { opacity: .5; cursor: default; }
.ap-who { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 10px; align-items: center; }
.ap-who canvas { width: 56px; height: 56px; image-rendering: pixelated; background: #1a1536; border: 1px solid #2a2250; border-radius: 3px; }
.ap-who .n { font-size: 24px; line-height: 1; } .ap-who .t { font-size: 16px; color: var(--muted); }
.ap-bubble { background: #1a1236; border: 1px solid #3a2a6a; border-radius: 6px; padding: 6px 9px; font-size: 20px; line-height: 1.08; color: #e4ddff; }
.ap-bubble.me { background: #0f2a3a; border-color: #1f5a78; color: #cdf3ff; align-self: flex-end; max-width: 92%; }
.ap-bubble.ev { background: #2a1030; border-color: var(--pink); }
.ap-opt { display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; font-family: var(--ui); font-size: 20px; line-height: 1.05; background: #1a1534; color: var(--fg); border: 1px solid #3a3070; border-radius: 3px; padding: 6px 9px; cursor: pointer; }
.ap-opt:hover:not(:disabled) { border-color: var(--cyan); color: var(--cyan); }
.ap-opt:disabled { opacity: .45; cursor: default; }
.ap-opt .c { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; font-size: 15px; white-space: nowrap; }
.ap-opt .c i { font-style: normal; } .c .m { color: var(--cyan); } .c .b { color: var(--amber); } .c .d { color: var(--lime); } .c .f { color: var(--pink); }
.ap-opt .why { display: block; font-size: 15px; color: var(--amber); margin-top: 1px; }
.ap-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.ap-chips span { font-size: 16px; padding: 0 6px; border-radius: 2px; border: 1px solid #3a3070; color: var(--fg); background: #130f2a; }
.ap-chips .g { border-color: #2a6a46; color: var(--ok); } .ap-chips .x { border-color: #6a2a3a; color: #ff8a8a; }
.ap-back { align-self: flex-start; }
.ap-msg { min-height: 2.2em; }
.ap-legend { font-size: 16px; color: var(--muted); line-height: 1.05; }
.ap-main.compact { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "hud phone" "stage phone" "plan phone" "msg phone" "acts phone"; grid-template-rows: auto auto auto auto 1fr; gap: 4px 8px; }
.ap-main.compact .ap-stage { margin: 0; justify-self: start; }
.ap-main.compact .ap-hud { gap: 4px; flex-wrap: nowrap; } .ap-main.compact .ap-chip { padding: 1px 5px; font-size: 16px; gap: 3px; white-space: nowrap; } .ap-main.compact .ap-chip small { display: none; } .ap-main.compact .ap-bat { width: 22px; height: 9px; }
.ap-main.compact .ap-plan { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; } .ap-main.compact .ap-slot { display: block; padding: 2px 5px; } .ap-main.compact .ap-slot b { width: auto; font-size: 13px; display: flex; } .ap-main.compact .ap-slot span { font-size: 15px; line-height: 1; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ap-main.compact .ap-slot small { display: none; }
.ap-main.compact .ap-msg { min-height: 0; font-size: 15px; line-height: 1; overflow: hidden; max-height: 2em; }
.ap-main.compact .ap-phone { padding: 4px 6px 6px; border-radius: 14px; max-width: 440px; justify-self: start; width: 100%; gap: 3px; } .ap-main.compact .ap-phone::before { display: none; } .ap-main.compact .ap-status { font-size: 15px; }
.ap-main.compact .ap-screen { height: auto; flex: 1 1 0; min-height: 0; max-height: none; padding: 5px; gap: 4px; } .ap-main.compact .ap-row { min-height: 32px; } .ap-main.compact .ap-bubble { font-size: 18px; padding: 4px 7px; } .ap-main.compact .ap-opt { font-size: 18px; padding: 4px 8px; } .ap-main.compact .ap-who canvas { width: 40px; height: 40px; } .ap-main.compact .ap-who { grid-template-columns: 40px minmax(0, 1fr); } .ap-main.compact .ap-legend { display: none; }
@media (max-width: 860px) { .ap-plan { grid-template-columns: 1fr; gap: 4px; } .ap-slot { flex-direction: row; justify-content: space-between; align-items: center; gap: 8px; } .ap-slot b { flex: none; width: 70px; } .ap-slot span { flex: 1; } .ap-slot small { display: none; } .ap-screen { max-height: none; } }
@media (prefers-reduced-motion: reduce) { .ap-scene { } }
`;

/* ------------------------------------------------------------------ data */
const LOCS = {
  roof: { id: "roof", name: "The roof at 214 Dekalb", short: "the roof", who: "Gus", cap: 30, vibe: 4, up: true, ground: false, power: false, cops: 0.35, blurb: "Water tower, skyline, no outlets. Fits thirty." },
  laundromat: { id: "laundromat", name: "SudsCity Laundromat (after close)", short: "the laundromat", who: "Luz", cap: 22, vibe: 3, up: false, ground: true, power: true, cops: 0.2, blurb: "Warm, bright, and every dryer is a drum machine. Fits twenty-two." },
  loft: { id: "loft", name: "Mina's third-floor loft", short: "Mina's loft", who: "Mina", cap: 45, vibe: 5, up: true, ground: false, power: true, cops: 0.6, blurb: "Huge. Neighbors are not fans. No elevator worth trusting." },
  street: { id: "street", name: "The sidewalk outside the bodega", short: "the sidewalk", who: "", cap: 16, vibe: 1, up: false, ground: true, power: false, cops: 0.4, blurb: "Right here. Free. Very public." },
  bodega: { id: "bodega", name: "Hamid's bodega back room", short: "the bodega back room", who: "Hamid", cap: 12, vibe: 3, up: false, ground: true, power: true, cops: 0.05, blurb: "Fits twelve if nobody breathes. There is a cat." }
};
const SNDS = {
  speaker: { id: "speaker", name: "Cal's party speaker", short: "the speaker", q: 2, battery: true, heavy: false, note: "small, battery-powered" },
  boombox: { id: "boombox", name: "Lou's boombox", short: "Lou's boombox", q: 2, battery: true, heavy: false, nostalgia: true, note: "cassette, aux, 1993" },
  car: { id: "car", name: "Rafa's hatchback stereo", short: "the car stereo", q: 4, car: true, heavy: false, note: "big bass, street level only" },
  phone: { id: "phone", name: "A phone speaker on a stoop", short: "a phone speaker", q: 1, note: "tiny" },
  pa: { id: "pa", name: "Eddie's PA", short: "Eddie's PA", q: 5, heavy: true, note: "loud, heavy, a two-time deal" }
};
const NAME_LOC = { gus: "roof", luz: "laundromat", mina: "loft", hamid: "bodega" };

const LOOKS = {
  priya: { id: "ap_priya", name: "Priya", hair: { style: "ponytail", color: "#1c1418" }, top: { style: "vest", color: "#17131f", color2: "#efeaf6" }, acc: ["lanyard"], skin: "#b07650", figure: "curvy" },
  devanya: { id: "ap_anya", name: "Dev & Anya", hair: { style: "bun", color: "#c0302c" }, top: { style: "cardigan", color: "#3a5a8a", color2: "#efe6d0" }, acc: ["glasses"], skin: "#e8b48f", figure: "curvy" },
  biscuit: { id: "ap_biscuit", name: "Biscuit", hair: { style: "mohawk", color: "#ff6cbb" }, top: { style: "hoodie", color: "#7a3fb0" }, acc: ["earring"], skin: "#f1c7a5", figure: null },
  cal: { id: "ap_cal", name: "Cal", hair: { style: "short", color: "#3a2014" }, top: { style: "tee", color: "#2f62b8" }, acc: ["cap"], skin: "#c98a62", figure: null },
  rafa: { id: "ap_rafa", name: "Rafa", hair: { style: "slick", color: "#1c1418" }, top: { style: "bomber", color: "#c0302c", color2: "#17131f" }, acc: ["shades", "chain"], skin: "#8d5a3b", figure: null },
  gus: { id: "ap_gus", name: "Gus", hair: { style: "short", color: "#9a9aa6" }, top: { style: "jacket", color: "#3a4a5a" }, acc: ["cap"], facial: "mustache", facialColor: "#b8b8c4", build: "stocky", skin: "#e0a27a", figure: null },
  luz: { id: "ap_luz", name: "Luz", hair: { style: "curly", color: "#2e1d16" }, top: { style: "apron", color: "#5a8ad8" }, acc: [], skin: "#b07650", figure: "curvy" },
  mina: { id: "ap_mina", name: "Mina", hair: { style: "bob", color: "#5a8ad8" }, top: { style: "cardigan", color: "#c8b0ff", color2: "#17131f" }, acc: ["glasses"], skin: "#f1c7a5", figure: "curvy" },
  hamid: { id: "ap_hamid", name: "Hamid", hair: { style: "short", color: "#1c1418" }, top: { style: "apron", color: "#3a6a4a" }, acc: [], facial: "mustache", facialColor: "#1c1418", skin: "#c98a62", figure: null, build: "stocky" }
};

const pick = (a, rnd) => a[Math.floor((rnd || Math.random)() * a.length)];
const hN = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

RP.mg.register("afterParty", {
  title: "after.Party", order: 14,
  desc: "4 AM, dying phone: find people, a place and a sound system before sunrise.",
  auto(p) { const n = (p && p.needs && p.needs.people) || 16; return { ok: true, score: 80, guests: Math.round(n * 1.1) }; },
  async play(host, p) {
    const NK = RP.nightkit;
    NK.css("ap-css", CSS);
    p = p || {};
    const reduced = NK.reduced();
    const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
    const rnd = Math.random;
    const needs = p.needs || {};
    const NEED = Math.max(4, Math.round(needs.people || [10, 14, 17, 20, 23][diff - 1]));
    const wantLoc = typeof needs.location === "string" ? needs.location.toLowerCase() : null;
    const wantSnd = typeof needs.sound === "string" ? needs.sound.toLowerCase() : null;
    const needLoc = needs.location !== false, needSnd = needs.sound !== false;
    const T0 = Math.round(Number(p.time) > 0 ? Number(p.time) : [135, 120, 105, 92, 80][diff - 1]);
    const START = 4 * 60 + 10;
    const G = {
      mins: T0, battery: [76, 62, 50, 40, 32][diff - 1], cash: [42, 30, 24, 18, 14][diff - 1], favors: [3, 2, 2, 1, 1][diff - 1],
      sure: 0, maybe: 0, place: null, sound: null, flags: {}, used: {}, known: new Set(), actions: 0, charges: 0, walkups: 0, planEvents: 0,
      guestDelta: 0, vibeDelta: 0, notes: [], phase: "plan", over: false, taxi: false, tips: 0
    };
    G.fixedBattery = G.battery;

    /* ---------------- contacts ---------------- */
    const rndDef = (key, seed) => RP.chars.random(seed, { name: LOOKS[key] ? LOOKS[key].name : key, override: LOOKS[key] || {} });
    const defs = {};
    ["priya", "devanya", "biscuit", "cal", "rafa", "gus", "luz", "mina", "hamid"].forEach((k, i) => { defs[k] = rndDef(k, 40 + i * 7); });
    const CAST = { twinkie: "twinkie", marcus: "marcus", lou: "lou", dante: "dante", eddie: "eddie", jess: "jess" };
    const addPeople = n => { if (G.place) G.sure += n; else G.maybe += n; return G.place ? "+" + n + " guests" : "+" + n + " maybes"; };
    const setPlace = id => { const old = G.place; G.place = id; if (!old && G.maybe) { /* maybes stay maybes until you text the address */ } return old; };
    const C = {};
    const reg = (id, o) => { C[id] = Object.assign({ id, vis: false, opts: [] }, o); return C[id]; };
    const reveal = id => { if (C[id] && !C[id].vis) { C[id].vis = true; G.known.add(id); return true; } return false; };
    const hiddenOf = ids => NK.shuffle(ids.filter(i => C[i] && !C[i].vis));

    reg("twinkie", { name: "Twinkie", tag: "knows everyone", def: "twinkie", vis: true, greet: "Hey, hon. It's four in the morning. You want something. I can tell.", opts: [
      { id: "ppl", label: "Who's still up?", cost: { min: 6, bat: 3 }, max: 2, run(n) {
        if (n === 0) { reveal("priya"); reveal("devanya"); return { say: "Priya's off the clock at four. Dev and Anya are still at the gallery. Also: I'll text a few people.", chips: [addPeople(6), "Priya + Dev & Anya added"] }; }
        reveal("biscuit"); return { say: "Okay, okay. Biscuit never sleeps. And my cousin's friends are on their way to nowhere.", chips: [addPeople(3), "Biscuit added"] };
      } },
      { id: "spot", label: "I need a spot.", cost: { min: 6, bat: 3 }, max: 2, when: () => hiddenOf(["gus", "luz", "mina"]).length > 0, run() {
        const h = hiddenOf(["gus", "luz", "mina"]).slice(0, 2); h.forEach(reveal);
        const names = h.map(i => C[i].name);
        return { say: "A roof, a laundromat, a loft... everybody has a cousin. Try " + names.join(" and ") + ".", chips: names.map(n => n + " added") };
      } },
      { id: "snd", label: "I need a sound system.", cost: { min: 6, bat: 3 }, max: 2, when: () => hiddenOf(["lou", "eddie", "rafa"]).length > 0, run() {
        const h = hiddenOf(["lou", "eddie", "rafa"]).slice(0, 2); h.forEach(reveal);
        const names = h.map(i => C[i].name);
        return { say: "Sound? Oh, hon. Call " + names.join(" and ") + ". One of them will want something.", chips: names.map(n => n + " added") };
      } },
      { id: "come", label: "Come with me. Please.", cost: { min: 4, bat: 2, fav: 1 }, max: 1, run() {
        G.flags.twinkie = true; return { say: "I'm bringing my entire phone book. And my good lipstick.", chips: [addPeople(4), "Twinkie hosts (+vibe)"] };
      } }
    ] });
    reg("marcus", { name: "Marcus", tag: "best friend, plus three", def: "marcus", vis: true, greet: "Bro?! It's... what time is it? Yes. Whatever it is, yes.", opts: [
      { id: "come", label: "Come out. Bring people.", cost: { min: 5, bat: 2 }, max: 1, run() { return { say: "I'm bringing plus three! ...Okay, plus six. Some of them are mine.", chips: [addPeople(6)] }; } },
      { id: "roof", label: "Know anyone with a roof?", cost: { min: 4, bat: 2 }, max: 1, when: () => !C.gus.vis, run() { reveal("gus"); return { say: "My cousin's guy Gus is a super on Dekalb. He has keys to everything. Mostly.", chips: ["Gus added"] }; } }
    ] });
    reg("priya", { name: "Priya", tag: "bartender, off at four", def: "priya", greet: "I just closed out forty tabs. Make it worth it.", opts: [
      { id: "crew", label: "Bring the bar crew?", cost: { min: 6, bat: 3 }, max: 1, run() { return { say: "Last call was an hour ago. We are free and a little dangerous. Where?", chips: [addPeople(5)] }; } }
    ] });
    reg("devanya", { name: "Dev & Anya", tag: "gallery people", def: "devanya", greet: "We're holding wine in plastic cups. Please rescue us.", opts: [
      { id: "friends", label: "Bring the gallery crowd?", cost: { min: 6, bat: 3 }, max: 1, why: () => !G.sound ? "They want to hear there's music first" : null, run() { return { say: "Music? Real music? Anya is already putting her shoes on. We're bringing six.", chips: [addPeople(6)] }; } }
    ] });
    reg("biscuit", { name: "Biscuit", tag: "never sleeps, has a cat", def: "biscuit", greet: "Yo yo yo. Hold on. Mr. Biscuit, off the keyboard.", opts: [
      { id: "come", label: "Come out. Bring friends.", cost: { min: 5, bat: 2 }, max: 1, run() { G.flags.cat = true; return { say: "Me and two friends and the cat. The cat is non-negotiable.", chips: [addPeople(3), "a cat is coming"] }; } }
    ] });
    reg("cal", { name: "Cal", tag: "host of the dying party", def: "cal", vis: true, greet: "You're leaving? The speaker is yours. Nobody's even playing anything.", opts: [
      { id: "spk", label: "Borrow the party speaker", inPerson: true, cost: { min: 5 }, max: 1, run() { G.sound = "speaker"; return { say: "It's at 40%. It sounds like a phone call from the bottom of a well. Bring it back.", chips: ["Sound: Cal's speaker"] }; } }
    ] });
    reg("lou", { name: "Lou", tag: "4B, boombox since 1993", def: "lou", greet: "KID. It's four in the morning. ...What do you need.", opts: [
      { id: "box", label: "Borrow the boombox", cost: { min: 7, bat: 3 }, max: 1, run() { G.sound = "boombox"; G.flags.nostalgia = true; return { say: "In 1993 we called that a sound system. Bring it back in one piece. Batteries are original.", chips: ["Sound: Lou's boombox"] }; } }
    ] });
    reg("eddie", { name: "Eddie Two-Times", tag: "gear, has a van", def: "eddie", greet: "Kid! The phone? At this hour? I love it. Is it a two-time deal?", opts: [
      { id: "pa", label: "Rent the PA", cost: { min: 8, bat: 4, cash: 14 }, max: 1, run() { G.sound = "pa"; G.flags.eddie = true; return { say: "Fourteen bucks. And then, you know, a second payment. Two-time deal.", chips: ["Sound: Eddie's PA"] }; } },
      { id: "pa2", label: "Haggle: favor instead of cash", cost: { min: 9, bat: 4, cash: 6, fav: 1 }, max: 1, run() { G.sound = "pa"; G.flags.eddie = true; return { say: "Six now, one favor, and a second payment later. It's a very good deal. For me.", chips: ["Sound: Eddie's PA"] }; } }
    ] });
    reg("rafa", { name: "Rafa", tag: "hatchback, serious stereo", def: "rafa", greet: "Mmh. Yeah. I'm awake. Technically.", opts: [
      { id: "car", label: "Borrow the car stereo (gas money)", cost: { min: 10, bat: 3, cash: 5 }, max: 1, run() { G.sound = "car"; return { say: "Five bucks of gas. The bass will make your teeth rearrange. Street level only. It's a Honda.", chips: ["Sound: Rafa's car"] }; } }
    ] });
    reg("gus", { name: "Gus", tag: "super, 214 Dekalb", def: "gus", greet: "Who's this. It's four. Is something on fire?", opts: [
      { id: "fav", label: "Ask nicely for the roof key", cost: { min: 12, bat: 3, fav: 1 }, max: 1, run() { setPlace("roof"); return { say: "I'm giving you the key because you were polite. Don't tell the tenants.", chips: ["Place: the roof"] }; } },
      { id: "cash", label: "Slip him $10", cost: { min: 10, bat: 3, cash: 10 }, max: 1, run() { setPlace("roof"); return { say: "I didn't see you. The key is under the third bucket.", chips: ["Place: the roof"] }; } }
    ] });
    reg("luz", { name: "Luz", tag: "SudsCity Laundromat", def: "luz", greet: "We're closed. The sign says closed. ...What is it?", opts: [
      { id: "key", label: "Open up after close ($8)", cost: { min: 8, bat: 3, cash: 8 }, max: 1, run() { setPlace("laundromat"); return { say: "Eight dollars for the lights and the mop. Nobody touches the folding table.", chips: ["Place: the laundromat"] }; } },
      { id: "mop", label: "Mop the floor first (20 min)", cost: { min: 20, bat: 2 }, max: 1, run() { setPlace("laundromat"); G.favors += 1; return { say: "You mopped? Nobody mops. Okay. I owe you one.", chips: ["Place: the laundromat", "+1 favor"] }; } }
    ] });
    reg("mina", { name: "Mina", tag: "has a loft", def: "mina", greet: "Do you know what time it is? ...Is there food?", opts: [
      { id: "loft", label: "Can we use your loft?", cost: { min: 8, bat: 3, fav: 1 }, max: 1, run() { setPlace("loft"); return { say: "Fine. My neighbors hate me already, it can't get worse. Wipe your feet.", chips: ["Place: Mina's loft"] }; } }
    ] });
    reg("hamid", { name: "Hamid", tag: "bodega next door", def: "hamid", vis: true, greet: "Hey, my friend. Chips? Cigarettes? A lottery ticket? A cat?", opts: [
      { id: "room", label: "Rent the back room ($6)", inPerson: true, cost: { min: 5, cash: 6 }, max: 1, run() { setPlace("bodega"); G.flags.cat = true; return { say: "Back room. Fits twelve if nobody breathes. Don't touch the cat's shelf.", chips: ["Place: the bodega back room"] }; } }
    ] });
    reg("dante", { name: "Dante", tag: "promoter, \"next week\"", def: "dante", vis: true, greet: "Heyyy. You caught me. Great timing, actually.", opts: [
      { id: "club", label: "Can your club help?", cost: { min: 4, bat: 3 }, max: 1, run() { return { say: "Absolutely. Next week. I'll pay you for that other thing next week too.", chips: ["Nothing. Again."], bad: true }; } }
    ] });
    reg("jess", { name: "Jess", tag: "your ex", def: "jess", vis: true, greet: "...It's four AM.", opts: [
      { id: "help", label: "Ask Jess for help", cost: { min: 3, bat: 3 }, max: 1, run() { return { say: "Do you have the USB? The one with Mr. Whiskers? ...No? Goodnight.", chips: ["She hung up"], bad: true }; } }
    ] });
    /* contacts the act wants on the phone from the start */
    const extra = Array.isArray(p.contacts) ? p.contacts : [];
    extra.forEach((nm, i) => {
      const key = String(nm).toLowerCase().split(/[\s.]/)[0];
      if (C[key]) { C[key].vis = true; return; }
      const id = "x" + i, d = RP.chars.random(900 + i * 13, { name: String(nm), override: { id: "ap_x" + i } });
      defs[id] = d;
      reg(id, { name: String(nm), tag: "a friend", def: id, vis: true, greet: "Hey. It's late. Or early. Whatever. What's up?", opts: [
        { id: "come", label: "Come out. Bring people.", cost: { min: 5, bat: 2 }, max: 1, run() { return { say: "Say no more. I'm waking people up.", chips: [addPeople(4)] }; } }
      ] });
    });
    /* a preferred type unlocks its contact right away */
    const LOCCON = { roof: "gus", laundromat: "luz", loft: "mina", bodega: "hamid" }, SNDCON = { speaker: "cal", boombox: "lou", car: "rafa", pa: "eddie" };
    if (wantLoc && LOCCON[wantLoc]) reveal(LOCCON[wantLoc]);
    if (wantSnd && SNDCON[wantSnd]) reveal(SNDCON[wantSnd]);
    const order = ["twinkie", "marcus", "cal", "hamid", "priya", "devanya", "biscuit", "gus", "luz", "mina", "lou", "eddie", "rafa", "dante", "jess"];
    Object.keys(C).filter(k => !order.includes(k)).forEach(k => order.splice(4, 0, k));
    const portrait = key => {
      const d = CAST[C[key].def] ? C[key].def : defs[C[key].def];
      return NK.portrait(d, 28);
    };

    /* ---------------- events ---------------- */
    const guestsNow = () => Math.round(G.sure + G.maybe * 0.4);
    const EVENTS = {
      dante: { phase: "plan", title: "INCOMING CALL: DANTE", text: "Your phone buzzes. It's Dante. At 4 AM. You know exactly what he's going to say.", choices: [
        { label: "Answer", run: () => { G.battery = Math.max(0, G.battery - 3); G.mins -= 3; return { text: "\"Great news, I'll have your money next week.\" You hang up. That was three percent you needed.", chips: ["-3%", "-3 min"], bad: true }; } },
        { label: "Let it ring", run: () => ({ text: "It rings out. He leaves a voicemail. You don't listen to it.", chips: ["nothing lost"] }) }
      ] },
      drunk: { phase: "plan", title: "A GUY OUTSIDE THE BODEGA", text: "A stranger with a lot of friends: \"Yo, is there an after? We're looking for an after.\"", choices: [
        { label: "Tell him the plan (-3 min)", run: () => { G.mins -= 3; return { text: "He's thrilled. He tells four friends and one bagel. They all say they're in.", chips: [addPeople(4), "-3 min"] }; } },
        { label: "Say there's nothing going on", run: () => ({ text: "He shrugs and walks away. Somewhere a bagel is disappointed.", chips: ["nothing"] }) }
      ] },
      taxi: { phase: "plan", title: "A TAXI SLOWS DOWN", text: "A cab driver rolls down his window: \"You look like you're going somewhere. Six dollars flat, anywhere close.\"", choices: [
        { label: "Book him for later ($6)", cost: { cash: 6 }, run: () => { G.taxi = true; G.cash -= 6; return { text: "He gives you his card. When it's time to go, you won't be walking.", chips: ["-$6", "saves 10 min at the end"] }; } },
        { label: "No thanks", run: () => ({ text: "He shrugs and rolls the window up. New York.", chips: ["nothing"] }) }
      ] },
      cops: { phase: "party", title: "COPS ROLL BY", text: "A cruiser slows down outside. A flashlight finds the window. Everyone suddenly looks very innocent.", choices: [
        { label: "Turn it down. Smile.", run: () => ({ text: "Volume down. Smile up. They leave. The vibe takes a small hit.", vibe: -7, chips: ["-7 vibe"], bad: true }) },
        { label: "Talk your way out (1 favor)", cost: { fav: 1 }, run: () => { G.favors -= 1; return { text: "Somebody's cousin is on the force. Somebody's cousin is always on the force. They wave and leave.", vibe: 2, chips: ["-1 favor", "+2 vibe"] }; } },
        { label: "Everyone out the back", run: () => { const l = Math.max(2, Math.round(guestsNow() * 0.22)); return { text: "Chaos. A quarter of the room scatters into the night and doesn't come back.", guests: -l, vibe: -3, chips: ["-" + l + " guests", "-3 vibe"], bad: true }; } }
      ] },
      elevator: { phase: "party", title: "THE ELEVATOR BREAKS", text: "There is a loud clunk and the elevator light goes dark. Everyone stands there looking at the stairs.", choices: [
        { label: "Carry everything up the stairs (-12 min)", run: () => { G.mins -= 12; return { text: "Six floors, two trips, one very loud complaint about your back. But the gear arrives.", chips: ["-12 min"] }; } },
        { label: "Make the stairwell part of the party", run: () => ({ text: "Someone sits on the fourth floor landing. Someone else makes it a lounge. Honestly? It works.", guests: -2, vibe: 4, chips: ["-2 guests", "+4 vibe"] }) }
      ] },
      cat: { phase: "party", title: "SOMEONE BROUGHT A CAT", text: "A cat strolls in like it pays rent. It stares at the speaker. It stares at you.", choices: [
        { label: "Let the cat DJ", run: () => ({ text: "The cat sits on the equipment and everyone loses their mind. It is, easily, the best DJ here.", vibe: 10, chips: ["+10 vibe"] }) },
        { label: "Shoo the cat", run: () => ({ text: "The cat leaves with an expression you will think about for years. One allergic guest is thrilled.", vibe: -2, chips: ["-2 vibe"], bad: true }) }
      ], auto: () => !!G.flags.cat },
      power: { phase: "party", title: "THE SPEAKER IS DYING", text: "Forty minutes in, the little battery light goes red. The room has no outlets, or the batteries are older than you.", choices: [
        { label: "Charge it off your phone (-18%)", run: () => { if (G.battery < 18) return { text: "Your phone is too low to share. The speaker dies. The room hums softly. It's... something.", vibe: -12, chips: ["-12 vibe"], bad: true }; G.battery -= 18; return { text: "You run a cable from your phone to the speaker. The speaker lives. Your phone does not thank you.", chips: ["-18% battery"] }; } },
        { label: "Run to the bodega for D batteries ($4, -8 min)", run: () => { if (G.cash < 4) return { text: "You can't afford batteries. You do a very sad acoustic set. Someone claps.", vibe: -10, chips: ["-10 vibe"], bad: true }; G.cash -= 4; G.mins -= 8; return { text: "Fresh batteries. Back before anyone noticed. You get a high five from a stranger.", chips: ["-$4", "-8 min"] }; } },
        { label: "Go acoustic", run: () => ({ text: "People hum. Someone beatboxes. It's honestly kind of beautiful. Mostly it's quiet.", vibe: -12, chips: ["-12 vibe"], bad: true }) }
      ] },
      eddie: { phase: "party", title: "EDDIE SHOWS UP", text: "\"There he is! My two-time deal. The second payment, kid. Six bucks.\" He is holding a clipboard.", choices: [
        { label: "Pay the second payment ($6)", run: () => { if (G.cash < 6) return { text: "You don't have six dollars. Eddie takes a speaker cable as collateral. The PA sounds a little thinner.", vibe: -6, chips: ["-6 vibe"], bad: true }; G.cash -= 6; return { text: "Six dollars. He shakes your hand with both of his. It is the second handshake.", chips: ["-$6"] }; } },
        { label: "Argue (1 favor)", cost: { fav: 1 }, run: () => { G.favors -= 1; return { text: "You invoke the original deal. Eddie squints, nods, and leaves. Somehow you won.", chips: ["-1 favor"] }; } }
      ], auto: () => !!G.flags.eddie },
      neighbor: { phase: "party", title: "A NEIGHBOR IN A ROBE", text: "A woman in a robe stands in the doorway holding a spatula. \"Is there a reason it is five in the morning?\"", choices: [
        { label: "Invite her in", run: () => ({ text: "She stays for forty minutes and teaches the room a cha-cha. She leaves with the spatula and four phone numbers.", guests: 1, vibe: 5, chips: ["+1 guest", "+5 vibe"] }) },
        { label: "Apologize and turn it down", run: () => ({ text: "She nods, slowly. The spatula remains pointed at you until she is out of sight.", vibe: -4, chips: ["-4 vibe"], bad: true }) }
      ] },
      walkin: { phase: "party", title: "A STRANGER WALKS IN", text: "\"Is this the after party?\" Yes. It is now. A few people drift in behind him.", choices: [
        { label: "Of course it is", run: () => ({ text: "The best kind of guest: the one who found you.", guests: 3, vibe: 2, chips: ["+3 guests", "+2 vibe"] }) }
      ] }
    };
    const eventWeights = () => {
      const loc = LOCS[G.place], snd = SNDS[G.sound], out = [];
      const add = (id, w) => { if (w > 0) out.push([id, w]); };
      add("cops", loc.cops * (snd.q >= 4 ? 1.4 : 1) * (0.6 + diff * 0.2) * 3);
      add("elevator", loc.up ? 2.2 : 0);
      add("cat", G.flags.cat ? 8 : 0);
      add("power", (snd.battery && !loc.power) || (G.sound === "boombox" && rnd() < 0.5) ? 5 : 0);
      add("eddie", G.flags.eddie ? 6 : 0);
      add("neighbor", (loc.id === "loft" || loc.id === "laundromat") ? 1.2 : 0.2);
      add("walkin", 1);
      return out;
    };

    /* ---------------- DOM ---------------- */
    const root = host.root;
    const head = host.header("after.Party", "Sunrise at " + NK.clock(4 * 60 + 10 + T0));
    const main = el("div", { cls: "ap-main" }, root);
    const left = main, right = main;
    const hud = el("div", { cls: "ap-hud", role: "status" }, left);
    const chClock = el("div", { cls: "ap-chip" }, hud), chSun = el("div", { cls: "ap-chip sun" }, hud), chBat = el("div", { cls: "ap-chip" }, hud), chCash = el("div", { cls: "ap-chip" }, hud), chFav = el("div", { cls: "ap-chip" }, hud);
    const stageBox = el("div", { cls: "ap-stage" }, left);
    const W = 320, H = 168;
    const scene = NK.canvas(stageBox, W, H, "ap-scene");
    const plan = el("div", { cls: "ap-plan" }, left);
    const slotP = el("div", { cls: "ap-slot" }, plan), slotL = el("div", { cls: "ap-slot" }, plan), slotS = el("div", { cls: "ap-slot" }, plan);
    const msg = el("div", { cls: "mg-msg ap-msg", "aria-live": "polite" }, left);
    const acts = el("div", { cls: "row ap-acts" }, left);
    const bGo = el("button", { cls: "btn primary", type: "button", text: "GO TO THE SPOT" }, acts);
    el("div", { cls: "spacer" }, acts);
    const bLeave = el("button", { cls: "btn", type: "button", text: "GIVE UP" }, acts);
    const phone = el("div", { cls: "ap-phone" }, right);
    const status = el("div", { cls: "ap-status" }, phone);
    const stTime = el("span", {}, status), stRight = el("span", { cls: "sig" }, status);
    const screen = el("div", { cls: "ap-screen", role: "region", "aria-label": "Phone" }, phone);

    /* ---------------- audio ---------------- */
    let partyLoop = null;
    host.cleanup(() => { if (partyLoop) { try { partyLoop.stop(0.1); } catch (e) { /* ignore */ } partyLoop = null; } });
    const sfx = n => RP.sfx(n);

    /* ---------------- art ---------------- */
    const skyC = NK.offscreen(W, 120), fgC = NK.offscreen(W, H), partyC = NK.offscreen(W, H);
    const lerpHex = RP.u.mix;
    let skyKey = -1;
    const progress = () => clamp(1 - G.mins / T0, 0, 1);
    function paintSky(pr) {
      const c = skyC.c, a = ["#07041c", "#100838", "#1a0e4a", "#281560"], b = ["#2c1c74", "#7a2e84", "#e0587a", "#ffb468"];
      const pp = Math.pow(pr, 1.6), stops = a.map((col, i) => lerpHex(col, b[i], pp));
      NK.dgrad(c, 0, 0, W, 120, stops);
      const n = Math.round((1 - pr) * 70), r = mulberry(21);
      for (let i = 0; i < n; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * 80); if (bayer(x, y) < 14) P(c, x, y, i % 5 ? "#8a84c0" : "#ffffff"); }
      if (pr > 0.84) { const k = (pr - 0.84) / 0.16, sy = Math.round(124 - k * 26); NK.glow(c, 232, sy, 26, "#ffb468", 0.55); ell(c, 232, sy, 8, 8, "#ffe0a0"); ell(c, 232, sy, 6, 6, "#fff4cc"); }
    }
    function paintFg() {
      const c = fgC.c; c.clearRect(0, 0, W, H);
      const dark = "#0a0626";
      for (let i = 0; i < 24; i++) {
        const x = i * 14 - 6, h = 26 + hN(i, 1) % 46;
        R(c, x, 116 - h, 13, h, dark); R(c, x, 116 - h, 13, 1, "#18104a");
        for (let k = 0; k < 8; k++) if (hN(i, k + 4) % 3 === 0) P(c, x + 2 + (k % 3) * 4, 116 - h + 4 + Math.floor(k / 3) * 6, hN(i, k) % 4 ? "#ffd27a" : "#7ad8ff");
      }
      /* water tower */
      R(c, 124, 40, 2, 20, "#0a0626"); R(c, 140, 40, 2, 20, "#0a0626"); R(c, 120, 26, 26, 16, "#140a38"); R(c, 118, 24, 30, 3, "#0a0626"); R(c, 132, 20, 2, 4, "#0a0626");
      R(c, 0, 116, W, 20, dark);
      /* left tenement */
      const br = ramp("#6a2e30");
      R(c, 0, 12, 104, 124, br[1]);
      for (let y = 12; y < 136; y += 4) { R(c, 0, y, 104, 1, br[0]); for (let x = (y / 4 % 2) * 6; x < 104; x += 12) R(c, x, y, 1, 4, br[0]); }
      NK.speckle(c, 0, 12, 104, 124, [br[2], br[0], br[3]], mulberry(7), 0.07);
      R(c, 0, 10, 106, 3, "#3a1a30"); R(c, 0, 10, 106, 1, br[3]);
      for (let col = 0; col < 4; col++) for (let row = 0; row < 5; row++) {
        const x = 8 + col * 24, y = 20 + row * 21, lit = hN(col, row + 3) % 4 === 0;
        R(c, x - 1, y - 1, 14, 18, "#1a0c1c"); R(c, x, y, 12, 16, lit ? "#ffcf7a" : "#1a1030");
        if (lit) { R(c, x, y, 12, 2, "#ffe8b0"); R(c, x + 5, y, 2, 16, "#8a5a30"); R(c, x, y + 8, 12, 1, "#8a5a30"); } else { R(c, x, y, 12, 1, "#2a1c50"); R(c, x + 5, y, 1, 16, "#0e0820"); R(c, x, y + 8, 12, 1, "#0e0820"); }
        R(c, x - 2, y + 16, 16, 2, "#5a3038");
      }
      for (let row = 0; row < 4; row++) { const y = 36 + row * 21; R(c, 4, y, 96, 1, "#0a0614"); R(c, 4, y + 6, 96, 1, "#0a0614"); for (let x = 4; x < 100; x += 6) R(c, x, y, 1, 6, "#0a0614"); R(c, 0, y, 1, 28, "#0a0614"); }
      R(c, 40, 112, 24, 24, "#1a0c1c"); R(c, 42, 114, 20, 22, "#4a2a24"); R(c, 44, 118, 7, 14, "#2a1814"); R(c, 53, 118, 7, 14, "#2a1814"); R(c, 56, 126, 2, 2, "#ffc44d");
      R(c, 36, 134, 32, 3, "#5a5470"); R(c, 38, 131, 28, 3, "#6a6480");
      txt(c, "4C", 70, 100, "#2a1018", 1, 1);
      R(c, 12, 98, 22, 10, "#1d1622"); txt(c, "TAG", 14, 101, "#ff3fa4", 1, 1);
      /* bodega */
      R(c, 176, 72, 144, 64, "#2a2240"); R(c, 176, 72, 144, 2, "#4a3a70");
      for (let i = 0; i < 18; i++) { R(c, 178 + i * 8, 78, 8, 12, i % 2 ? "#efe6d0" : "#2f9a5a"); R(c, 178 + i * 8, 88, 8, 2, i % 2 ? "#b8b0a0" : "#1f6a3a"); }
      R(c, 176, 90, 144, 1, "#0a0614");
      R(c, 184, 96, 70, 34, "#1a1230"); NK.dgrad(c, 186, 98, 66, 30, ["#ffe8a0", "#ffc860", "#c08838"]);
      for (let k = 0; k < 5; k++) { R(c, 188, 100 + k * 6, 62, 1, "#6a4a20"); for (let j = 0; j < 9; j++) R(c, 190 + j * 7, 94 + k * 6 + 2, 5, 4, ["#c0302c", "#2f62b8", "#efe6d0", "#ffd23f", "#3fa66a"][(j + k) % 5]); }
      R(c, 262, 96, 28, 38, "#14102a"); R(c, 264, 98, 24, 34, "#ffd89a"); R(c, 275, 98, 2, 34, "#8a5a30"); R(c, 280, 114, 3, 3, "#8a5a30");
      R(c, 294, 98, 20, 14, "#0a0614"); txt(c, "24", 298, 100, "#ff3fa4", 2, 1); txt(c, "HRS", 297, 107, "#39d0ff", 1, 1);
      R(c, 184, 54, 130, 14, "#1d1622"); R(c, 184, 54, 130, 2, "#3a2a50"); txt(c, "HAMID'S DELI GROCERY", 192, 59, "#ffd27a", 1, 1);
      R(c, 180, 124, 70, 12, "#1a1030"); for (let k = 0; k < 6; k++) { ell(c, 186 + k * 9, 128, 3, 3, ["#ff8a2a", "#ff8a2a", "#9be15d"][k % 3]); }
      /* lamp */
      R(c, 172, 60, 3, 76, "#14102a"); R(c, 160, 60, 14, 2, "#14102a"); R(c, 156, 62, 8, 4, "#2a2640"); R(c, 157, 66, 6, 2, "#ffe8b0");
      /* sidewalk + street */
      R(c, 0, 136, W, 20, "#2a2438"); NK.dither(c, 0, 136, W, 20, "#1a1428", 7, 0); for (let x = 0; x < W; x += 28) R(c, x, 136, 1, 20, "#14101e");
      R(c, 0, 136, W, 1, "#5a5470"); R(c, 0, 155, W, 2, "#14101e");
      R(c, 0, 157, W, 11, "#14101a"); NK.dither(c, 0, 157, W, 11, "#2a2638", 4, 1); for (let x = 6; x < W; x += 36) R(c, x, 162, 18, 1, "#c8a830");
      /* hydrant, trash */
      R(c, 54, 142, 7, 10, "#c0302c"); R(c, 52, 144, 11, 2, "#c0302c"); R(c, 55, 140, 5, 3, "#e0584c"); R(c, 54, 142, 1, 10, "#e0584c");
      [[160, 148], [168, 150], [298, 146]].forEach(([x, y]) => { ell(c, x, y, 6, 5, "#0e0c14"); ell(c, x - 1, y - 1, 4, 3, "#1c1a26"); R(c, x - 1, y - 6, 2, 2, "#0e0c14"); });
      /* manhole */
      ell(c, 74, 160, 8, 2, "#0a0814"); ell(c, 74, 159, 7, 1, "#2a2638");
    }
    paintFg();
    const glowC = NK.offscreen(W, H);
    NK.glow(glowC.c, 160, 66, 30, "#ffe0a0", 0.9); NK.glow(glowC.c, 160, 142, 26, "#ffe0a0", 0.5);
    const partyKey = {};
    function paintParty(locId) {
      const c = partyC.c; c.clearRect(0, 0, W, H);
      if (locId === "roof") {
        NK.dgrad(c, 0, 0, W, 100, ["#10083a", "#2a1460", "#6a2a7a", "#d0587a"]);
        for (let i = 0; i < 24; i++) P(c, hN(i, 5) % W, hN(i, 6) % 60, "#cfc8f0");
        for (let i = 0; i < 30; i++) { const x = i * 11 - 4, h = 12 + hN(i, 2) % 36; R(c, x, 104 - h, 10, h, "#0e0828"); for (let k = 0; k < 5; k++) if (hN(i, k) % 3 === 0) P(c, x + 2 + (k % 2) * 4, 104 - h + 3 + Math.floor(k / 2) * 6, "#ffd27a"); }
        R(c, 226, 52, 2, 22, "#0a0626"); R(c, 244, 52, 2, 22, "#0a0626"); R(c, 222, 36, 28, 18, "#1a1030"); R(c, 220, 34, 32, 3, "#0a0626");
        R(c, 0, 104, W, 64, "#2a2638"); NK.dither(c, 0, 104, W, 64, "#14101e", 6, 0); R(c, 0, 104, W, 6, "#4a4458"); R(c, 0, 104, W, 1, "#6a6480");
        for (let x = 0; x < W; x += 6) R(c, x, 98, 1, 6, "#3a3450");
        const sag = NK.sag(0, 60, W, 60, 20, 40); NK.stroke(c, sag, "#14101c", 1); for (let i = 0; i <= 14; i++) { const q = NK.along(sag, (i / 14) * NK.pathLen(sag)); R(c, q[0] - 1, q[1] + 1, 3, 3, ["#ffd27a", "#ff8fcf", "#9be15d", "#7ad8ff"][i % 4]); }
      } else if (locId === "laundromat") {
        R(c, 0, 0, W, 112, "#cfd8e0"); NK.dgrad(c, 0, 0, W, 112, ["#9fb4c4", "#cfd8e0", "#b8c8d4"]);
        for (let x = 0; x < W; x += 20) R(c, x, 0, 1, 112, "#8aa0b0");
        for (let i = 0; i < 5; i++) { const x = 14 + i * 60; NK.bevel(c, x, 40, 48, 60, "#e8eef2"); ell(c, x + 24, 72, 16, 16, "#5a6a7a"); ell(c, x + 24, 72, 14, 14, "#2a3a4a"); ell(c, x + 24, 72, 9, 9, "#4a6a8a"); R(c, x + 6, 46, 14, 4, "#39d0ff"); R(c, x + 28, 46, 14, 4, "#ff3fa4"); }
        R(c, 0, 20, W, 6, "#ffffff"); for (let x = 6; x < W; x += 50) R(c, x, 20, 40, 6, "#fffbe0");
        R(c, 90, 6, 140, 12, "#14101e"); txt(c, "SUDS CITY", 112, 9, "#ff3fa4", 2, 1);
        R(c, 0, 112, W, 56, "#8a96a4"); for (let y = 112; y < 168; y += 12) for (let x = ((y / 12) % 2) * 12; x < W; x += 24) R(c, x, y, 12, 12, "#a4b0bc"); NK.dither(c, 0, 112, W, 56, "#4a5a6a", 5, 0);
      } else if (locId === "loft") {
        const br = ramp("#8a3a2a"); R(c, 0, 0, W, 112, br[1]);
        for (let row = 0; row < 19; row++) for (let x = -(row % 2) * 7; x < W; x += 14) { R(c, x + 1, row * 6 + 1, 13, 5, [br[1], br[2], br[2], br[3]][hN(x, row) % 4]); R(c, x + 1, row * 6 + 1, 13, 1, br[3]); }
        NK.dither(c, 0, 0, W, 70, "#12081e", 8, 0);
        for (let k = 0; k < 3; k++) { const x = 20 + k * 100; R(c, x, 14, 70, 62, "#1a1424"); NK.dgrad(c, x + 3, 17, 64, 56, ["#12183a", "#2a2a6a", "#7a4a8a"]); R(c, x + 33, 17, 2, 56, "#1a1424"); R(c, x + 3, 44, 64, 2, "#1a1424"); }
        R(c, 0, 112, W, 56, "#4a2a30"); for (let y = 112; y < 168; y += 7) { R(c, 0, y, W, 1, "#2a1620"); for (let x = (y % 14) * 3; x < W; x += 50) R(c, x, y, 1, 7, "#2a1620"); }
        const sag = NK.sag(0, 6, W, 6, 14, 40); NK.stroke(c, sag, "#14101c", 1); for (let i = 0; i <= 12; i++) { const q = NK.along(sag, (i / 12) * NK.pathLen(sag)); R(c, q[0] - 1, q[1] + 1, 3, 3, ["#ffd27a", "#ff8fcf", "#9be15d", "#7ad8ff"][i % 4]); }
      } else {
        R(c, 0, 0, W, 112, "#2a2236"); NK.dgrad(c, 0, 0, W, 112, ["#1a1428", "#3a2e4a", "#2a2236"]);
        for (let s = 0; s < 3; s++) { const y = 20 + s * 30; R(c, 0, y + 22, W, 3, "#5a4a3a"); for (let x = 4; x < W; x += 10) { const col = ["#c0302c", "#2f62b8", "#efe6d0", "#ffd23f", "#3fa66a", "#e0584c"][hN(x, s) % 6]; R(c, x, y + 6 + (hN(x, s + 9) % 5), 8, 16 - (hN(x, s + 9) % 5), col); R(c, x, y + 6 + (hN(x, s + 9) % 5), 8, 1, "#ffffff55"); } }
        R(c, 0, 112, W, 56, "#6a5a48"); NK.dither(c, 0, 112, W, 56, "#2a2018", 6, 0); for (let x = 0; x < W; x += 24) R(c, x, 112, 1, 56, "#3a2e22");
        R(c, 158, 0, 2, 22, "#14101a"); ell(c, 159, 26, 4, 4, "#ffe8a0"); NK.glow(c, 159, 26, 22, "#ffd27a", 0.5);
        for (let k = 0; k < 4; k++) { NK.bevel(c, 20 + k * 60, 112, 36, 24, "#8a6a3a"); R(c, 24 + k * 60, 116, 28, 2, "#5a4020"); R(c, 24 + k * 60, 124, 28, 2, "#5a4020"); }
      }
    }
    /* crowd */
    let crowd = [], crowdN = 0;
    function buildCrowd(n) {
      crowd = []; crowdN = n;
      const m = Math.min(n, 18);
      for (let i = 0; i < m; i++) { const row = i % 3, d = RP.chars.random(300 + i * 11, { override: { id: "ap_c" + i } }); crowd.push({ d, row, x: 24 + ((i * 53 + row * 21) % 270), ph: i % 4 }); }
      crowd.sort((a, b) => a.row - b.row);
    }
    function drawSound(c, t, snd, loc) {
      const x = 160, y = 140, lvl = 0.5 + 0.5 * Math.abs(Math.sin(t * 7));
      if (snd === "speaker") { R(c, x - 8, y - 18, 16, 20, "#17131f"); R(c, x - 8, y - 18, 16, 1, "#3a364a"); ell(c, x, y - 7, 5 + (reduced ? 0 : Math.round(lvl)), 5 + (reduced ? 0 : Math.round(lvl)), "#2a2638"); ell(c, x, y - 7, 3, 3, "#0b0910"); R(c, x - 3, y - 15, 6, 1, "#39d0ff"); }
      else if (snd === "boombox") { R(c, x - 22, y - 16, 44, 18, "#2a2834"); R(c, x - 22, y - 16, 44, 1, "#5a5470"); R(c, x - 14, y - 20, 28, 4, "#8a84a0"); ell(c, x - 13, y - 7, 6, 6, "#17151f"); ell(c, x + 13, y - 7, 6, 6, "#17151f"); ell(c, x - 13, y - 7, 3 + (reduced ? 0 : Math.round(lvl)), 3 + (reduced ? 0 : Math.round(lvl)), "#4a4668"); ell(c, x + 13, y - 7, 3 + (reduced ? 0 : Math.round(lvl)), 3 + (reduced ? 0 : Math.round(lvl)), "#4a4668"); R(c, x - 6, y - 12, 12, 8, "#c8c4d8"); R(c, x - 5, y - 11, 4, 5, "#2a2438"); R(c, x + 1, y - 11, 4, 5, "#2a2438"); }
      else if (snd === "car") { const cx = 262; R(c, cx - 40, 132, 80, 18, "#c0302c"); RP.u.poly(c, [[cx - 28, 132], [cx - 18, 118], [cx + 14, 118], [cx + 28, 132]], "#a02424"); RP.u.poly(c, [[cx - 24, 131], [cx - 16, 121], [cx + 12, 121], [cx + 24, 131]], "#6aa0c8"); ell(c, cx - 24, 150, 7, 7, "#0a0814"); ell(c, cx + 24, 150, 7, 7, "#0a0814"); ell(c, cx - 24, 150, 3, 3, "#8a84a0"); ell(c, cx + 24, 150, 3, 3, "#8a84a0"); R(c, cx - 40, 140, 80, 2, "#e0584c"); R(c, cx + 30, 136, 6, 4, "#ffe8a0"); NK.glow(c, cx + 38, 138, 12, "#ffd27a", 0.4); if (!reduced && lvl > 0.7) for (let k = 0; k < 3; k++) R(c, cx - 46 - k * 4, 134 + k * 3, 2, 1, "#9a94c8"); }
      else { [[x - 36, 0], [x + 36, 0]].forEach(([sx]) => { NK.bevel(c, sx - 12, y - 52, 24, 54, "#17131f"); ell(c, sx, y - 18, 8, 8, "#2a2638"); ell(c, sx, y - 18, 5 + (reduced ? 0 : Math.round(lvl)), 5 + (reduced ? 0 : Math.round(lvl)), "#4a4668"); ell(c, sx, y - 18, 2, 2, "#0b0910"); R(c, sx - 6, y - 44, 12, 8, "#2a2638"); ell(c, sx, y - 40, 2, 2, "#8a84a0"); R(c, sx - 1, y + 2, 2, 8, "#3a364a"); }); NK.bevel(c, x - 22, y - 14, 44, 14, "#2a2834"); R(c, x - 18, y - 11, 14, 5, "#39d0ff"); R(c, x + 2, y - 11, 14, 5, "#ff3fa4"); }
    }
    function drawPartyScene(t, pr) {
      const c = scene.c; c.drawImage(partyC.cv, 0, 0);
      if (G.place === "roof" && pr > 0.7) { const k = clamp((pr - 0.7) / 0.3, 0, 1); NK.dither(c, 0, 60, W, 44, "#ff9a5a", Math.round(k * 5), 0); }
      const snd = G.sound, loc = LOCS[G.place];
      if (snd && snd !== "car") drawSound(c, t, snd, loc);
      crowd.forEach((m, i) => {
        const sc = [0.46, 0.52, 0.58][m.row], y = 122 + m.row * 13 + 5;
        const fr = reduced ? 0 : (Math.floor(t * 5 + m.ph) % 4);
        NK.drawChar(c, m.d, m.x, y, { act: "dance", frame: fr, scale: sc, face: "front" });
      });
      if (snd === "car" && loc.ground) drawSound(c, t, snd, loc);
      else if (snd === "car") { const lv = reduced ? 0 : Math.round(Math.sin(t * 7) * 0.5 + 0.5); R(c, 290, 150, 22, 1, "#8a84c8"); R(c, 292, 150 - lv, 18, 1, "#8a84c8"); txt(c, "BASS FROM THE CURB", 214, 158, "#a8a2c8", 1, 1); }
      if (crowdN > crowd.length) txt(c, "+" + (crowdN - crowd.length), 296, 154, "#ffffff", 2, 1);
    }
    function drawStreet(t) {
      const c = scene.c, pr = progress(), key = Math.round(pr * 80);
      if (key !== skyKey) { skyKey = key; paintSky(pr); }
      c.drawImage(skyC.cv, 0, 0);
      c.drawImage(fgC.cv, 0, 0);
      /* dawn tint on the street layer */
      if (pr > 0.5) { const k = (pr - 0.5) / 0.5; NK.dither(c, 0, 0, W, 136, "#ff9a5a", Math.round(k * k * 4), 0); }
      /* window flicker + neon */
      const on = reduced || Math.floor(t * 1.5) % 7 !== 0;
      R(c, 294, 98, 20, 14, "#0a0614"); txt(c, "24", 298, 100, on ? "#ff3fa4" : "#6a2048", 2, 1); txt(c, "HRS", 297, 107, "#39d0ff", 1, 1);
      c.globalAlpha = 1 - pr * 0.6; c.drawImage(glowC.cv, 0, 0); c.globalAlpha = 1;
      /* characters */
      NK.drawChar(c, RP.chars.get("kid") || "kid", 100, 156, { face: "right", act: "phone", frame: 0, scale: 0.8 });
      NK.drawChar(c, RP.chars.get("twinkie") || "twinkie", 140, 156, { face: "left", act: "stand", scale: 0.8, expr: "happy" });
      if (G.battery > 0) NK.glow(c, 118, 106, 7, "#7ad8ff", 0.9);
      /* steam */
      if (!reduced) for (let k = 0; k < 6; k++) { const ph = (t * 0.5 + k / 6) % 1, x = 74 + Math.sin(ph * 6 + k) * 5, y = 158 - ph * 30; if (bayer(Math.round(x), Math.round(y)) < 8 * (1 - ph)) R(c, x, y, 2, 2, "#8a84a8"); }
      else R(c, 73, 148, 3, 6, "#5a5470");
    }

    /* ---------------- UI helpers ---------------- */
    const setMsg = t => { msg.textContent = t; };
    const fmtLeft = m => { const h = Math.floor(Math.max(0, m) / 60), mm = Math.max(0, m) % 60; return h + "h " + String(mm).padStart(2, "0") + "m"; };
    function updateHud() {
      const now = START + (T0 - G.mins);
      chClock.innerHTML = "<small>NOW</small>" + NK.clock(now);
      chSun.innerHTML = "<small>SUNRISE IN</small>" + fmtLeft(G.mins);
      chSun.classList.toggle("low", G.mins < 25);
      chBat.innerHTML = "<small>PHONE</small><span class='ap-bat'><i style='width:" + clamp(G.battery, 0, 100) + "%'></i></span>" + Math.round(G.battery) + "%";
      chBat.classList.toggle("low", G.battery <= 12);
      chCash.innerHTML = "<small>CASH</small>$" + G.cash;
      chFav.innerHTML = "<small>FAVORS</small>" + (G.favors > 0 ? "★".repeat(Math.min(6, G.favors)) : "-") + "";
      stTime.textContent = NK.clock(now);
      stRight.innerHTML = (G.battery > 0 ? "▂▄▆ " : "-- ") + "<span class='ap-bat' style='display:inline-block;vertical-align:middle;color:" + (G.battery <= 12 ? "#ff6a6a" : "#8c84b8") + "'><i style='width:" + clamp(G.battery, 0, 100) + "%'></i></span> " + Math.round(G.battery) + "%";
      const tot = G.sure + G.maybe;
      slotP.className = "ap-slot" + (G.sure >= NEED ? " done" : (G.sure + G.maybe >= NEED ? " warn" : ""));
      slotP.innerHTML = "<b>PEOPLE <em style='font-style:normal'>" + (G.sure >= NEED ? "OK" : "") + "</em></b><span>" + G.sure + " coming / need " + NEED + "</span><small>" + (G.maybe ? G.maybe + " maybes (text the address)" : "confirm them once you have a place") + "</small>";
      const loc = G.place ? LOCS[G.place] : null, snd = G.sound ? SNDS[G.sound] : null;
      slotL.className = "ap-slot" + (loc ? " done" : "");
      slotL.innerHTML = "<b>PLACE</b><span>" + (loc ? loc.name : "not yet") + "</span><small>" + (loc ? "fits " + loc.cap + (loc.power ? ", has outlets" : ", no outlets") + (loc.up ? ", upstairs" : "") : "find one: a roof, a laundromat, a loft...") + "</small>";
      let warnS = "";
      if (snd && loc) { if (snd.car && !loc.ground) warnS = "the car can't get up there"; else if (snd.heavy && loc.up) warnS = "heavy PA, no elevator to trust"; else if (snd.battery && !loc.power) warnS = "battery only, no outlets there"; }
      slotS.className = "ap-slot" + (snd ? (warnS ? " warn" : " done") : "");
      const ready = !!((G.place || !needLoc) && (G.sound || !needSnd)) && G.phase === "plan" && !G.over;
      bGo.disabled = !ready; bGo.textContent = ready ? "GO TO THE SPOT (" + goCost() + " min)" : (G.phase !== "plan" ? "AT THE SPOT" : "GO TO THE SPOT");
      slotS.innerHTML = "<b>SOUND</b><span>" + (snd ? snd.name : "not yet") + "</span><small>" + (snd ? (warnS || snd.note) : "borrow a speaker, a boombox, a car...") + "</small>";
    }

    /* ---------------- phone screens ---------------- */
    let view = "home";
    const costChips = (o, aff) => {
      const c = o.cost || {}, a = [];
      if (c.min) a.push("<i class='m'>" + c.min + "m</i>");
      if (c.bat && !o.inPerson) a.push("<i class='b'>" + c.bat + "%</i>");
      if (c.cash) a.push("<i class='d'>$" + c.cash + "</i>");
      if (c.fav) a.push("<i class='f'>★" + c.fav + "</i>");
      return a.join("");
    };
    function reason(o) {
      const c = o.cost || {};
      if (o.why && o.why()) return o.why();
      if (c.bat && !o.inPerson && G.battery < c.bat) return G.battery <= 0 ? "phone is dead" : "not enough battery";
      if (c.cash && G.cash < c.cash) return "not enough cash";
      if (c.fav && G.favors < c.fav) return "no favors left";
      if (c.min && G.mins < c.min) return "not enough time";
      return null;
    }
    function setScreen(fn) {
      screen.textContent = ""; fn();
      screen.scrollTop = 0;
      updateHud();
    }
    function focusFirst() { try { const b = screen.querySelector(".ap-row:not([disabled]), .ap-opt:not([disabled]), .btn.primary:not([disabled])") || screen.querySelector("button:not([disabled])"); if (b) b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    function homeAct(parent, label, costs, fn, why, cls) {
      const b = el("button", { cls: "ap-row act " + (cls || ""), type: "button" }, parent);
      el("span", { html: "<span class='n'>" + label + "</span>" + (why ? "<span class='t' style='color:var(--amber)'>" + why + "</span>" : "") }, b);
      el("span", { cls: "s", html: costs }, b);
      if (why) b.disabled = true; else b.addEventListener("click", fn);
      return b;
    }
    function showHome() {
      view = "home";
      setScreen(() => {
        if (G.battery <= 0) el("div", { cls: "ap-bubble ev", text: "PHONE DEAD. Only in-person things work now: charge at the bodega, work the street, or talk to Hamid and Cal." }, screen);
        const q = el("div", { cls: "ap-quick" }, screen);
        const qb = (label, costs, fn, why) => { const b = el("button", { cls: "ap-q", type: "button" }, q); el("b", { text: label }, b); if (why) el("span", { cls: "why", text: why }, b); else el("span", { cls: "c", html: costs }, b); if (why) b.disabled = true; else b.addEventListener("click", fn); return b; };
        qb("CHARGE", G.cash >= 2 ? "<i class='m'>15m</i><i class='d'>$2</i>" : "<i class='m'>15m</i><i class='f'>\u26051</i>", doCharge, G.charges >= 2 ? "outlet is taken" : (G.cash < 2 && G.favors < 1) ? "no cash/favors" : (G.mins < 15 ? "no time" : null));
        qb("STREET", "<i class='m'>12m</i>", doInvite, G.walkups >= 2 ? "heard by now" : (G.mins < 12 ? "no time" : null));
        qb("TEXT ADDRESS", "<i class='m'>5m</i><i class='b'>3%</i>", doText, !G.place ? "need a place" : G.maybe < 1 ? "no maybes" : G.battery < 3 ? "low battery" : G.mins < 5 ? "no time" : null);
        el("h3", { html: "<span>CONTACTS</span><span>" + order.filter(k => C[k].vis).length + "</span>" }, screen);
        const list = el("div", { cls: "ap-list" }, screen);
        order.filter(k => C[k].vis).forEach(k => {
          const c = C[k], b = el("button", { cls: "ap-row", type: "button" }, list);
          const pc = portrait(k); const cv = el("canvas", { width: 28, height: 28 }, b); cv.getContext("2d").drawImage(pc.cv, 0, 0);
          el("span", { html: "<span class='n'>" + c.name + "</span><span class='t'>" + c.tag + "</span>" }, b);
          const left2 = c.opts.filter(o => (G.used[k + ":" + o.id] || 0) < (o.max || 1) && (!o.when || o.when())).length;
          el("span", { cls: "s", text: left2 ? "" : "done" }, b);
          b.addEventListener("click", () => { sfx("blip"); showContact(k); });
        });
        if (!screen.querySelector(".ap-legend")) el("div", { cls: "ap-legend", html: "<i style='color:var(--cyan);font-style:normal'>m</i> minutes &nbsp; <i style='color:var(--amber);font-style:normal'>%</i> phone battery &nbsp; <i style='color:var(--lime);font-style:normal'>$</i> cash &nbsp; <i style='color:var(--pink);font-style:normal'>★</i> favor" }, screen);
      });
      focusFirst();
    }
    function showContact(k) {
      view = "contact";
      const c = C[k];
      setScreen(() => {
        const back = el("button", { cls: "btn ap-back", type: "button", text: "< BACK" }, screen); back.addEventListener("click", () => { sfx("click"); showHome(); });
        const who = el("div", { cls: "ap-who" }, screen);
        const cv = el("canvas", { width: 56, height: 56 }, who); const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; c2.drawImage(portrait(k).cv, 0, 0, 28, 28, 0, 0, 56, 56);
        el("div", { html: "<div class='n'>" + c.name + "</div><div class='t'>" + c.tag + "</div>" }, who);
        el("div", { cls: "ap-bubble", text: "\"" + c.greet + "\"" }, screen);
        const opts = c.opts.filter(o => !o.when || o.when());
        let any = false;
        opts.forEach(o => {
          const used = G.used[k + ":" + o.id] || 0; if (used >= (o.max || 1)) return;
          any = true;
          const why = reason(o), b = el("button", { cls: "ap-opt", type: "button" }, screen);
          el("span", { html: o.label + (why ? "<span class='why'>" + why + "</span>" : "") }, b); el("span", { cls: "c", html: costChips(o) }, b);
          if (why) b.disabled = true; else b.addEventListener("click", () => doOpt(k, o));
        });
        if (!any) el("div", { cls: "ap-bubble me", text: "Nothing more to ask. They're already on it." }, screen);
      });
      focusFirst();
    }
    function spend(cost, inPerson) {
      const c = cost || {};
      if (c.bat && !inPerson) G.battery = Math.max(0, G.battery - c.bat);
      if (c.cash) { G.cash -= c.cash; sfx("cash"); }
      if (c.fav) G.favors -= c.fav;
      if (c.min) G.mins -= c.min;
    }
    function showResult(title, who, text, chips, next) {
      view = "result";
      setScreen(() => {
        if (who) { const wh = el("div", { cls: "ap-who" }, screen); const cv = el("canvas", { width: 56, height: 56 }, wh); const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; c2.drawImage(portrait(who).cv, 0, 0, 28, 28, 0, 0, 56, 56); el("div", { html: "<div class='n'>" + C[who].name + "</div><div class='t'>" + C[who].tag + "</div>" }, wh); }
        else el("h3", { html: "<span>" + (title || "") + "</span>" }, screen);
        el("div", { cls: "ap-bubble", text: text }, screen);
        if (chips && chips.length) { const ch = el("div", { cls: "ap-chips" }, screen); chips.forEach(t => el("span", { text: t, cls: /^[-]|nothing|hung up|Nothing/.test(t) ? "x" : "g" }, ch)); }
        const b = el("button", { cls: "btn primary", type: "button", text: next ? next.label : "OK" }, screen);
        b.addEventListener("click", () => { sfx("click"); (next ? next.fn : afterAction)(); });
      });
      focusFirst();
    }
    function afterAction() {
      if (checkSunrise()) return;
      G.actions++;
      /* random planning event */
      if (G.phase === "plan" && G.actions >= 2 && G.planEvents < (diff >= 3 ? 2 : 1) && rnd() < 0.4) {
        const pool = ["dante", "drunk", "taxi"].filter(id => !G.used["ev:" + id]);
        if (pool.length) { const id = pick(pool); G.used["ev:" + id] = 1; G.planEvents++; showEvent(id, showHome); return; }
      }
      showHome();
    }
    function doOpt(k, o) {
      const c = C[k], why = reason(o);
      if (why) { sfx("error"); setMsg(c.name + ": can't do that (" + why + ")."); return; }
      sfx(o.inPerson ? "door" : "ring");
      G.used[k + ":" + o.id] = (G.used[k + ":" + o.id] || 0) + 1;
      const n = G.used[k + ":" + o.id] - 1;
      spend(o.cost, o.inPerson);
      const res = o.run(n) || {};
      if (res.chips) res.chips = res.chips.slice();
      const cc = o.cost || {}; const tags = [];
      if (cc.min) tags.push("-" + cc.min + " min"); if (cc.bat && !o.inPerson) tags.push("-" + cc.bat + "%"); if (cc.cash) tags.push("-$" + cc.cash); if (cc.fav) tags.push("-" + cc.fav + " favor");
      host.timeout(() => { if (res.bad) sfx("buzz"); else sfx("ping"); }, 350);
      setMsg(c.name + ": " + (res.say || "").slice(0, 90));
      showResult(c.name.toUpperCase(), k, "\"" + (res.say || "...") + "\"", (res.chips || []).concat(tags));
    }
    function doCharge() {
      sfx("coin");
      if (G.cash >= 2) { G.cash -= 2; } else G.favors -= 1;
      const gain = G.charges === 0 ? 35 : 22; G.charges++; G.battery = Math.min(100, G.battery + gain); G.mins -= 15;
      setMsg("You plug into the bodega outlet behind the lottery rack and wait.");
      showResult("BODEGA OUTLET", null, "Hamid doesn't ask. He just points at the outlet behind the lottery tickets. Fifteen minutes, one tiny paper cup of coffee.", ["+" + gain + "% battery", "-15 min", G.cash >= 0 ? "-$2" : "-1 favor"], null);
    }
    function doInvite() {
      sfx("cheer");
      const n = G.walkups === 0 ? 3 : 2; G.walkups++; G.mins -= 12;
      const t = addPeople(n);
      showResult("STREET", null, "You stand outside the bodega yelling the word \"after\" at strangers. Two of them take pictures. A few actually seem serious.", [t, "-12 min"], null);
    }
    function doText() {
      sfx("typing");
      const n = Math.floor(G.maybe * 0.8), lost = G.maybe - n;
      G.sure += n; G.maybe = 0; G.battery = Math.max(0, G.battery - 3); G.mins -= 5;
      showResult("MASS TEXT", null, "You send the address to everyone. A few thumbs-up. Several read receipts. One \"u up\".", ["+" + n + " confirmed", lost ? "-" + lost + " flaked" : "nobody flaked", "-3%", "-5 min"], null);
    }
    function goCost() { let m = 12; const snd = SNDS[G.sound], loc = LOCS[G.place]; if (snd && loc && snd.heavy && loc.up) m += 8; if (G.taxi) m -= 8; return Math.max(5, m); }

    function checkSunrise() {
      if (G.over) return true;
      if (G.mins <= 0 && G.phase === "plan") { endRun("sunrise"); return true; }
      return false;
    }
    function showEvent(id, next, partyCtx) {
      const ev = EVENTS[id]; view = "event"; sfx(id === "cops" ? "siren" : "ping");
      setScreen(() => {
        el("h3", { html: "<span>" + (ev.phase === "party" ? "AT THE PARTY" : "NOTIFICATION") + "</span>" }, screen);
        const b0 = el("div", { cls: "ap-bubble ev" }, screen); el("div", { html: "<b style='font-weight:400;color:var(--pink);letter-spacing:.08em'>" + ev.title + "</b>" }, b0); el("div", { text: ev.text }, b0);
        ev.choices.forEach(ch => {
          const why = ch.cost && ch.cost.fav && G.favors < ch.cost.fav ? "no favors left" : ch.cost && ch.cost.cash && G.cash < ch.cost.cash ? "not enough cash" : null;
          const b = el("button", { cls: "ap-opt", type: "button" }, screen); el("span", { html: ch.label + (why ? "<span class='why'>" + why + "</span>" : "") }, b);
          if (why) b.disabled = true; else b.addEventListener("click", () => {
            const r = ch.run() || {};
            if (r.guests) G.guestDelta += r.guests; if (r.vibe) G.vibeDelta += r.vibe;
            G.notes.push(ev.title.toLowerCase() + ": " + ((r.bad ? "bad " : "") + (ch.label)));
            if (r.bad) sfx("buzz"); else sfx("success");
            setMsg(ev.title + ".");
            showResult(ev.title, null, r.text, r.chips || [], { label: partyCtx ? "NEXT" : "OK", fn: () => { if (G.over) return; if (next) next(); } });
          });
        });
      });
      focusFirst();
    }

    /* ---------------- GO and the party ---------------- */
    function showGo() {
      view = "go";
      if (!G.place) G.place = "street"; if (!G.sound) G.sound = "phone";
      const loc = LOCS[G.place], snd = SNDS[G.sound], cost = goCost();
      setScreen(() => {
        el("h3", { html: "<span>READY?</span>" }, screen);
        const b0 = el("div", { cls: "ap-bubble ev" }, screen);
        el("div", { text: "Place: " + loc.name + " (fits " + loc.cap + ")." }, b0); el("div", { text: "Sound: " + snd.name + "." }, b0); el("div", { text: "Guests: " + G.sure + " coming, " + G.maybe + " maybes." }, b0);
        const warn = [];
        if (snd.car && !loc.ground) warn.push("The car stereo can't get up there. It will play from the curb.");
        if (snd.heavy && loc.up) warn.push("The PA is heavy and the stairs are long. +8 min.");
        if (snd.battery && !loc.power) warn.push("No outlets. The speaker is on battery.");
        if (G.sure + G.maybe * 0.4 < NEED) warn.push("You may not have enough guests yet (need " + NEED + ").");
        if (wantLoc && G.place !== wantLoc) warn.push("You wanted " + wantLoc + ".");
        warn.forEach(w => el("div", { cls: "ap-bubble me", text: w }, screen));
        el("div", { cls: "ap-bubble", text: "It takes " + cost + " minutes to get everyone there." + (G.taxi ? " The cab saves you some." : "") + " " + fmtLeft(G.mins) + " until sunrise." }, screen);
        const go = el("button", { cls: "btn primary", type: "button", text: "GO NOW" }, screen); go.addEventListener("click", startParty);
        const bk = el("button", { cls: "btn", type: "button", text: "NOT YET" }, screen); bk.addEventListener("click", () => { sfx("click"); showHome(); });
      });
      focusFirst();
    }
    let eventQueue = [];
    function startParty() {
      if (G.over) return;
      sfx("door");
      G.mins -= goCost(); G.phase = "party";
      if (G.mins <= 0) { endRun("sunrise"); return; }
      const loc = LOCS[G.place];
      /* pick events */
      const n = [1, 2, 2, 3, 3][diff - 1];
      const pool = eventWeights(), picks = [];
      for (let i = 0; i < n && pool.length; i++) {
        let tot = 0; pool.forEach(e => { tot += e[1]; });
        let r = rnd() * tot, idx = 0; for (; idx < pool.length; idx++) { r -= pool[idx][1]; if (r <= 0) break; }
        idx = Math.min(idx, pool.length - 1); picks.push(pool[idx][0]); pool.splice(idx, 1);
      }
      /* forced events */
      ["cat", "eddie"].forEach(id => { if (EVENTS[id].auto && EVENTS[id].auto() && !picks.includes(id)) picks.push(id); });
      if (SNDS[G.sound].battery && !loc.power && !picks.includes("power")) picks.push("power");
      eventQueue = picks.slice(0, 4);
      G.arrivalGuests = Math.round(Math.min(loc.cap, G.sure + G.maybe * 0.4));
      paintParty(G.place); buildCrowd(G.arrivalGuests); G.partyMode = true;
      try {
        if (!partyLoop) { partyLoop = RP.audio.loop({ genre: "house", bpm: 122, seed: 31, energy: 3, volume: 0.35 }); partyLoop.start(); partyLoop.setFilter("lowpass", 900); }
      } catch (e) { /* ignore */ }
      setMsg("You made it to " + loc.short + ". " + G.arrivalGuests + " people squeeze in. The sky is going pink.");
      setScreen(() => {
        el("h3", { html: "<span>ARRIVED</span>" }, screen);
        el("div", { cls: "ap-bubble", text: "You're here with " + G.arrivalGuests + " people and " + SNDS[G.sound].short + ". The night isn't over yet." }, screen);
        const b = el("button", { cls: "btn primary", type: "button", text: "START THE PARTY" }, screen); b.addEventListener("click", () => { sfx("click"); nextPartyEvent(); });
      });
      focusFirst();
    }
    function nextPartyEvent() {
      if (G.over) return;
      if (G.mins <= 0) { endRun("sunrise-late"); return; }
      const id = eventQueue.shift();
      if (!id) { finishParty(); return; }
      showEvent(id, nextPartyEvent, true);
    }
    function computeFinal() {
      const loc = LOCS[G.place], snd = SNDS[G.sound];
      const base = Math.round(Math.min(loc.cap, G.sure + G.maybe * 0.4));
      const guests = Math.max(0, Math.min(loc.cap, base + G.guestDelta));
      let q = snd.q, sndNote = snd.name;
      if (snd.car && !loc.ground) { q = 1; sndNote += " (stuck at the curb)"; }
      const cover = q * 6, over = Math.max(0, guests - cover);
      const sound = clamp(q * 6 - Math.min(14, over * 0.8), 0, 30);
      const place = loc.vibe * 5;
      const crowd = 20 * clamp(guests / NEED, 0, 1);
      let spec = 0; const specs = [];
      if (G.flags.twinkie) { spec += 6; specs.push("Twinkie hosts"); }
      if (G.flags.nostalgia) { spec += 5; specs.push("a 1993 mixtape"); }
      if (G.place === "roof" && G.mins >= 12) { spec += 8; specs.push("sunrise from the roof"); }
      if (wantLoc && G.place === wantLoc) { spec += 3; specs.push("exactly the place you wanted"); }
      if (wantSnd && G.sound === wantSnd) { spec += 3; specs.push("the sound you wanted"); }
      spec = Math.min(25, spec);
      const trouble = G.vibeDelta;
      const vibe = clamp(Math.round(sound + place + crowd + spec + trouble), 0, 100);
      return { guests, vibe, parts: { sound: Math.round(sound), place: Math.round(place), crowd: Math.round(crowd), spec, trouble }, specs, sndNote };
    }
    function finishParty() {
      const f = computeFinal(); G.final = f;
      buildCrowd(f.guests);
      setMsg("The party is going. " + f.guests + " guests. Vibe " + f.vibe + ".");
      sfx(f.vibe >= 60 ? "cheer" : "click");
      setScreen(() => {
        el("h3", { html: "<span>THE PARTY</span>" }, screen);
        el("div", { cls: "ap-bubble", text: f.guests >= NEED ? "The room is full, the speaker is loud, and the sky is turning gold. Somebody says it's the best after-party they've ever been to. Somebody else says the same thing about the cat." : "The room is quiet-ish. A few people nod along. The sun comes up on a smaller crowd than you hoped." }, screen);
        const b = el("button", { cls: "btn primary", type: "button", text: "SEE HOW YOU DID" }, screen); b.addEventListener("click", () => endRun("done"));
      });
      focusFirst();
    }

    /* ---------------- end ---------------- */
    let resolveFn = () => {};
    function endRun(why) {
      if (G.over) return; G.over = true;
      let result;
      const lines = [];
      if (why === "done") {
        const f = G.final || computeFinal();
        const ok = (!needLoc || !!G.place) && (!needSnd || !!G.sound) && f.guests >= NEED;
        const guestScore = clamp(f.guests / NEED, 0, 1.25) / 1.25 * 100;
        let score = Math.round(0.55 * guestScore + 0.45 * f.vibe);
        if (!ok) score = Math.min(score, 55);
        score = clamp(score, 0, 100);
        lines.push(["Guests", f.guests + " (need " + NEED + ")", f.guests >= NEED ? "y" : "n"]);
        lines.push(["Sound", f.parts.sound + " / 30 - " + f.sndNote, ""]);
        lines.push(["Place", f.parts.place + " / 25 - " + LOCS[G.place].short, ""]);
        lines.push(["Crowd", f.parts.crowd + " / 20", ""]);
        if (f.parts.spec) lines.push(["Extras", "+" + f.parts.spec + " (" + f.specs.join(", ") + ")", "y"]);
        if (f.parts.trouble) lines.push(["Trouble", String(f.parts.trouble), f.parts.trouble < 0 ? "n" : "y"]);
        lines.push(["Vibe", f.vibe + " / 100", ""]);
        lines.push(["Before sunrise", fmtLeft(G.mins) + " to spare", "y"]);
        result = { ok, score, guests: f.guests, lines, title: ok ? "BEST AFTER-PARTY IN YEARS" : "THE AFTER-PARTY WAS... FINE", blurb: ok ? "The sun comes up on a roomful of people who should be sleeping. Twinkie takes a photo and says she will tell everyone. She will." : "It happened. But it wasn't what you needed: too few people, or too little vibe. The sun doesn't care either way." };
      } else {
        const guests = G.place ? Math.min(LOCS[G.place].cap, Math.round(G.sure + G.maybe * 0.4)) : 0;
        const score = Math.round(clamp((G.place ? 10 : 0) + (G.sound ? 10 : 0) + Math.min(20, guests / NEED * 20), 0, 40));
        lines.push(["Place", G.place ? LOCS[G.place].short : "none", G.place ? "y" : "n"]); lines.push(["Sound", G.sound ? SNDS[G.sound].short : "none", G.sound ? "y" : "n"]); lines.push(["Guests lined up", guests + " (need " + NEED + ")", guests >= NEED ? "y" : "n"]);
        result = { ok: false, score, guests: 0, lines, title: "THE SUN CAME UP", blurb: why === "sunrise-late" ? "You got there, but the sun beat the party. Everybody has to go to work. Twinkie takes your picture anyway." : "Time ran out before you were ready. The sun rises on a street with a bodega, a cat, and a person holding a dead phone." };
      }
      sfx(result.ok ? "success" : "fail");
      NK.endCard(host, { kicker: "after.Party | sunrise", title: result.title, ok: result.ok, score: result.score, lines: result.lines, blurb: result.blurb }).then(() => resolveFn({ ok: result.ok, score: result.score, guests: result.guests }));
    }
    bGo.addEventListener("click", () => { if (G.over || !((G.place || !needLoc) && (G.sound || !needSnd)) || G.phase !== "plan") return; sfx("click"); showGo(); });
    bLeave.addEventListener("click", () => { if (G.over) return; G.over = true; resolveFn({ ok: false, score: 0, guests: 0 }); });

    /* ---------------- run ---------------- */
    return new Promise(resolve => {
      resolveFn = resolve;
      NK.onResize(host, layout);
      function layout() {
        const compact = NK.isCompact();
        NK.setCompact(host, compact);
        const avail = root.clientWidth || 700, wide = !compact && avail >= 940;
        main.classList.toggle("wide", wide); main.classList.toggle("compact", compact);
        if (compact) {
          const w = Math.max(280, Math.min(avail * 0.5, (window.innerHeight - 172) * (W / H)));
          main.style.gridTemplateColumns = Math.round(w) + "px minmax(0, 1fr)"; scene.cv.style.width = Math.round(w) + "px"; scene.cv.style.height = Math.round(w * H / W) + "px";
          phone.style.height = Math.max(200, window.innerHeight - 22) + "px";
        } else { phone.style.height = ""; main.style.gridTemplateColumns = ""; NK.fit(scene.cv, { clientWidth: wide ? 640 : avail }, W, H, wide ? 640 : 720); }
      }
      layout(); updateHud(); showHome();
      setMsg("It's 4:10 AM and the party is dead. You need people, a place and a sound system before sunrise. Start with Twinkie.");
      let last = null;
      host.raf(tm => {
        if (G.over && !host.root.isConnected) return false;
        const now = tm / 1000; last = now;
        try { if (G.partyMode) drawPartyScene(now, progress()); else drawStreet(now); } catch (e) { /* ignore */ }
      });
      try { host.root.__ap = { G, C, EVENTS, NEED, T0, showHome, showContact, doOpt, startParty, showGo, nextPartyEvent, finishParty, endRun, goCost }; } catch (e) { /* ignore */ }
    });
  }
});
})();
