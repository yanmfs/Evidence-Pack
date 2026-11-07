import { strFromU8, unzipSync } from "fflate";
import type { DocBlock } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const unescapeXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name.startsWith("#x")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name] ?? whole;
  });

// Text of a paragraph: runs, tabs and line breaks, in order.
function paragraphText(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/?>/g)) {
    if (m[0].startsWith("<w:tab")) out += "\t";
    else if (m[0].startsWith("<w:br")) out += "\n";
    else out += unescapeXml(m[1] ?? "");
  }
  return out;
}

const styleOf = (xml: string) => /<w:pStyle w:val="([^"]+)"/.exec(xml)?.[1] ?? "";

function kindOf(style: string, xml: string): Exclude<DocBlock, { t: "table" }>["t"] {
  if (/^title$/i.test(style)) return "title";
  if (/^subtitle$/i.test(style)) return "subtitle";
  const heading = /^heading\s*([1-9])$/i.exec(style) ?? /^t[ií]tulo\s*([1-9])$/i.exec(style);
  if (heading) return Number(heading[1]) === 1 ? "h1" : Number(heading[1]) === 2 ? "h2" : "h3";
  if (/list/i.test(style) || xml.includes("<w:numPr>")) return "bullet";
  return "p";
}

function tableRows(xml: string): string[][] {
  return [...xml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((cell) =>
      [...cell[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)]
        .map((p) => paragraphText(p[0]).replace(/\t/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    ),
  );
}

// Reads the body of a .docx in document order: headings, paragraphs, list items and tables.
// Pictures, headers, footnotes and styling are left out; the original file stays untouched in the ZIP.
export function parseDocx(bytes: Uint8Array): DocBlock[] {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const entry = files["word/document.xml"];
  if (!entry) throw new Error("not a docx");
  const xml = strFromU8(entry);
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const blocks: DocBlock[] = [];
  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    if (m[0].startsWith("<w:tbl>")) {
      const rows = tableRows(m[0]);
      if (rows.length > 0) blocks.push({ t: "table", rows });
      continue;
    }
    const text = paragraphText(m[0]).trim();
    if (text !== "") blocks.push({ t: kindOf(styleOf(m[0]), m[0]), text });
  }
  return blocks;
}
