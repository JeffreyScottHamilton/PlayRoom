import { Container } from "../components/layout/Container";
import { EmptyState } from "../components/ui/EmptyState";
import { GameGrid } from "../components/ui/GameGrid";
import { getGame } from "../data/catalog";
import { useFavorites } from "../hooks/useFavorites";
import type { Game } from "../types/game";

export default function FavoritesPage() {
  const { favorites } = useFavorites();
  // Ids for games that were removed from the library are dropped here.
  const games = favorites
    .map((id) => getGame(id))
    .filter((g): g is Game => g !== undefined);

  return (
    <Container className="py-12">
      <h1 className="text-[28px] font-semibold leading-[34px] text-ink">Favorites</h1>

      <div className="mt-8">
        {games.length > 0 ? (
          <GameGrid games={games} />
        ) : (
          <EmptyState
            title="No favorites yet"
            body="Select the heart on any game to save it here."
            action={{ label: "Browse games", to: "/games" }}
          />
        )}
      </div>
    </Container>
  );
}
