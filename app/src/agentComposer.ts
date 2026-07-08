export type ComposerRoute =
  | { kind: "empty" }
  | { kind: "pty"; text: string }
  | { kind: "app"; command: ComposerAppCommand };

export type ComposerAppCommand = "save" | "find" | "open-folder" | "clear-terminal";

const COMMAND_ALIASES: Record<string, ComposerAppCommand> = {
  ">save": "save",
  ">find": "find",
  ">open-folder": "open-folder",
  ">open": "open-folder",
  ">clear-terminal": "clear-terminal",
  ">clear": "clear-terminal",
};

export const routeComposerDraft = (draft: string): ComposerRoute => {
  const text = draft.trim();
  if (!text) return { kind: "empty" };
  const command = COMMAND_ALIASES[text.toLowerCase()];
  if (command) return { kind: "app", command };
  return { kind: "pty", text: draft };
};

export const composerHistoryAfterSubmit = (history: string[], draft: string, limit = 20) => {
  const text = draft.trim();
  if (!text) return history;
  const withoutDuplicate = history.filter((entry) => entry !== draft);
  return [...withoutDuplicate, draft].slice(-limit);
};

export const composerHistoryAt = (history: string[], index: number | null) => {
  if (index == null || history.length === 0) return "";
  const clamped = Math.min(Math.max(0, index), history.length - 1);
  return history[clamped] ?? "";
};

export const previousComposerHistoryIndex = (history: string[], index: number | null) => {
  if (history.length === 0) return null;
  if (index == null) return history.length - 1;
  return Math.max(0, index - 1);
};

export const nextComposerHistoryIndex = (history: string[], index: number | null) => {
  if (history.length === 0 || index == null) return null;
  const next = index + 1;
  return next >= history.length ? null : next;
};
