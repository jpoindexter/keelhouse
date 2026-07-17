import {
  DEFAULT_COMMAND_PALETTE_SOURCES,
  type CommandPaletteSourceId,
  type CommandPaletteSourceSettings,
} from "./commandPaletteSources";

export type CommandPaletteCommand = {
  id: string;
  label: string;
  detail: string;
  source?: CommandPaletteSourceId;
  shortcut?: string;
  disabled?: boolean;
  keywords?: string[];
};

const normalize = (value: string) => value.trim().toLowerCase();
const normalizeLabel = (value: string) => normalize(value).replace(/(?:…|\.\.\.)$/, "");

export const commandPaletteSearchText = (command: CommandPaletteCommand) =>
  normalize([
    command.id,
    command.label,
    command.detail,
    command.source ?? "commands",
    command.shortcut ?? "",
    ...(command.keywords ?? []),
  ].join(" "));

export const filterCommandPaletteCommands = <T extends CommandPaletteCommand>(
  commands: T[],
  query: string,
  sources: CommandPaletteSourceSettings = DEFAULT_COMMAND_PALETTE_SOURCES,
): T[] => {
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return commands.filter((command) => {
    if (!sources[command.source ?? "commands"]) return false;
    if (terms.length === 0) return true;
    const haystack = commandPaletteSearchText(command);
    return terms.every((term) => haystack.includes(term));
  }).sort((left, right) => (
    Number(normalizeLabel(right.label) === normalizedQuery)
    - Number(normalizeLabel(left.label) === normalizedQuery)
  ));
};
