import { invoke } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  createActiveAgentSessionHandle, type AgentApprovalMode, type AgentSessionHandle,
} from "./agentSessionHandle";
import type { deriveActiveAgentSessionState } from "./activeAgentSessionState";
import { connectionEnvironmentInputs, type AiConnectionSettings } from "./connectionSettings";
import { defaultTerminalLaunchProfile } from "./launchProfiles";
import type { createPaneActivityLog } from "./paneActivityLog";
import { selectionToText, type SelectionRange } from "./selection";
import type { createTerminalPaneFinalize } from "./terminalPaneFinalize";
import { createTerminalPaneRename } from "./terminalPaneRename";
import { createTerminalPaneCommands, createWorktreePersistence } from "./terminalPaneCommands";
import { createTerminalResize } from "./terminalResize";
import {
  createTerminalSurfaceActions, terminalSurfaceDepsFromHook,
} from "./terminalSurfaceController";
import type { useAppShellDomain } from "./useAppShellDomain";
import type { useConversationRuntime } from "./useConversationRuntime";
import type { useWorktreeLabelRequest } from "./useWorktreeLabelRequest";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";
import type { createWorkspacePicker } from "./workspacePicker";
import { createUtilityTrayControls } from "./utilityTrayControls";
import type { WorktreeRecord } from "./worktrees";

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = {
  cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[];
};
type AppShell = ReturnType<typeof useAppShellDomain>;
type Conversation = ReturnType<typeof useConversationRuntime>;
type Workspace = ReturnType<typeof useWorkspaceDomain<Snapshot>>;

type TerminalSurfaceRuntimeInput = {
  activeAgentSession: ReturnType<typeof deriveActiveAgentSessionState>;
  agentActivityHook: Conversation["agentActivityHook"];
  agentApprovalMode: AgentApprovalMode;
  connectionSettings: { current: AiConnectionSettings };
  finalizeCreatedTerminalPane: ReturnType<typeof createTerminalPaneFinalize>;
  latest: { current: Snapshot | null };
  metrics: { current: { cw: number; ch: number } };
  paneActivityLog: ReturnType<typeof createPaneActivityLog>;
  persistence: Workspace["persistence"];
  pickWorkspace: ReturnType<typeof createWorkspacePicker>;
  profiles: Workspace["profiles"];
  requestWorktreeLabel: ReturnType<typeof useWorktreeLabelRequest>["requestLabel"];
  selection: { current: SelectionRange | null };
  setComposerError: AppShell["setComposerError"];
  setLaunchError: (message: string | null) => void;
  setSettingsOpen: AppShell["setSettingsOpen"];
  setWorktrees: AppShell["setWorktrees"];
  shellLayout: AppShell["shellLayout"];
  storeRef: { current: { set: (key: string, value: unknown) => Promise<unknown>; save: () => Promise<unknown> } | null };
  terminal: Workspace["terminal"];
  terminalHostRef: { current: HTMLDivElement | null };
  worktrees: WorktreeRecord[];
  workspacePath: string | null;
  workspacePathRef: { current: string | null };
};

const terminalResizeFrom = (input: TerminalSurfaceRuntimeInput) => createTerminalResize({
  getCellMetrics: () => input.metrics.current,
  getHostRect: () => input.terminalHostRef.current?.getBoundingClientRect(),
  getWindowSize: () => ({ height: window.innerHeight, width: window.innerWidth }),
  resize: (cols, rows) => invoke("resize_pty", { cols, rows }),
});

