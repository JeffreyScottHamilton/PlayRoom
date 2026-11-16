import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Category, Game } from "../types/game";
import GamesPage from "./GamesPage";

const { fixtures, state, make } = vi.hoisted(() => {
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
  const quests = Array.from({ length: 30 }, (_, i) =>
    make(`quest-${i + 1}`, `Quest ${String(i + 1).padStart(2, "0")}`),
  );
  return {
    make,
    fixtures: [
      ...quests,
      make("mario-kart", "Mario Kart", { category: ["Racing"] }),
      make("puzzle-box", "Puzzle Box", { category: ["Puzzle"] }),
      make("hidden", "Hidden Quest", { compatibility: "unsupported" }),
    ],
    state: { games: [] as Game[] },
  };
});

// The catalog delegates to a mutable list so one test can simulate an empty library.
vi.mock("../data/catalog", async () => {
  const { createCatalog } = await vi.importActual<typeof import("../data/catalog")>(
    "../data/catalog",
  );
  return {
    get allGames() {
      return createCatalog(state.games).allGames;
    },
    getGame: (id: string) => createCatalog(state.games).getGame(id),
    getGamesByCategory: (cat: Category | "All") =>
      createCatalog(state.games).getGamesByCategory(cat),
  };
});

function Where() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search + location.hash}</output>;
}

function renderPage(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <GamesPage />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// GameGrid renders the only list on the page; each item is a GameCard whose link text is the title.
const titles = () =>
  within(screen.getByRole("list"))
    .queryAllByRole("listitem")
    .map((li) => li.textContent);

beforeEach(() => {
  state.games = [...fixtures];
});

describe("GamesPage", () => {
  it("renders the heading and the visible game count, hiding unsupported games", () => {
    renderPage("/games");
    expect(screen.getByRole("heading", { level: 1, name: "All Games" })).toBeInTheDocument();
    // 30 quests + Mario Kart + Puzzle Box; the unsupported one is hidden.
    expect(screen.getByText("32 games")).toBeInTheDocument();
  });

  it("lists titles A–Z and pages 24 at a time with Load more", () => {
    renderPage("/games");
    const shown = titles();
    expect(shown).toHaveLength(24);
    expect(shown[0]).toBe("Mario Kart");
    expect(shown[1]).toBe("Puzzle Box");

    const loadMore = screen.getByRole("button", { name: "Load more (8 remaining)" });
    fireEvent.click(loadMore);

    expect(titles()).toHaveLength(32);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("filters by category and syncs ?category=", () => {
    renderPage("/games");
    fireEvent.click(screen.getByRole("radio", { name: "Puzzle" }));

    expect(titles()).toEqual(["Puzzle Box"]);
    expect(screen.getByText("1 game")).toBeInTheDocument();
    expect(screen.getByLabelText("location")).toHaveTextContent("/games?category=Puzzle");
  });

  it("applies the category from the URL on load", () => {
    renderPage("/games?category=Racing");
    expect(titles()).toEqual(["Mario Kart"]);
    expect(screen.getByRole("radio", { name: "Racing" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("searches titles and syncs ?q=", () => {
    renderPage("/games");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search titles" }), {
      target: { value: "mario" },
    });

    expect(titles()).toEqual(["Mario Kart"]);
    expect(screen.getByLabelText("location")).toHaveTextContent("/games?q=mario");
  });

  it("applies the category first, then the search within it", () => {
    renderPage("/games?category=Racing&q=quest");
    expect(screen.getByText("No games match “quest”")).toBeInTheDocument();
  });

  it("uses search rank order when a query is present", () => {
    renderPage("/games?q=quest%2001");
    expect(titles()).toEqual(["Quest 01"]);
  });

  it("clears the search from the empty state", () => {
    renderPage("/games?q=zzz");
    expect(screen.getByText("No games match “zzz”")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Clear search" }));
    expect(screen.getByLabelText("location")).toHaveTextContent(/^\/games$/);
    expect(titles()).toHaveLength(24);
  });

  it("offers to show all games when the chosen category is empty", () => {
    state.games = [make("only-action", "Only Action")];
    renderPage("/games");
    fireEvent.click(screen.getByRole("radio", { name: "Puzzle" }));

    expect(screen.getByText("No games in this category.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Show all games" }));
    expect(screen.getByLabelText("location")).toHaveTextContent(/^\/games$/);
    expect(titles()).toEqual(["Only Action"]);
  });

  it("shows the empty library state when there are no games", () => {
    state.games = [];
    renderPage("/games");
    expect(screen.getByText("0 games")).toBeInTheDocument();
    expect(screen.getByText("The library is being stocked")).toBeInTheDocument();
    expect(
      screen.getByText("Licensed games are added as permission is confirmed."),
    ).toBeInTheDocument();
  });

  it("focuses the category filter when the URL hash is #categories", () => {
    renderPage("/games#categories");
    expect(document.getElementById("categories")).toHaveFocus();
  });

  it("refocuses the category filter when #categories is navigated to again on /games", () => {
    render(
      <MemoryRouter initialEntries={["/games#categories"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <input aria-label="Other field" />
                <Link to="/games#categories">Categories</Link>
                <GamesPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    const categories = document.getElementById("categories");
    expect(categories).toHaveFocus();

    screen.getByRole("textbox", { name: "Other field" }).focus();
    expect(categories).not.toHaveFocus();

    fireEvent.click(screen.getByRole("link", { name: "Categories" }));
    expect(categories).toHaveFocus();
  });
});
