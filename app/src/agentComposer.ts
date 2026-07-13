export type ComposerRoute =
  | { kind: "empty" }
  | { kind: "chat"; text: string }
  | { kind: "app"; command: ComposerAppCommand }
  | { kind: "unknown-app"; input: string };

export type ComposerAppCommand = "save" | "find" | "open-folder" | "clear-terminal" | "help";

export type ComposerAppCommandInfo = {
  command: ComposerAppCommand;
  aliases: string[];
  label: string;
  detail: string;
};

export const COMPOSER_APP_COMMANDS: ComposerAppCommandInfo[] = [
  { command: "save", aliases: [">save"], label: ">save", detail: "Save the active editor file" },
  { command: "find", aliases: [">find"], label: ">find", detail: "Open find and replace in the active file" },
  { command: "open-folder", aliases: [">open", ">open-folder"], label: ">open", detail: "Open or switch the project folder" },
  { command: "clear-terminal", aliases: [">clear", ">clear-terminal"], label: ">clear", detail: "Clear the selected terminal pane" },
  { command: "help", aliases: [">help", ">?"], label: ">help", detail: "List the available app commands" },
];

const COMMAND_ALIASES: Record<string, ComposerAppCommand> = Object.fromEntries(
  COMPOSER_APP_COMMANDS.flatMap((info) => info.aliases.map((alias) => [alias, info.command])),
);

export const composerHelpText = (): string =>
  COMPOSER_APP_COMMANDS.map((info) => `${info.aliases.join(", ")} — ${info.detail}`).join("\n");

export const routeComposerDraft = (draft: string): ComposerRoute => {
  const text = draft.trim();
  if (!text) return { kind: "empty" };
  const command = COMMAND_ALIASES[text.toLowerCase()];
  if (command) return { kind: "app", command };
  // A single ">"-prefixed token is an app-command attempt, not agent input.
  if (text.startsWith(">") && !/\s/.test(text)) return { kind: "unknown-app", input: text };
  return { kind: "chat", text: draft };
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
