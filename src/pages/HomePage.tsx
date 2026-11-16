import { useState, type JSX } from "react";
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

export default function HomePage(): JSX.Element {
  const [category, setCategory] = useState<Category | "All">("All");
  const { recent } = useRecentlyPlayed();

  const continuePlaying = recent
    .map((id) => getGame(id))
    .filter((game): game is Game => game !== undefined)
    .slice(0, 6);
  const popular = getPopularGames(6);
  const recentlyAdded = getRecentlyAdded(6);
  const categoryGames = category === "All" ? [] : getGamesByCategory(category);
  const libraryEmpty = allGames.length === 0;

  return (
    <Container className="py-12">
      <Hero />

      <section className="mt-12">
        <SectionHeader title="CATEGORIES" />
        <div className="mt-4">
          <CategoryFilter value={category} onChange={setCategory} />
        </div>
        {category !== "All" && (
          <div className="mt-6">
            {categoryGames.length > 0 ? (
              <GameGrid games={categoryGames} />
            ) : (
              <EmptyState title={`No ${category} games yet`} />
            )}
          </div>
        )}
      </section>

      {continuePlaying.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="CONTINUE PLAYING" />
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
