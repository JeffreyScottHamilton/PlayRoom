// Import workflow (ARCHITECTURE §8). Scans a folder of game files, parses SWF headers,
// flags duplicates and missing metadata, copies files, and writes DRAFT entries to
// src/data/games.import.json. Drafts are never written to the live manifest
// (src/data/games.json); promotion is done by scripts/promote-game.mjs.
//
// HTML5 game folders (a sub-folder with a top-level index.html) are copied whole to
// public/games/<id>/html/ with engine "html5" (ARCHITECTURE §13).
//
// Usage: node scripts/import-games.mjs <dir|zip-extracted-dir> [--dry-run]
// Node stdlib only. Exit 0 after printing the table; exit 1 on an unreadable input dir.
import { createHash } from 'node:crypto'
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HTML5_ENTRY,
  HTML5_SUBDIR,
  copyHtml5Files,
  findHtml5Folders,
  hashHtml5Folder,
  html5Flags,
  html5SidecarPath,
  inspectHtml5Folder,
  assertSafeCopy,
} from './lib/html5.mjs'
import { parseSwfHeader } from './lib/swf.mjs'
import { readCategories } from './validate-games.mjs'

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const LIVE_MANIFEST_REL = join('src', 'data', 'games.json')
export const DRAFTS_REL = join('src', 'data', 'games.import.json')
export const GAMES_DIR_REL = join('public', 'games')

// Game fields a draft or sidecar may carry (src/types/game.ts).
export const GAME_FIELDS = [
  'id', 'title', 'description', 'category', 'thumbnail', 'gameFile', 'controls',
  'developer', 'releaseYear', 'compatibility', 'addedAt', 'license', 'width', 'height',
  'needsKeyboard', 'popularRank', 'featured', 'engine', 'responsive',
]
// Import-only keys stored on drafts; stripped when promoting.
export const DRAFT_META_KEYS = ['missing', 'flags', 'sha256']
const IGNORED_SIDECAR_FIELDS = {
  gameFile: 'set by the import (game.swf)',
  thumbnail: 'set by the import (thumbnail image)',
  compatibility: 'forced to "unsupported" on import; promotion sets it',
  addedAt: 'set to today for new drafts',
}

const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg'])
const SWF_MAGIC = ['FWS', 'CWS', 'ZWS']

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const isPositiveInt = (v) => Number.isInteger(v) && v > 0

/** Kebab-case ASCII slug. Returns '' when nothing usable remains. */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Same rules as src/lib/search.ts normalize(): lowercase, no diacritics/punctuation, single spaces. */
export function normalizeTitle(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

export function readJsonArray(path) {
  if (!existsSync(path)) return []
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`)
  return parsed
}

export function writeJsonArray(path, entries) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`)
}

// Symlinks are neither directories nor files here, so they are never followed. `skip` holds
// html5 game folders, whose files are handled by the html5 path instead.
function walk(dir, out = [], skip = null) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) {
      if (!skip?.has(full)) walk(full, out, skip)
    } else if (ent.isFile()) out.push(full)
  }
  return out
}

function readHeadMagic(file) {
  const fd = openSync(file, 'r')
  try {
    const head = Buffer.alloc(3)
    const n = readSync(fd, head, 0, 3, 0)
    return head.toString('latin1', 0, n)
  } finally {
    closeSync(fd)
  }
}

function classify(file) {
  const ext = extname(file).toLowerCase()
  if (ext === '.swf') return 'swf'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (ext === '.json') return 'sidecar'
  return SWF_MAGIC.includes(readHeadMagic(file)) ? 'swf' : 'other'
}

// Groups files by directory + basename so game.swf / game.png / game.json pair up.
function groupFiles(files) {
  const groups = new Map()
  const ignored = []
  const groupFor = (file) => {
    const key = join(dirname(file), basename(file, extname(file)))
    if (!groups.has(key)) groups.set(key, { swfs: [], images: [], sidecars: [] })
    return groups.get(key)
  }
  for (const file of files) {
    const kind = classify(file)
    if (kind === 'swf') groupFor(file).swfs.push(file)
    else if (kind === 'image') groupFor(file).images.push(file)
    else if (kind === 'sidecar') groupFor(file).sidecars.push(file)
    else ignored.push(file)
  }
  return { groups, ignored }
}

