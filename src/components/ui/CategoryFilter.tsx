import { useRef, type JSX, type KeyboardEvent } from "react";
import { CATEGORIES, type Category } from "../../types/game";

type Option = Category | "All";

const OPTIONS: readonly Option[] = ["All", ...CATEGORIES];

export interface CategoryFilterProps {
  value: Category | "All";
  onChange: (c: Category | "All") => void;
}

export function CategoryFilter({ value, onChange }: CategoryFilterProps): JSX.Element {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const count = OPTIONS.length;

  function move(index: number) {
    buttons.current[index]?.focus();
    onChange(OPTIONS[index]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    move(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Filter by category"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {OPTIONS.map((option, index) => {
        const selected = option === value;
        return (
          <button
            key={option}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-11 shrink-0 rounded-card border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
              selected
                ? "border-ink bg-ink text-bg"
                : "border-line text-ink-muted hover:bg-elevated hover:text-ink"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
