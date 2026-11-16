import type { Game } from "../types/game";

/**
 * Lowercase, strip diacritics and punctuation, collapse spaces.
 * Apostrophes are removed outright ("Mario's" -> "marios"); other punctuation
 * becomes a space ("Spider-Man" -> "spider man").
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Case-insensitive partial match on title.
 * Rank: title startsWith (0) > word startsWith (1) > includes (2); ties by title.
 * Empty (or punctuation-only) query -> []. Unsupported games are never returned.
 */
export function searchGames(
  query: string,
  games: readonly Game[] = [],
  limit: number = 8,
): Game[] {
  const q = normalize(query);
  if (q === "") return [];

  const ranked: { game: Game; rank: number }[] = [];
  for (const game of games) {
    if (game.compatibility === "unsupported") continue;
    const title = normalize(game.title);
    let rank: number;
    if (title.startsWith(q)) rank = 0;
    else if (title.split(" ").some((word) => word.startsWith(q))) rank = 1;
    else if (title.includes(q)) rank = 2;
    else continue;
    ranked.push({ game, rank });
  }

  ranked.sort(
    (a, b) => a.rank - b.rank || a.game.title.localeCompare(b.game.title),
  );
  return ranked.slice(0, limit).map((r) => r.game);
}