function scanPublishedHtml5(root) {
  const dir = join(root, GAMES_DIR_REL)
  if (!existsSync(dir)) return []
  const out = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    const htmlDir = join(dir, ent.name, HTML5_SUBDIR)
    if (!existsSync(join(htmlDir, HTML5_ENTRY))) continue
    out.push({ id: ent.name, sha: hashHtml5Folder(htmlDir) })
  }
  return out
}

function scanPublishedSwfs(root) {
  const dir = join(root, GAMES_DIR_REL)
  if (!existsSync(dir)) return []
  const out = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    const swf = join(dir, ent.name, 'game.swf')
    if (existsSync(swf)) out.push({ id: ent.name, sha: sha256(readFileSync(swf)) })
  }
  return out
}

/** Reads and sanitises a sidecar. Returns { fields, flags }; never throws. */
function readSidecar(path, validCategories) {
  const flags = []
  if (!path) return { fields: {}, flags }
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    flags.push(`sidecar unreadable: ${err.message}`)
    return { fields: {}, flags }
  }
  if (!isPlainObject(raw)) {
    flags.push('sidecar must be a JSON object')
    return { fields: {}, flags }
  }
  const fields = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key in IGNORED_SIDECAR_FIELDS) {
      flags.push(`sidecar "${key}" ignored (${IGNORED_SIDECAR_FIELDS[key]})`)
    } else if (!GAME_FIELDS.includes(key)) {
      flags.push(`unknown sidecar field "${key}" ignored`)
    } else if (key === 'category') {
      const kept = []
      for (const c of Array.isArray(value) ? value : [value]) {
        if (validCategories.includes(c)) kept.push(c)
        else flags.push(`invalid category "${c}" in sidecar`)
      }
      if (kept.length > 0) fields.category = kept
    } else if (key === 'license') {
      if (isPlainObject(value)) {
        const license = {}
        for (const k of ['type', 'source', 'notes']) {
          if (typeof value[k] === 'string') license[k] = value[k]
        }
        fields.license = license
      } else {
        flags.push('sidecar "license" must be an object')
      }
    } else {
      fields[key] = value
    }
  }
  return { fields, flags }
}

function computeMissing(draft, hasImageInBatch, root) {
  const missing = []
  if (!isNonEmptyString(draft.title)) missing.push('title')
  if (!isNonEmptyString(draft.description)) missing.push('description')
  if (!Array.isArray(draft.category) || draft.category.length === 0) missing.push('category')
  if (!isNonEmptyString(draft.controls)) missing.push('controls')
  if (!isNonEmptyString(draft.license?.type)) missing.push('license.type')
  if (!isNonEmptyString(draft.license?.source)) missing.push('license.source')
  const thumbPresent =
    hasImageInBatch || (isNonEmptyString(draft.thumbnail) && existsSync(join(root, 'public', draft.thumbnail)))
  if (!thumbPresent) missing.push('thumbnail')
  // A responsive html5 game has no intended size (ARCHITECTURE §13).
  if (draft.responsive !== true) {
    if (!isPositiveInt(draft.width)) missing.push('width')
    if (!isPositiveInt(draft.height)) missing.push('height')
  }
  return missing
}

/**
 * Runs the import. With dryRun the plan is computed and the table is returned, but
 * nothing is copied or written. Returns { exitCode, error?, rows, ignored, dryRun, copied, draftsWritten }.
 */
