import { describe, expect, it } from "vitest";
import type { Game } from "../types/game";
import { createCatalog } from "./catalog";

function makeGame(id: string, title: string, extra: Partial<Game> = {}): Game {
  return {
    id,
    title,
    description: "",
    category: ["Action"],
    thumbnail: `/games/${id}/thumb.webp`,
    gameFile: `/games/${id}/game.swf`,
    controls: "",
    compatibility: "verified",
    addedAt: "2024-01-01",
    license: { type: "MIT", source: "https://example.com" },
    width: 640,
    height: 400,
    needsKeyboard: false,
    ...extra,
  };
}

const FIXTURES: Game[] = [
  makeGame("alpha", "Alpha", {
    category: ["Action", "Racing"],
    popularRank: 2,
    addedAt: "2024-03-01",
    featured: true,
  }),
  makeGame("bravo", "Bravo", {
    category: ["Action"],
    popularRank: 1,
    addedAt: "2024-05-01",
  }),
  makeGame("charlie", "Charlie", {
    category: ["Racing", "Sports"],
    addedAt: "2024-05-01",
  }),
  makeGame("delta", "Delta", {
    category: ["Action", "Racing"],
    addedAt: "2024-02-01",
  }),
  makeGame("echo", "Echo", {
    category: ["Puzzle", "Action"],
    addedAt: "2024-04-01",
  }),
  makeGame("hidden-pop", "Hidden Pop", {
    category: ["Action"],
    compatibility: "unsupported",
    popularRank: 0,
    addedAt: "2030-01-01",
    featured: true,
  }),
];

const catalog = createCatalog(FIXTURES);
const ids = (games: readonly Game[]) => games.map((g) => g.id);

describe("createCatalog: allGames", () => {
  it("hides unsupported games", () => {
    expect(ids(catalog.allGames)).not.toContain("hidden-pop");
    expect(catalog.allGames).toHaveLength(5);
  });
});

describe("getGame", () => {
  it("finds a supported game by id", () => {
    expect(catalog.getGame("charlie")?.title).toBe("Charlie");
  });

  it("returns undefined for unknown and unsupported ids", () => {
    expect(catalog.getGame("nope")).toBeUndefined();
    expect(catalog.getGame("hidden-pop")).toBeUndefined();
  });
});

describe("getPopularGames", () => {
  it("orders by popularRank ascending and omits uncurated games", () => {
    expect(ids(catalog.getPopularGames())).toEqual(["bravo", "alpha"]);
  });

  it("respects the limit", () => {
    expect(ids(catalog.getPopularGames(1))).toEqual(["bravo"]);
  });

  it("never includes unsupported games", () => {
    expect(ids(catalog.getPopularGames())).not.toContain("hidden-pop");
  });
});

describe("getRecentlyAdded", () => {
  it("orders by addedAt desc, then title", () => {
    expect(ids(catalog.getRecentlyAdded())).toEqual([
      "bravo",
      "charlie",
      "echo",
      "alpha",
      "delta",
    ]);
  });

  it("defaults to 12 and respects an explicit limit", () => {
    expect(catalog.getRecentlyAdded()).toHaveLength(5);
    expect(ids(catalog.getRecentlyAdded(2))).toEqual(["bravo", "charlie"]);
  });

  it("never includes unsupported games", () => {
    expect(ids(catalog.getRecentlyAdded())).not.toContain("hidden-pop");
  });
});

describe("getFeaturedGame", () => {
  it("returns the supported featured game", () => {
    expect(catalog.getFeaturedGame()?.id).toBe("alpha");
  });

  it("falls back to the first popular game when none is featured", () => {
    const noFeatured = createCatalog(
      FIXTURES.map((g) => ({ ...g, featured: undefined })),
    );
    expect(noFeatured.getFeaturedGame()?.id).toBe("bravo");
  });

  it("returns undefined when nothing is featured or popular", () => {
    const bare = createCatalog([makeGame("solo", "Solo")]);
    expect(bare.getFeaturedGame()).toBeUndefined();
  });
});

describe("getGamesByCategory", () => {
  it("returns every supported game for All, sorted by title", () => {
    expect(ids(catalog.getGamesByCategory("All"))).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta",
      "echo",
    ]);
  });

  it("filters by category including multi-category games", () => {
    expect(ids(catalog.getGamesByCategory("Racing"))).toEqual([
      "alpha",
      "charlie",
      "delta",
    ]);
  });

  it("returns [] for a category with no games", () => {
    expect(catalog.getGamesByCategory("Strategy")).toEqual([]);
  });

  it("never includes unsupported games", () => {
    expect(ids(catalog.getGamesByCategory("Action"))).not.toContain("hidden-pop");
  });
});

describe("getRelatedGames", () => {
  it("returns [] for an unknown id", () => {
    expect(catalog.getRelatedGames("nope")).toEqual([]);
  });

  it("excludes the game itself", () => {
    expect(ids(catalog.getRelatedGames("alpha"))).not.toContain("alpha");
  });

  it("orders by shared-category count desc, then title", () => {
    // alpha: [Action, Racing]
    // delta: [Action, Racing] -> 2 shared
    // bravo: [Action] -> 1 shared; charlie: [Racing, Sports] -> 1 shared; echo: [Puzzle, Action] -> 1 shared
    expect(ids(catalog.getRelatedGames("alpha"))).toEqual([
      "delta",
      "bravo",
      "charlie",
      "echo",
    ]);
  });

  it("omits games that share no category", () => {
    const solo = createCatalog([
      makeGame("a", "A", { category: ["Puzzle"] }),
      makeGame("b", "B", { category: ["Racing"] }),
    ]);
    expect(solo.getRelatedGames("a")).toEqual([]);
  });

  it("defaults to 6 and respects an explicit limit", () => {
    const many = createCatalog([
      makeGame("base", "Base", { category: ["Action"] }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeGame(`m${i}`, `Mod ${i}`, { category: ["Action"] }),
      ),
    ]);
    expect(many.getRelatedGames("base")).toHaveLength(6);
    expect(many.getRelatedGames("base", 2)).toHaveLength(2);
  });

  it("never includes unsupported games", () => {
    expect(ids(catalog.getRelatedGames("alpha"))).not.toContain("hidden-pop");
  });
});
