export interface GamePlayerHandle {
  restart(): void;
  enterFullscreen(): void;
}

export interface GamePlayerProps {
  src: string;
  width: number;
  height: number;
  onStatus?: (s: "loading" | "ready" | "error") => void;
}
