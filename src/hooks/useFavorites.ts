// STUB (S1). Real implementation is slice S4.

// TODO(S4): persist via storage.ts and sync across tabs.
export function useFavorites(): {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
} {
  return {
    favorites: [],
    isFavorite: () => false,
    toggleFavorite: () => {},
  };
}
