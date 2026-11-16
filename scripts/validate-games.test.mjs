// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
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
})
