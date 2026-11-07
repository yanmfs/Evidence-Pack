import type { LangSetting } from "./i18n";

export type ThemeSetting = "system" | "light" | "dark";

export interface Settings {
  language: LangSetting;
  theme: ThemeSetting;
  lastProjectId: string | null;
}

export const defaultSettings: Settings = { language: "auto", theme: "system", lastProjectId: null };

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

// Stored settings can be missing fields (older versions) or hand-edited; fall back per field.
export function parseSettings(raw: unknown): Settings {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    language: pick(r.language, ["auto", "pt-BR", "en"], defaultSettings.language),
    theme: pick(r.theme, ["system", "light", "dark"], defaultSettings.theme),
    lastProjectId: typeof r.lastProjectId === "string" ? r.lastProjectId : null,
  };
}
