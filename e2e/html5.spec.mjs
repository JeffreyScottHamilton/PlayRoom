// Plain Node Playwright script (not @playwright/test). Run after `npm run build`:
//   node e2e/html5.spec.mjs
// Uses the preinstalled Chromium; never installs browsers.
//
// Checks the HTML5 sandbox boundary. It copies tests/fixtures/html5-test/index.html into
// dist/games/__html5fixture/html/ and writes dist/__html5-test.html, which mounts the fixture
// in an iframe with the same attributes src/player/Html5Player.tsx renders. The built app
// cannot load a test-only manifest entry without changing src/data/games.json, so the page
// is generated. Both generated paths are removed afterwards.
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
const fixtureSrc = join(root, "tests", "fixtures", "html5-test", "index.html");
const fixtureDir = join(dist, "games", "__html5fixture", "html");
const fixtureDest = join(fixtureDir, "index.html");
const fixturePath = "/games/__html5fixture/html/index.html";
const testPage = join(dist, "__html5-test.html");
const testPagePath = "/__html5-test.html";
const PROBE_KEY = "playroom:e2e-probe";
const PARENT_VALUE = "parent-value";
const SANDBOX = "allow-scripts allow-pointer-lock";

// Same attributes Html5Player renders. Keep in sync with src/player/Html5Player.tsx.
// The parent writes its probe key before the iframe exists, so the frame's storage
// access would be visible if the sandbox let it through.
const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>html5 test</title>
</head>
<body style="margin:0;background:#000">
<script>
  localStorage.setItem("${PROBE_KEY}", "${PARENT_VALUE}");
  window.__iframeLoaded = false;
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "${SANDBOX}");
  frame.setAttribute("allow", "fullscreen; autoplay; gamepad");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.setAttribute("loading", "eager");
  frame.setAttribute("title", "html5 fixture game");
  frame.setAttribute("src", "${fixturePath}");
  frame.style.cssText = "display:block;width:640px;height:480px;border:0";
  frame.addEventListener("load", () => { window.__iframeLoaded = true; });
  document.body.appendChild(frame);
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
      const res = await fetch(`${base}${testPagePath}`);
      // Must be the page this run generated, not another server on the port.
      if (res.ok && (await res.text()).includes("__iframeLoaded")) return;
    } catch {
      // Server not up yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`vite preview did not serve ${base}${testPagePath} within ${timeoutMs} ms`);
}

function check(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function cleanup(server) {
  if (server && !server.killed) server.kill("SIGTERM");
  await rm(testPage, { force: true });
  await rm(join(dist, "games", "__html5fixture"), { recursive: true, force: true });
  await rmdir(join(dist, "games")).catch(() => {});
}

async function main() {
  if (!(await exists(join(dist, "index.html")))) {
    throw new Error("dist/ is missing. Run `npm run build` first.");
  }

  await mkdir(fixtureDir, { recursive: true });
  await copyFile(fixtureSrc, fixtureDest);
  await writeFile(testPage, PAGE_HTML, "utf8");

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
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`${BASE}${testPagePath}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__iframeLoaded === true, null, { timeout: 30_000 });

    const failures = [];

    // Parent-side view of the iframe element.
    const parentView = await page.evaluate(() => {
      const el = document.querySelector("iframe");
      let contentDocumentNull = false;
      let contentDocumentThrew = false;
      try {
        contentDocumentNull = el.contentDocument === null;
      } catch {
        contentDocumentThrew = true;
      }
      let locationReadable = true;
      try {
        void el.contentWindow.location.href;
      } catch {
        locationReadable = false;
      }
      return {
        sandbox: el.getAttribute("sandbox"),
        allow: el.getAttribute("allow"),
        contentDocumentNull,
        contentDocumentThrew,
        locationReadable,
      };
    });
    check(
      parentView.sandbox === SANDBOX,
      `sandbox is "${parentView.sandbox}", expected "${SANDBOX}"`,
      failures,
    );
    check(
      !/allow-same-origin/.test(parentView.sandbox ?? ""),
      "sandbox grants allow-same-origin",
      failures,
    );
    check(
      parentView.contentDocumentNull || parentView.contentDocumentThrew,
      "parent can read iframe.contentDocument",
      failures,
    );
    check(!parentView.locationReadable, "parent can read iframe location", failures);

    // The iframe is a separate (opaque-origin) frame; Playwright can still evaluate in it.
    const frame = page.frames().find((f) => f !== page.mainFrame());
    if (!frame) {
      failures.push("no child frame found for the iframe");
    } else {
      await frame.waitForFunction(() => window.__fixture !== undefined, null, { timeout: 15_000 });

      const origin = await frame.evaluate(() => window.origin);
      check(origin === "null", `iframe origin is "${origin}", expected opaque "null"`, failures);
      check(
        frame.url().endsWith(fixturePath),
        `iframe url is ${frame.url()}, expected ${fixturePath}`,
        failures,
      );

      // Canvas must be drawn: more than one colour in the drawn buffer.
      await frame.waitForFunction(
        () => {
          const c = document.querySelector("canvas");
          if (!c) return false;
          const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
          const seen = new Set();
          for (let i = 0; i < d.length && seen.size < 3; i += 4) {
            seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
          }
          return seen.size >= 3;
        },
        null,
        { timeout: 15_000 },
      );
      const canvas = await frame.evaluate(() => {
        const c = document.querySelector("canvas");
        return { width: c.width, height: c.height };
      });
      check(
        canvas.width === 640 && canvas.height === 480,
        `canvas is ${canvas.width}x${canvas.height}, expected 640x480`,
        failures,
      );

      const probes = await frame.evaluate(() => window.__fixture);
      check(
        probes.top === "blocked",
        `fixture could read top.location (result: ${probes.top})`,
        failures,
      );
      check(
        probes.storage === "blocked",
        `fixture could write localStorage (result: ${probes.storage})`,
        failures,
      );

      const parentStorage = await page.evaluate((key) => localStorage.getItem(key), PROBE_KEY);
      check(
        parentStorage === PARENT_VALUE,
        `parent localStorage "${PROBE_KEY}" is "${parentStorage}", expected "${PARENT_VALUE}"`,
        failures,
      );
    }

    check(pageErrors.length === 0, `parent page errors: ${pageErrors.join("; ")}`, failures);

    if (failures.length > 0) throw new Error(failures.join("\n"));
    console.log(
      `html5 sandbox ok: origin null, canvas 640x480 drawn, top and storage blocked, parent storage intact`,
    );
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
