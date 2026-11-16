import { describe, expect, it } from "vitest";
import type { Game } from "../types/game";
import { filterByScope, isOwnerAsserted } from "./catalog";

function makeGame(id: string, licenseType: string): Game {
  return {
    id,
    title: id,
    description: "",
    category: ["Action"],
    thumbnail: `/games/${id}/thumb.webp`,
    gameFile: `/games/${id}/game.swf`,
    controls: "",
    compatibility: "verified",
    addedAt: "2024-01-01",
    license: { type: licenseType, source: "https://example.com" },
    width: 640,
    height: 400,
    needsKeyboard: false,
  };
}

const OPEN = makeGame("open-one", "MIT");
const OWNED = makeGame("owned-one", "Owner-asserted (permission on file)");
const OWNED_BARE = makeGame("owned-bare", "Owner-asserted");
const DEV_PERMISSION = makeGame("dev-permission", "Developer permission");

describe("isOwnerAsserted", () => {
  it("is true for license types starting with Owner-asserted", () => {
    expect(isOwnerAsserted(OWNED)).toBe(true);
    expect(isOwnerAsserted(OWNED_BARE)).toBe(true);
  });

  it("is false for open and other permission licences", () => {
    expect(isOwnerAsserted(OPEN)).toBe(false);
    expect(isOwnerAsserted(DEV_PERMISSION)).toBe(false);
  });
});

describe("filterByScope", () => {
  const ALL = [OPEN, OWNED, OWNED_BARE, DEV_PERMISSION];

  it("keeps every entry in the all scope", () => {
    expect(filterByScope(ALL, "all").map((g) => g.id)).toEqual(ALL.map((g) => g.id));
  });

  it("drops owner-asserted entries in the open scope and keeps the rest in order", () => {
    expect(filterByScope(ALL, "open").map((g) => g.id)).toEqual(["open-one", "dev-permission"]);
  });

  it("does not mutate its input", () => {
    const input = [OPEN, OWNED];
    filterByScope(input, "open");
    expect(input).toEqual([OPEN, OWNED]);
  });
});
