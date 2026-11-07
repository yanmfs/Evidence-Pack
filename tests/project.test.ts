import { describe, expect, it } from "vitest";
import {
  dateFromExif,
  dateFromFilename,
  dateFromTimestamp,
  formatDate,
  resolveDate,
} from "../src/core/dates";
import {
  addActivity,
  addItems,
  evidenceFromImport,
  isDuplicate,
  itemsOf,
  moveActivity,
  moveItems,
  newProject,
  numberEvidence,
  removeActivity,
  removeItems,
  reorderItem,
  sortByDate,
  parseProject,
  routeByDate,
  suggestActivity,
  updateActivity,
} from "../src/core/project";
import type { Evidence } from "../src/core/types";

describe("dateFromFilename", () => {
  it.each([
    ["IMG_20260314_102231.jpg", "2026-03-14T10:22:31"],
    ["IMG-20260314-WA0012.jpg", "2026-03-14"],
    ["WhatsApp Image 2026-03-14 at 10.22.31.jpeg", "2026-03-14T10:22:31"],
    ["Screenshot 2026-03-14 at 10.22.31.png", "2026-03-14T10:22:31"],
    ["Captura de Tela 2026-03-14 às 10.22.31.png", "2026-03-14T10:22:31"],
    ["Captura de tela 2026-03-14 102231.png", "2026-03-14T10:22:31"],
    ["Screenshot 2026-03-14 102231.png", "2026-03-14T10:22:31"],
    ["Screenshot_20260314-102231.png", "2026-03-14T10:22:31"],
    ["Screenshot_2026-03-14-10-22-31-123_com.exemplo.jpg", "2026-03-14T10:22:31"],
    ["PXL_20260314_132231123.jpg", "2026-03-14T13:22:31"],
    ["20260314_102231.jpg", "2026-03-14T10:22:31"],
    ["comprovante 2026-03-14.pdf", "2026-03-14"],
    ["recibo 14-03-2026.pdf", "2026-03-14"],
    ["recibo 14.03.2026.pdf", "2026-03-14"],
  ])("reads %s", (name, expected) => {
    expect(dateFromFilename(name)).toBe(expected);
  });

  it("rejects impossible dates and years out of range", () => {
    expect(dateFromFilename("foto 2026-13-01.jpg")).toBeNull();
    expect(dateFromFilename("foto 2026-02-30.jpg")).toBeNull();
    expect(dateFromFilename("foto 32-01-2026.jpg")).toBeNull();
    expect(dateFromFilename("foto 1999-01-01.jpg")).toBeNull();
    expect(dateFromFilename("foto 2101-01-01.jpg")).toBeNull();
    expect(dateFromFilename("IMG_20261340_102231.jpg")).toBeNull();
  });

  it("returns null when there is no date", () => {
    expect(dateFromFilename("foto final.png")).toBeNull();
  });
});

describe("dateFromExif and resolveDate", () => {
  it("parses the EXIF format and ignores blank values", () => {
    expect(dateFromExif("2026:03:14 10:22:31")).toBe("2026-03-14T10:22:31");
    expect(dateFromExif("0000:00:00 00:00:00")).toBeNull();
    expect(dateFromExif("    :  :     :  :  ")).toBeNull();
  });

  it("prefers EXIF, then the file name, then the modified time", () => {
    const modifiedMs = new Date(2026, 0, 5, 8, 30, 0).getTime();
    expect(
      resolveDate({ exif: "2026:03:14 10:22:31", filename: "IMG_20250101_000000.jpg", modifiedMs }),
    ).toEqual({
      date: "2026-03-14T10:22:31",
      dateSource: "exif",
    });
    expect(resolveDate({ filename: "recibo 14-03-2026.pdf", modifiedMs })).toEqual({
      date: "2026-03-14",
      dateSource: "filename",
    });
    expect(resolveDate({ filename: "foto.png", modifiedMs })).toEqual({
      date: dateFromTimestamp(modifiedMs),
      dateSource: "file",
    });
    expect(dateFromTimestamp(modifiedMs)).toBe("2026-01-05T08:30:00");
    expect(resolveDate({ filename: "foto.png" })).toEqual({ date: null, dateSource: null });
  });
});

describe("formatDate", () => {
  it("formats by locale without shifting the day", () => {
    expect(formatDate("2026-03-14T23:59:00", "pt-BR")).toBe("14/03/2026");
    expect(formatDate("2026-03-14", "en-US")).toBe("3/14/2026");
  });
});

const ev = (id: string, activityId: string | null, date: string | null = null): Evidence => ({
  id,
  activityId,
  kind: "image",
  storedName: `${id}.png`,
  originalName: `${id}.png`,
  sha256: `sha-${id}`,
  caption: id,
  source: "Fonte: arquivo pessoal",
  date,
  dateSource: date ? "manual" : null,
  order: 0,
});

function sample() {
  let p = newProject("p1", "2026-01-01T00:00:00Z", { title: "Relatório" });
  p = addActivity(p, "a1", "Atendimento");
  p = addActivity(p, "a2", "Reuniões");
  return addItems(p, [ev("i1", "a1"), ev("i2", "a1"), ev("i3", "a2"), ev("i4", null)]);
}

