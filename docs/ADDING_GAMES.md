# Adding games to PLAYROOM

This guide is for maintainers adding a game without prior experience of the codebase.
Read it end to end before you start. Nothing here is optional except where marked.

## Rule zero: permission first

A game is added only when you hold written permission to host and embed it. Evidence is
recorded in the game's `license` object:

- `license.type`: the licence or permission in plain words, for example `CC-BY-4.0`, `MIT`,
  `Public domain`, or `Developer permission`.
- `license.source`: a URL or document that proves the permission. A link to the licence
  text, the developer's written consent, or a dated email archive. A bare claim is not
  enough. Without `license.type` and `license.source` the validator refuses the entry.
- `license.notes` (optional): anything a reviewer needs, such as the scope of the permission.

Do not copy games from repositories that do not declare a redistribution licence. Their
presence on the web is not permission.

## The three commands

```bash
npm run import -- <folder> --dry-run   # plan only: prints the table, writes nothing (use first)
npm run import -- <folder>             # copies files and writes drafts
npm run validate                       # checks src/data/games.json (the live manifest)
```

`npm run import` runs `scripts/import-games.mjs`. It never touches the live manifest.
It writes drafts to `src/data/games.import.json` and copies files into `public/games/<id>/`.

## Step 1: prepare a folder

Put the game file in a folder, one game per base name:

```
incoming/
  blaster.swf          # the game (SWF). Required.
  blaster.webp         # thumbnail, 640x400 (16:10). Optional but needed before publishing.
  blaster.json         # sidecar with the metadata you know. Optional.
```

Files pair up by base name: `blaster.swf`, `blaster.webp` and `blaster.json` belong together.
Subfolders are scanned too. Thumbnails in PNG or JPG are copied as-is and flagged
"convert to webp". Convert them to 640x400 WebP before publishing.

### The sidecar (`blaster.json`)

Any subset of the game fields can go in the sidecar. Anything you leave out is reported as
missing; the importer never fills it in for you. Here is a complete example:

```json
{
  "id": "blaster",
  "title": "Blaster",
  "description": "Shoot waves of asteroids before they reach the bottom of the screen.",
  "category": ["Action", "Arcade"],
  "controls": "Arrow keys to move, Space to fire",
  "developer": "Example Studio",
  "releaseYear": 2003,
  "license": {
    "type": "Developer permission",
    "source": "https://example.com/permission-letter-2026-03.pdf",
    "notes": "Email from the developer, 2026-03-02, permits hosting and embedding."
  },
  "needsKeyboard": true
}
```

Rules for the sidecar:

- `category` must use the names in `CATEGORIES` in `src/types/game.ts`: Action, Puzzle,
  Racing, Platformer, Strategy, Sports, Adventure, Arcade. Other names are dropped and flagged.
- `id`, if given, must be kebab-case. Without it the id is made from the title (ASCII,
  lowercase, hyphens), or from the file name if there is no title.
- `compatibility` and `addedAt` in the sidecar are ignored. The importer sets
  `compatibility` to `unsupported` and `addedAt` to today's date for new drafts.
- `gameFile` and `thumbnail` are set by the importer. Do not write them.
- `width` and `height` come from the SWF header. A sidecar value is used only when the header
  cannot be read (see "needs-review" below).
- Leave out `featured` and `popularRank` unless you are curating the home page. Never invent
  popularity numbers.

## Step 2: dry run first

```bash
npm run import -- incoming/ --dry-run
```

You get one row per SWF with these columns:

| Column | Meaning |
|---|---|
| File | The SWF path inside the folder |
| Slug | The id the game will get. It is also the folder name under `public/games/` |
| Size | File size in bytes |
| SWF | Signature and version, for example `CWS v8` |
| Stage | Width x height from the SWF header, or `unknown` |
| Duplicates | The same binary already published or earlier in this batch |
| Missing | Required fields you still need to fill in |
| Action | What the import will do (see below) |

Lines starting with `!` under a row are flags. Read every one before continuing.

### Reading the flags and actions

- **`skip: live entry exists`**: the id is already in `src/data/games.json`. The live entry is
  never overwritten. Rename your game or remove the old one first.
- **`skip: duplicate binary`**: the exact same `game.swf` is already published, or appears
  twice in this folder. Check that you are not adding the same game again.
