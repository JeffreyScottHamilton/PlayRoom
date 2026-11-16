import { describe, expect, it } from "vitest";
import type { Game } from "../types/game";
import { normalize, searchGames } from "./search";

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
  makeGame("super-mario", "Super Mario"),
  makeGame("mario-kart", "Mario Kart"),
  makeGame("mario-bros", "Marionette"),
  makeGame("spider-man", "Spider-Man"),
  makeGame("cafe", "Café Chaos"),
  makeGame("hidden", "Mario Hidden", { compatibility: "unsupported" }),
  makeGame("tetris-like", "Block Stacker"),
];

describe("normalize", () => {
  it("lowercases and trims", () => {
    expect(normalize("  Super MARIO  ")).toBe("super mario");
  });

  it("strips diacritics", () => {
    expect(normalize("Café Chaos")).toBe("cafe chaos");
  });

  it("removes apostrophes and turns other punctuation into spaces", () => {
    expect(normalize("Mario's Adventure")).toBe("marios adventure");
    expect(normalize("Spider-Man")).toBe("spider man");
    expect(normalize("Tom & Jerry!")).toBe("tom jerry");
  });

  it("collapses runs of whitespace", () => {
    expect(normalize("a   b\t\tc")).toBe("a b c");
  });

  it("returns empty string for punctuation-only input", () => {
    expect(normalize("  ?! ")).toBe("");
  });
});

describe("searchGames", () => {
  it("returns [] for an empty or blank query", () => {
    expect(searchGames("", FIXTURES)).toEqual([]);
    expect(searchGames("   ", FIXTURES)).toEqual([]);
  });

  it("returns [] when no games are given", () => {
    expect(searchGames("mario")).toEqual([]);
  });

  it("is case-insensitive and ignores diacritics and punctuation", () => {
    expect(searchGames("SUPER mario", FIXTURES).map((g) => g.id)).toEqual([
      "super-mario",
    ]);
    expect(searchGames("cafe", FIXTURES).map((g) => g.id)).toEqual(["cafe"]);
    expect(searchGames("spider man", FIXTURES).map((g) => g.id)).toEqual([
      "spider-man",
    ]);
  });

  it("matches partial text anywhere in the title", () => {
    expect(searchGames("ario", FIXTURES).map((g) => g.id)).toEqual([
      "mario-kart",
      "mario-bros",
      "super-mario",
    ]);
  });

  it("ranks title startsWith, then word startsWith, then includes; ties by title", () => {
    const games = [
      makeGame("b", "Big Mario"), // word startsWith
      makeGame("a", "Mario Kart"), // title startsWith
      makeGame("c", "Marionette"), // title startsWith
      makeGame("d", "Super Marionette"), // word startsWith
      makeGame("e", "Xmario"), // includes
    ];
    expect(searchGames("mario", games).map((g) => g.title)).toEqual([
      "Mario Kart",
      "Marionette",
      "Big Mario",
      "Super Marionette",
      "Xmario",
    ]);
  });

  it("never returns unsupported games", () => {
    expect(searchGames("hidden", FIXTURES)).toEqual([]);
    expect(searchGames("mario", FIXTURES).map((g) => g.id)).not.toContain("hidden");
  });

  it("applies the default limit of 8 and an explicit limit", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeGame(`g${i}`, `Quest ${String(i).padStart(2, "0")}`),
    );
    expect(searchGames("quest", many)).toHaveLength(8);
    expect(searchGames("quest", many, 3)).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const input = [...FIXTURES];
    const snapshot = input.map((g) => g.id);
    searchGames("mario", input);
    expect(input.map((g) => g.id)).toEqual(snapshot);
  });
});
