# PLAYROOM — Architecture & Shared Contract

This file is the contract every implementation slice copies **verbatim**. If something here is wrong, stop and report — do not improvise a different shape.

Tagline: *The games you grew up with.* Find a game → click it → play instantly. No accounts, no backend.

## 1. Stack (pinned)

| Concern | Choice |
|---|---|
| Build | Vite (react-ts template defaults), static output `dist/` |
| UI | React 19 + TypeScript (strict) |
| Routing | `react-router-dom` 7 (`createBrowserRouter`), route-level `React.lazy` code splitting |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`; tokens in `src/styles/index.css` `@theme` |
| Font | `@fontsource-variable/inter` (self-hosted, no Google Fonts request) |
| Flash | `@ruffle-rs/ruffle` **0.7.1**, self-hosted: copied to `public/ruffle/` by `scripts/copy-ruffle.mjs` (runs in `predev`/`prebuild`; `public/ruffle/` is gitignored). Loaded with a `<script>` tag **only on the game page**. |
| Tests | Vitest (+ jsdom, @testing-library/react) for logic and components |
| Hosting | Vercel static; `vercel.json` rewrites all non-file routes to `/index.html` |

No other runtime dependencies without manager approval. No backend, auth, database, analytics.

## 2. Directory layout

```
public/
  games/<id>/game.swf        # local game binary (only for permission-verified games)
  games/<id>/thumb.webp      # 16:10 thumbnail, 640x400
  ruffle/                    # generated, gitignored
scripts/
  copy-ruffle.mjs            # copies node_modules/@ruffle-rs/ruffle -> public/ruffle
  validate-games.mjs         # manifest validator (exit 1 on any error)
  import-games.mjs           # import workflow (section 8)
src/
  main.tsx, router.tsx
  styles/index.css           # tailwind import + @theme tokens + base styles
  types/game.ts              # section 4, verbatim
  data/games.json            # THE manifest (array of Game)
  data/catalog.ts            # typed accessors (section 5)
  lib/search.ts              # searchGames
  lib/storage.ts             # safe localStorage read/write
  hooks/useFavorites.ts
  hooks/useRecentlyPlayed.ts
  components/layout/         # Header, Footer, Layout, Container
  components/ui/             # Button, GameCard, GameGrid, CategoryFilter, SectionHeader, EmptyState
  components/search/SearchBox.tsx
  components/home/           # Hero, FeaturedGame
  player/                    # loadRuffle.ts, RufflePlayer.tsx
  pages/                     # HomePage, GamesPage, GamePage, FavoritesPage, NotFoundPage
