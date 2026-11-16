import { readJSON, writeJSON } from "../lib/storage";

export interface StoredListOptions {
  /** Keep at most this many ids (the first ones win). Omit for no cap. */
  max?: number;
}

export interface StoredList {
  /** useSyncExternalStore subscribe: same-tab listeners and cross-tab "storage" events. */
  subscribe: (onChange: () => void) => () => void;
  /** Current list. Identity only changes when the stored value changes. */
  getSnapshot: () => string[];
  /** Replace the list: sanitizes (unique strings, capped), persists, notifies subscribers. */
  set: (next: string[]) => void;
}

function readRaw(key: string): string | null | undefined {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return undefined; // storage blocked: keep the in-memory value
  }
}

/**
 * A localStorage-backed list of game ids shared by every hook instance in the tab.
 * Module-level: call once per key at module load.
 */
export function createStoredList(key: string, opts: StoredListOptions = {}): StoredList {
  const max = opts.max;
  const listeners = new Set<() => void>();
  let lastRaw: string | null | undefined;
  let lastValue: string[] = [];

  function sanitize(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const ids = value.filter((x): x is string => typeof x === "string");
    const unique = [...new Set(ids)];
    return max === undefined ? unique : unique.slice(0, max);
  }

  function getSnapshot(): string[] {
    const raw = readRaw(key);
    if (raw !== undefined && raw !== lastRaw) {
      lastRaw = raw;
      lastValue = sanitize(readJSON<unknown>(key, []));
    }
    return lastValue;
  }

  function set(next: string[]): void {
    lastValue = sanitize(next);
    lastRaw = JSON.stringify(lastValue);
    writeJSON(key, lastValue);
    listeners.forEach((listener) => listener());
  }

  function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { subscribe, getSnapshot, set };
}