const terminalSurfaceFrom = (
  input: TerminalSurfaceRuntimeInput,
  getActiveHandle: () => AgentSessionHandle | null,
  sendResize: () => void,
) => createTerminalSurfaceActions<Snapshot, SelectionRange>(terminalSurfaceDepsFromHook(input.terminal, {
  ...createTerminalPaneCommands({
    environmentForRoot: (root) => connectionEnvironmentInputs(input.connectionSettings.current, root),
  }),
  ...createWorktreePersistence({
    save: (next) => {
      void input.storeRef.current?.set("worktrees", next);
      void input.storeRef.current?.save();
    },
    setWorktrees: input.setWorktrees,
  }),
  activeAgentDescriptor: () => input.activeAgentSession.activeAgentSessionDescriptor,
  activeAgentHandle: getActiveHandle,
  activePane: () => input.activeAgentSession.activeTerminalPane,
  approvalMode: () => input.agentApprovalMode,
  copyText: writeText,
  defaultProfile: () => input.profiles.terminalProfileRef.current,
  finalizePane: input.finalizeCreatedTerminalPane,
  gateAction: async (action, handle) => (await input.agentActivityHook.gateAppAction(action, handle)).decision,
  getChanging: () => input.profiles.changing,
  getSessionId: input.persistence.activeSessionForProject,
  getWorkspacePath: () => input.workspacePathRef.current,
  getWorkspacePathOrState: () => input.workspacePathRef.current ?? input.workspacePath,
  getWorktrees: () => input.worktrees,
  latest: input.latest,
  now: Date.now,
  promptWorktreeLabel: input.requestWorktreeLabel,
  readClipboard: readText,
  recordActivity: input.agentActivityHook.recordAgentActivity,
  recordCreated: input.paneActivityLog.recordCreated,
  recordCreatedWorktree: input.paneActivityLog.recordCreatedWorktree,
  requestPaint: () => input.terminal.requestPaintRef.current(),
  savedLabel: input.persistence.savedPaneLabel,
  scheduleResize: () => setTimeout(sendResize, 0),
  selection: input.selection,
  selectionText: (snapshot, selection) => selectionToText(snapshot.cells, snapshot.cols, selection),
  setChanging: input.profiles.setChanging,
  setComposerError: input.setComposerError,
  setLaunchError: input.setLaunchError,
  updateProjectStatus: input.persistence.updateOpenProjectStatus,
  updateSessionStatus: (root, status) => input.persistence.updateActiveSessionStatus(root, status),
}));

const activeHandleFrom = (
  input: TerminalSurfaceRuntimeInput,
  surface: ReturnType<typeof terminalSurfaceFrom>,
) => input.activeAgentSession.activeAgentSessionDescriptor ? createActiveAgentSessionHandle({
  activePaneId: () => input.terminal.activePaneIdRef.current,
  closePane: surface.closeTerminalPane,
  descriptor: input.activeAgentSession.activeAgentSessionDescriptor,
  focusPane: surface.focusTerminalPane,
  recordClosed: (descriptor) => input.agentActivityHook.recordAgentActivity(descriptor, {
    kind: "process", label: "Closed pane", detail: descriptor.label, status: "exited",
  }),
  sendEnter: () => invoke("send_key", {
    code: "Enter", text: null, shift: false, alt: false, ctrl: false, sup: false,
  }),
  sendInterrupt: () => invoke("send_key", {
    code: "KeyC", text: null, shift: false, alt: false, ctrl: true, sup: false,
  }),
  sendText: (text) => invoke("paste", { text }),
  snapshot: (paneId) => input.terminal.snapshotsRef.current[paneId]
    ?? (input.terminal.activePaneIdRef.current === paneId ? input.latest.current : null),
}) : null;

const utilityTrayFrom = (
  input: TerminalSurfaceRuntimeInput,
  surface: ReturnType<typeof terminalSurfaceFrom>,
) => createUtilityTrayControls({
  closeSettings: () => input.setSettingsOpen(false),
  createTerminalPane: surface.createTerminalPane,
  defaultProfile: defaultTerminalLaunchProfile,
  getRoot: () => input.workspacePathRef.current ?? input.workspacePath,
  getSessionId: input.persistence.activeSessionForProject,
  getSurfaceMode: () => input.shellLayout.agentSurfaceMode,
  getTrayMode: () => input.shellLayout.utilityTrayMode,
  hasTerminalPanes: (root, sessionId) => input.terminal.panesForSession(root, sessionId).length > 0,
  pickWorkspace: input.pickWorkspace,
  resolveProfile: input.profiles.resolveProfile,
  setSurfaceMode: input.shellLayout.setAgentSurfaceMode,
  setTrayMode: input.shellLayout.setUtilityTrayMode,
});

const renamePaneFrom = (input: TerminalSurfaceRuntimeInput) => createTerminalPaneRename({
  getPanes: input.terminal.panesForSession,
  getRoot: () => input.workspacePathRef.current,
  getSessionId: input.persistence.activeSessionForProject,
  persistLabel: input.persistence.persistPaneLabel,
  promptLabel: (current) => window.prompt("Pane name or task label", current),
  setSessionPanes: input.terminal.setSessionPanes,
});

export const appTerminalSurfaceRuntimeFrom = (input: TerminalSurfaceRuntimeInput) => {
  const sendTerminalResize = terminalResizeFrom(input);
  let activeAgentSessionHandle: AgentSessionHandle | null = null;
  const terminalSurface = terminalSurfaceFrom(input, () => activeAgentSessionHandle, sendTerminalResize);
  activeAgentSessionHandle = activeHandleFrom(input, terminalSurface);
  return {
    activeAgentSessionHandle,
    renameTerminalPane: renamePaneFrom(input),
    sendTerminalResize,
    terminalSurface,
    utilityTrayControls: utilityTrayFrom(input, terminalSurface),
  };
};
