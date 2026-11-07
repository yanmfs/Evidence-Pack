import { formatDateTime } from "./dates";
import { itemsOf, numberEvidence, sortedActivities } from "./project";
import type { Project } from "./types";

export interface ZipEntry {
  storedName: string;
  path: string;
}

export interface CsvLabels {
  activity: string;
  number: string;
  caption: string;
  date: string;
  dateSource: string;
  originalFile: string;
  sha256: string;
  figure: string;
  annex: string;
  sources: Record<"exif" | "filename" | "file" | "manual", string>;
}

const MAX_NAME = 60;

export function safeName(text: string, fallback = "arquivo"): string {
  const cleaned = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");
  return (cleaned.slice(0, MAX_NAME).trim() || fallback).replace(/[. ]+$/, "");
}

const extensionOf = (stored: string) => {
  const ext = stored.split(".").pop()?.toLowerCase() ?? "bin";
  return ext === "jpeg" ? "jpg" : ext;
};

// A spreadsheet would run a cell that starts with these characters as a formula.
function csvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

// Originals go in untouched, in one folder per activity; the CSV opens straight in Brazilian Excel.
export function buildZipPlan(
  project: Project,
  locale: string,
  labels: CsvLabels,
): { entries: ZipEntry[]; csv: string } {
  const numbers = numberEvidence(project);
  const entries: ZipEntry[] = [];
  const rows: string[][] = [];
  const used = new Set<string>();
  let sequence = 0;

  sortedActivities(project).forEach((activity, index) => {
    const folder = `${String(index + 1).padStart(2, "0")} - ${safeName(activity.title, "atividade")}`;
    for (const item of itemsOf(project, activity.id)) {
      sequence++;
      const day = item.date ? item.date.slice(0, 10) : "";
      const stem = [
        String(sequence).padStart(3, "0"),
        day,
        safeName(item.caption || item.originalName),
      ]
        .filter(Boolean)
        .join(" - ");
      let path = `${folder}/${stem}.${extensionOf(item.storedName)}`;
      for (let n = 2; used.has(path.toLowerCase()); n++)
        path = `${folder}/${stem} (${n}).${extensionOf(item.storedName)}`;
      used.add(path.toLowerCase());
      entries.push({ storedName: item.storedName, path });

      const number = numbers.get(item.id);
      rows.push([
        activity.title,
        number ? `${number.kind === "figure" ? labels.figure : labels.annex} ${number.n}` : "",
        item.caption,
        item.date ? formatDateTime(item.date, locale) : "",
        item.dateSource ? labels.sources[item.dateSource] : "",
        item.originalName,
        item.sha256,
      ]);
    }
  });

  const header = [
    labels.activity,
    labels.number,
    labels.caption,
    labels.date,
    labels.dateSource,
    labels.originalFile,
    labels.sha256,
  ];
  const csv = `﻿${[header, ...rows].map((r) => r.map(csvField).join(";")).join("\r\n")}\r\n`;
  return { entries, csv };
}
