import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { useFavorites } from "../../hooks/useFavorites";
import type { Game } from "../../types/game";

/** Up to two leading letters of the title's first two words, e.g. "Sample Racer" -> "SR". */
export function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export interface GameCardProps {
  game: Game;
  showFavorite?: boolean;
}

export function GameCard({ game, showFavorite = true }: GameCardProps): JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const pressed = isFavorite(game.id);

  return (
    <div className="group relative">
      <Link
        to={`/games/${game.id}`}
        className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div className="aspect-[16/10] overflow-hidden rounded-card border border-line bg-elevated">
          {imageFailed ? (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center text-2xl font-semibold text-ink-muted"
            >
              {initials(game.title)}
            </div>
          ) : (
            <img
              src={game.thumbnail}
              alt=""
              width={640}
              height={400}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition duration-150 ease-out group-hover:brightness-[1.06] motion-reduce:transition-none"
            />
          )}
        </div>
        <span
          title={game.title}
          className="mt-2 block truncate text-sm leading-5 text-ink"
        >
          {game.title}
        </span>
      </Link>
      {showFavorite && (
        <button
          type="button"
          aria-pressed={pressed}
          aria-label={`Add ${game.title} to favorites`}
          onClick={() => toggleFavorite(game.id)}
          className={`absolute right-2 top-2 flex size-11 items-center justify-center rounded-card border border-line text-ink opacity-0 transition duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink pointer-coarse:opacity-100 motion-reduce:transition-none ${
            pressed ? "bg-accent" : "bg-bg hover:bg-elevated"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={pressed ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className="size-5"
          >
            <path d="M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.4a3.9 3.9 0 0 1 7 2.5c0 5.3-7 9.6-7 9.6z" />
          </svg>
        </button>
      )}
    </div>
  );
}
