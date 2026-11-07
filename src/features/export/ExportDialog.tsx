import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { useT } from "../../store";
import { cancelExport, useExport } from "./exporter";

// Not closable by overlay or Escape: leaving mid-export would hide the only way to cancel it.
export function ExportDialog() {
  const t = useT();
  const { stage, done, total } = useExport();
  const fraction = total > 0 ? done / total : 0;
  return (
    <Dialog
      open={stage !== "idle"}
      onOpenChange={() => undefined}
      title={t("export.title")}
      dismissible={false}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm" role="status">
          {stage === "preparing"
            ? t("export.preparing", { done, total })
            : t("export.building", { done, total })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          className="h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.max(3, fraction * 100)}%` }}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={cancelExport}>{t("export.cancel")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
