import type { JSX } from "react";
import { Link } from "react-router-dom";

export interface SectionHeaderProps {
  title: string;
  /** Id for the h2, for aria-labelledby. */
  id?: string;
  action?: { label: string; to: string };
}

export function SectionHeader({ id, title, action }: SectionHeaderProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="text-[13px] font-semibold uppercase leading-5 tracking-[0.2em] text-ink">
        {title}
      </h2>
      {action && (
        <Link
          to={action.to}
          className="inline-flex min-h-11 items-center rounded-card px-1 text-sm font-semibold text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
