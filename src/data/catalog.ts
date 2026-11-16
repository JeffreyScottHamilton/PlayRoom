import type { Category, Engine, Game } from "../types/game";
import gamesJson from "./games.json";

function byTitle(a: Game, b: Game): number {
  return a.title.localeCompare(b.title);
}

export type LibraryScope = "all" | "open";

/**
 * VITE_LIBRARY at build time. "open" publishes only entries that are not owner-asserted.
 * vite.config.ts rejects any other value, so this can only be "all" or "open".
 */
export const LIBRARY_SCOPE: LibraryScope =
  import.meta.env.VITE_LIBRARY === "open" ? "open" : "all";

/** True when the licence is a permission asserted by the owner rather than an open licence. */
export function isOwnerAsserted(game: Game): boolean {
  return game.license.type.startsWith("Owner-asserted");
}

/** "open" drops owner-asserted entries; "all" keeps every entry. Pure; returns a new array. */
export function filterByScope(games: readonly Game[], scope: LibraryScope): Game[] {
  return scope === "open" ? games.filter((g) => !isOwnerAsserted(g)) : [...games];
}

/** Runtime for a game. Entries without an engine are Flash (all existing entries). */
export function engineOf(game: Game): Engine {
  return game.engine ?? "flash";
}

/** Player frame for responsive games (no intended size). 16:9. */
export const RESPONSIVE_FRAME = { width: 16, height: 9 } as const;

/**
 * Width/height the player uses. Responsive games get RESPONSIVE_FRAME; a game with no
 * size (only possible if the manifest is invalid) falls back to it as well.
 */
export function frameSize(game: Game): { width: number; height: number } {
  if (game.responsive || game.width === undefined || game.height === undefined) {
    return { width: RESPONSIVE_FRAME.width, height: RESPONSIVE_FRAME.height };
  }
  return { width: game.width, height: game.height };
}

/**
 * Builds the typed accessors over an arbitrary games array. Unsupported entries
 * are hidden from every accessor. Tests use this with fixtures; the module-level
 * exports below bind it to games.json.
 */
export function createCatalog(games: readonly Game[]) {
  const allGames: readonly Game[] = games.filter(
    (g) => g.compatibility !== "unsupported",
  );

  function getGame(id: string): Game | undefined {
    return allGames.find((g) => g.id === id);
  }

  function getPopularGames(limit: number = 12): Game[] {
    return allGames
      .filter((g) => g.popularRank !== undefined)
      .sort((a, b) => {
        const diff = (a.popularRank ?? 0) - (b.popularRank ?? 0);
        return diff !== 0 ? diff : byTitle(a, b);
      })
      .slice(0, limit);
  }

  function getRecentlyAdded(limit: number = 12): Game[] {
    return [...allGames]
      .sort((a, b) => {
        if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? 1 : -1;
        return byTitle(a, b);
      })
      .slice(0, limit);
  }

  function getFeaturedGame(): Game | undefined {
    return allGames.find((g) => g.featured === true) ?? getPopularGames(1)[0];
  }

  function getGamesByCategory(cat: Category | "All"): Game[] {
    const base =
      cat === "All" ? [...allGames] : allGames.filter((g) => g.category.includes(cat));
    return base.sort(byTitle);
  }

  /** Games sharing at least one category, ordered by shared-category count desc, then title. */
  function getRelatedGames(id: string, limit: number = 6): Game[] {
    const self = getGame(id);
    if (!self) return [];
    const selfCategories = new Set(self.category);

    return allGames
      .filter((g) => g.id !== id)
      .map((g) => ({
        game: g,
        shared: [...new Set(g.category)].filter((c) => selfCategories.has(c)).length,
      }))
      .filter((x) => x.shared > 0)
      .sort((a, b) => b.shared - a.shared || byTitle(a.game, b.game))
      .slice(0, limit)
      .map((x) => x.game);
  }

  return {
    allGames,
    getGame,
    getPopularGames,
    getRecentlyAdded,
    getFeaturedGame,
    getGamesByCategory,
    getRelatedGames,
  };
}

const catalog = createCatalog(filterByScope(gamesJson as Game[], LIBRARY_SCOPE));

export const allGames: readonly Game[] = catalog.allGames;
export const getGame = catalog.getGame;
export const getPopularGames = catalog.getPopularGames;
export const getRecentlyAdded = catalog.getRecentlyAdded;
export const getFeaturedGame = catalog.getFeaturedGame;
export const getGamesByCategory = catalog.getGamesByCategory;
export const getRelatedGames = catalog.getRelatedGames;
