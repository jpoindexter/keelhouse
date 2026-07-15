import { composerHelpText, type ComposerAppCommand } from "./agentComposer";
import { createAppAction, type AppActionDecision, type AppActionDescriptor } from "./appActions";

type CommandContext = {
  selectedFilePath: string | null;
  terminalLabel: string | null;
  gateAction: (action: AppActionDescriptor) => Promise<{ decision: AppActionDecision; label: string }>;
  saveFile: () => Promise<boolean>;
  openSearch: () => void;
  pickWorkspace: () => Promise<unknown>;
  clearTerminal: () => Promise<unknown>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
};

export const composerAppAction = (
  command: ComposerAppCommand,
  target?: string | null,
): AppActionDescriptor => {
  if (command === "save") return createAppAction({
    kind: "save-file", label: "Save file", target: target ?? undefined, risk: "high",
    requestedBy: "composer", undoHint: "Use editor undo or revert the file from source control.",
  });
  if (command === "find") return createAppAction({
    kind: "find-in-file", label: "Find in file", target: target ?? undefined,
    risk: "low", requestedBy: "composer",
  });
  if (command === "open-folder") return createAppAction({
    kind: "open-folder", label: "Open folder picker", risk: "medium", requestedBy: "composer",
  });
  return createAppAction({
    kind: "clear-terminal", label: "Clear terminal", target: target ?? undefined,
    risk: "medium", requestedBy: "composer", undoHint: "Terminal scrollback is not restored by the app.",
  });
};

const approve = async (
  command: ComposerAppCommand,
  target: string | null,
  context: CommandContext,
) => {
  const audit = await context.gateAction(composerAppAction(command, target));
  if (audit.decision === "approved") return true;
  context.setError(`${audit.label} was ${audit.decision}.`);
  return false;
};

const runEditorCommand = async (
  command: "save" | "find",
  context: CommandContext,
) => {
  if (!context.selectedFilePath) {
    context.setError(command === "save" ? "No editor file is selected." : "Open a file before using Find.");
    return false;
  }
  if (!await approve(command, context.selectedFilePath, context)) return false;
  if (command === "find") {
    context.openSearch();
    return true;
  }
  const saved = await context.saveFile();
  if (!saved) context.setError("Save failed. The editor recovery panel has the details.");
  return saved;
};

export const runComposerAppCommand = async (
  command: ComposerAppCommand,
  context: CommandContext,
): Promise<boolean> => {
  if (command === "save" || command === "find") return runEditorCommand(command, context);
  if (command === "help") {
    context.setNotice(composerHelpText());
    return true;
  }
  const target = command === "clear-terminal" ? context.terminalLabel : null;
  if (!await approve(command, target, context)) return false;
  if (command === "open-folder") await context.pickWorkspace();
  else if (command === "clear-terminal") await context.clearTerminal();
  else return false;
  return true;
};
