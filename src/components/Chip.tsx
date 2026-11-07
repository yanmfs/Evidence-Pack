import { CircleCheck, Info, TriangleAlert } from "lucide-react";

type Tone = "neutral" | "success" | "warning";

const icons = { neutral: Info, success: CircleCheck, warning: TriangleAlert };
const colors: Record<Tone, string> = {
  neutral: "text-muted",
  success: "text-success",
  warning: "text-warning",
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  const Icon = icons[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
      <Icon aria-hidden className={`size-3.5 ${colors[tone]}`} />
      {children}
    </span>
  );
}
