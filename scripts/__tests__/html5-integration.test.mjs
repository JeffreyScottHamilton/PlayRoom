// @vitest-environment node
// Import -> promote -> validate for an html5 game, in a temp project root only.
// The real src/data/games.json and public/games are never read or written here.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runImport } from '../import-games.mjs'
import { promoteGame } from '../promote-game.mjs'
import { validateGames } from '../validate-games.mjs'
import { fixtureRoot, tempDir, writeAt } from './fixtures.mjs'

const TODAY = '2026-11-16'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/** Synthetic html5 game: index.html, a script, a thumbnail beside the folder, and a sidecar. */
function syntheticGame() {
  const input = tempDir('h5-int')
  writeAt(input, 'sky-runner/index.html', '<!doctype html><canvas id="c"></canvas><script src="game.js"></script>')
  writeAt(input, 'sky-runner/game.js', 'const c = document.getElementById("c")')
  writeAt(input, 'sky-runner.webp', Buffer.from('RIFF'))
  writeAt(
    input,
    'sky-runner.json',
    JSON.stringify({
      title: 'Sky Runner',
      description: 'A synthetic HTML5 test game.',
      category: ['Platformer'],
      controls: 'Arrow keys',
      engine: 'html5',
      width: 800,
      height: 600,
      license: { type: 'Developer permission', source: 'https://example.com/permission-letter.pdf' },
    }),
  )
  return input
}

describe('html5 import to validate', () => {
  it('imports, promotes with compat=partial, and the promoted entry passes validateGames', () => {
    const root = fixtureRoot()
    const input = syntheticGame()

    const imported = runImport({ inputDir: input, root, today: TODAY })
    expect(imported.exitCode).toBe(0)
    expect(imported.rows[0]).toMatchObject({ slug: 'sky-runner', swf: 'html5', action: 'draft' })
    expect(existsSync(join(root, 'public/games/sky-runner/html/index.html'))).toBe(true)

    const promoted = promoteGame({ id: 'sky-runner', compat: 'partial', root })
    expect(promoted.ok).toBe(true)

    const live = readJson(join(root, 'src/data/games.json'))
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({
      id: 'sky-runner',
      engine: 'html5',
      gameFile: '/games/sky-runner/html/index.html',
      compatibility: 'partial',
      width: 800,
      height: 600,
    })
    expect(validateGames(live, { root })).toEqual([])
  })

  it('fails validation when an html5 gameFile lives outside /games/<id>/html/', () => {
    const root = fixtureRoot()
    const input = syntheticGame()
    runImport({ inputDir: input, root, today: TODAY })
    const drafts = readJson(join(root, 'src/data/games.import.json'))
    // Point the gameFile at the game folder root, outside html/. The file exists, so only the rule fails.
    writeAt(root, 'public/games/sky-runner/index.html', '<!doctype html>')
    const bad = { ...drafts[0], gameFile: '/games/sky-runner/index.html', compatibility: 'partial' }
    delete bad.missing
    delete bad.flags
    delete bad.sha256

    const errors = validateGames([bad], { root })
    expect(errors).toContain('sky-runner: html5 gameFile must live under /games/sky-runner/html/')

    // The same entry is refused by promotion, so nothing reaches the live manifest.
    writeAt(root, 'src/data/games.import.json', `${JSON.stringify([{ ...drafts[0], gameFile: bad.gameFile }], null, 2)}\n`)
    const promoted = promoteGame({ id: 'sky-runner', compat: 'partial', root })
    expect(promoted.ok).toBe(false)
    expect(promoted.errors).toContain('sky-runner: html5 gameFile must live under /games/sky-runner/html/')
    expect(readJson(join(root, 'src/data/games.json'))).toEqual([])
  })
})
