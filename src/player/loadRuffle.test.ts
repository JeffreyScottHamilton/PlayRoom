import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RufflePlayerElement } from "./ruffle";

type LoaderModule = typeof import("./loadRuffle");

const SCRIPT_SELECTOR = 'script[src="/ruffle/ruffle.js"]';

function scripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(SCRIPT_SELECTOR));
}

function fakeRuntime() {
  const player = document.createElement("ruffle-player") as RufflePlayerElement;
  player.load = vi.fn(() => undefined);
  const newest = vi.fn(() => ({ createPlayer: () => player }));
  return { newest };
}

let loader: LoaderModule;

beforeEach(async () => {
  // loadRuffle keeps a module-level memo, so each test gets a fresh module instance.
  vi.resetModules();
  document.head.innerHTML = "";
  delete window.RufflePlayer;
  loader = await import("./loadRuffle");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("loadRuffle", () => {
  it("injects the runtime script exactly once and memoizes the promise", () => {
    const first = loader.loadRuffle();
    const second = loader.loadRuffle();

    expect(second).toBe(first);
    expect(scripts()).toHaveLength(1);
  });

  it("sets publicPath before the runtime script is injected", () => {
    loader.loadRuffle();

    expect(window.RufflePlayer?.config?.publicPath).toBe("/ruffle/");
    expect(scripts()).toHaveLength(1);
  });

  it("resolves with the runtime once the script loads", async () => {
    const runtime = fakeRuntime();
    const promise = loader.loadRuffle();

    window.RufflePlayer = { ...window.RufflePlayer, newest: runtime.newest };
    scripts()[0].dispatchEvent(new Event("load"));

    const api = await promise;
    expect(api.newest).toBeTypeOf("function");
    api.newest();
    expect(runtime.newest).toHaveBeenCalledTimes(1);
  });

  it("keeps the memoized promise after success without a second injection", async () => {
    const runtime = fakeRuntime();
    const promise = loader.loadRuffle();
    window.RufflePlayer = { ...window.RufflePlayer, newest: runtime.newest };
    scripts()[0].dispatchEvent(new Event("load"));
    await promise;

    expect(loader.loadRuffle()).toBe(promise);
    expect(scripts()).toHaveLength(1);
  });

  it("rejects with an Error when the script fails to load", async () => {
    const promise = loader.loadRuffle();
    const assertion = expect(promise).rejects.toBeInstanceOf(Error);

    scripts()[0].dispatchEvent(new Event("error"));

    await assertion;
    expect(scripts()).toHaveLength(0);
  });

  it("re-injects the script after a failure so a retry can succeed", async () => {
    const failed = loader.loadRuffle();
    const assertion = expect(failed).rejects.toThrow("Failed to load Ruffle");
    scripts()[0].dispatchEvent(new Event("error"));
    await assertion;

    const retried = loader.loadRuffle();
    expect(retried).not.toBe(failed);
    expect(scripts()).toHaveLength(1);

    const runtime = fakeRuntime();
    window.RufflePlayer = { ...window.RufflePlayer, newest: runtime.newest };
    scripts()[0].dispatchEvent(new Event("load"));
    await expect(retried).resolves.toBeDefined();
  });

  it("rejects when the script loads but window.RufflePlayer.newest is missing", async () => {
    const promise = loader.loadRuffle();
    const assertion = expect(promise).rejects.toThrow("newest is missing");

    scripts()[0].dispatchEvent(new Event("load"));

    await assertion;
  });

  it("rejects after 15 seconds if the script never finishes", async () => {
    vi.useFakeTimers();
    const promise = loader.loadRuffle();
    const assertion = expect(promise).rejects.toThrow("Timed out loading Ruffle");

    vi.advanceTimersByTime(loader.RUFFLE_LOAD_TIMEOUT_MS - 1);
    expect(scripts()).toHaveLength(1);
    vi.advanceTimersByTime(1);

    await assertion;
    expect(scripts()).toHaveLength(0);
  });
});
