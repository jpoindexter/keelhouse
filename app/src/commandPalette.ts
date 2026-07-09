export type CommandPaletteCommand = {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  disabled?: boolean;
  keywords?: string[];
};

const normalize = (value: string) => value.trim().toLowerCase();

export const commandPaletteSearchText = (command: CommandPaletteCommand) =>
  normalize([
    command.id,
    command.label,
    command.detail,
    command.shortcut ?? "",
    ...(command.keywords ?? []),
  ].join(" "));

export const filterCommandPaletteCommands = <T extends CommandPaletteCommand>(commands: T[], query: string): T[] => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return commands;
  return commands.filter((command) => {
    const haystack = commandPaletteSearchText(command);
    return terms.every((term) => haystack.includes(term));
  });
};
