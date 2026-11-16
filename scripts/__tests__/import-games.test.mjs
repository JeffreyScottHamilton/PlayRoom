// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatReport, normalizeTitle, runImport, slugify } from '../import-games.mjs'
import { buildSwf, fixtureRoot, liveEntry, tempDir, writeAt } from './fixtures.mjs'

const TODAY = '2026-11-16'
const SCRIPT = resolve(fileURLToPath(new URL('..', import.meta.url)), 'import-games.mjs')

const sidecar = (overrides = {}) =>
  JSON.stringify({
    title: 'Sample Game',
    description: 'A synthetic test game.',
    category: ['Arcade'],
    controls: 'Arrow keys',
    license: { type: 'Developer permission', source: 'https://example.com/permission' },
    ...overrides,
  })

function readDrafts(root) {
  const path = join(root, 'src', 'data', 'games.import.json')
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true }).sort()
}

describe('helpers', () => {
  it('slugify produces ascii kebab-case', () => {
    expect(slugify('Café Chase!!')).toBe('cafe-chase')
    expect(slugify('  Pac--Man 2 ')).toBe('pac-man-2')
    expect(slugify('!!!')).toBe('')
  })

  it('normalizeTitle matches search normalisation rules', () => {
    expect(normalizeTitle('Sample: Game!')).toBe('sample game')
    expect(normalizeTitle('Crème Brûlée')).toBe('creme brulee')
  })
})

