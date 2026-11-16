import type { JSX } from "react";
import { Link } from "react-router-dom";
import type { Game } from "../../types/game";
import { assetUrl } from "../../lib/assetUrl";
import { PlayIcon } from "../ui/PlayIcon";

export function FeaturedGame({ game }: { game: Game }): JSX.Element {
  return (
    <Link
      to={`/games/${game.id}`}
      className="group relative block aspect-[16/8.5] overflow-hidden rounded-card border border-line bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <img
        src={assetUrl(game.thumbnail)}
        alt=""
        width={640}
        height={400}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition duration-150 ease-out group-hover:brightness-[1.06] motion-reduce:transition-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-bg/90 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            FEATURED GAME
          </p>
          <h2 className="mt-1 text-xl font-semibold leading-7 text-ink">{game.title}</h2>
        </div>
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-card bg-accent text-ink transition-colors duration-150 group-hover:bg-accent-hover"
        >
          <PlayIcon className="size-5" />
        </span>
      </div>
    </Link>
  );
}
