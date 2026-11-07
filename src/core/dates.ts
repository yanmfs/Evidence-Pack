import type { DateSource } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validDate(y: number, m: number, d: number): boolean {
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
}

function iso(y: number, m: number, d: number, time?: [number, number, number]): string | null {
  if (!validDate(y, m, d)) return null;
  const date = `${y}-${pad(m)}-${pad(d)}`;
  if (!time) return date;
  const [h, mi, s] = time;
  if (h > 23 || mi > 59 || s > 59) return date;
  return `${date}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

const n = (s: string | undefined) => Number(s);

type Pattern = [RegExp, (m: RegExpExecArray) => string | null];

// Most specific patterns first; the generic date-only ones are the fallback.
const PATTERNS: Pattern[] = [
  [
    /(?<!\d)(20\d{2})-(\d{2})-(\d{2})\s+(?:at|às|as)\s+(\d{2})\.(\d{2})\.(\d{2})/i,
    (m) => iso(n(m[1]), n(m[2]), n(m[3]), [n(m[4]), n(m[5]), n(m[6])]),
  ],
  [
    /(?<!\d)(20\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/,
    (m) => iso(n(m[1]), n(m[2]), n(m[3]), [n(m[4]), n(m[5]), n(m[6])]),
  ],
  [
    /(?<!\d)(20\d{2})-(\d{2})-(\d{2})[ _](\d{2})(\d{2})(\d{2})(?!\d)/,
    (m) => iso(n(m[1]), n(m[2]), n(m[3]), [n(m[4]), n(m[5]), n(m[6])]),
  ],
  [
    /(?<!\d)(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/,
    (m) => iso(n(m[1]), n(m[2]), n(m[3]), [n(m[4]), n(m[5]), n(m[6])]),
  ],
  [/(?<!\d)(20\d{2})(\d{2})(\d{2})-WA\d+/i, (m) => iso(n(m[1]), n(m[2]), n(m[3]))],
  [/(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/, (m) => iso(n(m[1]), n(m[2]), n(m[3]))],
  [/(?<!\d)(\d{2})[-.](\d{2})[-.](20\d{2})(?!\d)/, (m) => iso(n(m[3]), n(m[2]), n(m[1]))],
];

export function dateFromFilename(name: string): string | null {
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(name);
    const result = match && build(match);
    if (result) return result;
  }
  return null;
}

// EXIF stores "2026:03:14 10:22:31"; some cameras write blanks or zeros instead.
export function dateFromExif(raw: string): string | null {
  const m = /^\s*(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  return m ? iso(n(m[1]), n(m[2]), n(m[3]), [n(m[4]), n(m[5]), n(m[6])]) : null;
}

export function dateFromTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface DateSources {
  exif?: string | null;
  filename: string;
  modifiedMs?: number | null;
}

export function resolveDate({ exif, filename, modifiedMs }: DateSources): {
  date: string | null;
  dateSource: DateSource | null;
} {
  const fromExif = exif ? dateFromExif(exif) : null;
  if (fromExif) return { date: fromExif, dateSource: "exif" };
  const fromName = dateFromFilename(filename);
  if (fromName) return { date: fromName, dateSource: "filename" };
  if (modifiedMs) return { date: dateFromTimestamp(modifiedMs), dateSource: "file" };
  return { date: null, dateSource: null };
}

export function formatDate(value: string, locale: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatDateTime(value: string, locale: string): string {
  const date = formatDate(value, locale);
  return value.length > 10 ? `${date} ${value.slice(11, 16)}` : date;
}
