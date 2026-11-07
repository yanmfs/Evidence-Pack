import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { buildReport, type BuildOptions } from "../src/core/pdf/build";
import { wrapText } from "../src/core/pdf/wrap";
import { sampleProject } from "./helpers/fixtures";

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
