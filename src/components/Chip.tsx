type Tone = "neutral" | "success" | "warning";

const dot: Record<Tone, string> = {
  neutral: "bg-border-strong",
  success: "bg-success",
  warning: "bg-warning",
};

// A status label: a small colour dot and a sentence, nothing that looks like a button.
export function Chip({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium">
      <span aria-hidden className={`size-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
}
