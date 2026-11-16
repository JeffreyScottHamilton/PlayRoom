import type { JSX } from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: { label: string; to: string };
}

export function EmptyState({ title, body, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-card border border-line bg-surface px-6 py-10 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-2 text-sm leading-5 text-ink-muted">{body}</p>}
      {action && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" to={action.to}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