describe("project operations", () => {
  it("numbers items per container as they are added", () => {
    const p = sample();
    expect(itemsOf(p, "a1").map((i) => [i.id, i.order])).toEqual([
      ["i1", 0],
      ["i2", 1],
    ]);
  });

  it("moves items between activities and the inbox, keeping orders dense", () => {
    const p = moveItems(sample(), ["i1"], "a2");
    expect(itemsOf(p, "a2").map((i) => i.id)).toEqual(["i3", "i1"]);
    expect(itemsOf(p, "a1").map((i) => [i.id, i.order])).toEqual([["i2", 0]]);
    expect(itemsOf(moveItems(p, ["i3"], null), null).map((i) => i.id)).toEqual(["i4", "i3"]);
  });

  it("reorders items inside an activity", () => {
    const p = reorderItem(sample(), "a1", "i2", "i1");
    expect(itemsOf(p, "a1").map((i) => i.id)).toEqual(["i2", "i1"]);
  });

  it("sorts by date with undated items last", () => {
    let p = newProject("p", "t");
    p = addActivity(p, "a", "A");
    p = addItems(p, [
      ev("x", "a", null),
      ev("y", "a", "2026-03-02"),
      ev("z", "a", "2026-03-01T10:00:00"),
    ]);
    expect(itemsOf(sortByDate(p, "a"), "a").map((i) => i.id)).toEqual(["z", "y", "x"]);
  });

  it("returns evidence of a removed activity to the inbox", () => {
    const p = removeActivity(sample(), "a1");
    expect(p.activities.map((a) => [a.id, a.order])).toEqual([["a2", 0]]);
    expect(itemsOf(p, null).map((i) => i.id)).toEqual(["i4", "i1", "i2"]);
  });

  it("removes items and reorders activities", () => {
    expect(removeItems(sample(), ["i1"]).items.map((i) => i.id)).not.toContain("i1");
    const p = moveActivity(sample(), 0, 1);
    expect(p.activities.sort((a, b) => a.order - b.order).map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("detects duplicates by hash", () => {
    expect(isDuplicate(sample(), "sha-i1")).toBe(true);
    expect(isDuplicate(sample(), "sha-nope")).toBe(false);
  });

  it("numbers figures and annexes separately in report order", () => {
    let p = sample();
    p = addItems(p, [{ ...ev("pdf1", "a1"), kind: "pdf" }]);
    const numbers = numberEvidence(p);
    expect(numbers.get("i1")).toEqual({ kind: "figure", n: 1 });
    expect(numbers.get("i2")).toEqual({ kind: "figure", n: 2 });
    expect(numbers.get("pdf1")).toEqual({ kind: "annex", n: 1 });
    expect(numbers.get("i3")).toEqual({ kind: "figure", n: 3 });
    expect(numbers.has("i4")).toBe(false);
  });

  it("suggests the activity whose period holds the date", () => {
    let p = sample();
    p = updateActivity(p, "a1", { start: "2026-03-01", end: "2026-03-15" });
    p = updateActivity(p, "a2", { start: "2026-03-16", end: "2026-03-31" });
    expect(suggestActivity(p, "2026-03-14T10:00:00")).toBe("a1");
    expect(suggestActivity(p, "2026-03-20")).toBe("a2");
    expect(suggestActivity(p, "2026-04-01")).toBeNull();
    expect(suggestActivity(p, null)).toBeNull();
  });

  it("routes dropped files by date, ignoring weak file dates", () => {
    let p = sample();
    p = updateActivity(p, "a2", { start: "2026-03-16", end: "2026-03-31" });
    const dropped = [
      { ...ev("n1", "a1"), date: "2026-03-20", dateSource: "exif" as const },
      { ...ev("n2", "a1"), date: "2026-03-20", dateSource: "filename" as const },
      { ...ev("n3", "a1"), date: "2026-03-20", dateSource: "file" as const },
      { ...ev("n4", "a1"), date: "2026-02-01", dateSource: "exif" as const },
    ];
    const { items, routed } = routeByDate(p, dropped);
    expect(items.map((i) => i.activityId)).toEqual(["a2", "a2", "a1", "a1"]);
    expect(routed).toBe(2);
  });
});

describe("evidenceFromImport", () => {
  it("uses the file name as caption and resolves the date", () => {
    const e = evidenceFromImport(
      {
        storedName: "abc.png",
        originalName: "Screenshot 2026-03-14 at 10.22.31.png",
        sha256: "s",
        kind: "image",
        width: 10,
        height: 5,
      },
      "id1",
      "a1",
      "Fonte: arquivo pessoal",
    );
    expect(e.caption).toBe("Screenshot 2026-03-14 at 10.22.31");
    expect(e.date).toBe("2026-03-14T10:22:31");
    expect(e.dateSource).toBe("filename");
    expect(e.source).toBe("Fonte: arquivo pessoal");
  });
});

describe("parseProject", () => {
  const now = "2026-05-01T00:00:00Z";

  it("gives an imported project a new id and fills what is missing", () => {
    const json = JSON.stringify({
      id: "old",
      title: "Relatório",
      activities: [{ id: "a1", title: "A", order: 0 }],
      items: [],
      template: "abnt",
    });
    const p = parseProject(json, "new", now);
    expect(p).toMatchObject({ id: "new", title: "Relatório", template: "abnt", quality: "mid" });
    expect(p?.updatedAt).toBe(now);
    expect(p?.activities).toHaveLength(1);
  });

  it("falls back to safe values for bad fields", () => {
    const p = parseProject(
      JSON.stringify({ activities: [], items: [], template: "x", imagesPerPage: 7, quality: 3 }),
      "n",
      now,
    );
    expect(p).toMatchObject({ template: "simple", imagesPerPage: 1, quality: "mid" });
  });

  it("rejects files that are not projects", () => {
    expect(parseProject("not json", "n", now)).toBeNull();
    expect(parseProject("[]", "n", now)).toBeNull();
    expect(parseProject(JSON.stringify({ title: "x" }), "n", now)).toBeNull();
  });
});