export function runImport({ inputDir, root = REPO_ROOT, dryRun = false, today = isoToday() }) {
  const fail = (error) => ({ exitCode: 1, error, rows: [], ignored: [], dryRun, copied: 0, draftsWritten: false })

  let files
  let html5Folders
  try {
    if (!statSync(inputDir).isDirectory()) throw new Error('not a directory')
    html5Folders = findHtml5Folders(inputDir)
    files = walk(inputDir, [], new Set(html5Folders)).sort()
  } catch (err) {
    return fail(`cannot read input directory ${inputDir}: ${err.message}`)
  }

  let live
  let drafts
  try {
    live = readJsonArray(join(root, LIVE_MANIFEST_REL))
    drafts = readJsonArray(join(root, DRAFTS_REL))
  } catch (err) {
    return fail(err.message)
  }

  const validCategories = readCategories(REPO_ROOT)
  const liveIds = new Set(live.map((g) => g?.id))
  const liveTitles = live.map((g) => ({ id: g?.id, norm: normalizeTitle(g?.title) }))
  const draftTitles = drafts.map((d) => ({ id: d?.id, norm: normalizeTitle(d?.title) }))
  const draftById = new Map(drafts.map((d) => [d?.id, d]))
  const published = scanPublishedSwfs(root)
  const batchSha = new Map()
  const batchSlugs = new Set()
  const batchTitles = []
  const planned = []
  const rows = []

  const { groups, ignored } = groupFiles(files)
  const candidates = []
  for (const [key, group] of groups) {
    for (const swf of group.swfs) candidates.push({ swf, group, stem: basename(key) })
  }
  candidates.sort((a, b) => a.swf.localeCompare(b.swf))

  for (const { swf, group, stem } of candidates) {
    const rel = relative(inputDir, swf).split(sep).join('/')
    const row = { file: rel, slug: '-', size: 0, swf: '-', stage: '-', duplicates: '', missing: [], flags: [], action: '' }
    rows.push(row)

    let buf
    try {
      buf = readFileSync(swf)
    } catch (err) {
      row.action = 'skip: unreadable'
      row.flags.push(err.message)
      continue
    }
    row.size = buf.length

    let header
    try {
      header = parseSwfHeader(buf)
    } catch (err) {
      row.action = 'skip: not a valid SWF'
      row.flags.push(err.message)
      continue
    }
    row.swf = `${header.signature} v${header.version}`
    row.stage = header.width ? `${header.width}x${header.height}` : 'unknown'
    if (header.needsReview) {
      row.flags.push('needs-review: ZWS (LZMA) is not parsed; set width/height in the sidecar')
    }

    const hash = sha256(buf)
    const imageFile = group.images.find((p) => p.toLowerCase().endsWith('.webp')) ?? group.images[0]
    const { fields, flags: sidecarFlags } = readSidecar(group.sidecars[0], validCategories)
    row.flags.push(...sidecarFlags)
    if (fields.engine !== undefined) {
      delete fields.engine
      row.flags.push('sidecar "engine" ignored (SWF games are flash)')
    }
    if (fields.responsive !== undefined) {
      delete fields.responsive
      row.flags.push('sidecar "responsive" ignored (SWF games are flash)')
    }

    const slugSource = typeof fields.id === 'string' && fields.id ? fields.id : (fields.title ?? stem)
    const slug = slugify(slugSource)
    if (!slug) {
      row.action = 'skip: no usable slug'
      continue
    }
    row.slug = slug
    if (slug !== slugSource.toLowerCase()) row.flags.push(`slug normalised from "${slugSource}" to "${slug}"`)

    // Duplicate detection: published binaries (other slugs), other drafts, earlier files in this batch.
    const pubDup = published.find((p) => p.sha === hash && p.id !== slug)
    const draftDup = drafts.find((d) => d?.sha256 === hash && d.id !== slug)
    if (pubDup) row.duplicates = `public/games/${pubDup.id}/game.swf`
    else if (draftDup) row.duplicates = `draft ${draftDup.id}`
    else if (batchSha.has(hash)) row.duplicates = `batch ${batchSha.get(hash)}`

    if (liveIds.has(slug)) {
      row.action = 'skip: live entry exists'
      row.flags.push(`games.json already has "${slug}"; live entries are never overwritten`)
      continue
    }
    if (batchSlugs.has(slug)) {
      row.action = 'skip: slug used earlier in batch'
      continue
    }
    if (row.duplicates) {
      row.action = 'skip: duplicate binary'
      continue
    }
    const destSwf = join(root, GAMES_DIR_REL, slug, 'game.swf')
    if (existsSync(destSwf) && sha256(readFileSync(destSwf)) !== hash) {
      row.action = 'skip: destination has a different game.swf'
      continue
    }

    // Merge by id: existing draft fields survive unless the sidecar or SWF header supplies them.
    const existing = draftById.get(slug)
    const draft = {}
    if (existing) {
      for (const [k, v] of Object.entries(existing)) if (!DRAFT_META_KEYS.includes(k)) draft[k] = v
    }
    Object.assign(draft, fields)
    draft.id = slug
    draft.gameFile = `/games/${slug}/game.swf`
    if (imageFile) {
      const ext = extname(imageFile).toLowerCase()
      draft.thumbnail = `/games/${slug}/thumb${ext}`
      if (ext !== '.webp') row.flags.push('convert to webp (copied as-is)')
    } else if (!draft.thumbnail) {
      draft.thumbnail = `/games/${slug}/thumb.webp`
    }
    if (header.width) {
      if (fields.width !== undefined && (fields.width !== header.width || fields.height !== header.height)) {
        row.flags.push('sidecar stage size differs from SWF header; header used')
      }
      draft.width = header.width
      draft.height = header.height
    }
    draft.compatibility = 'unsupported'
    draft.addedAt = existing?.addedAt ?? today
    if (draft.needsKeyboard === undefined) {
      draft.needsKeyboard = true
      row.flags.push('needsKeyboard defaulted — verify')
    }

    const norm = normalizeTitle(draft.title)
    if (norm) {
      const titleDup =
        liveTitles.find((t) => t.id !== slug && t.norm === norm) ??
        draftTitles.find((t) => t.id !== slug && t.norm === norm) ??
        batchTitles.find((t) => t.id !== slug && t.norm === norm)
      if (titleDup) row.flags.push(`possible duplicate title of "${titleDup.id}"`)
      batchTitles.push({ id: slug, norm })
    }

    draft.missing = computeMissing(draft, Boolean(imageFile), root)
    draft.flags = row.flags
    draft.sha256 = hash
    row.missing = draft.missing

    batchSlugs.add(slug)
    batchSha.set(hash, rel)
    row.action = existing ? 'update draft' : 'draft'
    planned.push({ draft, swf, thumb: imageFile ?? null, folder: null })
  }

  // HTML5 game folders (ARCHITECTURE §13). Each folder is one candidate. Its files were kept
  // out of the SWF scan above, and nothing is copied until the plan is complete.
  const publishedHtml5 = html5Folders.length > 0 ? scanPublishedHtml5(root) : []
  const batchHtml5 = new Map()
  for (const folder of html5Folders) {
    const rel = `${relative(inputDir, folder).split(sep).join('/')}/`
    const row = { file: rel, slug: '-', size: 0, swf: 'html5', stage: 'unknown', duplicates: '', missing: [], flags: [], action: '' }
    rows.push(row)

    let insp
    try {
      insp = inspectHtml5Folder(folder)
    } catch (err) {
      row.action = 'skip: unreadable'
      row.flags.push(err.message)
      continue
    }
    row.size = insp.bytes
    for (const s of insp.skipped) row.flags.push(`skipped ${s.reason}: ${s.rel}`)

    const { fields, flags: sidecarFlags } = readSidecar(html5SidecarPath(folder), validCategories)
    row.flags.push(...sidecarFlags)
    if (fields.engine !== undefined) {
      if (fields.engine !== 'html5') row.flags.push(`sidecar "engine" ignored (folder is html5)`)
      delete fields.engine
    }
    if (fields.responsive !== undefined && typeof fields.responsive !== 'boolean') {
      row.flags.push('sidecar "responsive" must be true or false; ignored')
      delete fields.responsive
    }
    if (fields.responsive === true && (fields.width !== undefined || fields.height !== undefined)) {
      row.flags.push('sidecar width/height ignored (responsive game has no size)')
      delete fields.width
      delete fields.height
    }

    const slugSource = typeof fields.id === 'string' && fields.id ? fields.id : (fields.title ?? basename(folder))
    const slug = slugify(slugSource)
    if (!slug) {
      row.action = 'skip: no usable slug'
      continue
    }
    row.slug = slug
    if (slug !== String(slugSource).toLowerCase()) row.flags.push(`slug normalised from "${slugSource}" to "${slug}"`)

    const destHtml = join(root, GAMES_DIR_REL, slug, HTML5_SUBDIR)
    try {
      assertSafeCopy(folder, insp.files, destHtml)
    } catch (err) {
      row.action = 'skip: unsafe path'
      row.flags.push(err.message)
      continue
    }

    const hash = insp.sha256
    const pubDup = publishedHtml5.find((p) => p.sha === hash && p.id !== slug)
    const draftDup = drafts.find((d) => d?.engine === 'html5' && d?.sha256 === hash && d.id !== slug)
    if (pubDup) row.duplicates = `public/games/${pubDup.id}/${HTML5_SUBDIR}`
    else if (draftDup) row.duplicates = `draft ${draftDup.id}`
    else if (batchHtml5.has(hash)) row.duplicates = `batch ${batchHtml5.get(hash)}`

    if (liveIds.has(slug)) {
      row.action = 'skip: live entry exists'
      row.flags.push(`games.json already has "${slug}"; live entries are never overwritten`)
      continue
    }
    if (batchSlugs.has(slug)) {
      row.action = 'skip: slug used earlier in batch'
      continue
    }
    if (row.duplicates) {
      row.action = 'skip: duplicate folder'
      continue
    }
    if (existsSync(join(destHtml, HTML5_ENTRY)) && hashHtml5Folder(destHtml) !== hash) {
      row.action = 'skip: destination has a different html folder'
      continue
    }

    const existing = draftById.get(slug)
    const draft = {}
    if (existing) {
      for (const [k, v] of Object.entries(existing)) if (!DRAFT_META_KEYS.includes(k)) draft[k] = v
    }
    Object.assign(draft, fields)
    draft.id = slug
    draft.engine = 'html5'
    if (draft.responsive === true) {
      // An earlier draft may still carry a size from before the sidecar became responsive.
      delete draft.width
      delete draft.height
    }
    draft.gameFile = `/games/${slug}/${HTML5_SUBDIR}/${HTML5_ENTRY}`
    // Thumbnail: an image next to the folder with the same base name (folder.webp, folder.png, ...).
    const group = groups.get(join(dirname(folder), basename(folder)))
    const imageFile = group?.images.find((p) => p.toLowerCase().endsWith('.webp')) ?? group?.images[0]
    if (imageFile) {
      const ext = extname(imageFile).toLowerCase()
      draft.thumbnail = `/games/${slug}/thumb${ext}`
      if (ext !== '.webp') row.flags.push('convert to webp (copied as-is)')
    } else if (!draft.thumbnail) {
      draft.thumbnail = `/games/${slug}/thumb.webp`
    }
    draft.compatibility = 'unsupported'
    draft.addedAt = existing?.addedAt ?? today
    if (draft.needsKeyboard === undefined) {
      draft.needsKeyboard = true
      row.flags.push('needsKeyboard defaulted — verify')
    }
    const responsive = draft.responsive === true
    const sizeFlags = html5Flags(insp, { width: draft.width, height: draft.height })
    // A responsive game is not missing a size, so drop the missing-size flag.
    row.flags.push(...(responsive ? sizeFlags.filter((f) => !f.startsWith('missing-size')) : sizeFlags))
    if (responsive) row.stage = 'responsive'
    else row.stage = isPositiveInt(draft.width) && isPositiveInt(draft.height) ? `${draft.width}x${draft.height}` : 'unknown'

    const norm = normalizeTitle(draft.title)
    if (norm) {
      const titleDup =
        liveTitles.find((t) => t.id !== slug && t.norm === norm) ??
        draftTitles.find((t) => t.id !== slug && t.norm === norm) ??
        batchTitles.find((t) => t.id !== slug && t.norm === norm)
      if (titleDup) row.flags.push(`possible duplicate title of "${titleDup.id}"`)
      batchTitles.push({ id: slug, norm })
    }

    draft.missing = computeMissing(draft, Boolean(imageFile), root)
    draft.flags = row.flags
    draft.sha256 = hash
    row.missing = draft.missing

    batchSlugs.add(slug)
    batchHtml5.set(hash, rel)
    row.action = existing ? 'update draft' : 'draft'
    planned.push({ draft, swf: null, thumb: imageFile ?? null, folder, files: insp.files, destHtml })
  }

  let copied = 0
  let draftsWritten = false
  if (!dryRun && planned.length > 0) {
    const nextDrafts = [...drafts]
    for (const { draft, swf, thumb, folder, files, destHtml } of planned) {
      const destDir = join(root, GAMES_DIR_REL, draft.id)
      mkdirSync(destDir, { recursive: true })
      if (folder) copyHtml5Files(folder, files, destHtml)
      else copyFileSync(swf, join(destDir, 'game.swf'))
      if (thumb) copyFileSync(thumb, join(destDir, `thumb${extname(thumb).toLowerCase()}`))
      copied++
      const idx = nextDrafts.findIndex((d) => d?.id === draft.id)
      if (idx >= 0) nextDrafts[idx] = draft
      else nextDrafts.push(draft)
    }
    writeJsonArray(join(root, DRAFTS_REL), nextDrafts)
    draftsWritten = true
  }

  return {
    exitCode: 0,
    rows,
    ignored: ignored.map((f) => relative(inputDir, f).split(sep).join('/')),
    dryRun,
    copied,
    draftsWritten,
  }
}

