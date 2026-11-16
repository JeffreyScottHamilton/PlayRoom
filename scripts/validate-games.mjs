// Manifest validator: enforces the licensing gate and schema rules on src/data/games.json.
// Exit 0 when valid, exit 1 listing every problem as "<id>: <problem>".
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const COMPATIBILITY = ['verified', 'partial', 'unsupported']
const ENGINES = ['flash', 'html5']
// Cloudflare Pages per-file limit.
const MAX_FILE_BYTES = 25 * 1024 * 1024

// Single source of truth: the CATEGORIES tuple in src/types/game.ts.
export function readCategories(repoRoot = REPO_ROOT) {
  const src = readFileSync(join(repoRoot, 'src', 'types', 'game.ts'), 'utf8')
  const match = src.match(/CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!match) throw new Error('could not find CATEGORIES in src/types/game.ts')
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

const CATEGORIES = readCategories(REPO_ROOT)

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const isPositiveInt = (v) => Number.isInteger(v) && v > 0

function isValidIsoDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/**
 * Validates manifest entries. `root` is the project root; local asset paths
 * ("/games/<id>/...") are resolved against `<root>/public`.
 * `options` is either the root path or `{ root }`.
 * Returns a list of "<label>: <problem>" strings (empty when valid).
 */
export function validateGames(games, options = REPO_ROOT) {
  const root = typeof options === 'string' ? options : (options?.root ?? REPO_ROOT)
  if (!Array.isArray(games)) return ['manifest: must be a JSON array']

  const errors = []
  const seenIds = new Map()
  const seenRanks = new Map()
  let featuredCount = 0

  games.forEach((g, index) => {
    const label = isObject(g) && isNonEmptyString(g.id) ? g.id : `#${index + 1}`
    const fail = (problem) => errors.push(`${label}: ${problem}`)

    if (!isObject(g)) {
      fail('entry must be an object')
      return
    }

    // Identity
    if (typeof g.id !== 'string' || !ID_RE.test(g.id)) {
      fail('id must be kebab-case (lowercase letters, digits, hyphens)')
    } else if (seenIds.has(g.id)) {
      fail(`duplicate id (also entry #${seenIds.get(g.id) + 1})`)
    } else {
      seenIds.set(g.id, index)
    }

    // Text
    if (!isNonEmptyString(g.title)) fail('title is required')
    if (!isNonEmptyString(g.description)) fail('description is required')
    if (!isNonEmptyString(g.controls)) fail('controls is required')
    if (g.developer !== undefined && !isNonEmptyString(g.developer)) {
      fail('developer must be a non-empty string when present')
    }
    if (g.releaseYear !== undefined && !isPositiveInt(g.releaseYear)) {
      fail('releaseYear must be a positive integer when present')
    }

    // Categories
    if (!Array.isArray(g.category) || g.category.length === 0) {
      fail('category must be a non-empty array')
    } else {
      for (const c of g.category) {
        if (!CATEGORIES.includes(c)) fail(`invalid category "${c}"`)
      }
    }

    // Compatibility and flags
    if (!COMPATIBILITY.includes(g.compatibility)) {
      fail(`compatibility must be one of ${COMPATIBILITY.join(', ')}`)
    }
    if (typeof g.needsKeyboard !== 'boolean') fail('needsKeyboard must be a boolean')

    // Dates
    if (!isValidIsoDate(g.addedAt)) fail('addedAt must be an ISO date (YYYY-MM-DD)')

    // License (licensing gate)
    if (!isObject(g.license)) {
      fail('license is required')
    } else {
      if (!isNonEmptyString(g.license.type)) fail('license.type is required')
      if (!isNonEmptyString(g.license.source)) {
        fail('license.source is required')
      } else if (!g.license.source.startsWith('https://')) {
        fail('license.source must be an https URL')
      }
      if (g.license.notes !== undefined && typeof g.license.notes !== 'string') {
        fail('license.notes must be a string when present')
      }
    }

    // Runtime
    if (g.engine !== undefined && !ENGINES.includes(g.engine)) {
      fail(`engine must be one of ${ENGINES.join(', ')} when present`)
    }

    // Assets
    checkAsset(fail, root, 'thumbnail', g.thumbnail, g.id)
    checkAsset(fail, root, 'gameFile', g.gameFile, g.id)
    if (g.engine === 'html5') {
      checkHtml5GameFile(fail, g.gameFile, g.id)
      checkHtml5Folder(fail, root, g.id)
    } else if (g.engine === undefined || g.engine === 'flash') {
      if (isNonEmptyString(g.gameFile) && !g.gameFile.endsWith('.swf')) {
        fail('flash gameFile must end in .swf')
      }
    }

    // Dimensions
    if (!isPositiveInt(g.width)) fail('width must be a positive integer')
    if (!isPositiveInt(g.height)) fail('height must be a positive integer')

    // Curation
    if (g.popularRank !== undefined) {
      if (!isPositiveInt(g.popularRank)) {
        fail('popularRank must be a positive integer when present')
      } else if (seenRanks.has(g.popularRank)) {
        fail(`popularRank ${g.popularRank} is already used by ${seenRanks.get(g.popularRank)}`)
      } else {
        seenRanks.set(g.popularRank, label)
      }
    }
    if (g.featured !== undefined) {
      if (typeof g.featured !== 'boolean') fail('featured must be a boolean when present')
      else if (g.featured) featuredCount++
    }
  })

  if (featuredCount > 1) {
    errors.push(`manifest: ${featuredCount} entries are featured; at most one is allowed`)
  }

  return errors
}

function checkHtml5GameFile(fail, value, id) {
  if (!isNonEmptyString(value) || !isNonEmptyString(id)) return
  const prefix = `/games/${id}/html/`
  if (!value.startsWith(prefix)) {
    fail(`html5 gameFile must live under ${prefix}`)
    return
  }
  if (!value.toLowerCase().endsWith('.html')) {
    fail('html5 gameFile must be an .html file')
  }
}

/** Walks public/games/<id>/html and reports files, total bytes, oversize files and symlinks. */
export function scanHtml5Folder(root, id) {
  const report = { files: 0, bytes: 0, oversize: [], symlinks: [] }
  if (!ID_RE.test(id)) return report
  const dir = join(root, 'public', 'games', id, 'html')
  if (!existsSync(dir)) return report

  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      const rel = relative(dir, full)
      if (entry.isSymbolicLink()) {
        report.symlinks.push(rel)
      } else if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile()) {
        const { size } = statSync(full)
        report.files++
        report.bytes += size
        if (size > MAX_FILE_BYTES) report.oversize.push(rel)
      }
    }
  }
  walk(dir)
  return report
}

