import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { strToU8, zipSync } from "fflate";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildReport, type BuildOptions } from "../src/core/pdf/build";
import { wrapText } from "../src/core/pdf/wrap";
import { makeImage, sampleProject } from "./helpers/fixtures";

const options: BuildOptions = {
  locale: "pt-BR",
  labels: {
    summary: "Sumário",
    figure: "Figura",
    annex: "Anexo",
    page: "pág.",
    author: "Autor",
    supervisor: "Orientador",
    period: "Período",
    figureList: "Lista de figuras",
    signatureTitle: "Declaração",
    signatureText: "Declaro que as informações são verdadeiras.",
    placeDate: "Local e data",
    signature: "Assinatura",
    summaryTable: "Quadro-resumo",
    colActivity: "Atividade",
    colPeriod: "Período",
    colHours: "Horas",
    colEvidence: "Evidências",
    total: "Total",
  },
};

async function readPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages;
}

describe("wrapText", () => {
  const measure = (s: string) => s.length * 10;

  it("breaks at spaces without exceeding the width", () => {
    expect(wrapText("aaa bbb ccc ddd", measure, 80)).toEqual(["aaa bbb", "ccc ddd"]);
  });

  it("splits a word wider than the line", () => {
    const lines = wrapText("abcdefghijklmnopqrstuvwxyz", measure, 100);
    expect(lines.every((l) => measure(l) <= 100)).toBe(true);
    expect(lines.join("")).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("keeps explicit line breaks and handles empty text", () => {
    expect(wrapText("um\ndois", measure, 500)).toEqual(["um", "dois"]);
    expect(wrapText("", measure, 500)).toEqual([""]);
  });
});

describe("buildReport", () => {
  it("builds a report with cover, summary, figures, accents and the annex", async () => {
    const { project, assets } = await sampleProject(1);
    const progress: number[] = [];
    const bytes = await buildReport(project, assets, {
      ...options,
      onProgress: (d) => progress.push(d),
    });
    const pages = await readPages(bytes);

    // cover + summary + 5 + 4 + 3 figure pages + 3 annex pages
    expect(pages).toHaveLength(2 + 5 + 4 + 3 + 3);
    expect(pages[0]).toContain("Relatório de Estágio Supervisionado");
    expect(pages[0]).toContain("Maria Fictícia da Silva");
    expect(pages[1]).toContain("Sumário");
    expect(pages.join(" ")).toContain("Figura 1");
    expect(pages.join(" ")).toContain("Figura 12");
    expect(pages.join(" ")).toContain("ação, coração, pé, à, ü, ç");
    expect(pages.join(" ")).toContain("Anexo 1 – Comprovante de pagamento · pág. 3/3");
    expect(progress.at(-1)).toBe(13);
  });

  it("fills the summary with the pages where the activities really start", async () => {
    const { project, assets } = await sampleProject(2);
    const pages = await readPages(await buildReport(project, assets, options));
    const toc = pages[1] ?? "";
    for (const title of [
      "Atendimento ao usuário",
      "Reuniões de equipe",
      "Documentação e comprovantes",
    ]) {
      const real = pages.findIndex((p, i) => i > 1 && p.includes(title)) + 1;
      expect(real).toBeGreaterThan(2);
      const entry = new RegExp(`${title}[\\s.]*?(\\d+)`).exec(toc);
      expect(Number(entry?.[1])).toBe(real);
    }
  });

  it("uses fewer pages with two images per page", async () => {
    const one = await sampleProject(1);
    const two = await sampleProject(2);
    const pagesOne = await readPages(await buildReport(one.project, one.assets, options));
    const pagesTwo = await readPages(await buildReport(two.project, two.assets, options));
    expect(pagesTwo.length).toBeLessThan(pagesOne.length);
  });

  it("numbers the pages from the second one", async () => {
    const { project, assets } = await sampleProject(1);
    const pages = await readPages(await buildReport(project, assets, options));
    expect(pages[2]?.trim().endsWith("3")).toBe(true);
    expect(pages[0]?.trim().endsWith("1")).toBe(false);
  });

  it("sets the PDF metadata", async () => {
    const { project, assets } = await sampleProject(1);
    const bytes = await buildReport(project, assets, options);
    const pdf = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
    const meta = (await pdf.getMetadata()).info as Record<string, string>;
    expect(meta.Title).toBe("Relatório de Estágio Supervisionado");
    expect(meta.Author).toBe("Maria Fictícia da Silva");
    expect(meta.Producer).toBe("EvidencePack");
  });

  it("fails clearly when a prepared image is missing", async () => {
    const { project, assets } = await sampleProject(1);
    assets.images.delete("e1");
    await expect(buildReport(project, assets, options)).rejects.toThrow(
      "Missing prepared image for e1",
    );
  });
});

describe("optional pages", () => {
  const sentence = "Declaro que li e conferi cada evidência.";

  it("adds a list of figures with the real page of each figure", async () => {
    const { project, assets } = await sampleProject(1, { figureList: true });
    const pages = await readPages(await buildReport(project, assets, options));
    // cover + summary + list + 12 figure pages + 3 annex pages
    expect(pages).toHaveLength(3 + 12 + 3);
    expect(pages[2]).toContain("Lista de figuras");
    const entry = /Figura 5 – Legenda 5: ação, coração, pé, à, ü, ç[\s.]*?(\d+)/.exec(pages[2]!);
    const real = pages.findIndex((p, i) => i > 2 && p.includes("Figura 5 –")) + 1;
    expect(Number(entry?.[1])).toBe(real);
  });

  it("adds a declaration page with the editable text and signature lines", async () => {
    const { project, assets } = await sampleProject(1, {
      signature: { enabled: true, text: sentence },
    });
    const pages = await readPages(await buildReport(project, assets, options));
    const last = pages.at(-1) ?? "";
    expect(pages).toHaveLength(2 + 12 + 3 + 1);
    expect(last).toContain("Declaração");
    expect(last).toContain(sentence);
    expect(last).toContain("Local e data");
    expect(last).toContain("Maria Fictícia da Silva");
  });

  it("falls back to the default declaration text", async () => {
    const { project, assets } = await sampleProject(1, {
      signature: { enabled: true, text: "  " },
    });
    const pages = await readPages(await buildReport(project, assets, options));
    expect(pages.at(-1)).toContain("Declaro que as informações são verdadeiras.");
  });
});

describe("ABNT template", () => {
  it("counts pages from the sheet after the cover and prints them at the top right", async () => {
    const { project, assets } = await sampleProject(1, {
      template: "abnt",
      figureList: true,
      signature: { enabled: true, text: "" },
    });
    const pages = await readPages(await buildReport(project, assets, options));
    // cover + summary + list + 12 figure pages + 3 annex pages + declaration
    expect(pages).toHaveLength(3 + 12 + 3 + 1);
    expect(pages[0]).toContain("UNIVERSIDADE EXEMPLO");
    expect(pages[1]).toContain("SUMÁRIO");
    expect(pages[2]).toContain("LISTA DE FIGURAS");

    // The first section is the 4th sheet, which is page 3 because the cover is not counted.
    expect(pages[3]?.trim().endsWith("3")).toBe(true);
    expect(pages[4]?.trim().endsWith("4")).toBe(true);
    expect(pages[0]?.trim().endsWith("1")).toBe(false);

    const entry = /Atendimento ao usuário[\s.]*?(\d+)/i.exec(pages[1]!);
    expect(Number(entry?.[1])).toBe(3);
  });

  it("uses margins of 3 cm on the left and 2 cm on the right", async () => {
    const { project, assets } = await sampleProject(1, { template: "abnt" });
    const bytes = await buildReport(project, assets, options);
    const pdf = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
    const content = await (await pdf.getPage(3)).getTextContent();
    const lefts = content.items.flatMap((it) =>
      "transform" in it ? [it.transform[4] as number] : [],
    );
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(3 * 28.3465 - 0.5);
  });
});

describe("cover logo", () => {
  const imagesOnCover = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes);
    const xobjects = doc.getPage(0).node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    return xobjects?.keys().length ?? 0;
  };

  it("prints the logo on the cover and keeps the figure count and progress intact", async () => {
    const { project, assets } = await sampleProject(1);
    const without = await buildReport(project, assets, options);
    const progress: number[] = [];
    const withLogo = await buildReport(
      project,
      { ...assets, logo: makeImage("png", 300, 120, 90) },
      { ...options, onProgress: (d) => progress.push(d) },
    );
    expect(await imagesOnCover(without)).toBe(0);
    expect(await imagesOnCover(withLogo)).toBe(1);
    expect((await readPages(withLogo)).length).toBe((await readPages(without)).length);
    expect(progress.at(-1)).toBe(13);
  });

  it("also works on the ABNT cover", async () => {
    const { project, assets } = await sampleProject(1, { template: "abnt" });
    const bytes = await buildReport(
      project,
      { ...assets, logo: makeImage("jpg", 200, 200, 30) },
      options,
    );
    expect(await imagesOnCover(bytes)).toBe(1);
  });
});

