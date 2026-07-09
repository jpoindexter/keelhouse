import { describe, expect, it } from "vitest";
import { filterCommandPaletteCommands, type CommandPaletteCommand } from "./commandPalette";

const commands: CommandPaletteCommand[] = [
  { id: "workspace.open", label: "Open Folder", detail: "Choose a project folder", shortcut: "Cmd+O", keywords: ["project"] },
  { id: "editor.save", label: "Save", detail: "Save active editor file", shortcut: "Cmd+S" },
  { id: "drawer.git", label: "Show Git", detail: "Open source control drawer", keywords: ["source control"] },
];

describe("command palette filtering", () => {
  it("returns all commands for an empty query", () => {
    expect(filterCommandPaletteCommands(commands, "")).toHaveLength(3);
  });

  it("matches labels, details, shortcuts, and keywords", () => {
    expect(filterCommandPaletteCommands(commands, "folder")[0]?.id).toBe("workspace.open");
    expect(filterCommandPaletteCommands(commands, "cmd+s")[0]?.id).toBe("editor.save");
    expect(filterCommandPaletteCommands(commands, "source")[0]?.id).toBe("drawer.git");
    expect(filterCommandPaletteCommands(commands, "git source")[0]?.id).toBe("drawer.git");
  });
});
