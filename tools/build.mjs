// Builds the game from src/:
//  1. index.html               — dev page that loads every source file with <script src> (works from file://)
//  2. dist/index.html          — the full game as one self-contained file (fonts, CSS, JS inlined)
//  3. dist/artifact.html       — the same, content only, for the claude.ai artifact host
//  4. dist/level1.html         — Level 1 on its own (plus the mini-game arcade); its ending links to the full game
//  5. dist/level1.artifact.html
// File order: core (fixed) → data → minigames → acts (act1..act5, files sorted by name) → game.js
// usage: node tools/build.mjs [--out file.html] [--level1] [--artifact]
//   Every JS file is syntax-checked; a file that fails is left out of the build (with a loud warning)
//   so one half-written file never breaks everybody else's game. Each file is also wrapped in
//   try/catch in the bundle so a load-time exception only disables that file.
//   --out writes ONLY the single-file bundle to the given path (use this when several people build at once);
//   add --level1 to make that bundle the Level 1 build, --artifact to also write <out>.artifact.html.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rel = p => path.relative(root, p).split(path.sep).join("/");
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const sortJs = files => files.filter(f => f.endsWith(".js")).sort((a, b) => a.localeCompare(b));
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : null;

// where the Level 1 build sends players who want the rest of the game
const FULL_GAME_URL = "https://claude.ai/artifact/8tvKcJw3WLVhBsno8Snk6N";
const DESC = "A pixel-art point-and-click DJ adventure. From broke-ass bedroom DJ to festival headliner, one bad decision at a time.";

const core = ["util", "chars", "fx", "audio", "icons", "paint", "engine"].map(n => path.join(root, "src/core", n + ".js")).filter(f => fs.existsSync(f));
const data = sortJs(walk(path.join(root, "src/data")));
const mgs = sortJs(walk(path.join(root, "src/minigames")));
const actsUpTo = max => { const a = []; for (let i = 1; i <= max; i++) a.push(...sortJs(walk(path.join(root, "src/acts/act" + i)))); return a; };
const game = [path.join(root, "src/game.js")].filter(f => fs.existsSync(f));

const broken = new Set();
for (const f of [...core, ...data, ...mgs, ...actsUpTo(9), ...game]) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { broken.add(f); console.error("SYNTAX ERROR (file skipped) in " + rel(f) + "\n" + String(e.stderr || e).split("\n").slice(0, 6).join("\n")); }
}
if (broken.size) process.exitCode = 1;

const fonts = fs.readFileSync(path.join(root, "src/fonts.css"), "utf8");
const css = fs.readFileSync(path.join(root, "src/style.css"), "utf8");

function bundle({ level1 }) {
  const files = [...core, ...data, ...mgs, ...actsUpTo(level1 ? 1 : 9), ...game].filter(f => !broken.has(f));
  const title = level1 ? "re:parteé Level 1" : "re:parteé";
  const demo = level1 ? `window.RP_DEMO = ${JSON.stringify({ level: 1, levels: 5, full: FULL_GAME_URL })};\n` : "";
  const js = demo + files.map(f => `/* ---- ${rel(f)} ---- */\ntry {\n` + fs.readFileSync(f, "utf8").replace(/<\/script/gi, "<\\/script") + `\n} catch (e) { console.error("load error in ${rel(f)}", e); (window.__loadErrors = window.__loadErrors || []).push("${rel(f)}: " + e); }`).join("\n");
  const single = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${DESC}">
<style>\n${fonts}\n${css}\n</style>
</head>
<body>
<script>
${js}
</script>
</body>
</html>
`;
  // artifact variant: the claude.ai artifact host supplies <!doctype>/<head>/<body>, so ship content only
  const art = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="${DESC}">
<style>\n${fonts}\n${css}\n</style>
<script>
${js}
</script>
`;
  return { files, single, art };
}
function write(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + ".tmp" + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, target);
}
const kb = s => (s.length / 1024).toFixed(0) + " KB";
const note = broken.size ? " — " + broken.size + " BROKEN FILE(S) SKIPPED" : "";

if (outFile) {
  const b = bundle({ level1: args.includes("--level1") });
  write(outFile, b.single);
  if (args.includes("--artifact")) write(outFile.replace(/\.html$/, "") + ".artifact.html", b.art);
  console.log(`built ${rel(outFile)} (${b.files.length} scripts, ${kb(b.single)})${note}`);
} else {
  const full = bundle({ level1: false });
  const dev = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>re:parteé</title>
<meta name="description" content="${DESC}">
<link rel="stylesheet" href="src/fonts.css">
<link rel="stylesheet" href="src/style.css">
</head>
<body>
${full.files.map(f => `<script src="${rel(f)}"></script>`).join("\n")}
</body>
</html>
`;
  fs.writeFileSync(path.join(root, "index.html"), dev);
  write(path.join(root, "dist/index.html"), full.single);
  write(path.join(root, "dist/artifact.html"), full.art);
  const l1 = bundle({ level1: true });
  write(path.join(root, "dist/level1.html"), l1.single);
  write(path.join(root, "dist/level1.artifact.html"), l1.art);
  console.log(`built index.html + dist/index.html (${full.files.length} scripts, ${kb(full.single)}) + dist/level1.html (${l1.files.length} scripts, ${kb(l1.single)})${note}`);
}
