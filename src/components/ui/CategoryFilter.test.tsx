import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CategoryFilter } from "./CategoryFilter";

afterEach(() => {
  cleanup();
});

describe("CategoryFilter", () => {
  it("renders a radiogroup with All plus the eight categories", () => {
    render(<CategoryFilter value="All" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(9);
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onChange when a category is clicked", () => {
    const onChange = vi.fn();
    render(<CategoryFilter value="All" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Puzzle" }));
    expect(onChange).toHaveBeenCalledWith("Puzzle");
  });

  it("moves the selection with ArrowRight and ArrowLeft, wrapping at the ends", () => {
    const onChange = vi.fn();
    render(<CategoryFilter value="All" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "All" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith("Action");

    fireEvent.keyDown(screen.getByRole("radio", { name: "All" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenLastCalledWith("Arcade");
  });

  it("selects first and last options with Home and End", () => {
    const onChange = vi.fn();
    render(<CategoryFilter value="Racing" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Racing" }), {
      key: "End",
    });
    expect(onChange).toHaveBeenLastCalledWith("Arcade");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Racing" }), {
      key: "Home",
    });
    expect(onChange).toHaveBeenLastCalledWith("All");
  });

  it("marks only the selected option as a tab stop", () => {
    render(<CategoryFilter value="Sports" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Sports" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
