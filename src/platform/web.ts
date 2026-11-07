import { detectOs, type Os } from "../core/os";
import type { Project } from "../core/types";
import type { ImportOutcome, ImportSource, Platform, PreparedRef, StoredDir } from "./types";

const SETTINGS_KEY = "evidencepack:settings";
const IMAGE = /^image\/(png|jpeg|webp|bmp|gif)$/;

function osFromQuery(): Os | null {
  const value = new URLSearchParams(window.location.search).get("os");
  return value === "windows" || value === "macos" ? value : null;
}

const projects = new Map<string, Project>();
const files = new Map<string, Uint8Array>();
const urls = new Map<string, string>();
const key = (id: string, dir: string, name: string) => `${id}/${dir}/${name}`;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function importFile(projectId: string, file: File): Promise<ImportOutcome> {
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !IMAGE.test(file.type))
    return { status: "failed", originalName: file.name, code: "unsupported" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256(bytes);
  const ext = isPdf ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const storedName = `${hash.slice(0, 16)}.${ext}`;
  const duplicate = files.has(key(projectId, "files", storedName));
  files.set(key(projectId, "files", storedName), bytes);

  let width: number | undefined;
  let height: number | undefined;
  let thumbName: string | undefined;
  if (!isPdf) {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
    thumbName = storedName;
    urls.set(key(projectId, "thumbs", storedName), URL.createObjectURL(file));
  }
  return {
    status: "ok",
    file: {
      storedName,
      thumbName,
      originalName: file.name,
      sha256: hash,
      kind: isPdf ? "pdf" : "image",
      width,
      height,
      pages: isPdf ? 1 : undefined,
      modifiedMs: file.lastModified,
      duplicate,
    },
  };
}

// Used by the browser demo, the screenshots and the UI tests: everything lives in memory.
export const web: Platform = {
  os: osFromQuery() ?? detectOs(navigator.userAgent),
  systemLocale: navigator.language,
  init: () => Promise.resolve(),
  listProjects: () => Promise.resolve([...projects.values()]),
  writeProject: (project) => {
    projects.set(project.id, project);
    return Promise.resolve();
  },
  deleteProject: (id) => {
    projects.delete(id);
    return Promise.resolve();
  },
  pickFiles: () =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "image/*,application/pdf";
      input.onchange = () => resolve([...(input.files ?? [])].map((file) => ({ file })));
      input.oncancel = () => resolve([]);
      input.click();
    }),
  importFiles: (projectId, sources) =>
    Promise.all(
      sources.map((s) =>
        "file" in s
          ? importFile(projectId, s.file)
          : Promise.resolve<ImportOutcome>({
              status: "failed",
              originalName: s.path,
              code: "unreadable",
            }),
      ),
    ),
  thumbUrl: (projectId, thumbName) => urls.get(key(projectId, "thumbs", thumbName)) ?? "",
  prepareImages: (projectId, _quality, storedNames, onProgress) => {
    const out: PreparedRef[] = storedNames.map((storedName) => {
      const format = storedName.endsWith(".png") ? "png" : "jpg";
      return { storedName, cachedName: storedName, format, width: 0, height: 0 };
    });
    out.forEach((_, i) => onProgress(i + 1, out.length));
    void projectId;
    return Promise.resolve(out);
  },
  cancelPrepare: () => Promise.resolve(),
  readFile: (projectId, dir: StoredDir, name) => {
    const source = dir === "files" || dir.startsWith("prepared") ? "files" : dir;
    const bytes = files.get(key(projectId, source, name));
    return bytes ? Promise.resolve(bytes) : Promise.reject(new Error("not found"));
  },
  canBackup: false,
  exportProject: () => Promise.resolve(false),
  importProject: () => Promise.resolve(null),
  canZip: false,
  exportZip: () => Promise.resolve(false),
  saveFile: (bytes, suggestedName) => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return Promise.resolve(true);
  },
  onFileDrop: ({ hover, sources }) => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      hover(true);
    };
    const leave = () => hover(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      hover(false);
      const list: ImportSource[] = [...(e.dataTransfer?.files ?? [])].map((file) => ({ file }));
      if (list.length > 0) sources(list);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return Promise.resolve(() => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    });
  },
  loadSettings: () => {
    try {
      return Promise.resolve(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"));
    } catch {
      return Promise.resolve(null);
    }
  },
  saveSettings: (settings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private mode or full storage: settings just won't survive a reload.
    }
    return Promise.resolve();
  },
  openUrl: (url) => {
    window.open(url, "_blank", "noopener");
    return Promise.resolve();
  },
};
