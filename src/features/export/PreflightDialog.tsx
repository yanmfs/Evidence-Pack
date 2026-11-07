import { CircleAlert, CircleX, Info } from "lucide-react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import type { PreflightIssue } from "../../core/preflight";
import { useT } from "../../store";
import { exportAnyway, usePreflight } from "./preflight";

const ICON = { blocker: CircleX, warning: CircleAlert, tip: Info } as const;
const TONE = { blocker: "text-danger", warning: "text-warning", tip: "text-muted" } as const;

function Line({ issue }: { issue: PreflightIssue }) {
  const t = useT();
  const Icon = ICON[issue.severity];
  return (
    <li className="flex items-start gap-2.5 text-[13px]">
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${TONE[issue.severity]}`} />
      <span>{t(`preflight.${issue.id}`, { count: issue.count })}</span>
    </li>
  );
}

export function PreflightDialog() {
  const t = useT();
  const { open, issues, close } = usePreflight();
  const blocked = issues.some((i) => i.severity === "blocker");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()} title={t("preflight.title")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("preflight.intro")}</p>
        <ul className="flex flex-col gap-2.5">
          {issues.map((issue) => (
            <Line key={issue.id} issue={issue} />
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>{t("preflight.review")}</Button>
          {!blocked && (
            <Button variant="primary" onClick={exportAnyway}>
              {t("preflight.go")}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
