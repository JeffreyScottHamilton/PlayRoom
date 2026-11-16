// STUB (S1). Real component is slice S2.
import type { JSX } from "react";
import type { Category } from "../../types/game";

// TODO(S2): radiogroup of category chips, horizontal scroll on mobile.
export function CategoryFilter(_props: {
  value: Category | "All";
  onChange: (c: Category | "All") => void;
}): JSX.Element {
  return <div />;
}
