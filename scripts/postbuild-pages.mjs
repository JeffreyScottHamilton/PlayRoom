// Post-build step for GitHub Pages (npm run build:pages).
// - Always: copies dist/index.html to dist/404.html (SPA fallback) and writes dist/.nojekyll.
// - VITE_LIBRARY=open: deletes dist/games/<id>/ for every owner-asserted manifest entry.
//   Ids are validated before anything is deleted, and only paths inside dist/games are touched.
import { copyFileSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isOwnerAssertedEntry } from './vite-library-scope.mjs'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SCOPES = ['all', 'open']

// Throws if any built JS/CSS/HTML under dist/assets still references an owner-asserted
// game's folder (the asset path is "/games/<id>/..."). Defence in depth behind the Vite plugin.
function assertNoOwnerLeak(dist, ids) {
  const assets = join(dist, 'assets')
  if (!existsSync(assets)) return
  const needles = ids.map((id) => `/games/${id}/`)
  for (const name of readdirSync(assets)) {
    if (!/\.(m?js|css|html)$/.test(name)) continue
    const text = readFileSync(join(assets, name), 'utf8')
    const hit = needles.find((n) => text.includes(n))
    if (hit) throw new Error(`owner-asserted path "${hit}" leaked into dist/assets/${name}`)
  }
}

/**
 * Applies the Pages post-build steps under `root` (the project root).
 * `scope` is the VITE_LIBRARY value used for the build: "all" (default) or "open".
 * Returns counts: { scope, ownerAsserted, removed: [ids], missing: [ids] }.
 */
export function postbuildPages({ root, scope = 'all' }) {
  const libraryScope = scope || 'all'
  if (!SCOPES.includes(libraryScope)) {
    throw new Error(`VITE_LIBRARY must be "all" or "open", got "${libraryScope}"`)
  }

  const dist = join(root, 'dist')
  const indexHtml = join(dist, 'index.html')
  if (!existsSync(indexHtml)) {
    throw new Error('dist/index.html is missing. Run the build before postbuild-pages.')
  }

  const result = { scope: libraryScope, ownerAsserted: 0, removed: [], missing: [] }

  if (libraryScope === 'open') {
    const games = JSON.parse(readFileSync(join(root, 'src', 'data', 'games.json'), 'utf8'))
    const owned = games.filter(isOwnerAssertedEntry)
    // Validate every id before deleting anything.
    for (const game of owned) {
      if (typeof game.id !== 'string' || !ID_RE.test(game.id)) {
        throw new Error(`owner-asserted entry id must be kebab-case, got "${String(game.id)}"`)
      }
    }
    result.ownerAsserted = owned.length
    assertNoOwnerLeak(dist, owned.map((g) => g.id))

    const gamesDir = resolve(dist, 'games')
    for (const game of owned) {
      const target = resolve(gamesDir, game.id)
      if (!target.startsWith(gamesDir + sep)) {
        throw new Error(`refusing to delete outside dist/games: ${game.id}`)
      }
      if (!existsSync(target)) {
        result.missing.push(game.id)
        continue
      }
      if (lstatSync(target).isSymbolicLink()) {
        throw new Error(`refusing to delete a symlink: dist/games/${game.id}`)
      }
      rmSync(target, { recursive: true, force: true })
      result.removed.push(game.id)
    }
  }

  copyFileSync(indexHtml, join(dist, '404.html'))
  writeFileSync(join(dist, '.nojekyll'), '')
  return result
}

function isDirectRun() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isDirectRun()) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const r = postbuildPages({ root, scope: process.env.VITE_LIBRARY || 'all' })
    console.log(
      `postbuild-pages: scope=${r.scope}, owner-asserted=${r.ownerAsserted}, ` +
        `removed=${r.removed.length}${r.removed.length ? ` (${r.removed.join(', ')})` : ''}, ` +
        `not-present=${r.missing.length}, wrote dist/404.html and dist/.nojekyll`,
    )
  } catch (err) {
    console.error(`postbuild-pages: ${err.message}`)
    process.exit(1)
  }
}
