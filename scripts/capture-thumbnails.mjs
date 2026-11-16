// Headless compatibility check and thumbnail capture for import drafts.
//
// For each draft in src/data/games.import.json (or the ids given on the command line):
//   1. Serves public/ (ruffle runtime + games) and a page that loads /ruffle/ruffle.js
//      with the same options as src/player/loadRuffle.ts and RufflePlayer.tsx.
//   2. Loads the SWF and waits up to 20 s for loadedmetadata / load / error.
//   3. Records Ruffle error events, console errors and warnings, and page errors.
//   4. Clicks the player centre (twice, see Clicks below), waits 3 s after each click, screenshots the player.
//   5. Checks whether the screenshot is blank (near-uniform pixels).
//   6. Writes public/games/<id>/thumb.webp (640x400, cover crop, #111514 fill) when the game renders.
//   7. Prints a table with a verdict. It never edits the manifest; promotion is separate.
//
// Verdict: unsupported when not loaded, a fatal Ruffle error/panic/page error occurs, or the
// render is blank. partial when it renders but has console errors/warnings or is needs-review
// (ZWS). verified otherwise. This proves only that the game loads and renders in Ruffle
// (automated check); it does not prove gameplay.
//
// Usage: node scripts/capture-thumbnails.mjs [id ...]
//   no ids: checks every draft with compatibility "unsupported" in games.import.json
//   with ids: checks those ids (looked up in the drafts, then the live manifest; use for re-captures)
//   Clicks: CAPTURE_CLICKS (default 2). The first click can land before Ruffle's click-to-play
//   overlay is active, so the player is clicked twice, 3 s apart, before the screenshot.
//   Playwright: require('playwright') first, then PLAYWRIGHT_MODULE_PATH (a package directory).
// Needs Node, Playwright and public/ruffle/ (run node scripts/copy-ruffle.mjs first). Never installs browsers.
// Set CAPTURE_DEBUG_DIR to also save each screenshot as <id>.png there (review aid).
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const DRAFTS = join(ROOT, 'src', 'data', 'games.import.json')
const LIVE = join(ROOT, 'src', 'data', 'games.json')
const THUMB_W = 640
const THUMB_H = 400
const LOAD_TIMEOUT_MS = 20_000
const CLICK_COUNT = Number(process.env.CAPTURE_CLICKS ?? 2)
const FATAL_PATTERN = /panic|uncaught|runtimeerror/i
// Browser GPU driver chatter (not Ruffle or the game); ignored so it does not count as a warning.
const IGNORED_CONSOLE_PATTERN = /GL Driver Message/

function loadPlaywright() {
  const specs = ['playwright']
  if (process.env.PLAYWRIGHT_MODULE_PATH) specs.push(process.env.PLAYWRIGHT_MODULE_PATH)
  for (const spec of specs) {
    try {
      return require(spec)
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err
    }
  }
  throw new Error(
    "Playwright not found: require('playwright') failed and PLAYWRIGHT_MODULE_PATH is unset or does not point at the playwright package.",
  )
}

