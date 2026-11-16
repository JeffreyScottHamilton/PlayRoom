import type { Category, Game } from "../types/game";
import gamesJson from "./games.json";

function byTitle(a: Game, b: Game): number {
  return a.title.localeCompare(b.title);
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

const catalog = createCatalog(gamesJson as Game[]);

export const allGames: readonly Game[] = catalog.allGames;
export const getGame = catalog.getGame;
export const getPopularGames = catalog.getPopularGames;
export const getRecentlyAdded = catalog.getRecentlyAdded;
export const getFeaturedGame = catalog.getFeaturedGame;
export const getGamesByCategory = catalog.getGamesByCategory;
export const getRelatedGames = catalog.getRelatedGames;
