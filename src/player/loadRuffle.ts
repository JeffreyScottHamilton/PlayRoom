// STUB (S1). Real loader is slice S3.

export interface RuffleAPI {
  newest: () => { createPlayer: () => HTMLElement };
}

// TODO(S3): inject <script src="/ruffle/ruffle.js"> once and resolve window.RufflePlayer.
export function loadRuffle(): Promise<RuffleAPI> {
  return Promise.reject(new Error("loadRuffle: not implemented (S3)"));
}
