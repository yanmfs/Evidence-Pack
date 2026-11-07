import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { docFormat, parseDocument } from "../src/core/docs";
import { detectDelimiter, parseCsvRows } from "../src/core/docs/text";

const bytes = (s: string) => strToU8(s);
const withBom = (s: string) => new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8(s)]);

describe("document formats", () => {
  it("recognizes by extension, any case", () => {
    expect(docFormat("Lista.CSV")).toBe("csv");
    expect(docFormat("a.b.docx")).toBe("docx");
    expect(docFormat("nota.txt")).toBe("txt");
    expect(docFormat("foto.png")).toBeNull();
    expect(docFormat("semextensao")).toBeNull();
  });
});

describe("CSV", () => {
  it("reads a semicolon file with a BOM and accents, every row kept", () => {
    const rows = [
      "codigo;nome;presença",
      ...Array.from({ length: 18 }, (_, i) => `P-${i + 1};Participante ${i + 1};SIM`),
    ];
    const blocks = parseDocument("lista.csv", withBom(rows.join("\r\n") + "\r\n"));
    expect(blocks).toHaveLength(1);
    const table = blocks[0];
    expect(table?.t).toBe("table");
    if (table?.t !== "table") return;
    expect(table.rows).toHaveLength(19);
    expect(table.rows[0]).toEqual(["codigo", "nome", "presença"]);
    expect(table.rows[18]).toEqual(["P-18", "Participante 18", "SIM"]);
  });

  it("picks the delimiter that splits every line the same way", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    // A comma in the text must not win over the real delimiter.
    expect(detectDelimiter("nome;nota\nSilva, Ana;9")).toBe(";");
  });

  it("handles quoted fields with delimiters, quotes and line breaks", () => {
    const rows = parseCsvRows('a;"b;c";"d ""q"" e"\n1;"linha 1\nlinha 2";3\n', ";");
    expect(rows).toEqual([
      ["a", "b;c", 'd "q" e'],
      ["1", "linha 1\nlinha 2", "3"],
    ]);
  });

  it("skips blank lines and reads Windows-1252 files", () => {
    const latin1 = new Uint8Array([
      0x6e, 0x6f, 0x6d, 0x65, 0x3b, 0x61, 0xe7, 0xe3, 0x6f, 0x0a, 0x0a, 0x41, 0x3b, 0x78,
    ]);
    const blocks = parseDocument("x.csv", latin1);
    expect(blocks[0]).toEqual({
      t: "table",
      rows: [
        ["nome", "ação"],
        ["A", "x"],
      ],
    });
    expect(parseDocument("vazio.csv", bytes("\n\n"))).toEqual([]);
  });
});

describe("TXT", () => {
  it("keeps one paragraph per line and drops blank ones", () => {
    const blocks = parseDocument(
      "n.txt",
      bytes("TÍTULO\n09:00 — Início\r\n\r\n09:20 — Conferência\n"),
    );
    expect(blocks.map((b) => (b.t === "table" ? "" : b.text))).toEqual([
      "TÍTULO",
      "09:00 — Início",
      "09:20 — Conferência",
    ]);
  });
});

function docx(body: string): Uint8Array {
  return zipSync({
    "[Content_Types].xml": bytes("<Types/>"),
    "word/document.xml": bytes(
      `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`,
    ),
  });
}

const p = (text: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;

describe("DOCX", () => {
  it("reads titles, headings, paragraphs and bullets in order", () => {
    const blocks = parseDocument(
      "plano.docx",
      docx(
        p("Plano", "Title") +
          p("1. Identificação", "Heading1") +
          p("Texto &amp; mais") +
          p("Item um", "ListBullet"),
      ),
    );
    expect(blocks).toEqual([
      { t: "title", text: "Plano" },
      { t: "h1", text: "1. Identificação" },
      { t: "p", text: "Texto & mais" },
      { t: "bullet", text: "Item um" },
    ]);
  });

  it("reads a table between paragraphs without repeating its cells as paragraphs", () => {
    const table =
      "<w:tbl><w:tr><w:tc>" +
      p("Horário") +
      "</w:tc><w:tc>" +
      p("Etapa") +
      "</w:tc></w:tr>" +
      "<w:tr><w:tc>" +
      p("09:00") +
      "</w:tc><w:tc>" +
      p("Abertura") +
      "</w:tc></w:tr></w:tbl>";
    const blocks = parseDocument("t.docx", docx(p("Antes") + table + p("Depois")));
    expect(blocks).toEqual([
      { t: "p", text: "Antes" },
      {
        t: "table",
        rows: [
          ["Horário", "Etapa"],
          ["09:00", "Abertura"],
        ],
      },
      { t: "p", text: "Depois" },
    ]);
  });

  it("treats a numbered paragraph as a list item and keeps tabs and breaks", () => {
    const numbered =
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Passo</w:t></w:r></w:p>';
    const breaks = "<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p>";
    expect(parseDocument("n.docx", docx(numbered + breaks))).toEqual([
      { t: "bullet", text: "Passo" },
      { t: "p", text: "a\tb\nc" },
    ]);
  });

  it("fails clearly when the file is not a Word document", () => {
    expect(() => parseDocument("x.docx", bytes("isto não é um zip"))).toThrow();
    expect(() => parseDocument("x.docx", zipSync({ "outro.txt": bytes("x") }))).toThrow(
      "not a docx",
    );
  });
});
