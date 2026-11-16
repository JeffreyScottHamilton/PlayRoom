// STUB (S1). Real accessors are implemented in slice S4.
import type { Category, Game } from "../types/game";
import gamesJson from "./games.json";

const games = gamesJson as Game[];

export const allGames: readonly Game[] = games.filter(
  (g) => g.compatibility !== "unsupported",
);

// TODO(S4): implement getGame lookup.
export function getGame(_id: string): Game | undefined {
  return undefined;
}

// TODO(S4): implement popularity ordering.
export function getPopularGames(_limit: number = 12): Game[] {
  return [];
}

// TODO(S4): implement recently-added ordering.
export function getRecentlyAdded(_limit: number = 12): Game[] {
  return [];
}

// TODO(S4): implement featured selection.
export function getFeaturedGame(): Game | undefined {
  return undefined;
}

// TODO(S4): implement category filtering.
export function getGamesByCategory(_cat: Category | "All"): Game[] {
  return [];
}

// TODO(S4): implement related-games scoring.
export function getRelatedGames(_id: string, _limit: number = 6): Game[] {
  return [];
}
