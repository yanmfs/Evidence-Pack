import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFEmbeddedPage, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "../dates";
import { itemsOf, numberEvidence, sortedActivities } from "../project";
import type { Evidence, Project } from "../types";
import { wrapText } from "./wrap";

export interface PreparedImage {
  bytes: Uint8Array;
  format: "png" | "jpg";
  width: number;
  height: number;
}

export interface PdfAssets {
  fonts: { regular: Uint8Array; bold: Uint8Array };
  images: Map<string, PreparedImage>;
  pdfs: Map<string, Uint8Array>;
}

export interface ReportLabels {
  summary: string;
  figure: string;
  annex: string;
  page: string;
  author: string;
  supervisor: string;
  period: string;
  figureList: string;
  signatureTitle: string;
  // Used when the project has no declaration text of its own.
  signatureText: string;
  placeDate: string;
  signature: string;
}

export interface BuildOptions {
  locale: string;
  labels: ReportLabels;
  onProgress?: (done: number, total: number) => void;
}

const CM = 28.3465;
const A4 = { w: 595.28, h: 841.89 };
const ACCENT = rgb(0.231, 0.357, 0.859);
const TEXT = rgb(0.09, 0.1, 0.12);
const MUTED = rgb(0.4, 0.43, 0.47);

type Op =
  | {
      t: "text";
      x: number;
      y: number;
      size: number;
      bold?: boolean;
      color?: "accent" | "muted";
      text: string;
    }
  | { t: "rule"; x: number; y: number; w: number }
  | { t: "hline"; x: number; y: number; w: number }
  | { t: "image"; id: string; x: number; y: number; w: number; h: number }
  | { t: "embed"; id: string; pageIndex: number; label: string };

interface PlannedPage {
  ops: Op[];
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Layout {
  margin: { top: number; right: number; bottom: number; left: number };
  footer: number;
}

const SIMPLE: Layout = {
  margin: { top: 2 * CM, right: 2 * CM, bottom: 2 * CM, left: 2 * CM },
  footer: 22,
};

// Inspired by NBR 14724: 3 cm top and left, 2 cm bottom and right; the page number sits in the top margin.
const ABNT: Layout = {
  margin: { top: 3 * CM, right: 2 * CM, bottom: 2 * CM, left: 3 * CM },
  footer: 0,
};

function safeText(text: string, supported: Set<number>): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    if (cp < 32 && cp !== 10) out += " ";
    else out += cp === 10 || supported.has(cp) ? ch : "?";
  }
  return out;
}

