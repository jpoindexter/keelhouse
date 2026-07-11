import { afterEach, describe, expect, it } from "vitest";
import {
  comboMatches,
  eventToCombo,
  findKeybindingConflicts,
  normalizeKeybindingOverrides,
  setActiveKeybindingOverrides,
  SHORTCUTS,
  shortcutKeys,
  shortcutTitle,
} from "./shortcuts";

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

describe("keybinding overrides", () => {
  afterEach(() => setActiveKeybindingOverrides({}));

  it("resolves overrides ahead of registry defaults and resets cleanly", () => {
    expect(shortcutKeys("chrome.settings")).toBe("Cmd+,");
    setActiveKeybindingOverrides({ "chrome.settings": ["Shift+Cmd+,"] });
    expect(shortcutKeys("chrome.settings")).toBe("Shift+Cmd+,");
    setActiveKeybindingOverrides({});
    expect(shortcutKeys("chrome.settings")).toBe("Cmd+,");
  });

  it("normalizes only active known shortcuts with non-empty key lists", () => {
    expect(
      normalizeKeybindingOverrides({
        "chrome.settings": ["Cmd+;"],
        "editor.find": ["Cmd+F"],
        "nope.missing": ["Cmd+X"],
        "workspace.open": [],
        "editor.save": [42],
      }),
    ).toEqual({ "chrome.settings": ["Cmd+;"] });
    expect(normalizeKeybindingOverrides(null)).toEqual({});
  });

  it("formats and matches key events in registry style", () => {
    expect(eventToCombo({ key: "p", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true })).toBe("Shift+Cmd+P");
    expect(eventToCombo({ key: ",", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBe("Cmd+,");
    expect(eventToCombo({ key: "Meta", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBeNull();
    expect(comboMatches({ key: ",", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, "chrome.settings")).toBe(true);
  });

  it("detects conflicts between resolved active shortcuts", () => {
    expect(findKeybindingConflicts()).toEqual([]);
    setActiveKeybindingOverrides({ "chrome.settings": ["Shift+Cmd+P"] });
    const conflicts = findKeybindingConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].keys).toBe("Shift+Cmd+P");
    expect(conflicts[0].ids.sort()).toEqual(["chrome.command-palette", "chrome.settings"]);
  });
});