describe("summary table", () => {
  it("lists each activity with period, hours and evidence count, and a total", async () => {
    const { project, assets } = await sampleProject(1, { summaryTable: true });
    project.activities = project.activities.map((a, i) => ({
      ...a,
      start: "2026-03-01",
      end: "2026-03-31",
      hours: [20, 12.5, 8][i],
    }));
    const pages = await readPages(await buildReport(project, assets, options));
    // cover + contents + summary + 12 figure pages + 3 annex pages
    expect(pages).toHaveLength(3 + 12 + 3);
    const table = pages[2] ?? "";
    expect(table).toContain("Quadro-resumo");
    for (const title of [
      "Atendimento ao usuário",
      "Reuniões de equipe",
      "Documentação e comprovantes",
    ]) {
      expect(table).toContain(title);
    }
    expect(table).toContain("12,5 h");
    expect(table).toContain("40,5 h");
    expect(table).toMatch(/Total.*13/);
  });

  it("moves the section numbers in the contents past the table", async () => {
    const { project, assets } = await sampleProject(1, { summaryTable: true });
    const pages = await readPages(await buildReport(project, assets, options));
    const entry = /Atendimento ao usuário[\s.]*?(\d+)/.exec(pages[1] ?? "");
    expect(Number(entry?.[1])).toBe(
      pages.findIndex((p, i) => i > 2 && p.includes("Atendimento")) + 1,
    );
  });

  it("is left out when asked not to or when there is nothing to list", async () => {
    const { project, assets } = await sampleProject(1);
    expect((await readPages(await buildReport(project, assets, options))).join(" ")).not.toContain(
      "Quadro-resumo",
    );
  });
});

