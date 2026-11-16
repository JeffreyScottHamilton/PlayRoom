import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SearchBox } from "../search/SearchBox";
import { Container } from "./Container";

const NAV_LINKS = [
  { to: "/games", label: "Games" },
  { to: "/games#categories", label: "Categories" },
  { to: "/favorites", label: "Favorites" },
] as const;

function isActive(to: string, pathname: string, hash: string): boolean {
  if (to === "/games#categories") {
    return pathname.startsWith("/games") && hash === "#categories";
  }
  if (to === "/games") {
    return pathname.startsWith("/games") && hash !== "#categories";
  }
  return pathname.startsWith(to);
}

const linkBase =
  "inline-flex min-h-11 items-center rounded-card px-2 text-[14px] leading-[20px] font-medium transition-colors";

function PlayMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6 shrink-0 text-accent"
    >
      <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
    </svg>
  );
}

export function Header() {
  const { pathname, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-line bg-bg">
      <Container className="flex h-16 items-center gap-4">
        <Link
          to="/"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-card text-[18px] font-bold leading-none tracking-tight text-ink"
        >
          <PlayMark />
          <span>PLAYROOM</span>
        </Link>

        <nav aria-label="Primary" className="hidden md:flex md:items-center md:gap-2">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.to, pathname, hash);
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? "page" : undefined}
                className={`${linkBase} ${active ? "text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <SearchBox className="ml-auto min-w-0 flex-1 md:max-w-64 md:flex-none" />

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-card text-ink md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
          >
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </Container>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-line md:hidden"
        >
          <Container className="flex flex-col py-2">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.to, pathname, hash);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`${linkBase} ${active ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </Container>
        </nav>
      )}
    </header>
  );
}
