import type { Evidence } from "../../core/types";
import { evidenceFromImport, isDuplicate, addItems, routeByDate } from "../../core/project";
import type { Key } from "../../i18n";
import { platform, type ImportSource } from "../../platform";
import { tNow } from "../../store";
import { showToast } from "../../toast";
import { useWork } from "./store";

const ERROR_KEYS: Record<string, Key> = {
  unsupported: "import.unsupported",
  pdf_protected: "import.pdf_protected",
  pdf_unreadable: "import.pdf_unreadable",
  heic_unsupported: "import.heic_unsupported",
  heic_failed: "import.heic_failed",
  too_large: "import.too_large",
  unreadable: "import.unreadable",
};

export async function importSources(sources: ImportSource[]): Promise<void> {
  const { projects, currentId, activityId, mutate } = useWork.getState();
  const project = projects.find((p) => p.id === currentId);
  if (!project || sources.length === 0) return;

  let outcomes;
  try {
    outcomes = await platform.importFiles(project.id, sources);
  } catch {
    return showToast(tNow("import.unreadable", { name: "" }), "error");
  }

  const seen = new Set(project.items.map((i) => i.sha256));
  const fresh: Evidence[] = [];
  for (const outcome of outcomes) {
    if (outcome.status === "failed") {
      showToast(
        tNow(ERROR_KEYS[outcome.code] ?? "import.unreadable", { name: outcome.originalName }),
        "error",
      );
      continue;
    }
    const { file } = outcome;
    if (seen.has(file.sha256) || isDuplicate(project, file.sha256)) {
      showToast(tNow("import.duplicate", { name: file.originalName }), "error");
      continue;
    }
    seen.add(file.sha256);
    fresh.push(
      evidenceFromImport(file, crypto.randomUUID(), activityId, tNow("report.defaultSource")),
    );
  }
  if (fresh.length === 0) return;
  const { items, routed } = routeByDate(project, fresh);
  mutate((p) => addItems(p, items));
  showToast(tNow("import.added", { count: fresh.length }));
  if (routed > 0) showToast(tNow("import.routed", { count: routed }));
}

export async function pickAndImport(): Promise<void> {
  const sources = await platform.pickFiles().catch(() => []);
  await importSources(sources);
}
