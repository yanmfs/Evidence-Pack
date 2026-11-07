export type DocBlock =
  | { t: "title" | "subtitle" | "h1" | "h2" | "h3" | "p" | "bullet"; text: string }
  | { t: "table"; rows: string[][] };

export type DocFormat = "txt" | "csv" | "docx";

export const DOC_EXTENSIONS: readonly DocFormat[] = ["txt", "csv", "docx"];

export function docFormat(fileName: string): DocFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return DOC_EXTENSIONS.find((f) => f === ext) ?? null;
}
