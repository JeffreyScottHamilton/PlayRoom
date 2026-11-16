import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "../lib/storage";
import { createStoredList } from "./storedList";

const MAX_RECENT = 12;
const store = createStoredList(STORAGE_KEYS.recent, { max: MAX_RECENT });

function recordPlay(id: string): void {
  const current = store.getSnapshot();
  store.set([id, ...current.filter((x) => x !== id)]);
}

function clearRecent(): void {
  store.set([]);
}

/** Recently played game ids: max 12, most recent first, no duplicates. */
export function useRecentlyPlayed(): {
  recent: string[];
  recordPlay: (id: string) => void;
  clearRecent: () => void;
} {
  const recent = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { recent, recordPlay, clearRecent };
}