describe("image rotation", () => {
  it("keeps the page count and fits a turned picture on the page", async () => {
    const { project, assets } = await sampleProject(1);
    const turned = {
      ...project,
      items: project.items.map((i) => (i.kind === "image" ? { ...i, rotation: 90 as const } : i)),
    };
    const base = await readPages(await buildReport(project, assets, options));
    const pages = await readPages(await buildReport(turned, assets, options));
    expect(pages).toHaveLength(base.length);
  });
});

describe("text, spreadsheet and Word files", () => {
  const docx = (body: string) =>
    zipSync({
      "word/document.xml": strToU8(`<w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`),
    });
  const para = (text: string, style?: string) =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;
  const csv = [
    "codigo;nome;presença",
    ...Array.from(
      { length: 70 },
      (_, i) => `PART-${String(i + 1).padStart(3, "0")};Participante ${i + 1};SIM`,
    ),
  ].join("\r\n");
  const notes = Array.from(
    { length: 12 },
    (_, i) => `09:${String(i).padStart(2, "0")} — Passo ${i + 1} da oficina`,
  ).join("\n");
  const word = docx(
    para("Plano de teste", "Title") +
      para("1. Identificação", "Heading1") +
      para("Atividade fictícia com acentuação: ação, coração, pé.") +
      "<w:tbl><w:tr><w:tc>" +
      para("Horário") +
      "</w:tc><w:tc>" +
      para("Etapa") +
      "</w:tc></w:tr><w:tr><w:tc>" +
      para("09:00") +
      "</w:tc><w:tc>" +
      para("Abertura") +
      "</w:tc></w:tr></w:tbl>",
  );

  async function withDocuments() {
    const { project, assets } = await sampleProject(1);
    const doc = (id: string, name: string, caption: string) => ({
      ...project.items[0]!,
      id,
      kind: "doc" as const,
      storedName: name,
      originalName: name,
      sha256: `sha-${id}`,
      caption,
      activityId: "a3",
      order: 99,
    });
    const items = [
      ...project.items,
      doc("d1", "lista.csv", "Lista de presença"),
      doc("d2", "plano.docx", "Plano"),
      doc("d3", "notas.txt", "Notas"),
    ];
    const documents = new Map([
      ["d1", strToU8(csv)],
      ["d2", word],
      ["d3", strToU8(notes)],
    ]);
    return { project: { ...project, items }, assets: { ...assets, documents } };
  }

  it("lays each file out as annex pages that name the file and keep every row", async () => {
    const { project, assets } = await withDocuments();
    const base = await sampleProject(1);
    const progress: number[] = [];
    const pages = await readPages(
      await buildReport(project, assets, { ...options, onProgress: (d) => progress.push(d) }),
    );
    const text = pages.join(" ");
    expect(
      (await readPages(await buildReport(base.project, base.assets, options))).length,
    ).toBeLessThan(pages.length);
    expect(text).toContain("Lista de presença · pág. 1/");
    expect(text).toContain("PART-001");
    expect(text).toContain("PART-070");
    expect(text).toContain("presença");
    expect(text).toContain("Plano de teste");
    expect(text).toContain("ação, coração, pé");
    expect(text).toContain("Passo 12 da oficina");
    // Every table page starts again with the header row.
    const csvPages = pages.filter((p) => p.includes("Lista de presença"));
    expect(csvPages.length).toBeGreaterThan(1);
    expect(csvPages.every((p) => p.includes("codigo"))).toBe(true);
    expect(progress.at(-1)).toBe(16);
  });

  it("numbers them as annexes after the existing one", async () => {
    const { project, assets } = await withDocuments();
    const text = (await readPages(await buildReport(project, assets, options))).join(" ");
    expect(text).toContain("Anexo 2 – Lista de presença");
    expect(text).toContain("Anexo 3 – Plano");
    expect(text).toContain("Anexo 4 – Notas");
  });

  it("says which file failed when it cannot be read", async () => {
    const { project, assets } = await withDocuments();
    assets.documents.set("d2", strToU8("isto não é um docx"));
    await expect(buildReport(project, assets, options)).rejects.toThrow();
    assets.documents.delete("d1");
    await expect(buildReport(project, assets, options)).rejects.toThrow("Missing document for d1");
  });

  it("starts a document under the section heading instead of on a page of its own", async () => {
    const { project, assets } = await withDocuments();
    const first = project.activities[0]!;
    const moved = {
      ...project,
      items: project.items.map((i) =>
        i.id === "d3" ? { ...i, activityId: first.id, order: -1 } : i,
      ),
    };
    const pages = await readPages(await buildReport(moved, assets, options));
    const page = pages.find(
      (p) => p.includes("Atendimento ao usuário") && p.includes("Passo 1 da oficina"),
    );
    expect(page).toBeDefined();
  });

  it("lists annexes next to the figures, each with the page where it starts", async () => {
    const { project, assets } = await withDocuments();
    const pages = await readPages(
      await buildReport({ ...project, figureList: true }, assets, options),
    );
    const list = pages[2] ?? "";
    expect(list).toContain("Lista de figuras");
    expect(list).toContain("Figura 12");
    expect(list).toContain("Anexo 2 – Lista de presença");
    const entry = /Anexo 2 – Lista de presença[\s.]*?(\d+)/.exec(list);
    const real =
      pages.findIndex((p, i) => i > 2 && p.includes("Anexo 2 – Lista de presença · pág.")) + 1;
    expect(Number(entry?.[1])).toBe(real);
  });

  it("prints the cover note when there is one", async () => {
    const { project, assets } = await sampleProject(1, {
      notice: "Conteúdo fictício, só para teste",
    });
    const pages = await readPages(await buildReport(project, assets, options));
    expect(pages[0]).toContain("Conteúdo fictício, só para teste");
  });
});
