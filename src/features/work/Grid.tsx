import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ArrowDownWideNarrow, FilePlus2, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../components/Button";
import {
  itemsOf,
  moveItems,
  numberEvidence,
  removeItems,
  reorderItem,
  sortByDate,
  sortedActivities,
} from "../../core/project";
import { useT } from "../../store";
import { Card } from "./Card";
import { pickAndImport } from "./actions";
import { useCurrent, useWork } from "./store";

export function Grid() {
  const t = useT();
  const project = useCurrent();
  const activityId = useWork((s) => s.activityId);
  const selected = useWork((s) => s.selected);
  const { mutate, clearSelection } = useWork.getState();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = useMemo(() => (project ? itemsOf(project, activityId) : []), [project, activityId]);
  const numbers = useMemo(() => (project ? numberEvidence(project) : new Map()), [project]);
  if (!project) return null;

  const activity = project.activities.find((a) => a.id === activityId);
  const title = activityId === null ? t("activities.inbox") : (activity?.title ?? "");

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      mutate((p) => reorderItem(p, activityId, String(active.id), String(over.id)));
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted">
            {selected.length > 0
              ? t("grid.selected", { count: selected.length })
              : t("grid.items", { count: items.length })}
            {activityId === null && ` · ${t("activities.inboxHint")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 ? (
            <>
              <select
                aria-label={t("grid.moveTo")}
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  mutate((p) => moveItems(p, selected, value === "inbox" ? null : value));
                  clearSelection();
                }}
                className="h-9 rounded-control border border-border bg-surface px-2 text-sm"
              >
                <option value="" disabled>
                  {t("grid.moveTo")}
                </option>
                {sortedActivities(project)
                  .filter((a) => a.id !== activityId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                {activityId !== null && <option value="inbox">{t("activities.inbox")}</option>}
              </select>
              <Button
                onClick={() => {
                  mutate((p) => removeItems(p, selected));
                  clearSelection();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                {t("grid.removeSelected")}
              </Button>
              <Button
                variant="ghost"
                icon
                aria-label={t("grid.clearSelection")}
                onClick={clearSelection}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => mutate((p) => sortByDate(p, activityId))}
                disabled={items.length < 2}
              >
                <ArrowDownWideNarrow className="size-4" aria-hidden />
                {t("grid.sortByDate")}
              </Button>
              <Button variant="primary" onClick={() => void pickAndImport()}>
                <FilePlus2 className="size-4" aria-hidden />
                {t("grid.add")}
              </Button>
            </>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-panel border-2 border-dashed border-border px-8 py-10">
            <h3 className="mb-4 text-center text-lg font-semibold">{t("grid.empty.title")}</h3>
            <ol className="flex flex-col gap-3 text-sm">
              {(["grid.empty.step1", "grid.empty.step2", "grid.empty.step3"] as const).map(
                (key, i) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-contrast">
                      {i + 1}
                    </span>
                    <span>{t(key)}</span>
                  </li>
                ),
              )}
            </ol>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    item={item}
                    project={project}
                    figure={numbers.get(item.id)?.n}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </section>
  );
}
