import { describe, expect, it } from "vitest";
import { newProject } from "../src/core/project";
import { applyTemplate, TEMPLATES } from "../src/core/templates";

const fresh = () => newProject("p1", "2026-04-01T00:00:00Z", { title: "Meu relatório" });

describe("applyTemplate", () => {
  it("leaves a blank project alone", () => {
    expect(applyTemplate(fresh(), "blank", ["x"])).toEqual(fresh());
  });

  it("adds the starter activities in order, with stable ids", () => {
    const project = applyTemplate(fresh(), "internship", ["Um", "Dois", "Três", "Quatro", "Cinco"]);
    expect(project.activities.map((a) => a.title)).toEqual(["Um", "Dois", "Três", "Quatro"]);
    expect(project.activities.map((a) => a.id)).toEqual(["p1-a1", "p1-a2", "p1-a3", "p1-a4"]);
    expect(project.activities.map((a) => a.order)).toEqual([0, 1, 2, 3]);
  });

  it("brings the settings that make sense for that kind of report", () => {
    const internship = applyTemplate(fresh(), "internship", []);
    expect(internship).toMatchObject({ template: "abnt", summaryTable: true, figureList: true });
    expect(internship.signature?.enabled).toBe(true);
    expect(applyTemplate(fresh(), "portfolio", []).imagesPerPage).toBe(2);
  });

  it("keeps what the person already typed", () => {
    expect(applyTemplate(fresh(), "accountability", []).title).toBe("Meu relatório");
  });

  it("has one entry per id and no duplicates", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});
