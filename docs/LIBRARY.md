# Game library: licences and compatibility

This page lists every game published in `src/data/games.json` (the live manifest), with the
evidence for its redistribution permission and the result of the automated compatibility check.
Every licence link points at the licence text in the developer's own repository, which the
import sidecar in `.import-staging/` also records as `license.source`.

## Compatibility levels

- **verified**: loads and renders in Ruffle (automated check). The headless check opened the
  game, waited up to 20 s for it to load, clicked the player centre once, waited 3 s and
  confirmed the frame is not blank. No Ruffle error, panic or page error occurred, and the
  browser console had no errors or warnings for the game. **This does not prove gameplay**:
  controls, progression and audio were not played by a person.
- **partial**: loads and renders in Ruffle, but the check recorded console errors or
  warnings (for example failed network requests or 404s), or the game is ZWS (LZMA) and its
  header could not be parsed by the importer. Known limitations are listed under Notes.
- **unsupported**: not published. Failed load, Ruffle error, or a blank frame.

The check is `scripts/capture-thumbnails.mjs`. Thumbnails (640x400 WebP, cover crop) come from
the same run. Nothing has been played by hand.

## Published games

Added 2026-11-16. Licence links point at the proof of permission used for `license.source`.

| Title | Developer | Licence (proof) | Source repository | Compatibility | Date added |
|---|---|---|---|---|---|
| Bogus Quest | kranzky | [Unlicense (public domain)](https://raw.githubusercontent.com/kranzky/bogus_quest/master/UNLICENSE) | [repo](https://github.com/kranzky/bogus_quest) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Bounce | Ethan Kennerly | [MIT](https://raw.githubusercontent.com/ethankennerly/screen/master/LICENSE) | [repo](https://github.com/ethankennerly/screen) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Bump! | Rob Miller (st33d) | [MIT and GPL-3.0](https://raw.githubusercontent.com/st33d/bump/master/LICENSE) | [repo](https://github.com/st33d/bump) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Clouds Don't Like Copters | Isa Hassen | [GPL-2.0](https://raw.githubusercontent.com/ibnIrshad/cloudcopter/master/LICENSE) | [repo](https://github.com/ibnIrshad/cloudcopter) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Colour Match | Ian Ramzy | [MIT](https://raw.githubusercontent.com/ianramzy/colour-match/master/LICENSE) | [repo](https://github.com/ianramzy/colour-match) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| DotDot | Ethan Kennerly | [MIT](https://raw.githubusercontent.com/ethankennerly/connectedworlds/master/LICENSE) | [repo](https://github.com/ethankennerly/connectedworlds) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Ending | Rob Miller | [GPL-2.0](https://raw.githubusercontent.com/st33d/Ending/master/LICENSE) | [repo](https://github.com/st33d/Ending) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Entity Asteroids | Iain Lobb | [MIT](https://raw.githubusercontent.com/iainlobb/EntityAsteroids/master/MIT-LICENSE.txt) | [repo](https://github.com/iainlobb/EntityAsteroids) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Fruit Madness | Vladimir "Leinstay" Belyaev | [MIT](https://raw.githubusercontent.com/leinstay/fruitmadness/main/LICENSE) | [repo](https://github.com/leinstay/fruitmadness) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Moto | Ciro Durán | [WTFPL v2](https://raw.githubusercontent.com/chiguire/moto-game/master/LICENSE.TXT) | [repo](https://github.com/chiguire/moto-game) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Pixel Shooter | Ian Ramzy | [MIT](https://raw.githubusercontent.com/ianramzy/pixel-shooter/master/LICENSE) | [repo](https://github.com/ianramzy/pixel-shooter) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Red Rogue | Rob Miller | [GPL-3.0](https://raw.githubusercontent.com/st33d/red-rogue/master/licence.txt) | [repo](https://github.com/st33d/red-rogue) | verified (loads and renders in Ruffle, automated check) | 2026-11-16 |
| Mofle | Sindre Sorhus | [MIT](https://raw.githubusercontent.com/sindresorhus/moflegame/main/license) | [repo](https://github.com/sindresorhus/moflegame) | partial (loads and renders in Ruffle, automated check; see notes) | 2026-11-16 |
| Recycle Sort | Ethan Kennerly | [MIT](https://raw.githubusercontent.com/ethankennerly/recyclesort/master/LICENSE) | [repo](https://github.com/ethankennerly/recyclesort) | partial (loads and renders in Ruffle, automated check; see notes) | 2026-11-16 |
| Star Catch | Mhatxotic Design | [MIT](https://raw.githubusercontent.com/Mhatxotic/StarCatch/master/license.md) | [repo](https://github.com/Mhatxotic/StarCatch) | partial (loads and renders in Ruffle, automated check; see notes) | 2026-11-16 |
| Sweet Smash | Matthew Farmer (MFarmer) | [GPL-2.0](https://raw.githubusercontent.com/mfarmer/sweet-smash/master/License) | [repo](https://github.com/mfarmer/sweet-smash) | partial (loads and renders in Ruffle, automated check; see notes) | 2026-11-16 |

Controls are copied from the developer's README or the candidate notes where documented.
Where they are not, the game page says so. `needsKeyboard` is `false` only for games whose
documented controls are mouse-only. Unknown-control games are set `true` as a conservative default.

## Notes on published games

- **Star Catch**: the SWF is ZWS (LZMA). The importer could not read its stage size, so 640x480 came
  from the Ruffle runtime. The developer's README lists Ruffle limitations: title and stage music
  do not loop, the score does not update until a new stage starts, and the quality and full-screen keys may not work.
- **Mofle**: the developer's README says high scores do not work. The check logged failed
  network requests (name resolution failed in the sandbox).
- **Recycle Sort**: the check logged many failed network requests (name resolution failed in the sandbox).
  The game still renders. The destination host was not identified.
- **Sweet Smash**: the developer's README labels it Beta. The check logged 404 responses.
- **Bump!**: the repository licences are MIT (LICENSE) and GPL-3.0 (licence.txt). The README says
  only "This is the source code for Bump!", so the description is limited to what the candidate notes state.
- **Moto**: bundles Flixel 2.5 (MIT) and as3signals. Their licence texts are not reproduced on the
  site. Adding them is a follow-up.
- **Bounce**: made with the Box2D test bed. Box2D is third-party code under the zlib licence.
- **DotDot**: the developer's README credits musical notes from a song by Jade Brewer. That
  permission has not been verified. Remove the game if it cannot be confirmed.
- **Colour Match** and **Pixel Shooter**: the thumbnails were captured with Ruffle's play-button
  overlay still visible. Replace the thumbnails with a gameplay screenshot if you want better art.
- **Ending**, **Bogus Quest**, **Fruit Madness** and others with no documented controls: the controls
  text says so. Verify controls in a browser before relying on them.

## Rejected or not published

| Candidate | Result | Reason |
|---|---|---|
| Shape Wars (rnand, Unlicense) | unsupported, not published | Loads with no Ruffle error, but the frame stays blank after a click and a Space key press. The check also logged a 404 and a blocked external request. SWF and thumbnail are not in `public/games/`; the draft remains in `src/data/games.import.json` with `compatibility: unsupported`; the SWF is in `.import-staging/shape-wars/`. |
| Candidates #14 Subtle Tea, #15 Salsa, #20 to #34, sources S1 to S9 | not in this slice | Not in the approved list (`library-candidates.md` section A, #1-13 and #16-19 only). |

## Method

1. Each SWF was downloaded from its candidate "SWF direct URL" into `.import-staging/<id>/` (Bump! from `bin/bump.swf`).
2. Each licence proof URL was fetched and checked for the licence named in the candidate notes.
3. A sidecar (`game.json`) was written per game from the developer's README wording. Where the README gave no description, the description was limited to the candidate notes.
4. `node scripts/import-games.mjs .import-staging` produced drafts; `node scripts/capture-thumbnails.mjs` checked each draft in headless Ruffle and wrote the thumbnail.
5. `node scripts/promote-game.mjs <id> --compat=<verified|partial>` moved each passing draft into `src/data/games.json`.
