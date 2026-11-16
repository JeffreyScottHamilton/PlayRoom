export const CATEGORIES = [
  "Action", "Puzzle", "Racing", "Platformer",
  "Strategy", "Sports", "Adventure", "Arcade",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Compatibility = "verified" | "partial" | "unsupported";

/** Runtime. Omitted = "flash" (all existing entries). */
export type Engine = "flash" | "html5";

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
  /** Runtime. Omitted = "flash" (all existing entries). */
  engine?: Engine;
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
