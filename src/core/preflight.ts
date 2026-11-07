import { itemsOf, sortedActivities } from "./project";
import type { Project } from "./types";

export type PreflightId =
  | "no-items"
  | "no-title"
  | "no-author"
  | "no-caption"
  | "no-date"
  | "file-date"
  | "inbox"
  | "empty-activity";

export interface PreflightIssue {
  id: PreflightId;
  // A blocker means there is nothing to export; the rest are things worth a look first.
  severity: "blocker" | "warning" | "tip";
  count: number;
}

// What a person would want to know before handing the report in, in the order it matters.
export function preflight(project: Project): PreflightIssue[] {
  const withItems = sortedActivities(project).filter((a) => itemsOf(project, a.id).length > 0);
  const inReport = withItems.flatMap((a) => itemsOf(project, a.id));
  const issues: PreflightIssue[] = [];
  const add = (id: PreflightId, severity: PreflightIssue["severity"], count = 1) => {
    if (count > 0) issues.push({ id, severity, count });
  };

  add("no-items", "blocker", inReport.length === 0 ? 1 : 0);
  add("no-title", "warning", project.title.trim() === "" ? 1 : 0);
  add("no-author", "warning", project.author.trim() === "" ? 1 : 0);
  add("no-caption", "warning", inReport.filter((i) => i.caption.trim() === "").length);
  add("no-date", "warning", inReport.filter((i) => !i.date).length);
  add("inbox", "warning", itemsOf(project, null).length);
  add("file-date", "tip", inReport.filter((i) => i.dateSource === "file").length);
  add("empty-activity", "tip", project.activities.length - withItems.length);
  return issues;
}
