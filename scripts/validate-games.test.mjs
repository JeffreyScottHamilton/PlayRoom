// @vitest-environment node
import { mkdtempSync, mkdirSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateGames } from './validate-games.mjs'

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'playroom-validate-'))
  mkdirSync(join(root, 'public', 'games', 'sample'), { recursive: true })
  writeFileSync(join(root, 'public', 'games', 'sample', 'game.swf'), 'FWS')
  writeFileSync(join(root, 'public', 'games', 'sample', 'thumb.webp'), 'RIFF')
  return root
}

function entry(overrides = {}) {
  return {
    id: 'sample',
    title: 'Sample',
    description: 'A sample game.',
    category: ['Arcade'],
    thumbnail: '/games/sample/thumb.webp',
    gameFile: '/games/sample/game.swf',
    controls: 'Arrow keys',
    compatibility: 'verified',
    addedAt: '2024-01-15',
    license: { type: 'Developer permission', source: 'https://example.com/permission' },
    width: 550,
    height: 400,
    needsKeyboard: true,
    ...overrides,
  }
}

describe('validateGames', () => {
  const root = fixtureRoot()

  it('accepts a valid entry', () => {
    expect(validateGames([entry()], root)).toEqual([])
  })

  it('accepts an empty list', () => {
    expect(validateGames([], root)).toEqual([])
  })

  it('fails when license is missing', () => {
    const { license: _omit, ...noLicense } = entry()
    const errors = validateGames([noLicense], root)
    expect(errors.some((e) => e.startsWith('sample:') && /license/.test(e))).toBe(true)
  })

  it('rejects a licence source that is not an https URL', () => {
    const js = entry({ license: { type: 'Developer permission', source: 'javascript:alert(1)' } })
    expect(validateGames([js], root)).toContain('sample: license.source must be an https URL')
    const http = entry({ license: { type: 'Developer permission', source: 'http://example.com' } })
    expect(validateGames([http], root)).toContain('sample: license.source must be an https URL')
  })

  it('fails on duplicate ids', () => {
    const errors = validateGames([entry(), entry()], root)
    expect(errors.some((e) => e.startsWith('sample:') && /duplicate/i.test(e))).toBe(true)
  })

  it('fails on an invalid category', () => {
    const errors = validateGames([entry({ category: ['Shooter'] })], root)
    expect(errors.some((e) => e.startsWith('sample:') && /category/.test(e))).toBe(true)
  })

  it('fails when a local file is missing', () => {
    const errors = validateGames([entry({ gameFile: '/games/sample/missing.swf' })], root)
    expect(errors.some((e) => /missing/i.test(e))).toBe(true)
  })

  it('fails on a non-ISO addedAt', () => {
    const errors = validateGames([entry({ addedAt: '15/01/2024' })], root)
    expect(errors.some((e) => /addedAt/.test(e))).toBe(true)
  })

  it('rejects an unknown engine', () => {
    const errors = validateGames([entry({ engine: 'shockwave' })], root)
    expect(errors.some((e) => e.startsWith('sample:') && /engine/.test(e))).toBe(true)
  })

  it('rejects a flash entry whose gameFile is an .html file', () => {
    const errors = validateGames([entry({ engine: 'flash', gameFile: '/games/sample/game.html' })], root)
    expect(errors.some((e) => e.startsWith('sample:') && /\.swf/.test(e))).toBe(true)
  })
})

