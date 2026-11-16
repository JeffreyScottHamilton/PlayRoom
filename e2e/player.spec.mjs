// Plain Node Playwright script (not @playwright/test). Run after `npm run build`:
//   node e2e/player.spec.mjs
// Uses the preinstalled Chromium; never installs browsers.
//
// It copies tests/fixtures/ruffle-test.swf into dist/games/__fixture/game.swf and
// writes dist/__player-test.html, which loads /ruffle/ruffle.js and the fixture the
// same way src/player/loadRuffle.ts does. Both generated files are removed afterwards.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const fixtureSrc = join(root, "tests", "fixtures", "ruffle-test.swf");
const fixtureDir = join(dist, "games", "__fixture");
const fixtureDest = join(fixtureDir, "game.swf");
const testPage = join(dist, "__player-test.html");

// Ruffle warnings are console.warn and are not checked. Add a pattern here only
// when a specific, understood console.error from Ruffle has been observed.
const KNOWN_ERROR_PATTERNS = [];

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>player test</title>
</head>
<body style="margin:0;background:#000">
<div id="host" style="width:550px;height:400px"></div>
<script>
  window.__rufflePlayerReady = false;
  window.__rufflePlayerError = null;
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = { publicPath: "/ruffle/" };
  var script = document.createElement("script");
  script.src = "/ruffle/ruffle.js";
  script.onerror = function () { window.__rufflePlayerError = "script failed to load"; };
  script.onload = function () {
    var player = window.RufflePlayer.newest().createPlayer();
    player.id = "player";
    document.getElementById("host").appendChild(player);
    player.addEventListener("loadedmetadata", function () { window.__rufflePlayerReady = true; });
    player.addEventListener("error", function (e) {
      window.__rufflePlayerError = "ruffle error event: " + (e && e.detail ? JSON.stringify(e.detail) : "");
    });
    player.load({
      url: "/games/__fixture/game.swf",
      autoplay: "on",
      unmuteOverlay: "hidden",
      splashScreen: false,
      letterbox: "on",
      contextMenu: "rightClickOnly",
      warnOnUnsupportedContent: true
    });
  };
  document.head.appendChild(script);
</script>
</body>
</html>
`;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Ask the OS for a free port. A fixed port can be held by a stale preview server
// from another checkout, which then answers for this test page with 404.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(base, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/__player-test.html`);
      // Must be our generated page, not any other server that happens to be up.
      if (res.ok && (await res.text()).includes("__rufflePlayerReady")) return;
    } catch {
      // Server not up yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`vite preview did not serve ${base} within ${timeoutMs} ms`);
}

async function cleanup(server) {
  if (server && !server.killed) server.kill("SIGTERM");
  await rm(testPage, { force: true });
  await rm(fixtureDest, { force: true });
  await rm(fixtureDir, { recursive: true, force: true });
  // Remove dist/games only if this run created it and it is now empty.
  try {
    await rmdir(join(dist, "games"));
  } catch {
    // Not empty or absent: leave it alone.
  }
}

async function main() {
  if (!(await exists(join(dist, "index.html")))) {
    throw new Error("dist/ is missing. Run `npm run build` first.");
  }
  if (!(await exists(join(dist, "ruffle", "ruffle.js")))) {
    throw new Error("dist/ruffle/ruffle.js is missing. Run `npm run build` first.");
  }

  const PORT = await freePort();
  const BASE = `http://127.0.0.1:${PORT}`;
  let server;
  let browser;
  try {
    await mkdir(fixtureDir, { recursive: true });
    await copyFile(fixtureSrc, fixtureDest);
    await writeFile(testPage, PAGE_HTML, "utf8");

    server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverLog = "";
    server.stdout.on("data", (d) => (serverLog += d));
    server.stderr.on("data", (d) => (serverLog += d));
    await waitForServer(BASE, 30_000).catch((err) => {
      throw new Error(`${err.message}\n${serverLog}`);
    });

    browser = await chromium.launch();
    const page = await browser.newPage();

    const problems = [];
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (KNOWN_ERROR_PATTERNS.some((re) => re.test(text))) return;
      problems.push(`console.error: ${text}`);
    });

    await page.goto(`${BASE}/__player-test.html`, { waitUntil: "load" });

    await page.waitForFunction(
      () => window.__rufflePlayerReady === true || window.__rufflePlayerError !== null,
      null,
      { timeout: 30_000 },
    );

    const state = await page.evaluate(() => ({
      ready: window.__rufflePlayerReady,
      error: window.__rufflePlayerError,
      hasElement: document.querySelector("ruffle-player") !== null,
    }));

    if (state.error) throw new Error(`Ruffle failed: ${state.error}`);
    if (!state.hasElement) throw new Error("no ruffle-player element was created");
    if (!state.ready) throw new Error("ruffle-player never fired loadedmetadata");
    if (problems.length > 0) {
      throw new Error(`unexpected browser errors:\n${problems.join("\n")}`);
    }

    console.log("ruffle ok");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await cleanup(server);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
