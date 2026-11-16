// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatReport, runImport } from '../import-games.mjs'
import { buildSwf, fixtureRoot, liveEntry, tempDir, writeAt } from './fixtures.mjs'

const TODAY = '2026-11-16'
const SCRIPT = resolve(fileURLToPath(new URL('..', import.meta.url)), 'import-games.mjs')

const sidecar = (overrides = {}) =>
  JSON.stringify({
    title: 'Sky Runner',
    description: 'A synthetic HTML5 test game.',
    category: ['Arcade'],
    controls: 'Arrow keys',
    width: 800,
    height: 600,
    license: { type: 'Developer permission', source: 'https://example.com/permission' },
    ...overrides,
  })

/** Synthetic html5 game folder `<input>/<name>/` with index.html and a script. */
function html5Game(input, name, { html = '<!doctype html><script src="game.js"></script>', js = 'void 0' } = {}) {
  writeAt(input, `${name}/index.html`, html)
  writeAt(input, `${name}/game.js`, js)
  return join(input, name)
}

const readDrafts = (root) => {
  const path = join(root, 'src', 'data', 'games.import.json')
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

const listRel = (dir) => readdirSync(dir, { recursive: true }).sort()

describe('runImport with html5 folders', () => {
  it('dry run prints a plan for an html5 folder and writes nothing', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-dry')
    html5Game(input, 'sky-runner')
    writeAt(input, 'sky-runner.json', sidecar())
    const before = listRel(root)

    const result = runImport({ inputDir: input, root, dryRun: true, today: TODAY })
    expect(result.exitCode).toBe(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      file: 'sky-runner/',
      slug: 'sky-runner',
      swf: 'html5',
      stage: '800x600',
      action: 'draft',
    })
    expect(listRel(root)).toEqual(before)
    expect(existsSync(join(root, 'public', 'games'))).toBe(true)
    expect(readdirSync(join(root, 'public', 'games'))).toEqual([])
    expect(readDrafts(root)).toBeNull()
    expect(formatReport(result)).toMatch(/Dry run: nothing was copied or written/)
  })

  it('writes an html5 draft with engine, gameFile and compatibility, and copies the folder to html/', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-draft')
    html5Game(input, 'sky-runner')
    writeAt(input, 'sky-runner/.env', 'SECRET=1')
    writeAt(input, 'sky-runner.json', sidecar())
    writeAt(input, 'sky-runner.webp', Buffer.from('RIFF'))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.exitCode).toBe(0)
    expect(result.copied).toBe(1)

    const dest = join(root, 'public', 'games', 'sky-runner', 'html')
    expect(listRel(dest)).toEqual(['game.js', 'index.html'])
    expect(existsSync(join(root, 'public', 'games', 'sky-runner', 'thumb.webp'))).toBe(true)

    const [draft] = readDrafts(root)
    expect(draft).toMatchObject({
      id: 'sky-runner',
      title: 'Sky Runner',
      engine: 'html5',
      gameFile: '/games/sky-runner/html/index.html',
      thumbnail: '/games/sky-runner/thumb.webp',
      compatibility: 'unsupported',
      addedAt: TODAY,
      width: 800,
      height: 600,
      needsKeyboard: true,
      missing: [],
    })
    expect(draft.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(draft.flags).toContain('needsKeyboard defaulted — verify')
    expect(draft).not.toHaveProperty('gameFile', '/games/sky-runner/game.swf')
  })

  it('does not add an engine field to SWF drafts', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-swf-only')
    writeAt(input, 'retro.swf', buildSwf({ width: 550, height: 400 }))
    writeAt(input, 'retro.json', sidecar({ title: 'Retro' }))
    runImport({ inputDir: input, root, today: TODAY })
    const [draft] = readDrafts(root)
    expect(draft).not.toHaveProperty('engine')
    expect(draft.gameFile).toBe('/games/retro/game.swf')
  })

  it('handles an html5 folder and a swf in the same batch, without scanning the folder for swfs', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-mixed')
    html5Game(input, 'sky-runner')
    writeAt(input, 'sky-runner/bundled.swf', buildSwf())
    writeAt(input, 'sky-runner.json', sidecar())
    writeAt(input, 'retro.swf', buildSwf({ width: 550, height: 400 }))
    writeAt(input, 'retro.json', sidecar({ title: 'Retro', width: undefined, height: undefined }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows.map((r) => [r.file, r.swf])).toEqual([
      ['retro.swf', 'FWS v10'],
      ['sky-runner/', 'html5'],
    ])
    expect(result.ignored).toEqual([])
    const ids = readDrafts(root).map((d) => d.id).sort()
    expect(ids).toEqual(['retro', 'sky-runner'])
    expect(existsSync(join(root, 'public', 'games', 'sky-runner', 'html', 'bundled.swf'))).toBe(true)
  })

  it('flags external-requests, missing-size and large-file on the draft', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-flags')
    html5Game(input, 'remote', { html: '<script src="https://cdn.example.com/a.js"></script>', js: 'fetch("https://api.example.org/x")' })
    writeAt(input, 'remote.json', sidecar({ title: 'Remote', width: undefined, height: undefined }))

    const result = runImport({ inputDir: input, root, dryRun: true, today: TODAY })
    const [row] = result.rows
    expect(row.stage).toBe('unknown')
    expect(row.missing).toEqual(expect.arrayContaining(['width', 'height']))
    expect(row.flags).toEqual(
      expect.arrayContaining([
        'external-requests: api.example.org, cdn.example.com (the game may break offline or phone home)',
        'missing-size: sidecar has no width/height',
      ]),
    )
  })

  it('reports a folder with an inline iframe breakout as informational, not as a failure', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-breakout')
    html5Game(input, 'breakout', { js: 'if (window.top.location) location.href = "x"' })
    writeAt(input, 'breakout.json', sidecar({ title: 'Breakout' }))
    const result = runImport({ inputDir: input, root, dryRun: true, today: TODAY })
    expect(result.rows[0].action).toBe('draft')
    expect(result.rows[0].flags.some((f) => f.startsWith('inline-iframe-breakout (informational)'))).toBe(true)
  })

  it('skips the folder and copies nothing when it holds a symlink pointing outside', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-leak')
    const outside = tempDir('h5-leak-outside')
    writeAt(outside, 'secret.txt', 'SECRET')
    html5Game(input, 'leaky')
    symlinkSync(join(outside, 'secret.txt'), join(input, 'leaky', 'secret.txt'))
    writeAt(input, 'leaky.json', sidecar({ title: 'Leaky' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    const [row] = result.rows
    expect(row.flags).toContain('skipped symlink: secret.txt')
    expect(row.action).toBe('draft')
    const dest = join(root, 'public', 'games', 'leaky', 'html')
    expect(listRel(dest)).toEqual(['game.js', 'index.html'])
    expect(existsSync(join(dest, 'secret.txt'))).toBe(false)
  })

  it('does not copy through a symlinked directory that points outside the folder', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-escape-plan')
    const outside = tempDir('h5-escape-plan-outside')
    writeAt(outside, 'loot.js', 'LOOT')
    html5Game(input, 'escape')
    symlinkSync(outside, join(input, 'escape', 'lib'))
    writeAt(input, 'escape.json', sidecar({ title: 'Escape' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].flags).toContain('skipped symlink: lib')
    expect(result.rows[0].action).toBe('draft')
    expect(listRel(join(root, 'public', 'games', 'escape', 'html'))).toEqual(['game.js', 'index.html'])
  })

  it('flags an identical folder already published and skips it', () => {
    const root = fixtureRoot()
    // A published folder byte-identical to the incoming one.
    const pubDir = join(root, 'public', 'games', 'old-runner', 'html')
    writeAt(pubDir, 'index.html', '<!doctype html><script src="game.js"></script>')
    writeAt(pubDir, 'game.js', 'void 0')

    const input = tempDir('h5-pub-in')
    html5Game(input, 'new-runner', { html: '<!doctype html><script src="game.js"></script>', js: 'void 0' })
    writeAt(input, 'new-runner.json', sidecar({ title: 'New Runner' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].duplicates).toBe('public/games/old-runner/html')
    expect(result.rows[0].action).toBe('skip: duplicate folder')
    expect(result.copied).toBe(0)
    expect(readDrafts(root)).toBeNull()
    expect(existsSync(join(root, 'public', 'games', 'new-runner'))).toBe(false)
  })

  it('flags duplicate folders within the batch and drafts only the first', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-batch-dup')
    html5Game(input, 'a-copy')
    html5Game(input, 'b-copy')
    writeAt(input, 'a-copy.json', sidecar({ title: 'Copy A' }))
    writeAt(input, 'b-copy.json', sidecar({ title: 'Copy B' }))

    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows.map((r) => r.action)).toEqual(['draft', 'skip: duplicate folder'])
    expect(result.rows[1].duplicates).toBe('batch a-copy/')
    expect(readDrafts(root)).toHaveLength(1)
  })

  it('does not treat a live html5 entry as overwritable', () => {
    const root = fixtureRoot([liveEntry({ id: 'sky-runner', engine: 'html5', gameFile: '/games/sky-runner/html/index.html' })])
    const input = tempDir('h5-live')
    html5Game(input, 'sky-runner')
    writeAt(input, 'sky-runner.json', sidecar())
    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].action).toBe('skip: live entry exists')
    expect(result.copied).toBe(0)
  })

  it('refuses to replace a different html folder already published for that slug', () => {
    const root = fixtureRoot()
    writeAt(root, 'public/games/sky-runner/html/index.html', '<!doctype html>other')
    const input = tempDir('h5-other')
    html5Game(input, 'sky-runner')
    writeAt(input, 'sky-runner.json', sidecar())
    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].action).toBe('skip: destination has a different html folder')
    expect(readFileSync(join(root, 'public/games/sky-runner/html/index.html'), 'utf8')).toBe('<!doctype html>other')
  })

  it('reads the sidecar inside the folder when there is no sibling json', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-inner')
    html5Game(input, 'inner')
    writeAt(input, 'inner/game.json', sidecar({ title: 'Inner Game' }))
    runImport({ inputDir: input, root, today: TODAY })
    const [draft] = readDrafts(root)
    expect(draft).toMatchObject({ id: 'inner-game', title: 'Inner Game', width: 800, height: 600 })
  })

  it('keeps the sidecar engine out of SWF games and flags it', () => {
    const root = fixtureRoot()
    const input = tempDir('h5-engine-swf')
    writeAt(input, 'eng.swf', buildSwf())
    writeAt(input, 'eng.json', sidecar({ title: 'Eng', engine: 'html5' }))
    const result = runImport({ inputDir: input, root, today: TODAY })
    expect(result.rows[0].flags).toContain('sidecar "engine" ignored (SWF games are flash)')
    expect(readDrafts(root)[0]).not.toHaveProperty('engine')
  })
})

describe('import-games CLI with html5 folders', () => {
  it('prints both an html5 game and a swf with the right flags on --dry-run', () => {
    const input = tempDir('h5-cli')
    html5Game(input, 'sky-runner', { html: '<script src="https://cdn.example.com/x.js"></script>' })
    writeAt(input, 'sky-runner.json', sidecar({ width: undefined, height: undefined }))
    writeAt(input, 'retro.swf', buildSwf({ sig: 'CWS', width: 550, height: 400 }))
    writeAt(input, 'retro.json', sidecar({ title: 'Retro Shooter', width: undefined, height: undefined }))

    const out = execFileSync(process.execPath, [SCRIPT, input, '--dry-run'], { encoding: 'utf8' })
    expect(out).toMatch(/sky-runner\/\s+sky-runner\s+.*html5/)
    expect(out).toMatch(/retro\.swf\s+retro-shooter\s+.*CWS v10/)
    expect(out).toMatch(/! external-requests: cdn\.example\.com/)
    expect(out).toMatch(/! missing-size: sidecar has no width\/height/)
    expect(out).toMatch(/2 game candidate\(s\): 2 draft\(s\)/)
    expect(out).toMatch(/Dry run: nothing was copied or written/)
  })
})
