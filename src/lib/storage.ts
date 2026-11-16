// Safe localStorage access. Every access is wrapped; these functions never throw.

export const STORAGE_KEYS = {
  favorites: "playroom:favorites",
  recent: "playroom:recent",
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: ignore, the app keeps working without persistence.
  }
}
