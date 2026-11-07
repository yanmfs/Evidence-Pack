import { create } from "zustand";
import { preflight, type PreflightIssue } from "../../core/preflight";
import { useWork } from "../work/store";
import { exportPdf } from "./exporter";

interface PreflightState {
  issues: PreflightIssue[];
  open: boolean;
  close: () => void;
}

export const usePreflight = create<PreflightState>((set) => ({
  issues: [],
  open: false,
  close: () => set({ open: false }),
}));

// Looks the project over first; a project with nothing to flag goes straight to the export.
export function requestPdfExport(): void {
  const { projects, currentId } = useWork.getState();
  const project = projects.find((p) => p.id === currentId);
  if (!project) return;
  const issues = preflight(project);
  if (issues.length === 0) return void exportPdf();
  usePreflight.setState({ issues, open: true });
}

export function exportAnyway(): void {
  usePreflight.getState().close();
  void exportPdf();
}
