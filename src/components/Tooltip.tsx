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
          className="anim-fade z-50 flex items-center gap-2 rounded-control bg-text px-2.5 py-1.5 text-xs text-bg shadow-lg"
        >
          {label}
          {hint && (
            <kbd className="rounded bg-bg/20 px-1.5 py-0.5 font-sans text-[11px]">{hint}</kbd>
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
