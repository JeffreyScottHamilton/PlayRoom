import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { STORAGE_KEYS } from "../lib/storage";
import type { Game } from "../types/game";
import FavoritesPage from "./FavoritesPage";
import { useFavorites } from "../hooks/useFavorites";

const { fixtures } = vi.hoisted(() => {
  const make = (id: string, title: string, extra: Partial<Game> = {}): Game => ({
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
  });
  return {
    fixtures: [make("alpha", "Alpha"), make("bravo", "Bravo")],
  };
});

vi.mock("../data/catalog", async () => {
  const { createCatalog } = await vi.importActual<typeof import("../data/catalog")>(
    "../data/catalog",
  );
  const catalog = createCatalog(fixtures);
  return { getGame: catalog.getGame };
});

// GameGrid and EmptyState are S2 components; minimal stand-ins keep this test independent.
vi.mock("../components/ui/GameGrid", () => ({
  GameGrid: ({ games }: { games: Game[] }) => (
    <ul aria-label="Games">
      {games.map((g) => (
        <li key={g.id}>{g.title}</li>
      ))}
    </ul>
  ),
}));

vi.mock("../components/ui/EmptyState", () => ({
  EmptyState: ({ children }: { children?: ReactNode }) => (
    <div role="region" aria-label="Empty state">
      {children}
    </div>
  ),
}));

function Where() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/favorites"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <FavoritesPage />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("FavoritesPage", () => {
  it("shows the empty state with a link to the games list", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Favorites" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Empty state" });
    expect(within(region).getByText("No favorites yet")).toBeInTheDocument();
    expect(
      within(region).getByText("Select the heart on any game to save it here."),
    ).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: "Browse games" })).toHaveAttribute(
      "href",
      "/games",
    );
  });

  it("lists favorites newest first and drops unknown ids", () => {
    localStorage.setItem(
      STORAGE_KEYS.favorites,
      JSON.stringify(["bravo", "removed-game", "alpha"]),
    );
    renderPage();
    const list = screen.getByRole("list", { name: "Games" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Bravo",
      "Alpha",
    ]);
    expect(screen.queryByRole("region", { name: "Empty state" })).not.toBeInTheDocument();
  });

  it("treats malformed stored favorites as empty", () => {
    localStorage.setItem(STORAGE_KEYS.favorites, "not json");
    renderPage();
    expect(screen.getByRole("region", { name: "Empty state" })).toBeInTheDocument();
  });

  it("updates when a favorite is added elsewhere on the page", () => {
    function Toggle() {
      const { toggleFavorite } = useFavorites();
      return (
        <button type="button" onClick={() => toggleFavorite("alpha")}>
          toggle alpha
        </button>
      );
    }
    render(
      <MemoryRouter>
        <Toggle />
        <FavoritesPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("region", { name: "Empty state" })).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "toggle alpha" }));
    });
    expect(screen.getByRole("list", { name: "Games" })).toHaveTextContent("Alpha");
  });
});
