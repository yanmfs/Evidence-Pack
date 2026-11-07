import { ExternalLink } from "lucide-react";
import pkg from "../../../package.json";
import { Dialog } from "../../components/Dialog";
import { Logo } from "../../components/Logo";
import { platform } from "../../platform";
import { useApp, useT } from "../../store";

const REPO_URL = "https://github.com/yanmfs/Evidence-Pack";

export function AboutDialog() {
  const t = useT();
  const open = useApp((s) => s.aboutOpen);
  const setDialog = useApp((s) => s.setDialog);

  return (
    <Dialog open={open} onOpenChange={(o) => setDialog("aboutOpen", o)} title={t("about.title")}>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <Logo className="size-16" />
        <div>
          <p className="text-lg font-semibold">EvidencePack</p>
          <p className="text-sm text-muted">{t("tagline")}</p>
        </div>
        <p className="text-sm">{t("about.version", { version: pkg.version })}</p>
        <p className="text-sm text-muted">{t("about.license")}</p>
        <button
          type="button"
          onClick={() => void platform.openUrl(REPO_URL)}
          className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-sm text-accent-text underline-offset-2 hover:underline"
        >
          {t("about.github")}
          <ExternalLink className="size-3.5" aria-hidden />
        </button>
        <p className="text-sm text-muted">{t("about.madeBy", { author: "Yan Suzano" })}</p>
      </div>
    </Dialog>
  );
}
