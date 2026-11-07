import type { DocBlock } from "./types";

// UTF-8 first (with or without a BOM); files saved by older Windows programs fall back to Windows-1252.
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\u{FEFF}/u, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Plain text keeps its lines: notes and logs are one entry per line.
export function parseTxt(bytes: Uint8Array): DocBlock[] {
  const lines = decodeText(bytes).replace(/\r\n?/g, "\n").split("\n");
  const blocks: DocBlock[] = [];
  for (const line of lines) {
    const text = line.replace(/\t/g, "  ").trimEnd();
    if (text.trim() !== "") blocks.push({ t: "p", text });
  }
  return blocks;
}

const DELIMITERS = [";", ",", "\t"] as const;

// The delimiter that splits the first lines into the same number of columns, most columns wins.
export function detectDelimiter(text: string): string {
  const sample = text
    .split("\n")
    .slice(0, 5)
    .filter((l) => l.trim() !== "");
  let best = ";";
  let bestColumns = 1;
  for (const d of DELIMITERS) {
    const counts = sample.map((l) => l.split(d).length);
    const steady = counts.length > 0 && counts.every((c) => c === counts[0]);
    if (steady && (counts[0] ?? 1) > bestColumns) {
      best = d;
      bestColumns = counts[0] ?? 1;
    }
  }
  return best;
}

export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) endField();
    else if (ch === "\n") endRow();
    else if (ch !== "\r") field += ch;
  }
  endRow();
  return rows;
}

export function parseCsv(bytes: Uint8Array): DocBlock[] {
  const text = decodeText(bytes);
  const rows = parseCsvRows(text, detectDelimiter(text.replace(/\r\n?/g, "\n")));
  return rows.length === 0 ? [] : [{ t: "table", rows }];
}
