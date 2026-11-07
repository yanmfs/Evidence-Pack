import * as Switch from "@radix-ui/react-switch";
import { useId } from "react";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, checked, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <label htmlFor={id} className="flex-1 cursor-pointer text-sm">
        {label}
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-surface-2 transition-colors duration-150 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <Switch.Thumb className="block size-3.5 translate-x-[3px] rounded-full bg-muted transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-contrast" />
      </Switch.Root>
    </div>
  );
}
