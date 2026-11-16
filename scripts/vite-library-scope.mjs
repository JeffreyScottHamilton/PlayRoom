// Build-time library scope for the Vite bundle. Runs under Node (vite.config.ts and
// postbuild-pages.mjs), so it is plain JS. It mirrors isOwnerAsserted() in
// src/data/catalog.ts; scripts/__tests__/vite-library-scope.test.mjs checks that the two agree.
//
// With VITE_LIBRARY=open the games.json module is rewritten before it is bundled, so
// owner-asserted entries (and any featured/popularRank they carry) never reach dist/assets.

const SCOPES = ['all', 'open']

/** True when the licence is a permission asserted by the owner rather than an open licence. */
export function isOwnerAssertedEntry(game) {
  if (typeof game?.license?.type !== 'string') {
    throw new Error(`manifest entry "${String(game?.id)}" has no license.type`)
  }
  return game.license.type.startsWith('Owner-asserted')
}

/** "open" drops owner-asserted entries; "all" keeps every entry. Pure; returns a new array. */
export function filterManifestByScope(games, scope) {
  if (!SCOPES.includes(scope)) {
    throw new Error(`VITE_LIBRARY must be "all" or "open", got "${String(scope)}"`)
  }
  if (!Array.isArray(games)) throw new Error('games manifest must be an array')
  return scope === 'open' ? games.filter((g) => !isOwnerAssertedEntry(g)) : [...games]
}

const MANIFEST_SUFFIX = '/src/data/games.json'

/** True when a Vite module id is the games manifest (query strings ignored). */
export function isManifestId(id) {
  return String(id).split('?')[0].replace(/\\/g, '/').endsWith(MANIFEST_SUFFIX)
}

/**
 * Vite plugin. In the "all" scope it does nothing. In the "open" scope it rewrites the
 * games.json module before Vite's JSON transform runs (enforce: 'pre').
 */
export function libraryScopePlugin({ scope }) {
  return {
    name: 'playroom-library-scope',
    enforce: 'pre',
    transform(code, id) {
      if (scope !== 'open' || !isManifestId(id)) return null
      const kept = filterManifestByScope(JSON.parse(code), 'open')
      return { code: `${JSON.stringify(kept, null, 2)}\n`, map: null }
    },
  }
}
