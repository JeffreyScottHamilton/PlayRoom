// Promotes a reviewed draft from src/data/games.import.json into the live manifest
// src/data/games.json. Runs the same rules as scripts/validate-games.mjs and refuses
// if promotion would introduce any new validation error.
//
// Usage: node scripts/promote-game.mjs <id> --compat=verified|partial
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DRAFT_META_KEYS,
  DRAFTS_REL,
  GAME_FIELDS,
  LIVE_MANIFEST_REL,
  REPO_ROOT,
  readJsonArray,
  writeJsonArray,
} from './import-games.mjs'
import { validateGames } from './validate-games.mjs'

const PROMOTABLE = ['verified', 'partial']

/**
 * Moves draft `id` into the live manifest with compatibility set to `compat`.
 * Returns { ok: true, entry } or { ok: false, errors: string[] }.
 * Nothing is written unless every check passes.
 */
export function promoteGame({ id, compat, root = REPO_ROOT }) {
  if (!PROMOTABLE.includes(compat)) {
    return { ok: false, errors: [`--compat must be one of ${PROMOTABLE.join(', ')}`] }
  }

  const draftsPath = join(root, DRAFTS_REL)
  const livePath = join(root, LIVE_MANIFEST_REL)
  const drafts = readJsonArray(draftsPath)
  const draft = drafts.find((d) => d?.id === id)
  if (!draft) return { ok: false, errors: [`no draft "${id}" in ${DRAFTS_REL}`] }

  const live = readJsonArray(livePath)
  if (live.some((g) => g?.id === id)) {
    return { ok: false, errors: [`"${id}" is already live in ${LIVE_MANIFEST_REL}`] }
  }

  const entry = {}
  for (const [key, value] of Object.entries(draft)) {
    if (GAME_FIELDS.includes(key) && !DRAFT_META_KEYS.includes(key)) entry[key] = value
  }
  entry.compatibility = compat

  // Only problems introduced by this entry block promotion; pre-existing problems are not ours to fix here.
  const before = validateGames(live, { root })
  const after = validateGames([...live, entry], { root })
  const introduced = after.filter((e) => !before.includes(e))
  if (introduced.length > 0) return { ok: false, errors: introduced }

  writeJsonArray(livePath, [...live, entry])
  writeJsonArray(
    draftsPath,
    drafts.filter((d) => d?.id !== id),
  )
  return { ok: true, entry }
}

function main(argv) {
  const positional = []
  const unknown = []
  let compat
  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--compat') compat = args[++i]
    else if (arg.startsWith('--compat=')) compat = arg.slice('--compat='.length)
    else if (arg.startsWith('--')) unknown.push(arg)
    else positional.push(arg)
  }
  if (positional.length !== 1 || unknown.length > 0 || compat === undefined) {
    console.error('usage: node scripts/promote-game.mjs <id> --compat=verified|partial')
    process.exit(1)
  }

  const id = positional[0]
  let result
  try {
    result = promoteGame({ id, compat })
  } catch (err) {
    console.error(`promote-game: ${err.message}`)
    process.exit(1)
  }
  if (!result.ok) {
    for (const e of result.errors) console.error(`${id}: ${e}`)
    console.error('promote-game: not promoted')
    process.exit(1)
  }
  console.log(`promote-game: ${id} moved to ${LIVE_MANIFEST_REL} (compatibility: ${compat})`)
  process.exit(0)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main(process.argv)
}
