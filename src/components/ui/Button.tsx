import type { ButtonHTMLAttributes, JSX } from "react";
import { Link } from "react-router-dom";

export type ButtonVariant = "primary" | "secondary";

const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-card px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink hover:bg-accent-hover",
  secondary: "border border-line text-ink hover:bg-elevated",
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  /** When set, renders a react-router <Link> instead of a <button>. */
  to?: string;
  className?: string;
}

export function Button({
  variant = "primary",
  to,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps): JSX.Element {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`.trim();
  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
