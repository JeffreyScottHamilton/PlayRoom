import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { filterByScope, isOwnerAsserted } from '../../src/data/catalog.ts'
import {
  filterManifestByScope,
  isManifestId,
  isOwnerAssertedEntry,
  libraryScopePlugin,
} from '../vite-library-scope.mjs'

const OPEN = { id: 'open-one', title: 'Open', license: { type: 'MIT', source: 'https://example.com' } }
const OWNED = {
  id: 'owned-one',
  title: 'Owned',
  featured: true,
  popularRank: 1,
  license: { type: 'Owner-asserted permission (proof of concept)', source: 'doc' },
}
const OWNED_BARE = { id: 'owned-bare', license: { type: 'Owner-asserted', source: 'doc' } }
const DEV = { id: 'dev-permission', license: { type: 'Developer permission', source: 'https://example.com' } }
const ALL = [OPEN, OWNED, OWNED_BARE, DEV]

describe('isOwnerAssertedEntry', () => {
  it('matches license types that start with Owner-asserted only', () => {
    expect(isOwnerAssertedEntry(OWNED)).toBe(true)
    expect(isOwnerAssertedEntry(OWNED_BARE)).toBe(true)
    expect(isOwnerAssertedEntry(OPEN)).toBe(false)
    expect(isOwnerAssertedEntry(DEV)).toBe(false)
  })

  it('throws when the licence type is missing so the build fails closed', () => {
    expect(() => isOwnerAssertedEntry({ id: 'no-license' })).toThrow(/no license\.type/)
  })
})

describe('filterManifestByScope', () => {
  it('keeps every entry in the all scope and returns a new array', () => {
    const out = filterManifestByScope(ALL, 'all')
    expect(out).toEqual(ALL)
    expect(out).not.toBe(ALL)
  })

  it('drops owner-asserted entries, with their featured and popularRank, in the open scope', () => {
    expect(filterManifestByScope(ALL, 'open').map((g) => g.id)).toEqual(['open-one', 'dev-permission'])
  })

  it('rejects an unknown scope', () => {
    expect(() => filterManifestByScope(ALL, 'opne')).toThrow(/VITE_LIBRARY/)
  })
})

describe('isManifestId', () => {
  it('matches the games.json module id with or without a query string', () => {
    expect(isManifestId('/home/u/PlayRoom/src/data/games.json')).toBe(true)
    expect(isManifestId('C:\\repo\\src\\data\\games.json?import')).toBe(true)
    expect(isManifestId('/home/u/PlayRoom/src/data/games.import.json')).toBe(false)
    expect(isManifestId('/home/u/PlayRoom/public/games/x/games.json')).toBe(false)
  })
})

describe('libraryScopePlugin', () => {
  const id = '/repo/src/data/games.json'
  const code = JSON.stringify(ALL)
  const transform = (plugin, src, moduleId) => plugin.transform(src, moduleId)

  it('runs before Vite JSON handling', () => {
    expect(libraryScopePlugin({ scope: 'open' }).enforce).toBe('pre')
  })

  it('rewrites the manifest module in the open scope', () => {
    const out = transform(libraryScopePlugin({ scope: 'open' }), code, id)
    const kept = JSON.parse(out.code)
    expect(kept.map((g) => g.id)).toEqual(['open-one', 'dev-permission'])
    expect(out.code).not.toMatch(/owned-one|Owner-asserted|featured|popularRank/)
  })

  it('leaves the manifest untouched in the all scope', () => {
    expect(transform(libraryScopePlugin({ scope: 'all' }), code, id)).toBeNull()
  })

  it('leaves other modules untouched in the open scope', () => {
    expect(transform(libraryScopePlugin({ scope: 'open' }), '{}', '/repo/src/other.json')).toBeNull()
  })
})

describe('agreement with src/data/catalog.ts', () => {
  const real = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'games.json'), 'utf8'))

  it('uses the same predicate as isOwnerAsserted for every fixture and manifest entry', () => {
    for (const g of [...ALL, ...real]) {
      expect(isOwnerAssertedEntry(g)).toBe(isOwnerAsserted(g))
    }
  })

  it('produces the same open-scope list as filterByScope for the real manifest', () => {
    expect(filterManifestByScope(real, 'open').map((g) => g.id)).toEqual(
      filterByScope(real, 'open').map((g) => g.id),
    )
  })
})
