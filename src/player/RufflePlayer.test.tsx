import { createRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RufflePlayer, type RufflePlayerHandle } from "./RufflePlayer";

const mocks = vi.hoisted(() => ({
  loadRuffle: vi.fn(),
}));

vi.mock("./loadRuffle", () => ({
  loadRuffle: mocks.loadRuffle,
}));

interface FakePlayer extends HTMLElement {
  load: ReturnType<typeof vi.fn>;
}

let players: FakePlayer[];
let createPlayer: ReturnType<typeof vi.fn>;

function makePlayer(): FakePlayer {
  const el = document.createElement("ruffle-player") as FakePlayer;
  el.load = vi.fn(() => undefined);
  return el;
}

beforeEach(() => {
  players = [];
  createPlayer = vi.fn(() => {
    const p = makePlayer();
    players.push(p);
    return p;
  });
  mocks.loadRuffle.mockReset();
  mocks.loadRuffle.mockResolvedValue({ newest: () => ({ createPlayer }) });
});

function renderPlayer(onStatus?: (s: "loading" | "ready" | "error") => void) {
  const ref = createRef<RufflePlayerHandle>();
  const utils = render(
    <RufflePlayer
      ref={ref}
      src="/games/demo/game.swf"
      width={550}
      height={400}
      onStatus={onStatus}
    />,
  );
  return { ref, ...utils };
}

describe("RufflePlayer status transitions", () => {
  it("starts in loading with the loading indicator", () => {
    renderPlayer();
    expect(screen.getByRole("status")).toHaveTextContent("Loading game…");
  });

  it("becomes ready on loadedmetadata and reports it", async () => {
    const onStatus = vi.fn();
    const { container } = renderPlayer(onStatus);

    await waitFor(() => expect(players).toHaveLength(1));
    expect(players[0].load).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/games/demo/game.swf",
        autoplay: "on",
        unmuteOverlay: "hidden",
        splashScreen: false,
        letterbox: "on",
        contextMenu: "rightClickOnly",
        warnOnUnsupportedContent: true,
      }),
    );

    act(() => {
      players[0].dispatchEvent(new Event("loadedmetadata"));
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-status", "ready");
    expect(onStatus.mock.calls.map((c) => c[0])).toEqual(["loading", "ready"]);
  });

  it("becomes ready when the load() promise resolves", async () => {
    createPlayer.mockImplementation(() => {
      const p = makePlayer();
      p.load = vi.fn(() => Promise.resolve());
      players.push(p);
      return p;
    });
    const onStatus = vi.fn();
    renderPlayer(onStatus);

    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("ready"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the error panel with Retry when loadRuffle rejects", async () => {
    mocks.loadRuffle.mockRejectedValueOnce(new Error("Failed to load Ruffle"));
    const onStatus = vi.fn();
    renderPlayer(onStatus);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This game couldn't be loaded.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(onStatus).toHaveBeenLastCalledWith("error");
  });

  it("shows the error panel when load() rejects", async () => {
    createPlayer.mockImplementation(() => {
      const p = makePlayer();
      p.load = vi.fn(() => Promise.reject(new Error("bad swf")));
      players.push(p);
      return p;
    });
    renderPlayer();

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be loaded");
  });

  it("shows the error panel on a Ruffle error event", async () => {
    const { container } = renderPlayer();
    await waitFor(() => expect(players).toHaveLength(1));

    act(() => {
      players[0].dispatchEvent(new Event("error"));
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-status", "error");
  });

  it("Retry re-runs loadRuffle and creates a fresh player", async () => {
    mocks.loadRuffle.mockRejectedValueOnce(new Error("Failed to load Ruffle"));
    renderPlayer();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => expect(players).toHaveLength(1));
    expect(mocks.loadRuffle).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("RufflePlayer lifecycle and handle", () => {
  it("restart() destroys the player element and creates a new one", async () => {
    const { ref } = renderPlayer();
    await waitFor(() => expect(players).toHaveLength(1));

    act(() => ref.current?.restart());

    await waitFor(() => expect(players).toHaveLength(2));
    expect(players[0].isConnected).toBe(false);
    expect(players[1].isConnected).toBe(true);
  });

  it("removes the player on unmount so audio stops", async () => {
    const { unmount } = renderPlayer();
    await waitFor(() => expect(players).toHaveLength(1));
    const player = players[0];
    expect(player.isConnected).toBe(true);

    unmount();

    expect(player.isConnected).toBe(false);
  });

  it("enterFullscreen() requests fullscreen on the container", () => {
    const { ref, container } = renderPlayer();
    const target = container.firstElementChild as HTMLElement;
    const request = vi.fn(() => Promise.resolve());
    target.requestFullscreen = request;

    ref.current?.enterFullscreen();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("prevents page scroll for arrow and space keys inside the player", async () => {
    const { container } = renderPlayer();
    await waitFor(() => expect(players).toHaveLength(1));
    const target = container.firstElementChild as HTMLElement;

    const arrow = fireEvent.keyDown(target, { key: "ArrowDown" });
    const space = fireEvent.keyDown(target, { key: " " });
    const letter = fireEvent.keyDown(target, { key: "a" });

    expect(arrow).toBe(false);
    expect(space).toBe(false);
    expect(letter).toBe(true);
  });

  it("does not block keys on the Retry button", async () => {
    mocks.loadRuffle.mockRejectedValueOnce(new Error("nope"));
    renderPlayer();
    const retry = await screen.findByRole("button", { name: "Retry" });

    expect(fireEvent.keyDown(retry, { key: " " })).toBe(true);
  });

  it("focuses the container on mouse down so game keys reach the player", () => {
    const { container } = renderPlayer();
    const target = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(target);

    expect(document.activeElement).toBe(target);
  });
});