docs/ARCHITECTURE.md, docs/ADDING_GAMES.md
vercel.json
```

## 3. Design system

Surface: **Operate** (a library you browse). Personality via type, warm charcoal, game art. Direction card:
1. Mode: Operate. 2. Palette: warm charcoal ground, warm off-white ink, muted brick-red accent used only for primary action + selected state; game art supplies colour. 3. Type: Inter Variable only; scale below. 4. Radius 6px on cards, buttons, inputs and category chips; elevation by **border + surface step**, never shadows. 5. Signature: the letter-spaced uppercase section labels from the reference ("POPULAR GAMES") — used for section headers only. Motion: card thumbnail brightens 6% on hover (150ms ease); nothing else animates.

Tokens (Tailwind 4 `@theme` in `src/styles/index.css` — use the utility names, never raw hex in components):

```css
@theme {
  --color-bg: #111514;
  --color-surface: #1b201f;
  --color-elevated: #252b29;
  --color-ink: #f1ede4;
  --color-ink-muted: #a9ada7;
  --color-line: #343a37;
  --color-accent: #b6463b;
  --color-accent-hover: #ce594d;
  --color-accent-text: #d9665a;  /* accent-coloured text on bg, 5.3:1 */
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --radius-card: 6px;
}
```
→ utilities `bg-bg`, `bg-surface`, `bg-elevated`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `hover:bg-accent-hover`, `text-accent-text` (accent as text colour; `text-accent` is for icons and decoration), `rounded-card`.

Type scale: display 44/48 semibold (hero h1, `text-balance`), h2 section label 13px semibold uppercase tracking-[0.2em], h1 page 28/34 semibold, body 16/26, small 14/20, meta 12/16. Container: `max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8`. Spacing scale: Tailwind default; sections separated by `mt-12`.

Forbidden: gradients (except the single dark-to-transparent legibility overlay on featured art), glows, glass/blur, shadows, emoji, pill buttons, icon+heading+text card rows, filler copy. Icons: inline SVG, 1.75 stroke, `currentColor`.

Accessibility floor: visible `focus-visible` ring (`outline-2 outline-offset-2 outline-ink`), 44px touch targets, text contrast ≥ 4.5:1, `prefers-reduced-motion` disables the hover transition, `color-scheme: dark`, `<meta name="theme-color" content="#111514">`, real favicon (SVG play-triangle in accent).

## 4. Types (`src/types/game.ts`, verbatim)

```ts
export const CATEGORIES = [
  "Action", "Puzzle", "Racing", "Platformer",
  "Strategy", "Sports", "Adventure", "Arcade",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Compatibility = "verified" | "partial" | "unsupported";

export interface GameLicense {
  /** e.g. "CC-BY-4.0", "MIT", "Developer permission", "Public domain" */
  type: string;
  /** URL or document proving permission to redistribute/embed */
  source: string;
  notes?: string;
}

export interface Game {
  id: string;                 // kebab-case slug, unique, equals folder name under public/games
  title: string;
  description: string;
  category: Category[];       // >= 1
  thumbnail: string;          // "/games/<id>/thumb.webp"
  gameFile: string;           // "/games/<id>/game.swf" (local) — remote https URLs only if license permits hotlinking
  controls: string;           // human text, e.g. "Arrow keys to move, Space to jump"
  developer?: string;
  releaseYear?: number;
  compatibility: Compatibility;
  /** ISO date (YYYY-MM-DD) the game was added to PLAYROOM — drives "Recently Added" */
  addedAt: string;
  /** Required for every published entry */
  license: GameLicense;
  /** Native SWF stage size, from the SWF header; drives aspect ratio */
  width: number;
  height: number;
  /** Requires keyboard (true) — shows a mobile notice */
  needsKeyboard: boolean;
  /** Curated "Popular" list position (1 = first). Omit if not curated. No invented stats. */
  popularRank?: number;
  /** Shown in hero when true; exactly one entry should be featured */
  featured?: boolean;
}
```

Fields beyond the brief (`addedAt`, `license`, `width`, `height`, `needsKeyboard`, `popularRank`, `featured`) exist because the brief requires real addition dates, permission verification, correct aspect ratios, mobile notices and a curated popular list. `compatibility: "unsupported"` entries are kept in the manifest but **hidden** from all listings.

## 5. Module interfaces (exact signatures)

```ts
// src/data/catalog.ts
export const allGames: readonly Game[];                 // compatibility !== "unsupported"
export function getGame(id: string): Game | undefined;
export function getPopularGames(limit?: number): Game[];   // by popularRank asc; default 12
export function getRecentlyAdded(limit?: number): Game[];  // by addedAt desc, then title; default 12
export function getFeaturedGame(): Game | undefined;       // featured === true, else first popular
export function getGamesByCategory(cat: Category | "All"): Game[];
export function getRelatedGames(id: string, limit?: number): Game[]; // shared-category count desc, then title; excludes self; default 6

// src/lib/search.ts
export function normalize(s: string): string;            // lowercase, strip diacritics & punctuation, collapse spaces
export function searchGames(query: string, games?: readonly Game[], limit?: number): Game[];
//  case-insensitive partial match on title; rank: title startsWith > word startsWith > includes; ties by title. Empty query -> [].

// src/lib/storage.ts  (every access wrapped in try/catch; never throws)
export function readJSON<T>(key: string, fallback: T): T;
export function writeJSON(key: string, value: unknown): void;
export const STORAGE_KEYS = { favorites: "playroom:favorites", recent: "playroom:recent" } as const;

// src/hooks/useFavorites.ts — array of game ids, newest first; syncs across tabs via "storage" event
export function useFavorites(): {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

// src/hooks/useRecentlyPlayed.ts — max 12 ids, most recent first, no duplicates
export function useRecentlyPlayed(): {
  recent: string[];
  recordPlay: (id: string) => void;
  clearRecent: () => void;
};
// Unknown ids in storage (game removed) are filtered out when rendered.

// src/player/loadRuffle.ts — injects <script src="/ruffle/ruffle.js"> once; resolves window.RufflePlayer
export function loadRuffle(): Promise<RuffleAPI>;

// src/player/RufflePlayer.tsx
export interface RufflePlayerHandle { restart(): void; enterFullscreen(): void; }
export interface RufflePlayerProps {
  src: string; width: number; height: number;
  onStatus?: (s: "loading" | "ready" | "error") => void;
}
// forwardRef<RufflePlayerHandle, RufflePlayerProps>. Container keeps aspect-ratio width/height,
// max-height calc(100dvh - 160px). Ruffle config: autoplay "on", unmuteOverlay "hidden",
// splashScreen false, letterbox "on", contextMenu "rightClickOnly", warnOnUnsupportedContent true.
// Restart = destroy player element and re-create. Fullscreen = requestFullscreen on container.
// Unmount removes the player (stops audio).

// src/components/ui/GameCard.tsx
export function GameCard(props: { game: Game; showFavorite?: boolean }): JSX.Element;
// <Link to={`/games/${id}`}> 16:10 thumbnail (loading="lazy", decoding="async", width/height set,
// fallback block with title initials if image fails) + title (1 line, ellipsis, title attr). Favorite
// toggle button appears on hover/focus (always visible on touch), aria-pressed, aria-label "Add <title> to favorites".

// src/components/ui/GameGrid.tsx
export function GameGrid(props: { games: Game[] }): JSX.Element; // 2 / 3 / 4 / 6 cols at base / sm / md / lg

// src/components/ui/CategoryFilter.tsx
export function CategoryFilter(props: { value: Category | "All"; onChange: (c: Category | "All") => void }): JSX.Element;
// radiogroup semantics; horizontal scroll on mobile; selected = bg-ink text-bg.

// src/components/search/SearchBox.tsx  (used by Header)
export function SearchBox(props: { className?: string }): JSX.Element;
// combobox: results dropdown (max 8), ArrowUp/Down moves, Enter opens selected game (or /games?q= if none selected),
// Escape closes, "No games match “q”" empty state with link to All Games. "/" focuses search when not typing in a field.
```

## 6. Routes

| Path | Page | Notes |
|---|---|---|
| `/` | HomePage | Hero + FeaturedGame, CategoryFilter (filters an inline grid below), Continue Playing (only if recent non-empty), Popular Games, Recently Added |
| `/games` | GamesPage | Query params `q`, `category`; search input + CategoryFilter + GameGrid; "Load more" in pages of 24; empty state |
| `/games/:id` | GamePage | Back link, title, RufflePlayer, toolbar (Fullscreen, Restart, Favorite), compatibility notice for `partial`, mobile keyboard notice when `needsKeyboard`, description, controls, developer/year, license attribution, Related games. Calls `recordPlay(id)` on mount. Unknown id → NotFound content |
| `/categories` | redirect → `/games#categories` | GamesPage focuses the CategoryFilter when hash is `#categories` |
| `/favorites` | FavoritesPage | Grid of favorites; empty state linking to `/games` |
| `*` | NotFoundPage | |

Header nav: Games (`/games`), Categories (`/games` with filter focused), Favorites (`/favorites`). `document.title` = `"<Game> — PLAYROOM"` / `"PLAYROOM — The games you grew up with"`.

Keyboard on GamePage: global shortcuts (`/` search) are disabled while the player has focus; arrow/space keys inside the player must not scroll the page (`preventDefault` on keydown when focus is within the player container for Arrow*, Space).

## 7. Licensing gate (non-negotiable)

`scripts/validate-games.mjs` fails the build (`prebuild`) if any entry: lacks `license.type`/`license.source`; has a duplicate `id`; has `gameFile`/`thumbnail` pointing to a missing local file; has an invalid category; has a non-ISO `addedAt`. A game without verified permission is **not added to the manifest at all**. The source repo `CBGamesdev/chilibowlflash` declares no redistribution licence for its games (its MIT/Apache files cover Ruffle only, and its README disclaims ownership), so **nothing is copied from it**.

Dev/test fixture SWFs (for Ruffle verification) live under `tests/fixtures/` and are never in the manifest.

## 8. Import workflow (`scripts/import-games.mjs`)

`node scripts/import-games.mjs <dir|zip-extracted-dir> [--dry-run]` — Node stdlib only.
1. Walk dir; classify by extension/magic (`FWS`/`CWS`/`ZWS` = SWF; png/jpg/webp = image; json/txt = metadata).
2. Parse SWF header: signature, version, decompress CWS (zlib) to read stage RECT → `width`/`height`. ZWS (LZMA): mark `needs-review`.
3. sha256 each SWF; flag duplicates against existing `public/games/*/game.swf` and within the batch; flag likely title duplicates (normalized title).
4. Read optional sidecar `<name>.json` (any subset of `Game` fields incl. `license`).
5. Copy to `public/games/<slug>/game.swf`, thumbnail to `thumb.webp` (if supplied as png/jpg, copy as-is with original extension and report "convert to webp").
6. Write entries to `src/data/games.import.json` (drafts, NOT the live manifest) with `compatibility: "unsupported"` and a `missing: string[]` report. Never invent metadata.
7. Print a table: file, slug, size, swf version, stage size, duplicates, missing fields.
Promotion = maintainer fills gaps + licence, tests in browser, moves entry into `src/data/games.json`, sets compatibility. Documented in `docs/ADDING_GAMES.md`.

## 9. Scripts (`package.json`)

`dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`), `validate` (`node scripts/validate-games.mjs`), `import` , `predev`/`prebuild`: `node scripts/copy-ruffle.mjs && node scripts/validate-games.mjs`.

## 10. Rulings log

- R1 Extra Game fields added (section 4) — required by brief behaviours. Cost if wrong: small schema edit.
- R2 Ruffle self-hosted from npm, not CDN — no third-party runtime dependency, works offline/cheap. Cost: ~10 MB in deploy (wasm), fine for Vercel.
- R3 Categories follow the written spec (Adventure, Arcade), not the image's "Other".
- R4 No games copied from chilibowlflash (no licence). Library population awaits licensed sources (Phase 4).

## 11. Slice plan (manager-owned)

| Slice | Owner | Blocked by | Owns |
|---|---|---|---|
| S1 Foundation | Haiku worker, alone | — | scaffold, configs, `src/styles`, `src/types`, `src/data`, `src/lib/storage.ts`, `src/router.tsx`, `src/main.tsx`, `components/layout/*` (Header renders SearchBox stub), stub files for every module in §5 that throw-free return placeholders, `scripts/copy-ruffle.mjs`, `scripts/validate-games.mjs`, `vercel.json`, `.gitignore`, test fixture SWF |
| S2 Home + UI | Haiku, parallel | S1 | `components/ui/*`, `components/home/*`, `pages/HomePage.tsx` |
| S3 Player | Haiku, parallel | S1 | `src/player/*`, `pages/GamePage.tsx` |
| S4 Discovery | Haiku, parallel | S1 | `data/catalog.ts`, `lib/search.ts`, `hooks/*`, `components/search/*`, `pages/GamesPage.tsx`, `pages/FavoritesPage.tsx` |
| S5 Import tooling | Haiku, parallel | S1 | `scripts/import-games.mjs`, `docs/ADDING_GAMES.md` |
| S6 Library | Haiku + manager licence review | S5, licensing decision | `public/games/*`, `src/data/games.json` |
| S7 Polish + QA | Haiku; Sonnet reviewer | S2–S6 | fixes as assigned |

## 12. Deployment

- **Base path.** `vite.config.ts` sets `base` from env `BASE_PATH` (default `/`). The GitHub Pages build uses `/PlayRoom/`. The router `basename` is `import.meta.env.BASE_URL` without its trailing slash (`/` maps to no basename).
- **Asset URLs.** Every manifest `thumbnail` and `gameFile`, and the Ruffle script `src` and `publicPath`, go through `assetUrl()` (`src/lib/assetUrl.ts`). A root-relative path gets the base prefix with no double slash. `https:` and protocol-relative URLs are returned unchanged. Manifest values stay root-relative (`/games/<id>/...`).
- **Library scope.** `VITE_LIBRARY` is `all` (default, every entry) or `open` (drops entries whose `license.type` starts with `Owner-asserted`). `vite.config.ts` fails the build on any other value. `catalog.ts` exports `isOwnerAsserted()` and `filterByScope()`; both are pure and tested.
- **Open bundle.** With `open`, the `libraryScopePlugin` in `scripts/vite-library-scope.mjs` rewrites the `src/data/games.json` module before it is bundled, so owner-asserted entries (including their `featured` and `popularRank`) are absent from `dist/assets`. Its predicate mirrors `isOwnerAsserted()`; `scripts/__tests__/vite-library-scope.test.mjs` checks that the two agree on every manifest entry. `scripts/vite-library-scope.d.mts` gives `vite.config.ts` its types.
- **Pages post-build** (`scripts/postbuild-pages.mjs`, run by `npm run build:pages` after the build). Always: copies `dist/index.html` to `dist/404.html` (SPA fallback) and writes an empty `dist/.nojekyll`. With `VITE_LIBRARY=open`: deletes `dist/games/<id>/` for each owner-asserted entry in `src/data/games.json`. Ids must be kebab-case, validated before any deletion. Only paths inside `dist/games` are removed, and symlinks are refused. It then fails if any file in `dist/assets` still contains `/games/<id>/` for an owner-asserted id. It prints counts.
- **Workflow.** `.github/workflows/pages.yml` is `workflow_dispatch` only (a `push` trigger is commented out). It builds with `npm run build:pages` and deploys `dist/` with `actions/deploy-pages`.
- **Other hosts.** Cloudflare Pages with Cloudflare Access serves the full library privately (`npm run build`, output `dist`). Vercel keeps `vercel.json`. Build with the default `/` base and the `all` scope.

## 13. HTML5 games (engine support)

### Type change (`src/types/game.ts`, additive)
```ts
export type Engine = "flash" | "html5";
// in Game:
  /** Runtime. Omitted = "flash" (all existing entries). */
  engine?: Engine;
```
- `flash`: `gameFile` = `/games/<id>/game.swf` (unchanged).
- `html5`: the game's files live in `public/games/<id>/html/`; `gameFile` = `/games/<id>/html/index.html` (or another `.html` inside that folder). `width`/`height` = the game's intended canvas size (aspect ratio); must come from the game itself or the supplier, never guessed — validator requires them as today.
- Helper in `src/data/catalog.ts`: `export function engineOf(game: Game): Engine` (returns `game.engine ?? "flash"`).

### Player (`src/player/Html5Player.tsx`)
Same contract as RufflePlayer: `forwardRef<GamePlayerHandle, GamePlayerProps>` where
```ts
export interface GamePlayerHandle { restart(): void; enterFullscreen(): void; }
export interface GamePlayerProps { src: string; width: number; height: number; onStatus?: (s: "loading" | "ready" | "error") => void; }
```
(`RufflePlayerHandle`/`RufflePlayerProps` become aliases of these.) Renders `<iframe>` inside the same sized, centered, aspect-ratio container (`data-player`, same layout rules as RufflePlayer):
- `sandbox="allow-scripts allow-pointer-lock"` — **never** `allow-same-origin`, `allow-top-navigation`, `allow-popups`, `allow-forms`, `allow-modals`. The game runs in an opaque origin: it cannot read PLAYROOM's localStorage/cookies/DOM. Consequence (accepted): games that require localStorage/IndexedDB saves may fail or lose progress → mark `partial`/`unsupported` after testing.
- `allow="fullscreen; autoplay; gamepad"`, `referrerpolicy="no-referrer"`, `loading="eager"`, title "<Game title> game".
- status: loading → ready on iframe `load`; error if no load within 20 s (Retry re-creates the iframe).
- restart: re-create the iframe (key bump). fullscreen: `requestFullscreen` on the container.
- Click on container focuses the iframe; Arrow/Space scroll guard as RufflePlayer (keys inside the iframe never reach the page anyway).
- GamePage picks the player by `engineOf(game)`; Ruffle is never loaded for html5 games (`loadRuffle` not imported on that path at runtime).

### Validation (`scripts/validate-games.mjs`)
- `engine` absent or one of `flash|html5`.
- flash: gameFile ends `.swf`. html5: gameFile matches `/games/<id>/html/**/*.html` and the file exists; no `..`.
- html5 folder size reported; fail if any single file > 25 MiB (Cloudflare Pages limit).

### Import (`scripts/import-games.mjs`)
- A directory containing `index.html` (top level of an input sub-folder) is an HTML5 game candidate. Copy the whole folder to `public/games/<slug>/html/` (skip dotfiles, `node_modules`, `.git`, symlinks; reject paths escaping the folder).
- Flags: `external-requests` listing distinct `http(s)://` hosts found in its .html/.js/.css (the game may break offline or phone home); `missing-size` if sidecar lacks width/height; `large-file` (> 25 MiB); `inline-iframe-breakout` if code references `top.location`/`parent.location`/`window.top` (informational; sandbox blocks it).
- sha256 of the folder (sorted relative paths + contents) for duplicate detection.
- Draft: `engine: "html5"`, `gameFile: "/games/<slug>/html/index.html"`, compatibility "unsupported" until tested, same no-invention rules.
- `scripts/capture-thumbnails.mjs`: html5 drafts are loaded in the same sandboxed iframe markup and screenshotted.

### Non-goals
No remote/hot-linked HTML5 games, no un-sandboxed mode, no per-game sandbox relaxation, no obfuscated loader bundles. Only named games from a known source with permission recorded in `license`.