export async function buildReport(
  project: Project,
  assets: PdfAssets,
  options: BuildOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(assets.fonts.regular, { subset: true }),
    bold: await doc.embedFont(assets.fonts.bold, { subset: true }),
  };
  const supported = new Set([...fonts.regular.getCharacterSet(), ...fonts.bold.getCharacterSet()]);
  const clean = (s: string) => safeText(s, supported);
  const font = (bold?: boolean) => (bold ? fonts.bold : fonts.regular);
  const width = (text: string, size: number, bold?: boolean) =>
    font(bold).widthOfTextAtSize(text, size);
  const wrap = (text: string, size: number, maxWidth: number, bold?: boolean) =>
    wrapText(clean(text), (s) => width(s, size, bold), maxWidth);

  const abnt = project.template === "abnt";
  const L = abnt ? ABNT : SIMPLE;
  const bodySize = abnt ? 12 : 11;
  const bodyLead = abnt ? 1.5 : 1.45;
  const upper = (text: string) => (abnt ? text.toLocaleUpperCase(options.locale) : text);
  const contentW = A4.w - L.margin.left - L.margin.right;
  const topY = A4.h - L.margin.top;
  const bottomY = L.margin.bottom + L.footer;
  const numbering = numberEvidence(project);
  const activities = sortedActivities(project)
    .map((a) => ({ activity: a, items: itemsOf(project, a.id) }))
    .filter((g) => g.items.length > 0);
  const total = activities.reduce((n, g) => n + g.items.length, 0);

  // ---- cover -------------------------------------------------------------
  const cover: PlannedPage = { ops: [] };
  {
    let y = topY;
    const line = (
      text: string | undefined,
      size: number,
      opts: { bold?: boolean; color?: "accent" | "muted"; gap?: number } = {},
    ) => {
      if (!text) return;
      for (const l of wrap(text, size, contentW, opts.bold)) {
        y -= size * 1.35;
        cover.ops.push({
          t: "text",
          x: abnt ? L.margin.left + (contentW - width(l, size, opts.bold)) / 2 : L.margin.left,
          y,
          size,
          bold: opts.bold,
          color: opts.color,
          text: l,
        });
      }
      y -= opts.gap ?? 0;
    };
    const range = [project.period.start, project.period.end]
      .filter((d): d is string => Boolean(d))
      .map((d) => formatDate(d, options.locale))
      .join(" – ");
    const year = (project.period.end ?? project.createdAt).slice(0, 4);
    if (abnt) {
      line(upper(project.institution ?? ""), 14, { bold: true, gap: 4 });
      line(project.course, 12);
      y = A4.h * 0.7;
      line(project.author, 12, { bold: true });
      y = A4.h * 0.52;
      line(upper(project.title || " "), 16, { bold: true, gap: 8 });
      line(project.subtitle, 14);
      y = A4.h * 0.3;
      line(
        project.supervisor ? `${options.labels.supervisor}: ${project.supervisor}` : undefined,
        12,
        { gap: 4 },
      );
      line(range ? `${options.labels.period}: ${range}` : undefined, 12);
      y = L.margin.bottom + 56;
      line(project.location, 12);
      line(year, 12);
    } else {
      line(project.institution, 13, { bold: true, color: "muted" });
      line(project.course, 11, { color: "muted" });
      y = A4.h * 0.58;
      cover.ops.push({ t: "rule", x: L.margin.left, y: y + 18, w: 56 });
      line(project.title || " ", 30, { bold: true, color: "accent", gap: 10 });
      line(project.subtitle, 15, { color: "muted" });
      y = L.margin.bottom + 120;
      line(project.author ? `${options.labels.author}: ${project.author}` : undefined, 12, {
        bold: true,
        gap: 2,
      });
      line(
        project.supervisor ? `${options.labels.supervisor}: ${project.supervisor}` : undefined,
        11,
        { gap: 2 },
      );
      if (range) line(`${options.labels.period}: ${range}`, 11, { color: "muted", gap: 14 });
      line([project.location, year].filter(Boolean).join(", "), 11, { color: "muted" });
    }
  }

  // ---- content -----------------------------------------------------------
  const pageHeight = topY - bottomY;
  const perPage = project.imagesPerPage;
  const slotH = pageHeight / perPage - (perPage > 1 ? 10 : 0);
  const GAP = 6;
  const captionSize = abnt ? 10 : 10.5;
  const sourceSize = abnt ? 10 : 8.5;
  const figurePage = new Map<string, number>();
  const content: PlannedPage[] = [];
  const firstPageOf: number[] = [];

  let cursor = topY;
  let figuresOnPage = 0;
  const newPage = (): PlannedPage => {
    const page: PlannedPage = { ops: [] };
    content.push(page);
    cursor = topY;
    figuresOnPage = 0;
    return page;
  };

  for (const { activity, items } of activities) {
    const page = newPage();
    firstPageOf.push(content.length - 1);

    const titleSize = abnt ? 14 : 18;
    for (const l of wrap(upper(activity.title), titleSize, contentW, true)) {
      cursor -= titleSize * 1.3;
      page.ops.push({
        t: "text",
        x: L.margin.left,
        y: cursor,
        size: titleSize,
        bold: true,
        color: "accent",
        text: l,
      });
    }
    if (activity.start || activity.end) {
      const range = [activity.start, activity.end]
        .filter((d): d is string => Boolean(d))
        .map((d) => formatDate(d, options.locale))
        .join(" – ");
      cursor -= 14;
      page.ops.push({
        t: "text",
        x: L.margin.left,
        y: cursor,
        size: 10,
        color: "muted",
        text: range,
      });
    }
    if (activity.description) {
      cursor -= 6;
      for (const l of wrap(activity.description, bodySize, contentW)) {
        cursor -= bodySize * bodyLead;
        page.ops.push({ t: "text", x: L.margin.left, y: cursor, size: bodySize, text: l });
      }
    }
    cursor -= 10;
    if (!abnt) page.ops.push({ t: "rule", x: L.margin.left, y: cursor, w: contentW });
    cursor -= 16;

    let needsNewPage = false;
    for (const item of items) {
      const number = numbering.get(item.id);
      if (item.kind === "pdf") {
        const pages = item.pages ?? 1;
        for (let i = 0; i < pages; i++) {
          const label = `${options.labels.annex} ${number?.n ?? ""} – ${item.caption} · ${options.labels.page} ${i + 1}/${pages}`;
          newPage().ops.push({ t: "embed", id: item.id, pageIndex: i, label });
        }
        needsNewPage = true;
        continue;
      }

      const image = assets.images.get(item.id);
      if (!image) throw new Error(`Missing prepared image for ${item.id}`);
      const date = item.date ? ` (${formatDate(item.date, options.locale)})` : "";
      const captionText = `${options.labels.figure} ${number?.n ?? ""}${item.caption ? ` – ${item.caption}` : ""}${date}`;
      const caption = wrap(captionText, captionSize, contentW);
      const source = wrap(item.source, sourceSize, contentW);
      const captionH = caption.length * captionSize * 1.35;
      const sourceH = source.length * sourceSize * 1.35;

      const place = (avail: number) => avail - captionH - sourceH - 2 * GAP;
      let avail = Math.min(cursor - bottomY, slotH);
      if (needsNewPage || figuresOnPage >= perPage || place(avail) < Math.min(120, slotH * 0.35)) {
        newPage();
        needsNewPage = false;
        avail = slotH;
      }
      const scale = Math.min(contentW / image.width, place(avail) / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      const page2 = content[content.length - 1]!;
      figuresOnPage++;
      figurePage.set(item.id, content.length - 1);

      for (const l of caption) {
        cursor -= captionSize * 1.35;
        page2.ops.push({ t: "text", x: L.margin.left, y: cursor + 3, size: captionSize, text: l });
      }
      cursor -= GAP;
      page2.ops.push({
        t: "image",
        id: item.id,
        x: L.margin.left + (contentW - w) / 2,
        y: cursor - h,
        w,
        h,
      });
      cursor -= h + GAP;
      for (const l of source) {
        cursor -= sourceSize * 1.35;
        page2.ops.push({
          t: "text",
          x: L.margin.left,
          y: cursor + 2,
          size: sourceSize,
          color: "muted",
          text: l,
        });
      }
      cursor -= perPage > 1 ? 14 : 8;
    }
  }

  // ---- table of contents and list of figures (need the real page numbers) ----
  const ENTRY_H = abnt ? 26 : 24;
  const listTitleH = 56;
  const perListPage = Math.max(1, Math.floor((pageHeight - listTitleH) / ENTRY_H));
  const figures = activities.flatMap((g) => g.items).filter((i) => i.kind === "image");
  const withFigureList = Boolean(project.figureList) && figures.length > 0;
  const pagesFor = (count: number) => Math.max(1, Math.ceil(count / perListPage));
  const tocPages = pagesFor(activities.length);
  const figurePages = withFigureList ? pagesFor(figures.length) : 0;
  const firstContentIndex = 1 + tocPages + figurePages;
  // ABNT counts from the sheet after the cover; the simple template counts the cover too.
  const numberOf = (index: number) => (abnt ? index : index + 1);

  const buildList = (title: string, entries: { text: string; page: string }[]): PlannedPage[] => {
    const pages: PlannedPage[] = Array.from({ length: pagesFor(entries.length) }, () => ({
      ops: [],
    }));
    pages[0]?.ops.push({
      t: "text",
      x: L.margin.left,
      y: topY - 22,
      size: abnt ? 14 : 22,
      bold: true,
      color: "accent",
      text: upper(title),
    });
    entries.forEach((entry, i) => {
      const page = pages[Math.floor(i / perListPage)];
      const row = i % perListPage;
      const y = topY - (i < perListPage ? listTitleH : 24) - row * ENTRY_H - 14;
      const text = clean(entry.text);
      const numberW = width(entry.page, bodySize);
      let shown = text;
      while (shown.length > 1 && width(shown, bodySize) > contentW - numberW - 40)
        shown = shown.slice(0, -1);
      if (shown !== text) shown = `${shown.trimEnd()}…`;
      const dotsFrom = L.margin.left + width(shown, bodySize) + 6;
      const dotsTo = A4.w - L.margin.right - numberW - 6;
      const dots = ". ".repeat(
        Math.max(0, Math.floor((dotsTo - dotsFrom) / width(". ", bodySize))),
      );
      page?.ops.push({ t: "text", x: L.margin.left, y, size: bodySize, text: shown });
      page?.ops.push({ t: "text", x: dotsFrom, y, size: bodySize, color: "muted", text: dots });
      page?.ops.push({
        t: "text",
        x: A4.w - L.margin.right - numberW,
        y,
        size: bodySize,
        bold: true,
        text: entry.page,
      });
    });
    return pages;
  };

  const toc = buildList(
    options.labels.summary,
    activities.map(({ activity }, i) => ({
      text: activity.title,
      page: String(numberOf(firstContentIndex + (firstPageOf[i] ?? 0))),
    })),
  );
  const figureList = withFigureList
    ? buildList(
        options.labels.figureList,
        figures.map((item) => ({
          text: `${options.labels.figure} ${numbering.get(item.id)?.n ?? ""}${item.caption ? ` – ${item.caption}` : ""}`,
          page: String(numberOf(firstContentIndex + (figurePage.get(item.id) ?? 0))),
        })),
      )
    : [];

  // ---- declaration and signature page ----------------------------------------
  const closing: PlannedPage[] = [];
  if (project.signature?.enabled) {
    const page: PlannedPage = { ops: [] };
    let y = topY;
    const titleSize = abnt ? 14 : 22;
    y -= titleSize * 1.3;
    page.ops.push({
      t: "text",
      x: L.margin.left,
      y,
      size: titleSize,
      bold: true,
      color: "accent",
      text: upper(options.labels.signatureTitle),
    });
    y -= 12;
    const statement = project.signature.text.trim() || options.labels.signatureText;
    for (const l of wrap(statement, bodySize, contentW)) {
      y -= bodySize * bodyLead;
      page.ops.push({ t: "text", x: L.margin.left, y, size: bodySize, text: l });
    }
    const lineW = contentW * 0.6;
    y = A4.h * 0.45;
    if (project.location) {
      page.ops.push({
        t: "text",
        x: L.margin.left,
        y: y + 4,
        size: bodySize,
        text: `${project.location},`,
      });
    }
    page.ops.push({ t: "hline", x: L.margin.left, y, w: lineW });
    page.ops.push({
      t: "text",
      x: L.margin.left,
      y: y - 14,
      size: 9,
      color: "muted",
      text: options.labels.placeDate,
    });
    y -= 90;
    page.ops.push({ t: "hline", x: L.margin.left, y, w: lineW });
    page.ops.push({
      t: "text",
      x: L.margin.left,
      y: y - 14,
      size: 9,
      color: "muted",
      text: options.labels.signature,
    });
    if (project.author) {
      page.ops.push({
        t: "text",
        x: L.margin.left,
        y: y - 28,
        size: bodySize,
        text: project.author,
      });
    }
    closing.push(page);
  }

  // ---- render --------------------------------------------------------------
  const all = [cover, ...toc, ...figureList, ...content, ...closing];
  const embeddedImages = new Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  const embeddedPdfs = new Map<string, PDFEmbeddedPage[]>();
  let done = 0;

  const color = (c?: "accent" | "muted") =>
    c === "accent" ? (abnt ? TEXT : ACCENT) : c === "muted" ? MUTED : TEXT;

  for (let index = 0; index < all.length; index++) {
    const planned = all[index]!;
    const page: PDFPage = doc.addPage([A4.w, A4.h]);
    for (const op of planned.ops) {
      if (op.t === "text") {
        page.drawText(clean(op.text), {
          x: op.x,
          y: op.y,
          size: op.size,
          font: font(op.bold),
          color: color(op.color),
        });
      } else if (op.t === "hline") {
        page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: 0.7, color: TEXT });
      } else if (op.t === "rule") {
        page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: 1.5, color: ACCENT });
      } else if (op.t === "image") {
        let embedded = embeddedImages.get(op.id);
        if (!embedded) {
          const src = assets.images.get(op.id)!;
          embedded =
            src.format === "png" ? await doc.embedPng(src.bytes) : await doc.embedJpg(src.bytes);
          embeddedImages.set(op.id, embedded);
        }
        page.drawImage(embedded, { x: op.x, y: op.y, width: op.w, height: op.h });
        options.onProgress?.(++done, total);
        if (done % 3 === 0) await new Promise((r) => setTimeout(r, 0));
      } else {
        let pages = embeddedPdfs.get(op.id);
        if (!pages) {
          const bytes = assets.pdfs.get(op.id);
          if (!bytes) throw new Error(`Missing PDF for ${op.id}`);
          pages = await doc.embedPdf(bytes);
          embeddedPdfs.set(op.id, pages);
        }
        const source = pages[op.pageIndex];
        if (source) {
          const labelH = 18;
          const boxW = A4.w - 2 * 28;
          const boxH = A4.h - 2 * 28 - labelH;
          const scale = Math.min(boxW / source.width, boxH / source.height);
          const w = source.width * scale;
          const h = source.height * scale;
          page.drawPage(source, { x: (A4.w - w) / 2, y: 28 + (boxH - h) / 2, width: w, height: h });
        }
        let label = clean(op.label);
        while (label.length > 8 && width(label, 8) > A4.w - 2 * 28)
          label = `${label.slice(0, -2)}…`;
        page.drawText(label, {
          x: 28,
          y: A4.h - 28 - 8,
          size: 8,
          font: fonts.regular,
          color: MUTED,
        });
        if (op.pageIndex === (pages.length > 0 ? pages.length - 1 : 0)) {
          options.onProgress?.(++done, total);
        }
      }
    }
    if (index > 0 && !abnt) {
      const label = String(numberOf(index));
      page.drawText(label, {
        x: (A4.w - width(label, 9)) / 2,
        y: L.margin.bottom - 4,
        size: 9,
        font: fonts.regular,
        color: MUTED,
      });
    } else if (abnt && index >= firstContentIndex) {
      const label = String(numberOf(index));
      page.drawText(label, {
        x: A4.w - L.margin.right - width(label, 10),
        y: A4.h - 2 * CM,
        size: 10,
        font: fonts.regular,
        color: TEXT,
      });
    }
  }

  doc.setTitle(clean(project.title || "EvidencePack"));
  doc.setAuthor(clean(project.author));
  doc.setProducer("EvidencePack");
  doc.setCreator("EvidencePack");
  return doc.save();
}

export type { Evidence };
