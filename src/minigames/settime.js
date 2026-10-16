/* set.Time — manage a set against the clock: the floor, the promoter, the records you have left.
   Params (all optional):
     scenario: "opener" | "follow-legend" | "overrun" | "closing"
     records: [recordIds]      what you can play (each once; more than you need = decoys)
     followName: "Kosmo Delacroix"   who you follow (follow-legend) / who runs over (overrun)
     minutes: slot length in game minutes (60; closing 40)   difficulty: 1-5   venue: sign label
     theme: "house"|"techno"|"festival"|"loft"|"empty-bar" (the room)   seed   arcade: bool
   Result: { ok, score 0-100, scenario, floor (0-100 at the end), avgFloor, mixes: {clean, smooth, sloppy, wreck},
             deadAir (game minutes), events: n handled, meter (second gauge 0-100), reason }
   ok = score >= 58 and the set wasn't cut short by the promoter / the floor emptying. */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { clamp, mulberry, hashStr, el } = U;
const K = () => RP.setkit;

/* ======================================================================
   scenarios
   ====================================================================== */
const WRONG = ["Dennis", "Kevin", "Dwayne", "Brad", "Dylan", "Marvin", "Terrence"];
const LEGEND_LAST = "donna_summer_i_feel_love";
const pickOf = (a, rnd) => a[Math.floor((rnd || Math.random)() * a.length)];

const SC = {
  opener: {
    title: "THE OPENER", theme: "house", venue: "HALCYON ROOM", start: 22 * 60, minutes: 60, floor0: 6, pat0: 70, meter: "PROMOTER",
    handover: 0, bpm: [108, 124], tolUp: 0.85, tolDn: 1.5, ideal: 7, hand: 8, people: 24,
    want: u => 1.6 + 1.9 * Math.pow(u, 1.15), pot: u => 22 + 52 * Math.pow(u, 1.1),
    taste: { house: 1, disco: 1, funk: .7, pop: .6, acid: .5, techno: .3, electro: .5, hiphop: .5, breaks: .5, ambient: .5 }, over: { "deep house": 1, boogie: 1, garage: 1 },
    goal: { final: 58, avg: 38 },
    brief: { story: "10 PM at the Halcyon Room. The floor is empty, the promoter keeps checking his phone, and your first record is sitting on the deck.", goal: "Hand over a warm floor at the end of the hour.",
      tips: ["Start low and warm. Raise the energy one notch per record.", "Too hard too early scares people off. Too soft for too long bores the promoter.", "Cue a record, then MIX IN inside the green window."] }
  },
  "follow-legend": {
    title: "FOLLOW THE LEGEND", theme: "house", venue: "HALCYON ROOM", start: 0, minutes: 60, floor0: 88, pat0: 15, meter: "WIN THEM OVER",
    handover: 3, bpm: [118, 130], tolUp: 1.1, tolDn: 1.1, ideal: 7, hand: 8, people: 28,
    want: u => 4.8 - 0.5 * Math.min(1, u * 2.2) + 0.15 * Math.sin(u * 7), pot: () => 96,
    taste: { house: 1, pop: .9, disco: .8, acid: .8, techno: .7, electro: .6, hiphop: .3, breaks: .4, funk: .4, ambient: .1 }, over: { garage: 1, "chicago house": 1 },
    goal: { final: 78, avg: 74 },
    brief: { story: "Midnight. {L} just played the set of the night and the floor is on fire. Now it's your turn. He hands you the headphones and says something that sounds a lot like a name. Not yours.", goal: "Keep the floor alive and win them over.",
      tips: ["Match his energy on your first record: high energy, around his tempo.", "Don't let the floor sag. The crowd will chant for him until you earn it.", "Cue the next record early, then MIX IN inside the green window."] }
  },
  overrun: {
    title: "THE OVERRUN", theme: "festival", venue: "HARBOR LIGHTS", start: 23 * 60, minutes: 60, floor0: 72, pat0: 60, meter: "PROMOTER", overrun: 20,
    handover: 20, bpm: [120, 132], tolUp: 1.2, tolDn: 1.3, ideal: 5, hand: 7, people: 28,
    want: u => 3.4 + 1.1 * u, pot: u => 80 + 8 * u,
    taste: { pop: 1, house: .95, disco: .8, techno: .6, acid: .6, electro: .5, hiphop: .5, breaks: .4, funk: .5, ambient: .2 }, over: { italo: .85 },
    goal: { final: 66, avg: 52 },
    brief: { story: "Your slot starts at 11:00 PM. {L} is still on the decks and nobody told him. The promoter is sweating, the next act's crew is circling, and the crowd is getting restless.", goal: "Get on, play a tight set, and be out by midnight.",
      tips: ["{L} runs 20 minutes over. You can't MIX in until he's done (or you pull his plug, which has a price).", "Handle the promoter: his patience is the clock you can't see.", "Your set will be short. Pick your best records and hand over on time."] }
  },
  closing: {
    title: "THE CLOSING", theme: "loft", venue: "MESEROLE", start: 3 * 60 + 20, minutes: 40, floor0: 90, pat0: 75, meter: "STAFF PATIENCE",
    handover: 0, bpm: [112, 128], tolUp: 1.2, tolDn: 1.5, ideal: 4, hand: 6, people: 22,
    want: u => (u < 0.7 ? 4.4 : 4.4 - 1.5 * Math.pow((u - 0.7) / 0.3, 1.1)), pot: u => 100 - 4 * u,
    taste: { house: 1, disco: .95, pop: .85, ambient: .6, funk: .6, acid: .4, techno: .3, electro: .3, hiphop: .3, breaks: .3 }, over: { garage: 1, "deep house": .95, boogie: .9 },
    goal: { final: 78, avg: 74 },
    brief: { story: "3:20 AM. Lights come up at 4:00 sharp. The floor is still full and nobody wants to go home. You have time for a few records, and the last one matters most.", goal: "Bring them home: end on a great last record as the lights come up.",
      tips: ["Stay high, then come down gently for the final stretch.", "The last record should be a closer: warm, big, singable.", "Press FADE OUT in the last minutes so the final record lands as the lights come on."] }
  }
};

/* events: { at: game minute, who: char id, name, role, text, choices: [{ t, fx, say, r }], def: default choice index }
   fx: { floor, pat, mood: [delta, minutes], time, stale, plug, overEnd, ready } or a function (G, R) => { fx..., say } */
