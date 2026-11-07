import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical, Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
import { Tooltip } from "../../components/Tooltip";
import { formatDate } from "../../core/dates";
import { removeItems, updateItem } from "../../core/project";
import type { Evidence, Project } from "../../core/types";
import { platform } from "../../platform";
import { selectLang, useApp, useT } from "../../store";
import { useWork } from "./store";

const SOURCE_LABEL = {
  exif: "date.exif",
  filename: "date.filename",
  file: "date.file",
  manual: "date.manual",
} as const;

const SOURCE_BADGE = { exif: "EXIF", filename: "Nome", file: "Arquivo", manual: "Manual" } as const;

export function Card({
  item,
  project,
  figure,
}: {
  item: Evidence;
  project: Project;
  figure?: number;
}) {
  const t = useT();
  const lang = useApp(selectLang);
  const selected = useWork((s) => s.selected.includes(item.id));
  const { toggleSelected, mutate } = useWork.getState();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const badge = item.dateSource
    ? (lang === "en"
        ? { exif: "EXIF", filename: "Name", file: "File", manual: "Manual" }
        : SOURCE_BADGE)[item.dateSource]
    : null;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={`flex flex-col overflow-hidden rounded-panel border bg-surface ${selected ? "border-accent ring-2 ring-accent/40" : "border-border"}`}
    >
      <div className="relative flex h-40 items-center justify-center bg-surface-2">
        {item.kind === "image" && item.thumbName ? (
          <img
            src={platform.thumbUrl(project.id, item.thumbName)}
            alt={item.caption}
            loading="lazy"
            draggable={false}
            className="size-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted">
            <FileText className="size-10" aria-hidden />
            <span className="text-xs">{t("card.pdfPages", { count: item.pages ?? 1 })}</span>
          </div>
        )}
        <label className="absolute left-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-control bg-surface/90 shadow">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelected(item.id)}
            aria-label={t("card.select")}
            className="size-4 accent-[var(--accent)]"
          />
        </label>
        <button
          type="button"
          aria-label={t("card.drag")}
          className="absolute right-2 top-2 flex size-8 cursor-grab items-center justify-center rounded-control bg-surface/90 text-muted shadow"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {figure !== undefined && (
          <span className="absolute bottom-2 left-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium shadow">
            {item.kind === "pdf" ? t("report.annex") : t("report.figure")} {figure}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <textarea
          aria-label={t("card.caption")}
          placeholder={t("card.caption")}
          value={item.caption}
          rows={2}
          onChange={(e) => mutate((p) => updateItem(p, item.id, { caption: e.target.value }))}
          className="w-full resize-none rounded-control border border-border bg-surface px-2 py-1.5 text-sm"
        />
        <div className="flex items-center gap-2">
          {badge && (
            <Tooltip label={t(SOURCE_LABEL[item.dateSource!])}>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${item.dateSource === "file" ? "border-warning text-warning" : "border-border text-muted"}`}
              >
                {badge}
              </span>
            </Tooltip>
          )}
          <input
            type="date"
            aria-label={t("card.date")}
            value={item.date?.slice(0, 10) ?? ""}
            onChange={(e) =>
              mutate((p) =>
                updateItem(p, item.id, {
                  date: e.target.value || null,
                  dateSource: e.target.value ? "manual" : null,
                }),
              )
            }
            className="h-8 min-w-0 flex-1 rounded-control border border-border bg-surface px-2 text-sm"
          />
          <Tooltip label={t("card.remove")}>
            <Button
              variant="ghost"
              icon
              aria-label={t("card.remove")}
              onClick={() => mutate((p) => removeItems(p, [item.id]))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Tooltip>
        </div>
        {item.date && <span className="sr-only">{formatDate(item.date, lang)}</span>}
      </div>
    </li>
  );
}
