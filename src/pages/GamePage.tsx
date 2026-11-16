import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/layout/Container";
import { GameGrid } from "../components/ui/GameGrid";
import { getGame, getRelatedGames } from "../data/catalog";
import { useFavorites } from "../hooks/useFavorites";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { RufflePlayer, type RufflePlayerHandle } from "../player/RufflePlayer";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const TOOLBAR_BUTTON = `inline-flex min-h-11 items-center justify-center rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-elevated ${FOCUS_RING}`;

function SectionLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-muted"
    >
      {children}
    </h2>
  );
}

/** Tracks (pointer: coarse). Safe when matchMedia is unavailable. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return coarse;
}

function NotFound() {
  return (
    <Container className="py-12">
      <h1 className="text-[28px] font-semibold leading-[34px] text-ink">Game not found</h1>
      <p className="mt-2 text-base text-ink-muted">There is no game at this address.</p>
      <Link
        to="/games"
        className={`mt-6 inline-flex min-h-11 items-center rounded-card text-ink underline underline-offset-4 ${FOCUS_RING}`}
      >
        All games
      </Link>
    </Container>
  );
}

export default function GamePage() {
  const { id = "" } = useParams();
  const game = getGame(id);
  const location = useLocation();
  const navigate = useNavigate();
  const playerRef = useRef<RufflePlayerHandle>(null);
  const coarse = useCoarsePointer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { recordPlay } = useRecentlyPlayed();
  const recordedId = useRef<string | null>(null);

  const related = useMemo(() => (game ? getRelatedGames(game.id, 6) : []), [game]);

  useEffect(() => {
    if (!game || recordedId.current === game.id) return;
    recordedId.current = game.id;
    recordPlay(game.id);
  }, [game, recordPlay]);

  useEffect(() => {
    if (!game) return;
    const previous = document.title;
    document.title = `${game.title} — PLAYROOM`;
    return () => {
      document.title = previous;
    };
  }, [game]);

  if (!game) return <NotFound />;

  const saved = isFavorite(game.id);
  // Back goes to the previous in-app page when there is one, otherwise to the list.
  const cameFromSite = location.key !== "default";
  const onBackClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!cameFromSite) return;
    event.preventDefault();
    navigate(-1);
  };

  const { license } = game;
  const hasDetails = Boolean(game.developer) || game.releaseYear !== undefined;

  return (
    <Container className="py-6 sm:py-8">
      <Link
        to="/games"
        onClick={onBackClick}
        className={`inline-flex min-h-11 items-center rounded-card text-sm text-ink-muted hover:text-ink ${FOCUS_RING}`}
      >
        ← All games
      </Link>

      <h1 className="mt-2 text-[28px] font-semibold leading-[34px] text-ink">{game.title}</h1>

      <div className="mt-4">
        <RufflePlayer
          ref={playerRef}
          src={game.gameFile}
          width={game.width}
          height={game.height}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className={TOOLBAR_BUTTON} onClick={() => playerRef.current?.enterFullscreen()}>
          Fullscreen
        </button>
        <button type="button" className={TOOLBAR_BUTTON} onClick={() => playerRef.current?.restart()}>
          Restart
        </button>
        <button
          type="button"
          aria-pressed={saved}
          className={`${TOOLBAR_BUTTON} aria-pressed:bg-accent aria-pressed:text-ink`}
          onClick={() => toggleFavorite(game.id)}
        >
          {saved ? "Saved to Favorites" : "Add to Favorites"}
        </button>
      </div>

      {(game.compatibility === "partial" || (game.needsKeyboard && coarse)) && (
        <div className="mt-6 flex flex-col gap-3">
          {game.compatibility === "partial" && (
            <p className="rounded-card border border-line bg-surface p-4 text-sm text-ink">
              Some features of this game may not work correctly in the emulator.
            </p>
          )}
          {game.needsKeyboard && coarse && (
            <p className="rounded-card border border-line bg-surface p-4 text-sm text-ink">
              This game needs a keyboard and mouse. It may not be playable on touch devices.
            </p>
          )}
        </div>
      )}

      <section aria-labelledby="about-heading" className="mt-12">
        <SectionLabel id="about-heading">About</SectionLabel>
        <p className="mt-3 text-base leading-[26px] text-ink">{game.description}</p>
      </section>

      <section aria-labelledby="controls-heading" className="mt-12">
        <SectionLabel id="controls-heading">Controls</SectionLabel>
        <p className="mt-3 text-base leading-[26px] text-ink">{game.controls}</p>
      </section>

      {hasDetails && (
        <section aria-labelledby="details-heading" className="mt-12">
          <SectionLabel id="details-heading">Details</SectionLabel>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            {game.developer && (
              <>
                <dt className="text-ink-muted">Developer</dt>
                <dd className="text-ink">{game.developer}</dd>
              </>
            )}
            {game.releaseYear !== undefined && (
              <>
                <dt className="text-ink-muted">Year</dt>
                <dd className="text-ink">{game.releaseYear}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <section aria-labelledby="license-heading" className="mt-12">
        <SectionLabel id="license-heading">License</SectionLabel>
        <p className="mt-3 text-sm text-ink">
          <a
            href={license.source}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-4 hover:text-ink ${FOCUS_RING}`}
          >
            {license.type}
          </a>
        </p>
        {license.notes && <p className="mt-2 text-sm text-ink-muted">{license.notes}</p>}
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-12">
          <SectionLabel id="related-heading">Related games</SectionLabel>
          <div className="mt-4">
            <GameGrid games={related} />
          </div>
        </section>
      )}
    </Container>
  );
}
