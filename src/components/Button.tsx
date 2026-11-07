import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-contrast font-semibold shadow-[inset_0_-1px_0_rgb(0_0_0/0.2)] hover:brightness-[1.07] active:translate-y-px active:brightness-95",
  ghost: "text-muted hover:bg-surface-2 hover:text-text active:bg-border",
  subtle:
    "border border-border-strong/70 bg-surface font-medium text-text hover:bg-surface-2 active:bg-border",
};

export function Button({ variant = "subtle", icon, className = "", ...rest }: Props) {
  const size = icon ? "size-8 justify-center" : "h-8 gap-1.5 px-3";
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center rounded-control text-[13px] transition-[background-color,filter,transform] duration-100 ease-out disabled:pointer-events-none disabled:opacity-45 ${size} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
