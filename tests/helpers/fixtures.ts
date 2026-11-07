import { readFileSync } from "node:fs";
import { join } from "node:path";
import jpeg from "jpeg-js";
import { PDFDocument } from "pdf-lib";
import { PNG } from "pngjs";
import type { PdfAssets, PreparedImage } from "../../src/core/pdf/build";
import { addActivity, addItems, newProject } from "../../src/core/project";
import type { Evidence, Project } from "../../src/core/types";

const fonts = join(__dirname, "..", "..", "src", "assets", "fonts");

export const loadFonts = (family: "inter" | "arimo") =>
  family === "inter"
    ? {
        regular: readFileSync(join(fonts, "inter-regular.woff")),
        bold: readFileSync(join(fonts, "inter-semibold.woff")),
      }
    : {
        regular: readFileSync(join(fonts, "arimo-regular.woff")),
        bold: readFileSync(join(fonts, "arimo-bold.woff")),
      };

function checkerboard(w: number, h: number, hue: number): Buffer {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dark = (Math.floor(x / 20) + Math.floor(y / 20)) % 2 === 0;
      data.set(dark ? [hue, 120, 200, 255] : [240, 240, 245, 255], (y * w + x) * 4);
    }
  }
  return data;
}

export function makeImage(kind: "png" | "jpg", w: number, h: number, hue: number): PreparedImage {
  const data = checkerboard(w, h, hue);
  if (kind === "png") {
    const png = new PNG({ width: w, height: h });
    png.data = data;
    return { bytes: new Uint8Array(PNG.sync.write(png)), format: "png", width: w, height: h };
  }
  const encoded = jpeg.encode({ data, width: w, height: h }, 80);
  return { bytes: new Uint8Array(encoded.data), format: "jpg", width: w, height: h };
}

export async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([400, 560]).drawText(`Comprovante pagina ${i + 1}`, { x: 40, y: 500, size: 18 });
  }
  return doc.save();
}

const evidence = (
  id: string,
  activityId: string,
  n: number,
  extra: Partial<Evidence> = {},
): Evidence => ({
  id,
  activityId,
  kind: "image",
  storedName: `${id}.png`,
  originalName: `${id}.png`,
  sha256: `sha-${id}`,
  caption: `Legenda ${n}: ação, coração, pé, à, ü, ç`,
  source: "Fonte: arquivo pessoal",
  date: `2026-03-${String(10 + n).padStart(2, "0")}`,
  dateSource: "manual",
  order: 0,
  ...extra,
});

// 3 activities, 12 images and one 3-page PDF annex.
export async function sampleProject(
  imagesPerPage: 1 | 2,
  overrides: Partial<Project> = {},
): Promise<{ project: Project; assets: PdfAssets }> {
  let project = newProject("p", "2026-04-01T00:00:00Z", {
    title: "Relatório de Estágio Supervisionado",
    subtitle: "Ciclo 1",
    author: "Maria Fictícia da Silva",
    institution: "Universidade Exemplo",
    course: "Sistemas de Informação",
    supervisor: "Prof. Fulano de Tal",
    location: "Goiânia – GO",
    period: { start: "2026-03-01", end: "2026-03-31" },
    imagesPerPage,
    ...overrides,
  });
  project = addActivity(project, "a1", "Atendimento ao usuário");
  project = addActivity(project, "a2", "Reuniões de equipe");
  project = addActivity(project, "a3", "Documentação e comprovantes");

  const items: Evidence[] = [];
  const images = new Map<string, PreparedImage>();
  const layout: [string, number][] = [
    ["a1", 5],
    ["a2", 4],
    ["a3", 3],
  ];
  let n = 0;
  for (const [activity, count] of layout) {
    for (let i = 0; i < count; i++) {
      n++;
      const id = `e${n}`;
      items.push(evidence(id, activity, n));
      images.set(
        id,
        makeImage(n % 2 ? "png" : "jpg", 640 + (n % 3) * 160, 360 + (n % 4) * 120, 40 + n * 15),
      );
    }
  }
  items.push(
    evidence("pdf1", "a3", 13, {
      kind: "pdf",
      caption: "Comprovante de pagamento",
      pages: 3,
      storedName: "pdf1.pdf",
    }),
  );
  project = addItems(project, items);
  const pdfs = new Map([["pdf1", await makePdf(3)]]);
  return {
    project,
    assets: { fonts: loadFonts(project.template === "abnt" ? "arimo" : "inter"), images, pdfs },
  };
}
