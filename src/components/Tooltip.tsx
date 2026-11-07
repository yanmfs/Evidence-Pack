import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

interface Props {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={400}>{children}</RadixTooltip.Provider>;
}

export function Tooltip({ label, hint, children }: Props) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="anim-fade z-50 flex items-center gap-2 rounded-md bg-text px-2 py-1 text-xs font-medium text-bg shadow-md"
        >
          {label}
          {hint && (
            <kbd className="rounded-[4px] bg-bg/20 px-1.5 py-px font-mono text-[10.5px]">
              {hint}
            </kbd>
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