describe('validateGames: html5 entries', () => {
  const HTML5_ID = 'html5-sample'

  function html5Root({ bytes } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'playroom-validate-html5-'))
    const dir = join(root, 'public', 'games', HTML5_ID, 'html')
    mkdirSync(join(dir, 'js'), { recursive: true })
    writeFileSync(join(root, 'public', 'games', HTML5_ID, 'thumb.webp'), 'RIFF')
    writeFileSync(join(dir, 'index.html'), '<!doctype html><canvas></canvas>')
    writeFileSync(join(dir, 'js', 'game.js'), 'console.log(1)')
    if (bytes !== undefined) {
      // Sparse file: the apparent size is large but no disk blocks are written.
      const big = join(dir, 'assets.bin')
      writeFileSync(big, '')
      truncateSync(big, bytes)
    }
    return root
  }

  function html5Entry(overrides = {}) {
    return entry({
      id: HTML5_ID,
      engine: 'html5',
      thumbnail: `/games/${HTML5_ID}/thumb.webp`,
      gameFile: `/games/${HTML5_ID}/html/index.html`,
      width: 640,
      height: 480,
      ...overrides,
    })
  }

  it('accepts a valid html5 entry', () => {
    const root = html5Root()
    expect(validateGames([html5Entry()], root)).toEqual([])
  })

  it('rejects an html5 gameFile outside /games/<id>/html/', () => {
    const root = html5Root()
    const outside = html5Entry({ gameFile: `/games/${HTML5_ID}/index.html` })
    const errors = validateGames([outside], root)
    expect(errors.some((e) => e.startsWith(`${HTML5_ID}:`) && /html\//.test(e))).toBe(true)
  })

  it('rejects an html5 gameFile that is not .html', () => {
    const root = html5Root()
    const notHtml = html5Entry({ gameFile: `/games/${HTML5_ID}/html/game.js` })
    const errors = validateGames([notHtml], root)
    expect(errors.some((e) => e.startsWith(`${HTML5_ID}:`) && /\.html/.test(e))).toBe(true)
  })

  it('rejects an html5 gameFile that is missing', () => {
    const root = html5Root()
    const missing = html5Entry({ gameFile: `/games/${HTML5_ID}/html/missing.html` })
    const errors = validateGames([missing], root)
    expect(errors.some((e) => /missing/i.test(e))).toBe(true)
  })

  it('rejects a path traversal in the html5 gameFile', () => {
    const root = html5Root()
    const traversal = html5Entry({ gameFile: `/games/${HTML5_ID}/html/../../secret.html` })
    expect(validateGames([traversal], root).length).toBeGreaterThan(0)
  })

  it('fails when any file in the html5 folder is larger than 25 MiB', () => {
    const root = html5Root({ bytes: 25 * 1024 * 1024 + 1 })
    const errors = validateGames([html5Entry()], root)
    expect(errors.some((e) => e.startsWith(`${HTML5_ID}:`) && /25 MiB/.test(e))).toBe(true)
  })

  it('accepts a file of exactly 25 MiB', () => {
    const root = html5Root({ bytes: 25 * 1024 * 1024 })
    expect(validateGames([html5Entry()], root)).toEqual([])
  })
})

describe('validateGames: responsive entries', () => {
  const HTML5_ID = 'html5-sample'

  function html5Root() {
    const root = mkdtempSync(join(tmpdir(), 'playroom-validate-responsive-'))
    const dir = join(root, 'public', 'games', HTML5_ID, 'html')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(root, 'public', 'games', HTML5_ID, 'thumb.webp'), 'RIFF')
    writeFileSync(join(dir, 'index.html'), '<!doctype html><canvas></canvas>')
    return root
  }

  // Base responsive entry (no width/height), with overrides applied last.
  const responsiveEntry = (overrides = {}) => {
    const { width: _w, height: _h, ...base } = entry({
      id: HTML5_ID,
      engine: 'html5',
      responsive: true,
      thumbnail: `/games/${HTML5_ID}/thumb.webp`,
      gameFile: `/games/${HTML5_ID}/html/index.html`,
    })
    return { ...base, ...overrides }
  }

  it('accepts a responsive html5 game without width or height', () => {
    expect(validateGames([responsiveEntry()], html5Root())).toEqual([])
  })

  it('accepts responsive: false on a sized entry', () => {
    const root = html5Root()
    expect(validateGames([responsiveEntry({ responsive: false, width: 640, height: 480 })], root)).toEqual([])
  })

  it('fails when a responsive game sets width', () => {
    const errors = validateGames([responsiveEntry({ width: 640 })], html5Root())
    expect(errors).toContain(`${HTML5_ID}: responsive game must not set width`)
  })

  it('fails when a responsive game sets height', () => {
    const errors = validateGames([responsiveEntry({ height: 480 })], html5Root())
    expect(errors).toContain(`${HTML5_ID}: responsive game must not set height`)
  })

  it('fails when a responsive game is flash', () => {
    const errors = validateGames([responsiveEntry({ engine: undefined, gameFile: '/games/sample/game.swf', thumbnail: '/games/sample/thumb.webp', id: 'sample' })], fixtureRoot())
    expect(errors.some((e) => e.startsWith('sample:') && /responsive is only allowed for engine "html5"/.test(e))).toBe(true)
  })

  it('still requires width and height on a non-responsive game', () => {
    const { width: _w, ...noWidth } = entry()
    const errors = validateGames([noWidth], fixtureRoot())
    expect(errors).toContain('sample: width must be a positive integer')
  })

  it('rejects a non-boolean responsive value', () => {
    const errors = validateGames([responsiveEntry({ responsive: 'yes' })], html5Root())
    expect(errors).toContain(`${HTML5_ID}: responsive must be a boolean when present`)
  })
})
