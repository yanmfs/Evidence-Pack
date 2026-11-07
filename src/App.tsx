import { FileDown, Info, Settings, SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./components/Button";
import { Logo } from "./components/Logo";
import { Toaster } from "./components/Toaster";
import { Tooltip, TooltipProvider } from "./components/Tooltip";
import { itemsOf } from "./core/project";
import { ExportDialog } from "./features/export/ExportDialog";
import { exportable, exportPdf } from "./features/export/exporter";
import { ProjectDialog } from "./features/project/ProjectDialog";
import { ProjectSwitcher } from "./features/project/ProjectSwitcher";
import { AboutDialog } from "./features/settings/AboutDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { useIntake } from "./features/useIntake";
import { Grid } from "./features/work/Grid";
import { Sidebar } from "./features/work/Sidebar";
import { useCurrent, useWork } from "./features/work/store";
import { selectLang, useApp, useT } from "./store";
import { showToast } from "./toast";

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

  const onExport = () => {
    if (!project) return;
    const inbox = itemsOf(project, null).length;
    if (inbox > 0 && exportable(project).length > 0)
      showToast(t("export.inboxWarning", { count: inbox }));
    void exportPdf();
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Logo />
              <span className="font-semibold">EvidencePack</span>
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
      <SettingsDialog />
      <AboutDialog />
      <Toaster />
    </TooltipProvider>
  );
}

function Welcome() {
  const t = useT();
  const count = useWork((s) => s.projects.length);
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <Logo className="size-14" />
        <h2 className="text-xl font-semibold">{t("welcome.title")}</h2>
        <p className="text-sm text-muted">{t("welcome.body")}</p>
        <Button
          variant="primary"
          onClick={() =>
            void useWork.getState().createProject(t("projects.defaultName", { n: count + 1 }))
          }
        >
          {t("welcome.create")}
        </Button>
      </div>
    </div>
  );
}
