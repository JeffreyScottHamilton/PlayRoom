// Plain Node Playwright script (not @playwright/test). Run after `npm run build`:
//   node e2e/game-page.spec.mjs
// Uses the preinstalled Chromium; never installs browsers.
//
// Checks the Ruffle player layout on real game pages: the player box keeps the game's
// aspect ratio, the ruffle-player element fills that box, the box is horizontally
// centered, and the page does not scroll sideways.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const GAME_IDS = ["papas-burgeria", "star-catch"];
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

// Ruffle warnings are console.warn and are not checked. Add a pattern here only
// when a specific, understood console.error from Ruffle has been observed.
const KNOWN_ERROR_PATTERNS = [];

// Tolerance in CSS pixels for box comparisons.
const PX_TOLERANCE = 2;
// Tolerance for the width/height ratio.
const RATIO_TOLERANCE = 0.02;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Ask the OS for a free port. A fixed port can be held by a stale preview server
// from another checkout.
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
      const res = await fetch(`${base}/games/${GAME_IDS[0]}`);
      // Must be our built app shell, not any other server that happens to be up.
      if (res.ok && (await res.text()).includes('id="root"')) return;
    } catch {
      // Server not up yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`vite preview did not serve ${base} within ${timeoutMs} ms`);
}

async function loadGameSizes() {
  const data = JSON.parse(await readFile(join(root, "src", "data", "games.json"), "utf8"));
  const list = Array.isArray(data) ? data : data.games;
  const sizes = new Map();
  for (const game of list) {
    if (GAME_IDS.includes(game.id)) sizes.set(game.id, { width: game.width, height: game.height });
  }
  for (const id of GAME_IDS) {
    if (!sizes.has(id)) throw new Error(`games.json has no entry for ${id}`);
  }
  return sizes;
}

async function cleanup(server) {
  if (server && !server.killed) server.kill("SIGTERM");
}

/** Measures the player layout on the current page. All values are CSS pixels. */
async function measure(page) {
  return page.evaluate(() => {
    const container = document.querySelector("[data-player]");
    const player = container?.querySelector("ruffle-player");
    const parent = container?.parentElement;
    if (!container || !player || !parent) return null;
    const box = container.getBoundingClientRect();
    const playerBox = player.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();
    const docEl = document.documentElement;
    return {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      playerBox: { x: playerBox.x, y: playerBox.y, width: playerBox.width, height: playerBox.height },
      leftGap: box.left - parentBox.left,
      rightGap: parentBox.right - box.right,
      scrollWidth: docEl.scrollWidth,
      clientWidth: docEl.clientWidth,
    };
  });
}

function check(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function checkGame(browser, base, id, size, viewport, problems) {
  const label = `${id} @ ${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageProblems = [];
  page.on("pageerror", (err) => pageProblems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (KNOWN_ERROR_PATTERNS.some((re) => re.test(text))) return;
    pageProblems.push(`console.error: ${text}`);
  });

  try {
    await page.goto(`${base}/games/${id}`, { waitUntil: "load" });
    await page.waitForSelector("[data-player] ruffle-player", { timeout: 30_000 });

    const m = await measure(page);
    if (!m) throw new Error(`${label}: player container not found`);

    const failures = [];
    const ratio = m.box.width / m.box.height;
    const expected = size.width / size.height;
    check(
      Math.abs(ratio - expected) < RATIO_TOLERANCE,
      `aspect ratio ${ratio.toFixed(4)} != ${expected.toFixed(4)} (${m.box.width.toFixed(1)}x${m.box.height.toFixed(1)})`,
      failures,
    );
    check(
      Math.abs(m.playerBox.x - m.box.x) <= PX_TOLERANCE &&
        Math.abs(m.playerBox.y - m.box.y) <= PX_TOLERANCE &&
        Math.abs(m.playerBox.width - m.box.width) <= PX_TOLERANCE &&
        Math.abs(m.playerBox.height - m.box.height) <= PX_TOLERANCE,
      `ruffle-player ${JSON.stringify(m.playerBox)} does not match container ${JSON.stringify(m.box)}`,
      failures,
    );
    check(
      Math.abs(m.leftGap - m.rightGap) <= PX_TOLERANCE,
      `container not centered: left gap ${m.leftGap.toFixed(1)}, right gap ${m.rightGap.toFixed(1)}`,
      failures,
    );
    check(
      m.scrollWidth <= m.clientWidth + PX_TOLERANCE,
      `horizontal page overflow: scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}`,
      failures,
    );

    if (failures.length > 0) throw new Error(`${label}:\n  ${failures.join("\n  ")}`);
    if (pageProblems.length > 0) {
      problems.push(`${label}: ${pageProblems.join("; ")}`);
    }
    console.log(
      `ok ${label}: ${m.box.width.toFixed(1)}x${m.box.height.toFixed(1)} ratio ${ratio.toFixed(4)}`,
    );
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  if (!(await exists(join(dist, "index.html")))) {
    throw new Error("dist/ is missing. Run `npm run build` first.");
  }
  const sizes = await loadGameSizes();

  const PORT = await freePort();
  const BASE = `http://127.0.0.1:${PORT}`;
  let server;
  let browser;
  try {
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

    browser = await chromium.launch({
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });

    const problems = [];
    const failures = [];
    for (const id of GAME_IDS) {
      for (const viewport of VIEWPORTS) {
        try {
          await checkGame(browser, BASE, id, sizes.get(id), viewport, problems);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : String(err));
        }
      }
    }

    if (failures.length > 0) throw new Error(failures.join("\n"));
    if (problems.length > 0) {
      throw new Error(`unexpected browser errors:\n${problems.join("\n")}`);
    }
    console.log("game page layout ok");
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
