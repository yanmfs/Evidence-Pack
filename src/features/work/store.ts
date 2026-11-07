import { create } from "zustand";
import { newProject, parseProject, sortedActivities } from "../../core/project";
import { applyTemplate, type TemplateId } from "../../core/templates";
import type { Project } from "../../core/types";
import { platform } from "../../platform";
import type { Key } from "../../i18n";
import { tNow, useApp } from "../../store";

type SaveState = "saved" | "saving";

interface WorkState {
  projects: Project[];
  currentId: string | null;
  // null is the inbox.
  activityId: string | null;
  selected: string[];
  saveState: SaveState;
  loaded: boolean;
  load: () => Promise<void>;
  createProject: (name: string, template?: TemplateId) => Promise<Project>;
  // Returns false when the person cancels, throws when the file is not a project.
  importProject: () => Promise<boolean>;
  deleteProject: (id: string) => Promise<void>;
  switchProject: (id: string) => void;
  mutate: (change: (p: Project) => Project) => void;
  selectActivity: (id: string | null) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
}

const SAVE_DELAY_MS = 500;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useWork = create<WorkState>((set, get) => {
  const scheduleSave = (id: string) => {
    clearTimeout(timers.get(id));
    set({ saveState: "saving" });
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        const project = get().projects.find((p) => p.id === id);
        const done = () => timers.size === 0 && set({ saveState: "saved" });
        if (!project) return done();
        void platform.writeProject(project).finally(done);
      }, SAVE_DELAY_MS),
    );
  };

  const firstActivity = (p: Project | undefined) =>
    sortedActivities(p ?? newProject("", ""))[0]?.id ?? null;

  return {
    projects: [],
    currentId: null,
    activityId: null,
    selected: [],
    saveState: "saved",
    loaded: false,

    load: async () => {
      await platform.init();
      if (new URLSearchParams(window.location.search).has("demo")) {
        await (await import("./demo")).seedDemo();
      }
      const projects = (await platform.listProjects().catch(() => [])).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      const last = useApp.getState().settings.lastProjectId;
      const current = projects.find((p) => p.id === last) ?? projects[0];
      set({
        projects,
        currentId: current?.id ?? null,
        activityId: firstActivity(current),
        loaded: true,
      });
    },

    createProject: async (name, template = "blank") => {
      const now = new Date().toISOString();
      const names = [1, 2, 3, 4].map((n) => tNow(`tpl.${template}.a${n}` as Key));
      const project = applyTemplate(
        newProject(crypto.randomUUID(), now, { title: name }),
        template,
        names,
      );
      await platform.writeProject(project);
      set((s) => ({
        projects: [project, ...s.projects],
        currentId: project.id,
        activityId: sortedActivities(project)[0]?.id ?? null,
        selected: [],
      }));
      useApp.getState().update({ lastProjectId: project.id });
      return project;
    },

    importProject: async () => {
      const id = crypto.randomUUID();
      const json = await platform.importProject(id);
      if (json === null) return false;
      const project = parseProject(json, id, new Date().toISOString());
      if (!project) {
        await platform.deleteProject(id);
        throw new Error("invalid project file");
      }
      await platform.writeProject(project);
      set((s) => ({
        projects: [project, ...s.projects],
        currentId: id,
        activityId: sortedActivities(project)[0]?.id ?? null,
        selected: [],
      }));
      useApp.getState().update({ lastProjectId: id });
      return true;
    },

    deleteProject: async (id) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      await platform.deleteProject(id);
      const projects = get().projects.filter((p) => p.id !== id);
      const next =
        get().currentId === id ? projects[0] : projects.find((p) => p.id === get().currentId);
      set({ projects, currentId: next?.id ?? null, activityId: firstActivity(next), selected: [] });
      useApp.getState().update({ lastProjectId: next?.id ?? null });
    },

    switchProject: (id) => {
      const project = get().projects.find((p) => p.id === id);
      if (!project) return;
      set({ currentId: id, activityId: firstActivity(project), selected: [] });
      useApp.getState().update({ lastProjectId: id });
    },

    mutate: (change) => {
      const { currentId, projects } = get();
      const current = projects.find((p) => p.id === currentId);
      if (!current) return;
      const next = { ...change(current), updatedAt: new Date().toISOString() };
      set({ projects: projects.map((p) => (p.id === next.id ? next : p)) });
      scheduleSave(next.id);
    },

    selectActivity: (activityId) => set({ activityId, selected: [] }),
    toggleSelected: (id) =>
      set((s) => ({
        selected: s.selected.includes(id)
          ? s.selected.filter((x) => x !== id)
          : [...s.selected, id],
      })),
    clearSelection: () => set({ selected: [] }),
  };
});

export const useCurrent = (): Project | undefined =>
  useWork((s) => s.projects.find((p) => p.id === s.currentId));
