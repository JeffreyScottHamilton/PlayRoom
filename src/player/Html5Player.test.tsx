import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Html5Player } from "./Html5Player";
import type { GamePlayerHandle } from "./types";

const SRC = "/games/demo/html/index.html";
const LOAD_TIMEOUT_MS = 20_000;

function renderPlayer(onStatus?: (s: "loading" | "ready" | "error") => void) {
  const ref = createRef<GamePlayerHandle>();
  const utils = render(
    <Html5Player
      ref={ref}
      src={SRC}
      width={640}
      height={480}
      title="Demo"
      onStatus={onStatus}
    />,
  );
  return { ref, ...utils };
}

function iframe(container: HTMLElement): HTMLIFrameElement {
  const el = container.querySelector("iframe");
  if (!el) throw new Error("no iframe rendered");
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Html5Player iframe", () => {
  it("uses exactly the sandbox token list and never grants same-origin", () => {
    const { container } = renderPlayer();
    const sandbox = iframe(container).getAttribute("sandbox");

    expect(sandbox).toBe("allow-scripts allow-pointer-lock");
    expect(sandbox).not.toMatch(/allow-same-origin/);
    expect(sandbox).not.toMatch(/allow-top-navigation/);
    expect(sandbox).not.toMatch(/allow-popups/);
    expect(sandbox).not.toMatch(/allow-forms/);
    expect(sandbox).not.toMatch(/allow-modals/);
  });

  it("sets the allow attribute, title, src, referrer policy and eager loading", () => {
    const { container } = renderPlayer();
    const el = iframe(container);

    expect(el.getAttribute("allow")).toBe("fullscreen; autoplay; gamepad");
    expect(el.getAttribute("title")).toBe("Demo game");
    expect(el.getAttribute("src")).toBe(SRC);
    expect(el.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(el.getAttribute("loading")).toBe("eager");
  });

  it("keeps the aspect ratio container with a data-player marker", () => {
    const { container } = renderPlayer();
    const box = container.querySelector("[data-player]") as HTMLElement;

    expect(box).not.toBeNull();
    expect(box.style.aspectRatio).toBe("640 / 480");
  });
});

describe("Html5Player status", () => {
  it("starts in loading and reports it", () => {
    const onStatus = vi.fn();
    const { container } = renderPlayer(onStatus);

    expect(screen.getByRole("status")).toHaveTextContent("Loading game…");
    expect(container.querySelector("[data-player]")).toHaveAttribute("data-status", "loading");
    expect(onStatus).toHaveBeenCalledWith("loading");
  });

  it("becomes ready when the iframe fires load", () => {
    const onStatus = vi.fn();
    const { container } = renderPlayer(onStatus);

    act(() => {
      fireEvent.load(iframe(container));
    });

    expect(onStatus).toHaveBeenLastCalledWith("ready");
    expect(container.querySelector("[data-player]")).toHaveAttribute("data-status", "ready");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports error when no load happens within 20 seconds", () => {
    const onStatus = vi.fn();
    const { container } = renderPlayer(onStatus);

    act(() => {
      vi.advanceTimersByTime(LOAD_TIMEOUT_MS - 1);
    });
    expect(onStatus).not.toHaveBeenCalledWith("error");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onStatus).toHaveBeenLastCalledWith("error");
    expect(container.querySelector("[data-player]")).toHaveAttribute("data-status", "error");
    expect(screen.getByRole("alert")).toHaveTextContent("This game couldn't be loaded.");
  });

  it("does not report error when load arrives before the timeout", () => {
    const onStatus = vi.fn();
    const { container } = renderPlayer(onStatus);

    act(() => {
      fireEvent.load(iframe(container));
    });
    act(() => {
      vi.advanceTimersByTime(LOAD_TIMEOUT_MS * 2);
    });

    expect(onStatus).not.toHaveBeenCalledWith("error");
    expect(onStatus).toHaveBeenLastCalledWith("ready");
  });
});

describe("Html5Player restart and retry", () => {
  it("restart re-creates the iframe element", () => {
    const { container, ref } = renderPlayer();
    const before = iframe(container);

    act(() => {
      ref.current?.restart();
    });

    const after = iframe(container);
    expect(after).not.toBe(before);
    expect(after.getAttribute("sandbox")).toBe("allow-scripts allow-pointer-lock");
  });

  it("Retry after an error re-creates the iframe and returns to loading", () => {
    const onStatus = vi.fn();
    const { container } = renderPlayer(onStatus);
    const before = iframe(container);

    act(() => {
      vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });

    const after = iframe(container);
    expect(after).not.toBe(before);
    expect(onStatus).toHaveBeenLastCalledWith("loading");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      fireEvent.load(after);
    });
    expect(onStatus).toHaveBeenLastCalledWith("ready");
  });

  it("removes the iframe on unmount", () => {
    const { container, unmount } = renderPlayer();
    expect(container.querySelector("iframe")).not.toBeNull();
    unmount();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
