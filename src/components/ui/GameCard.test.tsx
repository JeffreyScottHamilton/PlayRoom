import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GameCard } from "./GameCard";
import type { Game } from "../../types/game";

// Stateful fake so the toggle behaviour is observable through aria-pressed.
vi.mock("../../hooks/useFavorites", async () => {
  const React = await import("react");
  return {
    useFavorites: () => {
      const [favorites, setFavorites] = React.useState<string[]>([]);
      return {
        favorites,
        isFavorite: (id: string) => favorites.includes(id),
        toggleFavorite: (id: string) =>
          setFavorites((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev],
          ),
      };
    },
  };
});

const game: Game = {
  id: "sample-racer",
  title: "Sample Racer",
  description: "A fixture game.",
  category: ["Racing"],
  thumbnail: "/games/sample-racer/thumb.webp",
  gameFile: "/games/sample-racer/game.swf",
  controls: "Arrow keys to steer",
  compatibility: "verified",
  addedAt: "2026-01-01",
  license: { type: "Developer permission", source: "https://example.com/permission" },
  width: 640,
  height: 400,
  needsKeyboard: true,
};

function renderCard(props: { showFavorite?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <GameCard game={game} {...props} />
    </MemoryRouter>,
  );
}

describe("GameCard", () => {
  it("links to the game page", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "Sample Racer" });
    expect(link).toHaveAttribute("href", "/games/sample-racer");
  });

  it("lazy-loads and decodes the thumbnail at its native 16:10 size", () => {
    const { container } = renderCard();
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("width", "640");
    expect(img).toHaveAttribute("height", "400");
    expect(img).toHaveAttribute("src", "/games/sample-racer/thumb.webp");
  });

  it("shows initials when the thumbnail fails to load", () => {
    const { container } = renderCard();
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("SR")).toBeInTheDocument();
  });

  it("toggles the favorite button via aria-pressed", () => {
    renderCard();
    const button = screen.getByRole("button", {
      name: "Add Sample Racer to favorites",
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("omits the favorite button when showFavorite is false", () => {
    renderCard({ showFavorite: false });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
