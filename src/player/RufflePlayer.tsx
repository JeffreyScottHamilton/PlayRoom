// STUB (S1). Real player is slice S3.
import { forwardRef } from "react";

export interface RufflePlayerHandle {
  restart(): void;
  enterFullscreen(): void;
}

export interface RufflePlayerProps {
  src: string;
  width: number;
  height: number;
  onStatus?: (s: "loading" | "ready" | "error") => void;
}

// TODO(S3): implement the Ruffle container, config and imperative handle.
export const RufflePlayer = forwardRef<RufflePlayerHandle, RufflePlayerProps>(
  function RufflePlayer(_props, _ref) {
    return <div />;
  },
);
