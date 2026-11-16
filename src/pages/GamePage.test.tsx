import { forwardRef, useImperativeHandle, type Ref } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "../types/game";
import GamePage from "./GamePage";

const mocks = vi.hoisted(() => ({
  getGame: vi.fn(),
  getRelatedGames: vi.fn(),
  isFavorite: vi.fn(),
  toggleFavorite: vi.fn(),
  recordPlay: vi.fn(),
  restart: vi.fn(),
  enterFullscreen: vi.fn(),
}));

vi.mock("../data/catalog", () => ({
  getGame: mocks.getGame,
  getRelatedGames: mocks.getRelatedGames,
}));

vi.mock("../hooks/useFavorites", () => ({
  useFavorites: () => ({
    favorites: [],
    isFavorite: mocks.isFavorite,
    toggleFavorite: mocks.toggleFavorite,
  }),
}));

vi.mock("../hooks/useRecentlyPlayed", () => ({
  useRecentlyPlayed: () => ({
    recent: [],
    recordPlay: mocks.recordPlay,
    clearRecent: () => {},
  }),
}));

vi.mock("../player/RufflePlayer", () => ({
  RufflePlayer: forwardRef(function FakeRufflePlayer(
    { src }: { src: string },
    ref: Ref<{ restart(): void; enterFullscreen(): void }>,
  ) {
    useImperativeHandle(ref, () => ({ restart: mocks.restart, enterFullscreen: mocks.enterFullscreen }));
    return <div data-testid="player" data-src={src} />;
  }),
}));

function fixtureGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "fixture-game",
    title: "Fixture Game",
    description: "A fixture game used only by tests.",
    category: ["Action"],
    thumbnail: "/games/fixture-game/thumb.webp",
    gameFile: "/games/fixture-game/game.swf",
    controls: "Arrow keys to move, Space to jump",
    developer: "Test Studio",
    releaseYear: 1999,
    compatibility: "verified",
    addedAt: "2024-01-01",
    license: { type: "MIT", source: "https://example.com/license" },
    width: 550,
    height: 400,
    needsKeyboard: false,
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/:id" element={<GamePage />} />
        <Route path="/games" element={<p>All games list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function setCoarsePointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: coarse && query === "(pointer: coarse)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isFavorite.mockReturnValue(false);
  mocks.getRelatedGames.mockReturnValue([]);
  setCoarsePointer(false);
  document.title = "PLAYROOM — The games you grew up with";
});

describe("GamePage", () => {
  it("renders the title, sets the document title and records the play once", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    const { rerender } = renderAt("/games/fixture-game");

    expect(screen.getByRole("heading", { level: 1, name: "Fixture Game" })).toBeInTheDocument();
    expect(document.title).toBe("Fixture Game — PLAYROOM");
    expect(mocks.recordPlay).toHaveBeenCalledTimes(1);
    expect(mocks.recordPlay).toHaveBeenCalledWith("fixture-game");

    rerender(
      <MemoryRouter initialEntries={["/games/fixture-game"]}>
        <Routes>
          <Route path="/games/:id" element={<GamePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mocks.recordPlay).toHaveBeenCalledTimes(1);
  });

  it("passes the game file and native size to the player", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    renderAt("/games/fixture-game");

    expect(screen.getByTestId("player")).toHaveAttribute("data-src", "/games/fixture-game/game.swf");
  });

  it("wires the Fullscreen and Restart toolbar buttons to the player handle", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    renderAt("/games/fixture-game");

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

    expect(mocks.enterFullscreen).toHaveBeenCalledTimes(1);
    expect(mocks.restart).toHaveBeenCalledTimes(1);
  });

  it("toggles the favorite button label and aria-pressed state", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    const { unmount } = renderAt("/games/fixture-game");

    const add = screen.getByRole("button", { name: "Add to Favorites" });
    expect(add).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(add);
    expect(mocks.toggleFavorite).toHaveBeenCalledWith("fixture-game");
    unmount();

    mocks.isFavorite.mockReturnValue(true);
    renderAt("/games/fixture-game");
    const saved = screen.getByRole("button", { name: "Saved to Favorites" });
    expect(saved).toHaveAttribute("aria-pressed", "true");
  });

  it("links the license type to its source", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    renderAt("/games/fixture-game");

    const link = screen.getByRole("link", { name: "MIT" });
    expect(link).toHaveAttribute("href", "https://example.com/license");
  });

  it("shows developer and year only when they are known", () => {
    mocks.getGame.mockReturnValue(fixtureGame({ developer: undefined, releaseYear: undefined }));
    renderAt("/games/fixture-game");

    expect(screen.queryByRole("heading", { name: "Details" })).not.toBeInTheDocument();
  });

  it("shows developer and year when known", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    renderAt("/games/fixture-game");

    expect(screen.getByText("Test Studio")).toBeInTheDocument();
    expect(screen.getByText("1999")).toBeInTheDocument();
  });

  it("shows the partial compatibility notice", () => {
    mocks.getGame.mockReturnValue(fixtureGame({ compatibility: "partial" }));
    renderAt("/games/fixture-game");

    expect(
      screen.getByText("Some features of this game may not work correctly in the emulator."),
    ).toBeInTheDocument();
  });

  it("does not show the partial notice for verified games", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    renderAt("/games/fixture-game");

    expect(screen.queryByText(/may not work correctly/)).not.toBeInTheDocument();
  });

  it("shows the keyboard notice only on coarse pointers for keyboard games", () => {
    mocks.getGame.mockReturnValue(fixtureGame({ needsKeyboard: true }));
    setCoarsePointer(true);
    const { unmount } = renderAt("/games/fixture-game");
    expect(
      screen.getByText("This game needs a keyboard and mouse. It may not be playable on touch devices."),
    ).toBeInTheDocument();
    unmount();

    setCoarsePointer(false);
    renderAt("/games/fixture-game");
    expect(screen.queryByText(/needs a keyboard and mouse/)).not.toBeInTheDocument();
  });

  it("renders the related games section only when there are related games", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    mocks.getRelatedGames.mockReturnValue([]);
    const { unmount } = renderAt("/games/fixture-game");
    expect(screen.queryByRole("heading", { name: "Related games" })).not.toBeInTheDocument();
    unmount();

    mocks.getRelatedGames.mockReturnValue([fixtureGame({ id: "other", title: "Other" })]);
    renderAt("/games/fixture-game");
    expect(screen.getByRole("heading", { name: "Related games" })).toBeInTheDocument();
    expect(mocks.getRelatedGames).toHaveBeenCalledWith("fixture-game", 6);
  });

  it("shows the back link to /games when there is no in-app history", () => {
    mocks.getGame.mockReturnValue(fixtureGame());
    renderAt("/games/fixture-game");

    expect(screen.getByRole("link", { name: "← All games" })).toHaveAttribute("href", "/games");
  });

  it("shows the not-found state with a link to /games for an unknown id", () => {
    mocks.getGame.mockReturnValue(undefined);
    renderAt("/games/does-not-exist");

    expect(screen.getByRole("heading", { level: 1, name: "Game not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All games" })).toHaveAttribute("href", "/games");
    expect(mocks.recordPlay).not.toHaveBeenCalled();
    expect(screen.queryByTestId("player")).not.toBeInTheDocument();
  });
});