// Same options as src/player/RufflePlayer.tsx; the loader mirrors src/player/loadRuffle.ts.
const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>capture</title>
</head>
<body style="margin:0;background:#111514">
<div id="stage" style="position:relative;background:#111514"></div>
<script>
(function () {
  var q = new URLSearchParams(location.search);
  var src = q.get("src");
  var w = Number(q.get("w")) || 550;
  var h = Number(q.get("h")) || 400;
  var state = (window.__state = { loaded: false, error: null, meta: null });
  var stage = document.getElementById("stage");
  stage.style.width = w + "px";
  stage.style.height = h + "px";
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = { publicPath: "/ruffle/" };
  var script = document.createElement("script");
  script.src = "/ruffle/ruffle.js";
  script.async = true;
  script.onerror = function () { state.error = "script failed to load"; };
  script.onload = function () {
    var player = window.RufflePlayer.newest().createPlayer();
    player.style.display = "block";
    player.style.width = "100%";
    player.style.height = "100%";
    stage.appendChild(player);
    player.addEventListener("loadedmetadata", function () {
      state.loaded = true;
      Promise.resolve(player.metadata).then(function (m) {
        state.meta = m ? { width: m.width, height: m.height } : null;
      }, function () {});
    });
    player.addEventListener("error", function (e) {
      state.error = "ruffle error event: " + (e && e.detail ? JSON.stringify(e.detail).slice(0, 300) : "");
    });
    var result = player.load({
      url: src,
      autoplay: "on",
      unmuteOverlay: "hidden",
      splashScreen: false,
      letterbox: "on",
      contextMenu: "rightClickOnly",
      warnOnUnsupportedContent: true
    });
    if (result && typeof result.then === "function") {
      result.then(function () { state.loaded = true; }, function (err) {
        state.error = "load rejected: " + String(err).slice(0, 300);
      });
    }
  };
  document.head.appendChild(script);
})();
</script>
</body>
</html>
`

const MIME = {
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.swf': 'application/x-shockwave-flash',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.map': 'application/json',
}

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/__capture.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(PAGE_HTML)
      return
    }
    if (!url.pathname.startsWith('/ruffle/') && !url.pathname.startsWith('/games/')) {
      res.writeHead(404).end()
      return
    }
    const file = resolve(PUBLIC, decodeURIComponent(url.pathname).replace(/^\/+/, ''))
    if (!file.startsWith(PUBLIC + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

// Runs inside the browser: cover-crops the screenshot to 640x400 and measures it.
const ANALYSE_IN_PAGE = async ({ png, W, H }) => {
  const img = new Image()
  img.src = png
  await img.decode()
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  const sc = document.createElement('canvas')
  sc.width = sw
  sc.height = sh
  const sctx = sc.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(img, 0, 0)
  const px = sctx.getImageData(0, 0, sw, sh).data
  const bins = new Set()
  let n = 0
  let sum = 0
  let sum2 = 0
  for (let i = 0; i < px.length; i += 16) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    bins.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    sum += l
    sum2 += l * l
    n++
  }
  const mean = sum / n
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
  const scale = Math.max(W / sw, H / sh)
  const dw = sw * scale
  const dh = sh * scale
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const octx = out.getContext('2d')
  octx.fillStyle = '#111514'
  octx.fillRect(0, 0, W, H)
  octx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
  const webp = out.toDataURL('image/webp', 0.85)
  return { distinct: bins.size, sd, webp }
}

function verdictFor({ loaded, fatal, blank, nonFatal, needsReview }) {
  if (!loaded || fatal.length > 0 || blank) return 'unsupported'
  if (nonFatal.length > 0 || needsReview) return 'partial'
  return 'verified'
}

async function captureOne(browser, base, draft) {
  const id = draft.id
  const needsReview = (draft.flags ?? []).some((f) => f.startsWith('needs-review'))
  const width = Number.isInteger(draft.width) ? draft.width : 550
  const height = Number.isInteger(draft.height) ? draft.height : 400
  // Keep the on-page stage within 900 px wide; the aspect ratio is preserved.
  const scale = Math.min(1, 900 / width)
  const W = Math.round(width * scale)
  const H = Math.round(height * scale)

  const page = await browser.newPage({ viewport: { width: W + 40, height: H + 40 } })
  const fatal = []
  const nonFatal = []
  page.on('pageerror', (err) => fatal.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    const text = msg.text()
    if (IGNORED_CONSOLE_PATTERN.test(text)) return
    if (msg.type() === 'error') {
      if (FATAL_PATTERN.test(text)) fatal.push(`console.error: ${text}`)
      else nonFatal.push(`console.error: ${text}`)
    } else if (msg.type() === 'warning') {
      nonFatal.push(`console.warn: ${text}`)
    }
  })

  const result = { id, loaded: false, errors: [], blank: null, meta: null, verdict: 'unsupported', thumb: null, needsReview }
  try {
    await page.goto(`${base}/__capture.html?src=${encodeURIComponent(`/games/${id}/game.swf`)}&w=${W}&h=${H}`, {
      waitUntil: 'load',
    })
    await page
      .waitForFunction(() => window.__state.loaded === true || window.__state.error !== null, null, {
        timeout: LOAD_TIMEOUT_MS,
      })
      .catch(() => {})
    const state = await page.evaluate(() => window.__state)
    result.loaded = state.loaded === true
    if (process.env.CAPTURE_DEBUG_DIR) console.log(`debug ${id}: state=${JSON.stringify(state)}`)
    result.meta = state.meta
    if (state.error) fatal.push(state.error)

    // Let the first frames run, click the player centre once, then wait 3 s.
    await page.waitForTimeout(2000)
    const box = await page.locator('#stage').boundingBox()
    // Ruffle shows a click-to-play overlay until the player receives a click. The first click
    // can land before the overlay is active, so click, wait, then click again (CLICK_COUNT).
    for (let i = 0; i < CLICK_COUNT && box; i++) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(3000)
    }

    const shot = await page.locator('#stage').screenshot({ type: 'png' })
    if (process.env.CAPTURE_DEBUG_DIR) writeFileSync(join(process.env.CAPTURE_DEBUG_DIR, `${id}.png`), shot)
    const analysis = await page.evaluate(ANALYSE_IN_PAGE, {
      png: `data:image/png;base64,${shot.toString('base64')}`,
      W: THUMB_W,
      H: THUMB_H,
    })
    // Blank = no luminance variation at all (a uniform frame). Black-and-white art has only two
    // colour bins, so the colour count is not used.
    result.blank = analysis.sd < 2

    result.verdict = verdictFor({ loaded: result.loaded, fatal, blank: result.blank, nonFatal, needsReview })
    if (result.loaded && fatal.length === 0 && !result.blank) {
      if (!analysis.webp.startsWith('data:image/webp')) {
        fatal.push('canvas could not encode WebP')
        result.verdict = 'unsupported'
      } else {
        const bytes = Buffer.from(analysis.webp.split(',')[1], 'base64')
        const dir = join(PUBLIC, 'games', id)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'thumb.webp'), bytes)
        result.thumb = `public/games/${id}/thumb.webp`
      }
    }
  } catch (err) {
    fatal.push(`capture failed: ${err.message}`)
    result.verdict = 'unsupported'
  } finally {
    await page.close().catch(() => {})
  }
  result.errors = [...fatal.map((m) => `FATAL ${m}`), ...nonFatal.map((m) => `warn ${m}`)]
  result.fatalCount = fatal.length
  result.nonFatalCount = nonFatal.length
  return result
}

function printTable(results) {
  const header = ['id', 'loaded', 'errors', 'warnings', 'blank', 'stage (metadata)', 'verdict']
  const rows = results.map((r) => [
    r.id,
    r.loaded ? 'yes' : 'no',
    String(r.fatalCount),
    String(r.nonFatalCount),
    r.blank === null ? '-' : r.blank ? 'yes' : 'no',
    r.meta ? `${r.meta.width}x${r.meta.height}` : '-',
    r.verdict,
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)))
  const line = (row) => row.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()
  console.log(line(header))
  console.log(line(widths.map((w) => '-'.repeat(w))))
  for (const row of rows) console.log(line(row))
  for (const r of results) {
    for (const e of r.errors) console.log(`  ${r.id}: ${e.slice(0, 240)}`)
  }
}

async function main() {
  if (!existsSync(join(PUBLIC, 'ruffle', 'ruffle.js'))) {
    console.error('capture-thumbnails: public/ruffle/ruffle.js missing. Run node scripts/copy-ruffle.mjs first.')
    process.exit(1)
  }
  const drafts = JSON.parse(readFileSync(DRAFTS, 'utf8'))
  const live = JSON.parse(readFileSync(LIVE, 'utf8'))
  const wanted = process.argv.slice(2)
  // Named ids are looked up in the drafts, then the live manifest (for re-captures).
  const selected = wanted.length
    ? wanted.map((id) => drafts.find((d) => d.id === id) ?? live.find((g) => g.id === id) ?? { id, flags: [] })
    : drafts.filter((d) => d.compatibility === 'unsupported')
  if (selected.length === 0) {
    console.log('capture-thumbnails: no drafts to check.')
    return
  }

  const { chromium } = loadPlaywright()
  const server = await startServer()
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const results = []
  try {
    for (const draft of selected) {
      if (!existsSync(join(PUBLIC, 'games', draft.id, 'game.swf'))) {
        results.push({ id: draft.id, loaded: false, errors: ['FATAL game.swf missing'], fatalCount: 1, nonFatalCount: 0, blank: null, meta: null, verdict: 'unsupported' })
        continue
      }
      results.push(await captureOne(browser, base, draft))
    }
  } finally {
    await browser.close().catch(() => {})
    server.close()
  }
  printTable(results)
}

main().catch((err) => {
  console.error(`capture-thumbnails: ${err.message}`)
  process.exit(1)
})
