export const COMMAND_PALETTE_SOURCE_IDS = ["chats", "commands", "files", "tabs", "worktrees"] as const;

export type CommandPaletteSourceId = (typeof COMMAND_PALETTE_SOURCE_IDS)[number];
export type CommandPaletteSourceSettings = Record<CommandPaletteSourceId, boolean>;

export const COMMAND_PALETTE_SOURCE_OPTIONS: Array<{
  id: CommandPaletteSourceId;
  label: string;
  description: string;
}> = [
  { id: "chats", label: "Chats", description: "Chats across open projects" },
  { id: "commands", label: "Commands", description: "Workbench and agent actions" },
  { id: "files", label: "Files", description: "Files in the active project" },
  { id: "tabs", label: "Open tabs", description: "Files already open in the editor" },
  { id: "worktrees", label: "Worktrees", description: "Active isolated worktree panes" },
];

export const DEFAULT_COMMAND_PALETTE_SOURCES: CommandPaletteSourceSettings = {
  chats: true,
  commands: true,
  files: true,
  tabs: true,
  worktrees: true,
};

export const normalizeCommandPaletteSources = (value: unknown): CommandPaletteSourceSettings => {
  if (typeof value !== "object" || value == null) return { ...DEFAULT_COMMAND_PALETTE_SOURCES };
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(
    COMMAND_PALETTE_SOURCE_IDS.map((id) => [id, typeof candidate[id] === "boolean" ? candidate[id] : true]),
  ) as CommandPaletteSourceSettings;
};
