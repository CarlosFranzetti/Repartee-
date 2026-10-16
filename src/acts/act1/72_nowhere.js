/* Act 1 — a1_nowhere: inside Nowhere, Saturday 10 PM. Booth with turntables, the bar, bartenders Mia and
   Rafa, regulars, Dante. The vinyl hour is crowd.Read with your four records. Bartenders dancing = a good set
   -> Dante: "Great set. I'll pay you next week." -> RP.completeAct.
   Flags: a1_nowSeen, a1_setTries, a1_setGood, a1_setDone. */
(function () {
"use strict";
const RP = window.RP;
const A1 = RP.a1, PK = RP.PK;
const { R, P, ell, line, poly, bayer, mulberry, clamp, txt, txtW, txtC, mix, ramp } = RP.u;
const U = PK.util;
const W = 640, FY = 164;
const BOOTH = { x: 200, y: 98, w: 240 }, BAR = { x: 500, y: 84, w: 140, h: 112 };
const LAMPS = [[153, 31], [220, 31], [287, 31], [353, 31], [420, 31], [487, 31]];
const CLOSER_DEFAULT = "cece_peniston_finally";

const B = {
  booth: () => A1.memo("nw_booth", 240, 76, c => PK.djBooth(c, 0, 0, 240, { gear: "turntable", mixer: "2ch", logo: "NOWHERE", model: "technics" })),
  bar: () => A1.memo("nw_bar", 150, 116, c => PK.bar(c, 4, 0, BAR.w, BAR.h, { stools: false, seed: 401 })),
  couch: () => A1.memo("nw_couch", 100, 60, c => { PK.couch(c, 4, 4, 90, { color: "#6a2a5a" }); }),
  speaker: () => A1.memo("nw_spk", 52, 98, c => { PK.speakerStack(c, 3, 2, 46, 92, {}); })
};

function paintNowhere(c, S) {
  const em = [], good = !!S.f.a1_setGood;
  /* walls */
  PK.brick(c, 0, 0, W, FY, { base: "#34204a", mortar: "#241838", worn: 0.7, seed: 402, bw: 14, bh: 6 });
  U.dshade(c, 0, 0, W, FY, "#06020e", (px, py) => 0.45 + (py / FY) * 0.2, 0.55);
  R(c, 0, FY - 8, W, 8, "#140c1c"); R(c, 0, FY - 8, W, 1, "#3a2a4a");
  /* floor */
  PK.tiles(c, 0, FY, W, 256 - FY, { a: "#2a2040", b: "#1a1230", checker: true, size: 36, horizonY: 100, vx: 320, grout: "#0e0818", seed: 403 });
  U.dshade(c, 0, FY, W, 92, "#000000", (px, py) => 0.25, 0.3);
  /* LED wall behind the booth */
  em.push.apply(em, PK.ledWall(c, 190, 22, 260, 66, { pattern: good ? "equalizer" : "waves", seed: 404, palette: ["#ff3fa4", "#39d0ff", "#a05cff", "#ffd23f"] }));
  /* truss + disco ball */
  const tr = PK.truss(c, 120, 8, 400, 12, { lights: ["#ff3fa4", "#39d0ff", "#a05cff", "#ffd23f", "#39d0ff", "#ff3fa4"], seed: 405 }); em.push.apply(em, tr);
  em.push.apply(em, PK.discoBall(c, 320, 54, 11, { string: 12 }));
  /* neon + exit sign + wall posters */
  em.push.apply(em, PK.neon(c, "NOWHERE", 22, 52, "#ff3fa4", { scale: 2, tube: 2, spacing: 2, strength: 1 }));
  em.push.apply(em, PK.neon(c, "NO HERE", 26, 74, "#39d0ff", { scale: 1, tube: 1, spacing: 2, strength: 0.7 }));
  R(c, 8, 118, 34, 12, "#0a2a1a"); txtC(c, "EXIT", 25, 121, "#ff4a4a", 1); R(c, 8, 118, 34, 1, "#4a2a2a"); em.push([8, 118, 34, 12]);
  PK.poster(c, 60, 96, 30, 42, { palette: "neon", title: "NOWHERE", lines: ["SAT 10PM"], seed: 406 });
  /* speaker stacks (paint) */
  A1.blit(c, B.speaker(), 118, 82); A1.blit(c, B.speaker(), 474, 82);
  /* stage riser */
  PK.stage(c, 150, 170, 340, 28, { wedges: false, trim: true, seed: 407 });
  /* bar back (rows above the counter) */
  const bb = B.bar();
  A1.slice(c, bb, 0, 75, BAR.x - 4, BAR.y); em.push.apply(em, A1.emAt(bb, BAR.x - 4, BAR.y));
  /* coat hooks, cables, a keg */
  for (let i = 0; i < 3; i++) { R(c, 14 + i * 12, 150, 8, 2, "#6a667c"); }
  return em;
}

function lightNowhere(S) {
  const good = !!S.f.a1_setGood;
  return {
    ambient: "#34265a",
    lights: [
      { x: 320, y: 236, r: 280, color: "#9a80e0", steps: 3, power: 0.45 },   // booth glow on the floor: faces read in the dark
      { x: 190, y: 120, r: 210, color: "#ff3fa4", steps: 4, sy: 1.2, power: good ? 0.9 : 0.6, rim: true },
      { x: 450, y: 120, r: 210, color: "#39d0ff", steps: 4, sy: 1.2, power: good ? 0.9 : 0.6, rim: true },
      { x: 320, y: 60, r: 170, color: "#a05cff", steps: 3, power: 0.6 },
      { x: 320, y: 104, r: 120, color: "#ffd890", steps: 3, power: 0.7 },
      { x: 570, y: 130, r: 140, color: "#ffb04a", steps: 3, power: 0.8 },
      { x: 40, y: 100, r: 100, color: "#ff3fa4", steps: 3, power: 0.5 }
    ],
    halos: [{ x: 320, y: 54, r: 30, color: "#c8c0ff", strength: 0.6 }],
    key: { x: 320, y: 60 }, shadow: 0.7, rims: [{ x: 190, y: 120, r: 240, color: "#ff3fa4" }, { x: 450, y: 120, r: 240, color: "#39d0ff" }]
  };
}

function drawNowhere(c, S, t) {
  /* spinning platters */
  [[BOOTH.x + 28, BOOTH.y + 17], [BOOTH.x + 240 - 70 + 28 - 12, BOOTH.y + 17]].forEach(([px, py], i) => { const a = t / 260 + i; P(c, px + Math.cos(a) * 14, py + Math.sin(a) * 5, "#e8e4f0"); });
  /* LED wall pulse band */
  const k = Math.floor(t / 400) % 6;
  R(c, 190, 22 + k * 11, 260, 1, "#ffffff22");
}

/* ---------- scenes ---------- */
async function arrival(S) {
  S.f.a1_nowSeen = true;
  await RP.lines([
    "Nowhere. Haze, bass, colored light and a stage the size of a small apartment. It smells like fog juice and ambition.",
    "@dante There he is. The opener.",
    "@dante You made it. On time. Early, for you.",
    "@dante Booth's yours. First hour is vinyl. House rule. After that: your USB. No CDs, no laptop, don't be late.",
    "Where's the crowd?",
    "@dante It's ten. Nobody's here at ten. Bartenders and the regulars. That's the room.",
    "@dante If the bartenders dance, the floor follows. That's the whole job. Go."
  ]);
}

async function playSet(S) {
  if (S.f.a1_setDone) { await RP.say("The set's done. The floor's still dancing. I'm not ruining it by touching things."); return; }
  const closer = S.f.a1_closer || CLOSER_DEFAULT;
  const ids = ["everything_but_the_girl_missing", "phuture_acid_tracks", "white_nyc93", closer];
  await RP.walkTo(320, 212, "back");
  const k = RP.actor("kid"); RP.place("kid", 320, 166, "front"); k.act = "dj";
  RP.setClock("SAT 10:03 PM");
  if (!S.f.a1_setTries) await RP.lines(["Ten o'clock. Four records, two turntables, one broken heart and a clean needle.", "Missing, Acid Tracks, NYC 93, and \"" + RP.rec(closer).title + ".\" I know what I'm doing. I read the room. The room is empty."]);
  else await RP.say("Needle down. Again. Softer this time.");
  RP.setMusic(null);
  let res = await RP.mg.play("crowdRead", { records: ids, crowd: "empty-bar", rounds: 4, difficulty: S.f.a1_setTries > 0 ? 1 : 2, venue: "Nowhere", story: true });
  S.f.a1_setTries = (S.f.a1_setTries || 0) + 1;
  const good = !res || res.missing || res.ok || S.f.a1_setTries >= 3;
  if (!good) {
    k.act = "stand"; RP.place("kid", 320, 214, "front");
    RP.setMusic({ genre: "house", bpm: 118, volume: 0.3, energy: 2, filter: ["lowpass", 900] });
    await RP.lines(["The bartenders are still polishing the same glass. Mia looks at me. It isn't unkind. It's worse: it's patient.", "@dante Rough. Start softer. Build. Don't drop the peak early. Again."]);
    return;
  }
  /* it works */
  S.f.a1_setGood = true; S.f.a1_setDone = true; RP.relight();
  if (S.f.a1_setTries >= 3 && res && !res.ok && !res.missing) await RP.say("Third try. The bartenders feel sorry for me and dance out of pure pity. I'll take it.", "nar");
  RP.setMusic({ genre: "house", bpm: 122, volume: 0.5, energy: 4 });
  RP.sfx("cheer");
  ["a1_mia", "a1_rafa"].forEach(id => { const a = RP.actor(id); if (a) { a.act = "dance"; a.baseAct = "dance"; } });
  RP.flash("#ff3fa4", 400);
  await RP.lines(["Then something happens. Rafa stops mid-pour. His head starts to nod.", "Mia puts down the glass. She grabs the bar, closes her eyes, and starts to move.", "The bartenders are dancing. The bartenders. Are. DANCING.", "And behind them, the floor fills. People who weren't here a minute ago are here now. Hands up. Phones out. The room's alive."]);
  RP.followers(60);
  await RP.fadeTo(1, 700);
  RP.setClock("SAT 11:55 PM");
  k.act = "stand"; RP.place("kid", 320, 212, "front");
  RP.place("dante", 268, 218, "right"); RP.actor("dante").expr = "happy";
  await RP.say("The second hour. The USB. Tracks I picked on Wednesday, with a stolen stick. Nobody could tell. It didn't matter.", "nar");
  await RP.fadeTo(0, 700);
  await RP.lines(["@dante Hey. HEY.", "@dante Great set. I'll pay you next week.", "Next week.", "@dante Next week. It's a sacred promise."]);
  RP.sfx("success");
  await RP.lines(["Three records, a stolen USB, a flyer with my name wrong, and a slice. And now: a gig.", "I'm a DJ. Even if the paycheck is a phrase."]);
  await RP.completeAct([
    [!!S.f.a1_texts, "Charged the phone and called Dante"],
    [!!S.f.a1_mixer, "Cleaned channel 2 with vodka"],
    [!!S.f.a1_louHappy, "Made peace with Lou (and got NYC 93)"],
    [!!S.f.a1_acidFlat, "Flattened Acid Tracks"],
    [!!S.f.a1_delivered, "Delivered Smitty's package (oregano)"],
    [!!S.f.a1_gotUSB, "Liberated a USB 3-pack from Synergex"],
    [!!S.f.a1_closer, "Found a closer in the dollar bin"],
    [!!S.f.a1_tankIn, "Got past Tank"],
    [!!S.f.a1_setGood, "Got the bartenders dancing"]
  ]);
}

async function danteTalk(S) {
  await RP.convo([
    { text: "I'm ready. Let me start.", run: async () => { await playSet(S); return "end"; } },
    { text: "Any advice?", once: true, run: () => RP.lines(["@dante Read the room. Start soft. Build. Don't drop the peak early. A crowd is a rumor: it spreads from one corner.", "@dante And the white label? Whatever it is, I haven't heard it. Don't make me nervous."]) },
    { text: "Where's the crowd?", once: true, run: () => RP.lines(["@dante It's ten. Wait. Give it till midnight. The room fills up for whoever's playing when it fills up.", "@dante Bartenders first. Always the bartenders."]) },
    { text: "What about the second hour?", once: true, run: () => RP.lines(["@dante USB. After the vinyl. No laptop. Don't be cute.", "I've got a USB.", "@dante Is it the one with the cat?", "...No.", "@dante Good."]) },
    { text: "And the pay?", once: true, run: () => RP.lines(["@dante Next week.", "That's what you said last time.", "@dante And look how well that went. Everybody's still here."]) },
    { text: "Not yet.", end: true }
  ]);
}
async function bartend(S, who) {
  const m = who === "mia";
  if (S.f.a1_setGood) { await RP.lines(m ? ["@a1_mia I haven't danced behind a bar since... never. Don't tell Rafa.", "@a1_mia Great set. Drinks are on... nobody. But great set."] : ["@a1_rafa Okay, okay. You got me. I'm a dancer now.", "@a1_rafa Don't ask about the screenplay."]); return; }
  await RP.lines(m ? ["Hey. Any chance you'll dance later?", "@a1_mia I haven't danced behind a bar in six years. Not since the last DJ who made me want to.", "@a1_mia Make me want to. It's not hard. It's just rare."] : ["Slow night?", "@a1_rafa Slow? It's ten. It's a funeral until eleven.", "@a1_rafa I'm writing a screenplay. It's about a bartender. It's a drama. Ask me about it. Don't."]);
}

RP.room({
  id: "a1_nowhere", act: 1, name: "Nowhere",
  paint: paintNowhere, draw: drawNowhere, light: lightNowhere,
  cacheKey: S => S.f.a1_setGood ? "g" : "n", lightKey: S => S.f.a1_setGood ? "g" : "n",
  ambience: null,
  music: { genre: "house", bpm: 118, volume: 0.3, energy: 2, filter: ["lowpass", 900] },
  walk: [[40, 208], [610, 208], [626, 250], [30, 250]],
  scale: [206, 0.96, 250, 1.04],
  start: { x: 52, y: 238, face: "right" },
  fx: [
    { type: "haze", rect: [0, 136, 640, 56], color: "#8a70d8", density: 2 },
    { type: "beams", origins: LAMPS, colors: ["#ff3fa4", "#39d0ff", "#a05cff", "#ffd23f", "#39d0ff", "#ff3fa4"], base: Math.PI / 2, swing: 0.55, len: 200, width: 14, alpha: 0.14, period: 1600 },
    { type: "dust", rect: [120, 40, 400, 150], count: 16, color: "#ffc8ff" },
    { type: "strobe", period: 2200, flash: 70, alpha: 0.1, color: "#ffffff", on: () => RP.state.f.a1_setGood },
    { type: "confetti", count: 36, floor: 250, on: () => RP.state.f.a1_setGood }
  ],
  actors: [
    { id: "dante", char: "dante", x: 196, y: 232, face: "right", act: "stand", name: "Dante" },
    { id: "a1_mia", char: "a1_mia", x: 544, y: 194, face: "front", act: "stand", name: "Mia" },
    { id: "a1_rafa", char: "a1_rafa", x: 596, y: 194, face: "front", act: "stand", name: "Rafa" },
    { id: "a1_hank", char: "a1_hank", x: 64, y: 204, face: "right", act: "sit", name: "Old Hank" },
    { id: "a1_twig", char: "a1_twig", x: 470, y: 236, face: "front", act: "stand", name: "Twig" },
    { id: "a1_coco", char: "a1_coco", x: 138, y: 240, face: "right", act: "phone", name: "Coco" },
    { crowd: { n: 3, rect: [150, 212, 130, 30], seed: 11, face: "back", act: "stand", scale: 0.92, vis: S => !S.f.a1_setGood } },
    { crowd: { n: 3, rect: [360, 212, 130, 30], seed: 12, face: "back", act: "stand", scale: 0.92, vis: S => !S.f.a1_setGood } },
    { crowd: { n: 12, rect: [140, 208, 150, 34], seed: 13, face: "back", act: "dance", scale: 0.92, vis: S => !!S.f.a1_setGood } },
    { crowd: { n: 12, rect: [350, 208, 150, 34], seed: 14, face: "back", act: "dance", scale: 0.92, vis: S => !!S.f.a1_setGood } }
  ],
  sprites: [
    { y: 182, draw: c => A1.blit(c, B.booth(), BOOTH.x, BOOTH.y) },
    { y: 200, draw: c => { A1.slice(c, B.bar(), 75, 41, BAR.x - 4, BAR.y + 75); } },
    { y: 208, draw: c => A1.blit(c, B.couch(), 14, 154) }
  ],
  enter: async (S, from) => {
    S.f.noTravel = true; RP.setClock("SAT 10:00 PM");
    if (!S.f.a1_nowSeen) await arrival(S);
  },
  hotspots: [
    { id: "nwDoor", name: "door to the street", r: [0, 100, 40, 120], z: 20, walk: [50, 236, "left"], look: "The door back to Bushwick. It closed behind me with a thump I felt in my knees. No way back until the set's done. Not that I'd go.",
      exit: "I'm not leaving. I've got a booth, a vinyl hour and a bartender who needs convincing." },
    { id: "booth", name: "DJ booth (turntables)", r: [200, 96, 240, 80], z: 40, walk: [320, 214, "back"],
      look: "Two Technics 1200s, a Rane-ish mixer, and a slipmat that says NOWHERE in sharpie. A real DJ booth. A grown-up one. My heart's doing a four-on-the-floor.",
      use: S => playSet(S), open: S => playSet(S), talk: S => playSet(S), push: "I nudge a platter. The platter nudges back. It says: \"Play something.\"", pull: "I pull a fader, gently. It's the best fader I've ever touched. Tank would kill me.", pickup: "The turntables are Dante's. And bolted down. And a hundred pounds each." },
    { id: "bar", name: "bar", r: [498, 80, 142, 120], z: 30, walk: [560, 224, "back"], look: "A long bar: a mirror, a wall of bottles, a brass foot rail and two bartenders who've seen this movie. I'd order a drink, but I need a clear head and a $2 fare.", use: "I'd order a drink, but I'm working. And broke. In that order.", open: "I'm not a bartender. I'm a DJ. We just pour sound.", pickup: "Hey, stealing from a bar is a crime. That's a bad look in a place that gave me a slot.", push: "It's a bar. It's the most solid thing in New York." },
    { id: "led", name: "LED wall", r: [190, 20, 262, 70], z: 10, walk: [320, 214, "back"], look: "A wall of LEDs showing waves, in pink and cyan. It'll make the crowd feel something even when I can't.", pickup: "It's a wall of light. It weighs more than my rent.", use: "I wave at it. It waves back. It's the one thing here that doesn't judge." },
    { id: "truss", name: "light truss", r: [118, 6, 404, 36], z: 10, walk: [320, 214, "back"], look: "A steel truss with six lights. They sweep the floor in pink, cyan and violet. All of them are pointed at the empty floor. A very expensive gaze.", pickup: "It's twelve feet up and steel. Not a pickup." },
    { id: "discoball", name: "disco ball", r: [306, 38, 28, 34], z: 14, walk: [320, 214, "back"], look: "A disco ball. It flings little squares of light across the room. It's the most hopeful thing in here.", pickup: "It's fifteen feet up. It's also on its own destiny.", use: "I'd like to spin it. It's already spinning. It has been since 1978.", push: "I can't reach it. And I'd feel bad." },
    { id: "nwSign", name: "neon sign", r: [20, 46, 80, 44], z: 12, walk: [60, 226, "back"], look: "NOWHERE in pink, and \"NO HERE\" in cyan underneath. Dante's idea of an inside joke. The best part: nobody's laughing.", pickup: "It's on the wall. And it's glowing in a way that suggests it knows more than it says." },
    { id: "speakerL", name: "left speaker stack", r: [116, 82, 52, 98], z: 22, walk: [140, 226, "back"], look: "A speaker stack: subs below, tops above. It's a wall of bass with a logo on it. It's going to hit me in the chest like a nightly gift.", pickup: "It's a four-hundred-pound sound box. Not today.", push: "I lean on it. The bass inside says \"no.\" In frequency.", use: "I put my hand on the cabinet. It's vibrating. It's alive. It's the best feeling in the world." },
    { id: "speakerR", name: "right speaker stack", r: [472, 82, 52, 98], z: 22, walk: [480, 226, "back"], look: "The other speaker stack. A twin. They're a couple. A very loud couple.", pickup: "It's four hundred pounds. Not today.", push: "I lean on it. It leans on me, in bass.", use: "I put my hand on it. It tickles. It's love." },
    { id: "couch", name: "couch", r: [12, 150, 100, 60], z: 24, walk: [124, 226, "back"], look: "A purple velvet couch. It's survived four years of spilled drinks and a hundred nights of people saying \"I'll just sit for a minute.\" It's seen the sunrise more than I have.", use: "I'd sit, but I'm on in thirty seconds. Also Old Hank's there, and he's got the good cushion.", pickup: "It's a couch. It's the Nowhere couch. I'd have to kill Hank.", push: "It's stuck to the floor with something I don't want to name." },
    { id: "stage", name: "stage", r: [150, 168, 340, 34], z: 8, walk: [320, 214, "back"], look: "A low stage. Gaffer-tape marks, scuffs, and the kind of dent you only get from someone falling off while shouting \"one more.\"" },
    { id: "crowdFloor", name: "dance floor", r: [100, 204, 440, 46], z: 4, floor: true, walk: [320, 230, "back"], look: S => S.f.a1_setGood ? "The floor is packed. Every pair of hands is up. I did that. Me. A guy from Bushwick with a stolen USB." : "The dance floor. Three people stand on it, facing the booth, not dancing. It's the world's smallest crowd. It's still a crowd.", pickup: "You can't pick up a dance floor. You can only wake it up." }
  ],
  combos: [
    ["a1_closer", "booth", () => playSet(RP.state)],
    ["rec_first", "booth", () => playSet(RP.state)],
    ["rec_acid", "booth", () => playSet(RP.state)],
    ["white", "booth", () => playSet(RP.state)],
    ["rec_mom", "booth", "Winelight's with Lou. It's a long story. It's a good story."],
    ["a1_usb", "booth", "The USB's for the second hour. The first hour's vinyl. House rule. Dante will materialize if I break it."],
    ["usb_cat", "booth", "Cat photos on the CDJs. Tempting, but Dante said no laptops. Mr. Whiskers will have to wait."],
    ["a1_flyer", "dante", "\"Ha,\" Dante says. \"They spelled your name wrong. I told them. They did it anyway. You know how it is.\""],
    ["a1_slice", "dante", "\"Is that Sal's?\" Dante asks. \"I'm... you know what? No. I'm on a diet. Save it. For the door guy.\" I already did."],
    ["a1_slice", "a1_hank", "Old Hank looks at the slice. \"Sal's, huh. Haven't had one since 1989. Don't tempt me. It's for somebody.\""],
    ["a1_usb", "dante", "\"That's the one,\" Dante says. \"The one with the fewest cats.\""]
  ]
});
const nh = RP.rooms.a1_nowhere.hotspots;
nh.push({ id: "dante", name: "Dante", look: "Dante. Buzzcut, goatee, a bomber jacket with a pink lining, and a smile that says \"I'll pay you next week.\" It's a smile I've learned to respect.", talk: S => S.f.a1_setDone ? RP.lines(["@dante I'll pay you next week. It's a sacred promise."]) : danteTalk(S), use: "I can't use Dante. People have tried. It's usually the other way around.", pickup: "Dante's not for carrying. He's for believing. Eventually.", push: "I'd push him, but he'd say \"next week\" and I'd be broke forever.", give: "\"Sure, just put it on my tab,\" says Dante. \"I'll pay you next week.\"" });
nh.push({ id: "a1_mia", name: "Mia", look: "Mia. Cyan mohawk, black apron, an expression of someone who's heard every DJ promise \"I'll make you dance.\" She's yet to dance.", talk: S => bartend(S, "mia"), use: "I order a water. Mia gives me a glass of tap and a look. We both know my budget.", pickup: "Mia's not for taking. She's for impressing.", push: "I wave. She raises one eyebrow. It's all the conversation I'm allowed.", give: "Mia shakes her head. \"Tips go in the jar. Everyone else's gifts go in the bin.\"" });
nh.push({ id: "a1_rafa", name: "Rafa", look: "Rafa. Curly hair, a beard, a red tee under a black apron. He pours drinks like he's reading a tragedy.", talk: S => bartend(S, "rafa"), use: "I ask for a water. Rafa pours it in the saddest, most poetic way I've seen.", pickup: "Rafa's a person. And a screenwriter, I think.", push: "I tap the bar. Rafa nods. A tiny conversation.", give: "Rafa waves it off. \"Tips go in the jar, man.\"" });
nh.push({ id: "a1_hank", name: "Old Hank", look: "Old Hank. A white beard, a vest, a pair of glasses and the front row of a couch. He's been at every Nowhere since it was a laundromat. That's what he says.", talk: async S => { await RP.lines(["Evening.", "@a1_hank Used to be a laundromat. Same dryers, worse music. I'm still waiting on a sock.", "@a1_hank Start slow. Nobody dances at ten. Not even in 1993. Let the bartenders hear it first."]); }, use: "I'd sit next to him, but the couch is full of memories.", pickup: "Hank is a lot of history. I'd throw out my back.", push: "I nudge his sleeve. He raises his glass. It's a toast. It's a no.", give: "\"Thanks, young man,\" says Hank. \"But I'm on a very strict diet. Of nostalgia.\"" });
nh.push({ id: "a1_twig", name: "Twig", look: "Twig. He got in. I don't know how. Maybe he knows somebody who knows somebody who knows Tank's cousin.", talk: async S => { await RP.lines(["You got in!", "@a1_twig Tank's cousin. It's a whole thing. I'll tell you later. When there's a later.", "@a1_twig Make 'em dance, man. I came for you. I mean... I came for the bartenders. But you."]); }, use: "I clap him on the shoulder. He nearly drops his drink. We're friends now.", pickup: "Twig's lighter than a record, but with way more opinions.", push: "I nudge him. He nudges me. We both nudge a stranger. Chaos.", give: "\"I'm good,\" says Twig. \"I'm saving room for the music.\"" });
nh.push({ id: "a1_coco", name: "Coco", look: "Coco. Shades indoors, a bomber with an attitude, a phone with a lock screen I'd love to see. She's the room's most reliable review.", talk: async S => { await RP.lines(["Good crowd.", "@a1_coco Don't flatter me, DJ. It's not a crowd. It's a rumor with shoes.", "@a1_coco Give me a reason to put the phone down."]); }, use: "I wave. Coco holds up one finger. It's the Nowhere version of hello.", pickup: "Coco is not for carrying. Coco is for impressing.", push: "I nudge her. She turns off her phone. Slowly. I've made an enemy.", give: "\"Thank you,\" says Coco. \"No.\"" });
})();
