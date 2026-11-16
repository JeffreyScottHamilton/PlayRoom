import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Game } from "../types/game";

const state = vi.hoisted(() => ({
  all: [] as Game[],
  popular: [] as Game[],
  recentlyAdded: [] as Game[],
  featured: undefined as Game | undefined,
  byCategory: {} as Record<string, Game[]>,
  recentIds: [] as string[],
}));

vi.mock("../data/catalog", () => ({
  get allGames() {
    return state.all;
  },
  getGame: (id: string) => state.all.find((g) => g.id === id),
  getPopularGames: () => state.popular,
  getRecentlyAdded: () => state.recentlyAdded,
  getFeaturedGame: () => state.featured,
  getGamesByCategory: (cat: string) => (cat === "All" ? state.all : state.byCategory[cat] ?? []),
  getRelatedGames: () => [],
}));

vi.mock("../hooks/useRecentlyPlayed", () => ({
  useRecentlyPlayed: () => ({
    recent: state.recentIds,
    recordPlay: () => {},
    clearRecent: () => {},
  }),
}));

import HomePage from "./HomePage";

function fixture(id: string, title: string, overrides: Partial<Game> = {}): Game {
  return {
    id,
    title,
    description: "Fixture.",
    category: ["Action"],
    thumbnail: `/games/${id}/thumb.webp`,
    gameFile: `/games/${id}/game.swf`,
    controls: "Arrow keys",
    compatibility: "verified",
    addedAt: "2026-01-01",
    license: { type: "Developer permission", source: "https://example.com/p" },
    width: 640,
    height: 400,
    needsKeyboard: false,
    ...overrides,
  };
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.all = [];
  state.popular = [];
  state.recentlyAdded = [];
  state.featured = undefined;
  state.byCategory = {};
  state.recentIds = [];
});

afterEach(() => {
  cleanup();
});

describe("HomePage", () => {
  it("renders the hero headline and the browse/categories actions", () => {
    renderHome();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "All Your Favorite Games in One Place.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse Games/ })).toHaveAttribute(
      "href",
      "/games",
    );
    expect(
      screen.getByRole("link", { name: "View Categories" }),
    ).toHaveAttribute("href", "/games#categories");
  });

  it("shows the library empty state when the catalog is empty", () => {
    renderHome();
    expect(screen.getByText("The library is being stocked")).toBeInTheDocument();
    expect(
      screen.getByText("Licensed games are added as permission is confirmed."),
    ).toBeInTheDocument();
    expect(screen.queryByText("POPULAR GAMES")).toBeNull();
    expect(screen.queryByText("RECENTLY ADDED")).toBeNull();
    expect(screen.queryByText("CONTINUE PLAYING")).toBeNull();
  });

  it("shows a placeholder panel when there is no featured game", () => {
    renderHome();
    expect(
      screen.getByText("Games are being added — check back soon."),
    ).toBeInTheDocument();
  });

  it("renders the featured game as a link to its page", () => {
    const featured = fixture("hero-game", "Hero Game", { featured: true });
    state.all = [featured];
    state.featured = featured;
    renderHome();
    expect(screen.getByRole("link", { name: /Hero Game/ })).toHaveAttribute(
      "href",
      "/games/hero-game",
    );
  });

  it("shows popular and recently added sections with View All links", () => {
    const a = fixture("alpha", "Alpha");
    const b = fixture("beta", "Beta");
    state.all = [a, b];
    state.popular = [a];
    state.recentlyAdded = [b];
    renderHome();
    expect(screen.getByRole("heading", { name: "POPULAR GAMES" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "RECENTLY ADDED" })).toBeInTheDocument();
    const viewAll = screen.getAllByRole("link", { name: "View All →" });
    expect(viewAll).toHaveLength(2);
    expect(viewAll[0]).toHaveAttribute("href", "/games");
  });

  it("shows continue playing only for known recent games", () => {
    const a = fixture("alpha", "Alpha");
    state.all = [a];
    state.recentIds = ["missing", "alpha"];
    renderHome();
    const heading = screen.getByRole("heading", { name: "CONTINUE PLAYING" });
    const section = heading.closest("section") as HTMLElement;
    expect(within(section).getByRole("link", { name: "Alpha" })).toBeInTheDocument();
  });

  it("shows the selected category's games under the filter", () => {
    const puzzle = fixture("cube", "Cube Puzzle", { category: ["Puzzle"] });
    state.all = [puzzle];
    state.byCategory = { Puzzle: [puzzle] };
    renderHome();
    expect(screen.queryByRole("link", { name: "Cube Puzzle" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Puzzle" }));
    expect(screen.getByRole("link", { name: "Cube Puzzle" })).toBeInTheDocument();
  });

  it("shows an empty state for a category with no games", () => {
    state.all = [fixture("alpha", "Alpha")];
    renderHome();
    fireEvent.click(screen.getByRole("radio", { name: "Racing" }));
    expect(screen.getByText("No Racing games yet")).toBeInTheDocument();
  });
});
