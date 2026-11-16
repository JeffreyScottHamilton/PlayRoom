import type { JSX } from "react";
import type { Game } from "../../types/game";
import { GameCard } from "./GameCard";

export function GameGrid({ games }: { games: Game[] }): JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {games.map((game) => (
        <li key={game.id}>
          <GameCard game={game} />
        </li>
      ))}
    </ul>
  );
}
