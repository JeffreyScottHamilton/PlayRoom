// @vitest-environment node
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  Html5Error,
  MAX_FILE_BYTES,
  assertSafeCopy,
  copyHtml5Files,
  findHtml5Folders,
  hashHtml5Folder,
  html5Flags,
  html5SidecarPath,
  inspectHtml5Folder,
  isSafeRelPath,
  listFolderFiles,
} from '../lib/html5.mjs'
import { tempDir, writeAt } from './fixtures.mjs'

/** A synthetic HTML5 game folder: index.html plus a script and stylesheet. */
function makeGame(parent, name, { html = '<!doctype html><title>g</title><script src="game.js"></script>', js = 'console.log(1)' } = {}) {
  const dir = join(parent, name)
  writeAt(dir, 'index.html', html)
  writeAt(dir, 'game.js', js)
  writeAt(dir, 'style.css', 'body{margin:0}')
  return dir
}

const listRel = (dir) => readdirSync(dir, { recursive: true }).sort()

describe('isSafeRelPath', () => {
  it('accepts plain relative paths and rejects traversal, absolute and empty parts', () => {
    expect(isSafeRelPath('index.html')).toBe(true)
    expect(isSafeRelPath('assets/img/a.png')).toBe(true)
    expect(isSafeRelPath('../evil.js')).toBe(false)
    expect(isSafeRelPath('a/../../evil.js')).toBe(false)
    expect(isSafeRelPath('/etc/passwd')).toBe(false)
    expect(isSafeRelPath('a//b')).toBe(false)
    expect(isSafeRelPath('a\\..\\b')).toBe(false)
    expect(isSafeRelPath('')).toBe(false)
  })
})

describe('findHtml5Folders', () => {
  it('detects sub-folders with a top-level index.html and ignores plain folders and root files', () => {
    const input = tempDir('h5-detect')
    makeGame(input, 'blaster')
    writeAt(input, 'notes/readme.txt', 'no game here')
    writeAt(input, 'index.html', 'root index does not count')
    expect(findHtml5Folders(input)).toEqual([join(input, 'blaster')])
  })

  it('finds candidates nested deeper and does not descend into a candidate', () => {
    const input = tempDir('h5-nested')
    makeGame(join(input, 'pack', 'v2'), 'deep')
    makeGame(input, 'outer')
    writeAt(input, 'outer/inner/index.html', 'nested inside a candidate')
    expect(findHtml5Folders(input)).toEqual([join(input, 'outer'), join(input, 'pack', 'v2', 'deep')].sort())
  })

  it('does not treat a symlinked index.html or a symlinked folder as a candidate', () => {
    const input = tempDir('h5-symlink')
    const outside = tempDir('h5-outside')
    writeAt(outside, 'index.html', 'outside')
    mkdirSync(join(input, 'linked-index'))
    symlinkSync(join(outside, 'index.html'), join(input, 'linked-index', 'index.html'))
    symlinkSync(outside, join(input, 'linked-dir'))
    expect(findHtml5Folders(input)).toEqual([])
  })
})

