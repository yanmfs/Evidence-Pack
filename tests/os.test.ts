import { describe, expect, it } from "vitest";
import {
  acceleratorFromEvent,
  defaultShortcut,
  detectOs,
  formatShortcut,
  toClipboardText,
} from "../src/core/os";

describe("detectOs", () => {
  it("recognises macOS and Windows user agents", () => {
    expect(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)")).toBe("macos");
    expect(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
  });
});

describe("defaultShortcut", () => {
  it("uses Control+Alt+Command on macOS and Control+Alt+Shift on Windows", () => {
    expect(defaultShortcut("macos")).toBe("Control+Alt+Command+V");
    expect(defaultShortcut("windows")).toBe("Control+Alt+Shift+V");
  });
});

describe("formatShortcut", () => {
  it("renders macOS symbols in Apple order", () => {
    expect(formatShortcut("Control+Alt+Command+V", "macos")).toBe("⌃⌥⌘V");
    expect(formatShortcut("Command+Shift+Control+k", "macos")).toBe("⌃⇧⌘K");
  });

  it("renders Windows labels", () => {
    expect(formatShortcut("Control+Alt+Shift+V", "windows")).toBe("Ctrl+Alt+Shift+V");
    expect(formatShortcut("Super+F5", "windows")).toBe("Win+F5");
  });
});

describe("toClipboardText", () => {
  it("uses CRLF on Windows", () => {
    expect(toClipboardText("a\n\nb", "windows")).toBe("a\r\n\r\nb");
    expect(toClipboardText("a\r\nb", "windows")).toBe("a\r\nb");
  });

  it("uses LF on macOS", () => {
    expect(toClipboardText("a\r\nb", "macos")).toBe("a\nb");
  });
});

describe("acceleratorFromEvent", () => {
  const base = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };

  it("builds an accelerator from the physical key", () => {
    const e = { ...base, ctrlKey: true, altKey: true, metaKey: true, code: "KeyV" };
    expect(acceleratorFromEvent(e, "macos")).toBe("Control+Alt+Command+V");
    expect(acceleratorFromEvent(e, "windows")).toBe("Control+Alt+Super+V");
  });

  it("rejects keys without a modifier", () => {
    expect(acceleratorFromEvent({ ...base, code: "KeyV" }, "macos")).toBeNull();
  });

  it("rejects modifier-only presses and unsupported keys", () => {
    expect(
      acceleratorFromEvent({ ...base, ctrlKey: true, code: "ControlLeft" }, "windows"),
    ).toBeNull();
    expect(
      acceleratorFromEvent({ ...base, ctrlKey: true, code: "Backquote" }, "windows"),
    ).toBeNull();
  });

  it("accepts digits and function keys", () => {
    expect(acceleratorFromEvent({ ...base, altKey: true, code: "Digit7" }, "windows")).toBe(
      "Alt+7",
    );
    expect(acceleratorFromEvent({ ...base, shiftKey: true, code: "F12" }, "windows")).toBe(
      "Shift+F12",
    );
  });
});
