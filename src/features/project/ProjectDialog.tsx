import { useState } from "react";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { Select } from "../../components/Select";
import { Toggle } from "../../components/Toggle";
import { Button } from "../../components/Button";
import type { Project, Template } from "../../core/types";
import { useApp, useT } from "../../store";
import { useCurrent, useWork } from "../work/store";

function Form({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT();
  const mutate = useWork((s) => s.mutate);
  const [draft, setDraft] = useState(project);
  const set = <K extends keyof Project>(key: K, value: Project[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const save = () => {
    mutate(() => draft);
    onClose();
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label={t("form.reportTitle")} value={draft.title} onChange={(v) => set("title", v)} />
      <Field
        label={t("form.subtitle")}
        value={draft.subtitle ?? ""}
        onChange={(v) => set("subtitle", v || undefined)}
      />
      <Field label={t("form.author")} value={draft.author} onChange={(v) => set("author", v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("form.institution")}
          value={draft.institution ?? ""}
          onChange={(v) => set("institution", v || undefined)}
        />
        <Field
          label={t("form.course")}
          value={draft.course ?? ""}
          onChange={(v) => set("course", v || undefined)}
        />
        <Field
          label={t("form.supervisor")}
          value={draft.supervisor ?? ""}
          onChange={(v) => set("supervisor", v || undefined)}
        />
        <Field
          label={t("form.location")}
          value={draft.location ?? ""}
          onChange={(v) => set("location", v || undefined)}
        />
        <Field
          type="date"
          label={t("form.periodStart")}
          value={draft.period.start ?? ""}
          onChange={(v) => set("period", { ...draft.period, start: v || undefined })}
        />
        <Field
          type="date"
          label={t("form.periodEnd")}
          value={draft.period.end ?? ""}
          onChange={(v) => set("period", { ...draft.period, end: v || undefined })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t("form.template")}
          value={draft.template}
          onChange={(v) => set("template", v as Template)}
        >
          <option value="simple">{t("form.template.simple")}</option>
          <option value="abnt">{t("form.template.abnt")}</option>
        </Select>
        <Select
          label={t("form.imagesPerPage")}
          value={String(draft.imagesPerPage)}
          onChange={(v) => set("imagesPerPage", v === "2" ? 2 : 1)}
        >
          <option value="1">1</option>
          <option value="2">2</option>
        </Select>
        <Select
          label={t("form.quality")}
          value={draft.quality}
          onChange={(v) => set("quality", v === "high" ? "high" : "mid")}
        >
          <option value="mid">{t("form.quality.mid")}</option>
          <option value="high">{t("form.quality.high")}</option>
        </Select>
      </div>
      {draft.template === "abnt" && <p className="text-xs text-muted">{t("form.abntNote")}</p>}
      <Toggle
        label={t("form.figureList")}
        checked={Boolean(draft.figureList)}
        onChange={(v) => set("figureList", v)}
      />
      <Toggle
        label={t("form.signature")}
        checked={Boolean(draft.signature?.enabled)}
        onChange={(v) => set("signature", { enabled: v, text: draft.signature?.text ?? "" })}
      />
      {draft.signature?.enabled && (
        <Field
          multiline
          label={t("form.signatureText")}
          value={draft.signature.text}
          onChange={(v) => set("signature", { enabled: true, text: v })}
        />
      )}
      <p className="text-xs text-muted">{t("form.privacyNote")}</p>
      <div className="mt-1 flex justify-end">
        <Button variant="primary" onClick={save}>
          {t("projects.save")}
        </Button>
      </div>
    </div>
  );
}

export function ProjectDialog() {
  const t = useT();
  const open = useApp((s) => s.projectOpen);
  const setDialog = useApp((s) => s.setDialog);
  const project = useCurrent();
  return (
    <Dialog
      open={open && !!project}
      onOpenChange={(o) => setDialog("projectOpen", o)}
      title={t("form.title")}
    >
      {project && (
        <Form key={project.id} project={project} onClose={() => setDialog("projectOpen", false)} />
      )}
    </Dialog>
  );
}
