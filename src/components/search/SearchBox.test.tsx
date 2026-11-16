import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Game } from "../../types/game";
import { SearchBox } from "./SearchBox";

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
    fixtures: [
      make("super-mario", "Super Mario"),
      make("mario-kart", "Mario Kart"),
      make("hidden-mario", "Mario Hidden", { compatibility: "unsupported" }),
    ],
  };
});

vi.mock("../../data/catalog", async () => {
  const { createCatalog } = await vi.importActual<typeof import("../../data/catalog")>(
    "../../data/catalog",
  );
  return createCatalog(fixtures);
});

function Where() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
}

function renderBox(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SearchBox />
              <textarea aria-label="Notes" />
              <div data-player tabIndex={0} aria-label="Player area" />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SearchBox", () => {
  it("renders an ARIA 1.2 combobox with the placeholder", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    expect(input).toHaveAttribute("placeholder", "Search games…");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows matching options with thumbnails and hides unsupported games", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "mario" } });

    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", listbox.id);

    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Mario Kart", "Super Mario"]);
    const img = options[0].querySelector("img");
    expect(img).toHaveAttribute("width", "40");
    expect(img).toHaveAttribute("height", "25");
  });

  it("moves the active option with ArrowDown and opens it with Enter", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "mario" } });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const first = screen.getByRole("option", { name: "Mario Kart" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Super Mario" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("location")).toHaveTextContent("/games/super-mario");
  });

  it("selects the last option when ArrowUp is pressed with no selection", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "mario" } });

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Super Mario" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("navigates to /games?q= on Enter when no option is active", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "mario kart" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("location")).toHaveTextContent("/games?q=mario%20kart");
  });

  it("closes the results on Escape", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "mario" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the empty state with a link to All Games", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "zzz" } });

    expect(screen.getByText("No games match “zzz”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All Games" })).toHaveAttribute(
      "href",
      "/games",
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not list unsupported games", () => {
    renderBox();
    fireEvent.change(screen.getByRole("combobox", { name: "Search games" }), {
      target: { value: "hidden" },
    });
    expect(screen.getByText("No games match “hidden”")).toBeInTheDocument();
  });

  it("closes the results when the route changes", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "mario" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("location")).toHaveTextContent("/games/mario-kart");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps the no-results popup open while focus moves to the All Games link", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "zzz" } });
    const link = screen.getByRole("link", { name: "All Games" });

    input.focus();
    fireEvent.blur(input, { relatedTarget: link });
    expect(screen.getByRole("link", { name: "All Games" })).toBeInTheDocument();
  });

  it("closes the no-results popup when focus leaves the search box", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "zzz" } });

    fireEvent.blur(input, { relatedTarget: screen.getByRole("textbox", { name: "Notes" }) });
    expect(screen.queryByRole("link", { name: "All Games" })).not.toBeInTheDocument();
  });

  it("keeps focus in the input when the no-results popup is pressed, so the click lands", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "zzz" } });
    const link = screen.getByRole("link", { name: "All Games" });

    const notPrevented = fireEvent.mouseDown(link);
    expect(notPrevented).toBe(false);
    fireEvent.click(link);
    expect(screen.getByLabelText("location")).toHaveTextContent(/^\/games$/);
  });

  it("focuses the field on '/' when focus is not in a text field", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(input);
  });

  it("ignores '/' inside a text field", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    const notes = screen.getByRole("textbox", { name: "Notes" });
    notes.focus();
    fireEvent.keyDown(notes, { key: "/" });
    expect(document.activeElement).toBe(notes);
    expect(document.activeElement).not.toBe(input);
  });

  it("ignores '/' inside the player", () => {
    renderBox();
    const input = screen.getByRole("combobox", { name: "Search games" });
    const player = screen.getByLabelText("Player area");
    player.focus();
    fireEvent.keyDown(player, { key: "/" });
    expect(document.activeElement).toBe(player);
    expect(document.activeElement).not.toBe(input);
  });
});
