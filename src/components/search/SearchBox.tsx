import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { allGames } from "../../data/catalog";
import { searchGames } from "../../lib/search";
import type { Game } from "../../types/game";

const MAX_RESULTS = 8;

/** "/" must not steal focus from text fields or from inside the player. */
function allowsSlashShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  if (target.isContentEditable) return false;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return false;
  if (target.closest("[data-player]")) return false;
  return true;
}

const fieldClass =
  "h-11 w-full rounded-card border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const linkClass =
  "inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function SearchBox({ className = "" }: { className?: string }): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed === "" ? [] : searchGames(trimmed, allGames, MAX_RESULTS)),
    [trimmed],
  );
  const showPopup = open && trimmed !== "";
  const activeGame: Game | undefined =
    showPopup && active >= 0 && active < results.length ? results[active] : undefined;

  // Close the results whenever the route changes.
  useEffect(() => {
    setOpen(false);
    setActive(-1);
  }, [location.pathname, location.search]);

  // Global "/" shortcut focuses the search field.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!allowsSlashShortcut(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(game?: Game) {
    setOpen(false);
    setActive(-1);
    if (game) {
      navigate(`/games/${game.id}`);
    } else {
      navigate(trimmed === "" ? "/games" : `/games?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    const n = results.length;

    switch (e.key) {
      case "ArrowDown": {
        if (n === 0) return;
        e.preventDefault();
        setActive(showPopup ? (active + 1) % n : 0);
        setOpen(true);
        return;
      }
      case "ArrowUp": {
        if (n === 0) return;
        e.preventDefault();
        setActive(showPopup && active >= 0 ? (active - 1 + n) % n : n - 1);
        setOpen(true);
        return;
      }
      case "Enter": {
        e.preventDefault();
        go(activeGame);
        return;
      }
      case "Escape": {
        if (!showPopup) return;
        e.preventDefault();
        setOpen(false);
        setActive(-1);
        return;
      }
    }
  }

  return (
    <div role="search" className={`relative ${className}`.trim()}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search games"
        aria-autocomplete="list"
        aria-expanded={showPopup}
        aria-controls={showPopup && results.length > 0 ? listId : undefined}
        aria-activedescendant={activeGame ? optionId(active) : undefined}
        placeholder="Search games…"
        autoComplete="off"
        spellCheck={false}
        value={query}
        className={fieldClass}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />

      {showPopup &&
        (results.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching games"
            // Keep focus in the input while an option is pressed.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-card border border-line bg-elevated p-1"
          >
            {results.map((game, i) => (
              <li
                key={game.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onClick={() => go(game)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-card px-2 py-1 text-sm text-ink ${
                  i === active ? "bg-surface" : ""
                }`}
              >
                <img
                  src={game.thumbnail}
                  alt=""
                  width={40}
                  height={25}
                  loading="lazy"
                  decoding="async"
                  className="h-[25px] w-[40px] shrink-0 rounded-sm object-cover"
                />
                <span className="truncate">{game.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="absolute inset-x-0 top-full z-50 mt-2 flex flex-col gap-1 rounded-card border border-line bg-elevated p-3">
            <p className="text-sm text-ink-muted">No games match “{trimmed}”</p>
            <Link to="/games" className={linkClass}>
              All Games
            </Link>
          </div>
        ))}
    </div>
  );
}
