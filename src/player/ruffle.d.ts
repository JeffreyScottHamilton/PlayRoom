// Minimal typings for the self-hosted Ruffle runtime (/ruffle/ruffle.js).
// Only the surface PLAYROOM uses. Loaded by loadRuffle.ts.

export interface RuffleConfig {
  /** Directory the runtime fetches its wasm from. */
  publicPath?: string;
}

export interface RuffleLoadOptions {
  url: string;
  autoplay?: "on" | "off" | "auto";
  unmuteOverlay?: "visible" | "hidden";
  splashScreen?: boolean;
  letterbox?: "on" | "off" | "fullscreen";
  contextMenu?: "on" | "off" | "rightClickOnly";
  warnOnUnsupportedContent?: boolean;
}

/** The custom element returned by createPlayer(). */
export interface RufflePlayerElement extends HTMLElement {
  /** Ruffle 0.7 returns void; treat a returned promise as the load result when present. */
  load(options: RuffleLoadOptions): void | Promise<void>;
}

export interface RuffleAPI {
  newest(): { createPlayer(): RufflePlayerElement };
}

/** window.RufflePlayer before and after the runtime script has executed. */
export interface RuffleGlobal {
  config?: RuffleConfig;
  newest?: RuffleAPI["newest"];
}

declare global {
  interface Window {
    RufflePlayer?: RuffleGlobal;
  }
}
