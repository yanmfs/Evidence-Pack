export type Os = "macos" | "windows";

export const detectOs = (userAgent: string): Os =>
  /Mac|iPhone|iPad/i.test(userAgent) ? "macos" : "windows";

export const defaultShortcut = (os: Os) =>
  os === "macos" ? "Control+Alt+Command+V" : "Control+Alt+Shift+V";

// The clipboard on Windows expects CRLF; plain "\n" pastes as a single line in some apps.
export const toClipboardText = (text: string, os: Os) =>
  os === "windows" ? text.replace(/\r?\n/g, "\r\n") : text.replace(/\r\n?/g, "\n");

export const modKeyLabel = (os: Os) => (os === "macos" ? "⌘" : "Ctrl");

const MAC_ORDER = ["Control", "Alt", "Shift", "Command"] as const;
const WIN_ORDER = ["Control", "Alt", "Shift", "Super"] as const;
const MAC_SYMBOL: Record<string, string> = { Control: "⌃", Alt: "⌥", Shift: "⇧", Command: "⌘" };
const WIN_LABEL: Record<string, string> = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Super: "Win",
};

export function formatShortcut(accelerator: string, os: Os): string {
  const parts = accelerator.split("+");
  const key = parts.pop() ?? "";
  const mods = new Set(parts);
  if (os === "macos") {
    const symbols = MAC_ORDER.filter((m) => mods.has(m)).map((m) => MAC_SYMBOL[m]);
    return [...symbols, key.length === 1 ? key.toUpperCase() : key].join("");
  }
  const labels = WIN_ORDER.filter((m) => mods.has(m)).map((m) => WIN_LABEL[m]);
  return [...labels, key.length === 1 ? key.toUpperCase() : key].join("+");
}

export interface KeyEventLike {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const NAMED_KEYS: Record<string, string> = {
  Space: "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  return NAMED_KEYS[code] ?? null;
}

// Needs at least one modifier, otherwise typing in any app would trigger the shortcut.
export function acceleratorFromEvent(e: KeyEventLike, os: Os): string | null {
  const key = keyName(e.code);
  if (!key) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push(os === "macos" ? "Command" : "Super");
  return mods.length === 0 ? null : [...mods, key].join("+");
}
