export type Template = "simple" | "abnt";
export type DateSource = "exif" | "filename" | "file" | "manual";

export interface Activity {
  id: string;
  title: string;
  description?: string;
  start?: string;
  end?: string;
  // Time spent, for the summary table of the report.
  hours?: number;
  order: number;
}

export interface Evidence {
  id: string;
  // null puts the item in the inbox, outside the report.
  activityId: string | null;
  // "doc" is a text, spreadsheet (CSV) or Word file, shown in the report as text pages.
  kind: "image" | "pdf" | "doc";
  storedName: string;
  thumbName?: string;
  originalName: string;
  sha256: string;
  caption: string;
  source: string;
  date: string | null;
  dateSource: DateSource | null;
  width?: number;
  height?: number;
  pages?: number;
  // Clockwise turn applied to the image in the report; the original file is never changed.
  rotation?: 0 | 90 | 180 | 270;
  order: number;
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  institution?: string;
  course?: string;
  supervisor?: string;
  location?: string;
  period: { start?: string; end?: string };
  template: Template;
  imagesPerPage: 1 | 2;
  quality: "mid" | "high";
  // Both are optional so projects saved before they existed keep loading.
  logo?: { storedName: string; thumbName?: string; width: number; height: number };
  figureList?: boolean;
  // A line or two on the cover, such as a note that the content is made up for a test.
  notice?: string;
  summaryTable?: boolean;
  signature?: { enabled: boolean; text: string };
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
  items: Evidence[];
}
