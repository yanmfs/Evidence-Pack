import { parseDocx } from "./docx";
import { parseCsv, parseTxt } from "./text";
import { docFormat, type DocBlock } from "./types";

export { docFormat, DOC_EXTENSIONS } from "./types";
export type { DocBlock, DocFormat } from "./types";

export function parseDocument(fileName: string, bytes: Uint8Array): DocBlock[] {
  switch (docFormat(fileName)) {
    case "txt":
      return parseTxt(bytes);
    case "csv":
      return parseCsv(bytes);
    case "docx":
      return parseDocx(bytes);
    default:
      throw new Error(`unsupported document: ${fileName}`);
  }
}
