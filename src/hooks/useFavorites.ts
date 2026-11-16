import { useCallback, useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "../lib/storage";
import { createStoredList } from "./storedList";

const store = createStoredList(STORAGE_KEYS.favorites);

function toggle(id: string): void {
  const current = store.getSnapshot();
  store.set(
    current.includes(id)
      ? current.filter((x) => x !== id)
      : [id, ...current],
  );
}

/** Favorite game ids, newest first. Unknown ids are kept; the page filters them. */
export function useFavorites(): {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
} {
  const favorites = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  return { favorites, isFavorite, toggleFavorite: toggle };
}
