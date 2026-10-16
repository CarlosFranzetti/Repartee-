// Captures the README screenshots into docs/screenshots/ from the built game.
// usage: node tools/build.mjs && node tools/screens.mjs [--page dist/index.html]
// Each shot loads a fresh page, puts the player in a room with a given state (or opens a mini-game),
// waits for the scene to settle, and saves the game frame. Uses the pre-installed Chromium (Playwright).
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const pi = args.indexOf("--page");
const page = path.resolve(pi >= 0 ? args[pi + 1] : path.join(root, "dist/index.html"));
const outDir = path.join(root, "docs/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { file: "title.png", title: true },
  { file: "level1-bedroom.png", act: 1, room: "bedroom", x: 300, y: 228, face: "front" },
  { file: "level1-stoop.png", act: 1, room: "a1_stoop", x: 420, y: 232, face: "front" },
  { file: "level1-nowhere.png", act: 1, room: "a1_nowhere", state: { f: { time: "sat", a1_sat: true } } },
  { file: "level2-loft.png", act: 2, room: "a2_loft", clock: "SAT 11:48 PM", state: { f: { a2_loftFixed: true } } },
  { file: "level3-halcyon.png", act: 3, room: "a3_halcyon", state: { f: { a3_floor: "full" } } },
  { file: "level4-berlin.png", act: 4, room: "a4_halle" },
  { file: "level5-mainstage.png", act: 5, room: "a5_mainstage", clock: "SAT 11:40 PM", state: { f: { a5_phase: 3 } } },
  { file: "level5-pier.png", act: 5, room: "a5_pier", clock: "SUN 6:12 AM" },
  { file: "minigame-beatmatch.png", mg: "beatMatch" },
  { file: "minigame-crowdread.png", mg: "crowdRead" },
  { file: "minigame-godigging.png", mg: "goDigging" },
  { file: "minigame-soundcheck.png", mg: "soundCheck" },
  { file: "phone-portrait.png", act: 1, room: "bedroom", x: 300, y: 228, face: "front", w: 390, h: 844, full: true }
];

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let failed = 0;
for (const s of SHOTS) {
  const p = await browser.newPage({ viewport: { width: s.w || 1280, height: s.h || 720 }, reducedMotion: "no-preference" });
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await p.goto("file://" + page);
  await p.waitForTimeout(500);
  const out = path.join(outDir, s.file);
  if (s.title) {
    await p.waitForTimeout(600);
    await p.screenshot({ path: out });
  } else if (s.mg) {
    await p.evaluate(id => { document.querySelectorAll("#title").forEach(e => e.remove()); window.RP.mg.play(id, { arcade: true, difficulty: 2 }); }, s.mg);
    await p.waitForTimeout(1800);
    await (await p.$(".mg-wrap")).screenshot({ path: out });
  } else {
    await p.evaluate(async s => {
      const RP = window.RP;
      RP.test.noSave = true;
      RP.test.setFast(true);
      document.querySelectorAll("#title").forEach(e => e.remove());
      RP.hideGame(false); RP.layout();
      RP.reset(); RP.state.name = "DJ NOBODY";
      await RP.startAct(s.act, { noCard: true, noIntro: true });
      const S = RP.state;
      if (s.state && s.state.f) Object.assign(S.f, s.state.f);
      await RP.goto(s.room, s.x, s.y, s.face, { instant: true });
      if (s.clock) RP.setClock(s.clock);
      RP.relight();
      RP.test.setFast(false);
    }, s);
    await p.waitForTimeout(1200);
    if (s.full) {
      // phone: just the scene, the sentence line and the controls under it, with a small margin
      const clip = await p.evaluate(() => {
        const rs = ["#frameBox", "#below", "#hint"].map(q => document.querySelector(q)).filter(Boolean).map(e => e.getBoundingClientRect()).filter(r => r.height > 0);
        const x0 = Math.min(...rs.map(r => r.left)), y0 = Math.min(...rs.map(r => r.top)), x1 = Math.max(...rs.map(r => r.right)), y1 = Math.max(...rs.map(r => r.bottom));
        return { x: Math.max(0, x0 - 12), y: Math.max(0, y0 - 12), width: Math.min(innerWidth, x1 + 12) - Math.max(0, x0 - 12), height: y1 - y0 + 24 };
      });
      await p.screenshot({ path: out, clip });
    }
    else await (await p.$("#frame")).screenshot({ path: out });
  }
  console.log((errors.length ? "ERR  " : "ok   ") + s.file + (errors.length ? "  " + errors.slice(0, 2).join(" | ") : ""));
  if (errors.length) failed++;
  await p.close();
}
await browser.close();
if (failed) process.exitCode = 1;
