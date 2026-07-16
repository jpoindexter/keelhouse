import { COMPOSER_APP_COMMANDS, type ComposerAppCommand } from "./agentComposer";
import { filterCommandPaletteCommands } from "./commandPalette";
import { buildChatPaletteCommands } from "./commandPaletteChats";
import {
  buildCommandPaletteLayoutCommands,
  buildCommandPaletteResourceCommands,
} from "./commandPaletteNavigation";
import type { CommandPaletteSourceSettings } from "./commandPaletteSources";
import {
  buildTerminalFindCommands,
  buildTerminalLifecycleCommands,
} from "./commandPaletteTerminal";
import {
  buildBrowserCommands,
  buildChromeCommands,
  buildComposerAttachmentCommands,
  buildEditorCommands,
  buildWorkspaceCommands,
  buildWorkspaceOpenCommands,
} from "./commandPaletteWorkbench";
import type { AppIconName } from "./icons";
import type { SearchDialogCommand } from "./SearchCommandDialog";

const EMPTY_QUERY_GROUP_LIMIT = 6;
const QUERY_RESULT_LIMIT = 120;

type CommandPaletteAssemblyInput = {
  chats: Parameters<typeof buildChatPaletteCommands>[0];
  navigation: Parameters<typeof buildCommandPaletteLayoutCommands>[0]
    & Parameters<typeof buildCommandPaletteResourceCommands>[0];
  runAppCommand: (command: ComposerAppCommand) => unknown;
  terminal: Parameters<typeof buildTerminalFindCommands>[0]
    & Parameters<typeof buildTerminalLifecycleCommands>[0];
  workbench: Parameters<typeof buildWorkspaceOpenCommands>[0]
    & Parameters<typeof buildChromeCommands>[0]
    & Parameters<typeof buildWorkspaceCommands>[0]
    & Parameters<typeof buildEditorCommands>[0]
    & Parameters<typeof buildBrowserCommands>[0]
    & Parameters<typeof buildComposerAttachmentCommands>[0];
};

const composerAppPaletteCommands = (
  runAppCommand: (command: ComposerAppCommand) => unknown,
): SearchDialogCommand[] => COMPOSER_APP_COMMANDS.map((info) => ({
  id: `composer.${info.command}`,
  label: `App Command ${info.label}`,
  detail: info.detail,
  icon: "send" as AppIconName,
  keywords: ["composer", "app command", ...info.aliases],
  run: () => void runAppCommand(info.command),
}));

export const assembleCommandPaletteCommands = (
  input: CommandPaletteAssemblyInput,
): SearchDialogCommand[] => [
  ...buildChatPaletteCommands(input.chats),
  ...buildWorkspaceOpenCommands(input.workbench),
  ...composerAppPaletteCommands(input.runAppCommand),
  ...buildChromeCommands(input.workbench),
  ...buildTerminalFindCommands(input.terminal),
  ...buildWorkspaceCommands(input.workbench),
  ...buildEditorCommands(input.workbench),
  ...buildTerminalLifecycleCommands(input.terminal),
  ...buildBrowserCommands(input.workbench),
  ...buildCommandPaletteLayoutCommands(input.navigation),
  ...buildComposerAttachmentCommands(input.workbench),
  ...buildCommandPaletteResourceCommands(input.navigation),
];

export const visibleCommandPaletteCommands = (
  commands: SearchDialogCommand[],
  query: string,
  sources?: CommandPaletteSourceSettings,
): SearchDialogCommand[] => {
  const filtered = filterCommandPaletteCommands(commands, query, sources);
  if (query.trim()) return filtered.slice(0, QUERY_RESULT_LIMIT);
  return [
    ...filtered.filter((command) => command.source === "chats").slice(0, EMPTY_QUERY_GROUP_LIMIT),
    ...filtered.filter((command) => command.source !== "chats").slice(0, EMPTY_QUERY_GROUP_LIMIT),
  ];
};
