import { useSyncExternalStore } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoredList } from "./storedList";

const KEY = "playroom:test-list";

beforeEach(() => {
  localStorage.clear();
});

describe("createStoredList", () => {
  it("returns an empty list when nothing is stored", () => {
    const list = createStoredList(KEY);
    expect(list.getSnapshot()).toEqual([]);
  });

  it("persists set() and sanitizes duplicates and non-strings", () => {
    const list = createStoredList(KEY);
    list.set(["a", "a", 3 as unknown as string, "b"]);
    expect(list.getSnapshot()).toEqual(["a", "b"]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual(["a", "b"]);
  });

  it("caps the list at max, keeping the first ids", () => {
    const list = createStoredList(KEY, { max: 2 });
    list.set(["a", "b", "c"]);
    expect(list.getSnapshot()).toEqual(["a", "b"]);
  });

  it("has no cap when max is omitted", () => {
    const list = createStoredList(KEY);
    const ids = Array.from({ length: 30 }, (_, i) => `g${i}`);
    list.set(ids);
    expect(list.getSnapshot()).toHaveLength(30);
  });

  it("treats malformed stored JSON as empty", () => {
    localStorage.setItem(KEY, "{not json");
    const list = createStoredList(KEY);
    expect(list.getSnapshot()).toEqual([]);
  });

  it("notifies subscribers on set() and reads external storage events", () => {
    const list = createStoredList(KEY);
    const { result } = renderHook(() =>
      useSyncExternalStore(list.subscribe, list.getSnapshot, list.getSnapshot),
    );
    expect(result.current).toEqual([]);

    act(() => list.set(["x"]));
    expect(result.current).toEqual(["x"]);

    act(() => {
      localStorage.setItem(KEY, JSON.stringify(["y"]));
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(result.current).toEqual(["y"]);
  });
});
