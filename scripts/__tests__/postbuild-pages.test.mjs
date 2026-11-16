import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { postbuildPages } from '../postbuild-pages.mjs'

const INDEX = '<!doctype html><html><body><div id="root"></div></body></html>'

function setup(games) {
  const root = mkdtempSync(join(tmpdir(), 'playroom-postbuild-'))
  mkdirSync(join(root, 'src', 'data'), { recursive: true })
  writeFileSync(join(root, 'src', 'data', 'games.json'), JSON.stringify(games))
  mkdirSync(join(root, 'dist'), { recursive: true })
  writeFileSync(join(root, 'dist', 'index.html'), INDEX)
  for (const id of ['open-one', 'owned-one']) {
    mkdirSync(join(root, 'dist', 'games', id), { recursive: true })
    writeFileSync(join(root, 'dist', 'games', id, 'game.swf'), 'x')
    writeFileSync(join(root, 'dist', 'games', id, 'thumb.webp'), 'x')
  }
  return root
}

const GAMES = [
  { id: 'open-one', license: { type: 'MIT', source: 'https://example.com' } },
  { id: 'owned-one', license: { type: 'Owner-asserted (permission on file)', source: 'doc' } },
]

describe('postbuildPages', () => {
  it('removes owner-asserted game folders in the open scope and reports counts', () => {
    const root = setup(GAMES)
    const result = postbuildPages({ root, scope: 'open' })

    expect(existsSync(join(root, 'dist', 'games', 'owned-one'))).toBe(false)
    expect(existsSync(join(root, 'dist', 'games', 'open-one', 'game.swf'))).toBe(true)
    expect(result).toEqual({ scope: 'open', ownerAsserted: 1, removed: ['owned-one'], missing: [] })
  })

  it('keeps every game folder in the all scope', () => {
    const root = setup(GAMES)
    const result = postbuildPages({ root, scope: 'all' })

    expect(existsSync(join(root, 'dist', 'games', 'owned-one', 'game.swf'))).toBe(true)
    expect(result.removed).toEqual([])
  })

  it('treats an empty scope as all', () => {
    const root = setup(GAMES)
    expect(postbuildPages({ root, scope: '' }).scope).toBe('all')
  })

  it('always writes 404.html as a copy of index.html and an empty .nojekyll', () => {
    const root = setup(GAMES)
    postbuildPages({ root, scope: 'all' })

    expect(readFileSync(join(root, 'dist', '404.html'), 'utf8')).toBe(INDEX)
    expect(existsSync(join(root, 'dist', '.nojekyll'))).toBe(true)
  })

  it('reports owner-asserted entries whose folder is absent without failing', () => {
    const root = setup(GAMES)
    const withGhost = [...GAMES, { id: 'ghost', license: { type: 'Owner-asserted', source: 'doc' } }]
    writeFileSync(join(root, 'src', 'data', 'games.json'), JSON.stringify(withGhost))

    const result = postbuildPages({ root, scope: 'open' })
    expect(result.ownerAsserted).toBe(2)
    expect(result.removed).toEqual(['owned-one'])
    expect(result.missing).toEqual(['ghost'])
  })

  it('refuses a non kebab-case owner-asserted id and deletes nothing', () => {
    const root = setup([
      ...GAMES,
      { id: '../open-one', license: { type: 'Owner-asserted', source: 'doc' } },
    ])
    expect(() => postbuildPages({ root, scope: 'open' })).toThrow(/kebab-case/)
    expect(existsSync(join(root, 'dist', 'games', 'owned-one', 'game.swf'))).toBe(true)
    expect(existsSync(join(root, 'dist', '404.html'))).toBe(false)
  })

  it('refuses an unknown scope value', () => {
    const root = setup(GAMES)
    expect(() => postbuildPages({ root, scope: 'opne' })).toThrow(/VITE_LIBRARY/)
  })

  it('fails when dist/index.html is missing', () => {
    const root = setup(GAMES)
    rmSync(join(root, 'dist', 'index.html'))
    expect(() => postbuildPages({ root, scope: 'all' })).toThrow(/index\.html/)
  })

  it('refuses to finish when a built asset still references an owner-asserted game folder', () => {
    const root = setup(GAMES)
    mkdirSync(join(root, 'dist', 'assets'), { recursive: true })
    writeFileSync(join(root, 'dist', 'assets', 'index-abc.js'), 'const g="/games/owned-one/game.swf"')
    expect(() => postbuildPages({ root, scope: 'open' })).toThrow(/leaked into dist\/assets/)
    expect(existsSync(join(root, 'dist', '404.html'))).toBe(false)
  })

  it('does not flag assets that only mention open games', () => {
    const root = setup(GAMES)
    mkdirSync(join(root, 'dist', 'assets'), { recursive: true })
    writeFileSync(join(root, 'dist', 'assets', 'index-abc.js'), 'const g="/games/open-one/game.swf"')
    expect(postbuildPages({ root, scope: 'open' }).removed).toEqual(['owned-one'])
  })
})
