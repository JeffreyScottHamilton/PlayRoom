import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Container } from "../components/layout/Container";
import { CategoryFilter } from "../components/ui/CategoryFilter";
import { EmptyState } from "../components/ui/EmptyState";
import { GameGrid } from "../components/ui/GameGrid";
import { allGames, getGamesByCategory } from "../data/catalog";
import { searchGames } from "../lib/search";
import { CATEGORIES, type Category } from "../types/game";

const PAGE_SIZE = 24;

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-card border border-line bg-elevated px-4 text-sm font-medium text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const fieldClass =
  "h-11 w-full rounded-card border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:max-w-sm";

function parseCategory(value: string | null): Category | "All" {
  return (CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as Category)
    : "All";
}

export default function GamesPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const categoriesRef = useRef<HTMLDivElement>(null);

  const q = params.get("q") ?? "";
  const trimmed = q.trim();
  const category = parseCategory(params.get("category"));

  // Keep the URL as the single source of truth for the filters.
  function filtersWith(changes: { q?: string | null; category?: Category | "All" | null }) {
    const next = new URLSearchParams(params);
    if ("q" in changes) {
      if (changes.q) next.set("q", changes.q);
      else next.delete("q");
    }
    if ("category" in changes) {
      if (changes.category && changes.category !== "All") next.set("category", changes.category);
      else next.delete("category");
    }
    return next;
  }

  function update(changes: { q?: string | null; category?: Category | "All" | null }) {
    setParams(filtersWith(changes), { replace: true });
  }

  // EmptyState actions are links, so they carry the resulting URL as `to`.
  function hrefWith(changes: { q?: string | null; category?: Category | "All" | null }) {
    const qs = filtersWith(changes).toString();
    return qs ? `${location.pathname}?${qs}` : location.pathname;
  }

  // "/categories" redirects here with #categories: move focus to the filter.
  useEffect(() => {
    if (location.hash === "#categories") categoriesRef.current?.focus();
  }, [location.hash]);

  const inCategory = useMemo(() => getGamesByCategory(category), [category]);
  const results = useMemo(
    () => (trimmed === "" ? inCategory : searchGames(trimmed, inCategory, Infinity)),
    [trimmed, inCategory],
  );

  // Paging resets whenever the filter or search changes.
  const pageKey = `${category}\u0000${trimmed}`;
  const [paging, setPaging] = useState({ key: pageKey, count: PAGE_SIZE });
  const shownCount = paging.key === pageKey ? paging.count : PAGE_SIZE;
  const visible = results.slice(0, shownCount);
  const remaining = results.length - visible.length;

  const countLabel = `${results.length} ${results.length === 1 ? "game" : "games"}`;

  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-[28px] font-semibold leading-[34px] text-ink">All Games</h1>
        <p className="text-sm text-ink-muted">{countLabel}</p>
      </div>

      <div className="mt-6">
        <input
          type="search"
          aria-label="Search titles"
          placeholder="Search games…"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div
        id="categories"
        ref={categoriesRef}
        tabIndex={-1}
        className="mt-6 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <CategoryFilter
          value={category}
          onChange={(c) => update({ category: c })}
        />
      </div>

      <div className="mt-8">
        {allGames.length === 0 ? (
          <EmptyState
            title="The library is being stocked"
            body="Licensed games are added as permission is confirmed."
          />
        ) : results.length === 0 ? (
          trimmed !== "" ? (
            <EmptyState
              title={`No games match “${trimmed}”`}
              action={{ label: "Clear search", to: hrefWith({ q: null }) }}
            />
          ) : (
            <EmptyState
              title="No games in this category."
              action={{ label: "Show all games", to: hrefWith({ category: "All" }) }}
            />
          )
        ) : (
          <>
            <GameGrid games={visible} />
            {remaining > 0 && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setPaging({ key: pageKey, count: shownCount + PAGE_SIZE })}
                >
                  Load more ({remaining} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