function eventsFor(key, R) {
  const L = R.legendShort, W = R.wrongName, N = R.myName;
  const E = {
    opener: [
      { at: 3, who: "dante", name: "DANTE", role: "PROMOTER", text: "\"It's 10:05 and the floor is EMPTY. Do something.\"", def: 0, choices: [
        { t: "Patience. They come at 11.", fx: { pat: 7 }, say: "Dante grunts. It's not a no.", r: 1 },
        { t: "Crank it up. That'll pull them in.", fx: { floor: -6, pat: -4, mood: [0.7, 8] }, say: "The two guys at the bar flinch. One of them leaves.", r: 0 },
        { t: "Send Marcus out to wave people in.", fx: { floor: 5, pat: 2 }, say: "Marcus comes back with a crowd. Plus three, of course.", r: 0.8 }] },
      { at: 13, who: "sk_bar", name: "BARTENDER", role: "BAR", text: "\"Two guys at the bar are trying to talk. Can you take it down a notch?\"", def: 0, choices: [
        { t: "Sure. Low and warm.", fx: { floor: 2, pat: 4, mood: [-0.3, 8] }, say: "She nods and slides you a free water.", r: 1 },
        { t: "No. It's a club.", fx: { floor: -3, pat: -5 }, say: "She turns it into one long, loud sigh.", r: 0 },
        { t: "Nod, then edge it up each record.", fx: { floor: 3, pat: 2 }, say: "Smart. Nobody notices a slow climb.", r: 0.85 }] },
      { at: 23, who: "sk_fan", name: "REGULAR", role: "AT THE BAR", text: "\"Do you take requests? Play something I know!\"", def: 1, choices: [
        { t: "Ask what they like. Play the closest thing.", fx: { floor: 4, pat: 2 }, say: "They dance alone for one record. Alone is a start.", r: 1 },
        { t: "\"I'm not a jukebox.\"", fx: { floor: -4, pat: -2 }, say: "They take their drink to the quiet corner.", r: 0 }] },
      { at: 33, who: "marcus", name: "MARCUS", role: "FRIEND", text: "\"Four people just walked in and sat at the back. Don't scare 'em.\"", def: 0, choices: [
        { t: "Hold the vibe. Change nothing.", fx: { floor: 7 }, say: "They relax. One nods. Then all four.", r: 1 },
        { t: "Hit them with something big.", fx: { floor: -9, pat: -3 }, say: "Four drinks, four exits.", r: 0 },
        { t: "Wave and smile.", fx: { floor: 2 }, say: "Friendly. They stay seated. For now.", r: 0.6 }] },
      { at: 44, who: "sk_sec", name: "DOOR", role: "SECURITY", text: "\"The line's out the door. Everybody shows up at eleven.\"", def: 0, choices: [
        { t: "Here we go.", fx: G => (G.floor >= 25 ? { floor: 10, pat: 4, say: "The 11 PM rush! The floor swells.", r: 1 } : { floor: 3, say: "They come in, look around, and wait to see what you do.", r: 0.5 }) }] },
      { at: 51, who: "sk_fan", name: "DRUNK GUY", role: "BOOTH", text: "\"PLAY SOMETHING FASTER! LOUDER! I LOVE THIS PLACE!\"", def: 0, choices: [
        { t: "Smile. Ignore.", fx: { floor: 2 }, say: "He hugs a speaker and wanders off.", r: 0.9 },
        { t: "Hand him the headphones.", fx: { floor: 3, pat: -2 }, say: "He puts them on backwards. The room laughs.", r: 0.6 },
        { t: "Speed up the next record.", fx: { floor: -4, mood: [0.8, 6] }, say: "The floor trips over the new tempo.", r: 0 }] }
    ],
    "follow-legend": [
      { at: 5, who: "sk_fan", name: "FAN", role: "FLOOR", text: "\"" + L.toUpperCase() + "! " + L.toUpperCase() + "! " + L.toUpperCase() + "!\" The chant rolls through the room.", def: 0, choices: [
        { t: "Let them chant. Keep the groove going.", fx: { floor: -2, win: 5 }, say: "The chant fizzles into dancing.", r: 1 },
        { t: "Chant along into the mic.", fx: { floor: 6, win: -6 }, say: "They cheer. For him. Not you.", r: 0.45 },
        { t: "Ask " + L + " to come back for one record.", fx: { floor: 9, win: -14 }, say: "He does. You're a spectator at your own set.", r: 0 }] },
      { at: 14, who: "kosmo", name: R.legendName.toUpperCase(), role: "ON THE MIC", text: "\"Give it up for... " + W + "!\" (That's not your name.)", def: 1, choices: [
        { t: "\"It's " + N + ".\"", fx: { floor: 3, win: 9 }, say: "The room laughs WITH you. He shrugs: \"Sure.\"", r: 1 },
        { t: "Wave. Roll with it.", fx: { floor: 5, win: 3 }, say: "The floor chants \"" + W + "!\" Funny. You are " + W + " now.", r: 0.7 },
        { t: "Glare at him.", fx: { floor: -5, win: -6 }, say: "Petty. The room felt it.", r: 0 }] },
      { at: 25, who: "sk_snd", name: "SOUND GUY", role: "FOH", text: "\"Your channel's clipping. Pull the gain or the PA trips.\"", def: 1, choices: [
        { t: "Pull it down a hair.", fx: { floor: -1 }, say: "Clean again. Nobody noticed.", r: 1 },
        { t: "It's fine. I like it hot.", fx: { floor: -14, win: -3 }, say: "The PA trips for four seconds. Four very long seconds.", r: 0 }] },
      { at: 36, who: "sk_fan", name: "FAN", role: "BOOTH", text: "\"Play something " + L + " would play!\"", def: 0, choices: [
        { t: "Play your own thing.", fx: { win: 8, floor: -1 }, say: "They shrug, then dance. Your thing works.", r: 1 },
        { t: "Play something in his style.", fx: { floor: 4, win: -3 }, say: "Safe. They dance. Whose set is it, though?", r: 0.5 }] },
      { at: 47, who: "kosmo", name: R.legendName.toUpperCase(), role: "BACK AT THE BOOTH", text: "He leans over: \"Nice work, kid. Seriously. ...Good job, " + W + ".\"", def: 0, choices: [
        { t: "Thanks, " + L + ".", fx: G => (G.floor >= 65 ? { win: 12, floor: 3, say: "He nods. For him, that's a standing ovation.", r: 1 } : { win: -2, say: "He glances at the floor. And says nothing.", r: 0.3 }) }] }
    ],
    overrun: [
      { at: 2, who: "dante", name: "THE PROMOTER", role: "SWEATING", text: "\"" + L + "'s agent says twenty more minutes. I can trim your set, or I can pull his plug. Your call.\"", def: 0, choices: [
        { t: "Trim my set. I'll make it count.", fx: { pat: 12 }, say: "He exhales. \"Pro. I'll remember this.\"", r: 1 },
        { t: "Pull his plug.", fx: { floor: -14, pat: -14, plug: true }, say: "Silence. Boos. You can take over now. You may regret it.", r: 0.25 },
        { t: "Let me talk to " + L + ".", fx: { pat: 4, overEnd: -6 }, say: L + " grudgingly agrees to wrap up six minutes early.", r: 0.85 }] },
      { at: 8, who: "sk_fan", name: "THE CROWD", role: "RESTLESS", text: "Half the floor is staring at the booth. Some are drifting to the bar.", def: 2, choices: [
        { t: "Cue your opener. Stand ready.", fx: { ready: true, floor: 1 }, say: "Headphones on, record cued. They can see you're ready.", r: 1 },
        { t: "Hype them up on the mic.", fx: { floor: 4, pat: -4 }, say: "The promoter winces. The crowd cheers.", r: 0.5 },
        { t: "Check your phone.", fx: { floor: -2 }, say: "Four texts from Marcus. All say \"plus three\".", r: 0.1 }] },
      { at: 14, who: "sk_sec", name: "TOUR MANAGER", role: L.toUpperCase() + "'S CREW", text: "\"" + L + " is doing a few more. Don't touch the decks!\"", def: 0, choices: [
        { t: "Fine. Prep a tight set.", fx: { pat: 4, ready: true }, say: "You sequence your five best records. Mentally.", r: 1 },
        { t: "Slip in at the next break.", fx: { overEnd: -2, pat: -2 }, say: "You're ready to pounce. Two minutes sooner.", r: 0.7 },
        { t: "Mix over him. Just start.", fx: { floor: -10, pat: -8, plug: true }, say: "Two kicks, two keys, one train wreck.", r: 0 }] },
      { at: 27, who: "dante", name: "THE PROMOTER", role: "WATCHING THE CLOCK", text: "\"Midnight sharp. The headliner's team is waiting.\"", def: 0, choices: [
        { t: "Understood. I'll end on time.", fx: { pat: 4 }, say: "He pats the booth like it's a horse.", r: 1 },
        { t: "Can I get five extra minutes?", fx: (G) => (G.pat >= 55 ? { pat: -6, time: 5, say: "\"...Five. Not six.\" You're good: you earned it.", r: 0.8 } : { pat: -8, say: "\"Absolutely not.\" You haven't earned any favors tonight.", r: 0.1 }) }] },
      { at: 41, who: "sk_snd", name: "SOUND GUY", role: "FOH", text: "\"Ten minutes! Cue your closer!\"", def: 0, choices: [
        { t: "Pick the last record now.", fx: { ready: true, pat: 3 }, say: "Cued. The last 10 minutes are going to be clean.", r: 1 },
        { t: "Keep going. No worries.", fx: { pat: -2 }, say: "He gives you a look that says \"worries\".", r: 0.3 }] },
      { at: 52, who: "sk_sec", name: "HEADLINER'S CREW", role: "SIDE OF THE STAGE", text: "The flight cases are rolling in. They're waiting for you to finish.", def: 0, choices: [
        { t: "Wrap it with a clean mix-out.", fx: { pat: 6 }, say: "A thumbs-up from the crew. Rare.", r: 1 },
        { t: "Play one more.", fx: { pat: -10 }, say: "The crew stops. Folds arms. Stares.", r: 0 }] }
    ],
    closing: [
      { at: 2, who: "sk_bar", name: "BARTENDER", role: "LAST CALL", text: "\"Last call is at 3:45. Lights at four. Can you tell them?\"", def: 1, choices: [
        { t: "Announce last call on the mic.", fx: { floor: -4, pat: 6 }, say: "A rush to the bar. Staff smiles for the first time tonight.", r: 0.8 },
        { t: "Keep playing. Let the bar handle it.", fx: { pat: 1 }, say: "She sighs and hits the bell herself.", r: 0.5 }] },
      { at: 9, who: "twinkie", name: "TWINKIE", role: "AFTER-HOURS", text: "\"Don't stop! I know an after. Play something that says 'come with me'.\"", def: 0, choices: [
        { t: "One more big one, then we'll see.", fx: { floor: 5 }, say: "She whoops. Half the floor follows her whoop.", r: 1 },
        { t: "Tempting. But I've got a job.", fx: { pat: 4 }, say: "She salutes. \"Professional. Boring.\"", r: 0.6 }] },
      { at: 17, who: "dante", name: "DANTE", role: "PROMOTER", text: "\"Play the closer I asked for. 'Finally.' You know the one.\"", def: 1, choices: [
        { t: "Sure. It's in the crate.", fx: { pat: 3, promised: true }, say: "He claps once. \"Next week I pay you.\"", r: 0.8 },
        { t: "I pick the closer.", fx: { pat: -1 }, say: "He shrugs. \"Your funeral.\"", r: 0.6 }] },
      { at: 25, who: "sk_fan", name: "A COUPLE", role: "CORNER", text: "Two people are slow-dancing in the corner, ignoring the beat.", def: 1, choices: [
        { t: "Slow it down. Give them their moment.", fx: { floor: 3, pat: 3, mood: [-0.4, 6] }, say: "Half the floor follows them into the slow burn.", r: 1 },
        { t: "Keep it banging.", fx: { floor: 1 }, say: "They'd have preferred ballads. They're polite.", r: 0.5 }] },
      { at: 31, who: "sk_sec", name: "SECURITY", role: "FIRE MARSHAL", text: "\"Lights come up at four sharp. Fire marshal's in the lobby.\"", def: 0, choices: [
        { t: "Get the last record cued.", fx: { ready: true, pat: 4 }, say: "He nods and radios \"all good\".", r: 1 },
        { t: "We'll see.", fx: { pat: -3 }, say: "He writes something in a notebook.", r: 0.2 }] },
      { at: 36, who: "sk_bar", name: "BARTENDER", role: "BY THE SWITCH", text: "She's standing next to the light switch. She's looking at her watch.", def: 0, choices: [
        { t: "Nod: \"Four sharp.\"", fx: { pat: 6 }, say: "She relaxes her hand. Barely.", r: 1 },
        { t: "Raise a finger: \"One more.\"", fx: { floor: 4, pat: -8 }, say: "They roar. She doesn't.", r: 0.2 }] }
    ]
  };
  return E[key];
}

/* ======================================================================
   model
   ====================================================================== */
