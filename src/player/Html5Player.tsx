import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "../components/ui/Button";
import type { GamePlayerHandle, GamePlayerProps } from "./types";

export interface Html5PlayerProps extends GamePlayerProps {
  /** Game title, used for the iframe's accessible name ("<title> game"). */
  title?: string;
}

type Status = "loading" | "ready" | "error";

/** Time without an iframe load event before the game is reported as failed. */
export const HTML5_LOAD_TIMEOUT_MS = 20_000;

// The game runs in an opaque origin: no allow-same-origin, so it cannot read
// PLAYROOM's localStorage, cookies or DOM. Do not add tokens here.
const SANDBOX = "allow-scripts allow-pointer-lock";
const ALLOW = "fullscreen; autoplay; gamepad";

// Keys that would scroll the page while the container has focus.
const SCROLL_KEYS = new Set([" ", "Spacebar"]);
// Native controls keep their own key behaviour (Space/Enter activate buttons).
const NATIVE_CONTROL = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

export const Html5Player = forwardRef<GamePlayerHandle, Html5PlayerProps>(
  function Html5Player({ src, width, height, title, onStatus }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const timerRef = useRef<number | null>(null);
    const onStatusRef = useRef(onStatus);
    const [status, setStatus] = useState<Status>("loading");
    // Bumping the generation re-creates the iframe (key change).
    const [generation, setGeneration] = useState(0);

    useEffect(() => {
      onStatusRef.current = onStatus;
    }, [onStatus]);

    const changeStatus = useCallback((next: Status) => {
      setStatus(next);
      onStatusRef.current?.(next);
    }, []);

    const clearTimer = useCallback(() => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    // Each iframe (src or generation change) starts loading and gets a fresh timeout.
    useEffect(() => {
      changeStatus("loading");
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        changeStatus("error");
      }, HTML5_LOAD_TIMEOUT_MS);
      return clearTimer;
    }, [src, generation, changeStatus, clearTimer]);

    const handleLoad = () => {
      clearTimer();
      changeStatus("ready");
    };

    const restart = useCallback(() => setGeneration((g) => g + 1), []);

    useImperativeHandle(
      ref,
      () => ({
        restart,
        enterFullscreen: () => {
          const el = containerRef.current;
          if (el && typeof el.requestFullscreen === "function") {
            el.requestFullscreen().catch(() => {});
          }
        },
      }),
      [restart],
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (NATIVE_CONTROL.has(target.tagName)) return;
      if (SCROLL_KEYS.has(event.key) || event.key.startsWith("Arrow")) {
        event.preventDefault();
      }
    };

    const focusFrame = () => {
      frameRef.current?.focus({ preventScroll: true });
    };

    return (
      <div
        ref={containerRef}
        tabIndex={-1}
        data-player=""
        data-status={status}
        onKeyDown={handleKeyDown}
        onMouseDown={focusFrame}
        className="relative mx-auto bg-black focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&:fullscreen]:!h-full [&:fullscreen]:!w-full"
        // Width is capped so the height (derived from aspect-ratio) fits the viewport
        // below the page chrome. Capping the width instead of the height keeps the ratio.
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, calc((100dvh - 160px) * ${width} / ${height}))`,
        }}
      >
        <iframe
          key={generation}
          ref={frameRef}
          src={src}
          title={title ? `${title} game` : "Game"}
          sandbox={SANDBOX}
          allow={ALLOW}
          referrerPolicy="no-referrer"
          loading="eager"
          onLoad={handleLoad}
          className="absolute inset-0 h-full w-full border-0 bg-black"
        />

        {status === "loading" && (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-sm text-ink-muted"
          >
            <p>Loading game…</p>
            <div className="h-0.5 w-40 bg-line" aria-hidden="true">
              <div className="h-full w-1/3 bg-ink-muted" />
            </div>
          </div>
        )}

        {status === "error" && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center"
          >
            <p className="text-base text-ink">{"This game couldn't be loaded."}</p>
            <Button variant="primary" onClick={restart}>
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  },
);
