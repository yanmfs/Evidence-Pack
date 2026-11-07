import { ArrowDown, ArrowUp, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Dialog } from "../../components/Dialog";
import { Tooltip } from "../../components/Tooltip";
import {
  addActivity,
  itemsOf,
  moveActivity,
  removeActivity,
  sortedActivities,
  updateActivity,
} from "../../core/project";
import type { Activity, Project } from "../../core/types";
import { useT } from "../../store";
import { useCurrent, useWork } from "./store";

function ActivityDialog({
  project,
  activity,
  onClose,
}: {
  project: Project;
  activity: Activity;
  onClose: () => void;
}) {
  const t = useT();
  const mutate = useWork((s) => s.mutate);
  const [draft, setDraft] = useState(activity);
  const save = () => {
    mutate((p) =>
      updateActivity(p, activity.id, {
        title: draft.title.trim() || activity.title,
        description: draft.description,
        start: draft.start,
        end: draft.end,
      }),
    );
    onClose();
  };
  void project;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("activities.edit")}>
      <div className="flex flex-col gap-3">
        <Field
          label={t("activities.name")}
          value={draft.title}
          onChange={(title) => setDraft({ ...draft, title })}
        />
        <Field
          multiline
          label={t("activities.description")}
          value={draft.description ?? ""}
          onChange={(description) => setDraft({ ...draft, description })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            type="date"
            label={t("activities.start")}
            value={draft.start ?? ""}
            onChange={(start) => setDraft({ ...draft, start: start || undefined })}
          />
          <Field
            type="date"
            label={t("activities.end")}
            value={draft.end ?? ""}
            onChange={(end) => setDraft({ ...draft, end: end || undefined })}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Button
            onClick={() => {
              mutate((p) => removeActivity(p, activity.id));
              useWork.getState().selectActivity(null);
              onClose();
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {t("activities.delete")}
          </Button>
          <Button variant="primary" onClick={save}>
            {t("projects.save")}
          </Button>
        </div>
        <p className="text-xs text-muted">{t("activities.deleteHint")}</p>
      </div>
    </Dialog>
  );
}

export function Sidebar() {
  const t = useT();
  const project = useCurrent();
  const activityId = useWork((s) => s.activityId);
  const { mutate, selectActivity } = useWork.getState();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Activity | null>(null);
  if (!project) return null;

  const activities = sortedActivities(project);
  const inboxCount = itemsOf(project, null).length;

  const add = () => {
    const title = name.trim();
    if (!title) return;
    const id = crypto.randomUUID();
    mutate((p) => addActivity(p, id, title));
    selectActivity(id);
    setName("");
  };

  const row = (active: boolean) =>
    `group flex min-h-10 items-center gap-1 rounded-control px-2 text-sm ${active ? "bg-accent/15 font-medium" : "hover:bg-surface-2"}`;

  return (
    <aside
      aria-label={t("activities.title")}
      className="flex w-72 shrink-0 flex-col border-r border-border bg-surface"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("activities.title")}
        </h2>
        <ul className="flex flex-col gap-0.5">
          {activities.map((a, index) => (
            <li key={a.id} className={row(activityId === a.id)}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left"
                onClick={() => selectActivity(a.id)}
                aria-current={activityId === a.id}
              >
                <span className="truncate">{a.title}</span>
                <span className="text-xs text-muted">{itemsOf(project, a.id).length}</span>
              </button>
              <span className="flex opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  icon
                  aria-label={t("activities.moveUp")}
                  disabled={index === 0}
                  onClick={() => mutate((p) => moveActivity(p, index, index - 1))}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  icon
                  aria-label={t("activities.moveDown")}
                  disabled={index === activities.length - 1}
                  onClick={() => mutate((p) => moveActivity(p, index, index + 1))}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  icon
                  aria-label={t("activities.edit")}
                  onClick={() => setEditing(a)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>

        <form
          className="mt-3 flex gap-2 px-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            aria-label={t("activities.new")}
            placeholder={t("activities.newPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-sm"
          />
          <Tooltip label={t("activities.add")}>
            <Button
              variant="primary"
              icon
              aria-label={t("activities.add")}
              type="submit"
              disabled={!name.trim()}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </Tooltip>
        </form>

        <div className="mt-5 border-t border-border pt-3">
          <button
            type="button"
            className={`${row(activityId === null)} w-full py-2`}
            onClick={() => selectActivity(null)}
            aria-current={activityId === null}
          >
            <Inbox className="size-4 text-muted" aria-hidden />
            <span className="flex-1 text-left">{t("activities.inbox")}</span>
            <span className="text-xs text-muted">{inboxCount}</span>
          </button>
        </div>
      </div>
      {editing && (
        <ActivityDialog project={project} activity={editing} onClose={() => setEditing(null)} />
      )}
    </aside>
  );
}
