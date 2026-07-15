import type { ManagedTerminalPane } from "./managedTerminalPane";
import { removeProjectPaneContexts } from "./paneOwnership";

type CloseProjectResourcesInput = {
  activePanes: Record<string, number>;
  closePane: (paneId: number) => Promise<unknown>;
  conversations: Record<string, { activeRunId?: string | null }>;
  intentionallyTerminatedPaneIds: Set<number>;
  panes: ManagedTerminalPane[];
  projectPanes: Record<string, ManagedTerminalPane[]>;
  projectPath: string;
  snapshots: Record<number, unknown>;
  stopChatRun: (runId: string) => Promise<unknown>;
};

export const closeProjectResources = async ({
  activePanes,
  closePane,
  conversations,
  intentionallyTerminatedPaneIds,
  panes,
  projectPanes,
  projectPath,
  snapshots,
  stopChatRun,
}: CloseProjectResourcesInput) => {
  const activeRunIds = Object.entries(conversations)
    .filter(([key, conversation]) => key.startsWith(`${projectPath}\n`) && conversation.activeRunId)
    .map(([, conversation]) => conversation.activeRunId as string);
  for (const runId of activeRunIds) await stopChatRun(runId);
  for (const pane of panes) {
    intentionallyTerminatedPaneIds.add(pane.id);
    try {
      await closePane(pane.id);
    } catch (error) {
      intentionallyTerminatedPaneIds.delete(pane.id);
      throw error;
    }
    delete snapshots[pane.id];
  }
  return {
    activePanes: removeProjectPaneContexts(activePanes, projectPath),
    projectPanes: removeProjectPaneContexts(projectPanes, projectPath),
  };
};
