/* Act 1 — a1_nowhere_door: outside Nowhere, Saturday night. Tank is on the door; you are not on the list.
   Show him the flyer ("could be anybody"), then give him the slice from Sal's.
   Flags: a1_tankFlyer, a1_tankSlice, a1_tankIn, a1_doorSeen. */
(function () {
"use strict";
const RP = window.RP;
const A1 = RP.a1, PK = RP.PK;
const { R, P, ell, line, poly, bayer, mulberry, clamp, txt, txtW, txtC, mix, ramp } = RP.u;
const U = PK.util;
const W = 640, GY = 172;
const DOOR = { x: 320, y: 70, w: 72, h: 102 };

const B = {
  post: (n) => A1.memo("nd_post", 14, 40, c => { R(c, 6, 8, 3, 28, "#c8a050"); R(c, 6, 8, 1, 28, "#fff0b0"); R(c, 8, 8, 1, 28, "#6a4a10"); ell(c, 7, 7, 3, 3, "#e8c870"); P(c, 6, 6, "#fff6c0"); R(c, 2, 36, 11, 2, "#8a6a28"); R(c, 3, 34, 9, 2, "#c8a050"); U.dshade(c, 1, 37, 13, 3, "#000", () => 0.8, 0.4); }),
  dumpster: () => A1.memo("nd_dump", 96, 62, c => {
    R(c, 3, 14, 88, 40, "#1f3a2e"); U.gradient(c, 3, 14, 88, 40, [[0, "#3a6a54"], [0.1, "#2a5040"], [1, "#16281e"]], 1, true); R(c, 3, 14, 88, 1, "#8ac8a8");
    for (let x = 12; x < 90; x += 14) R(c, x, 16, 2, 36, "#142a20");
    R(c, 0, 8, 94, 8, "#2a5848"); R(c, 0, 8, 94, 1, "#9ad8b8"); R(c, 0, 15, 94, 1, "#0e2018");
    R(c, 4, 54, 10, 5, "#1c1c24"); R(c, 78, 54, 10, 5, "#1c1c24"); ell(c, 9, 59, 4, 4, "#2a2a34"); ell(c, 83, 59, 4, 4, "#2a2a34");
    R(c, 24, 24, 36, 16, "#d8c8a0"); txt(c, "NO DUMPING", 27, 27, "#1d1622"); txt(c, "THIS MEANS YOU", 27, 33, "#c0302c");
    R(c, 70, 2, 10, 8, "#efeaf6"); R(c, 74, 0, 6, 4, "#c0302c"); R(c, 10, 4, 14, 4, "#3a3a4a");
    U.dshade(c, 0, 56, 96, 6, "#000", () => 0.8, 0.45);
  })
};

function paintDoor(c, S) {
  const em = [], rnd = mulberry(70);
  /* sky + skyline sliver */
  PK.sky(c, 0, 0, W, 90, { time: "night", seed: 71, moon: { x: 560, y: 26, r: 6 } });
  em.push.apply(em, PK.skyline(c, 0, 8, W, 80, { night: true, layers: 3, spire: true, spireX: 120, seed: 72 }));
  /* left warehouse wall */
  PK.brick(c, 0, 30, 300, GY - 30, { base: "#5a3040", mortar: "#4a4050", worn: 0.75, seed: 73, bw: 13, bh: 5 });
  U.dshade(c, 0, 30, 300, GY - 30, "#0c0618", (px, py) => 0.35 + (py - 30) / 140 * 0.3, 0.55);
  R(c, 0, 26, 300, 5, "#2a1c28"); R(c, 0, 26, 300, 1, "#5a4a5a");
  [[28, 62], [118, 62]].forEach(([wx, wy]) => { R(c, wx, wy, 34, 40, "#2a1a26"); R(c, wx + 2, wy + 2, 30, 36, "#a88a58"); for (let q = 0; q < 4; q++) R(c, wx + 2, wy + 2 + q * 9, 30, 1, "#6a5030"); R(c, wx + 15, wy + 2, 1, 36, "#6a5030"); R(c, wx - 2, wy + 40, 38, 3, "#6a6078"); });
  R(c, 190, 50, 62, 56, "#3a2a38"); R(c, 192, 52, 58, 52, "#1b1440"); ell(c, 221, 74, 12, 12, "#ff3fa4"); R(c, 196, 92, 50, 3, "#39d0ff"); txtC(c, "NOWHERE", 221, 56, "#ff3fa4", 1); txtC(c, "SAT 10PM", 221, 98, "#bfb8e8", 1);   /* wheat-pasted flyers */
  R(c, 262, 84, 28, 34, "#e8e0cc"); txt(c, "LOST", 266, 88, "#c0302c"); txt(c, "CAT", 267, 95, "#2a2a3a"); R(c, 266, 104, 20, 8, "#8a5a2a");
  /* tags */
  [[40, 138, "#39d0ff"], [150, 128, "#ffd23f"], [230, 140, "#ff3fa4"]].forEach(([x0, y0, col], k) => { let px = x0, py = y0; for (let i = 0; i < 34; i++) { P(c, px, py, col); P(c, px + 1, py, col); px += 1 + (i % 4 === 0 ? 1 : 0); py += ((i * 5 + k) % 7) > 3 ? 1 : ((i * 3 + k) % 5 === 0 ? -1 : 0); } });
  /* fire escape over the line */
  em.push.apply(em, PK.fireEscape(c, 150, 30, 120, 60, { floors: 1, ladder: false, seed: 74 }));
  /* the club front */
  R(c, 300, 30, 160, GY - 30, "#1a1220"); PK.brick(c, 300, 30, 160, GY - 30, { base: "#2a1a30", mortar: "#2a2030", worn: 0.7, seed: 75, bw: 12, bh: 5 });
  U.dshade(c, 300, 30, 160, GY - 30, "#000000", (px, py) => 0.3, 0.4);
  R(c, 298, 26, 164, 6, "#140c1c"); R(c, 298, 26, 164, 1, "#4a3a5a");
  /* door: steel, red bulb above, intercom */
  PK.door(c, DOOR.x, DOOR.y, DOOR.w, DOOR.h, { metal: true, color: "#4a4a5a", seed: 76 });
  R(c, DOOR.x + 8, DOOR.y + 58, DOOR.w - 16, 3, "#c8c4d8");
  R(c, DOOR.x + DOOR.w + 6, DOOR.y + 46, 10, 18, "#14141c"); R(c, DOOR.x + DOOR.w + 8, DOOR.y + 50, 6, 3, "#c0302c"); em.push([DOOR.x + DOOR.w + 8, DOOR.y + 50, 6, 3]);
  for (let i = 0; i < 2; i++) R(c, DOOR.x + DOOR.w + 8, DOOR.y + 55 + i * 4, 6, 2, "#8a869c");
  R(c, DOOR.x + 22, DOOR.y - 12, 28, 10, "#1a0a0e"); ell(c, DOOR.x + 36, DOOR.y - 7, 6, 4, "#ff2a2a"); R(c, DOOR.x + 30, DOOR.y - 8, 12, 4, "#ff6a6a"); em.push([DOOR.x + 28, DOOR.y - 11, 16, 8]);
  PK.glow(c, DOOR.x + 36, DOOR.y - 7, 34, "#ff2a2a", { strength: 0.9 }).forEach(r => em.push(r));
  /* NOWHERE neon with a dead W: "NO HERE" */
  em.push.apply(em, PK.neon(c, "NOWHERE", 308, 40, "#ff3fa4", { scale: 3, tube: 2, spacing: 3, off: [2], strength: 1 }));
  R(c, DOOR.x - 20, DOOR.y + 34, 14, 28, "#e8e0cc"); txt(c, "NO", DOOR.x - 18, DOOR.y + 37, "#c0302c"); txt(c, "SHOES", DOOR.x - 19, DOOR.y + 43, "#2a2a3a"); txt(c, "NO", DOOR.x - 18, DOOR.y + 49, "#c0302c"); txt(c, "ENTRY", DOOR.x - 19, DOOR.y + 55, "#2a2a3a");
  /* security camera + vent */
  R(c, 428, 72, 22, 8, "#2a2a34"); R(c, 428, 72, 22, 1, "#6a6a7a"); R(c, 448, 74, 6, 4, "#14141c"); P(c, 430, 74, Math.floor(0) ? "#ff3a3a" : "#8a1a1a");
  PK.vent(c, 412, 120, 26, 16, {});
  /* right: corrugated metal + pipe */
  R(c, 460, 40, 180, GY - 40, "#3a3a4a"); for (let x = 460; x < 640; x += 6) { R(c, x, 40, 3, GY - 40, "#4a4a5c"); R(c, x + 3, 40, 3, GY - 40, "#2a2a38"); }
  U.dshade(c, 460, 40, 180, GY - 40, "#0c0618", (px, py) => 0.3 + (py - 40) / 132 * 0.4, 0.55);
  R(c, 460, 36, 180, 5, "#1a1a24"); R(c, 460, 36, 180, 1, "#5a5a6a");
  PK.pipe(c, 530, 40, 132, { dir: "v", r: 4, color: "#6a6280", joint: 40 });
  R(c, 560, 70, 60, 24, "#c0302c"); R(c, 560, 70, 60, 2, "#ff7a6a"); txtC(c, "NO PARKING", 590, 74, "#fff6dc", 1); txtC(c, "ANYTIME", 590, 82, "#fff6dc", 1);
  /* ground: wet concrete + curb */
  PK.concrete(c, 0, GY, W, 84, { base: "#4a4658", seed: 77, panelH: 40 });
  U.dshade(c, 0, GY, W, 84, "#0c0618", (px, py) => 0.35, 0.3);
  PK.speckle(c, 0, GY, W, 84, ["#6a6278"], 0.02, 5);
  /* puddles with neon reflection */
  [[340, 232, 40, 5, "#ff3fa4"], [230, 216, 26, 3, "#39d0ff"], [470, 224, 30, 4, "#ff2a2a"]].forEach(([px, py, rx, ry, col]) => { ell(c, px, py, rx, ry, "#241c40"); ell(c, px - 2, py - 1, rx - 4, Math.max(1, ry - 1), mix("#2e2858", col, 0.18)); U.dshade(c, px - rx, py - ry, rx * 2, ry * 2, col, (qx, qy) => 0.5, 0.18); });
  /* steam grate + litter */
  R(c, 66, 214, 34, 12, "#1a1a24"); for (let i = 0; i < 6; i++) R(c, 68 + i * 5, 215, 2, 10, "#4a4658");
  [[130, 230, "#efeaf6"], [420, 214, "#c0302c"], [580, 232, "#ffd23f"], [210, 226, "#3ab8d8"]].forEach(([px, py, col]) => R(c, px, py, 3, 2, col));
  return em;
}

function lightDoor(S) {
  return {
    ambient: "#40366a",
    lights: [
      { x: 356, y: 56, r: 190, color: "#ff3fa4", steps: 4, sy: 1.1, rim: true },
      { x: 110, y: 210, r: 170, color: "#8a7ac8", steps: 3, power: 0.5 },   // spill from the street, so the line reads
      { x: 356, y: 64, r: 150, color: "#ff2a2a", steps: 3, power: 0.7 },
      { x: 150, y: 40, r: 190, color: "#6a5ab8", steps: 3, power: 0.5 },
      { x: 560, y: 50, r: 170, color: "#39d0ff", steps: 3, power: 0.5, rim: true },
      { x: 260, y: 130, r: 130, color: "#9a70ff", steps: 3, power: 0.4 }
    ],
    halos: [{ x: 356, y: 58, r: 40, color: "#ff3fa4", strength: 0.8 }],
    key: { x: 356, y: 60 }, shadow: 0.7, rims: [{ x: 356, y: 56, r: 200, color: "#ff3fa4" }, { x: 560, y: 50, r: 180, color: "#39d0ff" }]
  };
}

function drawDoor(c, S, t) {
  /* the neon's dead W stutters back for a frame */
  if (A1.flick(t, 1300, 4) < 8) { for (let y = 40; y < 56; y++) { if (((y - 40) % 3) < 2) { P(c, 308 + 24, y, "#ff3fa4"); P(c, 308 + 28, y, "#ff3fa4"); } } }
  if (Math.floor(t / 500) % 2) P(c, 430, 74, "#ff3a3a");
}

/* ---------- Tank ---------- */
function tankOpen(S) { return !!(S.f.a1_tankFlyer && S.f.a1_tankSlice); }
async function letIn(S) {
  S.f.a1_tankIn = true; RP.sfx("success");
  RP.setClock("SAT 9:52 PM");
  await RP.lines(["@a1_tank ...Fine. Go. Dante's by the bar.", "@a1_tank Don't touch the speakers. Don't talk to the bartenders about their screenplay.", "Noted."]);
  RP.actor("a1_tank").face = "left";
  await RP.npcWalk("a1_tank", 288, 214, "right");
  RP.sfx("door");
  await RP.say("The door opens. Bass hits my chest like a handshake. I'm in.", "nar");
}
async function tankTalk(S) {
  if (S.f.a1_tankIn) { await RP.lines(["@a1_tank Go in. You're on."]); return; }
  if (!S.f.a1_tankMet) {
    S.f.a1_tankMet = true;
    await RP.lines(["@a1_tank Name.", "It's " + (S.name || "DJ NOBODY") + ". I'm the opener.", "@a1_tank (He scrolls a clipboard.) Not on the list.", "I'm playing tonight. At ten.", "@a1_tank Everybody's playing tonight. Names on the list. You're not on it.", "@a1_tank I've been on this door since six. No dinner. Dante promised a pizza. Dante promises a lot.", "Is there anything that'd help?", "@a1_tank Proof. And food. A man thinks better when he's fed."]);
    return;
  }
  const lines = [
    ["@a1_tank Name?", "Still me.", "@a1_tank Still not on the list."],
    ["@a1_tank Proof. And a snack. In that order. Or either order. I'm flexible about everything but the list."],
    ["@a1_tank I haven't eaten since noon. I'm saying that to the air."]
  ];
  await RP.lines(lines[(S.f.a1_tankN = ((S.f.a1_tankN || 0) + 1)) % 3]);
}
async function showFlyer(S) {
  if (S.f.a1_tankFlyer) { await RP.say("@a1_tank I've seen it. Could be anybody. Next.".replace("@a1_tank ", ""), "a1_tank"); return; }
  S.f.a1_tankFlyer = true;
  await RP.lines(["I show Tank the flyer.", "@a1_tank (He reads.) \"Opening: " + A1.mangle(S.name) + ".\" ...That you?", "Close enough.", "@a1_tank Could be anybody. Anybody can print a flyer. My cousin prints flyers.", "@a1_tank ...But it does say Nowhere. And ten PM. That's a start."]);
  if (tankOpen(S)) await letIn(S);
  else await RP.say("@a1_tank Still not on the list. But I'm listening. And I'm hungry.".replace("@a1_tank ", ""), "a1_tank");
}
async function giveSlice(S) {
  if (S.f.a1_tankSlice) { await RP.say("You gave me one already. Don't be greedy.", "a1_tank"); return; }
  RP.take("a1_slice"); S.f.a1_tankSlice = true;
  await RP.lines(["I hold out the slice from Sal's, still warm. Pepperoni.", "@a1_tank ...Is that Sal's?", "It's Sal's.", "@a1_tank (He takes it. He folds it, perfectly. He eats it in two bites with his eyes closed.)", "@a1_tank Mm.", "@a1_tank That's the best slice in Bushwick. I haven't said that out loud in nine years."]);
  if (tankOpen(S)) await letIn(S);
  else await RP.lines(["@a1_tank That helps. But I still need a reason to let you past. A reason with a name on it."]);
}

const Q = [{ id: "a1_twig", x: 178, y: 204, face: "right", act: "stand" }, { id: "a1_coco", x: 226, y: 206, face: "right", act: "phone" }, { id: "a1_q1", x: 272, y: 204, face: "right", act: "stand" }];
RP.room({
  id: "a1_nowhere_door", act: 1, name: "Outside Nowhere",
  paint: paintDoor, draw: drawDoor, light: lightDoor,
  cacheKey: S => "x", lightKey: S => "x",
  ambience: "club_through_wall",
  walk: [[40, 208], [610, 208], [626, 246], [30, 246]],
  scale: [206, 0.96, 246, 1.04],
  start: { x: 76, y: 238, face: "right" },
  fx: [
    { type: "steam", x: 84, y: 214, rise: 70, size: 14, drift: 6, color: "#b8a8d8", count: 8, speed: 0.5 },
    { type: "haze", rect: [0, 176, 640, 40], color: "#8a6ad8", density: 2 },
    { type: "dust", rect: [300, 60, 120, 120], count: 10, color: "#ff8ac8" },
    { type: "blink", items: [{ r: [366, 52, 2, 2], color: "#ff3fa4", off: "#3a1030", rate: 900 }] }
  ],
  actors: [
    { id: "a1_tank", char: "a1_tank", x: 356, y: 206, face: "front", act: "stand", name: "Tank" },
    Object.assign({ id: "a1_twig", char: "a1_twig", name: "Twig" }, Q[0]),
    Object.assign({ id: "a1_coco", char: "a1_coco", name: "Coco" }, Q[1]),
    Object.assign({ id: "a1_q1", char: "a1_q1", name: "guy in line" }, Q[2])
  ],
  sprites: [
    ...[150, 200, 250, 300].map((px, i) => ({ y: 194, draw: (c, S) => { A1.blit(c, B.post(), px - 7, 158); } })),
    { y: 196, draw: (c, S) => { [[150, 200], [200, 250], [250, 300]].forEach(([a, b]) => { for (let x = a + 6; x < b - 6; x++) { const t = (x - a - 6) / (b - a - 12), sag = Math.sin(t * Math.PI) * 6; P(c, x, 168 + sag, "#a02a2a"); P(c, x, 169 + sag, "#6a1a1a"); } }); } },
    { y: 216, draw: c => A1.blit(c, B.dumpster(), 528, 148) },
    { y: 232, draw: c => A1.blit(c, A1.memo("nd_bags", 52, 34, cc => { PK.trashBags(cc, 2, 2, {}); }), 30, 200) }
  ],
  enter: async (S, from) => {
    S.f.noTravel = false; RP.setClock("SAT 9:40 PM");
    if (!S.f.a1_doorSeen) { S.f.a1_doorSeen = true; await RP.lines(["Nowhere. A steel door, a red bulb, and a neon sign that says \"NO HERE\" because the W died. A line of people in black. And a man the size of a vending machine.", "That's Tank. Dante said: not on the list. Bring the flyer."]); }
  },
  hotspots: [
    { id: "ndDoor", name: "the door to Nowhere", r: [318, 70, 76, 104], z: 30, walk: [354, 230, "back"], look: "A steel door, a red bulb, a peephole and the kind of bass that rattles my fillings. It says NOWHERE on the sign. The W is dead. It says NO HERE. I'm trying not to read into it.",
      exit: S => S.f.a1_tankIn ? { room: "a1_nowhere", x: 52, y: 238, face: "right" } : "Tank doesn't step aside. Tank has never stepped aside. The door is a rumor behind him.",
      push: S => S.f.a1_tankIn ? RP.goto("a1_nowhere", 52, 238, "right") : "I push. It's steel and I'm a person. Tank clears his throat. I stop.", pull: "Tank's hand lands on my shoulder. \"List.\"" },
    { id: "ndSign", name: "neon sign", r: [304, 36, 96, 28], z: 12, walk: [330, 226, "back"], look: "NOWHERE, in pink neon. The W's burnt out, so it says NO HERE. I'd say that's an accident, but Dante's too cheap to fix it and too proud to admit it.", pickup: "It's twelve feet up and a hundred percent legal. For someone else.", use: "I'd fix it, but nobody asked, and nobody's paying.", push: "It's a sign. It's a sign of things to come. The sign pushes back with 20,000 volts." },
    { id: "rope", name: "velvet rope", r: [144, 160, 164, 40], z: 20, walk: [226, 224, "back"], look: "A velvet rope on brass posts. It's the only thing between me and the line, and the line is a population of people who all think they're important.", pickup: "Tank's eyes would find me. Everyone's would.", use: "I'd unhook it, but that's an invitation to a fight with 20 people in black.", push: "I nudge the post. It wobbles. A guy in line says \"hey.\"" },
    { id: "ndFlyers", name: "wheat-pasted flyers", r: [188, 48, 66, 60], z: 12, walk: [230, 226, "back"], look: "NOWHERE flyers, five deep. One of them has \"DJ ???\" on it. The one under it has \"WHO?\" in pen. The one under that is a lost-cat poster. Biscuit's still missing.", pickup: "It's stuck there. Hopes are stuck there.", talk: "\"Hey, flyers. Nice to meet you, too.\"" },
    { id: "ndFire", name: "fire escape", r: [148, 28, 124, 64], z: 8, walk: [210, 226, "back"], look: "A fire escape above the line. A guy up there has a better view of Nowhere than I do. He's smoking and he knows it." },
    { id: "ndDumpster", name: "dumpster", r: [528, 148, 96, 66], z: 24, walk: [570, 234, "back"], look: "A green dumpster: NO DUMPING. THIS MEANS YOU. A raccoon sits on the lid. The raccoon's seen more shows than I have.", open: "I open the lid. A raccoon looks me in the eye. We both close it. We have an understanding.", pickup: "It's a dumpster. I'd need a forklift and a very specific lawsuit.", use: "I'd check for records. I'm not an animal. But I'd definitely check for records." },
    { id: "ndPipe", name: "pipe", r: [526, 40, 12, 132], z: 10, walk: [550, 226, "back"], look: "A pipe running down the wall. It carries everything the club doesn't want: water, rumors and Dante's phone bills." },
    { id: "ndNoPark", name: "no parking sign", r: [558, 68, 64, 28], z: 14, walk: [590, 226, "back"], look: "NO PARKING ANYTIME. Somebody's added \"EXCEPT DANTE\" in marker. Truer words." },
    { id: "ndCamera", name: "security camera", r: [426, 68, 28, 14], z: 20, walk: [440, 220, "back"], look: "A security camera, angled at the door. I give it a wave. It does nothing, which is typical of a camera and of Nowhere.", pickup: "It's twelve feet up. Which is the only reason I'm not worried about being on camera for a crime.", talk: "\"Tell Dante I'm here.\" The camera says nothing. Typical." },
    { id: "grate", name: "steam grate", r: [64, 212, 38, 16], z: 8, floor: true, walk: [84, 234, "back"], look: "A steam grate. It exhales like a sleeping dragon. It smells like a dryer sheet and the end of the 20th century.", pickup: "It's bolted down. And it's a grate. Not a thing to take.", open: "It doesn't open. It's a grate. It's the opposite of a gift." },
    { id: "ndStreet", name: "back to the subway", r: [0, 160, 60, 90], z: 4, walk: [38, 232, "left"], look: "The street back toward the L. Two blocks of shuttered garages and a bar called The Short End.",
      exit: S => A1.travelExit(S, true) }
  ],
  combos: [
    ["a1_flyer", "a1_tank", () => showFlyer(RP.state)],
    ["a1_slice", "a1_tank", () => giveSlice(RP.state)],
    ["usb_cat", "a1_tank", "\"A USB,\" says Tank. \"Of what?\" \"Cats.\" \"...Next.\""],
    ["a1_usb", "a1_tank", "\"I don't need your USB,\" says Tank. \"I need a name on a list.\""],
    ["a1_closer", "a1_tank", "\"A record,\" says Tank, glancing at it. \"The DJ's got that. You're not the DJ yet.\""],
    ["rec_first", "a1_tank", "\"Records are for the DJ,\" says Tank. \"You're a guy in a line.\""],
    ["rec_acid", "a1_tank", "\"Records are for the DJ,\" says Tank. \"You're a guy in a line.\""],
    ["white", "a1_tank", "\"Records are for the DJ,\" says Tank. \"You're a guy in a line.\""],
    ["a1_package", "a1_tank", "Tank stares at the bag. \"No. I don't want it. Whatever's in it.\""],
    ["a1_popcorn", "a1_tank", "Tank: \"I like popcorn. But it's the wrong bribe, and it's Linda's.\" He can see her name from here."],
    ["a1_slice", "a1_twig", "\"That's Sal's!\" says Twig. \"It's spoken for,\" I say. \"Tank's.\" Twig nods slowly. \"Smart.\""],
    ["a1_flyer", "a1_twig", "\"Ha! \" Twig laughs. \"They spelled your name wrong. They spelled mine wrong, too. Welcome to Nowhere.\""],
    ["a1_flyer", "a1_coco", "\"They always do that,\" says Coco. \"Dante can't spell. Or pay.\""]
  ]
});
const ndHot = RP.rooms.a1_nowhere_door.hotspots;
ndHot.push({ id: "a1_tank", name: "Tank", look: "Tank. Six-six, black bomber, shades at night, a face carved from the same stone as the door. He's the nicest man in New York, and he's been told not to show it.",
  talk: S => tankTalk(S), use: "I'm not using Tank. Nobody uses Tank. Tank uses you.", pickup: "I'd need a crane. And permission. And a death wish.", push: "I push Tank. He lowers his shades. I lower my hand. We understand each other.", pull: "I can't pull Tank. Not even with the gravitational pull of my need.", open: "Tank doesn't open. Tank holds.",
  give: async (S, item) => { if (item === "a1_flyer") return showFlyer(S); if (item === "a1_slice") return giveSlice(S); return "Tank shakes his head. \"Don't need it.\""; } });
ndHot.push({ id: "a1_twig", name: "Twig", look: "Twig. Skinny, bucket hat, a yellow tee that's mostly collar. He's been to every Nowhere since it opened. He's never been inside for a full set.",
  talk: async S => { await RP.lines(["Hey. Is it always this long?", "@a1_twig Dante's door time is \"ten.\" Dante's ten is eleven. Tank's list is a myth. I've been on it since 2021.", "@a1_twig The trick is to get in with something Tank wants. I'm still working out what."]); },
  use: "I tap Twig. Twig tilts his hat. A small, silent conversation.", pickup: "Twig is lighter than a record. But he's got a bucket hat. It's a lot.", push: "I nudge him. He nudges back. We're done.", give: "\"I'm good,\" says Twig. \"I'm on a diet. Of nothing.\"" });
ndHot.push({ id: "a1_coco", name: "Coco", look: "Coco. Glossy bomber, big hair, shades at 9:40 PM on a Saturday. She has been to everything and has opinions.",
  talk: async S => { await RP.lines(["Busy night?", "@a1_coco It's Nowhere. It's always a busy night and an empty room. Be a hero. Make 'em dance.", "@a1_coco If the bartenders dance, the floor follows. Everybody knows that. Nobody says it."]); },
  use: "I'd tap Coco, but her phone's in the way. And her opinion of me.", pickup: "I'm not picking up a person. That's a different kind of show.", push: "She stares. I retreat.", give: "\"No thanks,\" says Coco. \"I'm saving room for a cocktail and a grudge.\"" });
ndHot.push({ id: "a1_q1", name: "guy in line", look: "A guy in a black hoodie. His entire personality is the wait.", talk: "\"Hey.\" \"Hey.\" That's about all we've got. It's enough. It's New York.", use: "I stand next to him for a second. We're both waiting for something.", pickup: "That's a person. In a line. He'd be upset.", push: "I push in line. He's not having it. I step back.", give: "He waves me off. \"I'm good. I'm saving my appetite for the door.\"" });
})();