const tolScale = d => 1.25 - 0.125 * (d - 1);
const hasV = (r, v) => (r.vibe || []).indexOf(v) >= 0;
function taste(D, rec) {
  if (D.over && D.over[rec.genre] != null) return D.over[rec.genre];
  const f = K().family(rec.genre);
  return D.taste[f] != null ? D.taste[f] : 0.4;
}
function fitOf(D, rec, want, diff) {
  const ts = tolScale(diff), d = (rec.energy || 3) - want;
  const fe = clamp(d >= 0 ? 1 - Math.max(0, d - 0.35) / (D.tolUp * ts) : 1 - Math.max(0, -d - 0.35) / (D.tolDn * ts), 0, 1);
  const out = rec.bpm < D.bpm[0] ? D.bpm[0] - rec.bpm : rec.bpm > D.bpm[1] ? rec.bpm - D.bpm[1] : 0;
  const fb = clamp(1 - out / (12 * ts), 0, 1), fg = taste(D, rec);
  return { fit: 0.55 * fe + 0.2 * fb + 0.25 * fg, fe, fb, fg, d };
}
/* mix quality: window (0..1) x tempo match x genre match */
function mixQ(cur, next, winQ, diff) {
  const ts = tolScale(diff);
  const bq = K().bpmJump((next.bpm - cur.bpm) / ts), gq = 0.5 + 0.5 * K().compat(cur.genre || "house", next.genre);
  return { q: clamp(winQ * (0.25 + 0.75 * bq) * (0.75 + 0.25 * gq), 0, 1), bq, gq };
}
const mixLabel = q => q >= 0.85 ? ["CLEAN BLEND", "clean"] : q >= 0.65 ? ["SMOOTH", "smooth"] : q >= 0.45 ? ["SLOPPY", "sloppy"] : ["TRAIN WRECK", "wreck"];
const fmtClock = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; let h = Math.floor(m / 60); const mm = m % 60, ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + String(mm).padStart(2, "0") + " " + ap; };
const fmtDur = m => { m = Math.max(0, m); return Math.floor(m) + ":" + String(Math.floor((m % 1) * 60)).padStart(2, "0"); };

function resolveST(p) {
  p = p || {};
  const rnd = mulberry(Math.floor(p.seed != null ? +p.seed : Math.random() * 1e9) + 31);
  let key = SC[p.scenario] ? p.scenario : (p.arcade ? Object.keys(SC)[Math.floor(rnd() * 4)] : "opener");
  const D = SC[key];
  const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
  const M = clamp(Math.round(p.minutes || D.minutes), 20, 120);
  const overrun = key === "overrun" ? Math.min(Math.round(D.overrun * M / 60), Math.round(M * 0.5)) : 0;
  const mPlay = M - (key === "overrun" ? overrun : (key === "follow-legend" ? D.handover : 0));
  const legend = String(p.followName || (key === "overrun" ? "Axl Vanta" : "Kosmo Delacroix"));
  const legendShort = legend.split(/\s+/)[0];
  let ids = Array.isArray(p.records) ? p.records.filter((x, i, a) => x && a.indexOf(x) === i) : [];
  const R = { key, D, diff, M, overrun, mPlay, legend, legendShort, legendName: legend, rnd, seed: Math.floor(rnd() * 1e6), venue: p.venue ? String(p.venue) : null, theme: p.theme || D.theme, ids0: ids.slice() };
  const myName = (p.myName || (RP.state && RP.state.name) || "DJ").toString();
  R.myName = myName.charAt(0).toUpperCase() + myName.slice(1).toLowerCase();
  R.wrongName = WRONG[(((RP.state && RP.state.act) || 3) + myName.length) % WRONG.length];
  if (!ids.length) ids = defaultRecords(R);
  R.ids = ids;
  R.idealN = Math.max(2, Math.min(R.D.ideal, ids.length));
  return R;
}
function defaultRecords(R) {
  const { D, rnd, diff } = R;
  const all = K().allRecords().filter(r => r.bpm && r.energy);
  const good = all.filter(r => taste(D, r) >= 0.7 && r.bpm >= D.bpm[0] - 4 && r.bpm <= D.bpm[1] + 4);
  const chosen = [];
  let prev = null;
  const n = D.ideal;
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n, w = D.want(u);
    let best = null, bs = -9;
    K().shuffle(good, rnd).forEach(r => {
      if (chosen.indexOf(r) >= 0) return;
      let s = fitOf(D, r, w, diff).fit + rnd() * 0.08 - (prev ? Math.max(0, Math.abs(r.bpm - prev.bpm) - 4) * 0.03 : 0);
      if (R.key === "closing" && k === n - 1) s += hasV(r, "closer") || hasV(r, "sunrise") ? 0.5 : -0.2; else if (hasV(r, "closer") || hasV(r, "sunrise")) s -= 0.3;
      if (R.key === "closing" && k === n - 1 && r.energy > 4) s -= 0.3;
      if (s > bs) { bs = s; best = r; }
    });
    if (best) { chosen.push(best); prev = best; }
  }
  const rest = K().shuffle(all.filter(r => chosen.indexOf(r) < 0), rnd);
  const extra = D.hand - chosen.length;
  const decoys = [];
  const wrongE = rest.find(r => taste(D, r) >= 0.5 && Math.abs(r.energy - D.want(0.5)) >= 2);
  const wrongG = rest.find(r => taste(D, r) < 0.35 && r !== wrongE);
  const wrongB = rest.find(r => (r.bpm < D.bpm[0] - 12 || r.bpm > D.bpm[1] + 12) && r !== wrongE && r !== wrongG);
  [wrongE, wrongG, wrongB].forEach(r => { if (r && decoys.length < extra) decoys.push(r); });
  return K().shuffle(chosen.concat(decoys), rnd).map(r => r.id);
}

/* ======================================================================
   UI
   ====================================================================== */
const CSS = `
.st-main { display: grid; grid-template-columns: minmax(0, 640px) minmax(0, 1fr); gap: 10px; align-items: start; }
.st-left, .st-right { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.st-clock { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.st-time { font-size: 40px; line-height: 1; color: #fff; font-variant-numeric: tabular-nums; text-shadow: 0 3px 0 #2a0d3a; }
.st-time small { font-size: 20px; color: var(--muted); margin-left: 6px; }
.st-slot { position: relative; height: 12px; background: #0a0816; border: 1px solid #241d48; margin-top: 2px; }
.st-slot i { position: absolute; left: 0; top: 0; bottom: 0; background: repeating-linear-gradient(90deg, var(--cyan) 0 4px, transparent 4px 6px); }
.st-slot u { position: absolute; top: -3px; bottom: -3px; border-left: 2px solid var(--amber); text-decoration: none; }
.st-slot s { position: absolute; top: 0; bottom: 0; background: rgba(255, 90, 90, .25); border-right: 2px solid #ff5a5a; text-decoration: none; }
.st-slotl { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 15px; color: var(--muted); }
.st-g { display: flex; flex-direction: column; gap: 2px; }
.st-g .lab { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 17px; color: var(--muted); }
.st-g .lab b { color: var(--fg); font-weight: 400; }
.st-bar { position: relative; height: 16px; background: #0a0816; border: 1px solid #241d48; }
.st-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: repeating-linear-gradient(90deg, var(--pink) 0 5px, transparent 5px 7px); }
.st-bar i.p2 { background: repeating-linear-gradient(90deg, var(--amber) 0 5px, transparent 5px 7px); }
.st-bar u { position: absolute; top: -3px; bottom: -3px; border-left: 2px solid var(--lime); text-decoration: none; }
.st-bar.low i { background: repeating-linear-gradient(90deg, #ff5a5a 0 5px, transparent 5px 7px); }
.st-tr { display: flex; flex-direction: column; gap: 6px; }
.st-now { font-size: 20px; line-height: 1.05; color: var(--fg); } .st-now small { color: var(--muted); font-size: 16px; }
.st-trk { position: relative; height: 18px; background: #0a0816; border: 1px solid #241d48; }
.st-trk i { position: absolute; left: 0; top: 0; bottom: 0; background: repeating-linear-gradient(90deg, var(--cyan) 0 4px, transparent 4px 6px); }
.st-trk s { position: absolute; top: 0; bottom: 0; background: rgba(63, 208, 122, .28); border-left: 2px solid var(--ok); text-decoration: none; }
.st-trk span { position: absolute; right: 4px; top: 0; font-size: 15px; line-height: 18px; color: var(--muted); }
.st-next { font-size: 18px; color: var(--muted); } .st-next b { color: var(--fg); font-weight: 400; } .st-next.warn b { color: var(--amber); }
.st-ctl { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.st-ctl .btn { padding: 6px 12px; font-size: 20px; }
.st-ctl .btn.ready { box-shadow: 0 0 0 2px var(--ok); }
.st-ctl .btn.hold { background: #1d2a52; border-color: var(--cyan); color: var(--cyan); }
.st-ctl .btn small { font-size: 14px; opacity: .7; margin-left: 4px; }
.st-ev, .st-brief { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 4px 10px; align-items: start; padding: 8px; }
.st-ev canvas, .st-brief canvas { width: 56px; height: 56px; image-rendering: pixelated; image-rendering: crisp-edges; border: 1px solid #000; background: #1a1230; grid-row: 1 / span 2; }
.st-ev .who { font-size: 16px; color: var(--muted); letter-spacing: .06em; } .st-ev .who b { color: var(--pink); font-weight: 400; }
.st-ev .tx { font-size: 19px; line-height: 1.05; color: #fff; }
.st-ev .ch { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.st-ev .ch .btn { font-size: 17px; padding: 3px 9px; text-align: left; line-height: 1.05; }
.st-ev .ch .btn kbd { font-family: var(--ui); color: var(--amber); margin-right: 6px; }
.st-ev .tm { grid-column: 1 / -1; height: 5px; background: #241d48; } .st-ev .tm i { display: block; height: 100%; background: var(--amber); }
.st-ev .out { grid-column: 1 / -1; font-size: 19px; color: var(--ok); } .st-ev .out.bad { color: #ff7a7a; } .st-ev .out.mid { color: var(--amber); }
.st-ev.idle { display: none; }
.st-evbox { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; background: rgba(8, 5, 18, .95); border: 1px solid var(--pink); border-radius: 0; min-height: 0; }
.st-evbox .ch { flex-direction: row; flex-wrap: wrap; } .st-evbox .ch .btn { flex: 1 1 30%; min-width: 150px; }
.st-sceneBox { position: relative; }
.st-briefbox { position: absolute; inset: 0; background: rgba(8, 5, 18, .93); border: 1px solid var(--line); overflow: auto; display: flex; align-items: center; }
.st-briefbox[hidden] { display: none; }
.st-brief { display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; width: 100%; box-sizing: border-box; }
.st-brief h3 { margin: 0; font-family: var(--logo); font-weight: 400; font-size: clamp(14px, 3.4vw, 19px); color: var(--pink); }
.st-brief p { margin: 0; font-size: 19px; line-height: 1.1; color: #e4ddff; }
.st-brief ul { margin: 0; padding: 0; list-style: none; font-size: 18px; line-height: 1.1; color: var(--muted); }
.st-brief li::before { content: "> "; color: var(--pink); }
.st-brief .goal { color: var(--amber); font-size: 19px; }
.st-brief .row { margin-top: 4px; }
.st-crate { display: flex; flex-direction: column; gap: 5px; }
.st-crate .sk-card .rd { font-size: 15px; } .st-crate .rd.g { color: var(--ok); } .st-crate .rd.a { color: var(--amber); } .st-crate .rd.r { color: #ff7a7a; }
.st-crate .sk-card.next { border-color: var(--lime); box-shadow: 0 0 0 1px var(--lime) inset; }
.st-crate .sk-card.next::after { content: "NEXT UP"; position: absolute; right: 6px; top: 4px; font-size: 13px; color: var(--lime); }
.st-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
.st-msg { min-height: 1.2em; } .st-say { min-height: 1.2em; }
@media (max-width: 860px) {
  .st-evbox { position: static; margin-top: 8px; border-color: var(--pink); } .st-evbox .ch { flex-direction: column; } .st-evbox .ch .btn { flex: none; }
  .st-briefbox { position: static; background: #120e24; border-radius: 4px; margin-top: 8px; }
  .st-main { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
  .st-left, .st-right { display: contents; }
  .st-sceneBox { order: 1; } .st-clock { order: 2; } .st-slotBox { order: 3; } .st-g1 { order: 4; } .st-g2 { order: 5; } .st-chiprow { order: 6; } .st-tr { order: 7; } .st-ctl { order: 8; } .st-msg { order: 9; } .st-say { order: 10; } .st-crate { order: 11; }
  .st-ctl.sticky { position: sticky; bottom: 0; z-index: 5; background: rgba(10, 8, 22, .97); padding: 6px; border-color: var(--pink); }
  .st-time { font-size: 38px; }
}
@media (max-height: 460px) {
  .overlay.mg-setTime { padding: 4px 8px; }
  .mg-setTime .mg-wrap { gap: 4px; }
  .mg-setTime .mg-head { flex-wrap: nowrap; align-items: baseline; }
  .mg-setTime .mg-logo { font-size: 13px; } .mg-setTime .mg-sub { font-size: 15px; }
  .st-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 36%); gap: 8px; align-items: start; }
  .st-left, .st-right { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .st-time { font-size: 28px; } .st-time small { font-size: 15px; }
  .st-slotl, .st-chiprow { display: none; }
  .st-g .lab { font-size: 15px; } .st-bar { height: 11px; }
  .st-tr { padding: 5px 8px; gap: 3px; } .st-now { font-size: 16px; } .st-now small { font-size: 13px; } .st-trk { height: 14px; } .st-trk span { font-size: 13px; line-height: 14px; } .st-next { font-size: 15px; }
  .st-ctl.sticky { position: static; padding: 3px 6px; gap: 4px; } .st-ctl .btn { padding: 3px 8px; font-size: 17px; } .st-ctl .btn small { display: none; }
  .st-msg { font-size: 16px; min-height: 0; line-height: 1.05; max-height: 2.2em; overflow: hidden; } .st-say { display: none; }
  .st-crate { max-height: calc(100vh - 150px); overflow-y: auto; gap: 3px; padding-right: 2px; }
  .st-left { position: relative; }
  .st-evbox { position: absolute; margin: 0; max-height: 100%; overflow: auto; background: rgba(8, 5, 18, .88); }
  .st-evbox .ch { flex-direction: row; } .st-evbox .ch .btn { flex: 1 1 30%; min-width: 120px; }
  .st-ev .tx { font-size: 16px; } .st-ev .who { font-size: 14px; } .st-ev canvas { width: 40px; height: 40px; } .st-ev { grid-template-columns: 40px minmax(0, 1fr); padding: 5px; }
  .st-briefbox { position: absolute; margin: 0; z-index: 6; } .st-brief { padding: 6px 10px; gap: 3px; } .st-brief p, .st-brief ul { font-size: 15px; } .st-brief h3 { font-size: 13px; } .st-brief .goal { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .st-ctl .btn.ready { box-shadow: 0 0 0 2px var(--ok); } }
`;
let cssDone = false;
const MIXLINES = {
  clean: ["Locked in. The kicks became one kick.", "That blend was butter.", "Nobody heard the seam."],
  smooth: ["Smooth enough. A few heads turn.", "Good transition. Small seam, nobody minds.", "Nice. A touch early, a touch late."],
  sloppy: ["Sloppy. The kicks fight for a bar.", "You can hear the join. A few dancers stumble.", "The new record arrives like a trip on the stairs."],
  wreck: ["TRAIN WRECK. Two songs, one argument.", "The floor stops. Everyone looks at the booth.", "That was a car crash with a four-on-the-floor."]
};

