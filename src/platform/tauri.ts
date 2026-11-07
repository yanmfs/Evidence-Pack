import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appDataDir, join } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { load, type Store } from "@tauri-apps/plugin-store";
import { detectOs } from "../core/os";
import type { Project } from "../core/types";
import type { ImportOutcome, ImportSource, Platform, PreparedRef } from "./types";

const EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
  "pdf",
  "txt",
  "csv",
  "docx",
];

let store: Promise<Store> | undefined;
const settingsStore = () => (store ??= load("settings.json", { autoSave: false, defaults: {} }));

let root = "";
const sep = () => (root.includes("\\") ? "\\" : "/");

const pathOf = (source: ImportSource) => ("path" in source ? source.path : "");

export const tauri: Platform = {
  os: detectOs(navigator.userAgent),
  systemLocale: navigator.language,
  init: async () => {
    root = await join(await appDataDir(), "projects");
  },
  listProjects: async () => {
    const ids = await invoke<string[]>("list_projects");
    const projects = await Promise.all(
      ids.map(async (id) => {
        try {
          return JSON.parse(await invoke<string>("read_project", { id })) as Project;
        } catch {
          return null;
        }
      }),
    );
    return projects.filter((p): p is Project => p !== null);
  },
  writeProject: (project) =>
    invoke("write_project", { id: project.id, json: JSON.stringify(project) }),
  deleteProject: (id) => invoke("delete_project", { id }),
  pickFiles: async () => {
    const picked = await open({
      multiple: true,
      filters: [{ name: "Images and PDF", extensions: EXTENSIONS }],
    });
    return (Array.isArray(picked) ? picked : []).map((path) => ({ path }));
  },
  importFiles: (projectId, sources) =>
    invoke<ImportOutcome[]>("import_files", {
      projectId,
      paths: sources.map(pathOf).filter(Boolean),
    }),
  thumbUrl: (projectId, thumbName) =>
    convertFileSrc([root, projectId, "thumbs", thumbName].join(sep())),
  prepareImages: async (projectId, quality, storedNames, onProgress) => {
    const unlisten = await listen<{ done: number; total: number }>("prepare-progress", (e) =>
      onProgress(e.payload.done, e.payload.total),
    );
    try {
      return await invoke<PreparedRef[]>("prepare_images", {
        projectId,
        qualityName: quality,
        items: storedNames.map((storedName) => ({ storedName })),
      });
    } finally {
      unlisten();
    }
  },
  cancelPrepare: () => invoke("cancel_prepare"),
  readFile: async (id, dir, name) =>
    new Uint8Array(await invoke<ArrayBuffer>("read_project_file", { id, dir, name })),
  canBackup: true,
  exportProject: async (projectId, suggestedName) => {
    const target = await save({
      defaultPath: suggestedName,
      filters: [{ name: "EvidencePack", extensions: ["evpack"] }],
    });
    if (!target) return false;
    await invoke("export_project", { projectId, target });
    return true;
  },
  importProject: async (newId) => {
    const source = await open({
      multiple: false,
      filters: [{ name: "EvidencePack", extensions: ["evpack"] }],
    });
    if (typeof source !== "string") return null;
    return invoke<string>("import_project", { source, newId });
  },
  canZip: true,
  exportZip: async (projectId, entries, csv, suggestedName) => {
    const target = await save({
      defaultPath: suggestedName,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (!target) return false;
    await invoke("export_zip", { projectId, target, entries, csv });
    return true;
  },
  saveFile: async (bytes, suggestedName, extension) => {
    const target = await save({
      defaultPath: suggestedName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (!target) return false;
    await invoke("save_file", bytes, { headers: { "x-target": encodeURIComponent(target) } });
    return true;
  },
  onFileDrop: ({ hover, sources }) =>
    getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;
      hover(type === "enter" || type === "over");
      if (type === "drop") sources(event.payload.paths.map((path) => ({ path })));
    }),
  loadSettings: async () => (await settingsStore()).get("settings"),
  saveSettings: async (settings) => {
    const s = await settingsStore();
    await s.set("settings", settings);
    await s.save();
  },
  openUrl: (url) => openUrl(url),
};