describe('listFolderFiles and copy', () => {
  it('skips dotfiles, dot-directories, node_modules and symlinks', () => {
    const outside = tempDir('h5-secret')
    writeAt(outside, 'secret.txt', 'TOP SECRET')
    const game = makeGame(tempDir('h5-copy'), 'game')
    writeAt(game, '.env', 'KEY=1')
    writeAt(game, '.git/config', '[core]')
    writeAt(game, 'node_modules/pkg/index.js', 'x')
    writeAt(game, 'assets/.DS_Store', 'x')
    symlinkSync(join(outside, 'secret.txt'), join(game, 'leak.txt'))

    const { files, skipped } = listFolderFiles(game)
    expect(files.map((f) => f.rel)).toEqual(['game.js', 'index.html', 'style.css'])
    expect(skipped).toEqual(
      expect.arrayContaining([
        { rel: '.env', reason: 'dotfile' },
        { rel: '.git', reason: 'dotfile' },
        { rel: 'node_modules', reason: 'node_modules' },
        { rel: 'assets/.DS_Store', reason: 'dotfile' },
        { rel: 'leak.txt', reason: 'symlink' },
      ]),
    )

    const dest = join(tempDir('h5-dest'), 'html')
    expect(copyHtml5Files(game, files, dest)).toBe(3)
    expect(listRel(dest)).toEqual(['game.js', 'index.html', 'style.css'])
    expect(existsSync(join(dest, 'leak.txt'))).toBe(false)
    expect(readFileSync(join(dest, 'index.html'), 'utf8')).toMatch(/<title>g<\/title>/)
  })

  it('copies nested files with their relative layout', () => {
    const game = makeGame(tempDir('h5-nest'), 'game')
    writeAt(game, 'assets/sprites/hero.png', 'PNG')
    const dest = join(tempDir('h5-nest-dest'), 'html')
    copyHtml5Files(game, listFolderFiles(game).files, dest)
    expect(readFileSync(join(dest, 'assets', 'sprites', 'hero.png'), 'utf8')).toBe('PNG')
  })

  it('rejects a planned file that is a symlink pointing outside, before anything is copied', () => {
    const outside = tempDir('h5-escape')
    writeAt(outside, 'passwd', 'root:x')
    const game = makeGame(tempDir('h5-escape-game'), 'game')
    const link = join(game, 'passwd')
    symlinkSync(join(outside, 'passwd'), link)
    // A plan that (wrongly) lists the link as a file must still be refused at copy time.
    const planned = [{ rel: 'passwd', abs: link, size: 6 }]
    const dest = join(tempDir('h5-escape-dest'), 'html')
    expect(() => assertSafeCopy(game, planned, dest)).toThrow(Html5Error)
    expect(() => copyHtml5Files(game, planned, dest)).toThrow(/regular file/)
    expect(existsSync(join(dest, 'passwd'))).toBe(false)
  })

  it('rejects a regular file whose real path escapes the folder through a symlinked directory', () => {
    const outside = tempDir('h5-escape-dir')
    writeAt(outside, 'loot.js', 'x')
    const game = makeGame(tempDir('h5-escape-dir-game'), 'game')
    symlinkSync(outside, join(game, 'lib'))
    const planned = [{ rel: 'lib/loot.js', abs: join(game, 'lib', 'loot.js'), size: 1 }]
    const dest = join(tempDir('h5-escape-dir-dest'), 'html')
    expect(() => assertSafeCopy(game, planned, dest)).toThrow(/outside|regular file/)
  })

  it('rejects ../ names and absolute names in a copy plan', () => {
    const game = makeGame(tempDir('h5-trav'), 'game')
    const dest = join(tempDir('h5-trav-dest'), 'html')
    const evil = { rel: '../../escape.js', abs: join(game, 'game.js'), size: 1 }
    expect(() => copyHtml5Files(game, [evil], dest)).toThrow(/unsafe path/)
    const abs = { rel: '/tmp/escape.js', abs: join(game, 'game.js'), size: 1 }
    expect(() => assertSafeCopy(game, [abs], dest)).toThrow(Html5Error)
    expect(existsSync(join(dest, '..', 'escape.js'))).toBe(false)
  })

  it('refuses to write through a symlink already at the destination', () => {
    const game = makeGame(tempDir('h5-destlink'), 'game')
    const dest = join(tempDir('h5-destlink-dest'), 'html')
    const victim = join(tempDir('h5-victim'), 'v.txt')
    writeFileSync(victim, 'keep')
    mkdirSync(dest, { recursive: true })
    symlinkSync(victim, join(dest, 'index.html'))
    expect(() => copyHtml5Files(game, listFolderFiles(game).files, dest)).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe('keep')
  })
})

