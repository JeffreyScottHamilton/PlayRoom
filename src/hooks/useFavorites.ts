import { useCallback, useSyncExternalStore } from "react";
import { readJSON, STORAGE_KEYS, writeJSON } from "../lib/storage";

const KEY = STORAGE_KEYS.favorites;

// Module-level store shared by every component using the hook (same-tab sync).
const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastValue: string[] = [];

function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((x): x is string => typeof x === "string");
  return [...new Set(ids)];
}

function readRaw(): string | null | undefined {
  try {
    return globalThis.localStorage.getItem(KEY);
  } catch {
    return undefined; // storage blocked: keep the in-memory value
  }
}

function getSnapshot(): string[] {
  const raw = readRaw();
  if (raw !== undefined && raw !== lastRaw) {
    lastRaw = raw;
    lastValue = sanitize(readJSON<unknown>(KEY, []));
  }
  return lastValue;
}

function commit(next: string[]): void {
  lastValue = next;
  lastRaw = JSON.stringify(next);
  writeJSON(KEY, next);
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function toggle(id: string): void {
  const current = getSnapshot();
  commit(
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
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  return { favorites, isFavorite, toggleFavorite: toggle };
}
