import { useSyncExternalStore } from "react";
import { readJSON, STORAGE_KEYS, writeJSON } from "../lib/storage";

const KEY = STORAGE_KEYS.recent;
const MAX_RECENT = 12;

// Module-level store shared by every component using the hook (same-tab sync).
const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastValue: string[] = [];

function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((x): x is string => typeof x === "string");
  return [...new Set(ids)].slice(0, MAX_RECENT);
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

function recordPlay(id: string): void {
  const current = getSnapshot();
  commit(sanitize([id, ...current.filter((x) => x !== id)]));
}

function clearRecent(): void {
  commit([]);
}

/** Recently played game ids: max 12, most recent first, no duplicates. */
export function useRecentlyPlayed(): {
  recent: string[];
  recordPlay: (id: string) => void;
  clearRecent: () => void;
} {
  const recent = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { recent, recordPlay, clearRecent };
}
