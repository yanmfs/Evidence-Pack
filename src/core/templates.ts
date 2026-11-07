import { addActivity } from "./project";
import type { Project } from "./types";

export type TemplateId = "blank" | "internship" | "accountability" | "portfolio";

export interface ProjectTemplate {
  id: TemplateId;
  // How many starter activities it creates; their names come from the translations.
  activities: number;
  settings: Partial<Project>;
}

export const TEMPLATES: ProjectTemplate[] = [
  { id: "blank", activities: 0, settings: {} },
  {
    id: "internship",
    activities: 4,
    settings: {
      template: "abnt",
      summaryTable: true,
      figureList: true,
      signature: { enabled: true, text: "" },
    },
  },
  {
    id: "accountability",
    activities: 3,
    settings: { summaryTable: true, signature: { enabled: true, text: "" } },
  },
  { id: "portfolio", activities: 2, settings: { imagesPerPage: 2 } },
];

// A project with the starter activities and settings of a template. `names` are the activity titles
// in order; extra names are ignored and missing ones leave the template shorter.
export function applyTemplate(project: Project, id: TemplateId, names: string[]): Project {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) return project;
  let next: Project = { ...project, ...template.settings };
  names.slice(0, template.activities).forEach((title, i) => {
    next = addActivity(next, `${project.id}-a${i + 1}`, title);
  });
  return next;
}
