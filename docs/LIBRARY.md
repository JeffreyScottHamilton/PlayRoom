# Game library: licences and compatibility

This page lists every game published in `src/data/games.json` (the live manifest), with the
evidence for its redistribution permission and the result of the automated compatibility check.
Every licence link points at the licence text in the developer's own repository, which the
import sidecar in `.import-staging/` also records as `license.source`.

## Compatibility levels

- **verified**: loads and renders in Ruffle (automated check). The headless check opened the
  game, waited up to 20 s for it to load, clicked the player centre twice (3 s after each click),
  waited and confirmed the frame is not blank. No Ruffle error, panic or page error occurred, and the
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
Text shown on the game's own title screen was used for Bump!, Clouds Don't Like Copters, Mofle and
Bounce. Otherwise the developer README is used (Moto, Red Rogue, Star Catch), or the candidate notes
(Sweet Smash: mouse). Where nothing is documented, the game page says so. `needsKeyboard` is `false`
only for games whose controls are mouse-only (or mouse-or-keys, as Clouds Don't Like Copters).
Unknown-control games are set `true` as a conservative default.

## Curation

Set by the maintainer, not measured: **Papa's Pizzeria** is the featured game. Popular order: 1 Papa's Pizzeria, 2 Run 2, 3 Bloons Tower Defense, 4 The Fancy Pants Adventure, 5 Learn to Fly, 6 The World's Hardest Game, 7 Duck Life, 8 Age of War, 9 Bloxorz, 10 Riddle School, 11 Star Catch, 12 Red Rogue.

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
- **Colour Match** and **Pixel Shooter**: re-captured after two clicks, so the thumbnails show the game's
  own title or play screen rather than Ruffle's play overlay. The Colour Match thumbnail is a crop of a
  portrait screen (405x720), so it shows only part of the scene.
- **Ending**, **Bogus Quest**, **Fruit Madness** and others with no documented controls: the controls
  text says so. Verify controls in a browser before relying on them.

## Network notes

- mofle and recycle-sort attempt requests to external hosts that no longer resolve (likely old
  high-score/analytics endpoints). Harmless: failed requests only.

## Rejected or not published

| Candidate | Result | Reason |
|---|---|---|
| DotDot (Ethan Kennerly, MIT) | unpublished; draft kept in `src/data/games.import.json` with an UNPUBLISHED note; SWF and thumbnail removed from `public/games/` | music by Jade Brewer — permission not verified |
| Shape Wars (rnand, Unlicense) | unsupported, not published | Loads with no Ruffle error, but the frame stays blank after a click and a Space key press. The check also logged a 404 and a blocked external request. SWF and thumbnail are not in `public/games/`; the draft remains in `src/data/games.import.json` with `compatibility: unsupported`; the SWF is in `.import-staging/shape-wars/`. |
| Candidates #14 Subtle Tea, #15 Salsa, #20 to #34, sources S1 to S9 | not in this slice | Not in the approved list (`library-candidates.md` section A, #1-13 and #16-19 only). |

## Method

1. Each SWF was downloaded from its candidate "SWF direct URL" into `.import-staging/<id>/` (Bump! from `bin/bump.swf`).
2. Each licence proof URL was fetched and checked for the licence named in the candidate notes.
3. A sidecar (`game.json`) was written per game from the developer's README wording. Where the README gave no description, the description was limited to the candidate notes.
4. `node scripts/import-games.mjs .import-staging` produced drafts; `node scripts/capture-thumbnails.mjs` checked each draft in headless Ruffle and wrote the thumbnail.
5. `node scripts/promote-game.mjs <id> --compat=<verified|partial>` moved each passing draft into `src/data/games.json`.


## Owner-asserted titles (proof of concept)

**These titles are not independently licence-verified and must not be deployed publicly without written permission from the rights-holder.**

The owner of the PLAYROOM project asserted on 2026-11-16 that they hold permission from the rights-holders for a private proof of concept, and instructed that the games in the chilibowlflash repository (https://github.com/CBGamesdev/chilibowlflash) be imported. No written permission has been seen. Each entry's `license.type` is `Owner-asserted permission (proof of concept) — not independently verified`, with the repository as `license.source`.

Excluded from the import: the SoundManager 2 and XAudioJS helper SWFs (not games). No byte-identical duplicates were found. Developers are given only where credited on the game's own screens; otherwise omitted. Descriptions are generic genre lines, controls are not documented unless stated, and release years are omitted.

Compatibility comes from the automated Ruffle check (`scripts/capture-thumbnails.mjs`), not play-testing. Thumbnails were captured with Ruffle's hardware-acceleration notice closed. A few still show a splash or sponsor screen, not a title screen: Abobbos Big Adventure, Alien Hominid, Portal, Mario Combat and Meat Boy.

| Title | Developer | Compatibility | Source file |
|---|---|---|---|
| Defend Your Castle |  | verified | `102209_castle202c.swf` |
| Gunblood |  | partial | `1gunblood.swf` |
| Donkey Kong |  | verified | `Donkey-Kong.swf` |
| Learn to Fly | Light Bringer | verified | `Learn20Fly.swf` |
| Mario Combat |  | partial | `Mario_Combat.swf` |
| Portal |  | verified | `Portal_wcs2.swf` |
| The Impossible Quiz |  | verified | `TheImpossibleQuiz.swf` |
| Abobbos Big Adventure |  | partial | `abobbos-big-adventure.swf` |
| Age of War | louissi | verified | `age_of_war.swf` |
| Alien Hominid |  | verified | `alien_hominid (1).swf` |
| Asteroids |  | verified | `asteroids.swf` |
| Bad Piggies |  | partial | `bad-piggies.swf` |
| Bloody Rage |  | verified | `bloodyrage.swf` |
| Bloons Tower Defense |  | partial | `bloonstd.swf` |
| Bloxorz |  | verified | `bloxorz.swf` |
| Blue Tetris |  | verified | `blue_tetris.swf` |
| Bubble Shooter |  | verified | `bubble-shooter.swf` |
| Color Combat |  | verified | `color_combat.swf` |
| Commando 2 |  | verified | `commando2_1.swf` |
| Cubefield | Max Abernethy Plecko | verified | `cubefield.swf` |
| Dad N Me |  | verified | `dadnme.swf` |
| Meat Boy |  | partial | `dagobah_Meat_Boy.swf` |
| Super Mario Flash |  | verified | `dagobah_super_mario_flash.swf` |
| Duck Hunt |  | verified | `duckhunt.swf` |
| Duck Life |  | partial | `ducklife.swf` |
| Duck Life 2 |  | verified | `ducklife2worldchampion.swf` |
| Duck Life 3 |  | partial | `ducklife3.swf` |
| Electricman 2HS |  | verified | `electricman2.swf` |
| Escaping the Prison |  | verified | `escapingtheprisongame.swf` |
| Extreme Pamplona |  | partial | `extreme-pamplona.swf` |
| The Fancy Pants Adventure | Brad Borne | verified | `fancypantsadventure.swf` |
| Flash Tetris |  | verified | `flash-tetris.swf` |
| Doom |  | verified | `flash/doom.swf` |
| Handless Millionaire |  | verified | `flash/handlessmillionaire.swf` |
| Hobo |  | verified | `hobo.swf` |
| Hobo Prison Brawl |  | verified | `hobo_prison_brawl.swf` |
| Interactive Buddy |  | verified | `ib.swf` |
| Miami Shark | Mausland.de | partial | `miami-shark.swf` |
| Mini-Putt |  | verified | `miniputt.swf` |
| My Friend Pedro | Deadtoast Entertainment | partial | `my-friend-pedro-15980.swf` |
| New York Shark | Felix Wiesner | partial | `new-york-shark-unblocked.swf` |
| Pac-Man |  | verified | `pacman.swf` |
| Papa's Burgeria | Flipline Studios | partial | `papaburger.swf` |
| Papa's Pastaria | Flipline Studios | partial | `papapasta.swf` |
| Papa's Freezeria | Flipline Studios | partial | `papasfreezeria.swf` |
| Papa's Pancakeria | Flipline Studios | partial | `papaspancakeria.swf` |
| Papa's Pizzeria | Flipline Studios | partial | `papaspizzeria_v2.swf` |
| Papa's Sushiria | Flipline Studios | partial | `papassushiria.swf` |
| Papa's Taco Mia | Flipline Studios | partial | `papastacomia.swf` |
| Papa's Wingeria | Flipline Studios | partial | `papawing.swf` |
| Pong |  | verified | `pong.swf` |
| Riddle School |  | verified | `riddleschool.swf` |
| Riddle School 2 |  | verified | `riddleschool2.swf` |
| Riddle School 3 |  | verified | `rs3.swf` |
| Run |  | verified | `run.swf` |
| Run 2 |  | partial | `run2.swf` |
| Smileys War |  | verified | `smileyswarupdate1Mjky.swf` |
| Stealing the Diamond |  | partial | `stealingthediamondgameMTI0MQ==.swf` |
| Stick RPG |  | verified | `stickrpg.swf` |
| Super Mario 63 |  | verified | `supermario63.swf` |
| The Impossible Quiz 2 |  | verified | `theimpossiblequiz2.swf` |
| The World's Hardest Game |  | verified | `theworldshardestgame.swf` |
| The World's Hardest Game 2 |  | verified | `theworldshardestgame2.swf` |
| This Is the Only Level |  | verified | `this_is_the_only_level.swf` |
| Toss the Turtle |  | partial | `toss_the_turtle.swf` |
| Ultimate Flash Sonic |  | verified | `ultimate-flash-sonic.swf` |
| Apple Shooter |  | partial | `weebly_apple_shooter.swf` |
| Yeti Sports | Chris Hilbert | verified | `yetisports1free.swf` |
