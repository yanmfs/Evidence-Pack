import { create } from "zustand";
import { buildReport, type PdfAssets, type PreparedImage } from "../../core/pdf/build";
import { itemsOf, sortedActivities } from "../../core/project";
import { buildZipPlan } from "../../core/zipplan";
import type { Project } from "../../core/types";
import { platform } from "../../platform";
import { selectLang, tNow, useApp } from "../../store";
import { showToast } from "../../toast";
import arimoBold from "../../assets/fonts/arimo-bold.woff?url";
import arimoRegular from "../../assets/fonts/arimo-regular.woff?url";
import interRegular from "../../assets/fonts/inter-regular.woff?url";
import interSemibold from "../../assets/fonts/inter-semibold.woff?url";
import { useWork } from "../work/store";

export type Stage = "idle" | "preparing" | "building";

interface ExportState {
  stage: Stage;
  done: number;
  total: number;
  set: (patch: Partial<Omit<ExportState, "set">>) => void;
}

export const useExport = create<ExportState>((set) => ({
  stage: "idle",
  done: 0,
  total: 0,
  set: (patch) => set(patch),
}));

class Cancelled extends Error {}

const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
const slug = (title: string) =>
  title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "relatorio";

export function exportable(project: Project) {
  return sortedActivities(project).filter((a) => itemsOf(project, a.id).length > 0);
}

export function cancelExport() {
  cancelled = true;
  void platform.cancelPrepare();
}

let cancelled = false;

export async function exportPdf(): Promise<void> {
  const { projects, currentId } = useWork.getState();
  const project = projects.find((p) => p.id === currentId);
  const { set, stage } = useExport.getState();
  if (!project || stage !== "idle") return;
  const activities = exportable(project);
  if (activities.length === 0) return showToast(tNow("export.nothing"), "error");

  cancelled = false;
  const reported = activities.flatMap((a) => itemsOf(project, a.id));
  const images = reported.filter((i) => i.kind === "image");
  try {
    set({ stage: "preparing", done: 0, total: images.length });
    const unique = [...new Set(images.map((i) => i.storedName))];
    const prepared = await platform.prepareImages(
      project.id,
      project.quality,
      unique,
      (done, total) => set({ done, total }),
    );
    if (cancelled) throw new Cancelled();

    const dir = project.quality === "mid" ? "prepared-mid" : "prepared-high";
    const byStored = new Map(prepared.map((p) => [p.storedName, p]));
    const preparedImages = new Map<string, PreparedImage>();
    for (const item of images) {
      const ref = byStored.get(item.storedName);
      if (!ref) throw new Error(`not prepared: ${item.storedName}`);
      preparedImages.set(item.id, {
        bytes: await platform.readFile(project.id, dir, ref.cachedName),
        format: ref.format,
        width: ref.width || item.width || 1,
        height: ref.height || item.height || 1,
      });
    }
    const pdfs = new Map<string, Uint8Array>();
    for (const item of reported.filter((i) => i.kind === "pdf")) {
      pdfs.set(item.id, await platform.readFile(project.id, "files", item.storedName));
    }

    const useArimo = project.template === "abnt";
    const assets: PdfAssets = {
      fonts: {
        regular: await fetchBytes(useArimo ? arimoRegular : interRegular),
        bold: await fetchBytes(useArimo ? arimoBold : interSemibold),
      },
      images: preparedImages,
      pdfs,
    };

    set({ stage: "building", done: 0, total: reported.length });
    const bytes = await buildReport(project, assets, {
      locale: selectLang(useApp.getState()),
      labels: {
        summary: tNow("report.summary"),
        figure: tNow("report.figure"),
        annex: tNow("report.annex"),
        page: tNow("report.page"),
        author: tNow("report.author"),
        supervisor: tNow("report.supervisor"),
        period: tNow("report.period"),
      },
      onProgress: (done, total) => {
        if (cancelled) throw new Cancelled();
        set({ done, total });
      },
    });
    if (cancelled) throw new Cancelled();
    if (await platform.saveFile(bytes, `${slug(project.title)}.pdf`, "pdf"))
      showToast(tNow("export.done"));
  } catch (error) {
    if (!(error instanceof Cancelled)) showToast(tNow("export.failed"), "error");
  } finally {
    set({ stage: "idle", done: 0, total: 0 });
  }
}

export async function exportZip(): Promise<void> {
  const { projects, currentId } = useWork.getState();
  const project = projects.find((p) => p.id === currentId);
  if (!project) return;
  if (exportable(project).length === 0) return showToast(tNow("export.nothing"), "error");
  const { entries, csv } = buildZipPlan(project, selectLang(useApp.getState()), {
    activity: tNow("csv.activity"),
    number: tNow("csv.number"),
    caption: tNow("csv.caption"),
    date: tNow("csv.date"),
    dateSource: tNow("csv.dateSource"),
    originalFile: tNow("csv.originalFile"),
    sha256: "SHA-256",
    figure: tNow("report.figure"),
    annex: tNow("report.annex"),
    sources: {
      exif: tNow("date.exif"),
      filename: tNow("date.filename"),
      file: tNow("date.file"),
      manual: tNow("date.manual"),
    },
  });
  try {
    if (await platform.exportZip(project.id, entries, csv, `${slug(project.title)}.zip`))
      showToast(tNow("export.zipDone"));
  } catch {
    showToast(tNow("export.failed"), "error");
  }
}
