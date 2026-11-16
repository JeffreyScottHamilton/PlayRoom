import type { JSX } from "react";
import { getFeaturedGame } from "../../data/catalog";
import { Button } from "../ui/Button";
import { PlayIcon } from "../ui/PlayIcon";
import { FeaturedGame } from "./FeaturedGame";

function FeaturedPlaceholder(): JSX.Element {
  return (
    <div className="flex aspect-[16/8.5] flex-col items-center justify-center gap-4 rounded-card border border-line bg-surface p-8 text-center">
      <div className="flex items-center gap-2 text-ink">
        <PlayIcon className="size-6 text-accent" />
        <span className="text-lg font-semibold tracking-[0.2em]">PLAYROOM</span>
      </div>
      <p className="text-sm leading-5 text-ink-muted">
        Games are being added — check back soon.
      </p>
    </div>
  );
}

export function Hero(): JSX.Element {
  const featured = getFeaturedGame();
  return (
    <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div>
        <p className="text-[13px] font-semibold uppercase leading-4 tracking-[0.2em] text-accent">
          CLASSIC FLASH GAMES
        </p>
        <h1 className="mt-4 text-balance text-[44px] font-semibold leading-[48px] text-ink">
          All Your Favorite Games in One Place.
        </h1>
        <p className="mt-6 max-w-prose text-base leading-[26px] text-ink-muted">
          Play classic browser games from the golden age of Flash. Action, puzzle,
          platformers, and more — all for free.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button to="/games">
            <PlayIcon />
            <span>Browse Games</span>
          </Button>
          <Button variant="secondary" to="/games#categories">
            View Categories
          </Button>
        </div>
      </div>
      {featured ? <FeaturedGame game={featured} /> : <FeaturedPlaceholder />}
    </section>
  );
}