- **`skip: destination has a different game.swf`**: a folder `public/games/<id>/` already
  holds a different file. Investigate before doing anything.
- **`skip: not a valid SWF`**: the file is not an SWF or its header is corrupt. Find the
  correct file.
- **`possible duplicate title of "<id>"`**: a game with a very similar title exists. The draft
  is still created. Check that this is a different game.
- **`needs-review: ZWS (LZMA)`**: the file is LZMA-compressed and the importer cannot read its
  stage size. Add `width` and `height` to the sidecar, from the game's own documentation or by
  testing it in the browser. Then re-run the import.
- **`sidecar stage size differs from SWF header; header used`**: the sidecar disagrees with the
  file. The header value is used. Check the sidecar.
- **`needsKeyboard defaulted — verify`**: the importer assumed the game needs a keyboard. Set
  `needsKeyboard` in the sidecar after you have tried the game.
- **`invalid category ...`**, **`unknown sidecar field ...`**, **`sidecar unreadable ...`**:
  fix the sidecar and re-run.
- **`convert to webp`**: the thumbnail was copied in its original format. Convert it.

Dry runs write nothing. Run them as often as you like.

## Step 3: run the import

When the dry run looks right:

```bash
npm run import -- incoming/
```

This copies `blaster.swf` to `public/games/blaster/game.swf`, copies the thumbnail to
`public/games/blaster/thumb.webp`, and writes a draft to `src/data/games.import.json`.
Re-running the import updates the draft with the same id. Fields you edited by hand stay,
unless the sidecar or the SWF header provides a new value. `addedAt` is kept from the first run.

## Step 4: complete the draft

Open `src/data/games.import.json`. Each draft has a `missing` list and a `flags` list that
match the table. Fill the gaps by editing the draft directly:

- Add anything missing from the sidecar's list (title, description, category, controls,
  `license.type`, `license.source`, thumbnail).
- Set `needsKeyboard` after testing.
- Leave `compatibility` as `unsupported`. Promotion sets it.
- Do not change `id`, `gameFile`, `thumbnail` paths or `sha256`.

Delete any flag line once you have dealt with it. `missing` should end up empty.

## Step 5: test locally

Promotion moves the draft into the live manifest. Use a compatibility level that tells
visitors the truth while you test.

```bash
npm run import -- incoming/ --dry-run     # sanity check again
node scripts/promote-game.mjs blaster --compat=partial
npm run dev
```

Open `http://localhost:5173/games/blaster` and play the game:

1. The game loads and starts without an error panel.
2. Keyboard controls match the `controls` text.
3. Restart and Fullscreen work.
4. The licence line on the game page is correct.
5. The thumbnail shows on the home page and in the games list.

`npm run dev` runs the validator first. If it fails, the message names the entry and the rule.

Promotion checks the entry and refuses to move it if it breaks a rule. A refusal writes
nothing. The refusal lists only the problems the new entry adds, so fix each one and run
promote again.

## Step 6: finalise

When the game works in the browser, change the compatibility level in
`src/data/games.json`:

- `"verified"` when the game runs as expected in the browser.
- `"partial"` when it runs but has a known limitation. Explain the limitation in the
  description, or add a note to `license.notes` if it concerns permission.
- `"unsupported"` hides the game from every listing. Use it to pull a game without deleting it.

Then run `npm run validate` and `npm run build`. Commit the change with the new files in
`public/games/<id>/` and the updated `src/data/games.json`. Remove the promoted entry from
`src/data/games.import.json` if it is still there (promotion removes it automatically).

Promotion is a one-time move. After it, `src/data/games.json` is the source of truth.

## Removing a game

1. Delete the entry from `src/data/games.json`.
2. Delete the folder `public/games/<id>/`.
3. Run `npm run validate` and `npm run build`.
4. Commit the change with a message that names the game and the reason, for example
   `chore: remove blaster (permission withdrawn)`.

To pull a game temporarily, set `compatibility` to `unsupported` instead. Its files and
entry stay in place.

## Thumbnails

- Size 640x400 pixels, 16:10 aspect ratio, WebP format.
- Name it `thumb.webp` and place it in `public/games/<id>/`. The importer does this when the
  source file is a `.webp` next to the SWF.
- Use a screenshot of the game's own title screen or gameplay. Do not use art you do not
  have permission to reproduce.

The importer does not convert images. Convert PNG or JPG thumbnails with your own image
tool before publishing.
