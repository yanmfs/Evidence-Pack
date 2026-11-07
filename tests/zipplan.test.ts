import { describe, expect, it } from "vitest";
import { addActivity, addItems, newProject } from "../src/core/project";
import type { Evidence } from "../src/core/types";
import { buildZipPlan, safeName, type CsvLabels } from "../src/core/zipplan";

const labels: CsvLabels = {
  activity: "Atividade",
  number: "Número",
  caption: "Legenda",
  date: "Data",
  dateSource: "Fonte da data",
  originalFile: "Arquivo original",
  sha256: "SHA-256",
  figure: "Figura",
  annex: "Anexo",
  sources: { exif: "EXIF", filename: "Nome do arquivo", file: "Data do arquivo", manual: "Manual" },
};

const item = (id: string, activityId: string | null, extra: Partial<Evidence> = {}): Evidence => ({
  id,
  activityId,
  kind: "image",
  storedName: `${id}.png`,
  originalName: `${id}.PNG`,
  sha256: `sha-${id}`,
  caption: `Legenda ${id}`,
  source: "Fonte: arquivo pessoal",
  date: "2026-03-14T10:22:31",
  dateSource: "exif",
  order: 0,
  ...extra,
});

function sample() {
  let p = newProject("p", "t");
  p = addActivity(p, "a1", "Atendimento: balcão/telefone");
  p = addActivity(p, "a2", "Reuniões");
  return addItems(p, [
    item("i1", "a1"),
    item("i2", "a1", { caption: "mesma", date: null, dateSource: null }),
    item("i3", "a1", { caption: "mesma", date: null, dateSource: null }),
    item("pdf", "a2", {
      kind: "pdf",
      storedName: "pdf.pdf",
      caption: "=SOMA(A1)",
      dateSource: "manual",
      date: "2026-03-15",
    }),
    item("inbox", null),
  ]);
}

describe("safeName", () => {
  it("removes characters that break paths and trims dots", () => {
    expect(safeName('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
    expect(safeName("  ..nome.. ")).toBe("nome");
    expect(safeName("***")).toBe("arquivo");
    expect(safeName("x".repeat(100))).toHaveLength(60);
  });
});

describe("buildZipPlan", () => {
  const { entries, csv } = buildZipPlan(sample(), "pt-BR", labels);

  it("puts originals in numbered folders, in report order, without the inbox", () => {
    expect(entries.map((e) => e.path)).toEqual([
      "01 - Atendimento balcão telefone/001 - 2026-03-14 - Legenda i1.png",
      "01 - Atendimento balcão telefone/002 - mesma.png",
      "01 - Atendimento balcão telefone/003 - mesma.png",
      "02 - Reuniões/004 - 2026-03-15 - =SOMA(A1).pdf",
    ]);
    expect(entries.map((e) => e.storedName)).toEqual(["i1.png", "i2.png", "i3.png", "pdf.pdf"]);
  });

  it("writes a UTF-8 BOM, semicolons and CRLF", () => {
    expect(
      csv.startsWith("\u{FEFF}Atividade;Número;Legenda;Data;Fonte da data;Arquivo original;SHA-256\r\n"),
    ).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(6);
  });

  it("fills the columns and numbers figures and annexes separately", () => {
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe(
      "Atendimento: balcão/telefone;Figura 1;Legenda i1;14/03/2026 10:22;EXIF;i1.PNG;sha-i1",
    );
    expect(lines[4]).toContain("Anexo 1");
  });

  it("neutralises cells that a spreadsheet would run as formulas", () => {
    expect(csv).toContain("'=SOMA(A1)");
  });

  it("keeps duplicate names apart", () => {
    const names = entries.map((e) => e.path.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
