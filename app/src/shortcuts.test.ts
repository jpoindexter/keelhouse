import { describe, expect, it } from "vitest";
import { SHORTCUTS, shortcutKeys, shortcutTitle } from "./shortcuts";

describe("shortcut baseline", () => {
  it("covers the v0.5 active workspace, editor, terminal, and composer shortcuts", () => {
    expect(shortcutKeys("workspace.open")).toBe("Cmd+O");
    expect(shortcutKeys("editor.save")).toBe("Cmd+S");
    expect(shortcutKeys("editor.find")).toContain("Cmd+F");
    expect(shortcutKeys("editor.close-tab")).toBe("Cmd+W");
    expect(shortcutKeys("workspace.quick-open")).toBe("Cmd+P");
    expect(shortcutKeys("terminal.copy-selection")).toBe("Cmd+C");
    expect(shortcutKeys("terminal.paste")).toBe("Cmd+V");
    expect(shortcutKeys("terminal.clear")).toBe("Cmd+K");
    expect(shortcutKeys("composer.send")).toBe("Enter");
    expect(shortcutKeys("chrome.command-palette")).toBe("Shift+Cmd+P");
  });

  it("documents planned shortcut exceptions instead of implying unsupported behavior", () => {
    const planned = SHORTCUTS.filter((shortcut) => shortcut.status === "planned");
    expect(planned.map((shortcut) => shortcut.id)).toEqual([
      "terminal.new-pane",
      "terminal.split-pane",
      "terminal.focus-next-pane",
    ]);
    expect(planned.every((shortcut) => shortcut.exception)).toBe(true);
  });

  it("formats visible shortcut labels for tooltips", () => {
    expect(shortcutTitle("editor.save", "Save")).toBe("Save (Cmd+S)");
    expect(shortcutTitle("missing", "Fallback")).toBe("Fallback");
  });
});
