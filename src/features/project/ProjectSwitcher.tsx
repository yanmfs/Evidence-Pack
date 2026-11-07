import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { Tooltip } from "../../components/Tooltip";
import { useT } from "../../store";
import { useCurrent, useWork } from "../work/store";

type Mode = "new" | "rename" | "delete" | null;

export function ProjectSwitcher() {
  const t = useT();
  const projects = useWork((s) => s.projects);
  const current = useCurrent();
  const { switchProject, createProject, deleteProject, mutate } = useWork.getState();
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");

  const open = (next: Mode) => {
    setName(
      next === "rename"
        ? (current?.title ?? "")
        : next === "new"
          ? t("projects.defaultName", { n: projects.length + 1 })
          : "",
    );
    setMode(next);
  };

  const confirm = async () => {
    if (mode === "new") await createProject(name.trim() || t("projects.untitled"));
    if (mode === "rename") mutate((p) => ({ ...p, title: name.trim() || p.title }));
    if (mode === "delete" && current) await deleteProject(current.id);
    setMode(null);
  };

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={t("projects.select")}
        value={current?.id ?? ""}
        onChange={(e) => switchProject(e.target.value)}
        className="h-9 max-w-56 rounded-control border border-border bg-surface px-2 text-sm"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title || t("projects.untitled")}
          </option>
        ))}
      </select>
      <Tooltip label={t("projects.new")}>
        <Button variant="ghost" icon aria-label={t("projects.new")} onClick={() => open("new")}>
          <Plus className="size-4" aria-hidden />
        </Button>
      </Tooltip>
      {current && (
        <>
          <Tooltip label={t("projects.rename")}>
            <Button
              variant="ghost"
              icon
              aria-label={t("projects.rename")}
              onClick={() => open("rename")}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip label={t("projects.delete")}>
            <Button
              variant="ghost"
              icon
              aria-label={t("projects.delete")}
              onClick={() => open("delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Tooltip>
        </>
      )}

      <Dialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        title={
          mode === "delete"
            ? t("projects.deleteTitle")
            : mode === "rename"
              ? t("projects.rename")
              : t("projects.new")
        }
      >
        {mode === "delete" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              {t("projects.deleteBody", { name: current?.title || t("projects.untitled") })}
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setMode(null)}>{t("projects.cancel")}</Button>
              <Button variant="primary" onClick={() => void confirm()}>
                {t("projects.deleteConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <Field autoFocus label={t("projects.name")} value={name} onChange={setName} />
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setMode(null)}>
                {t("projects.cancel")}
              </Button>
              <Button variant="primary" type="submit">
                {t("projects.save")}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
