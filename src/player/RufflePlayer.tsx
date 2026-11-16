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
import { loadRuffle } from "./loadRuffle";
import type { RufflePlayerElement, RuffleLoadOptions } from "./ruffle";

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

type Status = "loading" | "ready" | "error";

const PLAYER_OPTIONS: Omit<RuffleLoadOptions, "url"> = {
  autoplay: "on",
  unmuteOverlay: "hidden",
  splashScreen: false,
  letterbox: "on",
  contextMenu: "rightClickOnly",
  warnOnUnsupportedContent: true,
};

// Keys that would scroll the page while the player has focus.
const SCROLL_KEYS = new Set([" ", "Spacebar"]);
// Native controls keep their own key behaviour (Space/Enter activate buttons).
const NATIVE_CONTROL = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

export const RufflePlayer = forwardRef<RufflePlayerHandle, RufflePlayerProps>(
  function RufflePlayer({ src, width, height, onStatus }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<RufflePlayerElement | null>(null);
    const onStatusRef = useRef(onStatus);
    const [status, setStatus] = useState<Status>("loading");
    // Bumping the generation destroys and re-creates the player element.
    const [generation, setGeneration] = useState(0);

    useEffect(() => {
      onStatusRef.current = onStatus;
    }, [onStatus]);

    const changeStatus = useCallback((next: Status) => {
      setStatus(next);
      onStatusRef.current?.(next);
    }, []);

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      let cancelled = false;
      let player: RufflePlayerElement | null = null;

      const ready = () => {
        if (!cancelled) changeStatus("ready");
      };
      const fail = () => {
        if (!cancelled) changeStatus("error");
      };

      changeStatus("loading");

      loadRuffle()
        .then((api) => {
          if (cancelled) return;
          const created = api.newest().createPlayer();
          player = created;
          playerRef.current = created;
          created.addEventListener("loadedmetadata", ready);
          created.addEventListener("error", fail);
          mount.appendChild(created);

          const result = created.load({ url: src, ...PLAYER_OPTIONS });
          if (result && typeof result.then === "function") {
            result.then(ready, fail);
          }
        })
        .catch(fail);

      return () => {
        cancelled = true;
        if (player) {
          // Removing the element stops the movie and its audio.
          player.remove();
          if (playerRef.current === player) playerRef.current = null;
        }
      };
    }, [src, generation, changeStatus]);

    useImperativeHandle(
      ref,
      () => ({
        restart: () => setGeneration((g) => g + 1),
        enterFullscreen: () => {
          const el = containerRef.current;
          if (el && typeof el.requestFullscreen === "function") {
            el.requestFullscreen().catch(() => {});
          }
        },
      }),
      [],
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (NATIVE_CONTROL.has(target.tagName)) return;
      if (SCROLL_KEYS.has(event.key) || event.key.startsWith("Arrow")) {
        event.preventDefault();
      }
    };

    const focusContainer = () => {
      containerRef.current?.focus({ preventScroll: true });
    };

    return (
      <div
        ref={containerRef}
        tabIndex={-1}
        data-player=""
        data-status={status}
        onKeyDown={handleKeyDown}
        onMouseDown={focusContainer}
        className="relative mx-auto bg-black focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&:fullscreen]:!h-full [&:fullscreen]:!w-full"
        // Width is capped so the height (derived from aspect-ratio) fits the viewport
        // below the page chrome. Capping the width instead of the height keeps the ratio.
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, calc((100dvh - 160px) * ${width} / ${height}))`,
        }}
      >
        <div
          ref={mountRef}
          className="absolute inset-0 [&>ruffle-player]:block [&>ruffle-player]:h-full [&>ruffle-player]:w-full"
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
            <Button variant="primary" onClick={() => setGeneration((g) => g + 1)}>
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  },
);
