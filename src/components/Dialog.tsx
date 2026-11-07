import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../store";
import { Button } from "./Button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  dismissible?: boolean;
}

export function Dialog({ open, onOpenChange, title, children, dismissible = true }: Props) {
  const t = useT();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="anim-fade fixed inset-0 z-40 bg-black/50" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          className="anim-pop fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-32px)] w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-border-strong/60 bg-surface p-5 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.55)]"
        >
          <div className="mb-4 flex items-center justify-between">
            <RadixDialog.Title className="font-display text-lg font-semibold tracking-tight">
              {title}
            </RadixDialog.Title>
            {dismissible && (
              <RadixDialog.Close asChild>
                <Button variant="ghost" icon aria-label={t("dialog.close")}>
                  <X className="size-4" aria-hidden />
                </Button>
              </RadixDialog.Close>
            )}
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
