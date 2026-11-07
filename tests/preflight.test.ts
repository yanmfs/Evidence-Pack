import { describe, expect, it } from "vitest";
import { preflight } from "../src/core/preflight";
import { addActivity, addItems, newProject } from "../src/core/project";
import type { Evidence } from "../src/core/types";

const item = (id: string, activityId: string | null, extra: Partial<Evidence> = {}): Evidence => ({
  id,
  activityId,
  kind: "image",
  storedName: `${id}.png`,
  originalName: `${id}.png`,
  sha256: id,
  caption: "Legenda",
  source: "Fonte",
  date: "2026-03-10",
  dateSource: "exif",
  order: 0,
  ...extra,
});

const base = () =>
  addActivity(
    newProject("p", "2026-04-01T00:00:00Z", { title: "Relatório", author: "Ana" }),
    "a1",
    "A",
  );

const ids = (project: ReturnType<typeof base>) => preflight(project).map((i) => i.id);

describe("preflight", () => {
  it("has nothing to say about a complete project", () => {
    expect(preflight(addItems(base(), [item("i1", "a1")]))).toEqual([]);
  });

  it("blocks an export with nothing in it", () => {
    const found = preflight(base());
    expect(found[0]).toMatchObject({ id: "no-items", severity: "blocker" });
  });

  it("asks for a title and an author", () => {
    const project = addItems(addActivity(newProject("p", "2026-04-01T00:00:00Z"), "a1", "A"), [
      item("i1", "a1"),
    ]);
    expect(ids(project)).toEqual(["no-title", "no-author"]);
  });

  it("counts captions and dates that are missing", () => {
    const project = addItems(base(), [
      item("i1", "a1", { caption: "  " }),
      item("i2", "a1", { caption: "" }),
      item("i3", "a1", { date: null, dateSource: null }),
    ]);
    const found = Object.fromEntries(preflight(project).map((i) => [i.id, i.count]));
    expect(found["no-caption"]).toBe(2);
    expect(found["no-date"]).toBe(1);
  });

  it("points at what stays out of the report", () => {
    const project = addItems(addActivity(base(), "a2", "Vazia"), [
      item("i1", "a1"),
      item("i2", null),
      item("i3", null),
    ]);
    const found = Object.fromEntries(preflight(project).map((i) => [i.id, i.count]));
    expect(found.inbox).toBe(2);
    expect(found["empty-activity"]).toBe(1);
  });

  it("flags dates that only come from the file's modification time as a tip", () => {
    const project = addItems(base(), [item("i1", "a1", { dateSource: "file" })]);
    expect(preflight(project)).toEqual([{ id: "file-date", severity: "tip", count: 1 }]);
  });
});
