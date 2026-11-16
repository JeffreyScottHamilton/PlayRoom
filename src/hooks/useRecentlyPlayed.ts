// STUB (S1). Real implementation is slice S4.

// TODO(S4): persist via storage.ts (max 12, most recent first, no duplicates).
export function useRecentlyPlayed(): {
  recent: string[];
  recordPlay: (id: string) => void;
  clearRecent: () => void;
} {
  return {
    recent: [],
    recordPlay: () => {},
    clearRecent: () => {},
  };
}
