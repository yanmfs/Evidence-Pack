import { CircleAlert, CircleCheck } from "lucide-react";
import { useToasts } from "../toast";

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;
        return (
          <div
            key={toast.id}
            className="anim-slide-up flex max-w-md items-center gap-2 rounded-lg bg-text px-3.5 py-2.5 text-[13px] font-medium text-bg shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)]"
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
