import { Link } from "react-router-dom";
import { Container } from "../components/layout/Container";
import { EmptyState } from "../components/ui/EmptyState";
import { GameGrid } from "../components/ui/GameGrid";
import { getGame } from "../data/catalog";
import { useFavorites } from "../hooks/useFavorites";
import type { Game } from "../types/game";

const primaryLink =
  "inline-flex min-h-11 items-center justify-center rounded-card bg-accent px-4 text-sm font-medium text-ink hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

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
          <EmptyState>
            <p className="text-base font-medium text-ink">No favorites yet</p>
            <p className="text-sm text-ink-muted">
              Select the heart on any game to save it here.
            </p>
            <Link to="/games" className={primaryLink}>
              Browse games
            </Link>
          </EmptyState>
        )}
      </div>
    </Container>
  );
}
