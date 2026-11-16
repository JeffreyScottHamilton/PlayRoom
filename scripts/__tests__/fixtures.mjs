// Test helpers: synthetic SWF builder and temporary repo/input directories.
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'

function signedBits(v) {
  let n = 1
  while (v >= 2 ** (n - 1) || v < -(2 ** (n - 1))) n++
  return n
}

/**
 * Builds a tiny SWF. `sig` is FWS (uncompressed) or CWS (zlib body).
 * RECT is 0..width*20 by 0..height*20 twips. `padBytes` adds incompressible
 * filler after the header so the compressed stream exceeds the parser's bound.
 */
export function buildSwf({ sig = 'FWS', version = 10, width = 550, height = 400, frameRate = 24, frames = 1, padBytes = 0 } = {}) {
  const values = [0, width * 20, 0, height * 20]
  const nbits = Math.max(...values.map(signedBits))
  const bits = []
  const push = (value, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }
  push(nbits, 5)
  for (const v of values) push(v < 0 ? v + 2 ** nbits : v, nbits)
  while (bits.length % 8 !== 0) bits.push(0)
  const rect = Buffer.alloc(bits.length / 8)
  bits.forEach((bit, i) => {
    if (bit) rect[i >> 3] |= 0x80 >> (i & 7)
  })

  const tail = Buffer.alloc(4)
  tail.writeUInt16LE(frameRate * 256, 0)
  tail.writeUInt16LE(frames, 2)
  const body = Buffer.concat([rect, tail, randomBytes(padBytes)])

  const payload = sig === 'CWS' ? deflateSync(body) : body
  const header = Buffer.alloc(8)
  header.write(sig, 0, 'latin1')
  header[3] = version
  header.writeUInt32LE(8 + body.length, 4)
  return Buffer.concat([header, payload])
}

export function tempDir(label) {
  return mkdtempSync(join(tmpdir(), `playroom-${label}-`))
}

export function writeAt(root, rel, content) {
  const full = join(root, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  return full
}

/** A fixture repo root: empty manifest, no drafts, no published games. */
export function fixtureRoot(liveEntries = []) {
  const root = tempDir('repo')
  writeAt(root, 'src/data/games.json', `${JSON.stringify(liveEntries, null, 2)}\n`)
  mkdirSync(join(root, 'public', 'games'), { recursive: true })
  return root
}

/** A complete, valid live entry for fixtures. */
export function liveEntry(overrides = {}) {
  return {
    id: 'existing',
    title: 'Existing Game',
    description: 'An existing game.',
    category: ['Arcade'],
    thumbnail: '/games/existing/thumb.webp',
    gameFile: '/games/existing/game.swf',
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
