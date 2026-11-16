// Copies the self-hosted Ruffle runtime from node_modules into public/ruffle/.
// Idempotent: the destination is cleared and re-copied on every run.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@ruffle-rs', 'ruffle')
const dest = join(root, 'public', 'ruffle')

if (!existsSync(src)) {
  console.error(
    'copy-ruffle: @ruffle-rs/ruffle is not installed. Run `npm install` first.',
  )
  process.exit(1)
}

const KEEP = /\.(js|js\.map|wasm)$|^LICENSE/i

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })

let copied = 0
for (const name of readdirSync(src)) {
  if (!KEEP.test(name)) continue
  cpSync(join(src, name), join(dest, name))
  copied++
}

if (!existsSync(join(dest, 'ruffle.js'))) {
  console.error('copy-ruffle: ruffle.js was not found in the Ruffle package.')
  process.exit(1)
}

console.log(`copy-ruffle: copied ${copied} files to public/ruffle/`)
