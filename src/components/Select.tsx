import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

interface Props<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}

export function Select<T extends string>({ label, value, onChange, children }: Props<T>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-9 w-full appearance-none rounded-control border border-border bg-surface px-3 pr-8 text-sm"
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
