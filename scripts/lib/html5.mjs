// HTML5 game folders for the import tooling (ARCHITECTURE §13, Import). Node stdlib only.
//
// A candidate is a sub-folder of the input directory whose top level holds index.html.
// Inspection never follows symlinks and skips dotfiles, node_modules and .git. Copies are
// checked so that no destination path can resolve outside the target folder.
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const HTML5_ENTRY = 'index.html'
export const HTML5_SUBDIR = 'html'
export const MAX_FILE_BYTES = 25 * 1024 * 1024
// Text files scanned for external hosts and iframe-breakout references.
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.css'])
const HOST_RE = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)/gi
const BREAKOUT_RE = /\b(?:top|parent)\.location\b|\bwindow\.top\b/

export class Html5Error extends Error {
  constructor(message) {
    super(message)
    this.name = 'Html5Error'
  }
}

const isPositiveInt = (v) => Number.isInteger(v) && v > 0

function isRegularFile(path) {
  try {
    const st = lstatSync(path)
    return st.isFile() && !st.isSymbolicLink()
  } catch {
    return false
  }
}

/** Names never copied or descended into: dotfiles (including .git) and node_modules. */
export function isExcludedName(name) {
  return name.startsWith('.') || name === 'node_modules'
}

/** True when a relative, '/'-separated path has no empty, '.', '..' or absolute parts. */
export function isSafeRelPath(rel) {
  if (typeof rel !== 'string' || rel === '' || isAbsolute(rel) || rel.includes('\0') || rel.includes('\\')) return false
  return rel.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

/** True when `child` is strictly inside `parent` (both already resolved). */
export function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/**
 * Sub-folders of inputDir (any depth) whose top level contains index.html. Does not descend
 * into a candidate, never follows symlinks, and never treats inputDir itself as a candidate.
 */
export function findHtml5Folders(inputDir) {
  const found = []
  const visit = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory() || isExcludedName(ent.name)) continue
      const full = join(dir, ent.name)
      if (isRegularFile(join(full, HTML5_ENTRY))) found.push(full)
      else visit(full)
    }
  }
  visit(inputDir)
  return found.sort()
}

const byRel = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)

/**
 * Lists the files that would be copied: regular files only, sorted by relative path.
 * `skipped` reports every dotfile, node_modules entry, symlink or unsafe name, once per entry.
 */
export function listFolderFiles(folder) {
  const files = []
  const skipped = []
  const visit = (dir, prefix) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name
      const full = join(dir, ent.name)
      if (isExcludedName(ent.name)) {
        skipped.push({ rel, reason: ent.name === 'node_modules' ? 'node_modules' : 'dotfile' })
      } else if (ent.isSymbolicLink()) {
        skipped.push({ rel, reason: 'symlink' })
      } else if (!isSafeRelPath(rel)) {
        skipped.push({ rel, reason: 'unsafe name' })
      } else if (ent.isDirectory()) {
        visit(full, rel)
      } else if (ent.isFile()) {
        files.push({ rel, abs: full, size: lstatSync(full).size })
      } else {
        skipped.push({ rel, reason: 'not a regular file' })
      }
    }
  }
  visit(folder, '')
  files.sort(byRel)
  return { files, skipped }
}

/** sha256 over sorted relative paths and contents (length-prefixed, so names cannot blur into data). */
export function folderSha256(files) {
  const h = createHash('sha256')
  for (const f of [...files].sort(byRel)) {
    h.update(`${f.rel}\0${f.size}\0`)
    h.update(readFileSync(f.abs))
    h.update('\0')
  }
  return h.digest('hex')
}

/** Hash of a published or candidate folder using the same file rules as the copy. */
export function hashHtml5Folder(folder) {
  return folderSha256(listFolderFiles(folder).files)
}

/**
 * Full inspection of a candidate folder: files to copy, skipped entries, total bytes, folder
 * hash, distinct external http(s) hosts, files over the size limit, and iframe-breakout files.
 */
export function inspectHtml5Folder(folder) {
  const { files, skipped } = listFolderFiles(folder)
  let bytes = 0
  const hosts = new Set()
  const largeFiles = []
  const breakoutFiles = []
  for (const f of files) {
    bytes += f.size
    if (f.size > MAX_FILE_BYTES) largeFiles.push({ rel: f.rel, size: f.size })
    if (TEXT_EXT.has(extname(f.rel).toLowerCase())) {
      const text = readFileSync(f.abs, 'utf8')
      for (const m of text.matchAll(HOST_RE)) hosts.add(m[1].toLowerCase())
      if (BREAKOUT_RE.test(text)) breakoutFiles.push(f.rel)
    }
  }
  return {
    files,
    skipped,
    bytes,
    sha256: folderSha256(files),
    externalHosts: [...hosts].sort(),
    largeFiles,
    breakoutFiles,
  }
}

/** Flags for an inspected folder. `size` is the draft's width/height after merging the sidecar. */
export function html5Flags(insp, size) {
  const flags = []
  if (insp.externalHosts.length > 0) {
    flags.push(`external-requests: ${insp.externalHosts.join(', ')} (the game may break offline or phone home)`)
  }
  if (!isPositiveInt(size?.width) || !isPositiveInt(size?.height)) {
    flags.push('missing-size: sidecar has no width/height')
  }
  for (const f of insp.largeFiles) {
    flags.push(`large-file: ${f.rel} is ${(f.size / (1024 * 1024)).toFixed(1)} MiB (over 25 MiB)`)
  }
  if (insp.breakoutFiles.length > 0) {
    flags.push(
      `inline-iframe-breakout (informational): ${insp.breakoutFiles.join(', ')} reference top/parent location; the sandbox blocks this`,
    )
  }
  return flags
}

/** Sidecar for a folder: `<folder>.json` next to it, else `game.json` inside it. */
export function html5SidecarPath(folder) {
  const sibling = `${folder}.json`
  if (isRegularFile(sibling)) return sibling
  const inner = join(folder, 'game.json')
  return isRegularFile(inner) ? inner : undefined
}

/**
 * Throws Html5Error unless every file can be copied to destDir: safe relative name, target
 * inside destDir, regular non-symlink source whose real path stays inside folder, and no
 * symlink already sitting at the target.
 */
export function assertSafeCopy(folder, files, destDir) {
  const realFolder = realpathSync(folder)
  const realDest = resolve(destDir)
  for (const f of files) {
    if (!isSafeRelPath(f.rel)) throw new Html5Error(`unsafe path "${f.rel}"`)
    const target = resolve(realDest, f.rel)
    if (!isInside(realDest, target)) throw new Html5Error(`path escapes the destination: "${f.rel}"`)
    const st = lstatSync(f.abs)
    if (st.isSymbolicLink() || !st.isFile()) throw new Html5Error(`not a regular file: "${f.rel}"`)
    if (!isInside(realFolder, realpathSync(f.abs))) throw new Html5Error(`"${f.rel}" resolves outside the game folder`)
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
      throw new Html5Error(`destination is a symlink: "${f.rel}"`)
    }
  }
}

/** Copies the inspected files into destDir after assertSafeCopy has passed. Returns the file count. */
export function copyHtml5Files(folder, files, destDir) {
  assertSafeCopy(folder, files, destDir)
  for (const f of files) {
    const target = resolve(destDir, f.rel)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(f.abs, target)
  }
  return files.length
}
