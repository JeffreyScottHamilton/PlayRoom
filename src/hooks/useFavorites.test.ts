import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";
import { useFavorites } from "./useFavorites";
import { useRecentlyPlayed } from "./useRecentlyPlayed";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useFavorites", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite("alpha")).toBe(false);
  });

  it("toggles on and off, newest first", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => result.current.toggleFavorite("alpha"));
    act(() => result.current.toggleFavorite("bravo"));
    expect(result.current.favorites).toEqual(["bravo", "alpha"]);
    expect(result.current.isFavorite("alpha")).toBe(true);

    act(() => result.current.toggleFavorite("alpha"));
    expect(result.current.favorites).toEqual(["bravo"]);
    expect(result.current.isFavorite("alpha")).toBe(false);
  });

  it("persists to localStorage and reads it back on a new mount", () => {
    const first = renderHook(() => useFavorites());
    act(() => first.result.current.toggleFavorite("alpha"));
    act(() => first.result.current.toggleFavorite("bravo"));
    first.unmount();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) ?? "null")).toEqual([
      "bravo",
      "alpha",
    ]);

    const second = renderHook(() => useFavorites());
    expect(second.result.current.favorites).toEqual(["bravo", "alpha"]);
  });

  it("keeps every mounted subscriber in sync within the same tab", () => {
    const a = renderHook(() => useFavorites());
    const b = renderHook(() => useFavorites());

    act(() => a.result.current.toggleFavorite("alpha"));
    expect(b.result.current.favorites).toEqual(["alpha"]);
    expect(b.result.current.isFavorite("alpha")).toBe(true);
  });

  it("treats malformed stored JSON as empty", () => {
    localStorage.setItem(STORAGE_KEYS.favorites, "{not json");
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it("treats a non-array stored value as empty", () => {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it("drops non-string entries and duplicates from stored data", () => {
    localStorage.setItem(
      STORAGE_KEYS.favorites,
      JSON.stringify(["alpha", 3, null, "alpha", "bravo"]),
    );
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual(["alpha", "bravo"]);
  });

  it("updates when another tab changes storage", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);

    act(() => {
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(["charlie"]));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.favorites,
          newValue: JSON.stringify(["charlie"]),
        }),
      );
    });
    expect(result.current.favorites).toEqual(["charlie"]);
  });
});

describe("useRecentlyPlayed", () => {
  it("records plays newest first without duplicates", () => {
    const { result } = renderHook(() => useRecentlyPlayed());

    act(() => result.current.recordPlay("alpha"));
    act(() => result.current.recordPlay("bravo"));
    act(() => result.current.recordPlay("alpha"));
    expect(result.current.recent).toEqual(["alpha", "bravo"]);
  });

  it("caps the list at 12 and drops the oldest", () => {
    const { result } = renderHook(() => useRecentlyPlayed());

    act(() => {
      for (let i = 0; i < 15; i++) result.current.recordPlay(`g${i}`);
    });
    expect(result.current.recent).toHaveLength(12);
    expect(result.current.recent[0]).toBe("g14");
    expect(result.current.recent[11]).toBe("g3");
    expect(result.current.recent).not.toContain("g2");
  });

  it("clears the list", () => {
    const { result } = renderHook(() => useRecentlyPlayed());
    act(() => result.current.recordPlay("alpha"));
    act(() => result.current.clearRecent());
    expect(result.current.recent).toEqual([]);
  });

  it("persists plays and reads them back on a new mount", () => {
    const first = renderHook(() => useRecentlyPlayed());
    act(() => first.result.current.recordPlay("alpha"));
    first.unmount();

    const second = renderHook(() => useRecentlyPlayed());
    expect(second.result.current.recent).toEqual(["alpha"]);
  });

  it("treats malformed stored JSON as empty", () => {
    localStorage.setItem(STORAGE_KEYS.recent, "[oops");
    const { result } = renderHook(() => useRecentlyPlayed());
    expect(result.current.recent).toEqual([]);
  });

  it("caps and dedupes stored data on read", () => {
    const stored = Array.from({ length: 15 }, (_, i) => `g${i}`);
    localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(["g0", "g0", ...stored]));
    const { result } = renderHook(() => useRecentlyPlayed());
    expect(result.current.recent).toHaveLength(12);
    expect(new Set(result.current.recent).size).toBe(12);
  });
});
