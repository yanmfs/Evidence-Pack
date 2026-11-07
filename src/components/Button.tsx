import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast font-medium hover:brightness-95 active:brightness-90",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  subtle: "bg-surface-2 text-text hover:brightness-95 border border-border",
};

export function Button({ variant = "subtle", icon, className = "", ...rest }: Props) {
  const size = icon ? "size-8 justify-center" : "h-9 gap-2 px-3.5";
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center rounded-control text-sm transition-colors duration-150 ease-out disabled:opacity-50 ${size} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
