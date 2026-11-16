# Session handoff

Working notes so the next session can resume without the chat. Keep this file current;
delete finished items rather than letting it grow.

## State (2026-11-16, branch `claude/laughing-euler-pi58fk`)

- `origin/claude/nifty-bell-9ujhdb` (f714d16, developer credits checked against sources,
  unconfirmed ones removed) is merged into this branch (fast-forward).
- HTML5 engine (docs/ARCHITECTURE.md §13) is implemented; first html5 games are being added.

## HTML5 games: how they are prepared

The player iframe is `sandbox="allow-scripts allow-pointer-lock"`, so a game runs in an
opaque (`null`) origin. Found in real-browser tests:

- Reading `localStorage` throws `SecurityError`. Fix: an inline in-memory storage stand-in
  is injected right after `<head>` in the game's `index.html` (marked with the comment
  `PLAYROOM: the sandboxed iframe has no storage`). It also exposes custom methods games
  add to `Storage.prototype` (Radius Raid, SpacePi). Progress is not saved between visits.
- `navigator.serviceWorker` throws. Black Hole Square's registration is disabled.
- Fetching same-folder fonts is CORS-blocked. 2048's web fonts are inlined as data URIs.
- Each edit is recorded in the entry's `license.notes`.

`license.source` points at the LICENSE file at a pinned commit (raw.githubusercontent.com).
`license.notes` names the repo and commit.

## Game list status

| Game | Repo | Licence (LICENSE file read) | Status |
|---|---|---|---|
| Space Huggers | KilledByAPixel/SpaceHuggers | GPL-3.0 | sandbox-tested OK, importing |
| 2048 | gabrielecirulli/2048 | MIT | OK with font inlining + shim, importing |
| Radius Raid | jackrugile/radius-raid-js13k | MIT | OK with shim, importing |
| The Last Spartan | ferronsays/js13k-TheLastSpartan (prebuilt `dist/`) | MIT | OK with shim, importing |
| Bounce Back | KilledByAPixel/BounceBack | GPL-2.0 | OK with shim, importing |
| Black Hole Square | Quinten/black-hole-square (prebuilt `public/`) | MIT | OK with shim + SW off, importing |
| Elematter | jackrugile/elematter-js13k (prebuilt `build/`) | MIT | sandbox-tested OK, importing |
| SpacePi | jackrugile/spacepi-js13k | MIT | OK with shim, importing |
| ONOFF | starzonmyarmz/js13k-2018 | MIT | needs build (`./bin/build`) |
| The Wandering Wraith | tulustul/The-Wandering-Wraith | MIT | needs build (webpack) |
| Stolen Sword | chiaogu/stolen-sword | MIT | needs build (rollup) |
| Underrun | phoboslab/underrun | MIT | needs build (`build.sh`) |
| Hextris | Hextris/hextris | GPL-3.0 | needs edit: remove Google ads script |
| A Dark Room | doublespeakgames/adarkroom | MPL-2.0 | needs edit: vendor jQuery, remove analytics |

Rejected, never add: Chrome Dino, Mario JS, Super Bowser's World, Reversed, Racer,
Tetris/Pong/Breakout clones, Clumsy Bird, Q1K3, Highway 404.

## Decisions made by the owner (2026-11-16)

- Pages deploy: approved. `main` 9e8da21 switches `.github/workflows/pages.yml` to
  `npm run build:pages` (open-licensed only; 68 owner-asserted titles not deployed).
- Games with no fixed size: approved adding `responsive: true` (html5 only; width/height
  omitted; player uses a 16:9 frame). Used for Space Huggers, 2048, Bounce Back,
  Black Hole Square, The Wandering Wraith.

## Prepared files (scratchpad, lost with the container)

Game folders and sidecars were prepared in the session scratchpad (`incoming/`,
`incoming2/`) and are then imported into `public/games/<id>/html/` and committed. If a
session ends before import, redo from the repo + commit listed in each entry's
`license.notes`; the edits needed are listed there too.