RP.mg.register("setTime", {
  title: "set.Time", order: 4,
  desc: "Manage the clock, the floor and the promoter through a real set.",
  model: { SC, fitOf, mixQ, resolveST },
  auto(params) {
    const sc = SC[params && params.scenario] ? params.scenario : "opener";
    return { ok: true, score: 84, scenario: sc, floor: 72, avgFloor: 55, mixes: { clean: 3, smooth: 2, sloppy: 0, wreck: 0 }, deadAir: 0, events: 5, meter: 70, auto: true };
  },
  async play(host, params) {
    const kit = K();
    if (!cssDone) { cssDone = true; el("style", { text: CSS }, document.head); }
    kit.css();
    const reduced = kit.reduced();
    const root = host.root;
    let R = resolveST(params);
    const sound = kit.sound(host);
    // role characters for portraits
    ["sk_bar", "sk_snd", "sk_fan", "sk_sec", "sk_prev"].forEach((id, i) => { try { if (!RP.chars.get(id)) { const d = RP.chars.random(300 + i * 37); RP.chars.define(id, Object.assign(d, { id })); } } catch (e) { /* ignore */ } });
    const legendId = /axl/i.test(R.legend) ? "axl" : /kosmo/i.test(R.legend) ? "kosmo" : "sk_prev";

    host.header("set.Time", (R.venue || R.D.venue) + " · " + R.D.title + (params && params.arcade ? " · Arcade" : ""));
    const stage = el("div", { cls: "sk-stage" }, root);
    const endBox = el("div", {}, root);

    return new Promise(resolve => {
      let finished = false;
      const done = res => { if (finished) return; finished = true; sound.stop(0.4); resolve(res); };

      /* ---------- DOM ---------- */
      const main = el("div", { cls: "st-main" }, stage);
      const left = el("div", { cls: "st-left" }, main), right = el("div", { cls: "st-right" }, main);
      const sceneBox = el("div", { cls: "st-sceneBox" }, left);
      const W = 320, H = 144;
      const cv = el("canvas", { cls: "sk-cv px", width: W, height: H, role: "img", "aria-label": "The club from the dance floor" }, sceneBox), sc = cv.getContext("2d");
      kit.fit(host, cv, W, H, sceneBox, 0, 192);
      // transport
      const tr = el("div", { cls: "mg-panel st-tr" }, left);
      const now = el("div", { cls: "st-now" }, tr);
      const trk = el("div", { cls: "st-trk", role: "progressbar", "aria-label": "Current record" }, tr);
      const trkFill = el("i", {}, trk), trkWin = el("s", {}, trk), trkTxt = el("span", {}, trk);
      const nextEl = el("div", { cls: "st-next" }, tr);
      const ctl = el("div", { cls: "mg-panel st-ctl sticky" }, left);
      const mixBtn = el("button", { cls: "btn primary", type: "button", html: "MIX IN ▶ <small>Space</small>", disabled: "disabled" }, ctl);
      const fltBtn = el("button", { cls: "btn", type: "button", html: "FILTER <small>hold F</small>" }, ctl);
      fltBtn.style.touchAction = "none";
      const loopBtn = el("button", { cls: "btn", type: "button", html: "LOOP +2 <small>L</small>" }, ctl);
      const fadeBtn = el("button", { cls: "btn", type: "button", html: "FADE OUT <small>X</small>" }, ctl);
      el("div", { cls: "spacer" }, ctl);
      const giveUp = el("button", { cls: "btn", type: "button", text: "GIVE UP" }, ctl);
      const msg = el("div", { cls: "mg-msg st-msg", "aria-live": "polite" }, left);
      const say = el("div", { cls: "mg-say st-say" }, left);
      const evBox = el("div", { cls: "mg-panel st-ev st-evbox idle" }, sceneBox);
      const briefBox = el("div", { cls: "st-briefbox" }, sceneBox);
      // right column
      const clockBox = el("div", { cls: "st-clock" }, right);
      const timeEl = el("div", { cls: "st-time", text: "" }, clockBox);
      const clockSub = el("div", { cls: "mg-sub" }, clockBox);
      const slotBox = el("div", { cls: "st-slotBox" }, right);
      const slot = el("div", { cls: "st-slot", "aria-hidden": "true" }, slotBox);
      const slotFill = el("i", {}, slot), slotGhost = el("s", {}, slot), slotStart = el("u", {}, slot);
      const slotL = el("div", { cls: "st-slotl" }, slotBox);
      const g1 = el("div", { cls: "st-g st-g1" }, right);
      const g1l = el("div", { cls: "lab" }, g1), g1a = el("span", {}, g1l), g1b = el("span", {}, g1l);
      const bar1 = el("div", { cls: "st-bar" }, g1), bar1f = el("i", {}, bar1), bar1g = el("u", {}, bar1);
      const g2 = el("div", { cls: "st-g st-g2" }, right);
      const g2l = el("div", { cls: "lab" }, g2), g2a = el("span", {}, g2l), g2b = el("span", {}, g2l);
      const bar2 = el("div", { cls: "st-bar" }, g2), bar2f = el("i", { cls: "p2" }, bar2);
      const chipRow = el("div", { cls: "sk-chips st-chiprow" }, right);
      const cLeft = el("span", { cls: "sk-chip" }, chipRow), cPace = el("span", { cls: "sk-chip" }, chipRow), cWant = el("span", { cls: "sk-chip" }, chipRow);
      const crate = el("div", { cls: "st-crate", role: "listbox", "aria-label": "Your records" }, right);

      /* ---------- state ---------- */
      let G = null, floor = null, last = null, uiAcc = 0, cards = [], evTimerEl = null, outTO = null;
      let secPerMin = (1.9 - 0.1 * (R.diff - 1)) / (+params.speed > 0 ? +params.speed : 1); // params.speed: test-only time multiplier
      const win = () => 2.0 - 0.2 * (R.diff - 1);                    // green window (game minutes)
      const evTimeout = () => [15, 13, 11, 9, 7][R.diff - 1];

      function lenOf(rec) { return G.lens[rec.id] || 7; }
      function setup() {
        R = Object.assign(R, resolveST(Object.assign({}, params, { records: R.ids, seed: R.seed, scenario: R.key, minutes: R.M })));
        // keep same ids/seed for retries
        secPerMin = (1.9 - 0.1 * (R.diff - 1)) / (+params.speed > 0 ? +params.speed : 1);
        const D = R.D;
        G = { t: 0, phase: "brief", floor: D.floor0, pat: D.pat0, win: 15, stale: 0, cur: null, next: null, hand: R.ids.map(id => RP.rec(id)), played: [], mixes: [], evs: eventsFor(R.key, R), evi: 0, curEv: null, evLog: [], dead: false, deadMin: 0, deadStart: 0,
          holding: false, hold: 0, tension: 0, cd: 0, mood: 0, moodUntil: -1, flags: {}, mEnd: R.M, h0: D.handover, overEnd: D.handover, handed: false, ended: false, fade: null, sumF: 0, sumT: 0, minF: 100, lastFit: 0.5, sumFit: 0, fitT: 0, failed: null, lastEvEnd: -9, nextPrompt: 0, hint: "" };
        // record lengths so that a good plan roughly fills the playable time
        const base = clamp(R.mPlay / Math.max(2, Math.min(D.ideal, R.ids.length)) + 0.9, 5.5, 14);
        G.lens = {}; R.ids.forEach(id => { G.lens[id] = Math.round(base * (0.88 + 0.24 * ((hashStr(id) % 100) / 100)) * 10) / 10; });
        // opening on-air state
        if (R.key === "opener") G.cur = { tape: true, rec: { id: "tape", artist: "The house tape", title: "background mix", label: "", year: null, genre: "deep house", bpm: 104, energy: 1 }, len: 99, pos: 0 };
        else if (R.key === "follow-legend") { const lr = RP.rec(LEGEND_LAST); G.cur = { prev: true, rec: lr, len: D.handover + 2, pos: 0, label: R.legend + "'s last record" }; }
        else if (R.key === "overrun") G.cur = { prev: true, rec: { id: "axl", artist: R.legend, title: "the set that won't end", label: "", year: null, genre: "pop-dance", bpm: 128, energy: 5 }, len: 99, pos: 0, label: R.legend + "'s set" };
        else { // closing: the first record is already on
          const first = G.hand.slice().sort((a, b) => b.energy - a.energy)[0] || G.hand[0];
          G.hand.splice(G.hand.indexOf(first), 1); G.played.push(first.id);
          G.cur = { rec: first, len: lenOf(first) * 0.45, pos: 0 };
        }
        floor = kit.Floor({ theme: R.theme, venue: R.venue || D.venue, seed: R.seed, view: "club", n: D.people });
        floor.snap(G.floor / 20); floor.setBpm(G.cur.rec.bpm);
        setStage();
        if (R.key === "closing") sound.play(G.cur.rec, { vol: 0.7, fade: 0.5 }); else if (R.key === "follow-legend") sound.play(G.cur.rec, { vol: 0.75, fade: 0.5 }); else if (R.key === "overrun") sound.bed({ genre: "festival", bpm: 128, energy: 5, vol: 0.5, filter: null, seed: 5 }); else sound.bed({ genre: "deep house", bpm: 104, energy: 1, vol: 0.2, filter: ["lowpass", 700], seed: 3 });
        buildCrate(); showBrief(); refresh(true);
      }

      function setStage() {
        const D = R.D;
        if (R.key === "follow-legend") floor.stage = G.handed ? (G.t < D.handover + 5 ? [{ id: "kid", x: 160, act: "dj" }, { id: legendId, x: 210, act: "stand" }] : [{ id: "kid", x: 160, act: "dj" }]) : [{ id: legendId, x: 160, act: "dj" }, { id: "kid", x: 112, act: "stand" }];
        else if (R.key === "overrun") floor.stage = G.handed ? [{ id: "kid", x: 160, act: "dj" }] : [{ id: legendId, x: 160, act: "dj" }, { id: "kid", x: 112, act: "stand" }];
        else floor.stage = [{ id: "kid", x: 160, act: "dj" }];
      }

      /* ---------- briefing ---------- */
      function placeBrief() { const par = window.innerHeight <= 460 ? left : sceneBox; if (briefBox.parentNode !== par) par.appendChild(briefBox); }
      window.addEventListener("resize", placeBrief); host.cleanup(() => window.removeEventListener("resize", placeBrief));
      function showBrief() {
        placeBrief();
        const B = R.D.brief, rep = s => s.replace(/\{L\}/g, R.legendShort);
        briefBox.hidden = false; briefBox.innerHTML = "";
        const bx = el("div", { cls: "st-brief" }, briefBox);
        el("h3", { text: R.D.title }, bx);
        el("div", { cls: "mg-sub", text: fmtClock(R.D.start) + " – " + fmtClock(R.D.start + R.M) + " · " + R.M + " game minutes" }, bx);
        el("p", { text: rep(B.story) }, bx);
        if (R.key === "follow-legend") el("p", { html: "<b style='color:#c8b0ff;font-weight:400'>" + U.esc(R.legendShort) + ":</b> \"Good luck, uh... " + U.esc(R.wrongName) + ". Don't wreck the vibe.\"" }, bx);
        el("div", { cls: "goal", text: "GOAL: " + rep(B.goal) }, bx);
        const ul = el("ul", {}, bx); B.tips.forEach(t => el("li", { text: rep(t) }, ul));
        const row = el("div", { cls: "row" }, bx);
        const b = el("button", { cls: "btn primary", type: "button", text: "START THE SET ▶" }, row);
        b.addEventListener("click", start);
        msg.textContent = "Cue a record first (click one, or press its number). Then START.";
        say.textContent = "";
        showIdle();
        setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      }
      function start() {
        if (G.phase !== "brief") return;
        host.sfx("select");
        G.phase = R.D.handover > 0 ? "wait" : "play";
        briefBox.hidden = true; showIdle();
        if (G.phase === "wait") { msg.textContent = (R.key === "overrun" ? R.legend + " is still on the decks. Prep your first record." : R.legendShort + " is finishing up. Cue your first record.") + " Events pop up — choose fast."; }
        else msg.textContent = "The clock is running. Cue a record and MIX IN inside the green window.";
        refresh(true);
      }
      function showIdle() { evBox.className = "mg-panel st-ev st-evbox idle"; evBox.innerHTML = ""; }

      /* ---------- crate ---------- */
      function buildCrate() {
        crate.innerHTML = ""; cards = [];
        const order = R.ids.map(id => RP.rec(id));
        order.forEach((rec, i) => {
          const b = kit.card(host, rec, { key: String(i + 1), compact: true });
          b.setAttribute("role", "option"); b.setAttribute("aria-selected", "false");
          const rd = el("span", { cls: "rd" }, b.t3);
          b.addEventListener("click", () => { cue(rec.id); b.blur(); });
          crate.appendChild(b); cards.push({ rec, b, rd });
        });
      }
      function cue(id) {
        if (G.ended) return;
        const rec = RP.rec(id);
        if (G.played.indexOf(id) >= 0) return;
        G.next = rec; host.sfx("select");
        msg.textContent = "Cued: " + kit.full(rec) + (G.phase === "brief" ? " (then press START)" : "");
        msg.className = "mg-msg st-msg";
        refresh(true);
      }

      /* ---------- mixing ---------- */
      function inWindow() { const c = G.cur; if (!c) return 0; if (c.tape || c.prev) return 1; return c.pos >= c.len - win() ? 1 : 0; }
      function canMix() { return G.phase === "play" || (G.phase === "wait" && G.t >= G.h0); }
      function doMix(auto) {
        if (!canMix()) { host.sfx("error"); msg.textContent = G.phase === "wait" ? "Wait for the handover — " + R.legendShort + " is still playing." : "Not yet."; return; }
        if (!G.next) { host.sfx("error"); msg.className = "mg-msg st-msg bad"; msg.textContent = "Nothing cued! Pick a record from your crate."; floor.pop("CUE A RECORD!", "#ffd23f", 160, 72); return; }
        const cur = G.cur, nx = G.next, D = R.D;
        let winQ;
        if (G.dead) winQ = 0.55; else if (auto) winQ = 0.7; else if (cur.tape || cur.prev) winQ = 1; else {
          const rem = cur.len - cur.pos;
          winQ = rem <= win() ? 1 : clamp(0.55 + 0.45 * (cur.pos / Math.max(1, cur.len - win())), 0.5, 0.97);
          if (cur.pos > cur.len + 0.3) winQ = 0.8;
        }
        const mq = cur.tape ? { q: winQ * 0.95, bq: 1, gq: 1 } : mixQ(cur.rec, nx, winQ, R.diff);
        let q = mq.q; const lab = mixLabel(q), first = !G.played.length || cur.prev || cur.tape;
        const parts = [];
        // first record after a legend: the gap
        let fx = 0;
        if (R.key === "follow-legend" && cur.prev) {
          const gap = Math.max(0, 4.6 - nx.energy) + Math.abs(nx.bpm - cur.rec.bpm) / 8;
          if (gap > 1.1) { fx -= clamp(gap * 11, 8, 30); parts.push("The floor deflates. Nobody wants a step down from " + R.legendShort + "."); }
          else if (gap <= 0.45) { fx += 5; G.pat = clamp(G.pat + 8, 0, 100); parts.push("They barely noticed the switch. That's a compliment."); }
        }
        if (R.key === "opener" && cur.tape && nx.energy >= 4) { fx -= 5; parts.push("A big opener on an empty room? A couple of people look up, startled."); }
        if (R.key === "overrun" && cur.prev && G.flags.ready) { q = clamp(q + 0.1, 0, 1); fx += 3; parts.push("Cued and ready: you're in before the cheers die."); }
        G.mixes.push({ q, label: lab[1], t: G.t });
        G.floor = clamp(G.floor + (q - 0.62) * 14 + fx, 0, 100);
        if (lab[1] === "wreck") G.pat = clamp(G.pat - 6, 0, 100); else if (lab[1] === "clean") G.pat = clamp(G.pat + 2, 0, 100);
        // switch the track
        G.hand = G.hand.filter(r => r.id !== nx.id); G.played.push(nx.id);
        G.cur = { rec: nx, len: lenOf(nx), pos: 0, loops: 0 }; G.next = null; G.stale = 0;
        if (G.dead) { G.dead = false; }
        if (G.phase === "wait") G.phase = "play";
        const wasPrev = !!cur.prev;
        if (!G.handed && (cur.prev || cur.tape)) { G.handed = true; setStage(); }
        sound.play(nx, { vol: 0.74, fade: 2.0 });
        floor.setBpm(nx.bpm);
        mixAnim = 1;
        host.sfx(lab[1] === "wreck" ? "scratch" : "blip");
        floor.pop(lab[0] + "!", lab[1] === "clean" ? "#9be15d" : lab[1] === "smooth" ? "#62e6ff" : lab[1] === "sloppy" ? "#ffd23f" : "#ff6a6a", 160, 72);
        if (lab[1] === "clean") { host.timeout(() => host.sfx("cheer"), 150); floor.emote("note", 4); } else if (lab[1] === "wreck") { host.sfx("boo"); floor.emote("?", 5); }
        msg.className = "mg-msg st-msg " + (q >= 0.65 ? "ok" : q < 0.45 ? "bad" : "");
        msg.textContent = lab[0] + " — " + kit.pair(nx) + (parts.length ? "  ·  " + parts[0] : "");
        say.textContent = pickOf(MIXLINES[lab[1]]);
        if (wasPrev) G.legendLeft = G.t;
        void first; void D;
        refresh(true);
      }
      let mixAnim = 0;

      /* ---------- other actions ---------- */
      function filterDown() { if (G.holding || G.cd > 0 || !G.cur || G.cur.prev || G.cur.tape || G.dead || G.phase !== "play") return; G.holding = true; G.hold = 0; G.tension = 0; fltBtn.classList.add("hold"); }
      function filterUp() {
        if (!G.holding) return; G.holding = false; fltBtn.classList.remove("hold"); sound.filter("none");
        const ten = G.tension; G.cd = 4;
        if (ten >= 30) {
          if (G.hold > 4.6) { G.floor = clamp(G.floor - 3, 0, 100); msg.className = "mg-msg st-msg bad"; msg.textContent = "Held it too long. The room lost the thread."; floor.pop("TOO LONG", "#ff6a6a", 160, 72); host.sfx("error"); }
          else { const gain = 2 + 7 * clamp((ten - 30) / 70, 0, 1); G.floor = clamp(G.floor + gain * (G.floor > 88 ? 0.4 : 1), 0, 100); G.stale = Math.max(0, G.stale - 0.2); msg.className = "mg-msg st-msg ok"; msg.textContent = "THE DROP. Filter open, floor up."; floor.pop("DROP!", "#9be15d", 160, 72); host.sfx("cheer"); floor.emote("heart", 3); floor.emote("note", 3); }
        }
        G.tension = 0;
      }
      function doLoop() {
        const c = G.cur;
        if (!c || c.prev || c.tape || G.phase !== "play") { host.sfx("error"); return; }
        if ((c.loops || 0) >= 2) { host.sfx("error"); msg.textContent = "Already looped twice. Any more and it's a ringtone."; return; }
        c.len += 2; c.loops = (c.loops || 0) + 1; G.stale = clamp(G.stale + 0.08, 0, 1); host.sfx("blip");
        if (G.dead) { G.dead = false; sound.play(c.rec, { vol: 0.7, fade: 0.8 }); }
        msg.className = "mg-msg st-msg"; msg.textContent = "Looped the groove: +2 minutes. The crowd's patience for repeats is limited."; refresh(true);
      }
      function doFade() {
        if (G.ended || G.phase !== "play") { host.sfx("error"); return; }
        const rem = G.mEnd - G.t;
        G.fade = { rem, t: G.t };
        finishSet(rem <= 3.4 ? "fade" : "early");
      }
      function applyFx(fx) {
        if (!fx) return;
        if (fx.floor) { G.floor = clamp(G.floor + fx.floor, 0, 100); if (fx.floor >= 4) floor.emote("note", 3); }
        if (fx.pat) G.pat = clamp(G.pat + fx.pat, 0, 100);
        if (fx.win) G.pat = clamp(G.pat + fx.win, 0, 100);
        if (fx.mood) { G.mood = fx.mood[0]; G.moodUntil = G.t + fx.mood[1]; }
        if (fx.time) G.mEnd += fx.time;
        if (fx.ready) G.flags.ready = true;
        if (fx.promised) G.flags.promised = true;
        if (fx.overEnd) { G.h0 = Math.max(G.t + 1, G.h0 + fx.overEnd); }
        if (fx.plug) { G.h0 = Math.min(G.h0, G.t + 0.6); sound.stop(0.2); G.flags.plug = true; floor.pop("THE PLUG IS PULLED", "#ff6a6a", 160, 72); host.sfx("boo"); }
      }

      /* ---------- events ---------- */
      function openEvent(ev) {
        G.curEv = { ev, left: evTimeout(), done: false };
        clearTimeout(outTO);
        evBox.className = "mg-panel st-ev st-evbox"; evBox.innerHTML = "";
        const pc = el("canvas", { width: 32, height: 32 }, evBox);
        try { pc.getContext("2d").drawImage(RP.chars.portrait(ev.who, 32), 0, 0); } catch (e) { /* ignore */ }
        el("div", { cls: "who", html: "<b>" + U.esc(ev.name) + "</b> · " + U.esc(ev.role || "") }, evBox);
        el("div", { cls: "tx", text: ev.text }, evBox);
        const ch = el("div", { cls: "ch" }, evBox);
        ev.choices.forEach((c, i) => {
          const b = el("button", { cls: "btn", type: "button" }, ch);
          b.innerHTML = "<kbd>" + "QWE"[i] + "</kbd>" + U.esc(c.t); b.addEventListener("click", () => choose(i));
        });
        const tm = el("div", { cls: "tm" }, evBox); evTimerEl = el("i", {}, tm);
        host.sfx("ping");
        msg.textContent = ""; say.textContent = "";
      }
      function choose(i) {
        const ce = G.curEv; if (!ce || ce.done) return; ce.done = true;
        const ev = ce.ev, c = ev.choices[i]; if (!c) return;
        let fx = c.fx, sayT = c.say, r = c.r == null ? 0.5 : c.r;
        if (typeof fx === "function") { const o = fx(G, R) || {}; fx = o; if (o.say) sayT = o.say; if (o.r != null) r = o.r; }
        applyFx(fx);
        G.evLog.push({ id: ev.at, r });
        G.curEv = null; G.lastEvEnd = G.t;
        evBox.className = "mg-panel st-ev st-evbox"; evBox.innerHTML = "";
        const pc = el("canvas", { width: 32, height: 32 }, evBox);
        try { pc.getContext("2d").drawImage(RP.chars.portrait(ev.who, 32), 0, 0); } catch (e) { /* ignore */ }
        el("div", { cls: "who", html: "<b>" + U.esc(ev.name) + "</b> · " + U.esc(ev.role || "") }, evBox);
        el("div", { cls: "tx", text: ev.text }, evBox);
        el("div", { cls: "out " + (r >= 0.7 ? "" : r >= 0.4 ? "mid" : "bad"), text: (r >= 0.7 ? "✔ " : r >= 0.4 ? "• " : "✘ ") + (sayT || "") }, evBox);
        host.sfx(r >= 0.7 ? "success" : r >= 0.4 ? "click" : "error");
        refresh(true);
        outTO = host.timeout(() => { if (!G.curEv && !G.ended) showIdle(); }, 3200);
      }

      /* ---------- per-frame simulation ---------- */
      function fitNow() {
        const c = G.cur; if (!c) return { fit: 0.5 };
        const u = clamp((G.t - (R.key === "overrun" ? G.h0 : 0)) / Math.max(1, G.mEnd - (R.key === "overrun" ? G.h0 : 0)), 0, 1);
        const mood = G.t < G.moodUntil ? G.mood : 0;
        const want = clamp(R.D.want(u) + mood, 1, 5);
        const f = fitOf(R.D, c.rec, want, R.diff); f.want = want; f.u = u; return f;
      }
      function sim(dt) {
        if (G.phase !== "wait" && G.phase !== "play") return;
        const D = R.D, dm = dt / secPerMin;
        G.t += dm;
        const c = G.cur;
        if (G.cd > 0) G.cd = Math.max(0, G.cd - dt);
        if (G.holding) { G.hold += dt; G.tension = clamp(G.tension + 40 * dt, 0, 100); if (((G.hold * 12) | 0) !== (((G.hold - dt) * 12) | 0)) sound.filter("lowpass", Math.max(260, 5200 * Math.pow(1 - G.tension / 100, 2))); }
        if (mixAnim > 0) mixAnim = Math.max(0, mixAnim - dt / 1.6);
        // moods fade
        if (G.t >= G.moodUntil) G.mood = 0;
        // events
        if (!G.curEv && G.evi < G.evs.length && G.t >= G.evs[G.evi].at && G.t - G.lastEvEnd > 2.5 && G.t < G.mEnd - 1.5) { openEvent(G.evs[G.evi++]); }
        if (G.curEv) { G.curEv.left -= dt; if (evTimerEl) evTimerEl.style.width = clamp(G.curEv.left / evTimeout(), 0, 1) * 100 + "%"; if (G.curEv.left <= 0) choose(G.curEv.ev.def == null ? 0 : G.curEv.ev.def); }
        if (G.phase === "wait") {
          c.pos += dm;
          // the crowd cools while someone else hogs the decks
          const pot = D.pot(0);
          G.floor = clamp(G.floor + (R.key === "overrun" ? -0.35 : -0.1) * dm - (G.floor > pot ? 0.2 * dm : 0), 0, 100);
          if (R.key === "overrun") G.pat = clamp(G.pat - 0.45 * dm, 0, 100);
          if (G.t >= G.h0 && !G.handoverShown) {
            G.handoverShown = true; G.phase = "wait";
            host.sfx("horn"); floor.pop(R.key === "overrun" ? "YOU'RE ON!" : "YOUR TURN!", "#ffd23f", 160, 72);
            msg.className = "mg-msg st-msg ok"; msg.textContent = (R.key === "overrun" ? R.legend + " finally steps back." : R.legendShort + " hands you the headphones.") + " MIX IN now!";
            sound.volume(0.5, 0.5);
          }
          if (G.t >= G.h0 + 2.6 && G.handoverShown && !G.dead) { G.dead = true; G.deadStart = G.t; sound.stop(1.2); msg.className = "mg-msg st-msg bad"; msg.textContent = "Dead air! Cue a record and MIX IN!"; floor.pop("DEAD AIR!", "#ff6a6a", 160, 72); host.sfx("boo"); }
          if (G.dead) { G.floor = clamp(G.floor - 5 * dm, 0, 100); G.pat = clamp(G.pat - 6 * dm, 0, 100); G.deadMin += dm; }
        } else if (G.phase === "play") {
          const f = fitNow();
          G.lastFit = f.fit; G.sumFit += f.fit * dm; G.fitT += dm;
          if (c && !c.tape && !c.prev) {
            c.pos += dm;
            if (c.pos > c.len * 0.85) G.stale = clamp(G.stale + dm * 0.1, 0, 1);
            if (c.pos >= c.len && !G.dead) {
              if (G.next) doMix(true);
              else { G.dead = true; G.deadStart = G.t; sound.stop(2.5); msg.className = "mg-msg st-msg bad"; msg.textContent = "The record ran out! DEAD AIR — cue the next one and MIX IN."; floor.pop("DEAD AIR!", "#ff6a6a", 160, 72); host.sfx("boo"); }
            }
          } else if (c && c.tape) { /* the tape never ends */ }
          const pot = D.pot(f.u || 0), fitv = f.fit * (1 - 0.5 * G.stale);
          let target = pot * (0.15 + 0.85 * fitv);
          if (G.dead) target = 0;
          G.floor = clamp(G.floor + (target - G.floor) * (target > G.floor ? 0.3 : 0.55) * dm, 0, 100);
          if (G.dead) { G.floor = clamp(G.floor - 4 * dm, 0, 100); G.pat = clamp(G.pat - 6 * dm, 0, 100); G.deadMin += dm; }
          // the second gauge
          if (R.key === "opener") G.pat = clamp(G.pat + (f.fit - 0.55) * 2.2 * dm, 0, 100);
          else if (R.key === "follow-legend") G.pat = clamp(G.pat + (f.fit - 0.55) * 2.6 * dm, 0, 100);
          else if (R.key === "overrun") G.pat = clamp(G.pat + (f.fit - 0.55) * 1.6 * dm, 0, 100);
          else G.pat = clamp(G.pat + (f.fit - 0.5) * 1.0 * dm, 0, 100);
          if (R.key === "opener" && G.t > 8 && f.d > 1.1) { G.floor = clamp(G.floor - 1.2 * dm, 0, 100); } // pushing too hard on a cold room
          G.sumF += G.floor * dm; G.sumT += dm; G.minF = Math.min(G.minF, G.floor);
        }
        if (G.phase === "wait") { G.sumF += G.floor * dm; G.sumT += dm; }
        // closing: lights come up
        if (R.key === "closing") { const lt = clamp((G.t - (R.M - 9)) / 9, 0, 1); floor.lights = lt * 0.85; }
        // failure checks
        if (!G.failed && G.phase !== "brief") {
          if (G.pat <= 0 && R.key !== "follow-legend") G.failed = R.key === "closing" ? "The staff killed the music. Lights on early." : "The promoter pulled the plug on your set.";
          else if (R.key === "follow-legend" && G.handed && G.floor < 38) G.failed = "The floor emptied. They went to look for " + R.legendShort + ".";
          if (G.failed) { finishSet("fail"); return; }
        }
        // the end
        if (G.t >= G.mEnd) finishSet("time");
      }

      /* ---------- ending ---------- */
      function finishSet(kind) {
        if (G.ended) return; G.ended = true; G.phase = "end";
        sound.stop(kind === "fade" ? 3 : 0.8);
        if (R.key === "closing") floor.lights = 0.95;
        const D = R.D;
        // component scores
        const finalF = G.floor, avgF = G.sumT > 0 ? G.sumF / G.sumT : G.floor;
        const fs = clamp(0.7 * (finalF / D.goal.final) + 0.3 * (avgF / D.goal.avg), 0, 1);
        const qs = G.mixes.length ? G.mixes.reduce((a, m) => a + m.q, 0) / G.mixes.length : 0.25;
        const ms = clamp(qs - 0.08 * G.deadMin, 0, 1);
        const es = G.evLog.length ? G.evLog.reduce((a, e) => a + e.r, 0) / G.evLog.length : 0.55;
        let ts;
        const rem = Math.max(0, G.mEnd - G.t);
        if (kind === "fade") ts = 1 - clamp(G.fade.rem, 0, 3.4) * 0.05;
        else if (kind === "early") ts = Math.max(0, 0.55 - (G.fade.rem - 3.4) / R.M * 1.5);
        else if (kind === "time") ts = G.cur && !G.cur.prev && !G.cur.tape && G.cur.pos >= G.cur.len - win() ? 0.85 : 0.6;
        else ts = 0.3;
        if (R.key === "closing") {
          const lr = G.cur && G.cur.rec;
          const closerish = lr && (hasV(lr, "closer") || hasV(lr, "sunrise") || lr.energy <= 3);
          ts = clamp(ts + (closerish ? 0.15 : -0.15) + (G.flags.promised && lr && hasV(lr, "closer") ? 0.1 : G.flags.promised ? -0.1 : 0), 0, 1);
        }
        if (R.key === "overrun" && !G.handed) ts = 0;
        const pm = clamp(G.pat / 100, 0, 1), pw = R.key === "follow-legend" ? clamp(G.pat / 60, 0, 1) : pm;
        let score = Math.round(100 * (0.35 * fs + 0.2 * ms + 0.2 * es + 0.15 * ts + 0.1 * pw));
        if (G.failed) score = Math.min(score, 45);
        score = clamp(score, 0, 100);
        const ok = !G.failed && score >= 58 && finalF >= D.goal.final * 0.7;
        const count = lbl => G.mixes.filter(m => m.label === lbl).length;
        const res = { ok, score, scenario: R.key, floor: Math.round(finalF), avgFloor: Math.round(avgF), mixes: { clean: count("clean"), smooth: count("smooth"), sloppy: count("sloppy"), wreck: count("wreck") }, deadAir: Math.round(G.deadMin * 10) / 10, events: G.evLog.length, meter: Math.round(G.pat), reason: G.failed || (ok ? "" : "score"), minutes: R.M };
        host.timeout(() => showEnd(res, { fs, ms, es, ts, pw, kind }), kind === "fail" ? 500 : 1100);
        const lab = G.failed ? "SET OVER" : kind === "fade" ? "GRACEFUL EXIT" : kind === "early" ? "EARLY EXIT" : R.key === "closing" ? "LIGHTS ON" : "HANDOVER";
        floor.pop(lab, G.failed ? "#ff6a6a" : "#9be15d", 160, 72); host.sfx(G.failed ? "fail" : "cheer");
        refresh(true);
      }
      async function showEnd(res, p) {
        if (finished) return;
        stage.hidden = true;
        const D = R.D, ok = res.ok;
        const parts = [{ label: "THE FLOOR", v: p.fs, color: "#ff3fa4" }, { label: "MIXING", v: p.ms, color: "#62e6ff" }, { label: "EVENTS", v: p.es, color: "#ffc44d" }, { label: "TIMING", v: p.ts, color: "#9be15d" }, { label: D.meter, v: p.pw, color: "#c8b0ff" }];
        const lines = [], dim = [];
        if (G.failed) lines.push(G.failed);
        else lines.push(ok ? ({ opener: "You handed over a warm floor: " + res.floor + "% full as the next DJ stepped up.", "follow-legend": "You followed " + R.legendShort + " and held the floor at " + res.floor + "%. They were chanting your name. Well. A name.", overrun: "You got on, you played tight, and you handed over on time. The promoter nearly smiled.", closing: "The lights came up on a happy floor and a perfect last record." }[R.key]) : "The set limped home: floor " + res.floor + "%, " + res.mixes.wreck + " train wreck(s), " + res.deadAir + " min of dead air.");
        const worst = G.evLog.slice().sort((a, b) => a.r - b.r)[0];
        if (worst && worst.r < 0.4) dim.push("One of those moments went badly. Think about what the room needed.");
        if (res.deadAir > 0.5) dim.push("Dead air: " + res.deadAir + " game minutes. Cue the next record before the current one ends.");
        if (res.mixes.wreck) dim.push(res.mixes.wreck + " train wreck(s). Watch the BPM gap and the green window.");
        dim.push("Played: " + (G.played.map(id => RP.rec(id).title).join("  ›  ") || "nothing"));
        host.sfx(ok ? "success" : "fail");
        const choice = await kit.endCard(host, endBox, { ok, score: res.score, kicker: (R.venue || D.venue) + " · " + D.title, title: ok ? ({ opener: "A WARM HANDOVER", "follow-legend": "YOU HELD THE FLOOR", overrun: "OUT ON TIME", closing: "LIGHTS ON, HEARTS FULL" }[R.key]) : (G.failed ? "SET CUT SHORT" : "A ROUGH SET"), parts, lines, dim, canAgain: !ok, againLabel: "TRY AGAIN" });
        if (finished) return;
        if (choice === "again") { endBox.innerHTML = ""; stage.hidden = false; floorReset(); return; }
        done(res);
      }
      function floorReset() { clearTimeout(outTO); sound.killAll(); setup(); }

      /* ---------- rendering ---------- */
      function refresh(force) {
        const D = R.D, c = G.cur;
        const u = clamp(G.t / R.M, 0, 1);
        timeEl.innerHTML = fmtClock(D.start + G.t).replace(/ (AM|PM)/, "<small>$1</small>");
        clockSub.textContent = G.phase === "brief" ? "ready" : G.phase === "end" ? "done" : (G.mEnd - G.t > 0 ? Math.ceil(G.mEnd - G.t) + " min left" : "time");
        slotFill.style.width = (clamp(G.t / G.mEnd, 0, 1) * 100) + "%";
        if (R.key === "overrun" || R.key === "follow-legend") { slotGhost.style.display = ""; slotGhost.style.left = "0"; slotGhost.style.width = (clamp((G.h0) / G.mEnd, 0, 1) * 100) + "%"; slotStart.style.display = "none"; } else { slotGhost.style.display = "none"; slotStart.style.display = "none"; }
        slotL.innerHTML = "<span>" + fmtClock(D.start) + "</span><span>" + (R.key === "closing" ? "LIGHTS ON " : "HANDOVER ") + fmtClock(D.start + G.mEnd) + "</span>";
        g1a.innerHTML = "THE FLOOR <b>" + Math.round(G.floor) + "%</b>"; g1b.textContent = "GOAL " + D.goal.final + "%";
        bar1f.style.width = clamp(G.floor, 0, 100) + "%"; bar1g.style.left = D.goal.final + "%"; bar1.classList.toggle("low", G.floor < 25);
        g2a.innerHTML = D.meter + " <b>" + Math.round(G.pat) + "</b>"; g2b.textContent = R.key === "follow-legend" ? "60+ wins them" : (G.pat < 25 ? "DANGER" : "");
        bar2f.style.width = clamp(G.pat, 0, 100) + "%"; bar2.classList.toggle("low", G.pat < 25 && R.key !== "follow-legend");
        // transport
        const label = c ? (c.prev || c.tape ? (c.label || kit.pair(c.rec)) : kit.pair(c.rec)) : "—";
        now.innerHTML = "";
        if (c) {
          now.appendChild(document.createTextNode("♪ " + (c.prev || c.tape ? (c.tape ? "THE HOUSE TAPE " : label + " ") : kit.pair(c.rec) + " ")));
          if (!c.prev && !c.tape) { el("small", { text: "(" + kit.sub(c.rec) + ") · " + c.rec.bpm + " BPM" }, now); now.appendChild(kit.pips(c.rec.energy || 3)); }
          else el("small", { text: (c.rec.bpm ? c.rec.bpm + " BPM" : "") }, now);
        }
        if (c && !c.prev && !c.tape) {
          trkFill.style.width = clamp(c.pos / c.len, 0, 1) * 100 + "%"; trkWin.style.display = ""; trkWin.style.left = clamp((c.len - win()) / c.len, 0, 1) * 100 + "%"; trkWin.style.right = "0";
          trkTxt.textContent = fmtDur(c.pos) + " / " + fmtDur(c.len) + (G.stale > 0.3 ? "  · getting stale" : "");
        } else if (c && c.prev && G.phase !== "brief") {
          const pr = clamp(G.t / Math.max(1, G.h0), 0, 1); trkFill.style.width = pr * 100 + "%"; trkWin.style.display = "none"; trkTxt.textContent = G.t >= G.h0 ? "handover!" : "handover in " + fmtDur(G.h0 - G.t);
        } else { trkFill.style.width = "0"; trkWin.style.display = "none"; trkTxt.textContent = c && c.tape ? "no hurry: the tape loops" : ""; }
        if (G.next) { nextEl.className = "st-next"; nextEl.innerHTML = "NEXT UP <b>" + U.esc(kit.pair(G.next)) + "</b> · " + G.next.bpm + " BPM" + (c ? " · " + (G.next.bpm - c.rec.bpm >= 0 ? "+" : "") + (G.next.bpm - c.rec.bpm) + " vs now" : ""); }
        else { nextEl.className = "st-next warn"; nextEl.innerHTML = "NEXT UP <b>nothing cued — pick a record</b>"; }
        const can = canMix() && !G.ended;
        mixBtn.disabled = G.phase === "brief" || G.ended || (G.phase === "wait" && G.t < G.h0);
        mixBtn.innerHTML = (G.phase === "wait" && G.t < G.h0 ? "WAIT… " : "MIX IN ▶ ") + "<small>Space</small>";
        mixBtn.classList.toggle("ready", !!(can && G.next && (inWindow() || G.dead || G.handoverShown && c && c.prev)));
        loopBtn.disabled = !(c && !c.prev && !c.tape && G.phase === "play");
        fltBtn.disabled = !(G.phase === "play" && c && !c.prev && !c.tape && !G.dead) || G.cd > 0;
        fadeBtn.disabled = G.phase !== "play";
        // chips
        const leftN = G.hand.length, remain = Math.max(0, G.mEnd - G.t), avgLen = G.hand.length ? G.hand.reduce((a, r) => a + lenOf(r), 0) / G.hand.length : 7;
        const curRem = c && !c.prev && !c.tape ? Math.max(0, c.len - c.pos) : 0;
        const per = (remain - curRem) / Math.max(1, leftN);
        cLeft.innerHTML = "RECORDS LEFT <b>" + leftN + "</b>";
        const pace = leftN === 0 ? ["no records left!", "r"] : per > avgLen * 1.45 ? ["running short: loop or stretch", "a"] : per < avgLen * 0.55 ? ["too many: mix earlier", "a"] : ["pace ok", "g"];
        cPace.innerHTML = "PACE <b class='" + (pace[1] === "g" ? "ok" : pace[1] === "r" ? "bad" : "") + "'>" + pace[0] + "</b>";
        const f = fitNow();
        if (R.diff <= 3 && G.phase !== "brief" && f.want) { cWant.style.display = ""; cWant.innerHTML = "THE ROOM WANTS <b>" + ["", "▮", "▮▮", "▮▮▮", "▮▮▮▮", "▮▮▮▮▮"][clamp(Math.round(f.want), 1, 5)] + "</b>"; } else cWant.style.display = "none";
        // crate
        const want = f.want || 3;
        cards.forEach(cd => {
          const used = G.played.indexOf(cd.rec.id) >= 0;
          cd.b.classList.toggle("used", used); cd.b.disabled = used || G.ended;
          const nx = G.next && G.next.id === cd.rec.id;
          cd.b.classList.toggle("next", !!nx); cd.b.classList.toggle("sel", !!nx); cd.b.setAttribute("aria-selected", nx ? "true" : "false");
          if (used) { cd.rd.textContent = "played"; cd.rd.className = "rd"; }
          else if (R.diff <= 3) { const d = cd.rec.energy - want; cd.rd.className = "rd " + (Math.abs(d) <= 0.7 ? "g" : Math.abs(d) <= 1.4 ? "a" : "r"); cd.rd.textContent = Math.abs(d) <= 0.7 ? "right energy" : d > 0 ? "too hot now" : "too soft now"; }
          else { cd.rd.textContent = ""; }
        });
      }

      /* ---------- events: input ---------- */
      mixBtn.addEventListener("click", () => doMix(false));
      loopBtn.addEventListener("click", doLoop);
      fadeBtn.addEventListener("click", doFade);
      fltBtn.addEventListener("pointerdown", e => { e.preventDefault(); filterDown(); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(t => fltBtn.addEventListener(t, filterUp));
      giveUp.addEventListener("click", () => { host.sfx("click"); done({ ok: false, score: 0, scenario: R.key, floor: Math.round(G.floor), avgFloor: Math.round(G.sumT ? G.sumF / G.sumT : G.floor), mixes: { clean: 0, smooth: 0, sloppy: 0, wreck: 0 }, deadAir: 0, events: G.evLog.length, meter: Math.round(G.pat), reason: "left" }); });
      host.onKey(e => {
        if (finished || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key, tag = document.activeElement && document.activeElement.tagName;
        if (G.phase === "brief") { if (/^[1-9]$/.test(k)) { const cd = cards[+k - 1]; if (cd) { e.preventDefault(); cue(cd.rec.id); } } else if (k === "Enter" && tag !== "BUTTON") { e.preventDefault(); start(); } return; }
        if (G.ended) return;
        if (/^[1-9]$/.test(k)) { const cd = cards[+k - 1]; if (cd && G.played.indexOf(cd.rec.id) < 0) { e.preventDefault(); cue(cd.rec.id); } }
        else if (k === " " || (k === "Enter" && tag !== "BUTTON")) { e.preventDefault(); if (!e.repeat) doMix(false); }
        else if (/^[qwe]$/i.test(k) && G.curEv) { e.preventDefault(); choose("qwe".indexOf(k.toLowerCase())); }
        else if ((k === "f" || k === "F") && !e.repeat) { e.preventDefault(); filterDown(); }
        else if ((k === "l" || k === "L") && !e.repeat) { e.preventDefault(); doLoop(); }
        else if ((k === "x" || k === "X") && !e.repeat) { e.preventDefault(); doFade(); }
      });
      host.onKeyUp(e => { if (e.key === "f" || e.key === "F") filterUp(); });

      /* ---------- main loop ---------- */
      setup();
      host.raf(tm => {
        if (finished) return false;
        const t = tm / 1000;
        if (stage.hidden) { last = t; return; }
        if (last == null) last = t;
        const dt = clamp(t - last, 0, 0.1); last = t;
        sim(dt);
        floor.setEnergy(clamp(G.floor / 20, 0, 5));
        floor.draw(t);
        sc.imageSmoothingEnabled = false; sc.drawImage(floor.canvas, 0, 0);
        uiAcc += dt; if (uiAcc > 0.1) { uiAcc = 0; refresh(); }
      });
      host.cleanup(() => { finished = true; clearTimeout(outTO); });
    });
  }
});
})();
