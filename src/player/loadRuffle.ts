import type { RuffleAPI, RuffleConfig, RuffleGlobal } from "./ruffle";

export type { RuffleAPI } from "./ruffle";

export const RUFFLE_SCRIPT_SRC = "/ruffle/ruffle.js";
export const RUFFLE_PUBLIC_PATH = "/ruffle/";
export const RUFFLE_LOAD_TIMEOUT_MS = 15_000;

let pending: Promise<RuffleAPI> | null = null;

/**
 * Injects <script src="/ruffle/ruffle.js"> once and resolves window.RufflePlayer.
 * The promise is memoized; a failed attempt clears the memo and removes the
 * script tag so a later call (e.g. the Retry button) injects it again.
 */
export function loadRuffle(): Promise<RuffleAPI> {
  if (pending) return pending;

  pending = new Promise<RuffleAPI>((resolve, reject) => {
    const config: RuffleConfig = { publicPath: RUFFLE_PUBLIC_PATH };
    // The runtime merges window.RufflePlayer.config over its defaults, so set it first.
    const ruffleGlobal: RuffleGlobal = window.RufflePlayer ?? {};
    ruffleGlobal.config = { ...ruffleGlobal.config, ...config };
    window.RufflePlayer = ruffleGlobal;

    const script = document.createElement("script");
    script.src = RUFFLE_SCRIPT_SRC;
    script.async = true;

    const fail = (reason: string) => {
      window.clearTimeout(timer);
      script.remove();
      pending = null;
      reject(new Error(reason));
    };

    const timer = window.setTimeout(
      () => fail("Timed out loading Ruffle"),
      RUFFLE_LOAD_TIMEOUT_MS,
    );

    script.addEventListener("load", () => {
      window.clearTimeout(timer);
      const runtime = window.RufflePlayer;
      if (!runtime || typeof runtime.newest !== "function") {
        fail("Ruffle loaded but window.RufflePlayer.newest is missing");
        return;
      }
      // Resolve the runtime object itself so newest() keeps its receiver.
      resolve(runtime as RuffleAPI);
    });
    script.addEventListener("error", () => fail("Failed to load Ruffle"));

    document.head.appendChild(script);
  });

  return pending;
}
