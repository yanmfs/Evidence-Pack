import { resolveDate } from "./dates";
import type { Activity, Evidence, Project } from "./types";

export function newProject(id: string, now: string, init: Partial<Project> = {}): Project {
  return {
    id,
    title: "",
    author: "",
    period: {},
    template: "simple",
    imagesPerPage: 1,
    quality: "mid",
    createdAt: now,
    updatedAt: now,
    activities: [],
    items: [],
    ...init,
  };
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export const sortedActivities = (p: Project): Activity[] => [...p.activities].sort(byOrder);

export const itemsOf = (p: Project, activityId: string | null): Evidence[] =>
  p.items.filter((i) => i.activityId === activityId).sort(byOrder);

function renumber<T extends { order: number }>(list: T[]): T[] {
  return list.map((item, order) => ({ ...item, order }));
}

function renumberItems(items: Evidence[], activityId: string | null): Evidence[] {
  const inGroup = renumber(items.filter((i) => i.activityId === activityId).sort(byOrder));
  const byId = new Map(inGroup.map((i) => [i.id, i]));
  return items.map((i) => byId.get(i.id) ?? i);
}

export function addActivity(p: Project, id: string, title: string): Project {
  const activities = [...p.activities, { id, title, order: p.activities.length }];
  return { ...p, activities };
}

export function updateActivity(
  p: Project,
  id: string,
  patch: Partial<Omit<Activity, "id">>,
): Project {
  return { ...p, activities: p.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

// Evidence of a removed activity goes back to the inbox instead of being lost.
export function removeActivity(p: Project, id: string): Project {
  const ids = itemsOf(p, id).map((i) => i.id);
  const moved = moveItems(p, ids, null);
  return { ...moved, activities: renumber(sortedActivities(moved).filter((a) => a.id !== id)) };
}

export function moveActivity(p: Project, from: number, to: number): Project {
  const list = sortedActivities(p);
  const [item] = list.splice(from, 1);
  if (!item) return p;
  list.splice(to, 0, item);
  return { ...p, activities: renumber(list) };
}

export function addItems(p: Project, items: Evidence[]): Project {
  const next = [...p.items];
  for (const item of items) {
    const order = next.filter((i) => i.activityId === item.activityId).length;
    next.push({ ...item, order });
  }
  return { ...p, items: next };
}

export function updateItem(p: Project, id: string, patch: Partial<Omit<Evidence, "id">>): Project {
  return { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function removeItems(p: Project, ids: string[]): Project {
  const gone = new Set(ids);
  let items = p.items.filter((i) => !gone.has(i.id));
  for (const group of [null, ...p.activities.map((a) => a.id)]) items = renumberItems(items, group);
  return { ...p, items };
}

export function moveItems(p: Project, ids: string[], activityId: string | null): Project {
  const moving = new Set(ids);
  const base = p.items.filter((i) => !moving.has(i.id));
  const target = base.filter((i) => i.activityId === activityId).length;
  const moved = p.items
    .filter((i) => moving.has(i.id))
    .sort(byOrder)
    .map((i, k) => ({ ...i, activityId, order: target + k }));
  let items = [...base, ...moved];
  for (const group of [null, ...p.activities.map((a) => a.id)]) items = renumberItems(items, group);
  return { ...p, items };
}

export function reorderItem(
  p: Project,
  activityId: string | null,
  fromId: string,
  toId: string,
): Project {
  const list = itemsOf(p, activityId);
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return p;
  const [item] = list.splice(from, 1);
  if (!item) return p;
  list.splice(to, 0, item);
  const order = new Map(list.map((i, k) => [i.id, k]));
  return {
    ...p,
    items: p.items.map((i) => (order.has(i.id) ? { ...i, order: order.get(i.id)! } : i)),
  };
}

// Undated items keep their relative order at the end.
export function sortByDate(p: Project, activityId: string | null): Project {
  const list = itemsOf(p, activityId);
  const sorted = [...list].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
  const order = new Map(sorted.map((i, k) => [i.id, k]));
  return {
    ...p,
    items: p.items.map((i) => (order.has(i.id) ? { ...i, order: order.get(i.id)! } : i)),
  };
}

export const isDuplicate = (p: Project, sha256: string) => p.items.some((i) => i.sha256 === sha256);

export interface ImportedInfo {
  storedName: string;
  thumbName?: string | null;
  originalName: string;
  sha256: string;
  kind: "image" | "pdf";
  width?: number | null;
  height?: number | null;
  pages?: number | null;
  exifDate?: string | null;
  modifiedMs?: number | null;
}

const stem = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .trim();

export function evidenceFromImport(
  info: ImportedInfo,
  id: string,
  activityId: string | null,
  defaultSource: string,
): Evidence {
  const { date, dateSource } = resolveDate({
    exif: info.exifDate,
    filename: info.originalName,
    modifiedMs: info.modifiedMs,
  });
  return {
    id,
    activityId,
    kind: info.kind,
    storedName: info.storedName,
    thumbName: info.thumbName ?? undefined,
    originalName: info.originalName,
    sha256: info.sha256,
    caption: stem(info.originalName),
    source: defaultSource,
    date,
    dateSource,
    width: info.width ?? undefined,
    height: info.height ?? undefined,
    pages: info.pages ?? undefined,
    order: 0,
  };
}

export type Numbering = Map<string, { kind: "figure" | "annex"; n: number }>;

// Figures and annexes are numbered separately, in report order.
export function numberEvidence(p: Project): Numbering {
  const out: Numbering = new Map();
  let figure = 0;
  let annex = 0;
  for (const activity of sortedActivities(p)) {
    for (const item of itemsOf(p, activity.id)) {
      if (item.kind === "image") out.set(item.id, { kind: "figure", n: ++figure });
      else out.set(item.id, { kind: "annex", n: ++annex });
    }
  }
  return out;
}

// P1: picks the activity whose period contains the evidence date.
export function suggestActivity(p: Project, date: string | null): string | null {
  if (!date) return null;
  const day = date.slice(0, 10);
  const match = sortedActivities(p).find(
    (a) => a.start && a.end && day >= a.start.slice(0, 10) && day <= a.end.slice(0, 10),
  );
  return match?.id ?? null;
}

// Files dropped into the app go to the selected activity, unless an activity has a period that
// contains the file's date. File modification dates are too weak a hint to move anything.
export function routeByDate(p: Project, items: Evidence[]): { items: Evidence[]; routed: number } {
  let routed = 0;
  const out = items.map((item) => {
    if (item.dateSource !== "exif" && item.dateSource !== "filename") return item;
    const match = suggestActivity(p, item.date);
    if (!match || match === item.activityId) return item;
    routed++;
    return { ...item, activityId: match };
  });
  return { items: out, routed };
}

// A project read from a backup file: shape-checked, given a fresh id, and filled in where older
// or hand-edited files lack fields.
export function parseProject(json: string, id: string, now: string): Project | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<Project>;
  if (!Array.isArray(r.activities) || !Array.isArray(r.items)) return null;
  const base = newProject(id, now);
  return {
    ...base,
    ...r,
    id,
    title: typeof r.title === "string" ? r.title : base.title,
    author: typeof r.author === "string" ? r.author : base.author,
    period: typeof r.period === "object" && r.period !== null ? r.period : base.period,
    template: r.template === "abnt" ? "abnt" : "simple",
    imagesPerPage: r.imagesPerPage === 2 ? 2 : 1,
    quality: r.quality === "high" ? "high" : "mid",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : now,
    updatedAt: now,
    activities: r.activities,
    items: r.items,
  };
}