function checkHtml5Folder(fail, root, id) {
  if (!isNonEmptyString(id)) return
  const report = scanHtml5Folder(root, id)
  for (const rel of report.symlinks) fail(`html5 folder must not contain symlinks (${rel})`)
  for (const rel of report.oversize) fail(`html5 file ${rel} is larger than 25 MiB`)
}

function checkAsset(fail, root, field, value, id) {
  if (!isNonEmptyString(value)) {
    fail(`${field} is required`)
    return
  }
  if (value.startsWith('/')) {
    if (value.includes('..')) {
      fail(`${field} must not contain ".."`)
      return
    }
    if (isNonEmptyString(id) && !value.startsWith(`/games/${id}/`)) {
      fail(`${field} must live under /games/${id}/`)
    }
    if (!existsSync(join(root, 'public', value))) {
      fail(`${field} points to missing file ${value}`)
    }
    return
  }
  if (!value.startsWith('https://')) {
    fail(`${field} must be a /games/... path or an https URL`)
  }
}

function main() {
  const manifestPath = join(REPO_ROOT, 'src', 'data', 'games.json')
  let games
  try {
    games = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`validate-games: cannot read src/data/games.json: ${err.message}`)
    process.exit(1)
  }

  const errors = validateGames(games, REPO_ROOT)
  if (errors.length > 0) {
    for (const e of errors) console.error(e)
    console.error(`validate-games: ${errors.length} error(s)`)
    process.exit(1)
  }
  for (const g of games) {
    if (g?.engine !== 'html5') continue
    const report = scanHtml5Folder(REPO_ROOT, g.id)
    console.log(
      `validate-games: html5 ${g.id}: ${report.files} files, ${(report.bytes / (1024 * 1024)).toFixed(2)} MiB`,
    )
  }
  console.log(`validate-games: ${games.length} entries OK`)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
