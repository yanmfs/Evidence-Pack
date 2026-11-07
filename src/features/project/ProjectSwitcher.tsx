import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { Tooltip } from "../../components/Tooltip";
import { platform } from "../../platform";
import { tNow, useT } from "../../store";
import { showToast } from "../../toast";
import { useCurrent, useWork } from "../work/store";

const backupName = (title: string) =>
  title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "projeto";

type Mode = "new" | "rename" | "delete" | null;

export function ProjectSwitcher() {
  const t = useT();
  const projects = useWork((s) => s.projects);
  const current = useCurrent();
  const { switchProject, createProject, deleteProject, importProject, mutate } = useWork.getState();
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
      {projects.length > 0 && (
        <select
          aria-label={t("projects.select")}
          value={current?.id ?? ""}
          onChange={(e) => switchProject(e.target.value)}
          className="h-8 max-w-56 rounded-control border border-border-strong/70 bg-surface px-2 text-[13px]"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || t("projects.untitled")}
            </option>
          ))}
        </select>
      )}
      <Tooltip label={t("projects.new")}>
        <Button variant="ghost" icon aria-label={t("projects.new")} onClick={() => open("new")}>
          <Plus className="size-4" aria-hidden />
        </Button>
      </Tooltip>
      {platform.canBackup && (
        <Tooltip label={t("projects.import")}>
          <Button
            variant="ghost"
            icon
            aria-label={t("projects.import")}
            onClick={() =>
              void importProject().then(
                (done) => done && showToast(tNow("projects.imported")),
                () => showToast(tNow("projects.importFailed"), "error"),
              )
            }
          >
            <ArchiveRestore className="size-4" aria-hidden />
          </Button>
        </Tooltip>
      )}
      {current && (
        <>
          {platform.canBackup && (
            <Tooltip label={t("projects.backup")}>
              <Button
                variant="ghost"
                icon
                aria-label={t("projects.backup")}
                onClick={() =>
                  void platform
                    .exportProject(current.id, `${backupName(current.title)}.evpack`)
                    .then(
                      (saved) => saved && showToast(tNow("projects.backedUp")),
                      () => showToast(tNow("projects.backupFailed"), "error"),
                    )
                }
              >
                <Archive className="size-4" aria-hidden />
              </Button>
            </Tooltip>
          )}
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
