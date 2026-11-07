import type { Os } from "../core/os";
import type { ImportedInfo } from "../core/project";
import type { ZipEntry } from "../core/zipplan";
import type { Project } from "../core/types";
import type { Settings } from "../settings";

export type Unlisten = () => void;

// A path on disk (desktop) or a File object (browser demo).
export type ImportSource = { path: string } | { file: File };

export type ImportedFile = ImportedInfo & { duplicate: boolean };

export type ImportOutcome =
  { status: "ok"; file: ImportedFile } | { status: "failed"; originalName: string; code: string };

export interface PreparedRef {
  storedName: string;
  cachedName: string;
  format: "png" | "jpg";
  width: number;
  height: number;
}

export type StoredDir = "files" | "thumbs" | "prepared-mid" | "prepared-high";

export interface DropHandlers {
  hover: (over: boolean) => void;
  sources: (sources: ImportSource[]) => void;
}

export interface Platform {
  os: Os;
  systemLocale: string;
  init(): Promise<void>;
  listProjects(): Promise<Project[]>;
  writeProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  pickFiles(): Promise<ImportSource[]>;
  importFiles(projectId: string, sources: ImportSource[]): Promise<ImportOutcome[]>;
  thumbUrl(projectId: string, thumbName: string): string;
  prepareImages(
    projectId: string,
    quality: "mid" | "high",
    storedNames: string[],
    onProgress: (done: number, total: number) => void,
  ): Promise<PreparedRef[]>;
  cancelPrepare(): Promise<void>;
  readFile(projectId: string, dir: StoredDir, name: string): Promise<Uint8Array>;
  canZip: boolean;
  exportZip(
    projectId: string,
    entries: ZipEntry[],
    csv: string,
    suggestedName: string,
  ): Promise<boolean>;
  saveFile(bytes: Uint8Array, suggestedName: string, extension: "pdf" | "zip"): Promise<boolean>;
  onFileDrop(handlers: DropHandlers): Promise<Unlisten>;
  loadSettings(): Promise<unknown>;
  saveSettings(settings: Settings): Promise<void>;
  openUrl(url: string): Promise<void>;
}
