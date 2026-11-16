# PLAYROOM

The games you grew up with.

PLAYROOM is a browser library of classic Flash games. Find a game, click it, and play it
instantly, with Ruffle running the SWF files in your browser. There are no accounts, no backend,
and no analytics.

## Requirements

- Node.js 20 or later
- npm

## Setup

```bash
npm ci
npm run dev
```

`npm run dev` copies the Ruffle runtime into `public/ruffle/` and validates the game manifest
before starting Vite. Open the URL that Vite prints.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server. `predev` copies Ruffle and runs the validator first. |
| `npm run build` | Type-checks with `tsc -b`, then builds static output to `dist/`. `prebuild` copies Ruffle and runs the validator first. |
| `npm run preview` | Serves the built `dist/` folder locally. |
| `npm test` | Runs the Vitest suite once. |
| `npm run lint` | Runs oxlint. |
| `npm run validate` | Checks `src/data/games.json` against the licensing and data rules. Exits 1 on any error. |
| `npm run import -- <folder>` | Imports SWF files and sidecar metadata from a folder into draft entries. Add `--dry-run` to only print the plan. |
| `npm run e2e` | Runs `npm run build`, then the Node Playwright script `e2e/player.spec.mjs`. Playwright is not listed in `package.json`, so install it separately. |

## Project structure

```
public/
  games/<id>/game.swf      # game binary (only for games with verified permission)
  games/<id>/thumb.webp    # 640x400 thumbnail
  ruffle/                  # generated at predev/prebuild, gitignored
scripts/
  copy-ruffle.mjs          # copies @ruffle-rs/ruffle into public/ruffle
  validate-games.mjs       # manifest validator
  import-games.mjs         # import workflow for new games
src/
  data/games.json          # the live game manifest
  data/catalog.ts          # typed accessors over the manifest
  player/                  # Ruffle loader and player component
  pages/                   # Home, Games, Game, Favorites, NotFound
  components/              # layout, UI, search, home
docs/
  ARCHITECTURE.md          # technical contract and design decisions
  ADDING_GAMES.md          # maintainer guide for adding games
  LIBRARY.md               # published games, licences and compatibility
vercel.json                # build settings and SPA routing
.github/workflows/pages.yml # manual GitHub Pages deployment
```

## Game library and licensing

PLAYROOM publishes only games for which redistribution permission has been verified. Every
entry in `src/data/games.json` must carry a `license` object with `type` and `source`, where
`source` links to the document or licence text that proves permission. The validator
(`npm run validate`, also run by `predev` and `prebuild`) fails the build if any entry is missing
this proof, has a duplicate `id`, points to a missing file, uses an unknown category, or has an
invalid `addedAt` date. A game without verified permission is not added to the manifest.

- [docs/LIBRARY.md](docs/LIBRARY.md): every published game, its licence and its compatibility result.
- [docs/ADDING_GAMES.md](docs/ADDING_GAMES.md): the full maintainer procedure.

## Adding games

1. **Import.** Put the SWF, an optional `.webp` thumbnail and an optional `.json` sidecar in a
   folder, then run `npm run import -- <folder> --dry-run` and then `npm run import -- <folder>`.
   The import writes drafts to `src/data/games.import.json`, never to the live manifest.
2. **Review flags.** Read every flag in the import output and complete the draft: title,
   description, category, controls, `license.type`, `license.source` and a thumbnail.
3. **Promote.** Run `node scripts/promote-game.mjs <id> --compat=<level>` to move the entry into
   `src/data/games.json`. Use `partial` or `verified` only after checking the game yourself.
4. **Test.** Run `npm run validate`, `npm test` and `npm run build`, then play the game in
   `npm run dev`.

Details, including the sidecar format and the flag reference, are in
[docs/ADDING_GAMES.md](docs/ADDING_GAMES.md).

## Ruffle

PLAYROOM runs Flash content with [Ruffle](https://ruffle.rs/), version 0.7.1 of
`@ruffle-rs/ruffle`. The runtime is self-hosted: `scripts/copy-ruffle.mjs` copies it from
`node_modules` into `public/ruffle/` at `predev` and `prebuild`, so no third-party CDN is
needed. Ruffle is loaded only on the game page.

Each game has a compatibility level:

- **verified**: loads and renders in Ruffle in an automated check. This does not prove that
  gameplay was tested by a person.
- **partial**: loads and renders, but the check recorded errors or warnings, or a known
  limitation applies. The game page shows a notice.
- **unsupported**: not published. These entries stay in the manifest but are hidden from every
  listing.

## Deploying

Three targets are supported. The build reads two environment variables:

- `BASE_PATH` sets the URL prefix (default `/`). GitHub Pages project sites need `/PlayRoom/`.
- `VITE_LIBRARY` sets the library scope: `all` (default, every published game) or `open` (no
  owner-asserted games).

### GitHub Pages (open-licensed games only)

1. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Go to **Actions → Deploy to GitHub Pages**, choose **Run workflow**.
3. The site is served at `https://<user>.github.io/PlayRoom/`.

The workflow runs `npm run build:pages`, which sets `BASE_PATH=/PlayRoom/` and
`VITE_LIBRARY=open`, then `scripts/postbuild-pages.mjs` removes owner-asserted game folders from
`dist/`, copies `index.html` to `404.html` for client-side routes, and writes `.nojekyll`.

On the Free, Pro and Team plans, a GitHub Pages site is **public even when the repository is
private**. Private Pages visibility requires GitHub Enterprise Cloud. That is why `build:pages`
ships only openly-licensed games. Building with `VITE_LIBRARY=all`, or publishing
the owner-asserted titles any other way, makes them public and requires written permission from
each rights-holder.

### Cloudflare Pages with Cloudflare Access (full library, private)

Use this to host the full library behind a login.

- Build command: `npm run build`. Output directory: `dist`.
- Put the site behind a **Cloudflare Access** application so that only allowed accounts can open it.

### Vercel

`vercel.json` is kept. It sets the build to `npm run build`, the output to `dist`, and rewrites
non-file routes to `/index.html`. Vercel's Hobby plan limits uploads to 100 MB. The full library
(about 263 MB) exceeds that, so Vercel suits the open-licensed build only.

## Credits

- [Ruffle](https://ruffle.rs/) by the Ruffle contributors, licensed under MIT or Apache-2.0.
- Games are credited to their developers, with the licence for each one, in
  [docs/LIBRARY.md](docs/LIBRARY.md).
- [Inter](https://rsms.me/inter/) font, used through `@fontsource-variable/inter`, licensed under
  the SIL Open Font License 1.1.