describe('runImport', () => {
  it('dry run plans the draft from SWF header and sidecar but copies nothing', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'sample-game.swf', buildSwf({ sig: 'CWS', version: 8, width: 550, height: 400 }))
    writeAt(input, 'sample-game.json', sidecar())
    writeAt(input, 'sample-game.webp', Buffer.from('RIFF'))
    const before = listFiles(root)

    const result = runImport({ inputDir: input, root, dryRun: true, today: TODAY })

    expect(result.exitCode).toBe(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ slug: 'sample-game', swf: 'CWS v8', stage: '550x400', action: 'draft' })
    expect(listFiles(root)).toEqual(before)
    expect(existsSync(join(root, 'src', 'data', 'games.import.json'))).toBe(false)
    expect(formatReport(result)).toMatch(/Dry run: nothing was copied or written/)
  })

  it('writes a draft with unsupported compatibility, copies files, and never invents metadata', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'sample-game.swf', buildSwf({ sig: 'FWS', width: 550, height: 400 }))
    writeAt(input, 'sample-game.json', sidecar())
    writeAt(input, 'sample-game.webp', Buffer.from('RIFF'))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.exitCode).toBe(0)
    expect(result.copied).toBe(1)

    expect(existsSync(join(root, 'public', 'games', 'sample-game', 'game.swf'))).toBe(true)
    expect(existsSync(join(root, 'public', 'games', 'sample-game', 'thumb.webp'))).toBe(true)

    const [draft] = readDrafts(root)
    expect(draft).toMatchObject({
      id: 'sample-game',
      title: 'Sample Game',
      compatibility: 'unsupported',
      addedAt: TODAY,
      width: 550,
      height: 400,
      needsKeyboard: true,
      gameFile: '/games/sample-game/game.swf',
      thumbnail: '/games/sample-game/thumb.webp',
      missing: [],
    })
    expect(draft.flags).toContain('needsKeyboard defaulted — verify')
    expect(draft).not.toHaveProperty('developer')
    expect(draft).not.toHaveProperty('releaseYear')
  })

  it('lists missing required fields when there is no sidecar', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'mystery.swf', buildSwf())

    const result = runImport({ inputDir: input, root, today: TODAY })
    const [row] = result.rows
    expect(row.slug).toBe('mystery')
    expect(row.missing).toEqual(
      expect.arrayContaining(['title', 'description', 'category', 'controls', 'license.type', 'license.source', 'thumbnail']),
    )
    const [draft] = readDrafts(root)
    expect(draft.title).toBeUndefined()
    expect(draft.compatibility).toBe('unsupported')
  })

  it('flags an identical binary already published under public/games and skips it', () => {
    const swf = buildSwf({ sig: 'FWS' })
    const root = fixtureRoot()
    writeAt(root, 'public/games/old-game/game.swf', swf)
    const input = tempDir('input')
    writeAt(input, 'new-name.swf', swf)

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].duplicates).toBe('public/games/old-game/game.swf')
    expect(result.rows[0].action).toBe('skip: duplicate binary')
    expect(result.copied).toBe(0)
    expect(readDrafts(root)).toBeNull()
    expect(existsSync(join(root, 'public', 'games', 'new-name'))).toBe(false)
  })

  it('flags duplicate binaries within the batch and drafts only the first', () => {
    const swf = buildSwf({ sig: 'CWS' })
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'a.swf', swf)
    writeAt(input, 'b.swf', swf)

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows.map((r) => r.action)).toEqual(['draft', 'skip: duplicate binary'])
    expect(result.rows[1].duplicates).toBe('batch a.swf')
    expect(readDrafts(root)).toHaveLength(1)
  })

  it('flags a likely title duplicate of a live entry but still drafts it', () => {
    const root = fixtureRoot([liveEntry({ id: 'existing', title: 'Sample: Game!' })])
    const input = tempDir('input')
    writeAt(input, 'sample.swf', buildSwf())
    writeAt(input, 'sample.json', sidecar({ title: 'sample game' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].action).toBe('draft')
    expect(result.rows[0].flags).toContain('possible duplicate title of "existing"')
  })

  it('never clobbers a live entry or its published files', () => {
    const liveJson = `${JSON.stringify([liveEntry({ id: 'sample-game' })], null, 2)}\n`
    const root = fixtureRoot([liveEntry({ id: 'sample-game' })])
    writeAt(root, 'public/games/sample-game/game.swf', buildSwf({ width: 300, height: 200 }))
    const input = tempDir('input')
    writeAt(input, 'sample-game.swf', buildSwf({ width: 550, height: 400 }))
    writeAt(input, 'sample-game.json', sidecar({ title: 'Sample Game', id: 'sample-game' }))
    writeAt(input, 'sample-game.webp', Buffer.from('RIFF'))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].action).toBe('skip: live entry exists')
    expect(result.copied).toBe(0)
    expect(readFileSync(join(root, 'src', 'data', 'games.json'), 'utf8')).toBe(liveJson)
    expect(readDrafts(root)).toBeNull()
    expect(existsSync(join(root, 'public', 'games', 'sample-game', 'thumb.webp'))).toBe(false)
  })

  it('does not overwrite a published game.swf that differs from the import', () => {
    const root = fixtureRoot()
    writeAt(root, 'public/games/orphan/game.swf', buildSwf({ width: 300, height: 200 }))
    const input = tempDir('input')
    writeAt(input, 'orphan.swf', buildSwf({ width: 550, height: 400 }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].action).toBe('skip: destination has a different game.swf')
    expect(result.copied).toBe(0)
  })

  it('merges re-imports by id, keeping the original addedAt and maintainer edits', () => {
    const root = fixtureRoot()
    writeAt(
      root,
      'src/data/games.import.json',
      `${JSON.stringify([{ id: 'sample-game', title: 'Old', developer: 'Maintainer', addedAt: '2026-01-02', compatibility: 'unsupported', missing: [], flags: [] }], null, 2)}\n`,
    )
    const input = tempDir('input')
    writeAt(input, 'sample-game.swf', buildSwf())
    writeAt(input, 'sample-game.json', sidecar({ title: 'Sample Game' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].action).toBe('update draft')
    const drafts = readDrafts(root)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ id: 'sample-game', title: 'Sample Game', developer: 'Maintainer', addedAt: '2026-01-02' })
  })

  it('reports an unreadable input directory with exit code 1', () => {
    const root = fixtureRoot()
    const result = runImport({ inputDir: join(tempDir('missing'), 'nope'), root, today: TODAY })
    expect(result.exitCode).toBe(1)
    expect(result.error).toMatch(/cannot read input directory/)
  })

  it('marks ZWS files as needs-review with unknown stage size', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    const zws = buildSwf({ version: 13 })
    zws.write('ZWS', 0, 'latin1')
    writeAt(input, 'lzma.swf', zws)

    const result = runImport({ inputDir: input, root, today: TODAY })
    const [row] = result.rows
    expect(row.stage).toBe('unknown')
    expect(row.flags.some((f) => f.startsWith('needs-review'))).toBe(true)
    expect(row.missing).toEqual(expect.arrayContaining(['width', 'height']))
  })

  it('drops invalid sidecar categories and flags them', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'sample.swf', buildSwf())
    writeAt(input, 'sample.json', sidecar({ category: ['Shooter', 'Puzzle'] }))

    runImport({ inputDir: input, root, today: TODAY })
    const [draft] = readDrafts(root)
    expect(draft.category).toEqual(['Puzzle'])
    expect(draft.flags).toContain('invalid category "Shooter" in sidecar')
  })

  it('derives an ascii kebab-case slug from the sidecar title when there is no id', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'file1.swf', buildSwf())
    writeAt(input, 'file1.json', sidecar({ title: 'Café Chase!!' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].slug).toBe('cafe-chase')
    expect(readDrafts(root)[0].id).toBe('cafe-chase')
  })

  it('copies a PNG thumbnail as-is and flags it for webp conversion', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'sample.swf', buildSwf())
    writeAt(input, 'sample.png', Buffer.from('PNG'))
    writeAt(input, 'sample.json', sidecar())

    runImport({ inputDir: input, root, today: TODAY })
    const [draft] = readDrafts(root)
    expect(draft.thumbnail).toBe('/games/sample-game/thumb.png')
    expect(existsSync(join(root, 'public', 'games', 'sample-game', 'thumb.png'))).toBe(true)
    expect(draft.flags).toContain('convert to webp (copied as-is)')
  })

  it('does not treat a sidecar compatibility or addedAt as authoritative', () => {
    const root = fixtureRoot()
    const input = tempDir('input')
    writeAt(input, 'sample.swf', buildSwf())
    writeAt(input, 'sample.json', sidecar({ compatibility: 'verified', addedAt: '2001-01-01' }))

    runImport({ inputDir: input, root, today: TODAY })
    const [draft] = readDrafts(root)
    expect(draft.compatibility).toBe('unsupported')
    expect(draft.addedAt).toBe(TODAY)
  })
})

describe('import-games CLI', () => {
  it('exits 0 on a synthetic folder with --dry-run', () => {
    const input = tempDir('cli')
    writeAt(input, 'cli-game.swf', buildSwf({ sig: 'CWS' }))
    writeAt(input, 'cli-game.json', sidecar({ title: 'CLI Game' }))
    const out = execFileSync(process.execPath, [SCRIPT, input, '--dry-run'], { encoding: 'utf8' })
    expect(out).toMatch(/cli-game/)
    expect(out).toMatch(/Dry run/)
  })

  it('exits 1 when the input directory cannot be read', () => {
    let status = 0
    try {
      execFileSync(process.execPath, [SCRIPT, join(tempDir('cli'), 'missing'), '--dry-run'], { stdio: 'pipe' })
    } catch (err) {
      status = err.status
    }
    expect(status).toBe(1)
  })
})
