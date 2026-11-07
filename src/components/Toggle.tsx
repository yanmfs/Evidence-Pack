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
      <label htmlFor={id} className="flex-1 cursor-pointer text-[13px]">
        {label}
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-[18px] w-8 shrink-0 rounded-full border border-border-strong bg-surface-2 transition-colors duration-150 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <Switch.Thumb className="block size-3 translate-x-[2px] rounded-full bg-muted transition-transform duration-150 data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-accent-contrast" />
      </Switch.Root>
    </div>
  );
}
