// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { promoteGame } from '../promote-game.mjs'
import { buildSwf, fixtureRoot, liveEntry, writeAt } from './fixtures.mjs'

function draftEntry(overrides = {}) {
  return {
    id: 'alpha',
    title: 'Alpha',
    description: 'The first test game.',
    category: ['Puzzle'],
    thumbnail: '/games/alpha/thumb.webp',
    gameFile: '/games/alpha/game.swf',
    controls: 'Mouse',
    compatibility: 'unsupported',
    addedAt: '2026-11-16',
    license: { type: 'Developer permission', source: 'https://example.com/alpha' },
    width: 550,
    height: 400,
    needsKeyboard: true,
    missing: [],
    flags: ['needsKeyboard defaulted — verify'],
    sha256: 'abc123',
    ...overrides,
  }
}

/** Root with a draft for `alpha` whose files exist under public/games/alpha. */
function setup({ live = [], drafts = [draftEntry()] } = {}) {
  const root = fixtureRoot(live)
  writeAt(root, 'public/games/alpha/game.swf', buildSwf())
  writeAt(root, 'public/games/alpha/thumb.webp', Buffer.from('RIFF'))
  writeAt(root, 'src/data/games.import.json', `${JSON.stringify(drafts, null, 2)}\n`)
  return root
}

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'))

describe('promoteGame', () => {
  it('moves a valid draft into games.json with the chosen compatibility and strips import metadata', () => {
    const root = setup()
    const result = promoteGame({ id: 'alpha', compat: 'partial', root })

    expect(result.ok).toBe(true)
    const live = readJson(root, 'src/data/games.json')
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({ id: 'alpha', compatibility: 'partial', width: 550, height: 400 })
    for (const key of ['missing', 'flags', 'sha256']) expect(live[0]).not.toHaveProperty(key)
    expect(readJson(root, 'src/data/games.import.json')).toEqual([])
  })

  it('refuses when the entry fails validation (missing licence) and writes nothing', () => {
    const { license: _omit, ...noLicense } = draftEntry()
    const root = setup({ drafts: [noLicense] })
    const liveBefore = readFileSync(join(root, 'src/data/games.json'), 'utf8')
    const draftsBefore = readFileSync(join(root, 'src/data/games.import.json'), 'utf8')

    const result = promoteGame({ id: 'alpha', compat: 'verified', root })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.startsWith('alpha:') && /license/.test(e))).toBe(true)
    expect(readFileSync(join(root, 'src/data/games.json'), 'utf8')).toBe(liveBefore)
    expect(readFileSync(join(root, 'src/data/games.import.json'), 'utf8')).toBe(draftsBefore)
  })

  it('refuses when the thumbnail file is missing', () => {
    const root = setup({ drafts: [draftEntry({ thumbnail: '/games/alpha/nope.webp' })] })

    const result = promoteGame({ id: 'alpha', compat: 'verified', root })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /missing file/.test(e))).toBe(true)
  })

  it('refuses a second featured entry', () => {
    const root = setup({
      live: [liveEntry({ id: 'existing', featured: true })],
      drafts: [draftEntry({ featured: true })],
    })
    const result = promoteGame({ id: 'alpha', compat: 'verified', root })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /featured/.test(e))).toBe(true)
  })

  it('refuses an id that is already live', () => {
    const root = setup({ live: [liveEntry({ id: 'alpha' })] })
    const result = promoteGame({ id: 'alpha', compat: 'verified', root })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/already live/)
    expect(readJson(root, 'src/data/games.json')).toHaveLength(1)
  })

  it('refuses compatibility values other than verified or partial', () => {
    const root = setup()
    expect(promoteGame({ id: 'alpha', compat: 'unsupported', root }).ok).toBe(false)
    expect(promoteGame({ id: 'alpha', compat: undefined, root }).ok).toBe(false)
    expect(readJson(root, 'src/data/games.import.json')).toHaveLength(1)
  })

  it('refuses an unknown draft id', () => {
    const root = setup()
    const result = promoteGame({ id: 'ghost', compat: 'partial', root })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/no draft "ghost"/)
  })

  it('carries engine and the html5 gameFile from an html5 draft into the live manifest', () => {
    const html5Draft = draftEntry({ engine: 'html5', gameFile: '/games/alpha/html/index.html' })
    const root = setup({ drafts: [html5Draft] })
    writeAt(root, 'public/games/alpha/html/index.html', '<!doctype html>')

    const result = promoteGame({ id: 'alpha', compat: 'partial', root })

    expect(result.ok).toBe(true)
    const [entry] = readJson(root, 'src/data/games.json')
    expect(entry).toMatchObject({ id: 'alpha', engine: 'html5', gameFile: '/games/alpha/html/index.html', compatibility: 'partial' })
    for (const key of ['missing', 'flags', 'sha256']) expect(entry).not.toHaveProperty(key)
  })

  it('leaves the published files in place', () => {
    const root = setup()
    promoteGame({ id: 'alpha', compat: 'verified', root })
    expect(existsSync(join(root, 'public/games/alpha/game.swf'))).toBe(true)
  })
})
