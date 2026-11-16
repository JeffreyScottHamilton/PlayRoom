import type { JSX } from "react";

export function PlayIcon({ className = "size-4" }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M7 4.75v14.5L19 12z" />
    </svg>
  );
}
