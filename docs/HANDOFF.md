# Session handoff

Working notes so the next session can resume without the chat. Keep this file current;
delete finished items rather than letting it grow.

## State (2026-11-16, branch `claude/laughing-euler-pi58fk`)

- `origin/claude/nifty-bell-9ujhdb` (f714d16, developer credits checked against sources,
  unconfirmed ones removed) is merged into this branch (fast-forward).
- HTML5 engine (docs/ARCHITECTURE.md §13) is implemented; 14 open-licensed html5 games added.

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

| Game | Repo | Licence | Compatibility |
|---|---|---|---|
| Space Huggers | KilledByAPixel/SpaceHuggers | GPL-3.0 | verified (responsive) |
| Elematter | jackrugile/elematter-js13k (prebuilt `build/`) | MIT | verified |
| ONOFF | starzonmyarmz/js13k-2018 (built; module inlined) | MIT | verified |
| Underrun | phoboslab/underrun (built; PNGs inlined) | MIT | verified |
| 2048 | gabrielecirulli/2048 | MIT | partial: no saves (responsive) |
| Radius Raid | jackrugile/radius-raid-js13k | MIT | partial: no saves |
| The Last Spartan | ferronsays/js13k-TheLastSpartan (prebuilt `dist/`) | MIT | partial: no saves |
| Bounce Back | KilledByAPixel/BounceBack | GPL-2.0-or-later | partial: no saves (responsive) |
| Black Hole Square | Quinten/black-hole-square (prebuilt `public/`) | MIT | partial: no saves (responsive) |
| SpacePi | jackrugile/spacepi-js13k | MIT | partial: no saves |
| Hextris | Hextris/hextris (ads/analytics removed) | GPL-3.0-or-later | partial: no saves (responsive) |
| A Dark Room | doublespeakgames/adarkroom (jQuery vendored, analytics removed, audio via script tags) | MPL-2.0 | partial: no saves (responsive) |
| Stolen Sword | chiaogu/stolen-sword (built) | MIT | partial: no saves; 11x16 frame from its ASPECT_RATIO |
| The Wandering Wraith | tulustul/The-Wandering-Wraith (built) | MIT | partial: no saves (responsive) |

All 14 imported and promoted 2026-11-16; each loads with 0 errors in the sandboxed iframe in
the built app (Chromium). "partial: no saves" = uses the storage stand-in; the description
says progress is not saved between visits. Not yet done: hands-on play-through of each game
by a person.

Rejected, never add: Chrome Dino, Mario JS, Super Bowser's World, Reversed, Racer,
Tetris/Pong/Breakout clones, Clumsy Bird, Q1K3, Highway 404.

## Decisions made by the owner (2026-11-16)

- Pages deploy: approved. `main` 9e8da21 switches `.github/workflows/pages.yml` to
  `npm run build:pages` (open-licensed only; 68 owner-asserted titles not deployed).
- Games with no fixed size: approved adding `responsive: true` (html5 only; width/height
  omitted; player uses a 16:9 frame). Used for Space Huggers, 2048, Bounce Back,
  Black Hole Square, The Wandering Wraith.

## Known leftovers

- `src/data/games.import.json` still holds older drafts `shape-wars` and `dotdot` whose
  `game.swf` is missing (not from this work).
