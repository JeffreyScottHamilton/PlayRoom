import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { Container } from "../components/layout/Container";
import { Hero } from "../components/home/Hero";
import { CategoryFilter } from "../components/ui/CategoryFilter";
import { EmptyState } from "../components/ui/EmptyState";
import { GameGrid } from "../components/ui/GameGrid";
import { SectionHeader } from "../components/ui/SectionHeader";
import {
  allGames,
  getGame,
  getGamesByCategory,
  getPopularGames,
  getRecentlyAdded,
} from "../data/catalog";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import type { Category, Game } from "../types/game";

const VIEW_ALL = { label: "View All →", to: "/games" } as const;
/** Games shown under "All" in the Categories section before linking to /games. */
const ALL_PREVIEW = 12;

const linkButtonClass =
  "inline-flex min-h-11 items-center rounded-card px-1 text-sm font-semibold text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

export default function HomePage(): JSX.Element {
  const [category, setCategory] = useState<Category | "All">("All");
  const { recent, clearRecent } = useRecentlyPlayed();

  const continuePlaying = recent
    .map((id) => getGame(id))
    .filter((game): game is Game => game !== undefined)
    .slice(0, 6);
  const popular = getPopularGames(6);
  const recentlyAdded = getRecentlyAdded(6);
  const categoryGames = getGamesByCategory(category);
  const libraryEmpty = allGames.length === 0;

  return (
    <Container className="py-12">
      <Hero />

      <section className="mt-12">
        <SectionHeader title="CATEGORIES" />
        <div className="mt-4">
          <CategoryFilter value={category} onChange={setCategory} />
        </div>
        {(category !== "All" || categoryGames.length > 0) && (
          <div className="mt-6">
            {categoryGames.length === 0 ? (
              <EmptyState title={`No ${category} games yet`} />
            ) : category === "All" ? (
              <>
                <GameGrid games={categoryGames.slice(0, ALL_PREVIEW)} />
                {categoryGames.length > ALL_PREVIEW && (
                  <div className="mt-6 flex justify-center">
                    <Link to="/games" className={linkButtonClass}>
                      View all games
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <GameGrid games={categoryGames} />
            )}
          </div>
        )}
      </section>

      {continuePlaying.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionHeader title="CONTINUE PLAYING" />
            </div>
            <button
              type="button"
              aria-label="Clear recently played"
              onClick={() => clearRecent()}
              className={linkButtonClass}
            >
              Clear
            </button>
          </div>
          <div className="mt-4">
            <GameGrid games={continuePlaying} />
          </div>
        </section>
      )}

      {libraryEmpty ? (
        <section className="mt-12">
          <EmptyState
            title="The library is being stocked"
            body="Licensed games are added as permission is confirmed."
          />
        </section>
      ) : (
        <>
          {popular.length > 0 && (
            <section className="mt-12">
              <SectionHeader title="POPULAR GAMES" action={VIEW_ALL} />
              <div className="mt-4">
                <GameGrid games={popular} />
              </div>
            </section>
          )}
          {recentlyAdded.length > 0 && (
            <section className="mt-12">
              <SectionHeader title="RECENTLY ADDED" action={VIEW_ALL} />
              <div className="mt-4">
                <GameGrid games={recentlyAdded} />
              </div>
            </section>
          )}
        </>
      )}
    </Container>
  );
}
