// STUB (S1). Real search implementation is slice S4.
import type { Game } from "../types/game";

// TODO(S4): lowercase, strip diacritics & punctuation, collapse spaces.
export function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// TODO(S4): implement ranked title search.
export function searchGames(
  _query: string,
  _games: readonly Game[] = [],
  _limit: number = 8,
): Game[] {
  return [];
}
