import { FileArchive, FileDown, Info, Settings, SlidersHorizontal } from "lucide-react";
import { platform } from "./platform";
import { useEffect } from "react";
import { Button } from "./components/Button";
import { Logo } from "./components/Logo";
import { Toaster } from "./components/Toaster";
import { Tooltip, TooltipProvider } from "./components/Tooltip";
import { TEMPLATES, type TemplateId } from "./core/templates";
import { ExportDialog } from "./features/export/ExportDialog";
import { exportZip } from "./features/export/exporter";
import { PreflightDialog } from "./features/export/PreflightDialog";
import { requestPdfExport } from "./features/export/preflight";
import { ProjectDialog } from "./features/project/ProjectDialog";
import { ProjectSwitcher } from "./features/project/ProjectSwitcher";
import { AboutDialog } from "./features/settings/AboutDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { useIntake } from "./features/useIntake";
import { Grid } from "./features/work/Grid";
import { Sidebar } from "./features/work/Sidebar";
import { useCurrent, useWork } from "./features/work/store";
import { selectLang, useApp, useT } from "./store";

export default function App() {
  const t = useT();
  const lang = useApp(selectLang);
  const theme = useApp((s) => s.settings.theme);
  const ready = useApp((s) => s.ready);
  const setDialog = useApp((s) => s.setDialog);
  const loaded = useWork((s) => s.loaded);
  const saveState = useWork((s) => s.saveState);
  const project = useCurrent();
  const { dragging } = useIntake();

  useEffect(() => {
    void useApp
      .getState()
      .hydrate()
      .then(() => useWork.getState().load());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    root.lang = lang;
  }, [theme, lang]);

  if (!ready || !loaded) return null;

  const onExport = () => requestPdfExport();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Logo />
              <span className="font-display text-[17px] font-semibold tracking-tight">
                EvidencePack
              </span>
            </div>
            <ProjectSwitcher />
            {project && (
              <span className="text-xs text-muted" role="status">
                {saveState === "saving" ? t("save.saving") : t("save.saved")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button disabled={!project} onClick={() => setDialog("projectOpen", true)}>
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("top.project")}
            </Button>
            {platform.canZip && (
              <Button disabled={!project} onClick={() => void exportZip()}>
                <FileArchive className="size-4" aria-hidden />
                {t("top.exportZip")}
              </Button>
            )}
            <Button variant="primary" disabled={!project} onClick={onExport}>
              <FileDown className="size-4" aria-hidden />
              {t("top.exportPdf")}
            </Button>
            <Tooltip label={t("top.about")}>
              <Button
                variant="ghost"
                icon
                aria-label={t("top.about")}
                onClick={() => setDialog("aboutOpen", true)}
              >
                <Info className="size-4" aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip label={t("top.settings")}>
              <Button
                variant="ghost"
                icon
                aria-label={t("top.settings")}
                onClick={() => setDialog("settingsOpen", true)}
              >
                <Settings className="size-4" aria-hidden />
              </Button>
            </Tooltip>
          </div>
        </header>

        {project ? (
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <Grid />
          </div>
        ) : (
          <Welcome />
        )}

        {dragging && (
          <div
            role="presentation"
            className="anim-fade pointer-events-none fixed inset-3 z-30 flex items-center justify-center rounded-panel border-2 border-dashed border-accent bg-bg/90 text-lg font-medium"
          >
            {t("grid.dropHere")}
          </div>
        )}
      </div>
      <ProjectDialog />
      <ExportDialog />
      <PreflightDialog />
      <SettingsDialog />
      <AboutDialog />
      <Toaster />
    </TooltipProvider>
  );
}

function Welcome() {
  const t = useT();
  const count = useWork((s) => s.projects.length);
  const create = (template: TemplateId) =>
    void useWork.getState().createProject(t("projects.defaultName", { n: count + 1 }), template);
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <Logo className="size-12 shrink-0" />
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {t("welcome.title")}
            </h2>
            <p className="text-sm text-muted">{t("welcome.body")}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => create(template.id)}
              className="rounded-panel border border-border bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <span className="block text-sm font-semibold">{t(`tpl.${template.id}`)}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t(`tpl.${template.id}.hint`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