describe('inspectHtml5Folder and flags', () => {
  it('reports distinct external http(s) hosts from html, js and css', () => {
    const game = makeGame(tempDir('h5-hosts'), 'game', {
      html: '<script src="https://cdn.example.com/lib.js"></script><a href="http://Example.org/x">x</a>',
      js: 'fetch("https://cdn.example.com/api"); new Image().src = "https://stats.example.net:8443/p.gif"',
    })
    writeAt(game, 'style.css', '@import url(https://fonts.example.com/f.css);')
    const insp = inspectHtml5Folder(game)
    expect(insp.externalHosts).toEqual(['cdn.example.com', 'example.org', 'fonts.example.com', 'stats.example.net'])
    expect(html5Flags(insp, { width: 550, height: 400 })).toEqual([
      'external-requests: cdn.example.com, example.org, fonts.example.com, stats.example.net (the game may break offline or phone home)',
    ])
  })

  it('reports no external-requests flag for a self-contained game', () => {
    const insp = inspectHtml5Folder(makeGame(tempDir('h5-local'), 'game'))
    expect(insp.externalHosts).toEqual([])
    expect(html5Flags(insp, { width: 1, height: 1 })).toEqual([])
  })

  it('flags missing width or height from the sidecar', () => {
    const insp = inspectHtml5Folder(makeGame(tempDir('h5-size'), 'game'))
    expect(html5Flags(insp, { width: 550 })).toEqual(['missing-size: sidecar has no width/height'])
    expect(html5Flags(insp, {})).toEqual(['missing-size: sidecar has no width/height'])
    expect(html5Flags(insp, { width: 550.5, height: 400 })).toEqual(['missing-size: sidecar has no width/height'])
  })

  it('flags files above 25 MiB as large-file', () => {
    const game = makeGame(tempDir('h5-large'), 'game')
    const big = join(game, 'movie.bin')
    // Sparse file: the size check reads the real stat size without writing 25 MiB.
    const fd = openSync(big, 'w')
    ftruncateSync(fd, MAX_FILE_BYTES + 1)
    closeSync(fd)
    const insp = inspectHtml5Folder(game)
    expect(insp.largeFiles).toEqual([{ rel: 'movie.bin', size: MAX_FILE_BYTES + 1 }])
    expect(html5Flags(insp, { width: 550, height: 400 })).toEqual([
      'large-file: movie.bin is 25.0 MiB (over 25 MiB)',
    ])
  })

  it('flags top/parent location references as informational iframe breakout', () => {
    const game = makeGame(tempDir('h5-breakout'), 'game', { js: 'if (top.location.href) { window.top.location = "x" }' })
    const insp = inspectHtml5Folder(game)
    expect(insp.breakoutFiles).toEqual(['game.js'])
    expect(html5Flags(insp, { width: 550, height: 400 })[0]).toMatch(/^inline-iframe-breakout \(informational\): game\.js/)
  })
})

describe('hashing for duplicate detection', () => {
  it('is identical for identical folders and differs when any file or name changes', () => {
    const a = makeGame(tempDir('h5-hash-a'), 'game')
    const b = makeGame(tempDir('h5-hash-b'), 'game')
    expect(hashHtml5Folder(a)).toBe(hashHtml5Folder(b))

    writeAt(b, 'game.js', 'changed')
    expect(hashHtml5Folder(a)).not.toBe(hashHtml5Folder(b))

    const c = makeGame(tempDir('h5-hash-c'), 'game')
    writeAt(c, 'extra.txt', '')
    expect(hashHtml5Folder(a)).not.toBe(hashHtml5Folder(c))
  })

  it('ignores skipped entries (dotfiles and symlinks) when hashing', () => {
    const a = makeGame(tempDir('h5-hash-skip-a'), 'game')
    const b = makeGame(tempDir('h5-hash-skip-b'), 'game')
    writeAt(b, '.hidden', 'x')
    expect(hashHtml5Folder(a)).toBe(hashHtml5Folder(b))
  })

  it('does not depend on the order files were created in', () => {
    const a = tempDir('h5-order-a')
    writeAt(a, 'game/index.html', 'i')
    writeAt(a, 'game/z.js', 'z')
    writeAt(a, 'game/a.js', 'a')
    const b = tempDir('h5-order-b')
    writeAt(b, 'game/a.js', 'a')
    writeAt(b, 'game/z.js', 'z')
    writeAt(b, 'game/index.html', 'i')
    expect(hashHtml5Folder(join(a, 'game'))).toBe(hashHtml5Folder(join(b, 'game')))
  })
})

describe('html5SidecarPath', () => {
  it('prefers <folder>.json next to the folder and falls back to game.json inside it', () => {
    const parent = tempDir('h5-sidecar')
    const game = makeGame(parent, 'blaster')
    expect(html5SidecarPath(game)).toBeUndefined()
    writeAt(game, 'game.json', '{}')
    expect(html5SidecarPath(game)).toBe(join(game, 'game.json'))
    writeAt(parent, 'blaster.json', '{}')
    expect(html5SidecarPath(game)).toBe(join(parent, 'blaster.json'))
  })
})