/** Fixed-width table: file, slug, size, swf version, stage size, duplicates, missing, action; flags below each row. */
export function formatReport(result) {
  if (result.error) return `import-games: ${result.error}`
  const header = ['File', 'Slug', 'Size', 'SWF', 'Stage', 'Duplicates', 'Missing', 'Action']
  const cells = result.rows.map((r) => [
    r.file,
    r.slug,
    `${r.size} B`,
    r.swf,
    r.stage,
    r.duplicates || '-',
    r.missing.length ? r.missing.join(', ') : '-',
    r.action,
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i].length)))
  const line = (row) => row.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()
  const out = [line(header), line(widths.map((w) => '-'.repeat(w)))]
  result.rows.forEach((r, i) => {
    out.push(line(cells[i]))
    for (const f of r.flags) out.push(`    ! ${f}`)
  })
  if (result.rows.length === 0) out.push('(no SWF files or html5 game folders found)')
  for (const f of result.ignored) out.push(`ignored: ${f}`)
  const drafted = result.rows.filter((r) => r.action === 'draft' || r.action === 'update draft').length
  out.push('')
  out.push(`${result.rows.length} game candidate(s): ${drafted} draft(s), ${result.rows.length - drafted} skipped.`)
  out.push(
    result.dryRun
      ? 'Dry run: nothing was copied or written.'
      : `Copied ${result.copied} game(s) to public/games/; drafts written to ${DRAFTS_REL}.`,
  )
  return out.join('\n')
}

function main(argv) {
  const args = argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const unknown = args.filter((a) => a.startsWith('--') && a !== '--dry-run')
  const positional = args.filter((a) => !a.startsWith('--'))
  if (positional.length !== 1 || unknown.length > 0) {
    console.error('usage: node scripts/import-games.mjs <dir|zip-extracted-dir> [--dry-run]')
    process.exit(1)
  }
  const result = runImport({ inputDir: resolve(positional[0]), dryRun })
  console.log(formatReport(result))
  process.exit(result.exitCode)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main(process.argv)
}
